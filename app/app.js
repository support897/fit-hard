"use strict";
/* Fit App shell. Pattern adapted from Meal Prep app.js + Pace app.js:
   local store, repair-on-load (never drops data), sidebar hidden on
   every load with a session-only toggle, first-open setup pop-up. */
(function () {
  var L = window.FitLogic, D = window.FIT_DATA;
  var KEY = "fit-app-v1";
  var state;
  /* Boot fence (P4): if the last session was a demo (marker
     set) and a parked real state exists, the REAL state is
     what loads — the demo data in the main key never poses
     as the user's own app. If the demo session is still
     alive, startDemo loads the demo afresh from its own
     cloud space. */
  try {
    var bootRaw = localStorage.getItem(KEY);
    if (localStorage.getItem("fit-app-demo") && localStorage.getItem("fit-app-v1-parked")) bootRaw = localStorage.getItem("fit-app-v1-parked");
    state = L.repairState(JSON.parse(bootRaw || "null"));
  }
  catch (e) { state = L.emptyState(); }
  if (window.Lang) Lang.use(state.settings && state.settings.lang);
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
  /* Saves stay on the device first, always. When the user is
     signed in, each save also mirrors to their account
     (Phase 6, P2). A full device (QA Phase 2 advisory) never
     fails silently: the newest changes are held in memory,
     a kind note shows in Settings, and saving retries on the
     next change. */
  var saveFailed = false;
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); saveFailed = false; }
    catch (e) {
      if (!saveFailed) toast(tr("toast.storageFull"));
      saveFailed = true;
    }
    var sn = $("saveNote"); if (sn) sn.textContent = saveFailed ?
      tr("set.saveFull") : "";
  }
  function save() { saveLocal(); scheduleMirror(); }
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
      state.profile = state.profile || {};
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
    var needs = state.profile ? state.profile.needs : [];
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
  }
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () { showView(b.getAttribute("data-view")); });
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
    var sub = a.subs.filter(function (s) { return s.id === subId; })[0] || a.subs[0];
    showView("area");
    $("areaTitle").textContent = tr("nav." + a.id, null, a.label);
    $("areaSub").textContent = tr("sub." + sub.id, null, sub.label) + ".";
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
  function kcalOf(r) { return r ? MP.recipeKcal(r, MN) : null; }
  function mpKey(isoKey) { return String(isoKey).replace(/-/g, "."); }
  function dayLabel(isoKey) {
    var today = L.todayKey();
    if (isoKey === today) return tr("nav.today");
    if (isoKey === L.addDays(today, 1)) return tr("cal.tomorrow");
    return tr("cal.wd" + L.parseKey(isoKey).getDay());
  }
  function budgetKcal() { var b = L.estimateBudget(state.profile || {}); return b ? b.target : null; }
  function planWeek() {
    var target = budgetKcal();
    var recent = [];
    for (var i = 0; i < 7; i++) {
      var iso = L.addDays(L.todayKey(), i);
      var dayTarget = target;
      if (i === 0 && target) dayTarget = L.mealBudgetFor(state.checkins[iso] || "ok", { target: target }).meals;
      var day = L.planDayMeals(dayTarget, allRecipes(), kcalOf, state.profile || {}, recent);
      var entry = {};
      ["breakfast", "lunch", "dinner"].forEach(function (m) { if (day[m]) { entry[m] = day[m].id; recent.push(day[m].id); } });
      state.plan[mpKey(iso)] = entry;
    }
    save();
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
    return '<button class="mealRow" data-recipe="' + r.id + '"><span class="mealDot" style="background:' + colors[meal] + '"></span>' +
      '<span class="mName">' + esc(r.name) + '</span><span class="kcalChip">' + (k == null ? tr("meal.noCount") : tr("meal.aboutKcal", { kcal: k })) + "</span></button>";
  }
  function renderPlan() {
    var el = $("areaBody");
    var target = budgetKcal();
    var html = '<div class="card"><h2>' + esc(tr("meal.week")) + "</h2>" +
      '<p class="hint">' + (target ? tr("legal.planHint", { kcal: target }) :
        tr("meal.planHintNone")) + "</p>" +
      '<div class="row"><button class="primaryBtn" id="planWeekBtn">' + esc(tr("meal.planWeekBtn")) + '</button></div>' +
      '<label>' + esc(tr("meal.noteLabel")) + '<textarea id="mealNote" rows="2" placeholder="' + esc(tr("meal.notePh")) + '"></textarea></label>' +
      '<div class="row"><button class="pillBtn" id="mealNoteBtn">' + esc(tr("meal.sortBtn")) + '</button><button class="pillBtn" id="mealNoteMic">' + esc(tr("meal.voiceBtn")) + '</button></div>' +
      '<p class="hint" id="mealNoteMsg"></p></div>';
    var has = Object.keys(state.plan).length > 0;
    if (!has) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-meal"/></svg><p>' + esc(tr("meal.nonePlanned")) + '</p><p class="hint">' + esc(tr("meal.nonePlannedHint")) + '</p></div>';
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
    $("planWeekBtn").addEventListener("click", function () { planWeek(); renderPlan(); toast(tr("meal.weekPlanned")); showWallyCelebration("plan"); });
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
    el.querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe")); }); });
  }

  function openRecipe(id) {
    var r = recipeById(id); if (!r) return;
    var k = kcalOf(r);
    var ads = state.profile ? MP.adaptations(r, [{ name: "You", allergies: state.profile.allergies || [], dislikes: [] }], MD) : [];
    var html = "<h2>" + esc(r.name) + "</h2>" +
      '<p class="hint">' + esc((r.cuisines || []).join(", ")) + " · " + r.minutes + " min · " + tr("meal.serves", { n: r.servings }) +
      (k == null ? tr("meal.noKcalYet") : tr("meal.perServing", { kcal: k })) + "</p>";
    if (r.picture) html += '<img class="photoImg" alt="' + esc(tr("meal.photoAlt")) + '" src="' + r.picture + '">';
    if (ads.length) html += '<div class="swapBox">' + esc(tr("meal.madeSafe")) + ads.map(function (a) {
      return esc(tr("meal.becomes", { ing: a.ingredient, swap: a.swap })); }).join("; ") + ".</div>";
    if ((r.ingredients || []).length) html += "<h3>" + esc(tr("meal.ingredients")) + "</h3><ul class='ingList'>" + r.ingredients.map(function (i) {
      return "<li>" + esc(i.qty) + " " + esc(i.unit) + " " + esc(i.name) + "</li>"; }).join("") + "</ul>";
    if ((r.steps || []).length) html += "<h3>" + esc(tr("meal.steps")) + "</h3><ol class='stepList'>" + r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    html += '<div class="row"><button class="primaryBtn" id="rmToday">' + esc(tr("meal.putToday")) + '</button><button class="pillBtn" id="rmClose">' + esc(tr("common.close")) + '</button></div>';
    $("recipeModalCard").innerHTML = html;
    $("recipeModal").classList.remove("hidden");
    $("rmClose").addEventListener("click", function () { $("recipeModal").classList.add("hidden"); });
    $("rmToday").addEventListener("click", function () {
      var key = mpKey(L.todayKey());
      if (!state.plan[key]) state.plan[key] = {};
      state.plan[key][r.meal] = r.id; save();
      $("recipeModal").classList.add("hidden"); toast(tr("meal.onToday"));
      if (currentArea === "meals") renderMeals(currentSub);
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
      '<div class="row"><input id="picName" type="text" placeholder="' + esc(tr("meal.picNamePh")) + '"><input id="picFile" type="file" accept="image/*"></div><div id="picPreview"></div>' +
      '<div class="row"><button class="pillBtn" id="picSave">' + esc(tr("meal.savePic")) + '</button></div></div>' +
      '<div class="card"><h2>' + esc(tr("meal.allRecipes")) + '</h2><div class="row"><input id="recipeSearch" type="text" placeholder="' + esc(tr("meal.searchPh")) + '"></div><div id="recipeList" class="recipeGrid"></div></div>';
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
      state.customRecipes.push({ id: "custom." + Date.now(), name: name, meal: "dinner", cuisines: ["Mine"],
        minutes: 30, servings: 2, ingredients: [], steps: [], custom: true, picture: picData });
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
      var found = MP.findRecipeByName(name, MD, state.customRecipes || []);
      var r = found || MP.makeRecipeFromName(name, MD, state.customRecipes || []);
      $("nameMealResult").innerHTML = '<div class="swapBox">' + esc(r.name) + " · " + r.minutes + " min · " +
        (kcalOf(r) == null ? tr("meal.noCount") : tr("meal.aboutKcal", { kcal: kcalOf(r) })) +
        (found ? tr("meal.alreadyIn") : ' <button class="miniBtn" id="nameMealSave">' + esc(tr("meal.saveThis")) + '</button>') + "</div>";
      var sv = $("nameMealSave");
      if (sv) sv.addEventListener("click", function () { state.customRecipes.push(r); save(); renderRecipes(); toast(tr("common.saved")); });
    });
    function drawList(filter) {
      var list = allRecipes().filter(function (r) { return !filter || r.name.toLowerCase().indexOf(filter) !== -1; });
      $("recipeList").innerHTML = list.map(function (r) {
        var k = kcalOf(r);
        return '<button class="recipeCard" data-recipe="' + r.id + '">' + (r.picture ? '<img alt="" src="' + r.picture + '">' : "") +
          "<h3>" + esc(r.name) + "</h3><p>" + esc(tr("meal." + r.meal, null, r.meal)) + " · " + r.minutes + " min</p><p>" +
          (k == null ? tr("meal.noCount") : tr("meal.aboutPerServing", { kcal: k })) + "</p></button>";
      }).join("") || '<p class="hint">' + esc(tr("meal.noMatchSearch")) + '</p>';
      $("recipeList").querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe")); }); });
    }
    drawList("");
    $("recipeSearch").addEventListener("input", function () { drawList($("recipeSearch").value.trim().toLowerCase()); });
  }

  function renderFridge() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("meal.fridgeTitle")) + '</h2>' +
      '<p class="hint">' + esc(tr("meal.fridgeHint")) + '</p>' +
      '<input id="fridgePhoto" type="file" accept="image/*"><div id="photoPreview"></div>' +
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
        return '<button class="mealRow" data-idea="' + x.r.id + '"><span class="mName">' + esc(x.r.name) + '</span><span class="kcalChip">' +
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
      '<div class="row"><button class="pillBtn" id="trQuickBtn">' + esc(tr("meal.sortTreats")) + '</button><button class="pillBtn" id="trMic">' + esc(tr("meal.voiceBtn")) + '</button></div></div>';
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
    var planMP = state.plan;
    var items = MP.buildGroceryList(planMP, allRecipes(), state.pantry || []);
    var pantrySorted = MP.sortByExpiry((state.pantry || []).slice(), new Date(), MD);
    var html = '<div class="card"><h2>' + esc(tr("meal.groceryList")) + '</h2><p class="hint">' + esc(tr("meal.grocHint")) + '</p>' +
      (items.length ? items.map(function (i) {
        return '<div class="listRow"><span class="grow">' + esc(i.name) + " · " + esc(i.qty) + " " + esc(i.unit) + "</span>" +
          (i.haveIt ? '<span class="haveIt">' + esc(tr("meal.haveIt")) + '</span>' : "") + "</div>";
      }).join("") : '<p class="hint">' + esc(tr("meal.noPlanYet")) + '</p>') +
      '<div class="row"><input id="extraName" type="text" placeholder="' + esc(tr("meal.addAnythingPh")) + '"><button class="pillBtn" id="extraAdd">' + esc(tr("common.add")) + '</button></div>' +
      (state.extras || []).map(function (x) { return '<div class="listRow"><span class="grow">' + esc(x.name) + "</span></div>"; }).join("") + "</div>";
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
    $("extraAdd").addEventListener("click", function () {
      var n = $("extraName").value.trim(); if (!n) return;
      state.extras.push({ id: "x" + Date.now(), name: n }); save(); renderGroceries();
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
      if (entry[m]) { var r = recipeById(entry[m]); if (r) evs.push({ color: "#97795D", label: r.name, kind: "meal", id: r.id }); }
    });
    (state.sessions || []).forEach(function (s) { if (s.dateKey === iso && s.status === "done") evs.push({ color: "#52695A", label: tr("cal.gymSession"), kind: "gym" }); });
    (state.routines || []).forEach(function (r) { if (L.routineDueOn(r, iso)) evs.push({ color: "#7A8B6F", label: r.name + (r.time ? " " + r.time : ""), kind: "routine" }); });
    (state.peptides || []).forEach(function (p) {
      (p.log || []).forEach(function (lg) { if (lg.dateKey === iso) evs.push({ color: p.color, label: p.name, kind: "peptide" }); });
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
    el.querySelectorAll("[data-day]").forEach(function (b) {
      b.addEventListener("click", function () { calSelected = b.getAttribute("data-day"); renderMonth(); });
    });
    if (calSelected) renderDayDetail(calSelected);
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
        '" data-todo="' + t.id + '">' + (t.status === "done" ? "✓" : "") + '</button><span class="tTitle">' + esc(t.title) + "</span>" +
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
    box.querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe")); }); });
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
    if (!(state.habits || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-cal"/></svg><p>' + esc(tr("cal.noHabits")) + '</p><p class="hint">' + esc(tr("cal.habitHint")) + '</p></div>';
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
          '" data-todo="' + t.id + '">' + (t.status === "done" ? "✓" : "") + '</button><span class="mealDot" style="background:' + esc(t.color) + '"></span>' +
          '<span class="tTitle">' + esc(t.title) + "</span>" +
          (t.time ? '<span class="kcalChip">' + esc(t.time) + "</span>" : "") +
          '<span class="kcalChip">' + t.durationMin + ' min</span><button class="miniBtn" data-del="' + t.id + '">' + esc(tr("common.remove")) + '</button></div>';
      }).join("") + waitingNote + "</div>";
    });
    if (!(state.todos || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-list"/></svg><p>' + esc(tr("cal.listEmpty")) + '</p><p class="hint">' + esc(tr("cal.dumpHint")) + '</p></div>';
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
  }
  function renderCalendar(subId) {
    if (subId === "cal-habits") renderHabits();
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
  function exRow(item, ex) {
    if (!ex) return "";
    return '<div class="exRow"><span class="exTile"><svg><use href="#i-gym"/></svg></span>' +
      '<span class="eName">' + esc(ex.name) + '<br><span class="eMeta">' + esc(ex.partLabel) + " · " + esc(ex.equipment) + "</span></span>" +
      '<span class="kcalChip">' + esc(tr("gym.setsChip", { sets: item.sets, reps: item.reps, unit: item.timed ? tr("gym.sec") : tr("gym.reps") })) + "</span></div>";
  }
  function routineCard(r) {
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (di) { return tr("cal.wd" + di); });
    var html = '<div class="card"><h2>' + esc(r.name) + (r.lightened ? tr("gym.lighterVersion") : "") + "</h2>" +
      '<p class="hint">' + esc(tr("gym.aboutMin", { m: r.minutes })) + " · " + (r.days && r.days.length ? r.days.map(function (d) { return days[d]; }).join(", ") : tr("gym.anyDay")) +
      (r.time ? " · " + esc(r.time) : "") + "</p>" +
      (r.items || []).map(function (it) { if (!it || typeof it !== "object") return ""; return exRow(it, exerciseById(it.exerciseId)); }).join("") +
      '<div class="row"><button class="primaryBtn" data-start="' + r.id + '">' + esc(tr("gym.startSession")) + '</button>' +
      '<button class="pillBtn" data-delroutine="' + r.id + '">' + esc(tr("gym.removeRoutine")) + '</button></div></div>';
    return html;
  }
  function renderRoutines() {
    var el = $("areaBody");
    var goalOpts = L.GYM_GOALS.map(function (g) { return '<option value="' + g.id + '">' + esc(tr("gymgoal." + g.id, null, g.label)) + "</option>"; }).join("");
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
    if (!(state.routines || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-gym"/></svg><p>' + esc(tr("gym.noRoutines")) + '</p><p class="hint">' + esc(tr("gym.noRoutinesHint")) + '</p></div>';
    (state.routines || []).forEach(function (r) { html += routineCard(r); });
    el.innerHTML = html;
    el.querySelectorAll("[data-gyday]").forEach(function (b) { b.addEventListener("click", function () { b.classList.toggle("on"); }); });
    $("gyBuild").addEventListener("click", function () {
      var built = L.buildRoutine($("gyGoal").value, Number($("gyMinutes").value), EX.EXERCISES);
      if (built) built.name = tr("gymgoal." + built.goalId, null, built.name);
      if (!built || !built.items.length) { toast(tr("gym.goalOdd")); return; }
      var days = [];
      el.querySelectorAll("[data-gyday].on").forEach(function (b) { days.push(Number(b.getAttribute("data-gyday"))); });
      state.routines.push(Object.assign({}, built, { id: "routine." + Date.now(), days: days,
        time: $("gyTime").value || null, createdKey: L.todayKey() }));
      save(); renderRoutines(); toast(tr("gym.built"));
    });
    el.querySelectorAll("[data-start]").forEach(function (b) { b.addEventListener("click", function () { startSession(b.getAttribute("data-start")); }); });
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
    state.sessions.push({ id: "session." + Date.now(), dateKey: L.todayKey(), routineId: r.id,
      routineName: r.name, status: "active", idx: 0, set: 1, doneSets: 0,
      startedAt: Date.now(), items: use.items, lightened: !!use.lightened });
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
    if (!ex) { finishSession(s, true); return; }
    var pips = "";
    for (var i = 1; i <= item.sets; i++) pips += '<span class="pip' + (i < s.set ? " done" : "") + '"></span>';
    el.innerHTML = skinAskHtml() + '<div class="card"><h2>' + esc(s.routineName) + (s.lightened ? tr("gym.lighterSuffix") : "") + '</h2>' +
      '<p class="hint">' + esc(tr("gym.exOf", { a: s.idx + 1, b: s.items.length })) + '<span id="sessClock">0:00</span></p>' +
      '<div class="exRow"><span class="exTile"><svg><use href="#i-gym"/></svg></span><span class="eName sessionBig">' + esc(ex.name) +
      '<br><span class="eMeta">' + esc(ex.partLabel) + " · " + esc(ex.equipment) + "</span></span></div>" +
      '<p class="hint">' + esc(ex.cue) + "</p>" +
      '<div id="animMount"></div>' +
      '<div class="setPips">' + pips + '</div><p class="hint">' + esc(tr("gym.setOf", { a: s.set, b: item.sets })) + "</p>" +
      (item.timed
        ? '<div class="timerBig" id="countBox">' + item.reps + esc(tr("gym.secSuffix")) + '</div><div class="row"><button class="primaryBtn" id="holdBtn">' + esc(tr("gym.startHold")) + '</button></div>'
        : '<div class="repCount" id="repCount">0</div><p class="hint" style="text-align:center">' + esc(tr("gym.repsHint")) + '</p>' +
          '<div class="row"><button class="pillBtn" id="repMinus">' + esc(tr("gym.minus1")) + '</button><button class="primaryBtn" id="repPlus">' + esc(tr("gym.plus1")) + '</button><button class="primaryBtn" id="setDone">' + esc(tr("gym.doneSet")) + '</button></div>' +
          '<div class="timerBig" id="countBox"></div><div class="row"><button class="pillBtn" id="restBtn">' + esc(tr("gym.startRest", { sec: item.restSec })) + '</button></div>') +
      '<div class="row"><button class="pillBtn" id="nextEx">' + esc(tr("gym.nextEx")) + '</button><button class="pillBtn" id="finishBtn">' + esc(tr("gym.finishSession")) + '</button></div></div>';
    var reps = 0;
    function tickClock() { var c = $("sessClock"); if (c) c.textContent = fmtClock((Date.now() - s.startedAt) / 1000); }
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
      var box = $("countBox");
      function draw() { if (box) box.textContent = tr("gym." + label + "Label") + " " + fmtClock(left); }
      draw();
      gymTimer = setInterval(function () {
        left--; draw(); tickClock();
        if (left <= 0) { var tEnd = restAnim && restAnim.time ? restAnim.time() : 0; stopGymTimer(); gymTimer = setInterval(tickClock, 1000); if (box) box.textContent = tr("gym.countDone"); mountAnim(ex, tEnd); if (after) after(); }
      }, 1000);
    }
    if (item.timed) $("holdBtn").addEventListener("click", function () { countdown(item.reps, "hold", function () {}); });
    else {
      $("repPlus").addEventListener("click", function () { reps++; $("repCount").textContent = reps; });
      $("repMinus").addEventListener("click", function () { reps = Math.max(0, reps - 1); $("repCount").textContent = reps; });
      $("restBtn").addEventListener("click", function () { countdown(item.restSec, "rest", null); });
      $("setDone").addEventListener("click", function () {
        s.doneSets++;
        if (s.set >= item.sets) { s.idx++; s.set = 1; } else s.set++;
        save();
        if (s.idx >= s.items.length) finishSession(s, false); else renderSession();
      });
    }
    $("nextEx").addEventListener("click", function () { s.idx++; s.set = 1; save(); if (s.idx >= s.items.length) finishSession(s, false); else renderSession(); });
    $("finishBtn").addEventListener("click", function () { finishSession(s, false); });
    wireSkinAsk(el);
    mountAnim(ex);
  }
  function finishSession(s, silent) {
    stopGymTimer();
    s.status = "done";
    s.minutes = Math.max(1, Math.round((Date.now() - (s.startedAt || Date.now())) / 60000));
    save();
    if (!silent) { toast(tr("gym.sessionSaved")); showWallyCelebration("session"); }
    renderSession();
  }
  function renderMachine() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>' + esc(tr("gym.showMachine")) + '</h2>' +
      '<p class="hint">' + esc(tr("gym.machineHint")) + '</p>' +
      '<input id="mcPhoto" type="file" accept="image/*"><div id="mcPreview"></div>' +
      '<div class="machineGrid" id="mcGrid">' + EX.MACHINES.map(function (m) {
        return '<button class="chip" data-machine="' + m.id + '">' + esc(m.name) + "</button>"; }).join("") + "</div>" +
      '<div id="mcResult"></div></div>';
    $("mcPhoto").addEventListener("change", function () {
      var f = $("mcPhoto").files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { $("mcPreview").innerHTML = '<img class="photoImg" alt="' + esc(tr("gym.machineAlt")) + '" src="' + String(rd.result) + '">'; };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll("[data-machine]").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = EX.MACHINES.filter(function (x) { return x.id === b.getAttribute("data-machine"); })[0];
        if (!m) return;
        var items = m.exerciseIds.map(function (id) {
          var e = exerciseById(id);
          return { exerciseId: id, sets: 3, reps: e && e.timed ? e.timed : 12, timed: !!(e && e.timed), restSec: 45 };
        });
        $("mcResult").innerHTML = '<div class="card"><h2>' + esc(m.name) + "</h2>" +
          items.map(function (it) { return exRow(it, exerciseById(it.exerciseId)); }).join("") +
          '<div class="row"><button class="primaryBtn" id="mcMake">' + esc(tr("gym.makeRoutine")) + '</button></div></div>';
        $("mcMake").addEventListener("click", function () {
          state.routines.push({ id: "routine." + Date.now(), name: m.name + tr("gym.routineSuffix"), goalId: null,
            minutes: 30, days: [], time: null, createdKey: L.todayKey(), items: items });
          save(); toast(tr("gym.routineSaved")); openArea("gym", "gym-routines");
        });
      });
    });
  }
  function renderGym(subId) {
    if (subId === "gym-session") renderSession();
    else if (subId === "gym-machine") renderMachine();
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
    if (subId === "pep-log") renderPepLog();
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
      '<div class="row"><button class="primaryBtn" id="ppAdd">' + esc(tr("pep.saveBtn")) + '</button></div></div>';
    if (!(state.peptides || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-pep"/></svg><p>' + esc(tr("pep.nothingTracked")) + '</p><p class="hint">' + esc(tr("pep.nothingHint")) + '</p></div>';
    (state.peptides || []).forEach(function (p) {
      html += '<div class="card"><h2><span class="mealDot" style="background:' + esc(p.color) + ';display:inline-block"></span> ' + esc(p.name) + "</h2>" +
        '<p class="hint">' + esc(tr("pep.youTake", { amount: p.amount, unit: tr("pep.unit" + p.unit.charAt(0).toUpperCase() + p.unit.slice(1), null, p.unit) })) + " · " + scheduleText(p) + (p.time ? " · " + esc(p.time) : "") + "</p>" +
        '<p class="dayTotal">' + nextDoseLine(p) + "</p>" +
        '<div class="row"><label style="flex:1">' + esc(tr("pep.amountThisTime")) + '<input type="text" inputmode="decimal" id="amt-' + p.id + '" value="' + esc(p.amount) + '"></label>' +
        '<button class="primaryBtn" data-log="' + p.id + '">' + esc(tr("pep.logDose")) + '</button>' +
        '<button class="pillBtn" data-delpep="' + p.id + '">' + esc(tr("common.remove")) + '</button></div></div>';
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
        color: L.nextColor((state.peptides || []).map(function (p) { return p.color; })), schedule: schedule, time: $("ppTime").value || null, log: [] });
      save(); renderPepList(); toast(tr("pep.toastSaved"));
    });
    el.querySelectorAll("[data-log]").forEach(function (b) { b.addEventListener("click", function () {
      var p = peptideById(b.getAttribute("data-log")); if (!p) return;
      var amt = ($("amt-" + p.id) || {}).value || p.amount;
      var now = new Date();
      p.log.push({ dateKey: L.todayKey(), time: ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2),
        amount: String(amt).trim() || p.amount, unit: p.unit });
      save(); renderPepList(); toast(tr("pep.toastLogged")); showWallyCelebration("dose");
    }); });
    el.querySelectorAll("[data-delpep]").forEach(function (b) { b.addEventListener("click", function () {
      state.peptides = state.peptides.filter(function (p) { return p.id !== b.getAttribute("data-delpep"); });
      save(); renderPepList();
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
        '<span class="grow">' + esc(r.p.name) + " · " + esc(r.lg.amount) + " " + esc(r.lg.unit) + "</span>" +
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
    });
    html += "</div>";
    el.innerHTML = html;
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

  function renderCheckin() {
    var today = L.todayKey();
    var level = state.checkins[today];
    $("checkinRow").innerHTML = D.CHECKINS.map(function (c) {
      return '<button class="checkinBtn' + (level === c.id ? " active" : "") + '" data-level="' + c.id + '">' + esc(tr("checkin." + c.id, null, c.label)) + "</button>";
    }).join("");
    document.querySelectorAll(".checkinBtn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.checkins[L.todayKey()] = b.getAttribute("data-level"); save(); renderToday();
        var c = D.CHECKINS.filter(function (x) { return x.id === b.getAttribute("data-level"); })[0];
        toast(tr("checkin." + c.id + "Hint", null, c.hint));
      });
    });
    var cur = D.CHECKINS.filter(function (x) { return x.id === level; })[0];
    $("checkinHint").textContent = cur ? tr("checkin." + cur.id + "Hint", null, cur.hint) : tr("checkin.none");
    renderWallyCheckin();
  }
  function renderToday() {
    var p = state.profile;
    $("stripHi").textContent = p && p.name ? tr("today.hiPlain", { name: p.name }) : "";
    $("todayTitle").textContent = p && p.name ? tr("today.hiPlain", { name: p.name }) : tr("nav.today");
    renderCheckin();
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
    } else { $("budgetCard").hidden = true; }
    var setUp = !!(p && p.setupDone);
    $("todayEmpty").hidden = setUp;
    var ew = $("emptyWally");
    if (ew) ew.innerHTML = !setUp && guideOn() && window.Wally ? wallyWrap("welcome", wallyLine("welcome"), 64) : "";
    var split = L.areasForNeeds(setUp ? p.needs : ["meals", "gym", "peptides", "calendar"]);
    $("todayAreas").innerHTML = split.active.map(function (id) {
      var a = areaById(id);
      return '<button class="areaCard" data-open="' + id + '"><span class="dot ic-' + id + '">' +
        '<svg class="ic"><use href="' + iconFor(id) + '"/></svg></span><h3>' + esc(tr("nav." + id, null, a.label)) + "</h3>" +
        "<p>" + esc(tr("area.tapOpen")) + "</p></button>";
    }).join("");
    document.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = areaById(b.getAttribute("data-open")); openArea(a.id, a.subs[0].id); });
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
    renderAppearance();
    renderAccount();
  }
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
  /* The language row (Settings > Appearance): Auto follows
     the device; a named language pins it. The choice is
     the user's setting, saved like every other. */
  function setLang(choice) {
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
  /* Demo (P4, SPARK SHAPE): a demo session is an anonymous
     session seeded from the invented fixture. The real device
     state is PARKED under a separate key before the demo
     starts and restored when it ends — a demo never touches
     the user's own data, and a demo session never converts
     into a real account (sign-up starts fresh after leaving). */
  var PARK_KEY = "fit-app-v1-parked", DEMO_MARK = "fit-app-demo";
  var demoMode = false, demoPending = false, demoPendingHash = null, reviewerOpen = false;
  var doorStep = 1, doorEmail = "";
  function parkDeviceState() {
    try { if (!localStorage.getItem(PARK_KEY)) localStorage.setItem(PARK_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function restoreParkedState() {
    try {
      var raw = localStorage.getItem(PARK_KEY);
      if (raw) { state = L.repairState(JSON.parse(raw)); localStorage.removeItem(PARK_KEY); }
      localStorage.removeItem(DEMO_MARK);
    } catch (e) {}
    demoMode = false; saveLocal();
  }
  function sha256Hex(text) {
    if (!window.crypto || !crypto.subtle) return Promise.resolve(null);
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  var mirrorTimer = null;
  function scheduleMirror() {
    if (!authUser || !window.FitAuth) return;
    if (mirrorTimer) clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(function () {
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
  function renderAccount() {
    var box = $("accountBox"); if (!box) return;
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
         app). The demo stays as its own quiet entry
         below, in its sealed Spark shape. */
      var GOOGLE_G = '<svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
      var APPLE_G = '<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.5.96 1.39 2.1 2.94 3.6 2.88 1.45-.06 2-.93 3.74-.93s2.24.93 3.77.9c1.56-.02 2.55-1.41 3.5-2.8 1.1-1.62 1.56-3.18 1.58-3.26-.03-.02-3.04-1.17-3.07-4.59zM14.16 4.06c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.74-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.63z"/></svg>';
      var ARROW = '<svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      if (doorStep === 2) {
        box.innerHTML = '<div class="doorPage"><div class="doorCol">' +
          '<div class="doorBigMark"><img src="icon.svg" alt=""></div>' +
          '<div class="doorEmailRow"><span>' + esc(doorEmail) + '</span><button class="miniBtn" id="accChangeBtn">' + esc(tr("door.change")) + '</button></div>' +
          '<label>' + esc(tr("door.password")) + '<input id="accPass" type="password" autocomplete="current-password" placeholder="' + esc(tr("door.passwordPh")) + '"></label>' +
          '<div class="row"><button class="primaryBtn" id="accContinueBtn">' + esc(tr("door.continueBtn")) + '</button></div>' +
          '<p class="hint">' + esc(tr("door.continueHint")) + '</p>' +
          '<div class="row"><span class="hint">' + esc(tr("door.forgot")) + '</span>' +
          '<button class="miniBtn" id="accForgotBtn">' + esc(tr("door.reset")) + '</button></div>' +
          '</div></div>';
        $("accChangeBtn").addEventListener("click", function () { doorStep = 1; renderAccount(); });
        $("accContinueBtn").addEventListener("click", function () {
          var pw = $("accPass").value;
          if (!pw) { toast(tr("door.tPwFirst")); return; }
          /* One button, both roads: sign in; a credential
             refusal may simply mean "new here", so offer
             the pair to account creation. An existing
             email answers already-in-use, and the user
             hears the same one honest line as a wrong
             password (Security's PW delta holds). */
          window.FitAuth.signInWithEmail(doorEmail, pw).catch(function (e) {
            var c = (e && e.code) || "";
            if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") {
              window.FitAuth.signUpWithEmail(doorEmail, pw).then(function () { toast(tr("door.tMade")); })
                .catch(function (e2) {
                  if (((e2 && e2.code) || "") === "auth/email-already-in-use") toast(tr("door.tMismatch"));
                  else toast(authErrWords(e2, "sign-up"));
                });
            } else { toast(authErrWords(e, "sign-in")); }
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
        '<div class="doorBigMark"><img src="icon.svg" alt=""></div>' +
        '<div class="doorBigName">Fit Hard</div>' +
        '<div class="doorBigSub">' + esc(tr("door.sub")) + '</div>' +
        '<div class="doorIcons"><button class="doorIconBtn" id="accGoogleBtn" aria-label="Continue with Google">' + GOOGLE_G + '</button>' +
        '<button class="doorIconBtn" id="accAppleBtn" aria-label="Continue with Apple">' + APPLE_G + '</button></div>' +
        '<div class="doorOr">' + esc(tr("door.orEmail")) + '</div>' +
        '<input id="accEmail" type="email" autocomplete="email" aria-label="Email" placeholder="you@example.com">' +
        '<button class="doorNext" id="accNextBtn" aria-label="Next">' + ARROW + '</button>' +
        '</div>' +
        '<p class="hint">' + esc(tr("door.demoHint")) + '</p>' +
        '<div class="row doorDemoRow"><button class="pillBtn" id="accDemoBtn">' + esc(tr("door.demoBtn")) + '</button>' +
        '<button class="pillBtn" id="accReviewerBtn">' + esc(tr("door.reviewerBtn")) + '</button></div>' +
        (reviewerOpen ? '<div class="grid2"><label>' + esc(tr("door.codeLabel")) + '<input id="accCode" type="text" autocomplete="off" placeholder="' + esc(tr("door.codePh")) + '"></label></div>' +
          '<div class="row"><button class="pillBtn" id="accCodeBtn">' + esc(tr("door.codeBtn")) + '</button></div>' : "") + '</div>';
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
        window.FitAuth.signInWithGoogle().catch(function () { toast(tr("acc.googleFail")); });
      });
      $("accAppleBtn").addEventListener("click", function () {
        window.FitAuth.signInWithApple().catch(function () { toast(tr("acc.appleFail")); });
      });
      $("accDemoBtn").addEventListener("click", function () { enterDemo(null); });
      $("accReviewerBtn").addEventListener("click", function () { reviewerOpen = true; renderAccount(); });
      var codeBtn = $("accCodeBtn");
      if (codeBtn) codeBtn.addEventListener("click", function () {
        var code = $("accCode").value.trim();
        if (!code) { toast(tr("acc.codeFirst")); return; }
        sha256Hex(code).then(function (hash) {
          if (!hash) { toast(tr("acc.codeSecure")); return; }
          enterDemo(hash);
        });
      });
      return;
    }
    if (demoMode) {
      box.innerHTML = '<p class="hint">' + esc(tr("acc.demoExploring")) + '</p>' +
        '<div class="row"><button class="pillBtn" id="accLeaveBtn">' + esc(tr("acc.leaveDemo")) + '</button></div>';
      $("accLeaveBtn").addEventListener("click", function () {
        window.FitAuth.signOutUser().catch(function () {});
      });
      return;
    }
    var planLine = (window.FitAuth && window.FitAuth.planOf(state) === "pro")
      ? '<p class="hint">' + esc(tr("acc.planPro")) + '</p>'
      : '<div class="row"><span class="hint">' + esc(tr("acc.planFree")) + '</span><button class="miniBtn" id="accProBtn">' + esc(tr("pro.seeAdds")) + '</button></div>';
    var warn = cloudWarnings.length ? '<p class="hint">' + esc(tr("acc.warnLarge")) + '</p>' : "";
    var note = mirrorNote ? '<p class="hint">' + esc(mirrorNote) + "</p>" : "";
    box.innerHTML = '<p class="hint">' + esc(tr("acc.signedIn", { email: authUser.email || tr("acc.yourAccount") })) + "</p>" + planLine + warn + note +
      (deleteArmed ?
        '<p class="hint">' + esc(tr("acc.deleteAsk")) + '</p>' +
        (isPasswordUser() ? '<div class="grid2"><label>' + esc(tr("acc.deletePwLabel")) + '<input id="accDeletePass" type="password" autocomplete="current-password" placeholder="' + esc(tr("door.passwordPh")) + '"></label></div>' : "") +
        '<div class="row"><button class="pillBtn" id="accDeleteYes">' + esc(tr("acc.deleteYes")) + '</button><button class="pillBtn" id="accDeleteNo">' + esc(tr("acc.deleteNo")) + '</button></div>' :
        '<div class="row"><button class="pillBtn" id="accOutBtn">' + esc(tr("acc.signOut")) + '</button><button class="pillBtn" id="accDeleteBtn">' + esc(tr("acc.deleteBtn")) + '</button></div>');
    var proBtn = $("accProBtn"); if (proBtn) proBtn.addEventListener("click", showProMoment);
    var out = $("accOutBtn"); if (out) out.addEventListener("click", function () {
      window.FitAuth.signOutUser().then(function () { toast(tr("acc.signedOut")); });
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
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
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
  function enterDemo(hash) {
    if (!window.FitAuth || !window.FitAuth.enterDemoSession) { toast(tr("acc.demoResting")); return; }
    demoPending = true; demoPendingHash = hash || null;
    window.FitAuth.enterDemoSession().catch(function () {
      demoPending = false;
      toast(tr("acc.demoFail"));
    });
  }
  function demoPicks() {
    var byMeal = { breakfast: [], lunch: [], dinner: [] };
    MD.RECIPES.forEach(function (r) { if (byMeal[r.meal]) byMeal[r.meal].push(r.id); });
    var days = [];
    for (var i = 0; i < 7; i++) days.push({
      breakfast: byMeal.breakfast[i % byMeal.breakfast.length],
      lunch: byMeal.lunch[(i + 2) % byMeal.lunch.length],
      dinner: byMeal.dinner[(i + 4) % byMeal.dinner.length] });
    var monday = L.addDays(L.todayKey(), -((new Date().getDay() + 6) % 7));
    var routine = L.buildRoutine("legs", 30, EX.EXERCISES);
    return { days: days, routine: routine, mondayISO: monday, todayISO: L.todayKey(), disclaimerVersion: D.DISCLAIMER_VERSION };
  }
  function startDemo(user) {
    authUser = user; demoMode = true; demoPending = false;
    parkDeviceState();
    try { localStorage.setItem(DEMO_MARK, "1"); } catch (e) {}
    window.FitAuth.loadCloudState(user.uid).then(function (cloud) {
      if (cloud && cloud.profile) {
        state = L.repairState(cloud);
        if (demoPendingHash) state.demoUnlock = demoPendingHash;
      } else {
        state = L.repairState(window.FitDemo.buildDemoState(demoPicks()));
        state.demoUnlock = demoPendingHash;
      }
      demoPendingHash = null;
      saveLocal();
      window.FitAuth.saveCloudState(user.uid, state).catch(function () {});
      renderAll();
      toast(tr("acc.demoWelcome"));
    }).catch(function () {
      state = L.repairState(window.FitDemo.buildDemoState(demoPicks()));
      state.demoUnlock = demoPendingHash; demoPendingHash = null;
      saveLocal(); renderAll();
    });
  }
  /* Two-hat plan sync: once per session, for a real signed-in
     user. Runs only after
     a cloud round trip, so the account root exists (CS order).
     The answer is stored in state.tier — the slice itself is
     written by FitAuth.syncPlan under the rules gate. */
  var planSynced = false;
  function maybeSyncPlan(user) {
    if (planSynced || demoMode || !user || user.isAnonymous || !window.FitAuth || !window.FitAuth.syncPlan) return;
    planSynced = true;
    window.FitAuth.syncPlan(user.uid, false).then(function (p) {
      if (p) { state.tier = { plan: p }; saveLocal(); renderAccount(); }
    }).catch(function () {});
  }
  /* The name asked at sign-up (her ruling, 15 Oct 2026):
     carried on the profile, so the app and Wally greet the
     user by it. A name typed at Create account wins first;
     a Google name is adopted when the profile has none.
     An existing profile name is never overwritten. */
  function adoptSignInName(user) {
    var adopt = (pendingName || user.displayName || "").trim().slice(0, 60);
    pendingName = "";
    if (!adopt) return;
    state.profile = state.profile || {};
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
    if (joinPopped || demoMode || !authUser) return;
    joinPopped = true;
    if (!guideOn() || (state.settings && state.settings.tourSeen)) { afterTour(); return; }
    showView("today");
    tourRanThisSession = true;
    tourStep = 1;
    renderTour();
  }
  function afterTour() {
    maybeNameReoffer();
    if (authUser && state.profile && !state.profile.setupDone) openSetup();
  }
  /* THE NAME RE-OFFER (HQ ruling 15 Oct 2026): if the
     tour's name step was closed or skipped UNANSWERED,
     the guide re-offers it ONCE on the NEXT visit (one
     small quiet bubble on Today, never in the same
     session), then never again. After that the name
     lives in Settings and setup; the greeting stays
     generic and a missing name blocks nothing. */
  function maybeNameReoffer() {
    if (demoMode || !authUser || !guideOn()) return;
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
    return [1, 2, 3, 4].map(function (i) { return i === tourStep ? "●" : "○"; }).join(" ");
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
      dim.classList.add("hidden");
      sbOpen = true; applySidebar();
      card.className = "tourCard tourMenu";
      card.innerHTML = x +
        '<p class="tourLine">' + esc(tr("tour.menu")) + '</p>' +
        '<div class="tourRow">' + skip + '<button class="primaryBtn tourNext" id="tourNext">' + esc(tr("tour.next")) + ' →</button></div>' +
        '<div class="tourDots">' + tourDots() + '</div>';
    } else if (tourStep === 3) {
      dim.classList.add("hidden");
      sbOpen = false; applySidebar();
      card.className = "tourCard tourBottom";
      card.innerHTML = x +
        '<p class="tourLine">' + esc(tr("tour.day")) + '</p>' +
        '<div class="tourRow">' + skip + '<button class="primaryBtn tourNext" id="tourNext">' + esc(tr("tour.next")) + ' →</button></div>' +
        '<div class="tourDots">' + tourDots() + '</div>';
    } else {
      dim.classList.remove("hidden");
      card.className = "tourCard tourCenter";
      card.innerHTML = x + face +
        '<p class="tourLine">' + esc(tr("tour.done")) + '</p>' +
        '<div class="tourRow"><span></span><button class="primaryBtn tourNext" id="tourDone">' + esc(tr("tour.doneBtn")) + ' ✓</button></div>' +
        '<div class="tourDots">' + tourDots() + '</div>';
    }
    var nx = $("tourNext"); if (nx) nx.addEventListener("click", tourAdvance);
    var dn = $("tourDone"); if (dn) dn.addEventListener("click", endTour);
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
        state.profile = state.profile || {};
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
    if (tourStep === 1) {
      var inp = $("tourName");
      if (inp) {
        var v = inp.value.trim().slice(0, 60);
        state.profile = state.profile || {};
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
    if (demoMode) { toast(tr("tour.tDemo")); return; }
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
  function showProMoment() {
    var w = $("proWally");
    if (w) w.innerHTML = guideOn() && window.Wally ? wallyWrap("welcome", tr("pro.bubble"), 64) : "";
    $("proModal").classList.remove("hidden");
  }
  function closeProMoment() { $("proModal").classList.add("hidden"); }
  function onSignedIn(user) {
    if (user.isAnonymous) { startDemo(user); return; }
    /* Race fence: if a real sign-in lands while a demo is on
       screen, the device copy is restored BEFORE the merge,
       so demo data can never join a real account. */
    if (demoMode) restoreParkedState();
    authUser = user;
    window.FitAuth.loadCloudState(user.uid).then(function (cloud) {
      if (cloud) {
        state = L.repairState(L.mergeStates(cloud, state));
        adoptSignInName(user);
        saveLocal();
        window.FitAuth.saveCloudState(user.uid, state).then(function (r) { cloudWarnings = (r && r.warnings) || []; renderAccount(); maybeSyncPlan(user); }).catch(function () {});
        renderAll();
        toast(tr("toast.signedInAgain"));
      } else {
        adoptSignInName(user);
        save();
        renderAll();
      }
      renderAccount();
      joinFollowUp();
    }).catch(function () { renderAccount(); });
  }
  function initAccounts() {
    if (doorStarted || !window.FitAuth || !window.FIT_ACCOUNT_CONFIG) { renderAccount(); return; }
    if (!window.FitAuth.initDoor(window.FIT_ACCOUNT_CONFIG)) { renderAccount(); return; }
    doorStarted = true;
    window.FitAuth.watchUser(function (user) {
      if (user) onSignedIn(user);
      else {
        var wasDemo = demoMode;
        authUser = null;
        doorStep = 1; doorEmail = "";
        if (wasDemo) { restoreParkedState(); renderAll(); toast(tr("toast.demoClosed")); }
        else renderAccount();
      }
    });
    renderAccount();
  }
  window.addEventListener("fit-auth-ready", initAccounts);
  $("proNotNow").addEventListener("click", closeProMoment);
  $("proGo").addEventListener("click", function () {
    closeProMoment(); showView("settings");
    var box = $("accountBox"); if (box) box.scrollIntoView();
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
    $("setupModal").classList.remove("hidden");
  }
  function closeSetup() { $("setupModal").classList.add("hidden"); }
  $("suSkip").addEventListener("click", function () {
    if (!state.profile) { state.profile = { name: "", needs: [], preferences: [], allergies: [], goals: [], setupDone: false }; save(); }
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
      needs: pickedNeeds.slice(), setupDone: true
    };
    state.settings = state.settings || {};
    state.settings.companionName = $("suCompanion").value.trim();
    save(); closeSetup(); renderAll();
    toast(pickedNeeds.length ? "Saved. Your app now shows only what you picked." :
      "Saved. Nothing picked, so everything stays in view. Change it any time in Settings.");
  });

  function renderAll() { buildSidebar(); renderToday(); renderSettings(); applySidebar(); applyAppearance();
    var db = $("demoBanner"); if (db) db.classList.toggle("hidden", !demoMode); }
  renderAll();
  initAccounts();
  setTimeout(renderAccount, 5000);
  if (!state.profile || !state.profile.setupDone) openSetup();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(function () {});
  }
})();
