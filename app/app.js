"use strict";
/* Fit App shell. Pattern adapted from Meal Prep app.js + Pace app.js:
   local store, repair-on-load (never drops data), sidebar hidden on
   every load with a session-only toggle, first-open setup pop-up. */
(function () {
  var L = window.FitLogic, D = window.FIT_DATA;
  var KEY = "fit-app-v1";
  var OWNER_KEY = KEY + "-owner";
  /* Her rulings, 2 Nov 2026: ALL FREE FOR NOW + SPANISH HELD BACK.
     The plans, prices and billing code stay in the tree, switched
     off by PLANS_LIVE; the Spanish tables stay in i18n.js, saved
     and unshipped, behind SPANISH_LIVE. One word brings either
     back; nothing was deleted to build this state. */
  var PLANS_LIVE = false;
  var SPANISH_LIVE = false;
  function accountStateKey(uid) { return KEY + "-account-" + encodeURIComponent(String(uid)); }
  var state;
  /* ACCOUNT AGE (Tranche B): firstSeenAt on the profile is
     the tier machine's clock. repairState rebuilds the
     profile from a fixed field list, so the stamp is
     carried across every repair by hand: a value found in
     the raw state (or already known this session) wins; a
     profile without one is stamped at this first load of
     the build and never dropped after. */
  var knownFirstSeen = null;
  function firstSeenOf(raw) {
    return raw && raw.profile && typeof raw.profile.firstSeenAt === "string" && raw.profile.firstSeenAt ? raw.profile.firstSeenAt : null;
  }
  function repairKeep(raw) {
    var fs = firstSeenOf(raw) || knownFirstSeen;
    var out = L.repairState(raw);
    if (out.profile) {
      out.profile.firstSeenAt = fs || new Date().toISOString();
      knownFirstSeen = out.profile.firstSeenAt;
    }
    return out;
  }
  /* Legacy rescue (build 17): demo sessions are gone (her
     20:57 rule — the door is sign up or sign in, always). An
     install that once parked its real state for a demo gets
     that state back here, once: the parked copy wins, both
     legacy keys are cleared, and no demo can ever start. */
  try {
    var parkedOnce = localStorage.getItem("fit-app-v1-parked");
    if (parkedOnce) { localStorage.setItem(KEY, parkedOnce); localStorage.removeItem("fit-app-v1-parked"); }
    localStorage.removeItem("fit-app-demo");
  } catch (e) {}
  try {
    var bootRaw = localStorage.getItem(KEY);
    if (localStorage.getItem(OWNER_KEY)) bootRaw = null;
    state = repairKeep(JSON.parse(bootRaw || "null"));
  }
  catch (e) { state = L.emptyState(); }
  if (window.Lang) Lang.use(SPANISH_LIVE ? (state.settings && state.settings.lang) : "en");
  try { if (!SPANISH_LIVE) document.body.classList.add("esHeld"); } catch (e) {}
  var currentArea = null, currentSub = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* The language layer (i18n.js): every user-facing word
     resolves through tr(); English is the source of
     truth, the device language is followed, a Settings
     choice overrides, English fills gaps. */
  function wallyLine(key) { return tr("wally." + key, null, window.Wally ? window.Wally.BUBBLES[key] : key); }
  function tr(key, vars, fallback) {
    if (!window.Lang) return fallback != null ? fallback : key;
    var s = window.Lang.t(key, vars);
    return (s === key && fallback != null) ? fallback : s;
  }
  /* Content pass (Tranche A-3): library names + cues resolve
     through the language layer's content tables. USER data is
     never translated: custom recipes keep the name their owner
     gave them, and stored routine names stay as built. */
  function cName(kind, id, fallback) {
    if (!window.Lang || !window.Lang.content) return fallback;
    return window.Lang.content(kind, id) || fallback;
  }
  function recName(r) { return (!r || r.custom) ? (r ? r.name : "") : cName("recipe", r.id, r.name); }
  function recIngName(r, name) { return (r && r.custom) ? name : cName("ingredient", name, name); }
  function recUnitName(r, unit) { return (r && r.custom) ? unit : cName("unit", unit, unit); }
  function recSteps(r) {
    if (!r) return [];
    if (r.custom) return r.steps || [];
    var s = (window.Lang && window.Lang.content) ? window.Lang.content("steps", r.id) : null;
    return Array.isArray(s) ? s : (r.steps || []);
  }
  function exName(e) { return cName("exercise", e.id, e.name); }
  /* Search reads what the user reads: the stored name and the
     displayed (language-layer) name both count as match sources,
     with accents folded on both sides, so the name on screen is
     findable by typing it, with or without its accents. */
  function foldName(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function exCue(e) { return cName("exerciseCue", e.id, e.cue); }
  function exPart(e) { return cName("part", e.partLabel, e.partLabel); }
  function exEquip(e) { return cName("equip", e.equipment, e.equipment); }
  function machName(m) { return cName("machine", m.id, m.name); }
  /* Saves stay on the device first, always. When the user is
     signed in, each save also mirrors to their account
     (Phase 6, P2). A full device (QA Phase 2 advisory) never
     fails silently: the newest changes are held in memory,
     a kind note shows in Settings, and saving retries on the
     next change. */
  var saveFailed = false;
  function saveLocal() {
    try {
      var raw = JSON.stringify(state);
      if (authUser && !authUser.isAnonymous) {
        localStorage.setItem(OWNER_KEY, authUser.uid);
        localStorage.setItem(accountStateKey(authUser.uid), raw);
      }
      localStorage.setItem(KEY, raw);
      saveFailed = false;
    }
    catch (e) {
      if (!saveFailed) toast(tr("toast.storageFull"));
      saveFailed = true;
    }
    var sn = $("saveNote"); if (sn) sn.textContent = saveFailed ?
      tr("set.saveFull") : "";
  }
  function save() { saveLocal(); scheduleMirror(); FitRemind.sync(); }

  /* --- Device-local reminders (Tranche A-4) ------------------------------
     Inside the store wrap, dose + gym times schedule gentle phone
     notifications ON the device (no server, nothing leaves the phone).
     On the web there is no plugin: sync is a no-op and Today + the
     calendar carry the reminders, as the Settings row says plainly.
     A failure here must never break a save: every call is fenced. --- */
  var FitRemind = (function () {
    var timer = null;
    function plugin() {
      try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null; }
      catch (e) { return null; }
    }
    function readMap() { try { var m = JSON.parse(localStorage.getItem("fit-remind-map") || "null"); return (m && typeof m === "object" && !Array.isArray(m)) ? m : null; } catch (e) { return null; } }
    function writeMap(m) { try { localStorage.setItem("fit-remind-map", JSON.stringify(m)); } catch (e) {} }
    function sync() {
      var P = plugin(); if (!P) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 400);
    }
    function bodyFor(r) {
      var g = window.FitHealth.notificationContent(r.kind, r.name, !!(state.settings && state.settings.notifDetails));
      if (g) return tr("rem.generalBody", null, g.body);
      if (r.kind === "dose") return tr("rem.doseBody");
      return bodyForRest(r);
    }
    function bodyForRest(r) { return r.kind === "dose" ? tr("rem.doseBody") : (r.kind === "todo" ? tr("rem.todoBody", null, "Time for your task") : tr("rem.gymBody")); }
    function titleFor(r) {
      var g = window.FitHealth.notificationContent(r.kind, r.name, !!(state.settings && state.settings.notifDetails));
      if (g) return g.title;
      return r.kind === "water" ? tr("water.remindTitle") : r.name;
    }
    var CAT = { dose: "health", appt: "health", gym: "workout", water: "water", todo: "tasks" };
    function catOn(kind) { var off = (state.settings && state.settings.remindOff) || []; return off.indexOf(CAT[kind] || kind) === -1; }
    function currentItems() {
      return window.FitEvents.assignIds(window.FitEvents.plan(state, Date.now(), L.todayKey()).filter(function (r) { return catOn(r.kind); })).map(function (r) {
        return Object.assign({}, r, { title: titleFor(r), body: bodyFor(r) });
      });
    }
    var running = false, again = false;
    function run() {
      var P = plugin(); if (!P) return;
      if (running) { again = true; return; }
      running = true;
      var done = function () { running = false; if (again) { again = false; run(); } };
      try {
        var prev = readMap();
        var legacy = [];
        if (!prev) { try { legacy = JSON.parse(localStorage.getItem("fit-remind-ids") || "[]"); } catch (e) {} prev = {}; }
        var pre = Promise.resolve();
        if (legacy.length) pre = P.cancel({ notifications: legacy.map(function (id) { return { id: id }; }) }).catch(function () {}).then(function () { try { localStorage.removeItem("fit-remind-ids"); } catch (e) {} });
        if (!state.settings || state.settings.notifications !== true) {
          var ids = Object.keys(prev).map(function (k) { return { id: Number(k) }; });
          pre.then(function () { return ids.length ? P.cancel({ notifications: ids }) : null; }).catch(function () {}).then(function () { writeMap({}); maybeAsk(); done(); });
          return;
        }
        var items = currentItems();
        var rc = window.FitEvents.reconcile(prev, items.map(function (n) { return { id: n.id, at: n.at, title: n.title, body: n.body }; }));
        var byId = {}; items.forEach(function (n) { byId[n.id] = n; });
        pre.then(function () { return rc.cancel.length ? P.cancel({ notifications: rc.cancel.map(function (id) { return { id: id }; }) }) : null; })
          .catch(function () {})
          .then(function () {
            var map = Object.assign({}, rc.map);
            rc.schedule.forEach(function (n) { delete map[n.id]; });
            if (!rc.schedule.length) { writeMap(map); return null; }
            return P.schedule({ notifications: rc.schedule.map(function (n) { return { id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at) } }; }) })
              .then(function () { rc.schedule.forEach(function (n) { map[n.id] = rc.map[n.id]; }); writeMap(map); })
              .catch(function () { writeMap(map); });
          }).then(done, done);
      } catch (e) { done(); }
    }
    /* Honest permission state for the UI: unavailable (web) | off | denied | on. */
    function status() {
      var P = plugin();
      if (!P) return Promise.resolve("unavailable");
      if (!state.settings || state.settings.notifications !== true) {
        if (P.checkPermissions) return P.checkPermissions().then(function (r) { return r && r.display === "denied" ? "denied" : "off"; }).catch(function () { return "off"; });
        return Promise.resolve("off");
      }
      if (P.checkPermissions) return P.checkPermissions().then(function (r) { return r && r.display === "granted" ? "on" : "denied"; }).catch(function () { return "on"; });
      return Promise.resolve("on");
    }
    var askShown = false;
    function maybeAsk() {
      if (askShown) return;
      try {
        if (!state.settings || state.settings.notifications === true || state.settings.remindAsked) return;
        if (document.body.classList.contains("signedOut")) return;
        var plan = L.planReminders(state, L.todayKey(), { now: Date.now() });
        if (!plan.length) return;
        var m = $("remindAsk"); if (!m) return;
        askShown = true;
        var w = $("remindAskWally");
        if (w) w.innerHTML = guideOn() && window.Wally ? wallyWrap("welcome", tr("rem.askBody"), 64) : "";
        m.classList.remove("hidden");
      } catch (e) {}
    }
    function setOn(on) {
      var P = plugin(); if (!P) return Promise.resolve(false);
      if (!on) { state.settings.notifications = false; save(); return Promise.resolve(true); }
      return P.requestPermissions().then(function (res) {
        if (res && res.display === "granted") { state.settings.notifications = true; save(); return true; }
        return false;
      }).catch(function () { return false; });
    }
    function cancelAll() {
      var P = plugin(); var m = readMap() || {};
      var ids = Object.keys(m).map(function (k) { return { id: Number(k) }; });
      try { localStorage.removeItem("fit-remind-map"); } catch (e) {}
      if (!P || !ids.length) return Promise.resolve();
      try { return Promise.resolve(P.cancel({ notifications: ids })).catch(function () {}); } catch (e) { return Promise.resolve(); }
    }
    return { catOn: catOn, cancelAll: cancelAll, sync: sync, run: run, setOn: setOn, status: status, upcoming: function (n) { return window.FitEvents.listUpcoming(state, Date.now(), L.todayKey(), n * 3).filter(function (r) { return catOn(r.kind); }).slice(0, n); }, available: function () { return !!plugin(); } };
  })();

  /* --- Plans, prices and the shop seam (Tranche B) ------------------------
     The tier machine (auth.js) resolves comp, then the free
     month, then free; this block only DISPLAYS the resolution
     and wires the shop. NO feature reads the tier to lock
     anything in this build: caps land only after the TW-3R
     live case passes at the payment sitting. Prices come
     from prices-data.js (Finance's priced table): the
     device country picks its line, the A$ worth rides
     beside it, and an unpriced country falls back to the
     A$ home line. The shop seam speaks to the store only
     inside the store wraps and only with real keys in the
     config slot; without them it says so, plainly. --- */
  function tierDetail() {
    if (window.FitAuth && window.FitAuth.setAccountAge)
      window.FitAuth.setAccountAge(state.profile ? state.profile.firstSeenAt : null);
    if (window.FitAuth && window.FitAuth.entitlementDetail) return window.FitAuth.entitlementDetail();
    return { plan: "free", reason: "free", daysLeft: 0 };
  }
  function deviceCountry() {
    try {
      var pinned = localStorage.getItem("fit-country");
      if (pinned) return String(pinned).toUpperCase();
    } catch (e) {}
    var loc = (typeof navigator !== "undefined" && (navigator.language || "")) || "";
    var parts = loc.split("-");
    return (parts.length > 1 ? parts[parts.length - 1] : "").toUpperCase();
  }
  function priceText(product) {
    /* -> { text, worth } for the device country, or the A$
       home line (worth null: the price IS the A$ line). */
    var P = window.FitPrices;
    if (P) {
      var hit = P.priceFor(deviceCountry(), product);
      if (hit) return { text: hit.text, worth: hit.worth };
      return { text: P.homePrice(product), worth: null };
    }
    return { text: { monthly: "A$7.99", yearly: "A$59.99", forever: "A$149" }[product], worth: null };
  }
  function priceWithWorth(product) {
    var p = priceText(product);
    return p.worth ? p.text + " (" + tr("plan.worthA", { a: p.worth }) + ")" : p.text;
  }
  /* F2 (G7): the paywall disclosure + legal links stand ON
     the paywall itself. Prices compose from the buttons' own
     source (priceText), never a second copy of the figures. */
  var PRIVACY_URL = "https://support897.github.io/fit-hard/privacy.html";
  var TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
  function renewText() {
    return tr("plan.renewPro", { m: priceText("monthly").text, y: priceText("yearly").text }) + " " +
      tr("plan.renewForever");
  }
  function paywallLegalHtml() {
    return '<p class="hint">' + esc(renewText()) + "</p>" +
      '<p class="row"><a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">' + esc(tr("plan.privacyLink")) + "</a>" +
      '<a href="' + TERMS_URL + '" target="_blank" rel="noopener">' + esc(tr("plan.termsLink")) + "</a></p>";
  }
  var FitShop = (function () {
    var started = false, offers = null;
    function plugin() {
      try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases) || null; }
      catch (e) { return null; }
    }
    function apiKey() {
      var c = window.FIT_SHOP_CONFIG || {};
      var plat = "";
      try { plat = (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || ""; } catch (e) {}
      return plat === "ios" ? (c.revenueCatIosKey || "") : (c.revenueCatAndroidKey || c.revenueCatIosKey || "");
    }
    function ready() { return !!plugin() && !!apiKey(); }
    function init() {
      if (started) return; started = true;
      var P = plugin(); if (!P || !ready()) return;
      try {
        var done = function () { refreshOffers(); };
        if (typeof P.configure === "function") {
          var r = P.configure({ apiKey: apiKey() });
          if (r && typeof r.then === "function") r.then(done).catch(function () {});
          else done();
        } else done();
      } catch (e) {}
    }
    function refreshOffers() {
      var P = plugin(); if (!P || typeof P.getOfferings !== "function") return;
      try {
        P.getOfferings().then(function (o) {
          var cur = o && o.current;
          var pkgs = (cur && cur.availablePackages) || [];
          offers = {};
          pkgs.forEach(function (pk) {
            if (!pk) return;
            if (pk.packageType === "MONTHLY") offers.monthly = pk;
            else if (pk.packageType === "ANNUAL") offers.yearly = pk;
            else if (pk.packageType === "LIFETIME") offers.forever = pk;
          });
          if (!Object.keys(offers).length) offers = null;
          renderPlans();
        }).catch(function () {});
      } catch (e) {}
    }
    function purchasable() { return !!(offers && (offers.monthly || offers.yearly || offers.forever)); }
    function explain() { toast(tr("plan.notOnSale")); }
    function refreshPlan() {
      if (authUser && window.FitAuth) {
        window.FitAuth.syncPlan(authUser.uid, false).then(function (p) {
          if (p) { state.tier = { plan: p }; saveLocal(); }
          renderAccount(); renderPlans();
        }).catch(function () { renderAccount(); renderPlans(); });
      } else { renderAccount(); renderPlans(); }
    }
    function buy(product) {
      if (!purchasable() || !offers[product]) { explain(); return; }
      var P = plugin();
      try {
        P.purchasePackage({ aPackage: offers[product] }).then(function () {
          toast(tr("plan.boughtOk")); refreshPlan();
        }).catch(function () {});
      } catch (e) {}
    }
    function restore() {
      if (!ready()) { explain(); return; }
      var P = plugin();
      try {
        P.restorePurchases().then(function () {
          toast(tr("plan.restoredOk")); refreshPlan();
        }).catch(function () {});
      } catch (e) {}
    }
    return { init: init, purchasable: purchasable, buy: buy, restore: restore };
  })();
  function openPlans() { closeSbOnPhone(); FitShop.init(); showView("plans"); renderPlans(); renderCoachMark("plans", "coachSpotPlans"); }
  function tierStateLine() {
    var d = tierDetail();
    if (d.plan === "pro" && d.reason === "freemonth") return tr("acc.planFreeMonth", { days: d.daysLeft });
    if (d.plan === "pro") return tr("plan.statePro");
    return tr("plan.stateFree");
  }
  function renderPlans() {
    var box = $("plansBox"); if (!box) return;
    {
      var onSale = FitShop.purchasable();
      var yText = priceText("yearly");
      var yMaths = "";
      (function () {
        var m = String(yText.text).match(/^([^\d]*)([\d]+(?:[.,][\d]+)?)([^\d]*)$/);
        if (!m) return;
        var euDecimal = !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(m[2]) && m[2].indexOf(",") !== -1;
        var yn = euDecimal ? parseFloat(m[2].replace(",", ".")) : parseFloat(m[2].replace(/,/g, ""));
        if (!(yn > 0)) return;
        var ym = Math.round(yn / 12 * 100) / 100;
        var ys = (ym % 1 === 0 ? String(ym) : ym.toFixed(2)).replace(".", euDecimal ? "," : ".");
        yMaths = '<p class="hint">' + esc(tr("plan.yearlyMaths", { a: m[1] + ys + m[3] })) + "</p>";
      })();
      var proRows =
        '<p class="big">' + esc(priceWithWorth("monthly")) + " " + esc(tr("plan.perMonth")) + "</p>" +
        '<p class="big">' + esc(priceWithWorth("yearly")) + " " + esc(tr("plan.perYear")) + "</p>" + yMaths +
        '<div class="row"><button class="primaryBtn" id="planBuyMonthly">' + esc(tr("plan.buyMonthly")) + "</button>" +
        '<button class="primaryBtn" id="planBuyYearly">' + esc(tr("plan.buyYearly")) + "</button></div>" +
        (onSale ? "" : '<p class="hint">' + esc(tr("plan.notOnSale")) + "</p>");
      box.innerHTML =
        '<div class="card"><p class="hint">' + esc(tierStateLine()) + "</p></div>" +
        '<div class="card"><h2>' + esc(tr("plan.t0Name")) + '</h2><p>' + esc(tr("plan.t0Body")) + '</p><p class="big">' + esc(tr("plan.freeWord")) + "</p></div>" +
        '<div class="card"><h2>' + esc(tr("plan.t1Name")) + '</h2><p>' + esc(tr("plan.t1Body")) + '</p><p class="big">' + esc(tr("plan.freeWord")) + "</p></div>" +
        '<div class="card"><h2>' + esc(tr("plan.t2Name")) + '</h2><p>' + esc(tr("plan.t2Body")) + "</p>" + proRows + "</div>" +
        '<div class="card"><h2>' + esc(tr("plan.t3Name")) + '</h2><p>' + esc(tr("plan.t3Body")) + '</p><p class="big">' + esc(priceWithWorth("forever")) + ", " + esc(tr("plan.onceWord")) + '</p><div class="row"><button class="primaryBtn" id="planBuyForever">' + esc(tr("plan.buyForever")) + "</button></div></div>" +
        '<div class="card"><h2>' + esc(tr("plan.freeTitle")) + '</h2><p class="hint">' + esc(tr("plan.freePromise")) + '</p><ul class="ingList">' +
        tr("plan.freeItems").split("|").map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        '<h3>' + esc(tr("plan.proAddsTitle")) + '</h3><p>' + esc(tr("plan.proAdds")) + "</p></div>" +
        '<div class="card">' + paywallLegalHtml() + "</div>" +
        '<div class="card"><div class="row"><button class="pillBtn" id="planRestoreBtn">' + esc(tr("plan.restoreBtn")) + '</button><button class="pillBtn" id="planBackBtn">' + esc(tr("plan.backBtn")) + "</button></div></div>";
      var bm = $("planBuyMonthly"); if (bm) bm.addEventListener("click", function () { FitShop.buy("monthly"); });
      var by = $("planBuyYearly"); if (by) by.addEventListener("click", function () { FitShop.buy("yearly"); });
      var bf = $("planBuyForever"); if (bf) bf.addEventListener("click", function () { FitShop.buy("forever"); });
      var rs = $("planRestoreBtn"); if (rs) rs.addEventListener("click", function () { FitShop.restore(); });
    }
    var bk = $("planBackBtn"); if (bk) bk.addEventListener("click", function () { showView("settings"); });
  }
  function refreshProModal() {
    var line = $("proStateLine");
    if (line) line.textContent = FitShop.purchasable() ? tr("pro.stateOpen") : tr("pro.stateWait");
    var renew = $("proRenew");
    if (renew) renew.innerHTML = paywallLegalHtml();
    var local = $("proLocalLine");
    if (local) {
      var cc = deviceCountry(), P = window.FitPrices;
      var priced = P && P.lineFor(cc) && P.lineFor(cc).key !== "AU";
      if (priced) {
        local.textContent = tr("pro.localLine", { price:
          priceWithWorth("monthly") + " " + tr("plan.perMonth") + ", " + tr("plan.or") + " " +
          priceWithWorth("yearly") + " " + tr("plan.perYear") });
        local.hidden = false;
      } else local.hidden = true;
    }
  }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    setTimeout(function () { t.classList.add("hidden"); }, 2600); }

  /* --- Sidebar Law: hidden on EVERY load. The toggle lives only in
     this session (a memory flag + a sessionStorage flag that starts
     closed). Nothing about the sidebar is stored long term. --- */
  var sbOpen = false;
  try { sessionStorage.setItem("fit-sb", "closed"); } catch (e) {}
  function applySidebar() {
    document.body.classList.toggle("sbHidden", !sbOpen);
    $("sidebarToggle").setAttribute("aria-pressed", sbOpen ? "false" : "true");
  }
  /* ROUND 3 (QA's drawer observation on build 20): at PHONE
     width the open drawer leaves the content squeezed into
     a sliver (her sidebar law's open state), so CHOOSING a
     destination closes the drawer and the chosen screen
     lands full width. Wider screens keep the drawer beside
     the content, exactly as the law stands. 700px is the
     stylesheet's own phone breakpoint. */
  function closeSbOnPhone() {
    if (sbOpen && window.innerWidth <= 700) { sbOpen = false; applySidebar(); }
  }
  $("sidebarToggle").addEventListener("click", function () { sbOpen = !sbOpen; applySidebar(); });
  /* Tapping the content sliver closes the menu (her nav
     ruling, 15 Oct 2026 — the Muse-app shape). */
  $("sbShield").addEventListener("click", function () { sbOpen = false; applySidebar(); });
  /* The name re-offer card's own buttons (the ruling's
     bubble): Save lands the name on the profile; a blank
     Save closes the bubble quietly (HQ sail ruling
     22:52 — the offer is spent the moment it shows, and
     a missing name blocks nothing, not even this); the
     X simply closes it too. */
  $("reofferSave").addEventListener("click", function () {
    var v = $("reofferName").value.trim().slice(0, 60);
    if (v) {
      ensureFullProfile();
      state.profile.name = v;
      save();
      renderAll();
    }
    $("nameReoffer").hidden = true;
  });
  $("reofferX").addEventListener("click", function () { $("nameReoffer").hidden = true; });

  function areaById(id) { return D.AREAS.filter(function (a) { return a.id === id; })[0]; }
  function iconFor(areaId) { return { peptides: "#i-pep", meals: "#i-meal", gym: "#i-gym", calendar: "#i-cal" }[areaId] || "#i-star"; }

  function buildSidebar() {
    var needs = (state.profile && state.profile.needs) || [];
    var split = L.areasForNeeds(needs.length ? needs : ["meals", "gym", "peptides", "calendar"]);
    function group(a) {
      var subs = a.subs.map(function (s) {
        return '<button class="subBtn" data-area="' + a.id + '" data-sub="' + s.id + '">' + esc(tr("sub." + s.id, null, s.label)) + "</button>";
      }).join("");
      return '<div class="areaGroup" data-group="' + a.id + '">' +
        '<button class="areaHead" data-grouphead="' + a.id + '"><span class="navIcon ic-' + a.id + '">' +
        '<svg class="ic"><use href="' + iconFor(a.id) + '"/></svg></span><span>' + esc(tr("nav." + a.id, null, a.label)) + "</span>" +
        '<svg class="ic chev"><use href="#i-chev"/></svg></button>' +
        '<div class="subMenu">' + subs + "</div></div>";
    }
    var setUp = !!(state.profile && state.profile.setupDone);
    $("areaGroups").innerHTML = split.active.map(function (id) { return group(areaById(id)); }).join("");
    $("laterGroups").innerHTML = setUp ? split.later.map(function (id) { return group(areaById(id)); }).join("") : "";
    $("laterLabel").hidden = !(setUp && split.later.length);
    document.querySelectorAll("[data-grouphead]").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = b.closest(".areaGroup");
        var was = g.classList.contains("open");
        document.querySelectorAll(".areaGroup.open").forEach(function (x) { x.classList.remove("open"); });
        if (!was) g.classList.add("open");
      });
    });
    document.querySelectorAll(".subBtn").forEach(function (b) {
      b.addEventListener("click", function () { openArea(b.getAttribute("data-area"), b.getAttribute("data-sub")); });
    });
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    $("view-" + name).classList.add("active");
    document.querySelectorAll("[data-view]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === name); });
    /* EVERY VIEW OPENS AT ITS TOP (Polar device finding F3):
       a scroll position earned inside a form or a long view
       never carries into the next screen. */
    if (window.scrollTo) window.scrollTo(0, 0);
    if (typeof markTab === "function") markTab(name);
  }
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () {
      var n = b.getAttribute("data-view");
      showView(n);
      closeSbOnPhone();
      /* ARRIVING RE-RENDERS (Round 2 probe finding): Today and
         Settings showed their last render, not the current
         state, when reached by nav — the Getting Started
         checklist ticked late and the food counts lagged the
         plan. A nav arrival now renders fresh, every time. */
      if (n === "today") renderToday();
      if (n === "settings") renderSettings();
    });
  });

  var EMPTY = {
    peptides: ["empty.pepLine", "pep.addTitle"],
    meals: ["meal.nonePlanned", "meal.planWeekBtn"],
    gym: ["gym.noRoutines", "gym.buildRoutine"],
    calendar: ["empty.calLine", "empty.calBtn"]
  };
  function openArea(areaId, subId) {
    currentArea = areaId; currentSub = subId;
    var a = areaById(areaId); if (!a) return;
    closeSbOnPhone();
    var sub = a.subs.filter(function (s) { return s.id === subId; })[0] || a.subs[0];
    showView("area");
    lastSub[areaId] = sub.id;
    renderSubTabs(a, sub.id);
    $("areaTitle").textContent = tr("nav." + a.id, null, a.label);
    $("areaSub").textContent = tr("sub." + sub.id, null, sub.label) + ".";
    renderCoachMark(coachKeyFor(areaId, sub.id));
    document.querySelectorAll(".subBtn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-area") === areaId && b.getAttribute("data-sub") === sub.id); });
    if (areaId === "meals") {
      $("areaEmpty").classList.add("hidden");
      renderMeals(sub.id);
      return;
    }
    if (areaId === "calendar") {
      $("areaEmpty").classList.add("hidden");
      renderCalendar(sub.id);
      return;
    }
    if (areaId === "gym") {
      $("areaEmpty").classList.add("hidden");
      renderGym(sub.id);
      return;
    }
    if (areaId === "progress") {
      $("areaEmpty").classList.add("hidden");
      renderProgress(sub.id);
      return;
    }
    if (areaId === "peptides") {
      $("areaEmpty").classList.add("hidden");
      renderPeptides(sub.id);
      return;
    }
    $("areaEmpty").classList.remove("hidden");
    var e = EMPTY[areaId] || ["area.empty", "area.start"];
    $("areaEmptyLine").textContent = tr(e[0]);
    $("areaEmptyBtn").textContent = tr(e[1]);
    $("areaEmptyIcon").innerHTML = '<use href="' + iconFor(areaId) + '"/>';
    $("areaBody").innerHTML = "";
  }
  $("areaEmptyBtn").addEventListener("click", function () { toast(tr("toast.comingPhase")); });

  /* ================= MEALS (Phase 2) =================
     Engine, recipes, nutrition table and photo pattern are copied
     from Meal Prep (meals-logic.js, meals-data.js, meals-nutrition.js,
     vendor/). Fit adds: budget planning, treats, and this UI. */
  var MP = window.MP_LOGIC, MD = window.MP_DATA, MN = window.MP_NUTRITION;
  function allRecipes() { return MD.RECIPES.concat(state.customRecipes || []); }
  function recipeById(id) { return allRecipes().filter(function (r) { return r.id === id; })[0] || null; }
  function kcalOf(r) { if (!r || !r.ingredients || !r.ingredients.length) return null; return MP.recipeKcal(r, MN); }
  function mpKey(isoKey) { return String(isoKey).replace(/-/g, "."); }
  function dayLabel(isoKey) {
    var today = L.todayKey();
    if (isoKey === today) return tr("nav.today");
    if (isoKey === L.addDays(today, 1)) return tr("cal.tomorrow");
    return tr("cal.wd" + L.parseKey(isoKey).getDay());
  }
  function budgetKcal() { var b = L.estimateBudget(state.profile || {}); return b ? b.target : null; }
  function mealOpts() { return { maxMinutes: (state.mealPrefs && state.mealPrefs.maxMinutes) || 0 }; }
  function planWeek() {
    var target = budgetKcal();
    var recent = [], gaps = 0, tokeep = [];
    for (var i = 0; i < 7; i++) {
      var iso = L.addDays(L.todayKey(), i);
      var dayTarget = target;
      if (i === 0 && target) dayTarget = L.mealBudgetFor(state.checkins[iso] || "ok", { target: target }).meals;
      var day = L.planDayMeals(dayTarget, allRecipes(), kcalOf, state.profile || {}, recent, mealOpts());
      var entry = {};
      ["breakfast", "lunch", "dinner"].forEach(function (m) {
        delete state.planServings[mpKey(iso) + "." + m];
        if (day[m]) { entry[m] = day[m].id; recent.push(day[m].id); } else gaps++;
      });
      state.plan[mpKey(iso)] = entry;
    }
    save();
    return { gaps: gaps };
  }
  function mealPlanForDay(level, recent) {
    var target = budgetKcal();
    if (!target) return null;
    var budget = L.mealBudgetFor(level, { target: target });
    var day = L.planDayMeals(budget.meals, allRecipes(), kcalOf, state.profile || {}, recent || [], mealOpts());
    if (!day || !day.complete) return null;
    var entry = {};
    ["breakfast", "lunch", "dinner"].forEach(function (m) { if (day[m]) entry[m] = day[m].id; });
    return entry;
  }
  function micInto(textarea) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast(tr("toast.voiceNo")); return; }
    var rec = new SR();
    rec.lang = window.Lang && Lang.current() === "es" ? "es-ES" : "en-AU"; rec.interimResults = false;
    rec.onresult = function (ev) {
      var text = ev.results[0][0].transcript;
      textarea.value = (textarea.value ? textarea.value + "\n" : "") + text;
    };
    rec.onerror = function () { toast(tr("toast.voiceMiss")); };
    rec.start(); toast(tr("toast.listening"));
  }
  function wireMic(btn, textarea) { if (btn) btn.addEventListener("click", function () { micInto(textarea); }); }

  function mealRow(iso, meal, r) {
    var colors = { breakfast: "#C08552", lunch: "#7A8B6F", dinner: "#52695A" };
    var k = kcalOf(r);
    var eaten = !!(state.eaten || {})[iso + "." + meal];
    var sv = (state.planServings || {})[mpKey(iso) + "." + meal];
    var flags = window.FitAllergens ? window.FitAllergens.recipeFlags(r) : [];
    return '<div class="mealItem' + (eaten ? " isEaten" : "") + '"><button class="mealRow" data-recipe="' + r.id + '"><span class="mealDot" style="background:' + colors[meal] + '"></span>' +
      '<span class="mName">' + esc(recName(r)) + (sv && sv !== r.servings ? ' <small class="svChip">' + esc(tr("meal.serves", { n: sv })) + "</small>" : "") + '</span><span class="kcalChip">' + (k == null ? tr("meal.noCount") : tr("meal.aboutKcal", { kcal: k })) + "</span></button>" +
      '<div class="mealActs"><button type="button" class="miniBtn" data-eat="' + iso + "|" + meal + '" aria-pressed="' + eaten + '">' + esc(eaten ? tr("meal.eatenUndo", null, "Eaten ✓") : tr("meal.eat", null, "Mark eaten")) + "</button>" +
      '<button type="button" class="miniBtn" data-swap="' + iso + "|" + meal + '">' + esc(tr("meal.swap", null, "Swap")) + "</button>" +
      '<button type="button" class="miniBtn" data-unplan="' + iso + "|" + meal + '" aria-label="' + esc(tr("meal.removeAria", { name: recName(r) }, "Remove " + recName(r) + " from the plan")) + '">' + esc(tr("meal.remove", null, "Remove")) + "</button></div></div>";
  }
  /* --- Water (build 17, Wave 1): sips, not lectures. Fixed
     friendly sizes, the user's own bottle once set, an undo
     that takes back the last tap, a goal they pick, and one
     reminder at a time they choose. --- */
  function waterCardHtml() {
    var today = L.todayKey();
    var have = (state.water || {})[today] || 0;
    var goal = L.waterGoalMl(state);
    var taps = (state.waterTaps || {})[today] || [];
    var bottle = Number(state.settings && state.settings.bottleMl) || 0;
    var html = '<div class="card"><h2>' + esc(tr("water.title")) + "</h2>" +
      '<p class="big">' + esc(tr("water.line", { have: have, goal: goal })) + "</p>" +
      (have >= goal ? '<p class="hint">' + esc(tr("water.done")) + "</p>" : "") +
      '<div class="row"><button class="pillBtn" data-water="250">' + esc(tr("water.glass")) + "</button>" +
      '<button class="pillBtn" data-water="500">' + esc(tr("water.bottle")) + "</button>" +
      '<button class="pillBtn" data-water="750">' + esc(tr("water.big")) + "</button>" +
      (bottle >= 100 && bottle <= 5000 ? '<button class="pillBtn" data-water="' + bottle + '">' + esc(tr("water.yourBottle", { ml: bottle })) + "</button>" : "") +
      (taps.length ? '<button class="pillBtn" id="waterUndo">' + esc(tr("water.undo")) + "</button>" : "") + "</div>" +
      '<div class="grid2"><label>' + esc(tr("water.goal")) + '<select id="waterGoal">' +
      [1500, 2000, 2500, 3000].map(function (g) { return '<option value="' + g + '"' + (g === goal ? " selected" : "") + ">" + g + " ml</option>"; }).join("") + "</select></label>" +
      "<label>" + esc(tr("water.bottleLabel")) + '<input id="waterBottleMl" type="number" min="100" max="5000" value="' + (bottle || "") + '"></label></div>' +
      '<div class="row"><button class="pillBtn" id="waterBottleBtn">' + esc(tr("water.bottleSet")) + "</button></div>" +
      '<div class="grid2"><label>' + esc(tr("water.remind")) + '<input id="waterRemind" type="time" value="' + esc((state.settings && state.settings.waterReminder) || "") + '"></label></div>' +
      '<div class="row"><button class="pillBtn" id="waterRemindBtn">' + esc(tr("water.remind")) + "</button>" +
      ((state.settings && state.settings.waterReminder) ? '<button class="pillBtn" id="waterRemindOff">' + esc(tr("water.remindOff")) + "</button>" : "") + "</div></div>";
    return html;
  }
  function wireWater() {
    document.querySelectorAll("[data-water]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ml = Number(b.getAttribute("data-water")) || 0;
        if (!ml) return;
        var today = L.todayKey();
        state.water = state.water || {}; state.waterTaps = state.waterTaps || {};
        state.waterTaps[today] = state.waterTaps[today] || [];
        state.waterTaps[today].push(ml);
        state.water[today] = (state.water[today] || 0) + ml;
        save(); renderPlan(); renderChallenge();
      });
    });
    var undo = $("waterUndo");
    if (undo) undo.addEventListener("click", function () {
      var today = L.todayKey();
      var taps = (state.waterTaps || {})[today] || [];
      if (!taps.length) return;
      var ml = taps.pop();
      state.water[today] = Math.max(0, (state.water[today] || 0) - ml);
      save(); renderPlan(); renderChallenge();
    });
    var goalSel = $("waterGoal");
    if (goalSel) goalSel.addEventListener("change", function () {
      state.settings = state.settings || {};
      state.settings.waterGoalMl = Number(goalSel.value) || 2000;
      state.settings.waterGoalPicked = true;
      save(); renderPlan(); renderChallenge();
    });
    var bBtn = $("waterBottleBtn");
    if (bBtn) bBtn.addEventListener("click", function () {
      var v = Math.round(Number($("waterBottleMl").value) || 0);
      state.settings = state.settings || {};
      state.settings.bottleMl = v >= 100 && v <= 5000 ? v : null;
      save(); renderPlan();
    });
    var rBtn = $("waterRemindBtn");
    if (rBtn) rBtn.addEventListener("click", function () {
      var v = $("waterRemind").value;
      state.settings = state.settings || {};
      state.settings.waterReminder = /^\d{2}:\d{2}$/.test(v || "") ? v : null;
      save(); renderPlan();
    });
    var rOff = $("waterRemindOff");
    if (rOff) rOff.addEventListener("click", function () {
      state.settings = state.settings || {};
      state.settings.waterReminder = null;
      save(); renderPlan();
    });
  }
  function renderPlan() {
    var el = $("areaBody");
    var target = budgetKcal();
    var html = waterCardHtml() + '<div class="card"><h2>' + esc(tr("meal.week")) + "</h2>" +
      '<p class="hint">' + (target ? tr("legal.planHint", { kcal: target }) :
        tr("meal.planHintNone")) + "</p>" +
      '<label>' + esc(tr("meal.maxTime", null, "Cooking time limit")) + '<select id="planMaxMin">' +
        [[0, tr("meal.anyTime", null, "Any time")], [15, "15 min"], [20, "20 min"], [30, "30 min"], [45, "45 min"], [60, "60 min"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (((state.mealPrefs && state.mealPrefs.maxMinutes) || 0) === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>" +
      '<p class="hint" id="planNote" role="status"></p>' +
      '<div class="row"><button class="primaryBtn" id="planWeekBtn">' + esc(tr("meal.planWeekBtn")) + '</button></div>' +
      ((function () { var y = state.plan[mpKey(L.addDays(L.todayKey(), -1))] || {}; return ["breakfast", "lunch", "dinner"].some(function (m) { return !!y[m]; }); })()
        ? '<div class="row"><button class="pillBtn" id="sameYesterdayBtn">' + esc(tr("meal.sameYesterday")) + '</button></div>' : "") +
      '<label>' + esc(tr("meal.noteLabel")) + '<textarea id="mealNote" rows="2" placeholder="' + esc(tr("meal.notePh")) + '"></textarea></label>' +
      '<div class="row"><button class="pillBtn" id="mealNoteBtn">' + esc(tr("meal.sortBtn")) + '</button><button class="pillBtn" id="mealNoteMic">' + esc(tr("meal.voiceBtn")) + '</button></div>' +
      '<p class="hint" id="mealNoteMsg"></p></div>';
    var has = Object.keys(state.plan).length > 0;
    if (!has) html += '<div class="card emptyCard">' + (guideOn() ? wallyWrap("welcome", null, 56) : "") + '<svg class="ic icBig"><use href="#i-meal"/></svg><p>' + esc(tr("meal.nonePlanned")) + '</p><p class="hint">' + esc(tr("meal.nonePlannedHint")) + '</p></div>';
    for (var i = 0; i < 7; i++) {
      var iso = L.addDays(L.todayKey(), i), entry = state.plan[mpKey(iso)] || {};
      if (!has && !entry.breakfast) continue;
      var total = 0, rows = "";
      ["breakfast", "lunch", "dinner"].forEach(function (m) {
        var r = entry[m] ? recipeById(entry[m]) : null;
        if (r) { rows += mealRow(iso, m, r); var k = kcalOf(r); if (k) total += k; }
      });
      if (!rows) continue;
      var treats = (state.treats || []).filter(function (t) { return t.dateKey === iso; });
      var tt = L.treatsTotal(treats);
      var dayTarget = target;
      var badToday = iso === L.todayKey() && state.checkins[iso] === "bad" && target;
      if (badToday) dayTarget = L.mealBudgetFor("bad", { target: target }).meals;
      html += '<div class="dayCard"><h3>' + dayLabel(iso) + " · " + iso.slice(8) + "/" + iso.slice(5, 7) + "</h3>" + rows +
        '<p class="dayTotal">' + esc(tr("meal.dayAbout", { kcal: total })) + (dayTarget ? esc(tr("meal.ofAbout", { kcal: dayTarget })) : "") +
        (badToday ? esc(tr("meal.treatRoomDay")) : "") +
        (treats.length ? esc(tr("meal.treatsAbout", { kcal: tt.known })) + (tt.unknown ? esc(tr("meal.plusNoCount", { n: tt.unknown })) : "") : "") + "</p></div>";
    }
    el.innerHTML = html;
    wireWater();
    var syb = $("sameYesterdayBtn");
    if (syb) syb.addEventListener("click", function () {
      var y = state.plan[mpKey(L.addDays(L.todayKey(), -1))] || {};
      var key = mpKey(L.todayKey());
      if (!state.plan[key]) state.plan[key] = {};
      ["breakfast", "lunch", "dinner"].forEach(function (m) { if (y[m]) state.plan[key][m] = y[m]; });
      save(); renderPlan(); toast(tr("meal.yesterdayCopied"));
    });
    $("planMaxMin").addEventListener("change", function () {
      state.mealPrefs = state.mealPrefs || {}; state.mealPrefs.maxMinutes = Number($("planMaxMin").value) || 0; save();
    });
    $("planWeekBtn").addEventListener("click", function () {
      var res = planWeek(); renderPlan();
      if (res.gaps) {
        var pn = $("planNote");
        if (pn) pn.textContent = tr("meal.gapsNote", { n: res.gaps }, res.gaps + " meal slot(s) have no recipe that fits your allergies and time limit. Nothing was relaxed. Try a longer time limit, or check your foods to avoid in the setup guide.");
        toast(tr("meal.weekPartial", null, "Week planned, with a few gaps"));
      } else { toast(tr("meal.weekPlanned")); showWallyCelebration("plan"); }
    });
    el.querySelectorAll("[data-eat]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-eat").replace("|", ".");
        state.eaten = state.eaten || {};
        if (state.eaten[k]) delete state.eaten[k]; else state.eaten[k] = true;
        save(); renderPlan();
      });
    });
    el.querySelectorAll("[data-unplan]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-unplan").split("|");
        var e = state.plan[mpKey(p[0])]; if (!e) return;
        delete e[p[1]]; delete state.planServings[mpKey(p[0]) + "." + p[1]]; delete state.eaten[p[0] + "." + p[1]];
        save(); renderPlan(); toast(tr("meal.removed", null, "Removed from your plan"));
      });
    });
    el.querySelectorAll("[data-swap]").forEach(function (b) {
      b.addEventListener("click", function () { var p = b.getAttribute("data-swap").split("|"); openSwap(p[0], p[1], b); });
    });
    $("mealNoteBtn").addEventListener("click", function () {
      var items = L.parseQuickDump($("mealNote").value, L.todayKey());
      var done = 0, missed = [];
      items.forEach(function (it) {
        var r = MP.findRecipeByName(it.title, MD, state.customRecipes || []);
        if (r) {
          var key = mpKey(it.date);
          if (!state.plan[key]) state.plan[key] = {};
          state.plan[key][r.meal] = r.id; done++;
        } else missed.push(it.title);
      });
      save(); renderPlan();
      $("mealNoteMsg").textContent = done ? (done === 1 ? tr("meal.sortedOne") : tr("meal.sortedMany", { n: done })) + (missed.length ? tr("meal.noMatch", { list: missed.join(", ") }) : "") : tr("meal.nothingMatched");
    });
    wireMic($("mealNoteMic"), $("mealNote"));
    el.querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe"), b); }); });
  }

  /* Modal a11y helpers: role=dialog, focus in, Escape closes, focus returns. */
  var modalReturn = null;
  function openRecipeModal(opener) {
    var m = $("recipeModal"), c = $("recipeModalCard");
    modalReturn = opener || document.activeElement;
    c.setAttribute("role", "dialog"); c.setAttribute("aria-modal", "true"); c.setAttribute("tabindex", "-1");
    var h = c.querySelector("h2"); if (h) { h.id = "recipeModalTitle"; c.setAttribute("aria-labelledby", "recipeModalTitle"); }
    m.classList.remove("hidden");
    setTimeout(function () { c.focus(); }, 30);
  }
  function closeRecipeModal() {
    $("recipeModal").classList.add("hidden");
    if (modalReturn && modalReturn.focus && document.contains(modalReturn)) { try { modalReturn.focus(); } catch (e) {} }
    modalReturn = null;
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !$("recipeModal").classList.contains("hidden")) closeRecipeModal();
    if (ev.key === "Tab" && !$("recipeModal").classList.contains("hidden")) {
      var f = $("recipeModalCard").querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === $("recipeModalCard"))) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
  $("recipeModal").addEventListener("click", function (ev) { if (ev.target === $("recipeModal")) closeRecipeModal(); });

  function openSwap(iso, meal, opener) {
    var cur = recipeById((state.plan[mpKey(iso)] || {})[meal]);
    var cands = window.FitFood.alternatives({ recipes: allRecipes(), meal: meal, currentId: cur && cur.id, profile: state.profile || {},
      recentIds: L.recentRecipeIds(state, L.todayKey()), kcalOf: kcalOf, targetKcal: cur ? kcalOf(cur) : null,
      maxMinutes: mealOpts().maxMinutes }).slice(0, 6);
    var html = "<h2>" + esc(tr("meal.swapTitle", { meal: tr("meal." + meal, null, meal).toLowerCase() }, "Pick a different " + meal)) + "</h2>" +
      '<p class="hint">' + esc(tr("meal.swapHint", null, "Only recipes that fit your allergies and time limit are shown, closest to the calories of the one you have now.")) + "</p>";
    if (!cands.length) html += '<p class="hint">' + esc(tr("meal.swapNone", null, "No other recipe fits right now. Nothing was relaxed.")) + "</p>";
    html += '<div class="swapList">' + cands.map(function (r) {
      var k = kcalOf(r);
      return '<button type="button" class="swapOpt" data-pick="' + esc(r.id) + '"><img alt="" src="' + window.FitRecipeArt.artFor(r) + '"><span><b>' + esc(recName(r)) + "</b><small>" + r.minutes + " min · " +
        (k == null ? esc(tr("meal.noCount")) : esc(tr("meal.aboutKcal", { kcal: k }))) + "</small></span></button>";
    }).join("") + "</div>" +
      '<div class="row"><button class="pillBtn" id="swapClose">' + esc(tr("common.close")) + "</button></div>";
    $("recipeModalCard").innerHTML = html;
    openRecipeModal(opener);
    $("swapClose").addEventListener("click", closeRecipeModal);
    $("recipeModalCard").querySelectorAll("[data-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.plan[mpKey(iso)][meal] = b.getAttribute("data-pick");
        delete state.planServings[mpKey(iso) + "." + meal]; delete state.eaten[iso + "." + meal];
        save(); closeRecipeModal(); renderMeals(currentSub); toast(tr("meal.swapped", null, "Swapped"));
      });
    });
  }

  function allergenLine(r) {
    var A = window.FitAllergens; if (!A) return "";
    var flags = A.recipeFlags(r);
    if (!flags.length) return '<p class="hint allergenLine">' + esc(tr("meal.noKnownAllergens", null, "No common allergens found in the listed ingredients. Always check packaging.")) + "</p>";
    return '<p class="allergenLine"><b>' + esc(tr("meal.contains", null, "Contains or may contain")) + ":</b> " + flags.map(function (f) { return '<span class="allergenChip">' + esc(A.label(f)) + "</span>"; }).join(" ") + "</p>";
  }
  function openRecipe(id, opener, servingsOverride) {
    var r = recipeById(id); if (!r) return;
    var prof = state.profile || {};
    var sv = Math.min(24, Math.max(1, Number(servingsOverride) || r.servings));
    var k = kcalOf(r);
    var conflicts = (window.FitAllergens && (prof.allergies || []).length) ? window.FitAllergens.recipeConflicts(r, prof.allergies) : [];
    var ads = state.profile ? MP.adaptations(r, [{ name: "You", allergies: prof.allergies || [], dislikes: [] }], MD) : [];
    var html = "<h2>" + esc(recName(r)) + "</h2>" +
      '<p class="hint">' + esc((r.cuisines || []).join(", ")) + " · " + r.minutes + " min · " + tr("meal.serves", { n: sv }) +
      (k == null ? tr("meal.noKcalYet") : tr("meal.perServing", { kcal: k })) + "</p>" +
      '<img class="recipeArt" alt="' + esc(r.picture ? tr("meal.photoAlt") : tr("meal.artAlt", { name: recName(r) }, "Illustration of " + recName(r))) + '" src="' + window.FitRecipeArt.artFor(r) + '">' +
      (r.picture ? "" : '<p class="hint artNote">' + esc(tr("meal.artNote", null, "Illustration drawn from this recipe's ingredients, not a photo.")) + "</p>");
    if (conflicts.length) html += '<div class="swapBox warnBox" role="alert"><b>' + esc(tr("meal.hasYourAllergen", null, "Heads up: this recipe contains something you listed to avoid")) + ":</b> " + esc(conflicts.join(", ")) + ". " +
      esc(tr("meal.pickAnother", null, "It is hidden from planning and search. Use Swap to pick a recipe that fits.")) + "</div>";
    html += allergenLine(r);
    if (ads.length && !conflicts.length) html += '<div class="swapBox">' + esc(tr("meal.madeSafe")) + ads.map(function (a) {
      return esc(tr("meal.becomes", { ing: cName("ingredient", a.ingredient, a.ingredient), swap: cName("ingredient", a.swap, a.swap) })); }).join("; ") + ".</div>";
    html += '<div class="svRow" role="group" aria-label="' + esc(tr("meal.servingsAria", null, "Servings")) + '">' +
      '<button type="button" class="pillBtn svBtn" id="svMinus" aria-label="' + esc(tr("meal.fewer", null, "Fewer servings")) + '"' + (sv <= 1 ? " disabled" : "") + '>−</button>' +
      '<span class="svNum" id="svNum" aria-live="polite">' + esc(tr("meal.serves", { n: sv })) + "</span>" +
      '<button type="button" class="pillBtn svBtn" id="svPlus" aria-label="' + esc(tr("meal.more", null, "More servings")) + '"' + (sv >= 24 ? " disabled" : "") + ">+</button></div>";
    if ((r.ingredients || []).length) html += "<h3>" + esc(tr("meal.ingredients")) + "</h3><ul class='ingList'>" + r.ingredients.map(function (i) {
      var q = window.FitFood.fmtQty(window.FitFood.scaleQty(i.qty, sv, r.servings), i.unit);
      return "<li>" + esc(q) + " " + esc(recUnitName(r, i.unit)) + " " + esc(recIngName(r, i.name)) + "</li>"; }).join("") + "</ul>";
    var steps = recSteps(r);
    if (steps.length) html += "<h3>" + esc(tr("meal.steps")) + "</h3><ol class='stepList'>" + steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    html += '<p class="hint provNote">' + (k == null ? esc(tr("meal.noKcalWhy", null, "Calories are not shown because at least one ingredient has no verified value. Nothing was guessed.")) :
      esc(tr("meal.kcalSource", null, "Calories are estimated per serving from USDA FoodData Central values for each ingredient (rounded to 5). They are a guide, not medical advice."))) + "</p>";
    var isFav = (state.favRecipes || []).indexOf(r.id) !== -1;
    html += '<div class="row"><button class="primaryBtn" id="rmToday">' + esc(tr("meal.putToday")) + '</button>' +
      '<button class="pillBtn" id="rmFav" aria-pressed="' + isFav + '">' + esc(tr(isFav ? "meal.favRemove" : "meal.favAdd")) + '</button>' +
      '<button class="pillBtn" id="rmClose">' + esc(tr("common.close")) + '</button></div>';
    $("recipeModalCard").innerHTML = html;
    if ($("recipeModal").classList.contains("hidden")) openRecipeModal(opener); else { var c0 = $("recipeModalCard"); var h0 = c0.querySelector("h2"); if (h0) { h0.id = "recipeModalTitle"; } }
    $("svMinus").addEventListener("click", function () { openRecipe(id, null, sv - 1); $("svMinus").focus(); });
    $("svPlus").addEventListener("click", function () { openRecipe(id, null, sv + 1); $("svPlus").focus(); });
    $("rmFav").addEventListener("click", function () {
      state.favRecipes = state.favRecipes || [];
      var i = state.favRecipes.indexOf(r.id);
      if (i === -1) state.favRecipes.push(r.id); else state.favRecipes.splice(i, 1);
      save(); openRecipe(r.id, null, sv);
      if (currentArea === "meals" && currentSub === "meal-recipes") renderRecipes();
    });
    $("rmClose").addEventListener("click", closeRecipeModal);
    $("rmToday").addEventListener("click", function () {
      var key = mpKey(L.todayKey());
      if (!state.plan[key]) state.plan[key] = {};
      state.plan[key][r.meal] = r.id;
      if (sv !== r.servings) state.planServings[key + "." + r.meal] = sv; else delete state.planServings[key + "." + r.meal];
      delete state.eaten[L.todayKey() + "." + r.meal];
      save();
      closeRecipeModal(); toast(tr("meal.onToday"));
      if (currentArea === "meals") renderMeals(currentSub);
      renderToday();
    });
  }

  function renderRecipes() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("meal.addRecipe")) + '</h2>' +
      '<div class="grid2"><label>' + esc(tr("meal.nameLabel")) + '<input id="ownName" type="text" placeholder="' + esc(tr("meal.namePh")) + '"></label>' +
      '<label>' + esc(tr("meal.mealLabel")) + '<select id="ownMeal"><option value="breakfast">' + esc(tr("meal.breakfast")) + '</option><option value="lunch">' + esc(tr("meal.lunch")) + '</option><option value="dinner" selected>' + esc(tr("meal.dinner")) + '</option></select></label>' +
      '<label>' + esc(tr("meal.cookTime")) + '<input id="ownMinutes" type="number" min="1" value="30"></label>' +
      '<label>' + esc(tr("meal.servesLabel")) + '<input id="ownServings" type="number" min="1" value="2"></label></div>' +
      '<label>' + esc(tr("meal.ingsLabel")) + '<textarea id="ownIngredients" rows="4"></textarea></label>' +
      '<label>' + esc(tr("meal.stepsLabel")) + '<textarea id="ownSteps" rows="4"></textarea></label>' +
      '<div class="row"><button class="primaryBtn" id="ownSave">' + esc(tr("meal.saveRecipe")) + '</button></div>' +
      '<p class="hint">' + esc(tr("meal.justName")) + '</p>' +
      '<div class="row"><input id="nameMealInput" type="text" placeholder="' + esc(tr("meal.typeMealPh")) + '"><button class="pillBtn" id="nameMealBtn">' + esc(tr("meal.getRecipe")) + '</button></div><div id="nameMealResult"></div>' +
      '<h3>' + esc(tr("meal.picRecipe")) + '</h3><p class="hint">' + esc(tr("meal.picHint")) + '</p>' +
      '<div class="row"><input id="picName" type="text" placeholder="' + esc(tr("meal.picNamePh")) + '"><input id="picFile" type="file" accept="image/*" aria-label="Add a recipe photo"></div><div id="picPreview"></div>' +
      '<label>' + esc(tr("meal.ingsLabel")) + '<textarea id="picIngredients" rows="4"></textarea></label>' +
      '<p class="hint">' + esc(tr("meal.picIngsHint")) + '</p>' +
      '<div class="row"><button class="pillBtn" id="picSave">' + esc(tr("meal.savePic")) + '</button></div></div>' +
      '<div class="card"><h2>' + esc(tr("meal.allRecipes")) + '</h2><div class="row"><input id="recipeSearch" type="search" aria-label="' + esc(tr("meal.searchPh")) + '" placeholder="' + esc(tr("meal.searchPh")) + '"></div>' +
      '<div class="grid2 filterRow"><label>' + esc(tr("meal.mealLabel")) + '<select id="fMeal"><option value="">' + esc(tr("meal.allMeals", null, "All meals")) + '</option><option value="breakfast">' + esc(tr("meal.breakfast")) + '</option><option value="lunch">' + esc(tr("meal.lunch")) + '</option><option value="dinner">' + esc(tr("meal.dinner")) + '</option></select></label>' +
      '<label>' + esc(tr("meal.maxTime", null, "Cooking time limit")) + '<select id="fTime"><option value="0">' + esc(tr("meal.anyTime", null, "Any time")) + '</option><option value="15">15 min</option><option value="20">20 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label></div>' +
      '<div class="row"><label class="chkRow"><input type="checkbox" id="fShort"> ' + esc(tr("meal.shortList", null, "Short shopping list (8 ingredients or fewer)")) + '</label></div>' +
      '<div class="row"><label class="chkRow"><input type="checkbox" id="fFav"> ' + esc(tr("meal.favsOnly", null, "Favourites only")) + '</label></div>' +
      '<p class="hint" id="recipeCount" role="status" aria-live="polite"></p><div id="recipeList" class="recipeGrid"></div><div class="row"><button class="pillBtn hidden" id="recipeMore">' + esc(tr("meal.showMore", null, "Show more")) + '</button></div></div>';
    var picData = "";
    $("picFile").addEventListener("change", function () {
      var f = $("picFile").files[0]; if (!f) return;
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        var scale = Math.min(1, 900 / img.width);
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        picData = c.toDataURL("image/jpeg", 0.8);
        $("picPreview").innerHTML = '<img class="photoImg" alt="' + esc(tr("meal.photoAlt")) + '" src="' + picData + '">';
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
    });
    $("picSave").addEventListener("click", function () {
      if (!picData) { toast(tr("toast.addPhoto")); return; }
      var name = $("picName").value.trim() || tr("meal.myPicRecipe");
      var picIngs = ($("picIngredients").value || "").split(/\n+/).map(function (x) { return L.parseIngredientLine(x); }).filter(Boolean);
      state.customRecipes.push({ id: "custom." + Date.now(), name: name, meal: "dinner", cuisines: ["Mine"],
        minutes: 30, servings: 2, ingredients: picIngs, steps: [], custom: true, picture: picData });
      save(); renderRecipes(); toast(tr("meal.savedPic"));
    });
    $("ownSave").addEventListener("click", function () {
      var name = $("ownName").value.trim(); if (!name) { toast(tr("toast.nameFirst")); return; }
      var ings = $("ownIngredients").value.split(/\n+/).map(function (x) { return L.parseIngredientLine(x); }).filter(Boolean);
      var steps = $("ownSteps").value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      state.customRecipes.push({ id: "custom." + Date.now(), name: name, meal: $("ownMeal").value,
        cuisines: ["Mine"], minutes: Math.max(1, Number($("ownMinutes").value) || 30),
        servings: Math.max(1, Number($("ownServings").value) || 2),
        ingredients: ings, steps: steps, custom: true });
      save(); renderRecipes(); toast(tr("meal.savedRecipe"));
    });
    $("nameMealBtn").addEventListener("click", function () {
      var name = $("nameMealInput").value.trim(); if (!name) return;
      var res = MP.buildRecipeFromName(name, MD, state.customRecipes || [], MN);
      if (res.status === "uncountable") {
        $("nameMealResult").innerHTML = '<div class="swapBox">' + esc(tr("meal.makerCant")) + "</div>";
        return;
      }
      if (res.status === "declined") {
        $("nameMealResult").innerHTML = '<div class="swapBox">' + esc(tr("meal.makerBand", { kcal: res.kcal, meal: tr("meal." + res.slot).toLowerCase(), lo: res.band[0], hi: res.band[1] })) + "</div>";
        return;
      }
      var r = res.recipe;
      /* Named-food disclosure: when the typed name asked for a food the
         app cannot count, the card says so in plain words before the
         save tap. The recipe still saves under the typed name; the
         words are the fix, not a rename. */
      var missingLine = "";
      if (res.status === "made" && res.missing && res.missing.length) {
        var esNow = window.Lang && Lang.current() === "es";
        var foods = res.missing.length === 1 ? res.missing[0]
          : res.missing.slice(0, -1).join(", ") + (esNow ? " ni " : " or ") + res.missing[res.missing.length - 1];
        var way = res.standin
          ? (esNow ? "con " : "with ") + cName("ingredient", res.standin, res.standin)
          : (esNow ? "sin eso" : "without it");
        missingLine = '<p class="hint">' + esc(tr("meal.makerMissing", { food: foods, way: way })) + "</p>";
      }
      $("nameMealResult").innerHTML = '<div class="swapBox">' + esc(recName(r)) + " · " + r.minutes + " min · " +
        (kcalOf(r) == null ? tr("meal.noCount") : tr("meal.aboutKcal", { kcal: kcalOf(r) })) +
        (res.status === "found" ? tr("meal.alreadyIn") : '<p class="hint">' + esc(tr("meal.makerHow")) + '</p>' + missingLine + ' <button class="miniBtn" id="nameMealSave">' + esc(tr("meal.saveThis")) + '</button>') + "</div>";
      var sv = $("nameMealSave");
      if (sv) sv.addEventListener("click", function () { state.customRecipes.push(r); save(); renderRecipes(); toast(tr("common.saved")); });
    });
    var shown = 24;
    function drawList(filter, reset) {
      if (reset) shown = 24;
      var all = allRecipes();
      var prof = state.profile || {};
      var flt = { query: filter || "", meal: $("fMeal").value, maxMinutes: Number($("fTime").value) || 0, maxIngredients: $("fShort").checked ? 8 : 0,
        favouritesOnly: $("fFav").checked, favourites: state.favRecipes || [], profile: prof, nameOf: recName };
      var list = window.FitFood.filterRecipes(all, flt);
      var hidden = window.FitFood.countHidden(all, flt);
      var A = window.FitAllergens, unres = A ? A.unresolved(prof.allergies || []) : [];
      function card(r) {
        var k = kcalOf(r), flags = A ? A.recipeFlags(r) : [];
        return '<button class="recipeCard" data-recipe="' + r.id + '"><img alt="" loading="lazy" src="' + window.FitRecipeArt.artFor(r) + '">' +
          "<h3>" + esc(recName(r)) + "</h3><p>" + esc(tr("meal." + r.meal, null, r.meal)) + " · " + r.minutes + " min</p><p>" +
          (k == null ? tr("meal.noCount") : tr("meal.aboutPerServing", { kcal: k })) + "</p>" +
          (flags.length ? '<p class="cardAllergens">' + flags.map(function (f) { return '<span class="allergenChip">' + esc(A.label(f)) + "</span>"; }).join(" ") + "</p>" : "") + "</button>";
      }
      var html = "";
      if (!filter && !flt.meal && !flt.maxMinutes && !flt.maxIngredients && !flt.favouritesOnly) {
        var byId = {}; all.forEach(function (r) { byId[r.id] = r; });
        var favs = (state.favRecipes || []).map(function (id) { return byId[id]; }).filter(function (r) { return r && window.FitFood.isSafe(r, prof); });
        var recents = L.recentRecipeIds(state, L.todayKey()).map(function (id) { return byId[id]; }).filter(function (r) { return r && window.FitFood.isSafe(r, prof); });
        if (favs.length) html += '<h3 class="gridHead">' + esc(tr("meal.favsHead")) + "</h3>" + favs.map(card).join("");
        else html += '<div class="card emptyCard">' + (guideOn() ? wallyWrap("welcome", null, 56) : "") + "<p>" + esc(tr("meal.noFavsLine")) + "</p></div>";
        if (recents.length) html += '<h3 class="gridHead">' + esc(tr("meal.recentsHead")) + "</h3>" + recents.map(card).join("");
        if (html) html += '<h3 class="gridHead">' + esc(tr("meal.allRecipes")) + "</h3>";
      }
      html += list.slice(0, shown).map(card).join("") || '<p class="hint">' + esc(tr("meal.noMatchSearch")) + '</p>';
      $("recipeList").innerHTML = html;
      var cnt = tr("meal.showingN", { n: Math.min(shown, list.length), total: list.length }, "Showing " + Math.min(shown, list.length) + " of " + list.length);
      if (hidden > 0) cnt += " · " + tr("meal.hiddenAllergy", { n: hidden }, hidden + " hidden because of the foods you avoid");
      if (unres.length) cnt += " · " + tr("meal.unresolved", { list: unres.join(", ") }, "We could not map \"" + unres.join(", ") + "\" to a known allergen, so it is matched by ingredient name only. Check labels.");
      $("recipeCount").textContent = cnt;
      $("recipeMore").classList.toggle("hidden", list.length <= shown);
      $("recipeList").querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe"), b); }); });
    }
    function redraw() { drawList($("recipeSearch").value.trim().toLowerCase(), true); }
    drawList("");
    ["recipeSearch"].forEach(function (id) { $(id).addEventListener("input", redraw); });
    ["fMeal", "fTime", "fShort", "fFav"].forEach(function (id) { $(id).addEventListener("change", redraw); });
    $("recipeMore").addEventListener("click", function () { shown += 24; drawList($("recipeSearch").value.trim().toLowerCase(), false); });
  }

  function renderFridge() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("meal.fridgeTitle")) + '</h2>' +
      '<p class="hint">' + esc(tr("meal.fridgeHint")) + '</p>' +
      '<input id="fridgePhoto" type="file" accept="image/*" aria-label="Add a fridge photo"><div id="photoPreview"></div>' +
      '<div class="row"><button class="pillBtn" id="photoScan">' + esc(tr("meal.lookPhoto")) + '</button></div><div id="photoResults"></div></div>' +
      '<div class="card"><h2>' + esc(tr("meal.ideasTitle")) + '</h2><p class="hint">' + esc(tr("meal.ideasHint")) + '</p>' +
      '<div class="row"><button class="primaryBtn" id="ideasBtn">' + esc(tr("meal.ideasBtn")) + '</button></div><div id="ideasList"></div></div>';
    var photoData = "";
    $("fridgePhoto").addEventListener("change", function () {
      var f = $("fridgePhoto").files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { photoData = String(rd.result); $("photoPreview").innerHTML = '<img class="photoImg" alt="' + esc(tr("meal.fridgeAlt")) + '" src="' + photoData + '">'; };
      rd.readAsDataURL(f);
    });
    function loadScript(src) { return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
    function detectRow(name, est) {
      return '<div class="treatRow"><span class="tName">' + esc(name) + (est ? esc(tr("meal.forServing", { kcal: est.kcal, label: est.label })) : "") +
        '</span><button class="miniBtn" data-addfood="' + esc(name) + '">' + esc(tr("meal.addFood")) + '</button></div>';
    }
    function bindRows() {
      $("photoResults").querySelectorAll("[data-addfood]").forEach(function (b) {
        if (b.dataset.bound) return; /* FIT (QA leg 6): re-binding stacked a second handler on every row, so one tap added the food twice */
        b.dataset.bound = "1";
        b.addEventListener("click", function () {
          var name = b.getAttribute("data-addfood");
          state.pantry.push({ id: "g" + Date.now(), name: name, qty: 1, unit: "pcs", storage: "fridge",
            added: mpKey(L.todayKey()), shelfDays: MP.shelfDays(name, "fridge", MD) });
          save(); b.textContent = tr("meal.added"); b.disabled = true; toast(tr("meal.addedFood"));
        });
      });
    }
    $("photoScan").addEventListener("click", async function () {
      if (!photoData) { toast(tr("toast.addPhoto")); return; }
      $("photoResults").innerHTML = '<p class="hint">' + esc(tr("meal.looking")) + '</p>';
      var found = [];
      try {
        if (!window.cocoSsd) { await loadScript("vendor/tf.min.js"); await loadScript("vendor/coco-ssd.min.js"); }
        var model = await cocoSsd.load({ modelUrl: "vendor/model/model.json" });
        var img = $("photoPreview").querySelector("img");
        var preds = await model.detect(img);
        preds.forEach(function (p) { if (found.indexOf(p.class) === -1) found.push(p.class); });
      } catch (e) { found = []; }
      var named = found.map(function (c) { return { c: c, est: MP.photoKcal(c, MN) }; }).filter(function (x) { return x.est; });
      var html = "";
      if (named.length) html += "<h3>" + esc(tr("meal.foundIn")) + "</h3><p class='hint'>" + esc(tr("meal.checkEach")) + "</p>" +
        named.map(function (x) { return detectRow(x.est.food, x.est); }).join("");
      else html += "<h3>" + esc(tr("meal.tapWhat")) + "</h3><p class='hint'>" + esc(tr("meal.quickLook")) + "</p>";
      html += '<div class="chipRow">' + Object.keys(MN.FRIDGE_SERVINGS).map(function (n) {
        return '<button class="chip" data-tapfood="' + esc(n) + '">' + esc(n) + "</button>"; }).join("") + "</div>";
      $("photoResults").innerHTML = html; bindRows();
      $("photoResults").querySelectorAll("[data-tapfood]").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = b.getAttribute("data-tapfood");
          $("photoResults").insertAdjacentHTML("beforeend", detectRow(n, MP.fridgeKcal(n, MN))); bindRows();
        });
      });
    });
    $("ideasBtn").addEventListener("click", function () {
      var names = (state.pantry || []).map(function (p) { return p.name; });
      if (!names.length) { $("ideasList").innerHTML = '<p class="hint">' + esc(tr("meal.ideasEmpty")) + '</p>'; return; }
      var ctx = { preferences: (state.profile || {}).preferences || [], expiringNames: names,
        usedCounts: {}, recentIds: [], family: [], customRecipes: state.customRecipes || [] };
      var scored = allRecipes().map(function (r) { return { r: r, s: MP.recipeScore(r, ctx) }; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
      $("ideasList").innerHTML = scored.map(function (x) {
        var k = kcalOf(x.r);
        return '<button class="mealRow" data-idea="' + x.r.id + '"><span class="mName">' + esc(recName(x.r)) + '</span><span class="kcalChip">' +
          (k == null ? tr("meal.noCount") : tr("meal.aboutKcal", { kcal: k })) + "</span></button>";
      }).join("");
      $("ideasList").querySelectorAll("[data-idea]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-idea")); }); });
    });
  }

  function renderTreats() {
    var el = $("areaBody");
    var byDay = {};
    (state.treats || []).forEach(function (t) { (byDay[t.dateKey] = byDay[t.dateKey] || []).push(t); });
    var days = Object.keys(byDay).sort().reverse();
    var html = '<div class="card"><h2>' + esc(tr("sub.meals-treats", null, "Treats")) + '</h2>' +
      '<p class="hint">' + esc(tr("meal.treatsHint")) + '</p>' +
      '<div class="grid2"><label>' + esc(tr("meal.treatWhat")) + '<input id="trName" type="text" placeholder="' + esc(tr("meal.treatPh")) + '"></label>' +
      '<label>' + esc(tr("meal.treatKcal")) + '<input id="trKcal" type="number" min="0" placeholder="320"></label></div>' +
      '<div class="row"><button class="primaryBtn" id="trAdd">' + esc(tr("meal.addTreat")) + '</button></div>' +
      '<label>' + esc(tr("meal.treatQuick")) + '<textarea id="trQuick" rows="2" placeholder="Cake 320&#10;Chips"></textarea></label>' +
      '<div class="row"><button class="pillBtn" id="trQuickBtn">' + esc(tr("meal.sortTreats")) + '</button><button class="pillBtn" id="trMic">' + esc(tr("meal.voiceBtn")) + '</button></div>' +
      (function () {
        var counts = {}, latest = {};
        (state.treats || []).forEach(function (t) {
          var k = (t.name || "").toLowerCase(); if (!k) return;
          counts[k] = (counts[k] || 0) + 1;
          if (!latest[k] || t.dateKey >= latest[k].dateKey) latest[k] = t;
        });
        var usual = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (latest[b].dateKey < latest[a].dateKey ? -1 : 1); }).slice(0, 6);
        if (!usual.length) return "";
        return '<p class="hint">' + esc(tr("meal.usualTreats")) + '</p><div class="row">' + usual.map(function (k, i) {
          var t = latest[k];
          return '<button class="pillBtn" data-utchip="' + i + '" data-utname="' + esc(t.name) + '" data-utkcal="' + (t.kcal || "") + '">' + esc(t.name) + (t.kcal ? " · " + t.kcal : "") + "</button>";
        }).join("") + "</div>";
      })() +
      '<div class="grid2"><label>' + esc(tr("meal.barcodeLabel")) + '<input id="trBarcode" type="text" inputmode="numeric" autocomplete="off"></label></div>' +
      '<div class="row"><button class="pillBtn" id="trBarcodeBtn">' + esc(tr("meal.barcodeBtn")) + '</button></div><p class="hint" id="trBarcodeMsg"></p></div>';
    if (!days.length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-heart"/></svg><p>' + esc(tr("meal.noTreats")) + '</p></div>';
    days.forEach(function (d) {
      var tt = L.treatsTotal(byDay[d]);
      html += '<div class="dayCard"><h3>' + dayLabel(d) + " · " + d.slice(8) + "/" + d.slice(5, 7) + "</h3>" +
        byDay[d].map(function (t) {
          return '<div class="treatRow"><span class="tName">' + esc(t.name) + '</span><span class="kcalChip">' +
            (t.kcal ? tr("meal.aboutKcal", { kcal: t.kcal }) : tr("meal.noCountShort")) + '</span><button class="miniBtn" data-del="' + t.id + '">' + esc(tr("common.remove")) + '</button></div>';
        }).join("") +
        '<p class="dayTotal">' + esc(tr("meal.treatsDayAbout", { kcal: tt.known })) + (tt.unknown ? esc(tr("meal.treatsPlus", { n: tt.unknown })) : "") + esc(tr("meal.allFine")) + "</p></div>";
    });
    el.innerHTML = html;
    el.querySelectorAll("[data-utchip]").forEach(function (b) {
      b.addEventListener("click", function () {
        var kcal = Number(b.getAttribute("data-utkcal")) || null;
        state.treats.push({ id: "treat." + Date.now(), dateKey: L.todayKey(), name: b.getAttribute("data-utname"), kcal: kcal, note: "" });
        save(); renderTreats(); toast(tr("meal.treatSaved"));
      });
    });
    $("trBarcodeBtn").addEventListener("click", function () {
      var msg = $("trBarcodeMsg");
      var code = ($("trBarcode").value || "").replace(/\D/g, "");
      if (code.length < 6) { msg.textContent = tr("meal.barcodeShort"); return; }
      msg.textContent = "";
      fetch("https://world.openfoodfacts.org/api/v2/product/" + code + ".json").then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.status !== 1 || !j.product) { msg.textContent = tr("meal.barcodeNone"); return; }
        var p = j.product, n = p.nutriments || {};
        var ks = Number(n["energy-kcal_serving"]), k100 = Number(n["energy-kcal_100g"]);
        var kcal = isFinite(ks) && ks > 0 ? Math.round(ks) : (isFinite(k100) && k100 > 0 ? Math.round(k100) : null);
        if (p.product_name) $("trName").value = String(p.product_name).slice(0, 80);
        if (kcal) $("trKcal").value = kcal;
        msg.textContent = tr("meal.barcodeFound") + (kcal && !(isFinite(ks) && ks > 0) ? " " + tr("meal.barcodePer100") : "");
      }).catch(function () { msg.textContent = tr("meal.barcodeOff"); });
    });
    $("trAdd").addEventListener("click", function () {
      var name = $("trName").value.trim(); if (!name) { toast(tr("toast.treatFirst")); return; }
      state.treats.push({ id: "treat." + Date.now(), dateKey: L.todayKey(), name: name,
        kcal: Number($("trKcal").value) > 0 ? Number($("trKcal").value) : null, note: "" });
      save(); renderTreats(); toast(tr("meal.treatSaved"));
    });
    $("trQuickBtn").addEventListener("click", function () {
      var lines = $("trQuick").value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      lines.forEach(function (line) {
        var m = line.match(/^(.*?)\s+(\d{2,4})$/);
        state.treats.push({ id: "treat." + Date.now() + Math.floor(Math.random() * 999), dateKey: L.todayKey(),
          name: m ? m[1] : line, kcal: m ? Number(m[2]) : null, note: "" });
      });
      save(); renderTreats(); toast(tr("meal.treatsSorted"));
    });
    wireMic($("trMic"), $("trQuick"));
    el.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.treats = state.treats.filter(function (t) { return t.id !== b.getAttribute("data-del"); });
        save(); renderTreats();
      });
    });
  }

  function renderGroceries() {
    var el = $("areaBody");
    var rows = window.FitFood.shoppingList({ state: state, recipes: allRecipes(), fromIso: L.todayKey(), days: 7 });
    var libIng = {}, libUnit = {};
    allRecipes().forEach(function (r) { if (!r.custom) (r.ingredients || []).forEach(function (i) { libIng[i.name] = 1; libUnit[i.unit] = 1; }); });
    var pantrySorted = MP.sortByExpiry((state.pantry || []).slice(), new Date(), MD);
    var checkedN = rows.filter(function (r) { return r.checked; }).length + (state.extras || []).filter(function (x) { return x.checked; }).length;
    var cats = {}, order = [];
    rows.forEach(function (r) { if (!cats[r.category]) { cats[r.category] = []; order.push(r.category); } cats[r.category].push(r); });
    function rowHtml(i) {
      var nm = libIng[i.name] ? cName("ingredient", i.name, i.name) : i.name;
      var un = libUnit[i.unit] ? cName("unit", i.unit, i.unit) : i.unit;
      var amount = i.covered ? tr("meal.haveIt") : window.FitFood.fmtQty(i.qty, i.unit) + " " + un;
      var partial = (!i.covered && i.partialHave > 0) ? ' <small class="hint">(' + esc(tr("meal.haveSome", { qty: window.FitFood.fmtQty(i.partialHave, i.unit), unit: un }, "you have " + window.FitFood.fmtQty(i.partialHave, i.unit) + " " + un)) + ")</small>" : "";
      return '<label class="listRow grocRow' + (i.checked ? " isTicked" : "") + '"><input type="checkbox" data-gtick="' + esc(i.key) + '"' + (i.checked ? " checked" : "") + '><span class="grow">' + esc(nm) + " · " + esc(amount) + partial + "</span></label>";
    }
    var html = '<div class="card"><h2>' + esc(tr("meal.groceryList")) + '</h2><p class="hint">' + esc(tr("meal.grocHint")) + " " + esc(tr("meal.grocRange", null, "Covers the next 7 days of your plan, scaled to the servings you chose.")) + '</p>' +
      (rows.length ? order.map(function (c) { return '<h3 class="gridHead">' + esc(c) + "</h3>" + cats[c].map(rowHtml).join(""); }).join("") : '<p class="hint">' + esc(tr("meal.noPlanYet")) + '</p>') +
      '<h3 class="gridHead">' + esc(tr("meal.extras", null, "Your extras")) + "</h3>" +
      (state.extras || []).map(function (x) {
        return '<div class="listRow grocRow' + (x.checked ? " isTicked" : "") + '"><label class="grow"><input type="checkbox" data-xtick="' + esc(x.id) + '"' + (x.checked ? " checked" : "") + "> " + esc(x.name) + "</label>" +
          '<button type="button" class="miniBtn" data-xdel="' + esc(x.id) + '" aria-label="' + esc(tr("meal.removeAria", { name: x.name }, "Remove " + x.name)) + '">' + esc(tr("meal.remove", null, "Remove")) + "</button></div>";
      }).join("") +
      '<div class="row"><input id="extraName" type="text" aria-label="' + esc(tr("meal.addAnythingPh")) + '" placeholder="' + esc(tr("meal.addAnythingPh")) + '"><button class="pillBtn" id="extraAdd">' + esc(tr("common.add")) + '</button></div>' +
      (checkedN ? '<div class="row"><button class="pillBtn" id="grocClear">' + esc(tr("meal.clearTicked", { n: checkedN }, "Clear ticked (" + checkedN + ")")) + "</button></div>" : "") + "</div>";
    html += '<div class="card"><h2>' + esc(tr("meal.foodYouHave")) + '</h2>' +
      '<div class="grid2"><label>' + esc(tr("meal.foodName")) + '<input id="gName" type="text" placeholder="' + esc(tr("meal.foodNamePh")) + '"></label>' +
      '<label>' + esc(tr("meal.amount")) + '<input id="gQty" type="number" min="0" step="any" value="500"></label>' +
      '<label>' + esc(tr("meal.unit")) + '<select id="gUnit"><option>g</option><option>ml</option><option>pcs</option><option>slices</option></select></label>' +
      '<label>' + esc(tr("meal.storedIn")) + '<select id="gStorage"><option value="fridge">' + esc(tr("meal.storeFridge")) + '</option><option value="freezer">' + esc(tr("meal.storeFreezer")) + '</option><option value="pantry">' + esc(tr("meal.storePantry")) + '</option></select></label></div>' +
      '<div class="row"><button class="primaryBtn" id="gAdd">' + esc(tr("meal.addFoodBtn")) + '</button></div>' +
      (pantrySorted.length ? pantrySorted.map(function (p) {
        var left = MP.daysLeft(p, new Date(), MD);
        return '<div class="listRow"><span class="grow">' + esc(p.name) + " · " + esc(p.qty) + " " + esc(p.unit) + "</span><span class='hint'>" +
          (left < 0 ? tr("meal.pastGuide") : left === 0 ? tr("meal.useToday") : tr("meal.daysGuide", { d: left })) + "</span></div>";
      }).join("") : '<p class="hint">' + esc(tr("meal.pantryEmpty")) + '</p>') +
      '<p class="hint">' + esc(tr("meal.usdaNote")) + '</p></div>';
    el.innerHTML = html;
    el.querySelectorAll("[data-gtick]").forEach(function (c) {
      c.addEventListener("change", function () {
        var k = c.getAttribute("data-gtick"); state.groceryChecked = state.groceryChecked || {};
        if (c.checked) state.groceryChecked[k] = true; else delete state.groceryChecked[k];
        save(); renderGroceries();
      });
    });
    el.querySelectorAll("[data-xtick]").forEach(function (c) {
      c.addEventListener("change", function () {
        (state.extras || []).forEach(function (x) { if (x.id === c.getAttribute("data-xtick")) x.checked = c.checked; });
        save(); renderGroceries();
      });
    });
    el.querySelectorAll("[data-xdel]").forEach(function (b) {
      b.addEventListener("click", function () { state.extras = state.extras.filter(function (x) { return x.id !== b.getAttribute("data-xdel"); }); save(); renderGroceries(); });
    });
    var gc = $("grocClear");
    if (gc) gc.addEventListener("click", function () {
      state.groceryChecked = {}; state.extras = (state.extras || []).filter(function (x) { return !x.checked; });
      save(); renderGroceries(); toast(tr("meal.cleared", null, "Cleared"));
    });
    $("extraAdd").addEventListener("click", function () {
      var n = $("extraName").value.trim(); if (!n) return;
      state.extras.push({ id: "x" + Date.now(), name: n.slice(0, 80) }); save(); renderGroceries();
    });
    $("gAdd").addEventListener("click", function () {
      var n = $("gName").value.trim(); if (!n) { toast(tr("toast.foodFirst")); return; }
      state.pantry.push({ id: "g" + Date.now(), name: n.toLowerCase(), qty: Math.max(0, Number($("gQty").value) || 0),
        unit: $("gUnit").value, storage: $("gStorage").value, added: mpKey(L.todayKey()),
        shelfDays: MP.shelfDays(n, $("gStorage").value, MD) });
      save(); renderGroceries(); toast(tr("common.addedToast"));
    });
  }

  /* ================= CALENDAR, HABITS, TO-DOS (Phase 3) =================
     Streaks + the messy-note parser are Pace's, ported in logic.js.
     Pace's no-shame law rides with them: nothing here ever labels a
     task late, failed or missed. Undone things just wait. */
  var calCursor = null, calSelected = null;
  function dayEvents(iso) {
    var evs = [];
    var entry = state.plan[mpKey(iso)] || {};
    ["breakfast", "lunch", "dinner"].forEach(function (m) {
      if (entry[m]) { var r = recipeById(entry[m]); if (r) evs.push({ color: "#97795D", label: recName(r), kind: "meal", id: r.id }); }
    });
    (state.sessions || []).forEach(function (s) { if (s.dateKey === iso && s.status === "done") evs.push({ color: "#52695A", label: tr("cal.gymSession"), kind: "gym" }); });
    (state.routines || []).forEach(function (r) { if (L.routineDueOn(r, iso)) evs.push({ color: "#7A8B6F", label: r.name + (r.time ? " " + r.time : ""), kind: "routine" }); });
    (state.peptides || []).forEach(function (p) {
      (p.log || []).forEach(function (lg) { if (lg.dateKey === iso) { var st = window.FitHealth.statusOf(lg); evs.push({ color: p.color, label: p.name + (st === "taken" ? "" : " · " + tr("pep.st." + st, null, st === "not_taken" ? "Not taken" : "Not sure")), kind: "peptide" }); } });
    });
    (state.habits || []).forEach(function (h) { if (h.days && h.days[iso]) evs.push({ color: h.color || "#7A8B6F", label: h.name, kind: "habit" }); });
    L.todosOn(state.todos, iso).forEach(function (t) { evs.push({ color: t.color, label: t.title, kind: "todo", id: t.id, time: t.time, done: t.status === "done" }); });
    if (state.checkins[iso]) evs.push({ color: "#C08552", label: tr("cal.checkedIn", { level: tr("checkin." + state.checkins[iso], null, state.checkins[iso]) }), kind: "checkin" });
    return evs;
  }
  function renderMonth() {
    var el = $("areaBody");
    var now = calCursor || L.todayKey();
    var parts = now.split("-"), year = Number(parts[0]), month = Number(parts[1]) - 1;
    var names = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (mi) { return tr("cal.mo" + mi); });
    var grid = L.monthGrid(year, month);
    var html = '<div class="card"><div class="calHead"><button class="pillBtn" id="calPrev">' + esc(tr("cal.back")) + '</button>' +
      "<h3>" + names[month] + " " + year + '</h3><button class="pillBtn" id="calTodayBtn">' + esc(tr("nav.today")) + '</button><button class="pillBtn" id="calNext">' + esc(tr("cal.next")) + '</button></div>' +
      ('<div class="row"><button class="pillBtn" id="calImportBtn"><svg class="btnIco"><use href="#i-cal"/></svg> ' + esc(tr("cal.importTitle")) + '</button></div>') +
      '<div class="calGrid">' + [1, 2, 3, 4, 5, 6, 7].map(function (di) { return '<div class="calDow">' + esc(tr("cal.d" + di)) + "</div>"; }).join("");
    grid.forEach(function (iso) {
      var d = L.parseKey(iso);
      var evs = dayEvents(iso);
      var dots = evs.slice(0, 4).map(function (e) { return '<span class="evDot" style="background:' + e.color + '"></span>'; }).join("");
      var first = evs.length ? '<div class="evTxt">' + esc(evs[0].label) + (evs.length > 1 ? " +" + (evs.length - 1) : "") + "</div>" : "";
      html += '<button class="calCell' + (d.getMonth() !== month ? " dim" : "") + (iso === L.todayKey() ? " today" : "") +
        (iso === calSelected ? " sel" : "") + '" data-day="' + iso + '"><span class="dNum">' + d.getDate() + '</span><span class="dots">' + dots + "</span>" + first + "</button>";
    });
    html += "</div></div><div id='dayDetail'></div>";
    el.innerHTML = html;
    function shift(n) { var d = new Date(year, month + n, 1, 12); calCursor = L.toKey(d); renderMonth(); }
    $("calPrev").addEventListener("click", function () { shift(-1); });
    $("calNext").addEventListener("click", function () { shift(1); });
    $("calTodayBtn").addEventListener("click", function () { calCursor = L.todayKey(); calSelected = L.todayKey(); renderMonth(); });
    var cib = $("calImportBtn"); if (cib) cib.addEventListener("click", openImport);
    el.querySelectorAll("[data-day]").forEach(function (b) {
      b.addEventListener("click", function () { calSelected = b.getAttribute("data-day"); renderMonth(); });
    });
    if (calSelected) renderDayDetail(calSelected);
  }
  /* --- Bring my calendar in (the shared module, adopted whole) --------
     calendar-import.js is the fleet module, byte-identical; this is
     only the host wiring its adoption doc names: the sheet, the entry
     points, shapeToTask onto Fit's to-dos, and the registry in state.
     Fit has no live repeat model for to-dos, so the plan is made with
     repeatModel "none" and every series expands into real days. The
     module only ever receives THIS user's space (the shim below
     shares the live to-dos + imports arrays), and in demo sessions
     the entry points do not exist. --- */
  var IMPORT_GUIDE = { google: "cal.guideGoogle", apple: "cal.guideApple", outlook: "cal.guideOutlook", file: "cal.guideFile" };
  var IMPORT_LABELS = { google: "Google Calendar", apple: "Apple / iCloud", outlook: "Outlook", file: "a calendar file" };
  var importSource = "google", importSeq = 0;
  function openImport() {
    if (!window.CI) return;
    $("importResult").textContent = "";
    importOpener = document.activeElement;
    $("importSheet").classList.remove("hidden");
    setImportSource(importSource);
    setTimeout(function () { var c = $("importCard"); if (c) c.focus(); }, 30);
  }
  var importOpener = null;
  function closeImport() { $("importSheet").classList.add("hidden"); if (importOpener && document.contains(importOpener)) { try { importOpener.focus(); } catch (e) {} } importOpener = null; }
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !$("importSheet").classList.contains("hidden")) closeImport(); });
  function setImportSource(src) {
    importSource = src;
    document.querySelectorAll(".import-src").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-src") === src); });
    $("importGuide").textContent = tr(IMPORT_GUIDE[src]);
  }
  function shapeToTask(s) {
    var cat = L.categoryFor(s.title);
    var words = [s.location, s.notes].filter(Boolean).join(" — ");
    return { id: "todo.imp." + Date.now() + "." + (++importSeq), title: s.title, date: s.date, time: s.time,
      durationMin: s.durationMin, category: cat.id, color: cat.color, status: "open", steps: [],
      source: "import", originalText: words, importUid: s.importUid, importKey: s.importKey, repeat: null };
  }
  function runImport(text, label) {
    var parsed = window.CI.parseICS(text);
    if (parsed.error || !parsed.events.length) { $("importResult").textContent = tr("cal.importBadFile"); return; }
    var plan = window.CI.planImport(parsed, state.todos, { sourceLabel: label, repeatModel: "none" });
    var res = window.CI.applyImport({ tasks: state.todos, imports: state.imports }, plan, label, shapeToTask);
    save(); renderAll();
    var bits = [tr(res.added === 1 ? "cal.importedOne" : "cal.importedMany", { n: res.added })];
    if (res.dupes) bits.push(tr("cal.importedDupes", { n: res.dupes }));
    if (res.skipped) bits.push(tr("cal.importedSkipped", { n: res.skipped }));
    $("importResult").textContent = bits.join(" · ") + ".";
    toast(res.added ? tr("cal.importToastDone") : tr("cal.importToastNone"));
  }

  function renderDayDetail(iso) {
    var box = $("dayDetail"); if (!box) return;
    var evs = dayEvents(iso);
    var todos = L.todosOn(state.todos, iso);
    var waitNote = "";
    if (iso === L.todayKey() && state.checkins[iso] === "bad") {
      var shapedD = L.shapeTodosForDay(todos, "bad");
      todos = shapedD.shown;
      if (shapedD.waiting > 0) waitNote = '<p class="hint">' + esc(tr("cal.badWait", { n: shapedD.waiting })) + "</p>";
    }
    var html = '<div class="card"><h2>' + dayLabel(iso) + " · " + iso.slice(8) + "/" + iso.slice(5, 7) + "</h2>" + waitNote;
    var meals = evs.filter(function (e) { return e.kind === "meal"; });
    if (meals.length) html += meals.map(function (e) {
      return '<button class="mealRow" data-recipe="' + e.id + '"><span class="mealDot" style="background:#97795D"></span><span class="mName">' + esc(e.label) + "</span></button>";
    }).join("");
    /* Every other event kind renders as a row too (QA Phase 4
       finding F1): routines due, done sessions, peptide logs
       and the day's check-in. The month cell showed them; the
       detail must not drop them or call the day blank. */
    var others = evs.filter(function (e) { return ["routine", "gym", "peptide", "checkin"].indexOf(e.kind) !== -1; });
    if (others.length) html += others.map(function (e) {
      return '<div class="todoRow"><span class="mealDot" style="background:' + e.color + '"></span><span class="tTitle">' + esc(e.label) + "</span></div>";
    }).join("");
    if (todos.length) html += todos.map(function (t) {
      return '<div class="todoRow' + (t.status === "done" ? " done" : "") + '"><button class="todoCheck' + (t.status === "done" ? " done" : "") +
        '" data-todo="' + t.id + '" aria-pressed="' + (t.status === "done" ? "true" : "false") + '" aria-label="' + esc(t.title) + '">' + (t.status === "done" ? "✓" : "") + '</button><span class="tTitle">' + esc(t.title) + "</span>" +
        (t.time ? '<span class="kcalChip">' + esc(t.time) + "</span>" : "") + "</div>";
    }).join("");
    var habs = (state.habits || []);
    if (habs.length) html += '<p class="hint">' + esc(tr("cal.habitsDay")) + '</p><div class="chipRow">' + habs.map(function (h) {
      var on = h.days && h.days[iso];
      return '<button class="chip' + (on ? " on" : "") + '" data-habitday="' + h.id + '">' + esc(h.name) + (on ? " ✓" : "") + "</button>";
    }).join("") + "</div>";
    if (!meals.length && !todos.length && !others.length && !habs.length) html += '<p class="hint">' + esc(tr("cal.blankDay")) + '</p>';
    html += "</div>";
    box.innerHTML = html;
    box.querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe"), b); }); });
    box.querySelectorAll("[data-todo]").forEach(function (b) { b.addEventListener("click", function () { toggleTodo(b.getAttribute("data-todo")); renderMonth(); }); });
    box.querySelectorAll("[data-habitday]").forEach(function (b) { b.addEventListener("click", function () { toggleHabitDay(b.getAttribute("data-habitday"), iso); renderMonth(); }); });
  }
  function toggleTodo(id) {
    state.todos.forEach(function (t) { if (t.id === id) t.status = t.status === "done" ? "open" : "done"; });
    save();
  }
  function toggleHabitDay(habitId, iso) {
    state.habits.forEach(function (h) { if (h.id === habitId) { h.days = h.days || {}; if (h.days[iso]) delete h.days[iso]; else h.days[iso] = true; } });
    save();
  }
  function renderHabits() {
    var el = $("areaBody");
    var today = L.todayKey();
    var html = '<div class="card"><h2>' + esc(tr("cal.addHabit")) + '</h2>' +
      '<div class="grid2"><label>' + esc(tr("cal.habitName")) + '<input id="hbName" type="text" placeholder="' + esc(tr("cal.habitPh")) + '"></label>' +
      '<label>' + esc(tr("cal.colour")) + '<select id="hbColor"><option value="#52695A">' + esc(tr("cal.cSage")) + '</option><option value="#7A8B6F">' + esc(tr("cal.cLeaf")) + '</option><option value="#AC9278">' + esc(tr("cal.cTaupe")) + '</option><option value="#C08552">' + esc(tr("cal.cClay")) + '</option><option value="#6B7F8C">' + esc(tr("cal.cSlate")) + '</option></select></label></div>' +
      '<div class="row"><button class="primaryBtn" id="hbAdd">' + esc(tr("cal.addHabitBtn")) + '</button></div>' +
      '<p class="hint">' + esc(tr("cal.startersHint")) + '</p><div class="chipRow">' +
      '<button class="chip" id="hbStartGym">' + esc(tr("cal.gymDays")) + '</button><button class="chip" id="hbStartEat">' + esc(tr("cal.eatDays")) + '</button></div></div>';
    if (!(state.habits || []).length) html += '<div class="card emptyCard">' + (guideOn() ? wallyWrap("welcome", null, 56) : "") + '<svg class="ic icBig"><use href="#i-cal"/></svg><p>' + esc(tr("cal.noHabits")) + '</p><p class="hint">' + esc(tr("cal.habitHint")) + '</p></div>';
    (state.habits || []).forEach(function (h) {
      var st = L.streakInfo(h.days || {}, today);
      html += '<div class="habitRow"><h3><span class="mealDot" style="background:' + esc(h.color || "#7A8B6F") + ';display:inline-block"></span> ' + esc(h.name) + "</h3>" +
        '<p class="hint">' + (st.current > 0 ? (st.current === 1 ? tr("cal.streakOne") : tr("cal.streakMany", { n: st.current })) : tr("cal.startsToday")) + "</p>" +
        '<div class="weekDots">' + st.last7.map(function (d) {
          var wd = tr("cal.wdShort" + L.parseKey(d.key).getDay());
          return '<button class="wDot' + (d.done ? " done" : "") + (d.key === today ? " today" : "") + '" data-hdot="' + h.id + "|" + d.key + '">' + wd + "</button>";
        }).join("") + "</div>" +
        '<div class="row"><button class="pillBtn" data-htoday="' + h.id + '">' + ((h.days || {})[today] ? tr("cal.doneTodayUndo") : tr("cal.doneToday")) + "</button></div></div>";
    });
    el.innerHTML = html;
    function addHabit(name, color) {
      if (!name) { toast(tr("toast.habitFirst")); return; }
      if ((state.habits || []).some(function (h) { return h.name.toLowerCase() === name.toLowerCase(); })) { toast(tr("toast.alreadyHere")); return; }
      state.habits.push({ id: "habit." + Date.now(), name: name, color: color, days: {} });
      save(); renderHabits(); toast(tr("cal.habitAdded"));
    }
    $("hbAdd").addEventListener("click", function () { addHabit($("hbName").value.trim(), $("hbColor").value); });
    $("hbStartGym").addEventListener("click", function () { addHabit(tr("cal.gymDays"), "#52695A"); });
    $("hbStartEat").addEventListener("click", function () { addHabit(tr("cal.eatDays"), "#7A8B6F"); });
    function checkWeek(habitId) {
      var h = (state.habits || []).filter(function (x) { return x.id === habitId; })[0];
      if (h && L.streakInfo(h.days || {}, today).current === 7) showWallyCelebration("week");
    }
    el.querySelectorAll("[data-hdot]").forEach(function (b) { b.addEventListener("click", function () {
      var parts = b.getAttribute("data-hdot").split("|"); toggleHabitDay(parts[0], parts[1]); renderHabits(); checkWeek(parts[0]); }); });
    el.querySelectorAll("[data-htoday]").forEach(function (b) { b.addEventListener("click", function () {
      toggleHabitDay(b.getAttribute("data-htoday"), today); renderHabits(); checkWeek(b.getAttribute("data-htoday")); }); });
  }
  function renderTodos() {
    var el = $("areaBody");
    var today = L.todayKey(), tomorrow = L.addDays(today, 1);
    function groupOf(t) {
      if (t.status === "done") return "Done";
      if (!t.date) return "Any time";
      if (t.date <= today) return "Today"; /* includes earlier days: they wait here, never labelled late */
      if (t.date === tomorrow) return "Tomorrow";
      return "Later";
    }
    var groups = ["Today", "Tomorrow", "Later", "Any time", "Done"];
    var byGroup = {}; groups.forEach(function (g) { byGroup[g] = []; });
    (state.todos || []).forEach(function (t) { byGroup[groupOf(t)].push(t); });
    var html = '<div class="card"><h2>' + esc(tr("cal.todoTitle")) + '</h2>' +
      '<p class="hint">' + esc(tr("cal.todoHint")) + '</p>' +
      '<textarea id="tdDump" rows="3" placeholder="' + esc(tr("cal.todoPh")) + '"></textarea>' +
      '<div class="row"><button class="primaryBtn" id="tdSort">' + esc(tr("cal.sortList")) + '</button><button class="pillBtn" id="tdMic">' + esc(tr("meal.voiceBtn")) + '</button></div>' +
      '<p class="hint" id="tdMsg"></p></div>';
    var todayLevel = state.checkins[today] || "ok";
    groups.forEach(function (g) {
      if (!byGroup[g].length) return;
      var rowsList = byGroup[g], waitingNote = "";
      if (g === "Today" && todayLevel === "bad") {
        var shaped = L.shapeTodosForDay(byGroup[g], "bad");
        rowsList = shaped.shown;
        if (shaped.waiting > 0) waitingNote = '<p class="hint">' + esc(shaped.waiting === 1 ? tr("cal.waitOne") : tr("cal.waitMany", { n: shaped.waiting })) + "</p>";
      }
      html += '<div class="card"><h2>' + esc({ Today: tr("nav.today"), Tomorrow: tr("cal.tomorrow"), Later: tr("cal.gLater"), "Any time": tr("cal.gAnytime"), Done: tr("cal.gDone") }[g] || g) + "</h2>" + (g === "Today" && todayLevel === "bad" ? '<p class="hint">' + esc(tr("cal.badEssentials")) + '</p>' : "") + rowsList.map(function (t) {
        return '<div class="todoRow' + (t.status === "done" ? " done" : "") + '"><button class="todoCheck' + (t.status === "done" ? " done" : "") +
          '" data-todo="' + t.id + '" aria-pressed="' + (t.status === "done" ? "true" : "false") + '" aria-label="' + esc(t.title) + '">' + (t.status === "done" ? "✓" : "") + '</button><span class="mealDot" style="background:' + esc(t.color) + '"></span>' +
          '<span class="tTitle">' + esc(t.title) + "</span>" +
          (t.time ? '<span class="kcalChip">' + esc(t.time) + "</span>" : "") +
          '<span class="kcalChip">' + t.durationMin + ' min</span><button class="miniBtn" data-del="' + t.id + '">' + esc(tr("common.remove")) + '</button>' +
          (t.time && t.date && t.status !== "done" ? '<label class="remLabel">' + esc(tr("rem.remindMe", null, "Remind me")) + '<select data-remind="' + esc(t.id) + '" aria-label="' + esc(tr("rem.remindFor", { name: t.title }, "Reminder for " + t.title)) + '">' +
            [[-1, tr("rem.off", null, "Off")], [0, tr("rem.atTime", null, "At the time")], [10, tr("rem.min10", null, "10 minutes before")], [30, tr("rem.min30", null, "30 minutes before")], [60, tr("rem.min60", null, "1 hour before")]].map(function (o) {
              var cur = typeof t.remindMin === "number" ? t.remindMin : -1; return '<option value="' + o[0] + '"' + (cur === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>" : "") + "</div>";
      }).join("") + waitingNote + "</div>";
    });
    if (!(state.todos || []).length) html += '<div class="card emptyCard">' + (guideOn() ? wallyWrap("welcome", null, 56) : "") + '<svg class="ic icBig"><use href="#i-list"/></svg><p>' + esc(tr("cal.listEmpty")) + '</p><p class="hint">' + esc(tr("cal.dumpHint")) + '</p></div>';
    el.innerHTML = html;
    $("tdSort").addEventListener("click", function () {
      var parsed = L.parseQuickDump($("tdDump").value, today);
      if (!parsed.length) { $("tdMsg").textContent = tr("cal.nothingSortable"); return; }
      parsed.forEach(function (p, i) { var t = L.makeTodo(p); t.id = "todo." + Date.now() + "." + i; state.todos.push(t); });
      save(); renderTodos(); toast(parsed.length === 1 ? tr("cal.sortedOne") : tr("cal.sortedMany", { n: parsed.length }));
    });
    wireMic($("tdMic"), $("tdDump"));
    el.querySelectorAll("[data-todo]").forEach(function (b) { b.addEventListener("click", function () { toggleTodo(b.getAttribute("data-todo")); renderTodos(); }); });
    el.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () {
      state.todos = state.todos.filter(function (t) { return t.id !== b.getAttribute("data-del"); }); save(); renderTodos(); }); });
    el.querySelectorAll("[data-remind]").forEach(function (sel) { sel.addEventListener("change", function () {
      var v = Number(sel.value);
      state.todos.forEach(function (t) { if (t.id === sel.getAttribute("data-remind")) t.remindMin = v >= 0 ? v : null; });
      save();
      if (v >= 0 && !FitRemind.available()) toast(tr("rem.webNote", null, "Reminders show inside the app on this device. Phone alerts need the iPhone or Android app."));
      else if (v >= 0 && !(state.settings && state.settings.notifications === true)) toast(tr("rem.turnOnFirst", null, "Turn on reminders in Calendar > Reminders so alerts can reach your phone."));
    }); });
  }
  function renderReminders() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("sub.cal-reminders", null, "Reminders")) + '</h2><p class="hint" id="remStatus" role="status">' + esc(tr("rem.checking", null, "Checking…")) + "</p>" +
      '<div class="row"><button class="primaryBtn hidden" id="remToggle"></button></div>' +
      '<label class="confirmRow"><input type="checkbox" id="remDetails"' + (state.settings && state.settings.notifDetails ? " checked" : "") + '> <span>' + esc(tr("rem.showNames", null, "Show names on the lock screen")) + '</span></label>' +
      '<h3>' + esc(tr("rem.catsTitle", null, "Which reminders do you want?")) + '</h3>' +
      [["workout", tr("rem.catWorkout", null, "Workouts")], ["water", tr("rem.catWater", null, "Water")], ["tasks", tr("rem.catTasks", null, "Tasks")], ["health", tr("rem.catHealth", null, "Health and appointments")]].map(function (c) {
        var off = (state.settings && state.settings.remindOff) || [];
        return '<label class="confirmRow"><input type="checkbox" data-remcat="' + c[0] + '"' + (off.indexOf(c[0]) === -1 ? " checked" : "") + '> <span>' + esc(c[1]) + '</span></label>'; }).join("") +
      '<p class="hint">' + esc(tr("rem.catsHint", null, "Every reminder uses a time you chose. Turn a group off and its reminders stop right away; your times are kept.")) + '</p>' +
      '<p class="hint">' + esc(tr("rem.showNamesHint", null, "Off by default. Phone alerts for doses and appointments say only “You have a reminder.” so nobody nearby can read your health details.")) + '</p></div>' +
      '<div class="card"><h2>' + esc(tr("rem.upcoming", null, "Coming up")) + '</h2><div id="remList"></div></div>';
    el.querySelectorAll("[data-remcat]").forEach(function (cb) { cb.addEventListener("change", function () {
      state.settings = state.settings || {}; var off = (state.settings.remindOff || []).filter(function (x) { return x !== cb.getAttribute("data-remcat"); });
      if (!cb.checked) off.push(cb.getAttribute("data-remcat")); state.settings.remindOff = off; save(); renderReminders();
    }); });
    $("remDetails").addEventListener("change", function () { state.settings = state.settings || {}; state.settings.notifDetails = $("remDetails").checked; save(); renderReminders(); });
    var items = FitRemind.upcoming(12);
    var kindName = { dose: tr("rem.kDose", null, "Scheduled log reminder"), gym: tr("rem.kGym", null, "Workout"), water: tr("rem.kWater", null, "Water"), todo: tr("rem.kTodo", null, "Task"), appt: tr("rem.kAppt", null, "Appointment") };
    $("remList").innerHTML = items.length ? items.map(function (r) {
      var d = new Date(r.at);
      return '<div class="listRow remRow"><span class="grow"><b>' + esc(r.kind === "water" ? tr("water.remindTitle") : r.name) + "</b><br><span class='hint'>" + esc(kindName[r.kind] || r.kind) + " · " + esc(r.key) + " " + esc(("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)) +
        (r.lead ? " · " + esc(tr("rem.leadN", { n: r.lead }, r.lead + " min before")) : "") + (r.shifted ? " · " + esc(tr("rem.shifted", null, "moved a little because of a clock change")) : "") + "</span></span></div>";
    }).join("") : '<p class="hint">' + esc(tr("rem.none", null, "Nothing is scheduled. Set a time on a task, workout, water goal or log schedule and it will appear here.")) + "</p>";
    var msgs = { unavailable: tr("rem.webNote", null, "Reminders show inside the app on this device. Phone alerts need the iPhone or Android app."),
      off: tr("rem.offNote", null, "Phone alerts are off. Turn them on to get a nudge at the times below."),
      denied: tr("rem.deniedNote", null, "Phone alerts are blocked in your phone's settings. Reminders still show on Today inside the app. You can allow notifications for Fit Hard in Settings, then come back."),
      on: tr("rem.onNote", null, "Phone alerts are on. Changing or deleting a task, workout or schedule updates its reminder automatically.") };
    FitRemind.status().then(function (st) {
      var s1 = $("remStatus"); if (!s1) return;
      s1.textContent = msgs[st]; s1.setAttribute("data-status", st);
      var tg = $("remToggle");
      if (st === "off" || st === "on") { tg.classList.remove("hidden"); tg.textContent = st === "on" ? tr("rem.turnOff") : tr("rem.turnOn"); }
      tg.onclick = function () { var on = st === "on"; FitRemind.setOn(!on).then(function (ok) { if (!on && !ok) toast(tr("rem.notAllowed")); renderReminders(); }); };
    });
  }
  function renderCalendar(subId) {
    if (subId === "cal-reminders") renderReminders();
    else if (subId === "cal-habits") renderHabits();
    else if (subId === "cal-todos") renderTodos();
    else { if (!calSelected) calSelected = L.todayKey(); renderMonth(); }
  }

  /* ================= GYM (Phase 4) =================
     Exercise names and muscles: public domain dataset (see
     exercises-data.js header). Cues written by this desk.
     No weights are ever suggested by the app: the user brings
     their own, the app counts sets, reps and rest. */
  var EX = window.FIT_EX;
  var gymTimer = null;
  function exerciseById(id) { return (EX.EXERCISES || []).filter(function (e) { return e.id === id; })[0] || null; }
  function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2); }
  /* The top timer's guide for a rep set: about 3.5 sec a rep,
     rounded to the nearest 5. A guide only, never a deadline. */
  function setGuideSec(reps) { return Math.round(reps * 3.5 / 5) * 5; }
  function classKey(cat) {
    return { stretching: "gym.classStretching", plyometrics: "gym.classPlyometrics", powerlifting: "gym.classPowerlifting",
      "olympic weightlifting": "gym.classOlympic", strongman: "gym.classStrongman", cardio: "gym.classCardio" }[cat] || "gym.kindStrength";
  }
  /* The D2 labels, one chip rule everywhere: expert reads
     Advanced, a held class reads Library only, intermediate
     strength reads A step up beside its sets. Beginner
     auto-picks carry no label at all. */
  /* ONE SET, ONE REP (Polar device finding F5): the counts
     speak in the singular when the count is one, in every
     language the tables carry. */
  function setsChipFor(item) {
    return tr("gym.setsChip", {
      sets: item.sets, reps: item.reps,
      setsWord: item.sets === 1 ? tr("gym.setOne") : tr("gym.setsWord"),
      unit: item.timed ? tr("gym.sec") : (item.reps === 1 ? tr("gym.repOne") : tr("gym.reps"))
    });
  }
  function exRow(item, ex) {
    if (!ex) return "";
    var chip;
    if (!L.routinePlayable(ex)) {
      chip = '<span class="kcalChip">' + esc(ex.level === "expert" ? tr("gym.advanced") : tr("gym.libraryOnly")) + "</span>";
    } else if (ex.level === "intermediate") {
      chip = '<span class="kcalChip">' + esc(tr("gym.stepUp")) + '</span><span class="kcalChip">' +
        esc(setsChipFor(item)) + "</span>";
    } else {
      chip = '<span class="kcalChip">' + esc(setsChipFor(item)) + "</span>";
    }
    return '<div class="exRow"><span class="exTile"><svg><use href="#i-gym"/></svg></span>' +
      '<span class="eName">' + esc(exName(ex)) + '<br><span class="eMeta">' + esc(exPart(ex)) + " · " + esc(exEquip(ex)) + "</span></span>" + chip + "</div>";
  }
  function routineCard(r) {
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (di) { return tr("cal.wd" + di); });
    /* Trainer advice (design section 4): when this routine has
       earned a step, the card says so plainly and offers the
       rebuild. The saved routine changes only on this tap. */
    var advice = L.trainerAdvice(r, state.sessions, L.todayKey());
    var html = '<div class="card"><h2>' + esc(r.name) + (r.lightened ? tr("gym.lighterVersion") : "") + "</h2>" +
      '<p class="hint">' + esc(tr("gym.aboutMin", { m: r.minutes })) + " · " + (r.days && r.days.length ? r.days.map(function (d) { return days[d]; }).join(", ") : tr("gym.anyDay")) +
      (r.time ? " · " + esc(r.time) : "") + "</p>" +
      (r.items || []).map(function (it) { if (!it || typeof it !== "object") return ""; return exRow(it, exerciseById(it.exerciseId)); }).join("") +
      (advice.kind !== "none" ? '<p class="hint">' + esc(tr(advice.kind === "up" ? "gym.stepReadyHint" : "gym.stepBackHint")) + "</p>" : "") +
      '<div class="row"><button class="primaryBtn" data-start="' + r.id + '">' + esc(tr("gym.startSession")) + '</button>' +
      (advice.kind !== "none" ? '<button class="pillBtn" data-rebuild="' + r.id + '">' + esc(tr("gym.rebuildBtn")) + "</button>" : "") +
      '<button class="pillBtn" data-delroutine="' + r.id + '">' + esc(tr("gym.removeRoutine")) + '</button></div></div>';
    return html;
  }
  /* Goal choice (design section 2): the setup goals the user
     stated offer a first template. A map from their own words to
     the general templates; the user can always pick another. */
  function suggestedGoalId() {
    var goals = (state.profile && state.profile.goals) || [];
    if (goals.indexOf("Build strength") !== -1 || goals.indexOf("Feel fitter") !== -1) return "full";
    if (goals.indexOf("Lose weight gently") !== -1) return "gentle";
    return "legs";
  }
  function renderRoutines() {
    var el = $("areaBody");
    var suggested = suggestedGoalId();
    var goalOpts = L.GYM_GOALS.map(function (g) { return '<option value="' + g.id + '"' + (g.id === suggested ? " selected" : "") + ">" + esc(tr("gymgoal." + g.id, null, g.label)) + "</option>"; }).join("");
    var dayNames = [1, 2, 3, 4, 5, 6, 7].map(function (di) { return tr("cal.d" + di); });
    var dayVals = [1, 2, 3, 4, 5, 6, 0];
    var html = '<div class="card"><h2>' + esc(tr("gym.buildRoutine")) + '</h2>' +
      '<div class="grid2"><label>' + esc(tr("setup.goal")) + '<select id="gyGoal">' + goalOpts + "</select></label>" +
      '<label>' + esc(tr("gym.howLong")) + '<select id="gyMinutes"><option>20</option><option selected>30</option><option>45</option><option>60</option><option>90</option></select></label>' +
      '<label>' + esc(tr("gym.timeOfDay")) + '<input id="gyTime" type="time" value="18:00"></label></div>' +
      '<p class="hint">' + esc(tr("gym.daysLabel")) + '</p><div class="dayChips" id="gyDays">' + dayNames.map(function (d, i) {
        return '<button class="chip" data-gyday="' + dayVals[i] + '">' + d + "</button>"; }).join("") + "</div>" +
      '<div class="row"><button class="primaryBtn" id="gyBuild">' + esc(tr("gym.buildBtn")) + '</button></div>' +
      '<p class="hint">' + esc(tr("gym.routineHint")) + '</p></div>';
    if (!(state.routines || []).length) html += '<div class="card emptyCard">' + (guideOn() ? wallyWrap("welcome", null, 56) : "") + '<svg class="ic icBig"><use href="#i-gym"/></svg><p>' + esc(tr("gym.noRoutines")) + '</p><p class="hint">' + esc(tr("gym.noRoutinesHint")) + '</p></div>';
    (state.routines || []).forEach(function (r) { html += routineCard(r); });
    el.innerHTML = html;
    el.querySelectorAll("[data-gyday]").forEach(function (b) { b.addEventListener("click", function () { b.classList.toggle("on"); }); });
    $("gyBuild").addEventListener("click", function () {
      var goalId = $("gyGoal").value;
      /* The trainer context: the user's own profile and logged
         sessions, plus their latest routine for this goal, whose
         line a fresh build carries forward. */
      var built = L.buildRoutine(goalId, Number($("gyMinutes").value), EX.EXERCISES, {
        profile: state.profile, sessions: state.sessions, todayKey: L.todayKey(),
        prevRoutine: (state.routines || []).filter(function (r) { return r.goalId === goalId; }).slice(-1)[0] || null });
      if (built) built.name = tr("gymgoal." + built.goalId, null, built.name);
      if (!built || !built.items.length) { toast(tr("gym.goalOdd")); return; }
      if (!maySaveRoutine()) return;
      var days = [];
      el.querySelectorAll("[data-gyday].on").forEach(function (b) { days.push(Number(b.getAttribute("data-gyday"))); });
      /* A ROUTINE WITH NO DAYS IS ON NO CALENDAR (Polar
         device finding F4): the success line must never
         claim a calendar place the build did not take.
         No day picked, no build — the user hears the one
         plain thing they need to do. */
      if (!days.length) { toast(tr("gym.pickDayFirst")); return; }
      state.routines.push(Object.assign({}, built, { id: "routine." + Date.now(), days: days,
        time: $("gyTime").value || null, createdKey: L.todayKey() }));
      save(); renderRoutines(); toast(tr("gym.built"));
    });
    el.querySelectorAll("[data-start]").forEach(function (b) { b.addEventListener("click", function () { startSession(b.getAttribute("data-start")); }); });
    el.querySelectorAll("[data-rebuild]").forEach(function (b) { b.addEventListener("click", function () {
      var r = (state.routines || []).filter(function (x) { return x.id === b.getAttribute("data-rebuild"); })[0];
      if (!r) return;
      var adv = L.trainerAdvice(r, state.sessions, L.todayKey());
      if (adv.kind === "none") return;
      r.items = adv.items; save(); renderRoutines();
      toast(tr(adv.kind === "up" ? "gym.rebuiltStep" : "gym.rebuiltBack"));
    }); });
    el.querySelectorAll("[data-delroutine]").forEach(function (b) { b.addEventListener("click", function () {
      state.routines = state.routines.filter(function (r) { return r.id !== b.getAttribute("data-delroutine"); });
      save(); renderRoutines(); }); });
  }
  function activeSession() { return (state.sessions || []).filter(function (s) { return s.status === "active"; })[0] || null; }
  function startSession(routineId) {
    var r = (state.routines || []).filter(function (x) { return x.id === routineId; })[0];
    if (!r) return;
    var existing = activeSession();
    if (existing) { toast(tr("gym.alreadyGoing")); openArea("gym", "gym-session"); return; }
    var light = (state.checkins[L.todayKey()] === "bad");
    var use = light ? L.lightenRoutine(r) : r;
    /* F7 (Phase 2): only playable items enter a session. The
       saved routine itself is never edited; unplayable saved
       items simply do not start. */
    var items = L.playableItems(use.items, EX.EXERCISES);
    if (!items.length) { toast(tr("gym.nothingPlayable")); return; }
    state.sessions.push({ id: "session." + Date.now(), dateKey: L.todayKey(), routineId: r.id,
      routineName: r.name, status: "active", idx: 0, set: 1, doneSets: 0,
      startedAt: Date.now(), lastActiveAt: Date.now(), log: [], pausedAt: null, pausedTotalMs: 0, restEndsAt: null, items: items, lightened: !!use.lightened });
    save(); openArea("gym", "gym-session");
    toast(light ? tr("gym.lighterToday") : tr("gym.sessionStarted"));
  }
  function stopGymTimer() { if (gymTimer) { clearInterval(gymTimer); gymTimer = null; } stopAnim(); }
  /* --- Exercise animations (the locked look, 15 Oct 2026):
     one rig, three trainer skins, Wally's speech bubbles
     sequenced with the loop. The plan + QA pins live in
     research/machines/ANIMATION-PRODUCTION-PLAN.md. --- */
  var animHandle = null, bubblesRested = false, bubblesRestedStamp = -1;
  function stopAnim() { if (animHandle) { try { animHandle.stop(); } catch (e) {} animHandle = null; } }
  function trainerSkin() {
    var s = state.settings && state.settings.trainerSkin;
    return (s === "boy" || s === "nb" || s === "girl") ? s : "girl";
  }
  function guideStamp() { return (state.settings && state.settings.guideStamp) || 0; }
  function skinAskHtml() {
    if (state.settings && state.settings.skinAsked) return "";
    return '<div class="card skinAsk"><h2>' + esc(tr("gym.whoShows")) + '</h2>' +
      '<p class="hint">' + esc(tr("gym.skinHint")) + '</p>' +
      '<div class="row"><button class="pillBtn" data-skinpick="girl">' + esc(tr("set.skinGirl")) + '</button>' +
      '<button class="pillBtn" data-skinpick="boy">' + esc(tr("set.skinBoy")) + '</button>' +
      '<button class="pillBtn" data-skinpick="nb">' + esc(tr("set.skinNb")) + '</button>' +
      '<button class="pillBtn" data-skindismiss="1">' + esc(tr("setup.notNow")) + '</button></div></div>';
  }
  function wireSkinAsk(el) {
    el.querySelectorAll("[data-skinpick]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings = state.settings || {};
        state.settings.trainerSkin = b.getAttribute("data-skinpick");
        state.settings.skinAsked = true;
        save(); renderSession();
        toast(tr("gym.trainerSet"));
      });
    });
    el.querySelectorAll("[data-skindismiss]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings = state.settings || {};
        state.settings.skinAsked = true;
        save(); renderSession();
      });
    });
  }
  function mountAnim(ex, startAt) {
    var spot = $("animMount");
    if (!spot || !window.FitAnim) return;
    var stamp = guideStamp();
    /* Bubbles follow the guide toggle, not an older session
       dismiss (QA toggle leg): a toggle flip bumps the stamp
       and the senior signal wins. */
    var canBubble = guideOn() && !(bubblesRested && bubblesRestedStamp === stamp);
    var stills = !!((state.settings && state.settings.calmPics) ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    animHandle = window.FitAnim.mount(spot, ex.id, {
      skin: trainerSkin(), stills: stills, bubbles: canBubble, startAt: startAt || 0,
      onRest: function () {
        bubblesRested = true; bubblesRestedStamp = guideStamp();
        if (animHandle) animHandle.setBubbles(false);
        toast(tr("gym.restTips", { name: companionName() }));
      }
    });
  }
  function renderSession() {
    stopGymTimer();
    var el = $("areaBody");
    var s = activeSession();
    if (!s) {
      var lvl = state.checkins[L.todayKey()];
      var html = '<div class="card"><h2>' + esc(tr("sub.gym-session", null, "Session")) + '</h2><p class="hint">' + esc(tr("gym.sessionHint")) + '</p>' +
        (lvl === "great" ? '<p class="hint">' + esc(tr("gym.greatEnergy")) + '</p>' : "") +
        (lvl === "bad" ? '<p class="hint">' + esc(tr("gym.badLighter")) + '</p>' : "");
      html = skinAskHtml() + html;
      if (!(state.routines || []).length) html += '<p class="hint">' + esc(tr("gym.noRoutinesFirst")) + '</p>';
      (state.routines || []).forEach(function (r) {
        html += '<div class="row"><button class="primaryBtn" data-start="' + r.id + '">' + esc(tr("gym.startNamed", { name: r.name })) + "</button></div>";
      });
      html += "</div>";
      var done = (state.sessions || []).filter(function (x) { return x.status === "done"; }).slice(-3).reverse();
      if (done.length) html += '<div class="card"><h2>' + esc(tr("gym.doneSessions")) + '</h2>' + done.map(function (x) {
        return '<div class="listRow"><span class="grow">' + esc(x.routineName || tr("gym.sessionWord")) + "</span><span class='hint'>" + esc(x.dateKey || "") + esc(tr("gym.aboutMinSuffix", { m: x.minutes || 0 })) + "</span></div>";
      }).join("") + "</div>";
      el.innerHTML = html;
      wireSkinAsk(el);
      el.querySelectorAll("[data-start]").forEach(function (b) { b.addEventListener("click", function () { startSession(b.getAttribute("data-start")); }); });
      return;
    }
    var item = s.items[s.idx], ex = item ? exerciseById(item.exerciseId) : null;
    /* F7 (Phase 2): a stored session may carry items that can
       no longer play (an expert or held-class id saved by
       hand, an unknown id). The player SKIPS them and finishes
       only when nothing playable remains; the stored data is
       never edited. */
    while (item && (!ex || !L.routinePlayable(ex))) { s.idx++; item = s.items[s.idx]; ex = item ? exerciseById(item.exerciseId) : null; }
    if (!item || !ex) { finishSession(s, true); return; }
    var FT = window.FitTrain; FT.ensure(s);
    var stale = FT.recoveryState(s, Date.now()) === "stale";
    var paused = s.pausedAt != null;
    var lastPerf = FT.lastPerformance(state.sessions, item.exerciseId, s.id);
    var note = FT.overloadNote(lastPerf, item.timed ? 0 : item.reps);
    var existingLog = s.log.filter(function (x) { return x.exerciseId === item.exerciseId && x.setNo === s.set; })[0];
    function fmtW(w) { return w == null ? "" : String(w); }
    var lastLine = "";
    if (note.kind !== "none") {
      lastLine = '<p class="hint lastTime">' + esc(tr("gym.lastTime", { sets: note.sets, reps: note.topReps, date: lastPerf.dateKey || "" },
        "Last time (" + (lastPerf.dateKey || "") + "): " + note.sets + " sets, best " + note.topReps + (item.timed ? " s" : " reps") + (note.weightKg != null ? " at " + note.weightKg + " kg" : "") + ".")) +
        (note.weightKg != null ? " " + esc(tr("gym.lastKg", { kg: note.weightKg }, "")) : "") +
        (note.kind === "reachedTarget" && !item.timed ? " " + esc(tr("gym.overloadInfo", null, "You hit your rep goal on every set. If it felt easy, you could try one more rep or a slightly heavier option. Only you can judge that.")) : "") + "</p>";
    }
    var staleHtml = stale ? '<div class="card staleCard" role="alert"><h2>' + esc(tr("gym.staleTitle", null, "Welcome back")) + '</h2><p>' + esc(tr("gym.staleBody", null, "This workout has been paused for a while. Your logged sets are safe. What would you like to do?")) +
      '</p><div class="row"><button class="primaryBtn" id="staleResume">' + esc(tr("gym.staleResume", null, "Continue workout")) + '</button><button class="pillBtn" id="staleFinish">' + esc(tr("gym.staleFinish", null, "Finish with what I logged")) + '</button><button class="pillBtn" id="staleDiscard">' + esc(tr("gym.staleDiscard", null, "Discard workout")) + '</button></div></div>' : "";
    var pips = "";
    for (var i = 1; i <= item.sets; i++) pips += '<span class="pip' + (i < s.set ? " done" : "") + '"></span>';
    el.innerHTML = staleHtml + skinAskHtml() + '<div class="card"><h2>' + esc(s.routineName) + (s.lightened ? tr("gym.lighterSuffix") : "") + '</h2>' +
      '<p class="hint">' + esc(tr("gym.exOf", { a: s.idx + 1, b: s.items.length })) + '<span id="sessClock">0:00</span></p>' +
      '<div class="exRow"><span class="exTile"><svg><use href="#i-gym"/></svg></span><span class="eName sessionBig">' + esc(exName(ex)) +
      '<br><span class="eMeta">' + esc(exPart(ex)) + " · " + esc(exEquip(ex)) + "</span>" +
      (ex.level === "intermediate" ? ' <span class="kcalChip">' + esc(tr("gym.stepUp")) + "</span>" : "") + "</span></div>" +
      '<p class="hint">' + esc(tr("gym.howTo", null, "How to")) + ": " + esc(exCue(ex)) + "</p>" + lastLine +
      '<div class="timerBar" id="timerBar"><span class="timerBarClock" id="timerBarClock">0:00</span><span class="timerBarLabel" id="timerBarLabel"></span></div>' +
      '<div id="animMount"></div>' +
      '<div class="setPips">' + pips + '</div><p class="hint">' + esc(tr("gym.setOf", { a: s.set, b: item.sets })) + "</p>" +
      (paused ? '<p class="pausedBanner" role="status">' + esc(tr("gym.paused", null, "Workout paused. Your time is not counting.")) + "</p>" : "") +
      (item.timed
        ? '<div class="timerBig" id="countBox">' + item.reps + esc(tr("gym.secSuffix")) + '</div><div class="row"><button class="primaryBtn" id="holdBtn"' + (paused ? " disabled" : "") + ">" + esc(tr("gym.startHold")) + '</button><button class="primaryBtn" id="setDone"' + (paused ? " disabled" : "") + ">" + esc(tr("gym.doneSet")) + "</button></div>"
        : '<div class="repCount" id="repCount" aria-live="polite">0</div><p class="hint" style="text-align:center">' + esc(tr("gym.repsHint")) + '</p>' +
          '<div class="row"><button class="pillBtn" id="repMinus"' + (paused ? " disabled" : "") + ">" + esc(tr("gym.minus1")) + '</button><button class="primaryBtn" id="repPlus"' + (paused ? " disabled" : "") + ">" + esc(tr("gym.plus1")) + "</button></div>" +
          '<div class="row"><label class="wLabel">' + esc(tr("gym.weightLabel", null, "Weight used (kg, optional)")) + '<input id="wInput" type="text" inputmode="decimal" autocomplete="off" value="' + esc(fmtW(existingLog ? existingLog.weightKg : (lastPerf && note.weightKg != null ? note.weightKg : null))) + '"></label></div>' +
          '<p class="hint err" id="logErr" role="alert"></p>' +
          '<div class="row"><button class="primaryBtn" id="setDone"' + (paused ? " disabled" : "") + ">" + esc(tr("gym.doneSet")) + "</button></div>" +
          '<div class="timerBig" id="countBox" role="timer"></div><div class="row"><button class="pillBtn" id="restBtn"' + (paused ? " disabled" : "") + ">" + esc(tr("gym.startRest", { sec: item.restSec })) + "</button></div>") +
      '<div class="row"><button class="pillBtn" id="pauseBtn" aria-pressed="' + paused + '">' + esc(paused ? tr("gym.resume", null, "Resume") : tr("gym.pause", null, "Pause")) + '</button><button class="pillBtn" id="nextEx">' + esc(tr("gym.nextEx")) + '</button><button class="pillBtn" id="finishBtn">' + esc(tr("gym.finishSession")) + '</button></div>' +
      '<div class="row"><button class="pillBtn" id="discardBtn">' + esc(tr("gym.discard", null, "Discard workout")) + "</button></div>" +
      '<p class="hint err" id="discardAsk" hidden></p></div>';
    var reps = item.timed ? 0 : (existingLog ? existingLog.reps : item.reps);
    if (!item.timed && $('repCount')) $('repCount').textContent = reps;
    /* THE TOP TIMER BAR (order of 17 Oct 2026): one calm bar
       above the animation for the whole session. Work on a rep
       set counts UP beside its guide; a hold counts DOWN its
       seconds; rest counts DOWN. Hold + rest are drawn from
       countdown()'s own counter (barLeft) — one source of
       truth, never a second timer. */
    var barPhase = "work"; /* work | hold | rest */
    var barLeft = 0;
    var setStart = Date.now();
    function drawBar() {
      var clock = $("timerBarClock"), label = $("timerBarLabel");
      if (!clock || !label) return;
      if (barPhase === "hold" || barPhase === "rest") {
        clock.textContent = fmtClock(barLeft);
        label.textContent = tr("gym." + barPhase + "Label");
      } else if (item.timed) {
        clock.textContent = fmtClock(item.reps);
        label.textContent = tr("gym.holdLabel");
      } else {
        clock.textContent = fmtClock((Date.now() - setStart) / 1000);
        label.textContent = tr("gym.timerGuide", { t: fmtClock(setGuideSec(item.reps)) });
      }
    }
    function tickClock() { var c = $("sessClock"); if (c) c.textContent = fmtClock(FT.elapsedMs(s, Date.now()) / 1000); drawBar(); }
    tickClock();
    gymTimer = setInterval(tickClock, 1000);
    function countdown(sec, label, after) {
      /* Rest freezes the loop at its current pose and phase
         (pin 5): the loop clock is handed over, not reset. */
      var preT = (label === "rest" && animHandle && animHandle.time) ? animHandle.time() : 0;
      stopGymTimer();
      var restAnim = null;
      if (label === "rest") { mountAnim(ex, preT); restAnim = animHandle; if (restAnim) restAnim.setFrozen(true); }
      var left = sec;
      if (label === "rest") { if (s.restEndsAt == null || FT.restLeftSec(s, Date.now()) <= 0) { FT.startRest(s, sec, Date.now()); save(); } left = FT.restLeftSec(s, Date.now()); }
      barPhase = label; barLeft = left;
      var box = $("countBox");
      function draw() { barLeft = left; if (box) box.textContent = tr("gym." + label + "Label") + " " + fmtClock(left); drawBar(); }
      draw();
      gymTimer = setInterval(function () {
        if (label === "rest") left = FT.restLeftSec(s, Date.now()); else left--; draw(); tickClock();
        if (left <= 0) { if (label === "rest") { FT.clearRest(s); save(); } barPhase = "work"; setStart = Date.now(); var tEnd = restAnim && restAnim.time ? restAnim.time() : 0; stopGymTimer(); gymTimer = setInterval(tickClock, 1000); if (box) box.textContent = tr("gym.countDone"); drawBar(); mountAnim(ex, tEnd); if (after) after(); }
      }, 1000);
    }
    function logCurrent() {
      var w = item.timed ? "" : $("wInput").value;
      var r = FT.logSet(s, { exerciseId: item.exerciseId, setNo: s.set, reps: item.timed ? item.reps : reps, weightKg: w }, Date.now());
      if (!r.ok) { var er = $("logErr"); if (er) er.textContent = r.error === "weight" ? tr("gym.badWeight", null, "Enter a weight like 20 or 22.5, or leave it empty.") : tr("gym.badReps", null, "Enter the number of reps."); if (r.error === "weight") $("wInput").focus(); return false; }
      return true;
    }
    function advance() {
      s.doneSets++;
      FT.clearRest(s);
      if (s.set >= item.sets) { s.idx++; s.set = 1; } else s.set++;
      save();
      if (s.idx >= s.items.length) finishSession(s, false); else renderSession();
    }
    if (item.timed) $("holdBtn").addEventListener("click", function () { countdown(item.reps, "hold", function () {}); });
    else {
      $("repPlus").addEventListener("click", function () { reps = Math.min(999, reps + 1); $("repCount").textContent = reps; });
      $("repMinus").addEventListener("click", function () { reps = Math.max(0, reps - 1); $("repCount").textContent = reps; });
      $("restBtn").addEventListener("click", function () { countdown(item.restSec, "rest", null); });
    }
    $("setDone").addEventListener("click", function () { if (logCurrent()) advance(); });
    $("pauseBtn").addEventListener("click", function () { if (paused) FT.resume(s, Date.now()); else FT.pause(s, Date.now()); save(); renderSession(); });
    $("discardBtn").addEventListener("click", function () {
      var ask = $("discardAsk");
      if (!ask.hidden) return;
      ask.hidden = false; ask.innerHTML = esc(tr("gym.discardSure", null, "Discard this workout and its logged sets? This cannot be undone.")) + ' <button type="button" class="pillBtn" id="discardYes">' + esc(tr("gym.discardYes", null, "Yes, discard")) + '</button> <button type="button" class="pillBtn" id="discardNo">' + esc(tr("common.cancel", null, "Cancel")) + "</button>";
      $("discardYes").addEventListener("click", function () { discardSession(s); });
      $("discardNo").addEventListener("click", function () { ask.hidden = true; ask.innerHTML = ""; $("discardBtn").focus(); });
      $("discardYes").focus();
    });
    if (stale) {
      $("staleResume").addEventListener("click", function () { s.lastActiveAt = Date.now(); save(); renderSession(); });
      $("staleFinish").addEventListener("click", function () { finishSession(s, false); });
      $("staleDiscard").addEventListener("click", function () { discardSession(s); });
    }
    if (!paused && !stale && !item.timed && FT.restLeftSec(s, Date.now()) > 0) countdown(item.restSec, "rest", null);
    $("nextEx").addEventListener("click", function () { s.idx++; s.set = 1; save(); if (s.idx >= s.items.length) finishSession(s, false); else renderSession(); });
    $("finishBtn").addEventListener("click", function () { finishSession(s, false); });
    if (paused) { var tc = $("sessClock"); if (tc) tc.textContent = fmtClock(FT.elapsedMs(s, Date.now()) / 1000); }
    wireSkinAsk(el);
    mountAnim(ex);
    drawBar();
  }
  function discardSession(s) {
    stopGymTimer();
    /* Tombstone, not delete: a plain delete would be resurrected by the cloud merge. */
    s.status = "discarded"; s.log = []; s.restEndsAt = null; s.pausedAt = null;
    save(); toast(tr("gym.discarded", null, "Workout discarded")); renderSession();
  }
  function finishSession(s, silent) {
    stopGymTimer();
    s.status = "done";
    if (window.FitTrain) { window.FitTrain.resume(s, Date.now()); window.FitTrain.clearRest(s); }
    s.minutes = Math.max(1, Math.round(window.FitTrain.elapsedMs(s, Date.now()) / 60000));
    save();
    if (!silent) { toast(tr("gym.sessionSaved")); showWallyCelebration("session"); }
    renderSession();
  }
  /* --- Machine photo: user-verified picture match.
     This build has no machine-specific photo model, so it
     never guesses, claims a match, or invents a confidence
     score. Search or pick a name; when a photo is present,
     show the user's choice and ask for confirmation. --- */
  /* Generated art (graphic redo, approved 17 Oct 2026):
     station art derives from the player's generated frame
     sets (FitAnim.framesFor), never a second hand-kept
     list. A station shows the moving frames of its first
     exercise, in the user's picked figure, when that
     exercise holds a set; a station whose exercise holds
     no set yet shows a clean name tile plus the animation
     player in its view. Never a fake picture. */
  function stationFramesFor(m) {
    var first = m && m.exerciseIds && m.exerciseIds[0];
    if (!first || !window.FitAnim || !window.FitAnim.framesFor) return null;
    return window.FitAnim.framesFor(first, trainerSkin());
  }
  var mcFrameTimer = null;
  function stopMcFrames() { if (mcFrameTimer) { clearInterval(mcFrameTimer); mcFrameTimer = null; } }
  function mcBubbleLine(ex, i) {
    var key = "bub." + ex.id + "." + i;
    var s = tr(key);
    if (s === key) {
      var track = window.FIT_ANIM && window.FIT_ANIM[ex.id];
      s = (track && track.bubbles && track.bubbles[i]) || "";
    }
    return s;
  }
  function startMcFrames(frames, ex) {
    var img = $("mcFrameImg"), bub = $("mcBubble");
    if (!img) return;
    var step = 0;
    function show() {
      if (!document.body.contains(img)) { stopMcFrames(); return; }
      img.src = frames[step];
      if (bub) bub.textContent = mcBubbleLine(ex, step);
      step = (step + 1) % frames.length;
    }
    var stills = !!((state.settings && state.settings.calmPics) ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    show();
    if (stills) { img.addEventListener("click", show); return; }
    mcFrameTimer = setInterval(show, 870);
  }
  function renderStation(m) {
    stopMcFrames(); stopAnim();
    var box = $("mcResult");
    if (!box) return;
    var items = m.exerciseIds.map(function (id) {
      var e = exerciseById(id);
      return { exerciseId: id, sets: 3, reps: e && e.timed ? e.timed : 12, timed: !!(e && e.timed), restSec: 45 };
    });
    var first = exerciseById(m.exerciseIds[0]);
    var frames = stationFramesFor(m);
    var stage;
    if (frames && first) {
      stage = '<div class="stationStage"><img class="stationFrame" id="mcFrameImg" src="' + frames[0] + '" alt="' + esc(tr("gym.movingAlt")) + '">' +
        '<div class="animGuide"><img class="animWally" src="assets/wally-profile.webp" alt="' + esc(tr("anim.wallyAlt", null, "Wally, your guide")) + '">' +
        '<div class="animBubble"><span id="mcBubble">' + esc(mcBubbleLine(first, 0)) + "</span></div></div></div>";
    } else {
      stage = '<div id="animMount"></div>';
    }
    var hasLibraryOnly = items.some(function (it) { var e = exerciseById(it.exerciseId); return !!e && !L.routinePlayable(e); });
    box.innerHTML = '<div class="card"><h2>' + esc(machName(m)) + "</h2>" + stage +
      (first ? '<h3>' + esc(tr("gym.howTo")) + '</h3><p class="hint">' + esc(exCue(first)) + "</p>" : "") +
      items.slice(0, 40).map(function (it) { return exRow(it, exerciseById(it.exerciseId)); }).join("") +
      (items.length > 40 ? '<p class="hint">' + esc(tr("gym.showingCount", { a: 40, b: items.length })) + "</p>" : "") +
      (hasLibraryOnly ? '<p class="hint">' + esc(tr("gym.stationLibraryOnly")) + "</p>" : "") +
      '<div class="row"><button class="primaryBtn" id="mcMake">' + esc(tr("gym.makeRoutine")) + '</button></div></div>';
    if (frames && first) startMcFrames(frames, first);
    else if (first) mountAnim(first);
    $("mcMake").addEventListener("click", function () {
      if (!maySaveRoutine()) return;
      /* F7: a station routine is built from the playable
         items only; library-only exercises stay in the
         library, never in a routine. */
      var playable = L.playableItems(items, EX.EXERCISES);
      if (!playable.length) { toast(tr("gym.nothingPlayable")); return; }
      state.routines.push({ id: "routine." + Date.now(), name: machName(m) + tr("gym.routineSuffix"), goalId: null,
        minutes: 30, days: [], time: null, createdKey: L.todayKey(), items: playable });
      save(); toast(tr("gym.routineSaved")); openArea("gym", "gym-routines");
    });
    if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderMachine() {
    stopMcFrames(); stopAnim();
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("gym.showMachine")) + '</h2>' +
      '<p class="hint">' + esc(tr("gym.machineHint")) + '</p>' +
      '<input id="mcPhoto" type="file" accept="image/*" aria-label="Add a machine photo"><div id="mcPreview"></div>' +
      '<p class="hint" id="mcPhotoStatus" role="status" aria-live="polite"></p>' +
      '<p class="hint">' + esc(tr("gym.matchAsk")) + '</p>' +
      '<label for="mcSearch">' + esc(tr("gym.machineSearchLabel")) +
      '<input id="mcSearch" type="search" autocomplete="off" placeholder="' + esc(tr("gym.machineSearchPlaceholder")) + '"></label>' +
      '<p class="hint" id="mcSearchStatus" role="status" aria-live="polite"></p>' +
      '<div class="row"><button class="pillBtn hidden" id="mcClearSearch" type="button">' + esc(tr("gym.machineSearchShowAll")) + '</button></div>' +
      '<div class="machineGrid" id="mcGrid">' + EX.MACHINES.map(function (m) {
        var fr = stationFramesFor(m);
        return '<button class="machineTile" type="button" data-machine="' + m.id + '">' +
          (fr ? '<img class="machineTileImg" src="' + fr[0] + '" alt="">' : "") +
          '<span class="machineTileName">' + esc(machName(m)) + "</span></button>"; }).join("") + "</div>" +
      '<div class="row"><button class="pillBtn" id="mcNone" type="button">' + esc(tr("gym.noneMatch")) + '</button></div>' +
      '<div id="mcNames" class="hidden"><p class="hint">' + esc(tr("gym.noneHint")) + '</p>' +
      '<div class="chipRow">' + EX.MACHINES.map(function (m) {
        return '<button class="chip" type="button" data-machine="' + m.id + '">' + esc(machName(m)) + "</button>"; }).join("") + "</div></div>" +
      '<div id="mcConfirm" class="hidden" aria-live="polite"></div><div id="mcResult"></div><div id="myMachines"></div></div>';
    var photoSelected = false;
    function folded(s) {
      return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    }
    function updateMachineSearch() {
      var q = folded($("mcSearch").value);
      var matches = {};
      EX.MACHINES.forEach(function (m) {
        if (!q || folded(machName(m) + " " + m.name + " " + m.id).indexOf(q) !== -1) matches[m.id] = true;
      });
      el.querySelectorAll("[data-machine]").forEach(function (b) {
        b.classList.toggle("hidden", !matches[b.getAttribute("data-machine")]);
      });
      var count = Object.keys(matches).length;
      $("mcSearchStatus").textContent = q && !count ? tr("gym.machineSearchNoResults") : "";
      $("mcClearSearch").classList.toggle("hidden", !q);
    }
    var pendingMachinePhoto = null;
    function drawMyMachines() {
      var box = $("myMachines"); if (!box || !window.FitPhotos || !window.FitPhotos.available()) return;
      window.FitPhotos.list("machines").then(function (xs) {
        box.innerHTML = '<h3>' + esc(tr("gym.myMachines", null, "My gym machines")) + '</h3><p class="hint">' + esc(tr("gym.myMachinesNote", null, "Photos you saved after choosing the machine yourself. They stay on this device only.")) + "</p>" +
          (xs.length ? '<div class="photoGrid">' + xs.map(function (x) { return '<figure class="phItem"><img alt="' + esc(tr("gym.savedMachineAlt", { name: x.label }, "Your photo of " + x.label)) + '" src="' + URL.createObjectURL(x.blob) + '"><figcaption>' + esc(x.label) + '</figcaption><button class="miniBtn" data-mdel="' + esc(x.id) + '" aria-label="' + esc(tr("prog.delPhotoAria", { d: x.label }, "Remove photo of " + x.label)) + '">' + esc(tr("common.remove")) + "</button></figure>"; }).join("") + "</div>" : '<p class="hint">' + esc(tr("gym.noSavedMachines", null, "No saved machines yet.")) + "</p>");
        box.querySelectorAll("[data-mdel]").forEach(function (b) { b.addEventListener("click", function () { window.FitPhotos.remove(b.getAttribute("data-mdel")).then(drawMyMachines); }); });
      }).catch(function () {});
    }
    function selectMachine(m) {
      if (!m) return;
      if (!photoSelected) { renderStation(m); return; }
      var confirm = $("mcConfirm");
      confirm.innerHTML = '<div class="card"><h3>' + esc(tr("gym.machinePicked", { name: machName(m) })) + '</h3>' +
        '<p class="hint">' + esc(tr("gym.machineConfidenceUnavailable")) + '</p><div class="row">' +
        '<button class="primaryBtn" id="mcConfirmYes" type="button">' + esc(tr("gym.machineConfirm")) + '</button>' +
        '<button class="pillBtn" id="mcConfirmNo" type="button">' + esc(tr("gym.machineChooseAnother")) + '</button></div></div>';
      confirm.classList.remove("hidden");
      $("mcConfirmYes").addEventListener("click", function () {
        confirm.classList.add("hidden");
        var f = pendingMachinePhoto; pendingMachinePhoto = null;
        if (f && window.FitPhotos && window.FitPhotos.available()) {
          window.FitPhotos.prepare(f, 900).then(function (b) { return window.FitPhotos.add("machines", b, { date: L.todayKey(), label: machName(m), machineId: m.id }); })
            .then(function () { toast(tr("gym.machineSaved", null, "Saved to My gym machines on this device")); drawMyMachines(); })
            .catch(function () { toast(tr("gym.machineSaveFail", null, "The photo could not be saved, but the machine guide still works.")); });
        }
        renderStation(m);
      });
      $("mcConfirmNo").addEventListener("click", function () { confirm.classList.add("hidden"); $("mcSearch").focus(); });
    }
    $("mcSearch").addEventListener("input", updateMachineSearch);
    $("mcClearSearch").addEventListener("click", function () {
      $("mcSearch").value = ""; updateMachineSearch(); $("mcSearch").focus();
    });
    $("mcPhoto").addEventListener("change", function () {
      var f = $("mcPhoto").files[0]; if (!f) return;
      photoSelected = true; pendingMachinePhoto = f;
      $("mcResult").innerHTML = "";
      $("mcConfirm").classList.add("hidden");
      $("mcPhotoStatus").textContent = tr("gym.machineConfidenceUnavailable");
      var rd = new FileReader();
      rd.onload = function () { $("mcPreview").innerHTML = '<img class="photoImg mcPhotoImg" alt="' + esc(tr("gym.machineAlt")) + '" src="' + String(rd.result) + '">'; };
      rd.readAsDataURL(f);
    });
    $("mcNone").addEventListener("click", function () { $("mcNames").classList.remove("hidden"); });
    el.querySelectorAll("[data-machine]").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = EX.MACHINES.filter(function (x) { return x.id === b.getAttribute("data-machine"); })[0];
        selectMachine(m);
      });
    });
    updateMachineSearch();
    drawMyMachines();
  }
  /* --- Exercise library (Phase 2): the full spliced set,
     searchable, with the D2 labels. Expert and held-class
     exercises are here to look at; the Add button exists only
     where a hand-built routine may take the exercise (strength,
     beginner or intermediate). Intermediate joins hand-picks
     only once the trainer unlock opens (design section 5: the
     count is a desk parameter in logic.js). No surface renders
     the whole set at once: results are windowed. --- */
  var libState = { q: "", kind: "all", part: "all", equip: "all" };
  function addToPicks(exId) {
    var ex = exerciseById(exId);
    if (!ex || !((ex.category === "strength" || ex.category == null) && ex.level !== "expert")) return;
    if (ex.level === "intermediate" && !L.stepUpUnlocked(state.sessions)) { toast(tr("gym.stepUpLocked")); return; }
    var picks = (state.routines || []).filter(function (r) { return r.handBuilt; })[0];
    if (!picks) {
      if (!maySaveRoutine()) return;
      picks = { id: "routine.picks", name: tr("gym.myPicks"), goalId: null, minutes: 30,
        days: [], time: null, createdKey: L.todayKey(), handBuilt: true, items: [] };
      state.routines.push(picks);
    }
    if ((picks.items || []).some(function (it) { return it.exerciseId === exId; })) { toast(tr("gym.alreadyIn")); return; }
    picks.items.push({ exerciseId: exId, sets: 3, reps: ex.timed ? ex.timed : 12, timed: !!ex.timed, restSec: 45 });
    save(); toast(tr("gym.addedToPicks"));
  }
  function renderLibrary(refocus) {
    stopMcFrames(); stopAnim();
    var el = $("areaBody");
    var kinds = [["all", "gym.allKinds"], ["strength", "gym.kindStrength"], ["stretching", "gym.classStretching"],
      ["plyometrics", "gym.classPlyometrics"], ["powerlifting", "gym.classPowerlifting"],
      ["olympic weightlifting", "gym.classOlympic"], ["strongman", "gym.classStrongman"], ["cardio", "gym.classCardio"]];
    var q = foldName(libState.q.trim());
    var list = (EX.EXERCISES || []).filter(function (e) {
      if (libState.kind !== "all" && (e.category || "strength") !== libState.kind) return false;
      if (libState.part && libState.part !== "all" && e.partLabel !== libState.part) return false;
      if (libState.equip && libState.equip !== "all" && e.equipment !== libState.equip) return false;
      if (q && foldName(e.name).indexOf(q) === -1 && foldName(exName(e)).indexOf(q) === -1) return false;
      return true;
    });
    var fac = window.FitTrain.facets(EX.EXERCISES || []);
    var shown = list.slice(0, 100);
    var rows = shown.map(function (e) {
      var chip = "";
      if (e.level === "expert") chip = ' <span class="kcalChip">' + esc(tr("gym.advanced")) + "</span>";
      else if (e.category && e.category !== "strength") chip = ' <span class="kcalChip">' + esc(tr(classKey(e.category))) + "</span>";
      else if (e.level === "intermediate") chip = ' <span class="kcalChip">' + esc(tr("gym.stepUp")) + "</span>";
      var canAdd = (e.category === "strength" || e.category == null) && e.level !== "expert" &&
        (e.level !== "intermediate" || L.stepUpUnlocked(state.sessions));
      return '<div class="exRow"><span class="exTile"><svg><use href="#i-gym"/></svg></span>' +
        '<span class="eName">' + esc(exName(e)) + '<br><span class="eMeta">' + esc(exPart(e)) + " · " + esc(exEquip(e)) + "</span></span>" + chip +
        (canAdd ? '<button class="pillBtn" data-libadd="' + e.id + '">' + esc(tr("gym.addBtn")) + "</button>" : "") + "</div>";
    }).join("");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("sub.gym-library", null, "Exercise library")) + '</h2>' +
      '<p class="hint">' + esc(tr("gym.libraryHint")) + '</p>' +
      (L.stepUpUnlocked(state.sessions) ? "" : '<p class="hint">' + esc(tr("gym.stepUpLocked")) + "</p>") +
      '<input id="libSearch" type="search" aria-label="' + esc(tr("gym.searchPh")) + '" placeholder="' + esc(tr("gym.searchPh")) + '" value="' + esc(libState.q) + '">' +
      '<div class="grid2 filterRow"><label>' + esc(tr("gym.musclePick", null, "Muscle area")) + '<select id="libPart"><option value="all">' + esc(tr("gym.allMuscles", null, "All muscles")) + "</option>" + fac.parts.map(function (p) { return '<option value="' + esc(p) + '"' + (libState.part === p ? " selected" : "") + ">" + esc(cName("part", p, p)) + "</option>"; }).join("") + "</select></label>" +
      '<label>' + esc(tr("gym.equipPick", null, "Equipment")) + '<select id="libEquip"><option value="all">' + esc(tr("gym.allEquip", null, "All equipment")) + "</option>" + fac.equipment.map(function (p) { return '<option value="' + esc(p) + '"' + (libState.equip === p ? " selected" : "") + ">" + esc(cName("equip", p, p)) + "</option>"; }).join("") + "</select></label></div>" +
      '<p class="hint" id="libCount" role="status" aria-live="polite">' + esc(tr("gym.libCount", { n: list.length }, list.length + " exercises")) + "</p>" +
      '<div class="chipRow">' + kinds.map(function (k) {
        return '<button class="chip' + (libState.kind === k[0] ? " on" : "") + '" data-libkind="' + k[0] + '">' + esc(tr(k[1])) + "</button>"; }).join("") + "</div>" +
      (list.length > shown.length ? '<p class="hint">' + esc(tr("gym.showingCount", { a: shown.length, b: list.length })) + "</p>" : "") +
      (rows || '<p class="hint">' + esc(tr("gym.noMatch")) + "</p>") + "</div>";
    $("libPart").addEventListener("change", function () { libState.part = $("libPart").value; renderLibrary(false); });
    $("libEquip").addEventListener("change", function () { libState.equip = $("libEquip").value; renderLibrary(false); });
    var search = $("libSearch");
    search.addEventListener("input", function () { libState.q = search.value; renderLibrary(true); });
    el.querySelectorAll("[data-libkind]").forEach(function (b) { b.addEventListener("click", function () { libState.kind = b.getAttribute("data-libkind"); renderLibrary(false); }); });
    el.querySelectorAll("[data-libadd]").forEach(function (b) { b.addEventListener("click", function () { addToPicks(b.getAttribute("data-libadd")); }); });
    if (refocus) { var ns = $("libSearch"); if (ns) { ns.focus(); try { ns.setSelectionRange(ns.value.length, ns.value.length); } catch (e) {} } }
  }
  function renderHistory() {
    stopGymTimer();
    var el = $("areaBody"), H = window.FitTrain.history(state.sessions);
    var html = '<div class="card"><h2>' + esc(tr("sub.gym-history", null, "History")) + "</h2>";
    if (!H.length) html += '<p class="hint">' + esc(tr("gym.noHistory", null, "No finished workouts yet. When you finish one, it shows up here.")) + "</p>";
    html += H.slice(0, 50).map(function (h) {
      return '<div class="listRow histRow"><span class="grow"><b>' + esc(h.name || tr("gym.sessionWord")) + "</b><br><span class='hint'>" + esc(h.dateKey || "") + " · " + h.minutes + " min" +
        (h.logged ? " · " + esc(tr("gym.setsLogged", { n: h.sets }, h.sets + " sets logged")) + (h.volumeKg ? " · " + h.volumeKg + " kg total" : "") : " · " + esc(tr("gym.notLogged", null, "sets not logged"))) + "</span></span></div>";
    }).join("") + "</div>";
    el.innerHTML = html;
  }
  function renderGym(subId) {
    if (subId === "gym-history") renderHistory();
    else if (subId === "gym-session") renderSession();
    else if (subId === "gym-machine") renderMachine();
    else if (subId === "gym-library") renderLibrary(false);
    else renderRoutines();
  }

  /* ================= PEPTIDES (Phase 5) =================
     TRACKING ONLY. The app never suggests an amount, a schedule
     or a product. It records what the user types, in the user's
     own words and numbers, against the one-time agreement.
     The gate below is a hard requirement of the build: the disclaimer
     shows once, the user must agree, the agreement is recorded
     with its time. Every peptides screen sits behind it. */
  function peptideById(id) { return (state.peptides || []).filter(function (p) { return p.id === id; })[0] || null; }
  function scheduleText(p) {
    if (!p.schedule) return tr("pep.noDays");
    if (Array.isArray(p.schedule.days) && p.schedule.days.length) {
      return p.schedule.days.map(function (d) { return tr("cal.wd" + d); }).join(", ");
    }
    if (p.schedule.intervalDays) return p.schedule.intervalDays === 1 ? tr("pep.every1") : tr("pep.everyN", { n: p.schedule.intervalDays });
    return tr("pep.noDays");
  }
  function nextDoseLine(p) {
    var key = L.nextDoseKey(p, L.todayKey());
    if (!key) return tr("pep.nextNone");
    var when = key === L.todayKey() ? tr("pep.today") : key === L.addDays(L.todayKey(), 1) ? tr("pep.tomorrow") : dayLabel(key) + " " + key.slice(8) + "/" + key.slice(5, 7);
    return tr("pep.nextPrefix") + when + (p.time ? tr("pep.at") + p.time : "");
  }
  function renderPeptides(subId) {
    var el = $("areaBody");
    if (!L.disclaimerAgreed(state, D.DISCLAIMER_VERSION)) {
      el.innerHTML = '<div class="card"><h2>' + esc(tr("pep.gateTitle")) + '</h2>' +
        '<p>' + esc(tr("legal.disclaimer", null, D.DISCLAIMER_TEXT)) + "</p>" +
        '<p class="hint">' + esc(tr("legal.gateHint1")) + '</p>' +
        '<p class="hint">' + esc(tr("legal.gateHint2")) + '</p>' +
        '<div class="row"><button class="primaryBtn" id="agreeBtn">' + esc(tr("pep.agree")) + '</button></div></div>';
      $("agreeBtn").addEventListener("click", function () {
        state.disclaimer = { agreedAt: new Date().toISOString(), version: D.DISCLAIMER_VERSION };
        save(); renderPeptides(subId); toast(tr("pep.agreedToast"));
      });
      return;
    }
    if (subId === "pep-appts") renderPepAppts();
    else if (subId === "pep-log") renderPepLog();
    else if (subId === "pep-next") renderPepNext();
    else renderPepList();
  }
  function renderPepList() {
    var el = $("areaBody");
    var dayNames = [1, 2, 3, 4, 5, 6, 7].map(function (di) { return tr("cal.d" + di); });
    var dayVals = [1, 2, 3, 4, 5, 6, 0];
    var html = '<div class="card"><h2>' + esc(tr("pep.addTitle")) + '</h2>' +
      '<p class="hint">' + esc(tr("legal.addHint")) + '</p>' +
      '<div class="grid2"><label>' + esc(tr("pep.nameLabel")) + '<input id="ppName" type="text" placeholder="' + esc(tr("pep.namePh")) + '"></label>' +
      '<label>' + esc(tr("pep.amountLabel")) + '<input id="ppAmount" type="text" inputmode="decimal" placeholder="' + esc(tr("pep.amountPh")) + '"></label>' +
      '<label>' + esc(tr("meal.unit")) + '<select id="ppUnit"><option>mg</option><option>mcg</option><option value="units">' + esc(tr("pep.unitUnits")) + '</option><option>ml</option><option value="tablets">' + esc(tr("pep.unitTablets")) + '</option><option value="clicks">' + esc(tr("pep.unitClicks")) + '</option></select></label>' +
      '<label>' + esc(tr("pep.timeLabel")) + '<input id="ppTime" type="time" value="09:00"></label></div>' +
      '<label>' + esc(tr("pep.howRepeats")) + '<select id="ppMode"><option value="days">' + esc(tr("pep.modeDays")) + '</option><option value="interval">' + esc(tr("pep.modeInterval")) + '</option></select></label>' +
      '<div id="ppDaysBox"><p class="hint">' + esc(tr("gym.daysLabel")) + '</p><div class="dayChips" id="ppDays">' + dayNames.map(function (d, i) {
        return '<button class="chip" data-ppday="' + dayVals[i] + '">' + d + "</button>"; }).join("") + "</div></div>" +
      '<div id="ppIntBox" class="hidden"><div class="grid2"><label>' + esc(tr("pep.everyHowMany")) + '<input id="ppInterval" type="number" min="1" value="7"></label>' +
      '<label>' + esc(tr("pep.startingOn")) + '<input id="ppStart" type="date" value="' + L.todayKey() + '"></label></div></div>' +
      '<label>' + esc(tr("pep.instrLabel", null, "Your clinician's instructions, in their words (optional)")) + '<textarea id="ppInstr" maxlength="500" rows="2"></textarea></label>' +
      '<label>' + esc(tr("pep.prescLabel", null, "Prescriber (optional)")) + '<input id="ppPresc" type="text" maxlength="80"></label>' +
      '<label class="confirmRow"><input type="checkbox" id="ppConfirm"> <span>' + esc(tr("pep.confirmLabel", null, "I confirm this is what my clinician or pharmacist told me. Fit Hard does not suggest or change it.")) + '</span></label>' +
      '<div class="row"><button class="primaryBtn" id="ppAdd">' + esc(tr("pep.saveBtn")) + '</button></div></div>';
    if (!(state.peptides || []).length) html += '<div class="card emptyCard">' + (guideOn() ? wallyWrap("welcome", null, 56) : "") + '<svg class="ic icBig"><use href="#i-pep"/></svg><p>' + esc(tr("pep.nothingTracked")) + '</p><p class="hint">' + esc(tr("pep.nothingHint")) + '</p></div>';
    (state.peptides || []).forEach(function (p) {
      html += '<div class="card"><h2><span class="mealDot" style="background:' + esc(p.color) + ';display:inline-block"></span> ' + esc(p.name) + "</h2>" +
        '<p class="hint">' + esc(tr("pep.youTake", { amount: p.amount, unit: tr("pep.unit" + p.unit.charAt(0).toUpperCase() + p.unit.slice(1), null, p.unit) })) + " · " + scheduleText(p) + (p.time ? " · " + esc(p.time) : "") + "</p>" +
        '<p class="dayTotal">' + nextDoseLine(p) + "</p>" +
        '<div class="row"><label style="flex:1">' + esc(tr("pep.amountThisTime")) + '<input type="text" inputmode="decimal" id="amt-' + p.id + '" value="' + esc(p.amount) + '"></label>' +
        '<button class="primaryBtn" data-log="' + p.id + '">' + esc(tr("pep.st.taken", null, "Taken")) + '</button>' +
        '<button class="pillBtn" data-logs="' + p.id + '|not_taken">' + esc(tr("pep.st.not_taken", null, "Not taken")) + '</button>' +
        '<button class="pillBtn" data-logs="' + p.id + '|unknown">' + esc(tr("pep.st.unknown", null, "Not sure")) + '</button></div>' +
        (p.instructions ? '<p class="hint">' + esc(tr("pep.instrShown", null, "Your clinician's instructions")) + ': ' + esc(p.instructions) + '</p>' : "") +
        '<div class="row"><button class="pillBtn" data-editpep="' + p.id + '">' + esc(tr("pep.edit", null, "Edit")) + '</button>' +
        '<button class="pillBtn" data-histpep="' + p.id + '">' + esc(tr("pep.history", null, "Change history")) + '</button>' +
        '<button class="pillBtn" data-delpep="' + p.id + '">' + esc(tr("common.remove")) + '</button></div><div id="pepPanel-' + p.id + '"></div></div>';
    });
    el.innerHTML = html;
    el.querySelectorAll("[data-ppday]").forEach(function (b) { b.addEventListener("click", function () { b.classList.toggle("on"); }); });
    $("ppMode").addEventListener("change", function () {
      var interval = $("ppMode").value === "interval";
      $("ppDaysBox").classList.toggle("hidden", interval);
      $("ppIntBox").classList.toggle("hidden", !interval);
    });
    $("ppAdd").addEventListener("click", function () {
      var name = $("ppName").value.trim();
      if (!name) { toast(tr("pep.toastNameFirst")); return; }
      var amount = $("ppAmount").value.trim();
      if (!amount) { toast(tr("pep.toastAmount")); return; }
      if (!$("ppConfirm").checked) { toast(tr("pep.toastConfirm", null, "Please tick the box to confirm this is from your clinician.")); return; }
      var schedule;
      if ($("ppMode").value === "interval") {
        var n = Math.max(1, Number($("ppInterval").value) || 1);
        schedule = { intervalDays: n, startKey: $("ppStart").value || L.todayKey() };
      } else {
        var days = [];
        el.querySelectorAll("[data-ppday].on").forEach(function (b) { days.push(Number(b.getAttribute("data-ppday"))); });
        if (!days.length) { toast(tr("pep.toastPickDay")); return; }
        schedule = { days: days };
      }
      state.peptides.push({ id: "pep." + Date.now(), name: name, amount: amount, unit: $("ppUnit").value,
        color: L.nextColor((state.peptides || []).map(function (p) { return p.color; })), schedule: schedule, time: $("ppTime").value || null, log: [],
        instructions: window.FitHealth.clean($("ppInstr").value, 500), prescriber: window.FitHealth.clean($("ppPresc").value, 80), confirmedAt: new Date().toISOString(), audit: [] });
      window.FitHealth.appendAudit(state.peptides[state.peptides.length - 1], "created", {}, new Date().toISOString());
      save(); renderPepList(); toast(tr("pep.toastSaved"));
    });
    function logStatus(id, status, amt) {
      var p = peptideById(id); if (!p) return;
      var now = new Date();
      window.FitHealth.addLog(p, { dateKey: L.todayKey(), time: ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2), status: status, amount: amt });
      save(); toast(tr("pep.toastLogged"));
      if (status === "taken") showWallyCelebration("dose");
    }
    el.querySelectorAll("[data-log]").forEach(function (b) { b.addEventListener("click", function () {
      var p = peptideById(b.getAttribute("data-log")); if (!p) return;
      logStatus(p.id, "taken", ($("amt-" + p.id) || {}).value || p.amount); renderPepList();
    }); });
    el.querySelectorAll("[data-logs]").forEach(function (b) { b.addEventListener("click", function () {
      var parts = b.getAttribute("data-logs").split("|"); logStatus(parts[0], parts[1]); renderPepList();
    }); });
    el.querySelectorAll("[data-histpep]").forEach(function (b) { b.addEventListener("click", function () {
      var p = peptideById(b.getAttribute("data-histpep")); var box = $("pepPanel-" + p.id); if (!p || !box) return;
      if (box.innerHTML) { box.innerHTML = ""; return; }
      box.innerHTML = '<div class="histBox"><h3>' + esc(tr("pep.history", null, "Change history")) + '</h3>' + ((p.audit || []).length ? (p.audit || []).slice().reverse().map(function (a) {
        var ch = Object.keys(a.changes || {}).map(function (k) { return esc(k) + ": " + esc(String(a.changes[k][0])) + " → " + esc(String(a.changes[k][1])); }).join("; ");
        return '<p class="hint">' + esc(a.at.slice(0, 16).replace("T", " ")) + " · " + esc(a.action) + (ch ? " · " + ch : "") + "</p>"; }).join("") : '<p class="hint">' + esc(tr("pep.noHistory", null, "No changes yet.")) + "</p>") + "</div>";
    }); });
    el.querySelectorAll("[data-editpep]").forEach(function (b) { b.addEventListener("click", function () {
      var p = peptideById(b.getAttribute("data-editpep")); var box = $("pepPanel-" + p.id); if (!p || !box) return;
      if (box.innerHTML) { box.innerHTML = ""; return; }
      box.innerHTML = '<div class="editBox"><div class="grid2"><label>' + esc(tr("pep.nameLabel")) + '<input id="ed-name" type="text" value="' + esc(p.name) + '"></label>' +
        '<label>' + esc(tr("pep.amountLabel")) + '<input id="ed-amount" type="text" value="' + esc(p.amount) + '"></label>' +
        '<label>' + esc(tr("pep.timeLabel")) + '<input id="ed-time" type="time" value="' + esc(p.time || "") + '"></label>' +
        '<label>' + esc(tr("pep.prescLabel", null, "Prescriber (optional)")) + '<input id="ed-presc" type="text" maxlength="80" value="' + esc(p.prescriber || "") + '"></label></div>' +
        '<label>' + esc(tr("pep.instrLabel", null, "Your clinician's instructions, in their words (optional)")) + '<textarea id="ed-instr" maxlength="500" rows="2">' + esc(p.instructions || "") + '</textarea></label>' +
        '<label class="confirmRow"><input type="checkbox" id="ed-confirm"> <span>' + esc(tr("pep.confirmChange", null, "I confirm this change matches what my clinician or pharmacist told me.")) + '</span></label>' +
        '<div class="row"><button class="primaryBtn" id="ed-save">' + esc(tr("pep.saveChange", null, "Save change")) + '</button></div></div>';
      $("ed-save").addEventListener("click", function () {
        if (!$("ed-name").value.trim()) { toast(tr("pep.toastNameFirst")); return; }
        if (!$("ed-amount").value.trim()) { toast(tr("pep.toastAmount")); return; }
        if (!$("ed-confirm").checked) { toast(tr("pep.toastConfirmChange", null, "Please tick the box to confirm this change is from your clinician.")); return; }
        var before = JSON.parse(JSON.stringify(p));
        p.name = window.FitHealth.clean($("ed-name").value, 80); p.amount = window.FitHealth.clean($("ed-amount").value, 40);
        p.time = $("ed-time").value || null; p.prescriber = window.FitHealth.clean($("ed-presc").value, 80); p.instructions = window.FitHealth.clean($("ed-instr").value, 500);
        var ch = window.FitHealth.diff(before, p);
        if (!Object.keys(ch).length) { toast(tr("pep.noChange", null, "Nothing changed.")); return; }
        p.confirmedAt = new Date().toISOString();
        window.FitHealth.appendAudit(p, "edited", ch, p.confirmedAt);
        save(); renderPepList(); toast(tr("pep.toastChanged", null, "Saved. The change is in your history."));
      });
    }); });
    renderHealthData(el);
    el.querySelectorAll("[data-delpep]").forEach(function (b) { b.addEventListener("click", function () {
      var gone = peptideById(b.getAttribute("data-delpep"));
      state.peptides = state.peptides.filter(function (p) { return p.id !== b.getAttribute("data-delpep"); });
      state.healthRemoved = (state.healthRemoved || []);
      save(); renderPepList(); if (gone) toast(tr("pep.removed", null, "Removed."));
    }); });
  }
  function renderPepLog() {
    var el = $("areaBody");
    var rows = [];
    (state.peptides || []).forEach(function (p) {
      (p.log || []).forEach(function (lg, i) { rows.push({ p: p, lg: lg, idx: i }); });
    });
    rows.sort(function (a, b) { return (b.lg.dateKey + (b.lg.time || "")) < (a.lg.dateKey + (a.lg.time || "")) ? -1 : 1; });
    var html = '<div class="card"><h2>' + esc(tr("sub.pep-log", null, "Dose log")) + '</h2><p class="hint">' + esc(tr("pep.logHint")) + '</p>';
    if (!rows.length) html += '<p class="hint">' + esc(tr("pep.nothingLogged")) + '</p>';
    html += rows.map(function (r) {
      return '<div class="listRow"><span class="mealDot" style="background:' + esc(r.p.color) + '"></span>' +
        '<span class="grow">' + esc(r.p.name) + (window.FitHealth.statusOf(r.lg) === "taken" ? " · " + esc(r.lg.amount) + " " + esc(r.lg.unit) : "") + ' <span class="chip statusChip" data-status="' + window.FitHealth.statusOf(r.lg) + '">' + esc(tr("pep.st." + window.FitHealth.statusOf(r.lg), null, { taken: "Taken", not_taken: "Not taken", unknown: "Not sure" }[window.FitHealth.statusOf(r.lg)])) + "</span></span>" +
        '<span class="hint">' + esc(r.lg.dateKey) + (r.lg.time ? " " + esc(r.lg.time) : "") + "</span>" +
        '<button class="miniBtn" data-unlog="' + r.p.id + "|" + r.idx + '">' + esc(tr("common.remove")) + '</button></div>';
    }).join("") + "</div>";
    el.innerHTML = html;
    el.querySelectorAll("[data-unlog]").forEach(function (b) { b.addEventListener("click", function () {
      var parts = b.getAttribute("data-unlog").split("|");
      var p = peptideById(parts[0]);
      if (p) { p.log.splice(Number(parts[1]), 1); save(); renderPepLog(); }
    }); });
  }
  function renderPepNext() {
    var el = $("areaBody");
    var html = '<div class="card"><h2>' + esc(tr("sub.pep-next", null, "Next doses")) + '</h2><p class="hint">' + esc(tr("pep.nextHint")) + '</p>';
    if (!(state.peptides || []).length) html += '<p class="hint">' + esc(tr("pep.nextEmpty")) + '</p>';
    (state.peptides || []).forEach(function (p) {
      var keys = [], cursor = L.todayKey();
      for (var i = 0; i < 4; i++) {
        var k = L.nextDoseKey(p, cursor);
        if (!k) break;
        keys.push(k);
        cursor = L.addDays(k, 1);
      }
      html += '<div class="listRow"><span class="mealDot" style="background:' + esc(p.color) + '"></span>' +
        '<span class="grow">' + esc(p.name) + "</span><span class='hint'>" +
        (keys.length ? keys.map(function (k) { return dayLabel(k) + " " + k.slice(8) + "/" + k.slice(5, 7); }).join(" · ") : tr("pep.noDaysShort")) +
        (p.time ? " · " + esc(p.time) : "") + "</span></div>";
      if (keys[0] === L.todayKey()) {
        var ds = window.FitHealth.dayStatus(p, L.todayKey());
        html += '<div class="row dueRow" data-due="' + p.id + '"><span class="hint">' + esc(tr("pep.dueToday", null, "Due today")) + (ds !== "none" ? ": " + esc(tr("pep.st." + ds, null, { taken: "Taken", not_taken: "Not taken", unknown: "Not sure" }[ds])) : "") + '</span>' +
          '<button class="pillBtn" data-nx="' + p.id + '|taken">' + esc(tr("pep.st.taken", null, "Taken")) + '</button>' +
          '<button class="pillBtn" data-nx="' + p.id + '|not_taken">' + esc(tr("pep.st.not_taken", null, "Not taken")) + '</button>' +
          '<button class="pillBtn" data-nx="' + p.id + '|unknown">' + esc(tr("pep.st.unknown", null, "Not sure")) + '</button></div>';
      }
    });
    html += "</div>";
    el.innerHTML = html;
    el.querySelectorAll("[data-nx]").forEach(function (b) { b.addEventListener("click", function () {
      var parts = b.getAttribute("data-nx").split("|"); var p = peptideById(parts[0]); if (!p) return;
      var now = new Date();
      window.FitHealth.addLog(p, { dateKey: L.todayKey(), time: ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2), status: parts[1] });
      save(); renderPepNext(); toast(tr("pep.toastLogged"));
    }); });
  }
  /* Appointments: the user's own appointment times, with an optional reminder. */
  function renderPepAppts() {
    var el = $("areaBody");
    var list = (state.appointments || []).slice().sort(function (a, b) { return (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1; });
    var html = '<div class="card"><h2>' + esc(tr("pep.apptTitle", null, "Add an appointment")) + '</h2><p class="hint">' + esc(tr("pep.apptHint", null, "Your own clinic or pharmacy visits. The app only reminds you of the time you enter.")) + '</p>' +
      '<div class="grid2"><label>' + esc(tr("pep.apptName", null, "What is it")) + '<input id="apTitle" type="text" maxlength="80"></label>' +
      '<label>' + esc(tr("pep.apptPlace", null, "Where (optional)")) + '<input id="apPlace" type="text" maxlength="120"></label>' +
      '<label>' + esc(tr("pep.apptDate", null, "Date")) + '<input id="apDate" type="date" value="' + L.todayKey() + '"></label>' +
      '<label>' + esc(tr("pep.timeLabel")) + '<input id="apTime" type="time" value="09:00"></label>' +
      '<label>' + esc(tr("pep.apptRemind", null, "Remind me")) + '<select id="apRemind"><option value="">' + esc(tr("task.remind.none", null, "No reminder")) + '</option><option value="0">' + esc(tr("pep.atTime", null, "At the time")) + '</option><option value="60">' + esc(tr("pep.1h", null, "1 hour before")) + '</option><option value="1440">' + esc(tr("pep.1d", null, "1 day before")) + '</option></select></label></div>' +
      '<div class="row"><button class="primaryBtn" id="apAdd">' + esc(tr("pep.apptSave", null, "Save appointment")) + '</button></div></div>';
    html += '<div class="card"><h2>' + esc(tr("pep.apptList", null, "Your appointments")) + '</h2>' + (list.length ? list.map(function (a) {
      return '<div class="listRow"><span class="grow"><b>' + esc(a.title) + '</b><br><span class="hint">' + esc(a.date) + (a.time ? " " + esc(a.time) : "") + (a.place ? " · " + esc(a.place) : "") +
        (a.remindMin != null ? " · " + esc(tr("pep.reminderOn", null, "reminder on")) : "") + '</span></span><button class="miniBtn" data-delap="' + esc(a.id) + '">' + esc(tr("common.remove")) + '</button></div>';
    }).join("") : '<p class="hint">' + esc(tr("pep.apptNone", null, "No appointments yet.")) + '</p>') + '</div>';
    el.innerHTML = html;
    $("apAdd").addEventListener("click", function () {
      var a = { title: $("apTitle").value, date: $("apDate").value, time: $("apTime").value };
      var v = window.FitHealth.validateAppointment(a);
      if (!v.ok) { toast(v.errors.title ? tr("pep.toastApptName", null, "Name the appointment first.") : tr("pep.toastApptWhen", null, "Pick a date and time.")); return; }
      state.appointments = state.appointments || [];
      state.appointments.push({ id: "appt." + Date.now(), title: window.FitHealth.clean(a.title, 80), date: a.date, time: a.time, place: window.FitHealth.clean($("apPlace").value, 120), remindMin: $("apRemind").value === "" ? null : Number($("apRemind").value) });
      save(); renderPepAppts(); toast(tr("pep.apptSaved", null, "Appointment saved."));
      if ($("apRemind").value !== "" && !FitRemind.available()) toast(tr("rem.webNote", null, "Reminders show inside the app on this device. Phone alerts need the iPhone or Android app."));
    });
    el.querySelectorAll("[data-delap]").forEach(function (b) { b.addEventListener("click", function () {
      state.appointments = (state.appointments || []).filter(function (a) { return a.id !== b.getAttribute("data-delap"); }); save(); renderPepAppts();
    }); });
  }
  /* Export and erase health data (owner controls). */
  function renderHealthData(el) {
    var box = document.createElement("div"); box.className = "card";
    box.innerHTML = '<h2>' + esc(tr("pep.dataTitle", null, "Your health data")) + '</h2><p class="hint">' + esc(tr("pep.dataHint", null, "It stays yours. Download a copy any time, or erase it from this device and your account.")) + '</p>' +
      '<div class="row"><button class="pillBtn" id="hxExport">' + esc(tr("pep.export", null, "Download my health data")) + '</button><button class="pillBtn" id="hxDelete">' + esc(tr("pep.eraseAll", null, "Erase all health data")) + '</button></div><div id="hxConfirm"></div>';
    el.appendChild(box);
    $("hxExport").addEventListener("click", function () {
      var data = JSON.stringify(window.FitHealth.exportHealth(state, new Date().toISOString()), null, 2);
      try { var url = URL.createObjectURL(new Blob([data], { type: "application/json" })); var a = document.createElement("a"); a.href = url; a.download = "fit-hard-health-export.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000); toast(tr("pep.exported", null, "Your file is ready.")); }
      catch (e) { toast(tr("pep.exportFail", null, "Could not make the file. Try again.")); }
    });
    $("hxDelete").addEventListener("click", function () {
      $("hxConfirm").innerHTML = '<p class="hint">' + esc(tr("pep.eraseAsk", null, "This removes every medication, dose log, change history and appointment. It cannot be undone.")) + '</p><div class="row"><button class="primaryBtn" id="hxYes">' + esc(tr("pep.eraseYes", null, "Yes, erase it")) + '</button><button class="pillBtn" id="hxNo">' + esc(tr("common.cancel", null, "Cancel")) + '</button></div>';
      $("hxNo").addEventListener("click", function () { $("hxConfirm").innerHTML = ""; });
      $("hxYes").addEventListener("click", function () { state.peptides = []; state.appointments = []; save(); renderPepList(); toast(tr("pep.erased", null, "Health data erased.")); });
    });
  }

  function renderMeals(subId) {
    if (subId === "meal-recipes") renderRecipes();
    else if (subId === "meal-fridge") renderFridge();
    else if (subId === "meal-treats") renderTreats();
    else if (subId === "meal-groceries") renderGroceries();
    else renderPlan();
  }

  /* --- Today --- */
  /* --- Wally, your guide (v2): the Lab's simple-flat art of
     record via window.Wally (wally.js). Never sad, never a
     coach; rest is his favourite state. He can rest from
     Settings. The user's companion name lives in settings. */
  function companionName() {
    var n = state.settings && state.settings.companionName;
    return (typeof n === "string" && n.trim()) ? n.trim() : "Wally";
  }
  function guideOn() {
    state.settings = state.settings || {};
    /* An old guide-off choice (from the retired guide) is
       respected once, then lives under the new key. */
    if (state.settings.wallyOff === undefined && state.settings.mossOff !== undefined)
      state.settings.wallyOff = !!state.settings.mossOff;
    return !state.settings.wallyOff;
  }
  /* Blanket colour (Lab pack customisation, light): Sage,
     Mist, Tint or Taupe. The choice is user data; it tints
     his speech bubble frame + the picker. The art itself is
     the Lab's; per-colour art variants are a Lab make. */
  var BLANKETS = { sage: "#52695A", mist: "#A9BFA5", tint: "#DCE7D8", taupe: "#AC9278" };
  function blanketColor() {
    var b = state.settings && state.settings.blanketColor;
    return BLANKETS[b] ? b : "sage";
  }
  function wallyWrap(pose, bubble, size) {
    if (!window.Wally) return "";
    return '<div class="wallyWrap">' + window.Wally.img(pose, size || 72) +
      (bubble ? '<div class="wallyBubble" style="border-color:' + BLANKETS[blanketColor()] + '">' + esc(bubble) + "</div>" : "") + "</div>";
  }
  /* Wally greets the user by name when the profile carries
     one (her ruling, 15 Oct 2026); his locked line follows. */
  function wallyWelcomeLine() {
    var nm = state.profile && state.profile.name ? String(state.profile.name).trim() : "";
    return nm ? tr("today.hiName", { name: nm }) + " " + wallyLine("welcome") : wallyLine("welcome");
  }
  function renderWallyCheckin() {
    var spot = $("wallySpot"); if (!spot) return;
    if (!guideOn() || !window.Wally) { spot.innerHTML = ""; return; }
    var level = state.checkins[L.todayKey()];
    if (level === "bad") spot.innerHTML = wallyWrap("soft", wallyLine("soft"));
    else if (level === "great") spot.innerHTML = wallyWrap("bright", wallyLine("bright"));
    else if (level === "ok") spot.innerHTML = wallyWrap("welcome", null);
    else spot.innerHTML = wallyWrap("welcome", wallyWelcomeLine());
  }
  var wallyFloatTimer = null;
  function showWallyCelebration(kind) {
    if (!guideOn() || !window.Wally) return;
    if (state.settings && state.settings.noCelebrate) return;
    state.settings = state.settings || {};
    state.settings.wally = state.settings.wally || {};
    if (state.settings.wally[kind]) return;
    state.settings.wally[kind] = true; save();
    var bad = state.checkins[L.todayKey()] === "bad";
    var bubble = kind === "week" ? wallyLine("celebrateWeek") :
      bad ? wallyLine("tea") : wallyLine("celebrateFirst");
    var box = $("wallyFloat");
    box.innerHTML = wallyWrap(bad ? "rough" : "celebrate", bubble, 64) + '<button class="miniBtn wallyX" id="wallyX">' + esc(tr("common.close")) + '</button>';
    box.classList.remove("hidden");
    $("wallyX").addEventListener("click", function () { box.classList.add("hidden"); });
    if (wallyFloatTimer) clearTimeout(wallyFloatTimer);
    wallyFloatTimer = setTimeout(function () { box.classList.add("hidden"); }, 7000);
  }

  /* --- THE GUIDE, ROUND 2 (readiness loop, spec of record):
     guidance just in time, one callout at a time, never
     stacked. Three parts, all riding the existing Wally
     machinery and art: the Getting Started checklist on Today
     (ticks read real state, dismissal is forever), one coach
     mark per point of use (a per-area seen flag in settings),
     and "Show the guide again" in Settings, which resets the
     tour, the marks and the checklist for a fresh walk. The
     guide NEVER writes user data: its flags live in settings
     beside tourSeen, and replaying it deletes nothing the
     user entered. Words EN only while the Spanish hold
     stands (the ES tables carry the same keys, saved). --- */
  function coachSeenMap() {
    state.settings = state.settings || {};
    if (!state.settings.coachSeen || typeof state.settings.coachSeen !== "object") state.settings.coachSeen = {};
    return state.settings.coachSeen;
  }
  var COACH_LINES = { "meal-plan": "coach.meal-plan", "meal-treats": "coach.meal-treats",
    "gym-routines": "coach.gym-routines", "gym-session": "coach.gym-session",
    "gym-machine": "coach.gym-machine", "calendar": "coach.calendar",
    "peptides": "coach.peptides", "plans": "coach.plans" };
  function coachKeyFor(areaId, subId) {
    if (areaId === "meals") return subId === "meal-plan" ? "meal-plan" : (subId === "meal-treats" ? "meal-treats" : null);
    if (areaId === "gym") return (subId === "gym-routines" || subId === "gym-session" || subId === "gym-machine") ? subId : null;
    if (areaId === "calendar") return "calendar";
    if (areaId === "peptides") return "peptides";
    return null;
  }
  function renderCoachMark(key, spotId) {
    var spot = $(spotId || "coachSpot"); if (!spot) return;
    spot.innerHTML = "";
    if (!key || !authUser || !guideOn() || !window.Wally) return;
    if (coachSeenMap()[key]) return;
    spot.innerHTML = '<div class="card coachCard">' + wallyWrap("welcome", tr(COACH_LINES[key]), 56) +
      '<div class="row"><button class="primaryBtn" id="coachGot">' + esc(tr("coach.got")) + "</button></div></div>";
    var b = $("coachGot");
    if (b) b.addEventListener("click", function () { coachSeenMap()[key] = true; save(); spot.innerHTML = ""; });
  }
  function gsRows() {
    var today = L.todayKey();
    var p = state.profile || {};
    var split = L.areasForNeeds(p.setupDone ? (p.needs || []) : []);
    var rows = [];
    if (!p.setupDone) rows.push({ id: "setup", label: tr("gs.setup"), done: false });
    rows.push({ id: "checkin", label: tr("gs.checkin"), done: !!((state.checkins || {})[today]) });
    if (split.active.indexOf("meals") !== -1) {
      var entry = (state.plan || {})[mpKey(today)] || {};
      rows.push({ id: "meals", label: tr("gs.meals"), done: !!(entry.breakfast || entry.lunch || entry.dinner) });
      rows.push({ id: "water", label: tr("gs.water"), done: !!((state.settings || {}).waterGoalPicked) });
    }
    if (split.active.indexOf("gym") !== -1) rows.push({ id: "gym", label: tr("gs.gym"), done: !!(((state.routines || []).length) || ((state.sessions || []).length)) });
    return rows;
  }
  function gsAction(id) {
    if (id === "setup") { openSetup(); return; }
    if (id === "checkin") { var c = $("checkinCard"); if (c && c.scrollIntoView) c.scrollIntoView(); return; }
    if (id === "meals" || id === "water") { openArea("meals", "meal-plan"); return; }
    if (id === "gym") { openArea("gym", "gym-routines"); return; }
  }
  function renderChecklist() {
    var card = $("gsCard"); if (!card) return;
    if (!authUser || !guideOn() || (state.settings && state.settings.checklistDismissed)) { card.hidden = true; card.innerHTML = ""; return; }
    var rows = gsRows();
    var allDone = rows.length > 0 && rows.every(function (r) { return r.done; });
    card.hidden = false;
    if (allDone) {
      card.innerHTML = (window.Wally ? wallyWrap("celebrate", tr("gs.done"), 56) : "<p>" + esc(tr("gs.done")) + "</p>") +
        '<div class="row"><button class="primaryBtn" id="gsDoneClose">' + esc(tr("tour.doneBtn")) + "</button></div>";
      var dc = $("gsDoneClose");
      if (dc) dc.addEventListener("click", function () { state.settings = state.settings || {}; state.settings.checklistDismissed = true; save(); renderChecklist(); });
      return;
    }
    card.innerHTML = '<div class="gsHead">' + (window.Wally ? window.Wally.img("welcome", 48) : "") + "<div><h2>" + esc(tr("gs.title")) + '</h2><p class="hint">' + esc(tr("gs.sub")) + "</p></div>" +
      '<button class="reofferXBtn" id="gsDismiss" aria-label="Close">✕</button></div>' +
      rows.map(function (r) { return '<button class="gsRow' + (r.done ? " done" : "") + '" data-gs="' + r.id + '"' + (r.done ? " disabled" : "") + '><span class="gsTick">' + (r.done ? "✓" : "○") + '</span><span class="grow">' + esc(r.label) + "</span></button>"; }).join("");
    var dx = $("gsDismiss");
    if (dx) dx.addEventListener("click", function () { state.settings = state.settings || {}; state.settings.checklistDismissed = true; save(); renderChecklist(); });
    card.querySelectorAll("[data-gs]").forEach(function (b) { b.addEventListener("click", function () { gsAction(b.getAttribute("data-gs")); }); });
  }
  function showGuideAgain() {
    if (!guideOn()) { toast(tr("tour.tResting", { name: companionName() })); return; }
    state.settings = state.settings || {};
    state.settings.tourSeen = false;
    state.settings.coachSeen = {};
    state.settings.checklistDismissed = false;
    save();
    replayTour();
  }

  function renderCheckin() {
    var today = L.todayKey();
    var level = state.checkins[today];
    $("checkinRow").innerHTML = D.CHECKINS.map(function (c) {
      return '<button class="checkinBtn' + (level === c.id ? " active" : "") + '" data-level="' + c.id + '">' + esc(tr("checkin." + c.id, null, c.label)) + "</button>";
    }).join("");
    document.querySelectorAll(".checkinBtn").forEach(function (b) {
      b.addEventListener("click", function () {
        var chosenLevel = b.getAttribute("data-level"), todayKey = L.todayKey();
        state.checkins[todayKey] = chosenLevel;
        var currentPlan = state.plan[mpKey(todayKey)] || {};
        if (chosenLevel === "bad" && !currentPlan.breakfast && !currentPlan.lunch && !currentPlan.dinner) {
          var gentlePlan = mealPlanForDay("bad", []);
          if (gentlePlan) state.plan[mpKey(todayKey)] = gentlePlan;
        }
        save(); renderToday();
        var c = D.CHECKINS.filter(function (x) { return x.id === chosenLevel; })[0];
        toast(tr("checkin." + c.id + "Hint", null, c.hint));
      });
    });
    var cur = D.CHECKINS.filter(function (x) { return x.id === level; })[0];
    $("checkinHint").textContent = cur ? tr("checkin." + cur.id + "Hint", null, cur.hint) : tr("checkin.none");
    renderWallyCheckin();
  }
  /* ================= PHASE 1: ONE DAY PLAN + PRIMARY TABS =================
     One chronological list for today, built only from records the
     user already has (planned meals, routines due, to-dos, dose
     reminders the user entered). Nothing is invented, nothing is
     labelled late: undone items simply wait. */
  function timeOf(t) { return /^\d{2}:\d{2}$/.test(String(t || "")) ? t : ""; }
  function dayPlanItems(iso) {
    var items = [];
    var entry = state.plan[mpKey(iso)] || {};
    ["breakfast", "lunch", "dinner"].forEach(function (m) {
      var r = entry[m] ? recipeById(entry[m]) : null;
      if (!r) return;
      var meta = (MD.MEALS && MD.MEALS[m]) || {};
      items.push({ kind: "meal", id: "meal." + m, time: timeOf(meta.defaultTime), label: recName(r),
        sub: tr("meal." + m, null, meta.label || m), done: !!(state.eaten || {})[iso + "." + m], eatKey: iso + "." + m,
        cta: (state.eaten || {})[iso + "." + m] ? tr("today.undo", null, "Undo") : tr("today.eaten", null, "Eaten") });
    });
    (state.routines || []).forEach(function (r) {
      if (!L.routineDueOn(r, iso)) return;
      var done = (state.sessions || []).some(function (x) { return x.dateKey === iso && x.routineId === r.id && x.status === "done"; });
      var live = (state.sessions || []).some(function (x) { return x.routineId === r.id && x.status === "active"; });
      items.push({ kind: "routine", id: "routine." + r.id, time: timeOf(r.time), label: r.name,
        sub: tr("nav.gym", null, "Gym"), done: done, area: "gym", subId: "gym-session",
        cta: live ? tr("today.resumeWorkout", null, "Resume") : tr("today.startWorkout", null, "Start") });
    });
    L.todosOn(state.todos, iso).forEach(function (t) {
      items.push({ kind: "todo", id: "todo." + t.id, time: timeOf(t.time), label: t.title, sub: tr("today.task", null, "Task"),
        done: t.status === "done", todoId: t.id, cta: t.status === "done" ? tr("today.undo", null, "Undo") : tr("today.markDone", null, "Done") });
    });
    var doses = L.planReminders(state, iso).filter(function (r) { return r.kind === "dose" && r.key === iso; });
    doses.forEach(function (r) {
      var pep = (state.peptides || []).filter(function (x) { return x.id === r.ref; })[0];
      var done = !!(pep && (pep.log || []).some(function (lg) { return lg.dateKey === iso; }));
      items.push({ kind: "dose", id: "dose." + r.ref, time: timeOf(r.time), label: r.name,
        sub: tr("today.doseReminder", null, "Your reminder"), done: done, area: "peptides", subId: "pep-log",
        cta: tr("today.openLog", null, "Open log") });
    });
    (state.habits || []).forEach(function (h) {
      items.push({ kind: "habit", id: "habit." + h.id, time: "", label: h.name, sub: tr("cal.habits", null, "Habit"),
        done: !!(h.days && h.days[iso]), habitId: h.id, cta: (h.days && h.days[iso]) ? tr("today.undo", null, "Undo") : tr("today.markDone", null, "Done") });
    });
    items.sort(function (a, b) {
      var ta = a.time || "99:99", tb = b.time || "99:99";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return 0;
    });
    return items;
  }
  function renderDayPlan() {
    var list = $("dayTimeline"); if (!list) return;
    var iso = L.todayKey();
    var items = dayPlanItems(iso);
    var empty = $("dayPlanEmpty"), nextBox = $("nextStep");
    var open = items.filter(function (x) { return !x.done; });
    list.innerHTML = items.map(function (it, i) {
      return '<li class="dayItem k-' + it.kind + (it.done ? " isDone" : "") + '" data-i="' + i + '">' +
        '<span class="dayTime">' + esc(it.time || tr("today.anytime", null, "Anytime")) + "</span>" +
        '<span class="dayMain"><b>' + esc(it.label) + "</b><small>" + esc(it.sub) + (it.done ? " · " + esc(tr("today.done", null, "Done")) : "") + "</small></span>" +
        '<button type="button" class="pillBtn dayAct" data-act="' + i + '">' + esc(it.cta) + "</button></li>";
    }).join("");
    if (!items.length) {
      empty.hidden = false;
      empty.textContent = tr("today.planEmpty", null, "Nothing is planned for today. Rest is a fine plan. Add a meal, a workout or a task whenever you like.");
    } else { empty.hidden = true; empty.textContent = ""; }
    if (open.length) {
      var n = open[0];
      nextBox.hidden = false;
      nextBox.innerHTML = '<span class="nextLbl">' + esc(tr("today.nextStep", null, "Next step")) + "</span><b>" + esc(n.label) + "</b>" +
        (n.time ? "<small>" + esc(n.time) + "</small>" : "");
    } else if (items.length) {
      nextBox.hidden = false;
      nextBox.innerHTML = '<span class="nextLbl">' + esc(tr("today.allDone", null, "All done for today. Well done.")) + "</span>";
    } else { nextBox.hidden = true; nextBox.innerHTML = ""; }
    list.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        var it = items[Number(b.getAttribute("data-act"))]; if (!it) return;
        if (it.eatKey) { state.eaten = state.eaten || {}; if (state.eaten[it.eatKey]) delete state.eaten[it.eatKey]; else state.eaten[it.eatKey] = true; save(); renderToday(); return; }
        if (it.todoId) { state.todos.forEach(function (t) { if (t.id === it.todoId) t.status = t.status === "done" ? "open" : "done"; }); save(); renderToday(); return; }
        if (it.habitId) { state.habits.forEach(function (h) { if (h.id === it.habitId) { h.days = h.days || {}; if (h.days[iso]) delete h.days[iso]; else h.days[iso] = true; } }); save(); renderToday(); return; }
        if (it.area) openArea(it.area, it.subId);
      });
    });
  }
  function renderQuickActions() {
    var box = $("quickActions"); if (!box) return;
    var acts = [
      { id: "water", label: tr("today.qaWater", null, "+ Glass of water"), go: function () {
          var today = L.todayKey(); state.water = state.water || {}; state.waterTaps = state.waterTaps || {};
          state.waterTaps[today] = state.waterTaps[today] || []; state.waterTaps[today].push(250);
          state.water[today] = (state.water[today] || 0) + 250; save(); renderPlan(); renderChallenge();
          toast(tr("today.waterAdded", null, "Added 250 ml. Undo is on the Food tab.")); } },
      { id: "workout", label: tr("today.qaWorkout", null, "Start a workout"), go: function () { switchTab("train", "gym-session"); } },
      { id: "meals", label: tr("today.qaMeals", null, "Plan meals"), go: function () { switchTab("food", "meal-plan"); } },
      { id: "task", label: tr("today.qaTask", null, "Add a task"), go: function () { switchTab("calendar", "cal-todos"); } }
    ];
    box.innerHTML = acts.map(function (a) { return '<button type="button" class="pillBtn" data-qa="' + a.id + '">' + esc(a.label) + "</button>"; }).join("");
    box.querySelectorAll("[data-qa]").forEach(function (b, i) { b.addEventListener("click", acts[i].go); });
  }

  /* Primary tabs: Today, Food, Train, Calendar, More. Each tab keeps
     the last section the user opened, and every older area (including
     Peptides, now "Health tracker") stays reachable. */
  var TAB_AREA = { food: "meals", train: "gym", calendar: "calendar" };
  var lastSub = {};
  function tabForView(name) {
    if (name === "today") return "today";
    if (name === "area") {
      if (currentArea === "meals") return "food";
      if (currentArea === "gym") return "train";
      if (currentArea === "calendar") return "calendar";
      return "more";
    }
    return "more";
  }
  function markTab(name) {
    var t = tabForView(name);
    document.querySelectorAll("#tabBar .tabBtn").forEach(function (b) {
      var on = b.getAttribute("data-tab") === t;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }
  function switchTab(tab, subId) {
    if (tab === "today") { showView("today"); renderToday(); return; }
    if (tab === "more") { showView("more"); renderMore(); return; }
    var areaId = TAB_AREA[tab], a = areaById(areaId);
    if (!a) return;
    openArea(areaId, subId || lastSub[areaId] || a.subs[0].id);
  }
  function renderSubTabs(a, activeId) {
    var nav = $("subTabs"); if (!nav) return;
    nav.innerHTML = a.subs.map(function (s) {
      var on = s.id === activeId;
      return '<button type="button" class="subTab' + (on ? " active" : "") + '" data-subtab="' + s.id + '"' + (on ? ' aria-current="true"' : "") + ">" +
        esc(tr("sub." + s.id, null, s.label)) + "</button>";
    }).join("");
    nav.querySelectorAll("[data-subtab]").forEach(function (b) {
      b.addEventListener("click", function () { openArea(a.id, b.getAttribute("data-subtab")); });
    });
  }
  /* ================= PROGRESS (Phase 5) =================
     Optional, private, neutral. Totals only grow; a quiet week is never a loss; body numbers carry no
     good/bad colour; every part can be hidden, exported or deleted. */
  function progPrefs() { state.progressPrefs = state.progressPrefs || { off: false, hideBody: false }; return state.progressPrefs; }
  function downloadFile(name, text, mime) {
    var blob = new Blob([text], { type: mime }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }
  function milestoneName(id) {
    var N = { first_session: "Your first workout", first_log: "First set logged", sessions_5: "5 workouts", sessions_10: "10 workouts", sessions_25: "25 workouts", sessions_50: "50 workouts",
      first_pb: "A personal best", weeks_4: "4 active weeks", weeks_12: "12 active weeks", first_plan: "A full week of meals planned", first_rest: "Your first planned rest day" };
    return tr("prog.m." + id, null, N[id] || id);
  }
  function exName2(id) { var e = exerciseById(id); return e ? exName(e) : id; }
  function fmtSet(reps, w) { return reps + " " + tr("prog.reps", null, "reps") + (w ? " " + tr("prog.at", null, "at") + " " + w + " kg" : ""); }
  function weekSummaryText(s) {
    var bits = [s.sessions === 1 ? tr("prog.oneSession", null, "1 workout") : tr("prog.nSessions", { n: s.sessions }, s.sessions + " workouts")];
    bits.push(tr("prog.nActiveDays", { n: s.moveDays }, s.moveDays + " active days"));
    if (s.restDays) bits.push(s.restDays === 1 ? tr("prog.oneRest", null, "1 rest day") : tr("prog.nRest", { n: s.restDays }, s.restDays + " rest days"));
    return bits.join(" · ");
  }
  function progressOffCard() {
    return '<div class="card"><h2>' + esc(tr("sub.prog-overview", null, "Progress")) + '</h2><p>' + esc(tr("prog.offBody", null, "Progress tracking is turned off. Nothing is shown or counted on screen. Your data is kept until you delete it.")) + '</p>' +
      '<div class="row"><button class="primaryBtn" id="progOn">' + esc(tr("prog.turnOn", null, "Turn progress back on")) + "</button></div></div>";
  }
  function wireProgOn(el) { var b = el.querySelector("#progOn"); if (b) b.addEventListener("click", function () { progPrefs().off = false; save(); renderProgress(currentSub); renderToday(); }); }
  function renderProgress(subId) {
    var el = $("areaBody"); stopGymTimer();
    if (progPrefs().off) { el.innerHTML = progressOffCard(); wireProgOn(el); return; }
    if (subId === "prog-strength") return renderProgStrength(el);
    if (subId === "prog-body") return renderProgBody(el);
    if (subId === "prog-review") return renderProgReview(el);
    return renderProgOverview(el);
  }
  function renderProgOverview(el) {
    var P = window.FitProgress, today = L.todayKey(), wk = P.weeks(state, today, 8), cur = wk[wk.length - 1], fs = P.flexibleStreak(state, today), ms = P.milestones(state, today), pbs = P.recentBests(state, today, 21);
    var max = Math.max(1, Math.max.apply(null, wk.map(function (w) { return w.sessions; })));
    var html = '<div class="card"><h2>' + esc(tr("prog.thisWeek", null, "This week")) + '</h2><p class="bigLine" id="progWeek">' + esc(weekSummaryText(cur)) + "</p>" +
      (cur.planned ? '<p class="hint">' + esc(tr("prog.plannedN", { n: cur.planned }, "You planned " + cur.planned + " workouts a week. Fewer is fine too.")) + "</p>" : "") +
      (!cur.counted ? '<p class="hint">' + esc(tr("prog.freshWeek", null, "A fresh week. Your next step is ready when you are.")) + "</p>" : "") +
      '<div class="row"><button class="pillBtn" id="restToggle" aria-pressed="' + !!state.restDays[today] + '">' + esc(state.restDays[today] ? tr("prog.restOn", null, "Today is a rest day ✓") : tr("prog.restBtn", null, "Mark today as a rest day")) + "</button></div>" +
      '<p class="hint">' + esc(tr("prog.restHint", null, "Rest counts. It keeps your weeks going.")) + "</p></div>";
    html += '<div class="card"><h2>' + esc(tr("prog.journey", null, "Your journey")) + '</h2><p class="bigNum" id="activeWeeks">' + fs.activeWeeks + "</p><p>" + esc(tr("prog.activeWeeks", null, "active weeks so far. This number only goes up.")) + "</p>" +
      (fs.currentRun > 1 ? '<p class="hint">' + esc(tr("prog.run", { n: fs.currentRun }, fs.currentRun + " weeks in a row right now")) + (fs.bestRun > fs.currentRun ? " · " + esc(tr("prog.best", { n: fs.bestRun }, "your longest is " + fs.bestRun)) : "") + "</p>" : "") +
      (fs.returned ? '<p class="hint">' + esc(tr("prog.returned", null, "Good to have you back. Everything you did before still counts.")) + "</p>" : "") +
      '<div role="img" aria-label="' + esc(tr("prog.chartAria", null, "Workouts per week, last 8 weeks")) + ": " + wk.map(function (w) { return w.sessions; }).join(", ") + '"><div class="weekBars" aria-hidden="true">' +
      wk.map(function (w) { return '<span class="wkBar"><i style="height:' + Math.round((w.sessions / max) * 100) + '%"></i></span>'; }).join("") + "</div></div>" +
      '<p class="hint">' + esc(tr("prog.chartNote", null, "Last 8 weeks, oldest on the left.")) + "</p></div>";
    html += '<div class="card"><h2>' + esc(tr("prog.milestones", null, "Milestones")) + "</h2>" +
      (ms.earned.length ? '<ul class="plainList" id="msList">' + ms.earned.map(function (id) { return "<li>" + esc(milestoneName(id)) + "</li>"; }).join("") + "</ul>" : '<p class="hint">' + esc(tr("prog.noMs", null, "Your first one is a single workout away. No rush.")) + "</p>") +
      (ms.next ? '<p class="hint">' + esc(tr("prog.nextMs", null, "Next, whenever you like")) + ": " + esc(milestoneName(ms.next)) + "</p>" : "") + "</div>";
    html += '<div class="card"><h2>' + esc(tr("prog.pbs", null, "Personal bests")) + '</h2><p class="hint">' + esc(tr("prog.pbHint", null, "Compared only with your own earlier sets.")) + "</p>" +
      (pbs.length ? '<ul class="plainList" id="pbList">' + pbs.slice(-6).reverse().map(function (e) { return "<li><b>" + esc(exName2(e.exerciseId)) + "</b>: " + esc(fmtSet(e.reps, e.weightKg)) + " · " + esc(e.dateKey) + "</li>"; }).join("") + "</ul>" : '<p class="hint">' + esc(tr("prog.noPb", null, "Log your sets in a workout and your bests will show up here.")) + "</p>") + "</div>";
    html += '<div class="card"><h2>' + esc(tr("prog.yourData", null, "Your progress data")) + '</h2><div class="row"><button class="pillBtn" id="expJson">' + esc(tr("prog.expJson", null, "Export (JSON)")) + '</button><button class="pillBtn" id="expCsv">' + esc(tr("prog.expCsv", null, "Export (spreadsheet)")) + '</button><button class="pillBtn" id="progOff">' + esc(tr("prog.turnOff", null, "Turn progress off")) + "</button></div></div>";
    el.innerHTML = html;
    $("restToggle").addEventListener("click", function () { if (state.restDays[today]) delete state.restDays[today]; else state.restDays[today] = true; save(); renderProgOverview(el); renderToday(); });
    $("expJson").addEventListener("click", function () { downloadFile("fit-hard-progress.json", JSON.stringify(P.exportData(state, new Date().toISOString()), null, 2), "application/json"); });
    $("expCsv").addEventListener("click", function () { downloadFile("fit-hard-progress.csv", P.toCsv(state), "text/csv"); });
    $("progOff").addEventListener("click", function () { progPrefs().off = true; save(); renderProgress(currentSub); renderToday(); });
  }
  var progEx = null;
  function renderProgStrength(el) {
    var P = window.FitProgress, ids = P.loggedExercises(state);
    if (!ids.length) { el.innerHTML = '<div class="card"><h2>' + esc(tr("sub.prog-strength", null, "Strength")) + '</h2><p class="hint">' + esc(tr("prog.noStrength", null, "When you log reps and weight in a workout, your strength over time shows here.")) + "</p></div>"; return; }
    if (!progEx || ids.indexOf(progEx) === -1) progEx = ids[0];
    var ser = P.strengthSeries(state, progEx), hasW = ser.some(function (s) { return s.weightKg; });
    var vals = ser.map(function (s) { return hasW ? (s.weightKg || 0) : s.reps; }), mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    var pts = vals.map(function (v, i) { var x = ser.length === 1 ? 150 : 10 + (280 * i) / (ser.length - 1), y = mx === mn ? 40 : 70 - ((v - mn) / (mx - mn)) * 60; return x.toFixed(1) + "," + y.toFixed(1); }).join(" ");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("sub.prog-strength", null, "Strength")) + '</h2><label>' + esc(tr("prog.pickEx", null, "Exercise")) + '<select id="progEx">' + ids.map(function (id) { return '<option value="' + esc(id) + '"' + (id === progEx ? " selected" : "") + ">" + esc(exName2(id)) + "</option>"; }).join("") + "</select></label>" +
      '<svg class="sparkline" viewBox="0 0 300 80" role="img" aria-label="' + esc(tr("prog.sparkAria", { name: exName2(progEx), n: ser.length }, exName2(progEx) + ", " + ser.length + " sessions")) + '"><polyline fill="none" stroke="var(--sage)" stroke-width="3" points="' + pts + '"/>' + vals.map(function (v, i) { var p = pts.split(" ")[i].split(","); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="var(--sage)"/>'; }).join("") + "</svg>" +
      '<table class="dataTable"><caption class="srOnly">' + esc(exName2(progEx)) + '</caption><thead><tr><th scope="col">' + esc(tr("prog.date", null, "Date")) + '</th><th scope="col">' + esc(tr("prog.topSet", null, "Top set")) + "</th></tr></thead><tbody>" +
      ser.slice().reverse().slice(0, 20).map(function (s) { return "<tr><td>" + esc(s.dateKey) + "</td><td>" + esc(fmtSet(s.reps, s.weightKg)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    $("progEx").addEventListener("change", function () { progEx = $("progEx").value; renderProgStrength(el); });
  }
  var BODY_FIELDS = [["weightKg", "Weight (kg)"], ["waistCm", "Waist (cm)"], ["hipCm", "Hips (cm)"], ["chestCm", "Chest (cm)"], ["armCm", "Upper arm (cm)"], ["thighCm", "Thigh (cm)"]];
  function renderProgBody(el) {
    var P = window.FitProgress, pp = progPrefs();
    if (pp.hideBody) {
      el.innerHTML = '<div class="card"><h2>' + esc(tr("sub.prog-body", null, "Body")) + '</h2><p>' + esc(tr("prog.bodyHidden", null, "Body tracking is hidden. Nothing is shown here.")) + '</p><div class="row"><button class="primaryBtn" id="bodyShow">' + esc(tr("prog.bodyShow", null, "Show body tracking")) + "</button></div></div>";
      $("bodyShow").addEventListener("click", function () { pp.hideBody = false; save(); renderProgBody(el); });
      return;
    }
    var entries = (state.body || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var html = '<div class="card"><h2>' + esc(tr("sub.prog-body", null, "Body")) + '</h2><p class="hint">' + esc(tr("prog.bodyIntro", null, "Optional and private. These numbers are only a record. They say nothing about your worth, and you can skip any of them.")) + "</p>" +
      '<label>' + esc(tr("prog.date", null, "Date")) + '<input type="date" id="bdDate" value="' + L.todayKey() + '" max="' + L.todayKey() + '"></label><div class="grid2">' +
      BODY_FIELDS.map(function (f) { return '<label>' + esc(tr("prog.f." + f[0], null, f[1])) + '<input type="text" inputmode="decimal" autocomplete="off" id="bd_' + f[0] + '"></label>'; }).join("") + "</div>" +
      '<p class="hint err" id="bdErr" role="alert"></p><div class="row"><button class="primaryBtn" id="bdSave">' + esc(tr("prog.bodySave", null, "Save entry")) + '</button></div></div>';
    html += '<div class="card"><h2>' + esc(tr("prog.entries", null, "Your entries")) + "</h2>";
    if (!entries.length) html += '<p class="hint">' + esc(tr("prog.noEntries", null, "Nothing saved yet. That is completely fine.")) + "</p>";
    else {
      html += P.METRICS.map(function (m) { var s = P.bodySummary(entries, m); if (!s || s.count < 2) return ""; var f = BODY_FIELDS.filter(function (x) { return x[0] === m; })[0];
        return '<p class="hint">' + esc(tr("prog.f." + m, null, f[1])) + ": " + s.first.value + " → " + s.last.value + " (" + s.count + " " + esc(tr("prog.entriesWord", null, "entries")) + ")</p>"; }).join("");
      html += entries.slice(0, 60).map(function (e) {
        return '<div class="listRow"><span class="grow"><b>' + esc(e.date) + "</b><br><span class='hint'>" + BODY_FIELDS.filter(function (f) { return typeof e[f[0]] === "number"; }).map(function (f) { return esc(tr("prog.f." + f[0], null, f[1]).replace(/ \(.*\)/, "")) + " " + e[f[0]]; }).join(" · ") + "</span></span>" +
          '<button class="miniBtn" data-bdel="' + esc(e.id) + '" aria-label="' + esc(tr("prog.delEntryAria", { d: e.date }, "Remove entry from " + e.date)) + '">' + esc(tr("common.remove")) + "</button></div>"; }).join("");
    }
    html += '<div class="row"><button class="pillBtn" id="bodyHide">' + esc(tr("prog.bodyHide", null, "Hide body tracking")) + '</button>' + (entries.length ? '<button class="pillBtn" id="bodyWipe">' + esc(tr("prog.bodyWipe", null, "Delete all body entries")) + "</button>" : "") + '</div><p class="hint err" id="bodyAsk" hidden></p></div>';
    html += '<div class="card" id="photoCard"><h2>' + esc(tr("prog.photos", null, "Private photos")) + '</h2><p class="hint">' + esc(tr("prog.photoNote", null, "Photos stay on this device only. They are not uploaded, not backed up and not in exports. If you delete the app or clear browser data, they are gone.")) + "</p>" +
      (window.FitPhotos && window.FitPhotos.available() ? '<label>' + esc(tr("prog.addPhoto", null, "Add a progress photo")) + '<input type="file" id="phFile" accept="image/*"></label><p class="hint err" id="phErr" role="alert"></p><div id="phGrid" class="photoGrid"></div>' : '<p class="hint">' + esc(tr("prog.photoNA", null, "Photo storage is not available in this browser.")) + "</p>") + "</div>";
    el.innerHTML = html;
    $("bdSave").addEventListener("click", function () {
      var rec = { id: "body." + Date.now() + "." + Math.random().toString(36).slice(2, 6), date: $("bdDate").value || L.todayKey() }, any = false, err = "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.date) || rec.date > L.todayKey()) err = tr("prog.badDate", null, "Pick today or an earlier date.");
      BODY_FIELDS.forEach(function (f) {
        var raw = $("bd_" + f[0]).value.trim(); if (!raw) return;
        var v = P.parseMeasure(f[0], raw); if (v == null) err = err || tr("prog.badNum", { f: f[1] }, "Check " + f[1] + ": use a plain number like 72.5."); else { rec[f[0]] = v; any = true; }
      });
      if (!err && !any) err = tr("prog.needOne", null, "Add at least one number, or skip this for today.");
      if (err) { $("bdErr").textContent = err; return; }
      state.body.push(rec); save(); renderProgBody(el); toast(tr("prog.saved", null, "Saved"));
    });
    el.querySelectorAll("[data-bdel]").forEach(function (b) { b.addEventListener("click", function () { state.body = state.body.filter(function (e) { return e.id !== b.getAttribute("data-bdel"); }); save(); renderProgBody(el); }); });
    $("bodyHide").addEventListener("click", function () { pp.hideBody = true; save(); renderProgBody(el); });
    var bw = $("bodyWipe");
    if (bw) bw.addEventListener("click", function () {
      var ask = $("bodyAsk"); if (!ask.hidden) return; ask.hidden = false;
      ask.innerHTML = esc(tr("prog.wipeSure", null, "Delete every body entry? This cannot be undone.")) + ' <button type="button" class="pillBtn" id="wipeYes">' + esc(tr("prog.wipeYes", null, "Yes, delete")) + '</button> <button type="button" class="pillBtn" id="wipeNo">' + esc(tr("common.cancel", null, "Cancel")) + "</button>";
      $("wipeYes").addEventListener("click", function () { state.body = []; save(); renderProgBody(el); toast(tr("prog.deleted", null, "Deleted")); });
      $("wipeNo").addEventListener("click", function () { ask.hidden = true; ask.innerHTML = ""; bw.focus(); }); $("wipeYes").focus();
    });
    if (window.FitPhotos && window.FitPhotos.available()) {
      var drawPhotos = function () {
        window.FitPhotos.list("progress").then(function (xs) {
          var g = $("phGrid"); if (!g) return;
          if (!xs.length) { g.innerHTML = '<p class="hint">' + esc(tr("prog.noPhotos", null, "No photos saved.")) + "</p>"; return; }
          g.innerHTML = xs.map(function (x) { return '<figure class="phItem"><img alt="' + esc(tr("prog.photoAlt", { d: x.date }, "Progress photo from " + x.date)) + '" src="' + URL.createObjectURL(x.blob) + '"><figcaption>' + esc(x.date) + '</figcaption><button class="miniBtn" data-pdel="' + esc(x.id) + '" aria-label="' + esc(tr("prog.delPhotoAria", { d: x.date }, "Remove photo from " + x.date)) + '">' + esc(tr("common.remove")) + "</button></figure>"; }).join("") +
            '<div class="row"><button class="pillBtn" id="phWipe">' + esc(tr("prog.photoWipe", null, "Delete all photos")) + "</button></div>";
          g.querySelectorAll("[data-pdel]").forEach(function (b) { b.addEventListener("click", function () { window.FitPhotos.remove(b.getAttribute("data-pdel")).then(drawPhotos); }); });
          $("phWipe").addEventListener("click", function () { if (window.confirm(tr("prog.photoWipeSure", null, "Delete all progress photos from this device?"))) window.FitPhotos.clearCol("progress").then(drawPhotos); });
        }).catch(function () { var g = $("phGrid"); if (g) g.innerHTML = '<p class="hint">' + esc(tr("prog.photoNA", null, "Photo storage is not available in this browser.")) + "</p>"; });
      };
      drawPhotos();
      $("phFile").addEventListener("change", function () {
        var f = $("phFile").files && $("phFile").files[0]; if (!f) return; $("phErr").textContent = "";
        window.FitPhotos.prepare(f, 900).then(function (blob) { return window.FitPhotos.add("progress", blob, { date: L.todayKey() }); }).then(function () { $("phFile").value = ""; drawPhotos(); toast(tr("prog.photoSaved", null, "Photo saved on this device")); })
          .catch(function (e) { $("phErr").textContent = tr("prog.photoBad", null, "That file could not be used. Try a normal photo (JPG or PNG)."); });
      });
    }
  }
  function renderProgReview(el) {
    var P = window.FitProgress, today = L.todayKey(), r = P.weeklyReview(state, today), saved = (state.reflections || {})[r.week] || { easier: "", change: "", next: "" };
    var stepText = { build_routine: tr("prog.stepBuild", null, "If you like, build a small routine to have a plan ready."), one_small: tr("prog.stepSmall", null, "Pick one small thing this week. A short walk counts."),
      next_session: tr("prog.stepNext", null, "Your next planned workout is a good next step, at whatever size feels right."), enjoy: tr("prog.stepEnjoy", null, "You did what you set out to do. Enjoy the rest of the week.") }[r.step];
    var past = Object.keys(state.reflections || {}).sort().reverse().filter(function (k) { return k !== r.week; }).slice(0, 5);
    el.innerHTML = '<div class="card"><h2>' + esc(tr("sub.prog-review", null, "Weekly review")) + '</h2><p class="bigLine">' + esc(weekSummaryText(r.thisWeek)) + '</p><p class="hint">' + esc(tr("prog.lastWeek", null, "Last week")) + ": " + esc(weekSummaryText(r.lastWeek)) + "</p>" +
      '<p id="revStep"><b>' + esc(tr("prog.oneStep", null, "One suggested next step")) + ":</b> " + esc(stepText) + "</p></div>" +
      '<div class="card"><h2>' + esc(tr("prog.reflect", null, "A quick look back")) + '</h2><p class="hint">' + esc(tr("prog.reflectHint", null, "Optional. Skip any of these. It stays private to you.")) + "</p>" +
      '<label>' + esc(tr("prog.q1", null, "What felt easier?")) + '<textarea id="rf1" rows="2" maxlength="300">' + esc(saved.easier) + '</textarea></label>' +
      '<label>' + esc(tr("prog.q2", null, "What would you change?")) + '<textarea id="rf2" rows="2" maxlength="300">' + esc(saved.change) + '</textarea></label>' +
      '<label>' + esc(tr("prog.q3", null, "Your own next step")) + '<textarea id="rf3" rows="2" maxlength="300">' + esc(saved.next) + '</textarea></label>' +
      '<div class="row"><button class="primaryBtn" id="rfSave">' + esc(tr("prog.rfSave", null, "Save reflection")) + '</button></div></div>' +
      (past.length ? '<div class="card"><h2>' + esc(tr("prog.pastRef", null, "Earlier reflections")) + "</h2>" + past.map(function (k) { var v = state.reflections[k]; return '<p><b>' + esc(k) + "</b><br>" + [v.easier, v.change, v.next].filter(Boolean).map(esc).join("<br>") + "</p>"; }).join("") + "</div>" : "");
    $("rfSave").addEventListener("click", function () {
      state.reflections[r.week] = { easier: P.cleanText($("rf1").value), change: P.cleanText($("rf2").value), next: P.cleanText($("rf3").value) };
      save(); toast(tr("prog.saved", null, "Saved"));
    });
  }
  function renderMore() {
    var box = $("moreList"); if (!box) return;
    var rows = [
      { id: "health", ico: "#i-pep", title: tr("more.health", null, "Health tracker"), sub: tr("more.healthSub", null, "Your own prescribed schedule, logs and reminders. Record-keeping only."), go: function () { var a = areaById("peptides"); openArea("peptides", lastSub.peptides || a.subs[0].id); } },
      { id: "progress", ico: "#i-star", title: tr("more.progress", null, "Progress"), sub: tr("more.progressSub", null, "Your journey, personal bests and weekly look-back. Optional and private."), go: function () { openArea("progress", lastSub.progress || "prog-overview"); } },
      { id: "setup", ico: "#i-star", title: tr("nav.setupGuide", null, "Setup guide"), sub: tr("more.setupSub", null, "Change your goals, foods and tools."), go: function () { openSetup(); } },
      { id: "settings", ico: "#i-gear", title: tr("nav.settings", null, "Settings"), sub: tr("more.settingsSub", null, "Account, look, reminders and your data."), go: function () { showView("settings"); renderSettings(); } }
    ];
    box.innerHTML = rows.map(function (r) {
      return '<button type="button" class="moreRow" data-more="' + r.id + '"><span class="navIcon icInk"><svg class="ic" aria-hidden="true"><use href="' + r.ico + '"/></svg></span>' +
        '<span class="moreTxt"><b>' + esc(r.title) + "</b><small>" + esc(r.sub) + '</small></span><svg class="ic chev" aria-hidden="true"><use href="#i-chev"/></svg></button>';
    }).join("");
    box.querySelectorAll("[data-more]").forEach(function (b, i) { b.addEventListener("click", rows[i].go); });
  }
  document.querySelectorAll("#tabBar .tabBtn").forEach(function (b) {
    b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
  });

  function renderProgressCard() {
    var c = $("progressCard"); if (!c) return;
    if (progPrefs().off || !window.FitProgress) { c.hidden = true; return; }
    c.hidden = false;
    var P = window.FitProgress, w = P.weekSummary(state, P.weekStart(L.todayKey()));
    $("progressLine").textContent = w.counted ? weekSummaryText(w) : tr("prog.freshWeek", null, "A fresh week. Your next step is ready when you are.");
  }
  function renderToday() {
    var p = state.profile;
    $("stripHi").textContent = p && p.name ? tr("today.hiPlain", { name: p.name }) : "";
    $("todayTitle").textContent = p && p.name ? tr("today.hiPlain", { name: p.name }) : tr("nav.today");
    renderCheckin();
    renderChecklist();
    renderProgressCard();
    var budget = L.estimateBudget(p || {});
    var level = state.checkins[L.todayKey()] || "ok";
    if (budget) {
      var day = L.mealBudgetFor(level, budget);
      $("budgetCard").hidden = false;
      $("budgetLine").textContent = tr("today.budget", { kcal: day.meals }) +
        (day.treatRoom ? tr("today.budgetTreat", { kcal: day.treatRoom }) : "");
      var planned = 0, entry = state.plan[mpKey(L.todayKey())] || {};
      ["breakfast", "lunch", "dinner"].forEach(function (m) { var r = entry[m] ? recipeById(entry[m]) : null; var kk = kcalOf(r); if (kk) planned += kk; });
      $("budgetNote").textContent = tr("legal.budgetNote") +
        (planned ? tr("today.planned", { kcal: planned }) : "");
      var planAction = $("todayPlanAction");
      if (planAction) {
        if (level === "bad" && planned > day.meals) {
          planAction.hidden = false;
          planAction.innerHTML = '<p class="hint">' + esc(tr("today.planActionNote")) + '</p>' +
            '<button type="button" class="pillBtn" id="todayPlanBadBtn">' + esc(tr("today.planReplaceBtn")) + '</button>';
          $("todayPlanBadBtn").addEventListener("click", function () {
            var freshPlan = mealPlanForDay("bad", []);
            if (!freshPlan) { toast(tr("today.planUnavailable")); return; }
            state.plan[mpKey(L.todayKey())] = freshPlan;
            save(); renderToday(); toast(tr("today.planUpdated"));
          });
        } else { planAction.hidden = true; planAction.innerHTML = ""; }
      }
    } else { $("budgetCard").hidden = true; }
    var setUp = !!(p && p.setupDone);
    $("todayEmpty").hidden = setUp;
    var ew = $("emptyWally");
    if (ew) ew.innerHTML = !setUp && guideOn() && window.Wally ? wallyWrap("welcome", wallyLine("welcome"), 64) : "";
    renderDayPlan();
    renderQuickActions();
    renderChallenge();
  }

  /* --- Challenge card (build 17, Wave 1): three modes on the
     logic engine. A missed day is a calm gap, never a wipe.
     The strict restart (Hard only) moves only the count, and
     only by the user's own tap. --- */
  var chBuild = null, chEndArmed = false;
  function chTaskLabel(t) {
    if (t.kind === "habit") { var h = (state.habits || []).filter(function (x) { return x.id === t.id; })[0]; return h ? h.name : t.kind; }
    if (t.kind === "custom") return t.label || "";
    return tr("ch.task." + t.kind);
  }
  function chArchiveCurrent() {
    if (!state.challenge) return;
    state.challengePast = state.challengePast || [];
    state.challengePast.push(Object.assign({}, state.challenge, { endedISO: L.todayKey() }));
    state.challenge = null;
  }
  function chStart(mode, tasks, lengthDays, strict) {
    chArchiveCurrent();
    state.challenge = L.repairChallenge({ id: "ch." + L.todayKey() + "." + mode + "." + Date.now(),
      mode: mode, startISO: L.todayKey(), lengthDays: lengthDays, tasks: tasks, strict: !!strict });
    chBuild = null; chEndArmed = false;
    save(); renderChallenge();
  }
  function chDefaultTasks(mode) {
    var tasks = [{ kind: "workout" }, { kind: "meals" }, { kind: "water" }, { kind: "checkin" }];
    if (mode === "hard" && (state.peptides || []).length) tasks.push({ kind: "peptide" });
    return tasks;
  }
  function renderChallenge() {
    var box = $("challengeCard"); if (!box) return;
    var p = state.profile;
    if (!p || !p.setupDone || !authUser) { box.hidden = true; box.innerHTML = ""; return; }
    var tk = L.todayKey();
    var active = state.challenge || chBuild || ((state.water || {})[tk] || 0) > 0 || Object.keys(state.workouts || state.sessions || {}).length > 0;
    if (!active) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    var today = L.todayKey();
    var ch = state.challenge;
    if (chBuild) {
      var kinds = [["workout"], ["meals"], ["water"], ["checkin"]];
      if ((state.peptides || []).length) kinds.push(["peptide"]);
      var rows = kinds.map(function (k) {
        return '<label class="chTask"><input type="checkbox" data-chpick="' + k[0] + '"><span class="grow">' + esc(tr("ch.task." + k[0])) + "</span></label>";
      }).join("") + (state.habits || []).map(function (h) {
        return '<label class="chTask"><input type="checkbox" data-chpick="habit" data-chhabit="' + esc(h.id) + '"><span class="grow">' + esc(h.name) + "</span></label>";
      }).join("");
      box.innerHTML = '<p class="big">' + esc(tr("ch.pickTasks")) + "</p>" + rows +
        '<div class="grid2"><label>' + esc(tr("ch.days")) + '<input id="chDays" type="number" min="7" max="365" value="30"></label>' +
        "<label>" + esc(tr("ch.ownTask")) + '<input id="chOwn" type="text" placeholder="' + esc(tr("ch.ownTaskPh")) + '"></label></div>' +
        '<div class="row"><button class="pillBtn" id="chStartBtn">' + esc(tr("ch.startCustom")) + '</button>' +
        '<button class="pillBtn" id="chBackBtn">' + esc(tr("plan.backBtn")) + "</button></div>";
      $("chBackBtn").addEventListener("click", function () { chBuild = null; renderChallenge(); });
      $("chStartBtn").addEventListener("click", function () {
        var tasks = [];
        box.querySelectorAll("[data-chpick]").forEach(function (c) {
          if (!c.checked) return;
          var kind = c.getAttribute("data-chpick");
          tasks.push(kind === "habit" ? { kind: "habit", id: c.getAttribute("data-chhabit") } : { kind: kind });
        });
        var own = $("chOwn").value.trim();
        if (own) tasks.push({ kind: "custom", label: own });
        if (!tasks.length) { toast(tr("ch.needTask")); return; }
        var days = Math.round(Number($("chDays").value) || 30);
        chStart("custom", tasks, days, false);
      });
      return;
    }
    if (!ch) {
      box.innerHTML = '<p class="big">' + esc(tr("ch.title")) + '</p><p class="hint">' + esc(tr("ch.intro")) + "</p>" +
        [["hard", "ch.hard", "ch.hardLine"], ["steady", "ch.steady", "ch.steadyLine"], ["custom", "ch.custom", "ch.customLine"]].map(function (m) {
          return '<div class="chTask"><span class="grow"><strong>' + esc(tr(m[1])) + "</strong><br>" + esc(tr(m[2])) + '</span><button class="pillBtn" data-chmode="' + m[0] + '">' + esc(tr("ch.start")) + "</button></div>";
        }).join("");
      box.querySelectorAll("[data-chmode]").forEach(function (b) {
        b.addEventListener("click", function () {
          var mode = b.getAttribute("data-chmode");
          if (mode === "custom") { chBuild = { mode: "custom" }; renderChallenge(); return; }
          chStart(mode, chDefaultTasks(mode), 75, false);
        });
      });
      return;
    }
    var prog = L.challengeProgress(state, today);
    if (prog.finished) {
      box.innerHTML = '<p class="big">' + esc(tr("ch.title")) + '</p><p class="hint">' +
        esc(tr("ch.finished", { n: prog.daysDone, t: ch.lengthDays })) + "</p>" +
        '<div class="row"><button class="pillBtn" id="chAgainBtn">' + esc(tr("ch.again")) + "</button></div>";
      $("chAgainBtn").addEventListener("click", function () { chArchiveCurrent(); save(); renderChallenge(); });
      return;
    }
    var day = L.challengeDay(state, today);
    var strip = prog.days.filter(function (d) { return d.iso <= today; }).slice(-14).map(function (d) {
      return '<span class="chDot ' + d.state + '" title="' + d.iso + '"></span>';
    }).join("");
    var head = '<p class="big">' + esc(tr(ch.mode === "hard" ? "ch.hard" : ch.mode === "steady" ? "ch.steady" : "ch.custom")) + "</p>" +
      '<p class="hint">' + esc(tr("ch.dayOf", { d: prog.dayIndex, n: ch.lengthDays })) + " · " + esc(prog.daysDone === 1 ? tr("ch.oneDayDone") : tr("ch.daysDone", { n: prog.daysDone })) + "</p>" +
      '<div class="chDots">' + strip + "</div>";
    var softer = state.checkins[today] === "bad" ? '<p class="hint">' + esc(tr("ch.softer")) + "</p>" : "";
    var body = "";
    if (day.rest) {
      body = '<p class="hint">' + esc(tr("ch.restPlanned")) + "</p>" +
        '<div class="row"><button class="pillBtn" id="chUnrestBtn">' + esc(tr("ch.unrest")) + "</button></div>";
    } else {
      body = day.tasks.map(function (t) {
        var label = esc(chTaskLabel(t));
        if (t.satisfied) return '<div class="chTask"><span class="grow">' + label + '</span><span class="okMark">' + esc(tr("ch.tick")) + "</span></div>";
        if (t.auto || t.kind === "habit") return '<div class="chTask"><span class="grow">' + label + '</span><span class="hint">' + esc(tr("ch.notYet")) + "</span></div>";
        return '<div class="chTask"><span class="grow">' + label + '</span><button class="miniBtn" data-chtick="' + esc(t.key) + '">' + esc(tr("ch.tick")) + "</button></div>";
      }).join("") +
        '<div class="row"><button class="pillBtn" id="chRestBtn">' + esc(tr("ch.restToday")) + "</button></div>";
    }
    var foot = "";
    if (ch.mode === "steady") foot += '<p class="hint">' + esc(tr("ch.weeklyRest")) + "</p>";
    if (ch.mode === "hard") {
      if (!ch.strict) foot += '<p class="hint">' + esc(tr("ch.strictLine")) + '</p><div class="row"><button class="pillBtn" id="chStrictBtn">' + esc(tr("ch.strictOn")) + "</button></div>";
      else {
        foot += '<p class="hint">' + esc(tr("ch.strictOnLine")) + "</p>";
        var missed = prog.days.some(function (d) { return d.state === "missed" && d.iso >= prog.countFrom && d.iso < today; });
        if (missed) foot += '<div class="row"><button class="pillBtn" id="chRestartBtn">' + esc(tr("ch.restartCount")) + "</button></div>";
      }
    }
    foot += '<div class="row"><button class="pillBtn" id="chEndBtn">' + esc(chEndArmed ? tr("ch.endSure") : tr("ch.end")) + "</button></div>";
    box.innerHTML = head + softer + body + foot;
    box.querySelectorAll("[data-chtick]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-chtick");
        ch.ticks = ch.ticks || {}; ch.ticks[today] = ch.ticks[today] || {};
        if (ch.ticks[today][key]) delete ch.ticks[today][key]; else ch.ticks[today][key] = true;
        save(); renderChallenge();
      });
    });
    var rb = $("chRestBtn"); if (rb) rb.addEventListener("click", function () { ch.restDays[today] = true; save(); renderChallenge(); });
    var ub = $("chUnrestBtn"); if (ub) ub.addEventListener("click", function () { delete ch.restDays[today]; save(); renderChallenge(); });
    var sb = $("chStrictBtn"); if (sb) sb.addEventListener("click", function () { ch.strict = true; save(); renderChallenge(); });
    var kb = $("chRestartBtn"); if (kb) kb.addEventListener("click", function () { ch.countFrom = today; save(); renderChallenge(); });
    var eb = $("chEndBtn"); if (eb) eb.addEventListener("click", function () {
      if (!chEndArmed) { chEndArmed = true; renderChallenge(); return; }
      chEndArmed = false; chArchiveCurrent(); save(); renderChallenge();
    });
  }

  /* --- Settings --- */
  function renderSettings() {
    var p = state.profile;
    $("profileSummary").textContent = !p ? tr("set.noSetup") :
      [p.name, p.weightKg ? p.weightKg + " kg" : "", p.heightCm ? p.heightCm + " cm" : "",
       (p.goals || []).join(", ")].filter(Boolean).join(" · ") || tr("set.setupSaved");
    $("disclaimerStatus").textContent = L.disclaimerAgreed(state, D.DISCLAIMER_VERSION) ?
      tr("set.agreedOn", { date: new Date(state.disclaimer.agreedAt).toLocaleString() }) :
      tr("legal.noteStatus");
    var cname = companionName();
    $("guideStatus").textContent = guideOn() ? tr("set.guideOn", { name: cname }) : tr("set.guideOff", { name: cname });
    var cb = $("celebBtn"); if (cb) { cb.textContent = (state.settings && state.settings.noCelebrate) ? tr("set.celebOn", null, "Turn celebrations back on") : tr("set.celebOff", null, "Turn celebrations off"); cb.setAttribute("aria-pressed", String(!!(state.settings && state.settings.noCelebrate))); }
    $("guideToggleBtn").textContent = guideOn() ? tr("set.guideRestBtn", { name: cname }) : tr("set.guideBackBtn", { name: cname });
    var restSpot = $("guideRestSpot");
    if (restSpot) restSpot.innerHTML = !guideOn() && window.Wally ? wallyWrap("rest", wallyLine("tomorrow"), 56) : "";
    var nm = $("guideNameInput"); if (nm && document.activeElement !== nm) nm.value = (state.settings && state.settings.companionName) || "";
    document.querySelectorAll(".skinBtn").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-skin") === trainerSkin());
    });
    var cp = $("calmPicsBtn");
    if (cp) cp.textContent = (state.settings && state.settings.calmPics) ? tr("set.motionInstead") : tr("set.stills");
    document.querySelectorAll(".blanketBtn").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-blanket") === blanketColor());
    });

    var rm = $("remindBtn"), rh = $("remindHint");
    if (rm && rh) {
      if (FitRemind.available()) {
        rh.textContent = tr("set.remindersHint");
        rm.classList.remove("hidden");
        rm.textContent = (state.settings && state.settings.notifications === true) ? tr("rem.turnOff") : tr("rem.turnOn");
      } else {
        rh.textContent = tr("set.remindersWeb");
        rm.classList.add("hidden");
      }
    }
    renderAppearance();
    renderAccount();
  }
  $("progressOpen").addEventListener("click", function () { openArea("progress", "prog-overview"); });
  $("celebBtn").addEventListener("click", function () {
    state.settings = state.settings || {}; state.settings.noCelebrate = !state.settings.noCelebrate; save(); renderSettings();
    toast(state.settings.noCelebrate ? tr("set.celebOffToast", null, "Celebrations are off") : tr("set.celebOnToast", null, "Celebrations are on"));
  });
  $("guideToggleBtn").addEventListener("click", function () {
    state.settings = state.settings || {};
    guideOn(); /* runs the one-time key migration first */
    state.settings.wallyOff = !state.settings.wallyOff;
    /* The toggle is the senior signal for the gym speech
       bubbles (QA toggle leg): any flip bumps the stamp, so
       bubbles follow the toggle, not an older session rest. */
    state.settings.guideStamp = guideStamp() + 1;
    save(); renderSettings(); renderCheckin();
    toast(state.settings.wallyOff ? companionName() + " is resting." : companionName() + " is back.");
  });
  $("tourReplayBtn").addEventListener("click", replayTour);
  $("guideAgainBtn").addEventListener("click", showGuideAgain);
  $("remindAskYes").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.remindAsked = true;
    $("remindAsk").classList.add("hidden");
    FitRemind.setOn(true).then(function (ok) { save(); renderSettings(); if (!ok) toast(tr("rem.notAllowed")); });
  });
  $("remindAskNo").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.remindAsked = true;
    save();
    $("remindAsk").classList.add("hidden");
  });
  $("remindBtn").addEventListener("click", function () {
    var on = !!(state.settings && state.settings.notifications === true);
    FitRemind.setOn(!on).then(function (ok) {
      renderSettings();
      if (!on && !ok) toast(tr("rem.notAllowed"));
    });
  });
  $("importClose").addEventListener("click", closeImport);
  $("importOpen2").addEventListener("click", openImport);
  document.querySelectorAll(".import-src").forEach(function (b) {
    b.addEventListener("click", function () { setImportSource(b.getAttribute("data-src")); });
  });
  $("importGo").addEventListener("click", function () {
    var url = $("importUrl").value.trim();
    if (!url) { $("importResult").textContent = tr("cal.importNeedLink"); return; }
    url = url.replace(/^webcal:/i, "https:");
    if (!/^https:\/\//i.test(url)) { $("importResult").textContent = tr("cal.importHttps", null, "Please use a link that starts with https://"); return; }
    $("importResult").textContent = tr("cal.importFetching");
    fetch(url).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.text(); })
      .then(function (t) { runImport(t, IMPORT_LABELS[importSource]); })
      .catch(function () { $("importResult").textContent = tr("cal.importFetchFail"); });
  });
  $("importFileBtn").addEventListener("click", function () { $("importFile").click(); });
  $("importFile").addEventListener("change", function () {
    var f = $("importFile").files && $("importFile").files[0];
    if (!f) return;
    f.text().then(function (t) { runImport(t, IMPORT_LABELS[importSource]); });
    $("importFile").value = "";
  });
  /* The language row (Settings > Appearance): Auto follows
     the device; a named language pins it. The choice is
     the user's setting, saved like every other. */
  function setLang(choice) {
    if (!SPANISH_LIVE && choice !== "en") return;
    state.settings = state.settings || {};
    state.settings.lang = choice;
    save();
    if (window.Lang) { Lang.use(choice); Lang.applyStatic(); }
    renderAll();
    toast(tr("settings.langSet"));
  }
  $("langAutoBtn").addEventListener("click", function () { setLang("auto"); });
  $("langEnBtn").addEventListener("click", function () { setLang("en"); });
  $("langEsBtn").addEventListener("click", function () { setLang("es"); });
  if (window.Lang) Lang.applyStatic();
  $("guideNameSave").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.companionName = $("guideNameInput").value.trim();
    save(); renderSettings();
    toast(companionName() + " it is.");
  });
  document.querySelectorAll(".blanketBtn").forEach(function (b) {
    b.addEventListener("click", function () {
      state.settings = state.settings || {};
      state.settings.blanketColor = b.getAttribute("data-blanket");
      save(); renderSettings(); renderCheckin();
      toast(tr("toast.blanketPicked"));
    });
  });
  document.querySelectorAll(".skinBtn").forEach(function (b) {
    b.addEventListener("click", function () {
      state.settings = state.settings || {};
      state.settings.trainerSkin = b.getAttribute("data-skin");
      state.settings.skinAsked = true;
      save(); renderSettings();
      toast(tr("set.trainerSet2"));
    });
  });
  $("calmPicsBtn").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.calmPics = !state.settings.calmPics;
    save(); renderSettings();
    toast(state.settings.calmPics ? tr("set.stillsToast") : tr("set.motionToast"));
  });
  /* --- Appearance (Law E) ---
     Four quiet choices in Settings. The board look is the
     default. Contrast adapts through the theme tokens in
     styles.css (AA floor, script-checked pairs in the
     suite). A photo the user uploads is their data: it is
     shrunk on this device, saved under their account like
     everything else, and only they can remove it. Over a
     photo the app lays a strong cream veil, so words stay
     readable on any picture. */
  var APPR_MODES = ["brand", "white", "black", "image"];
  function appearanceOf() {
    var a = (state.settings && state.settings.appearance) || {};
    return { mode: APPR_MODES.indexOf(a.mode) !== -1 ? a.mode : "brand",
             image: (typeof a.image === "string" && a.image.indexOf("data:image/") === 0) ? a.image : null };
  }
  function applyAppearance() {
    var a = appearanceOf();
    document.body.setAttribute("data-appearance", a.mode);
    if (a.mode === "image" && a.image) document.body.style.setProperty("--bgimg", "url(" + a.image + ")");
    else document.body.style.removeProperty("--bgimg");
  }
  function renderAppearance() {
    var a = appearanceOf();
    document.querySelectorAll(".apprBtn").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-appr") === a.mode);
    });
    var row = $("apprPhotoRow"); if (row) row.classList.toggle("hidden", !(a.mode === "image" || a.image));
    var rm = $("apprRemoveBtn"); if (rm) rm.classList.toggle("hidden", !a.image);
    var note = $("apprNote");
    if (note) note.textContent = a.mode === "image" && !a.image ? tr("set.apprPickNote") :
      a.image ? tr("set.apprSavedNote") : "";
  }
  document.querySelectorAll(".apprBtn").forEach(function (b) {
    b.addEventListener("click", function () {
      var mode = b.getAttribute("data-appr");
      state.settings = state.settings || {};
      state.settings.appearance = appearanceOf();
      state.settings.appearance.mode = mode;
      save(); applyAppearance(); renderAppearance();
      if (mode === "image" && !appearanceOf().image) $("apprFile").click();
    });
  });
  $("apprFile").addEventListener("change", function () {
    var file = this.files && this.files[0]; this.value = "";
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      var cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      state.settings = state.settings || {};
      state.settings.appearance = appearanceOf();
      state.settings.appearance.image = cv.toDataURL("image/jpeg", 0.82);
      state.settings.appearance.mode = "image";
      save(); applyAppearance(); renderAppearance();
      toast(tr("set.apprToast"));
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast(tr("set.apprBadPhoto")); };
    img.src = url;
  });
  $("apprRemoveBtn").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.appearance = appearanceOf();
    state.settings.appearance.image = null;
    if (state.settings.appearance.mode === "image") state.settings.appearance.mode = "brand";
    save(); applyAppearance(); renderAppearance();
    toast(tr("toast.photoRemoved"));
  });
  /* --- Accounts (Phase 6, P2 door flip) ---
     The door, as ruled 15 Oct 2026: email + the user's
     own password, beside Google (Apple parks on the
     Developer wall). auth.js loads as a module after this
     script and announces itself with "fit-auth-ready"; if it
     cannot load, the account box says so honestly and the app
     keeps working on this device, as it always has. Signing
     in joins the cloud copy with this device copy through
     mergeStates (nothing dropped), then every save mirrors. */
  var authUser = null, doorStarted = false, pendingName = "",
      joinPopped = false,
      cloudWarnings = [], mirrorNote = "", deleteArmed = false;
  /* A device cache belongs to one signed-in uid at a time. Keep
     a separate local copy per account, and never merge a prior
     account's cache into the next account. */
  function activateAccountStorage(uid) {
    try {
      var previousUid = localStorage.getItem(OWNER_KEY);
      var ownKey = accountStateKey(uid);
      var ownRaw = localStorage.getItem(ownKey);
      if (previousUid !== uid) knownFirstSeen = null;
      if (previousUid && previousUid !== uid) {
        var previousRaw = localStorage.getItem(KEY);
        if (previousRaw && !localStorage.getItem(accountStateKey(previousUid)))
          localStorage.setItem(accountStateKey(previousUid), previousRaw);
        state = repairKeep(JSON.parse(ownRaw || "null"));
      } else if (ownRaw) {
        state = repairKeep(JSON.parse(ownRaw));
      } else if (previousUid === uid) {
        state = repairKeep(JSON.parse(localStorage.getItem(KEY) || "null"));
      }
      localStorage.setItem(OWNER_KEY, uid);
      var raw = JSON.stringify(state);
      localStorage.setItem(KEY, raw);
      localStorage.setItem(ownKey, raw);
    } catch (e) {
      state = repairKeep(null);
      try {
        localStorage.setItem(OWNER_KEY, uid);
        localStorage.setItem(KEY, JSON.stringify(state));
        localStorage.setItem(accountStateKey(uid), JSON.stringify(state));
      } catch (e2) {}
    }
  }
  var doorStep = 1, doorEmail = "";
  var mirrorTimer = null;
  /* The cloud copy is only written once it has been read successfully this session: a failed read must never be
     followed by a write of an empty or partial state over the real account data. Changes stay safe on the phone. */
  var cloudReady = false, loadRetries = 0;
  function loadCloudWithRetry(user, first) {
    window.FitAuth.loadCloudState(user.uid).then(function (cloud) { cloudReady = true; loadRetries = 0; afterCloudLoad(user, cloud); })
      .catch(function () {
        mirrorNote = tr("acc.loadNote", null, "Could not reach your account just now. Your changes stay safe on this phone and will sync when it is back.");
        renderAccount();
        if (loadRetries < 6 && authUser && authUser.uid === user.uid) { loadRetries++; setTimeout(function () { if (authUser && authUser.uid === user.uid && !cloudReady) loadCloudWithRetry(user, false); }, 8000 * loadRetries); }
      });
  }
  function scheduleMirror() {
    if (!authUser || !window.FitAuth || !cloudReady) return;
    if (mirrorTimer) clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(function () {
      /* Re-checked at fire time: a sign-out inside the window
         ends the session, and a dead session saves nothing. */
      if (!authUser || !window.FitAuth) return;
      window.FitAuth.saveCloudState(authUser.uid, state).then(function (r) {
        cloudWarnings = (r && r.warnings) || [];
        mirrorNote = "";
        renderAccount();
      }).catch(function () {
        mirrorNote = tr("acc.mirrorNote");
        renderAccount();
      });
    }, 800);
  }
  var bootAt = Date.now();
  /* Sign-in door errors, in plain kind words. */
  function authErrWords(e, what) {
    var c = (e && e.code) || "";
    if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found")
      return tr("door.tMismatch");
    if (c === "auth/email-already-in-use") return tr("acc.errInUse");
    if (c === "auth/weak-password") return tr("acc.errWeak");
    if (c === "auth/invalid-email") return tr("acc.errEmail");
    if (c === "auth/too-many-requests") return tr("acc.errMany");
    if (c === "auth/network-request-failed") return tr("acc.errNet");
    return what === "sign-up" ? tr("acc.errMake")
                               : tr("acc.errSignin");
  }
  /* D-B (door-feel ruling, 21 Oct 2026): while any door
     attempt flies, the door LOOKS busy and a second tap is a
     no-op — a door that looks dead during its own wait
     invites the double tap that poisons the return. */
  var doorBusy = false;
  function doorBusyOn() { doorBusy = true; var b = $("accountBox"); if (b) b.classList.add("doorBusy"); }
  function doorBusyOff() { doorBusy = false; var b = $("accountBox"); if (b) b.classList.remove("doorBusy"); }
  /* D-A (same ruling): a cancel is not a failure — the user
     changed their mind, so the door simply stands, silent.
     Cancels arrive as the popup-closed code on the web, or
     with "cancel" in the message in the native providers'
     own words. */
  function isDoorCancel(e) {
    var code = (e && e.code) || "", msg = (e && e.message) || "";
    return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || /cancel/i.test(msg);
  }
  function doorAttempt(promise, failKey) {
    if (doorBusy) return;
    doorBusyOn();
    promise.then(function () { /* the auth listener takes it from here */ }, function (e) {
      doorBusyOff();
      if (isDoorCancel(e)) return;
      toast(tr(failKey));
    });
  }
  /* Sign-out, owned end to end (QA fix order, build 13): the
     local session ends NOW, on this device, whatever the sync
     or the network is doing — the same end the auth listener
     runs when it hears null, run by hand so a stuck sync can
     never trap the user in the account. The server call then
     settles (bounded in auth.js) and its result only chooses
     the line that speaks: the given key on success, the
     sign-out failure line on any failure. Never silence. */
  /* Sign-out on a phone that someone else may pick up: push the last changes to the account first; when that
     worked, remove this account's copy from the phone (the account holds it) and reload to a clean door.
     When the push could not happen (offline), keep the local copy so nothing is lost, and say so plainly.
     Progress photos are never uploaded, so they stay in their per-account on-device vault. */
  function signOutFlow(okKey) {
    var uid = authUser && authUser.uid, snap = state;
    authUser = null;
    doorStep = 1; doorEmail = "";
    renderAccount();
    if (!window.FitAuth || !window.FitAuth.signOutUser) { toast(tr("acc.signOutFail")); return; }
    var pushed = Promise.resolve(false);
    var wasReady = cloudReady; cloudReady = false;
    if (uid && wasReady && window.FitAuth.saveCloudState) {
      pushed = Promise.race([window.FitAuth.saveCloudState(uid, snap).then(function () { return true; }, function () { return false; }),
        new Promise(function (res) { setTimeout(function () { res(false); }, 6000); })]);
    }
    pushed.then(function (ok) {
      return window.FitAuth.signOutUser().then(function () {
        if (ok && uid) {
          var cancelled = Promise.resolve(); try { cancelled = FitRemind.cancelAll(); } catch (e) {}
          cancelled.then(function () {
            try { localStorage.removeItem(KEY); localStorage.removeItem(OWNER_KEY); localStorage.removeItem(accountStateKey(uid)); localStorage.removeItem("fit-remind-ids"); } catch (e) {}
            location.reload();
          });
        } else { toast(tr("acc.signedOutKept", null, "Signed out. Some recent changes are only on this phone for now. They stay here until you sign in again.")); }
      });
    }).catch(function () { toast(tr("acc.signOutFail")); });
  }
  function renderAccount() {
    var box = $("accountBox"); if (!box) return;
    doorBusy = false; box.classList.remove("doorBusy"); /* a finished sign-in must never leave the buttons faded and dead */
    /* DOOR PURITY + ACCOUNT MANDATORY (fleet rulings, 21 Oct
       2026): before entry the app shows the DOOR and nothing
       else — the settings page carries sign-up/sign-in only,
       the menu and Wally stay inside, and there is no road in
       without an account. Entry lifts the class. */
    document.body.classList.toggle("signedOut", !authUser);
    /* SIGN-OUT CLEARS THE GREETING AT ONCE (Round 2 finding,
       QA b19 Leg 1 observation 2): the top strip and the Today
       title are written by renderToday, which sign-out never
       re-runs, so a name used to survive in the strip until a
       reload. Signed out means cleared NOW, not on reload. */
    if (!authUser) {
      var sh = $("stripHi"); if (sh) sh.textContent = "";
      var tt = $("todayTitle"); if (tt) tt.textContent = tr("nav.today");
    }
    if (!doorStarted) {
      box.innerHTML = (Date.now() - bootAt < 4500) ?
        '<p class="hint">' + esc(tr("set.opening")) + '</p>' :
        '<p class="hint">' + esc(tr("acc.doorResting")) + '</p>';
      return;
    }
    if (!authUser) {
      /* THE DOOR PAGE (mockup of record v4, 15 Oct
         2026): the account step holds ONLY the sign-up,
         big and in the middle. Big mark, the Google and
         Apple doors as ICON-ONLY buttons, an "or with
         email" divider, ONE email field, and a big round
         next arrow. The password lives on step 2,
         reached by the arrow: the email shown with
         Change, the password, ONE button, and the reset
         line. No name field and no plan pick on either
         step (the guide's tour asks the name inside the
         app). There is no other road in (her 20:57 rule:
         sign up or sign in, always). */
      var GOOGLE_G = '<svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
      var APPLE_G = '<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.5.96 1.39 2.1 2.94 3.6 2.88 1.45-.06 2-.93 3.74-.93s2.24.93 3.77.9c1.56-.02 2.55-1.41 3.5-2.8 1.1-1.62 1.56-3.18 1.58-3.26-.03-.02-3.04-1.17-3.07-4.59zM14.16 4.06c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.74-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.63z"/></svg>';
      var ARROW = '<svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      if (doorStep === 2) {
        box.innerHTML = '<div class="doorPage"><div class="doorCol">' +
          '<div class="doorBigMark"><img src="icons/icon-512.png" alt=""></div>' +
          '<div class="doorEmailRow"><span>' + esc(doorEmail) + '</span><button class="miniBtn" id="accChangeBtn">' + esc(tr("door.change")) + '</button></div>' +
          '<label>' + esc(tr("door.password")) + '<input id="accPass" type="password" autocomplete="current-password" placeholder="' + esc(tr("door.passwordPh")) + '"></label>' +
          '<div class="row"><button class="primaryBtn" id="accContinueBtn">' + esc(tr("door.continueBtn")) + '</button></div>' +
          '<p class="hint">' + esc(tr("door.continueHint")) + '</p>' +
          '<div class="row"><span class="hint">' + esc(tr("door.forgot")) + '</span>' +
          '<button class="miniBtn" id="accForgotBtn">' + esc(tr("door.reset")) + '</button></div>' +
          '</div></div>';
        $("accChangeBtn").addEventListener("click", function () { doorStep = 1; renderAccount(); });
        $("accContinueBtn").addEventListener("click", function () {
          if (doorBusy) return;
          var pw = $("accPass").value;
          if (!pw) { toast(tr("door.tPwFirst")); return; }
          doorBusyOn();
          /* One button, both roads: sign in; a credential
             refusal may simply mean "new here", so offer
             the pair to account creation. An existing
             email answers already-in-use, and the user
             hears the same one honest line as a wrong
             password (Security's PW delta holds). */
          window.FitAuth.signInWithEmail(doorEmail, pw).catch(function (e) {
            var c = (e && e.code) || "";
            if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") {
              window.FitAuth.signUpWithEmail(doorEmail, pw).then(function () { doorBusyOff(); toast(tr("door.tMade")); })
                .catch(function (e2) {
                  doorBusyOff();
                  if (((e2 && e2.code) || "") === "auth/email-already-in-use") toast(tr("door.tMismatch"));
                  else toast(authErrWords(e2, "sign-up"));
                });
            } else { doorBusyOff(); toast(authErrWords(e, "sign-in")); }
          });
        });
        $("accPass").addEventListener("keydown", function (ev) { if (ev.key === "Enter") $("accContinueBtn").click(); });
        $("accForgotBtn").addEventListener("click", function () {
          window.FitAuth.resetPassword(doorEmail).then(function () { toast(tr("door.tResetSent")); })
            .catch(function () { toast(tr("door.tResetFail")); });
        });
        var pwEl = $("accPass"); if (pwEl) setTimeout(function () { pwEl.focus(); }, 60);
        return;
      }
      box.innerHTML = '<div class="doorPage"><div class="doorCol">' +
        '<div class="doorBigMark"><img src="icons/icon-512.png" alt=""></div>' +
        '<div class="doorBigName">Fit Hard</div>' +
        '<div class="doorBigSub">' + esc(tr("door.sub")) + '</div>' +
        '<div class="doorIcons"><button class="doorIconBtn" id="accGoogleBtn" aria-label="Continue with Google">' + GOOGLE_G + '</button>' +
        '<button class="doorIconBtn" id="accAppleBtn" aria-label="Continue with Apple">' + APPLE_G + '</button></div>' +
        '<div class="doorOr">' + esc(tr("door.orEmail")) + '</div>' +
        '<input id="accEmail" type="email" autocomplete="email" aria-label="Email" placeholder="you@example.com">' +
        '<button class="doorNext" id="accNextBtn" aria-label="Next">' + ARROW + '</button>' +
        '</div></div>';
      var emEl = $("accEmail"); if (emEl && doorEmail) emEl.value = doorEmail;
      function doorNext() {
        var em = $("accEmail").value.trim();
        if (!em) { toast(tr("door.tEmailFirst")); return; }
        if (em.indexOf("@") < 1 || em.indexOf(".", em.indexOf("@")) < 0) { toast(tr("door.tEmailBad")); return; }
        doorEmail = em; doorStep = 2; renderAccount();
      }
      $("accNextBtn").addEventListener("click", doorNext);
      $("accEmail").addEventListener("keydown", function (ev) { if (ev.key === "Enter") doorNext(); });
      $("accGoogleBtn").addEventListener("click", function () {
        doorAttempt(window.FitAuth.signInWithGoogle(), "acc.googleFail");
      });
      $("accAppleBtn").addEventListener("click", function () {
        doorAttempt(window.FitAuth.signInWithApple(), "acc.appleFail");
      });
      return;
    }
    var detail = tierDetail();
    var planLine = "";
    if (PLANS_LIVE && detail.plan === "pro" && detail.reason === "freemonth")
      planLine = '<p class="hint">' + esc(tr("acc.planFreeMonth", { days: detail.daysLeft })) + '</p>';
    else if (PLANS_LIVE && detail.plan === "pro")
      planLine = '<p class="hint">' + esc(tr("acc.planPro")) + '</p>';
    else if (PLANS_LIVE)
      planLine = '<div class="row"><span class="hint">' + esc(tr("acc.planFree")) + '</span><button class="miniBtn" id="accProBtn">' + esc(tr("pro.seeAdds")) + '</button></div>';
    if (PLANS_LIVE) planLine += '<div class="row"><button class="pillBtn" id="accPlansBtn">' + esc(tr("acc.plansBtn")) + '</button></div>';
    var warn = cloudWarnings.length ? '<p class="hint">' + esc(tr("acc.warnLarge")) + '</p>' : "";
    var note = mirrorNote ? '<p class="hint">' + esc(mirrorNote) + "</p>" : "";
    box.innerHTML = '<p class="hint">' + esc(tr("acc.signedIn", { email: authUser.email || tr("acc.yourAccount") })) + "</p>" + planLine + warn + note +
      (deleteArmed ?
        '<p class="hint">' + esc(tr("acc.deleteAsk")) + '</p>' +
        (isPasswordUser() ? '<div class="grid2"><label>' + esc(tr("acc.deletePwLabel")) + '<input id="accDeletePass" type="password" autocomplete="current-password" placeholder="' + esc(tr("door.passwordPh")) + '"></label></div>' : "") +
        '<div class="row"><button class="pillBtn" id="accDeleteYes">' + esc(tr("acc.deleteYes")) + '</button><button class="pillBtn" id="accDeleteNo">' + esc(tr("acc.deleteNo")) + '</button></div>' :
        '<div class="row"><button class="pillBtn" id="accOutBtn">' + esc(tr("acc.signOut")) + '</button><button class="pillBtn" id="accDeleteBtn">' + esc(tr("acc.deleteBtn")) + '</button></div>');
    var proBtn = $("accProBtn"); if (proBtn) proBtn.addEventListener("click", showProMoment);
    var plansBtn = $("accPlansBtn"); if (plansBtn) plansBtn.addEventListener("click", openPlans);
    var out = $("accOutBtn"); if (out) out.addEventListener("click", function () {
      signOutFlow("acc.signedOut");
    });
    var del = $("accDeleteBtn"); if (del) del.addEventListener("click", function () { deleteArmed = true; renderAccount(); });
    var no = $("accDeleteNo"); if (no) no.addEventListener("click", function () { deleteArmed = false; renderAccount(); });
    var yes = $("accDeleteYes"); if (yes) yes.addEventListener("click", deleteAccountFlow);
  }
  function isPasswordUser() {
    return !!(authUser && authUser.providerData && authUser.providerData.length &&
      authUser.providerData[0].providerId === "password");
  }
  function wipeDeviceAndReload() {
    var done = function () { location.reload(); };
    var cancelled = Promise.resolve();
    try { cancelled = FitRemind.cancelAll(); } catch (e) {}
    try { localStorage.removeItem(KEY); localStorage.removeItem("fit-remind-ids"); } catch (e) {}
    cancelled.then(function () { try { return window.FitPhotos && window.FitPhotos.clearAll ? window.FitPhotos.clearAll() : null; } catch (e) { return null; } }).then(done, done);
  }
  function deleteAccountFlow() {
    if (!authUser || !window.FitAuth) return;
    var pwField = $("accDeletePass");
    var pw = pwField ? pwField.value : undefined;
    if (isPasswordUser() && !pw) { toast(tr("acc.deletePwFirst")); return; }
    window.FitAuth.deleteAccount(authUser.uid, pw).then(function () {
      toast(tr("acc.deleted"));
      setTimeout(wipeDeviceAndReload, 600);
    }).catch(function (err) {
      if (err && (err.code === "fit/reauth-password" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential")) {
        toast(tr("acc.deletePwBad"));
      } else {
        toast(tr("acc.deleteFail"));
      }
      deleteArmed = false; renderAccount();
    });
  }
  /* Two-hat plan sync: once per session, for a real signed-in
     user. Runs only after
     a cloud round trip, so the account root exists (CS order).
     The answer is stored in state.tier — the slice itself is
     written by FitAuth.syncPlan under the rules gate. */
  var planSynced = false;
  function maybeSyncPlan(user) {
    if (planSynced || !user || user.isAnonymous || !window.FitAuth || !window.FitAuth.syncPlan) return;
    planSynced = true;
    window.FitAuth.syncPlan(user.uid, false).then(function (p) {
      if (p) { state.tier = { plan: p }; saveLocal(); renderAccount(); renderPlans(); }
    }).catch(function () {});
  }
  /* The name asked at sign-up (her ruling, 15 Oct 2026):
     carried on the profile, so the app and Wally greet the
     user by it. A name typed at Create account wins first;
     a Google name is adopted when the profile has none.
     An existing profile name is never overwritten. */
  /* BIRTH INTEGRITY (F-B11-1, QA's placed TypeError, 21 Oct
     2026): a profile born thin — a name and nothing else —
     poisons every render that reads its arrays (buildSidebar
     read profile.needs unguarded and died, taking the birth
     session's renders with it). Any site that creates the
     profile creates it WHOLE: the four array fields always
     stand. The free-month stamp keeps its own cured
     machinery and is never minted here. */
  function ensureFullProfile() {
    var p = state.profile || {};
    if (!Array.isArray(p.needs)) p.needs = [];
    if (!Array.isArray(p.preferences)) p.preferences = [];
    if (!Array.isArray(p.allergies)) p.allergies = [];
    if (!Array.isArray(p.goals)) p.goals = [];
    if (typeof p.name !== "string") p.name = "";
    state.profile = p;
    return p;
  }
  function adoptSignInName(user) {
    var adopt = (pendingName || user.displayName || "").trim().slice(0, 60);
    pendingName = "";
    if (!adopt) return;
    ensureFullProfile();
    if (state.profile.name) return;
    state.profile.name = adopt;
    saveLocal();
  }
  /* THE GUIDE'S TOUR (mockup of record v4, 15 Oct
     2026): joining lands the user inside the whole app,
     and the guide runs ONE tour on the first visit. A
     pop-up in the middle of the screen; an X or "Skip
     tour" closes it at any stop and nothing nags after.
     Stop 1 asks the name inside the pop-up (a provider
     name lands first, so those users are greeted, not
     asked). Next walks the tour to the menu, then to
     the day, then a last stop with Done. The tour is
     remembered in the account settings (tourSeen), so
     the AUTO-run happens once. A replay door in
     Settings ("See the tour again", HQ fleet ruling
     16 Oct 2026 — every app's tour replays from
     Settings, Pace's shape) re-runs it on demand:
     tourSeen never blocks a manual replay; a replay
     NEVER re-arms the name re-offer; on replay the
     name step pre-fills the saved name, and a blank
     Next on replay never erases it (Law B — a replay
     deletes nothing). If the guide is resting (the user's
     own setting), there is no tour. The setup flow
     follows the tour, if it has not been done. */
  var tourStep = 0;
  var tourReplay = false;
  var tourAskedName = false;
  var tourRanThisSession = false;
  var reofferShownThisSession = false;
  function joinFollowUp() {
    if (joinPopped || !authUser) return;
    joinPopped = true;
    if (!guideOn() || (state.settings && state.settings.tourSeen)) { afterTour(); return; }
    showView("today");
    tourRanThisSession = true;
    tourStep = 1;
    renderTour();
  }
  function afterTour() {
    maybeNameReoffer();
    /* ROUND 3 (QA's setup observation on build 20): the
       auto-offer stands down for good once the user has
       answered "Not now" (setupSkipped, set by the skip
       itself). The checklist's setup row and the Settings
       roads still open the sheet by hand, so skipping
       never strands anyone. */
    if (authUser && state.profile && !state.profile.setupDone && !state.profile.setupSkipped) openSetup();
  }
  /* THE NAME RE-OFFER (HQ ruling 15 Oct 2026): if the
     tour's name step was closed or skipped UNANSWERED,
     the guide re-offers it ONCE on the NEXT visit (one
     small quiet bubble on Today, never in the same
     session), then never again. After that the name
     lives in Settings and setup; the greeting stays
     generic and a missing name blocks nothing. */
  function maybeNameReoffer() {
    if (!authUser || !guideOn()) return;
    if (tourRanThisSession || reofferShownThisSession) return;
    if (!state.profile || state.profile.name) return;
    if (!state.settings || state.settings.nameReoffer !== "pending") return;
    state.settings.nameReoffer = "done";
    reofferShownThisSession = true;
    save();
    var card = $("nameReoffer");
    if (!card) return;
    $("reofferLine").textContent = tr("reoffer.line", { name: companionName() });
    card.hidden = false;
  }
  function tourDots() {
    return [1, 2, 3].map(function (i) { return i === tourStep ? "●" : "○"; }).join(" ");
  }
  function renderTour() {
    var root = $("tourRoot"), card = $("tourCard"), dim = $("tourDim");
    if (!root || !card) return;
    root.classList.remove("hidden");
    var guide = esc(companionName());
    var name = state.profile && state.profile.name;
    var x = '<button class="tourX" id="tourX" aria-label="Close the tour">✕</button>';
    var skip = '<button class="tourSkip" id="tourSkip">' + esc(tr("tour.skip")) + '</button>';
    var face = '<img class="tourFace" src="assets/wally-welcome.webp" alt="">';
    if (tourStep === 1) {
      if (!name) tourAskedName = true;
      dim.classList.remove("hidden");
      card.className = "tourCard tourCenter";
      /* On a REPLAY the name step shows the field
         pre-filled with the saved name (HQ ruling);
         a first run with a name greets instead. */
      var showField = !name || tourReplay;
      card.innerHTML = x + face +
        '<p class="tourLine">' + esc(tr("tour.hey", { name: guide })) + ((name && !tourReplay) ? "" : " " + esc(tr("tour.ask"))) + '</p>' +
        (showField ? '<input id="tourName" type="text" autocomplete="name" placeholder="' + esc(tr("tour.namePh")) + '" value="' + (tourReplay && name ? esc(name) : "") + '">' : "") +
        '<div class="tourRow">' + skip + '<button class="primaryBtn tourNext" id="tourNext">' + esc(tr("tour.next")) + ' →</button></div>' +
        '<div class="tourDots">' + tourDots() + '</div>';
      var inp = $("tourName"); if (inp) setTimeout(function () { inp.focus(); }, 60);
    } else if (tourStep === 2) {
      /* SLIMMED (Round 2 guide spec): no geography lecture.
         One centred step, one line on the four areas, and the
         checklist + coach marks teach the rest at the point
         of use. tour.menu / tour.day stay in the word tables,
         unrendered, in case a later round wants them back. */
      dim.classList.remove("hidden");
      card.className = "tourCard tourCenter";
      card.innerHTML = x + face +
        '<p class="tourLine">' + esc(tr("tour.areas")) + '</p>' +
        '<div class="tourRow">' + skip + '<button class="primaryBtn tourNext" id="tourNext">' + esc(tr("tour.next")) + ' →</button></div>' +
        '<div class="tourDots">' + tourDots() + '</div>';
    } else {
      dim.classList.remove("hidden");
      card.className = "tourCard tourCenter";
      card.innerHTML = x + face +
        '<p class="tourLine">' + esc(tr("tour.done")) + '</p>' +
        '<div class="tourRow"><span></span><button class="primaryBtn tourNext" id="tourDone">' + esc(tr("tour.doneBtn")) + ' ✓</button></div>' +
        '<div class="tourRow"><button class="pillBtn" id="tourImportBtn">' + esc(tr("cal.importOffer")) + '</button><span></span></div>' +
        '<div class="tourDots">' + tourDots() + '</div>';
    }
    var nx = $("tourNext"); if (nx) nx.addEventListener("click", tourAdvance);
    var dn = $("tourDone"); if (dn) dn.addEventListener("click", endTour);
    var ti = $("tourImportBtn"); if (ti) ti.addEventListener("click", function () { endTour(); openImport(); });
    var sk = $("tourSkip"); if (sk) sk.addEventListener("click", endTour);
    var xx = $("tourX"); if (xx) xx.addEventListener("click", endTour);
  }
  function tourAdvance() {
    if (tourStep === 1) {
      var inp = $("tourName");
      if (inp) {
        /* THE SAIL (HQ ruling 22:52, QA's harmonisation
           catch): a blank Next moves on like any other
           stop. Her law is that a missing name blocks
           NOTHING — not even the walk — and the re-offer
           is the designed other half of the pass-by. A
           typed name still saves here; Skip and the X
           stay live exits. (This supersedes the same-
           evening J3 friendly stop, which applied the
           name-SCREEN text to the tour.) */
        var v = inp.value.trim().slice(0, 60);
        ensureFullProfile();
        /* A typed name saves (on a replay, an edited
           name updates). A blank writes NOTHING — on
           replay it can never erase a saved name. */
        if (v && (tourReplay || !state.profile.name)) { state.profile.name = v; save(); renderAll(); }
      }
    }
    tourStep += 1;
    renderTour();
  }
  function endTour() {
    /* EVERY tour exit births the profile whole (Round 3,
       QA's tour-skip trap on build 20): the birth used to
       ride inside the step-1 name branch, so an exit that
       never passed that branch left the account unborn —
       no profile, the setup sheet never offered, and the
       checklist's setup row dead until a replay completed
       the tour. Skip and the X are offered choices; they
       cost nothing. The name save below keeps its own
       conditions (a typed name saves, a blank never
       erases); the birth itself is unconditional, the
       F-B11-1 doctrine: any site that creates the profile
       creates it whole, and every road out of the tour is
       such a site. */
    ensureFullProfile();
    if (tourStep === 1) {
      var inp = $("tourName");
      if (inp) {
        var v = inp.value.trim().slice(0, 60);
        if (v && (tourReplay || !state.profile.name)) { state.profile.name = v; renderAll(); }
      }
    }
    var wasReplay = tourReplay;
    tourStep = 0;
    tourReplay = false;
    sbOpen = false; applySidebar();
    var root = $("tourRoot"); if (root) root.classList.add("hidden");
    state.settings = state.settings || {};
    state.settings.tourSeen = true;
    /* Name step left unanswered: the guide owes ONE
       quiet re-offer on the next visit (HQ ruling).
       A REPLAY never arms it (HQ replay ruling): the
       re-ask is spent by its own rule, replay or not. */
    if (!wasReplay && tourAskedName && !(state.profile && state.profile.name) && state.settings.nameReoffer !== "done") {
      state.settings.nameReoffer = "pending";
    }
    save();
    afterTour();
  }
  /* THE REPLAY DOOR (HQ fleet ruling, 16 Oct 2026):
     Settings re-runs the tour on demand. tourSeen is
     not consulted here — it gates only the auto-run.
     The demo is its own tour; a resting guide is woken
     first, never overridden. */
  function replayTour() {
    if (!guideOn()) { toast(tr("tour.tResting", { name: companionName() })); return; }
    showView("today");
    tourReplay = true;
    tourRanThisSession = true;
    tourStep = 1;
    renderTour();
  }
  /* THE UPGRADE MOMENT (house popup, adapted; HQ order
     21:39): it opens ONLY when a free user reaches for
     Pro — here, the plan line in their account — never
     on open, never uninvited. "Not now" is a full-size
     answer beside the ask; closing it leaves the whole
     app usable. Copy is the locked tier design's own
     words (PLAN-fit-hard.md, approved 15 Oct 2026);
     Quality gate-reads it, Finance confirms the price. */
  /* PAYMENTS WIRING (Finance chapter §3/§5; HQ order 19 Oct
     2026): the free/paid split enforced at the tap. planNow
     reads the resolved entitlement of record (FitAuth:
     the comp gate plus the in-app free month, fail-closed)
     — free features never call it. A locked tap speaks in
     plain words, then opens the Pro moment: never silent,
     never a partial unlock. Demo sessions are never gated:
     the fixture shows the whole app. */
  var FREE_ROUTINE_CAP = 3;
  function planNow() {
    if (window.FitAuth && window.FitAuth.entitlement) return window.FitAuth.entitlement();
    return (state.tier && state.tier.plan === "pro") ? "pro" : "free";
  }
  function lockedTap() { toast(tr("pro.lockedTap")); showProMoment(); }
  function maySaveRoutine() {
    if (!PLANS_LIVE) return true;
    if (planNow() === "pro") return true;
    if ((state.routines || []).length < FREE_ROUTINE_CAP) return true;
    lockedTap(); return false;
  }
  function showProMoment() {
    if (!PLANS_LIVE) return;
    var w = $("proWally");
    if (w) w.innerHTML = guideOn() && window.Wally ? wallyWrap("welcome", tr("pro.bubble"), 64) : "";
    refreshProModal();
    $("proModal").classList.remove("hidden");
  }
  function closeProMoment() { $("proModal").classList.add("hidden"); }
  function onSignedIn(user) {
    /* No anonymous sessions exist any more (her 20:57 rule):
       a stale one arriving from an old install is signed out,
       never let in. */
    if (user.isAnonymous) { window.FitAuth.signOutUser().then(function () { renderAccount(); }, function () { renderAccount(); }); return; }
    activateAccountStorage(user.uid);
    authUser = user;
    if (window.FitPhotos) window.FitPhotos.setScope(user.uid);
    cloudReady = false; loadRetries = 0;
    loadCloudWithRetry(user, true);
  }
  function afterCloudLoad(user, cloud) {
    mirrorNote = "";
      if (cloud) {
        state = repairKeep(L.mergeStates(cloud, state));
        adoptSignInName(user);
        saveLocal();
        window.FitAuth.saveCloudState(user.uid, state).then(function (r) { cloudWarnings = (r && r.warnings) || []; renderAccount(); maybeSyncPlan(user); }).catch(function () {});
        renderAll(); settleSetupSheet();
        toast(tr("toast.signedInAgain"));
      } else {
        adoptSignInName(user);
        save();
        renderAll(); settleSetupSheet();
      }
      renderAccount();
      /* ENTRY LANDS ON TODAY (Round 3, QA's landing
         observation on build 20): a sign-in completing
         while another view stands — the sign-out and
         sign-in cycle never leaves Settings, the door's
         own home — now lands on Today, the app's home.
         A cold open already starts there, and the tour
         path shows Today itself. */
      showView("today");
      joinFollowUp();
  }
  function initAccountsUnused() {}
  function initAccounts() {
    if (doorStarted || !window.FitAuth || !window.FIT_ACCOUNT_CONFIG) { renderAccount(); return; }
    if (!window.FitAuth.initDoor(window.FIT_ACCOUNT_CONFIG)) { renderAccount(); return; }
    doorStarted = true;
    window.FitAuth.watchUser(function (user) {
      if (user) onSignedIn(user);
      else {
        var previousUser = authUser;
        if (previousUser && !previousUser.isAnonymous) {
          try { localStorage.setItem(accountStateKey(previousUser.uid), JSON.stringify(state)); } catch (e) {}
          state = repairKeep(null);
          try {
            localStorage.setItem(KEY, JSON.stringify(state));
            localStorage.removeItem(OWNER_KEY);
          } catch (e) {}
        }
        authUser = null;
        doorStep = 1; doorEmail = "";
        if (previousUser && !previousUser.isAnonymous) { saveLocal(); renderAll(); }
        renderAccount();
      }
    });
    renderAccount();
  }
  window.addEventListener("fit-auth-ready", initAccounts);
  $("proNotNow").addEventListener("click", closeProMoment);
  $("proGo").addEventListener("click", function () {
    closeProMoment(); openPlans();
  });
  /* The tour wires its own buttons on each render
     (renderTour); there are no standing tour handlers. */
  $("redoSetupBtn").addEventListener("click", function () { openSetup(); });
  $("guideBtn").addEventListener("click", function () { openSetup(); });
  $("emptySetupBtn").addEventListener("click", function () { openSetup(); });
  $("exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "fit-hard-data.json"; a.click(); URL.revokeObjectURL(a.href);
  });

  /* --- Setup pop-up: first open, re-openable, never blocks --- */
  var pickedCuisines = [], pickedNeeds = [];
  function chips(el, items, picked) {
    el.innerHTML = items.map(function (it) {
      var id = typeof it === "string" ? it : it.id, label = typeof it === "string" ? it : tr("need." + it.id, null, it.label);
      return '<button class="chip' + (picked.indexOf(id) !== -1 ? " on" : "") + '" data-chip="' + esc(id) + '">' + esc(label) + "</button>";
    }).join("");
    el.querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-chip"), i = picked.indexOf(id);
        if (i === -1) picked.push(id); else picked.splice(i, 1);
        b.classList.toggle("on");
      });
    });
  }
  function openSetup() {
    var spot = $("wallySetup");
    if (spot) spot.innerHTML = guideOn() && window.Wally ? wallyWrap("welcome", wallyLine("welcome"), 84) : "";
    $("suCompanion").value = (state.settings && state.settings.companionName) || "";
    var p = state.profile || {};
    $("suName").value = p.name || "";
    $("suWeight").value = p.weightKg || ""; $("suHeight").value = p.heightCm || "";
    $("suAge").value = p.age || ""; $("suSex").value = p.formulaSex || "";
    $("suActivity").value = p.activity || "some"; $("suDeficit").value = p.deficit || "gentle";
    var GOAL_KEYS = ["goal.lose", "goal.strength", "goal.fitter", "goal.regular", "goal.doses"];
    $("suGoal").innerHTML = D.GOALS.map(function (g, gi) { return '<option value="' + esc(g) + '"' + ((p.goals || [])[0] === g ? " selected" : "") + ">" + esc(tr(GOAL_KEYS[gi] || "", null, g)) + "</option>"; }).join("");
    $("suAllergies").value = (p.allergies || []).join(", ");
    pickedCuisines = (p.preferences || []).slice();
    pickedNeeds = (p.needs || []).slice();
    chips($("suCuisines"), D.CUISINES, pickedCuisines);
    chips($("suNeeds"), D.NEEDS, pickedNeeds);
    suGo(1);
    $("setupModal").classList.remove("hidden");
    setTimeout(function () { try { $("suName").focus(); } catch (e) {} }, 50);
  }
  /* Three short steps (research: 2-3 screens, optional, skip on each). Step 1 is all the app needs. */
  var suStep = 1, SU_LAST = 3;
  function suGo(n) {
    suStep = Math.max(1, Math.min(SU_LAST, n));
    document.querySelectorAll("#setupModal .suStep").forEach(function (el) { el.classList.toggle("hidden", Number(el.getAttribute("data-su")) !== suStep); });
    $("suCount").textContent = tr("setup.stepOf", { n: suStep, total: SU_LAST }, "Step " + suStep + " of " + SU_LAST);
    $("suBack").classList.toggle("hidden", suStep === 1);
    $("suNext").classList.toggle("hidden", suStep === SU_LAST);
    $("suDone").classList.toggle("hidden", suStep !== SU_LAST);
    $("suNext").textContent = suStep === 1 ? tr("setup.next", null, "Next") : tr("setup.skipStep", null, "Next");
    var card = document.querySelector("#setupModal .modalCard"); if (card) card.scrollTop = 0;
  }
  $("suNext").addEventListener("click", function () { suGo(suStep + 1); });
  $("suBack").addEventListener("click", function () { suGo(suStep - 1); });
  $("setupModal").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") { e.preventDefault(); if (suStep < SU_LAST) suGo(suStep + 1); else $("suDone").click(); }
  });
  function closeSetup() { $("setupModal").classList.add("hidden"); }
  /* FIT (QA leg 7): a restored state that already holds a completed
     setup closes the sheet — the wall must never stand over a
     finished profile (the upgrade case: boot opened it from the
     parked guest state before the demo profile landed). */
  function settleSetupSheet() { if (state.profile && state.profile.setupDone) closeSetup(); }
  $("suSkip").addEventListener("click", function () {
    /* The skip is a birth too (F-B11-1, the chairs' skip
       shape): a first-boot skip on a profile-less state
       births the stamped whole default, exactly as the
       walled builds did — and the skip always persists, so
       no road out of the setup leaves the app unborn. */
    if (!state.profile) { state.profile = { name: "", needs: [], preferences: [], allergies: [], goals: [], setupDone: false, firstSeenAt: new Date().toISOString() }; }
    else ensureFullProfile();
    /* "Not now" is an answer, not a deferral (Round 3):
       the skip marks itself, and the entry auto-offer in
       afterTour respects it from the next entry on. */
    state.profile.setupSkipped = true;
    save();
    closeSetup(); renderAll();
  });
  $("suDone").addEventListener("click", function () {
    state.profile = {
      name: $("suName").value.trim(),
      weightKg: Number($("suWeight").value) > 0 ? Number($("suWeight").value) : null,
      heightCm: Number($("suHeight").value) > 0 ? Number($("suHeight").value) : null,
      age: Number($("suAge").value) > 0 ? Number($("suAge").value) : null,
      formulaSex: $("suSex").value || null,
      activity: $("suActivity").value, deficit: $("suDeficit").value,
      goals: [$("suGoal").value], preferences: pickedCuisines.slice(),
      allergies: $("suAllergies").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      needs: pickedNeeds.slice(), setupDone: true,
      firstSeenAt: (state.profile && state.profile.firstSeenAt) || new Date().toISOString()
    };
    knownFirstSeen = state.profile.firstSeenAt;
    state.settings = state.settings || {};
    state.settings.companionName = $("suCompanion").value.trim();
    save(); closeSetup(); renderAll();
    toast(pickedNeeds.length ? "Saved. Your app now shows only what you picked." :
      "Saved. Nothing picked, so everything stays in view. Change it any time in Settings.");
  });

  function renderAll() { buildSidebar(); renderToday(); renderSettings(); applySidebar(); applyAppearance(); }
  renderAll();
  initAccounts();
  setTimeout(renderAccount, 5000);
  if (!state.profile || !state.profile.setupDone) {
    /* DOOR FIRST (Polar device finding F1, 21 Oct 2026):
       a cold open meets the DOOR, never the setup form.
       The setup follows a sign-in at the door (the tour
       leads into it). There is no other road in. */
    showView("settings");
    setTimeout(function () { var ab = $("accountBox"); if (ab && ab.scrollIntoView) ab.scrollIntoView(); }, 60);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(function () {});
  }
})();
