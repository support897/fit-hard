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
  var currentArea = null, currentSub = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
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
      if (!saveFailed) toast("This device is out of storage room. Your newest changes are safe here for now, and Settings has a note.");
      saveFailed = true;
    }
    var sn = $("saveNote"); if (sn) sn.textContent = saveFailed ?
      "This device is out of storage room, so the newest changes could not be saved yet. Downloading your data from here keeps a copy safe." : "";
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

  function areaById(id) { return D.AREAS.filter(function (a) { return a.id === id; })[0]; }
  function iconFor(areaId) { return { peptides: "#i-pep", meals: "#i-meal", gym: "#i-gym", calendar: "#i-cal" }[areaId] || "#i-star"; }

  function buildSidebar() {
    var needs = state.profile ? state.profile.needs : [];
    var split = L.areasForNeeds(needs.length ? needs : ["meals", "gym", "peptides", "calendar"]);
    function group(a) {
      var subs = a.subs.map(function (s) {
        return '<button class="subBtn" data-area="' + a.id + '" data-sub="' + s.id + '">' + esc(s.label) + "</button>";
      }).join("");
      return '<div class="areaGroup" data-group="' + a.id + '">' +
        '<button class="areaHead" data-grouphead="' + a.id + '"><span class="navIcon ic-' + a.id + '">' +
        '<svg class="ic"><use href="' + iconFor(a.id) + '"/></svg></span><span>' + esc(a.label) + "</span>" +
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
    peptides: ["No peptides tracked yet.", "Add a peptide"],
    meals: ["No meals planned yet.", "Plan my week"],
    gym: ["No routines yet.", "Build a routine"],
    calendar: ["Nothing on your calendar yet.", "Add your first thing"]
  };
  function openArea(areaId, subId) {
    currentArea = areaId; currentSub = subId;
    var a = areaById(areaId); if (!a) return;
    var sub = a.subs.filter(function (s) { return s.id === subId; })[0] || a.subs[0];
    showView("area");
    $("areaTitle").textContent = a.label;
    $("areaSub").textContent = sub.label + ".";
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
    var e = EMPTY[areaId] || ["Nothing here yet.", "Start"];
    $("areaEmptyLine").textContent = e[0];
    $("areaEmptyBtn").textContent = e[1];
    $("areaEmptyIcon").innerHTML = '<use href="' + iconFor(areaId) + '"/>';
    $("areaBody").innerHTML = "";
  }
  $("areaEmptyBtn").addEventListener("click", function () { toast("Coming in its own phase. Your place is saved."); });

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
    if (isoKey === today) return "Today";
    if (isoKey === L.addDays(today, 1)) return "Tomorrow";
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][L.parseKey(isoKey).getDay()];
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
    if (!SR) { toast("Voice typing is not in this browser. Typing works fine."); return; }
    var rec = new SR();
    rec.lang = "en-AU"; rec.interimResults = false;
    rec.onresult = function (ev) {
      var text = ev.results[0][0].transcript;
      textarea.value = (textarea.value ? textarea.value + "\n" : "") + text;
    };
    rec.onerror = function () { toast("Voice did not catch that. Typing works fine."); };
    rec.start(); toast("Listening. Say it any way you like.");
  }
  function wireMic(btn, textarea) { if (btn) btn.addEventListener("click", function () { micInto(textarea); }); }

  function mealRow(iso, meal, r) {
    var colors = { breakfast: "#C08552", lunch: "#7A8B6F", dinner: "#52695A" };
    var k = kcalOf(r);
    return '<button class="mealRow" data-recipe="' + r.id + '"><span class="mealDot" style="background:' + colors[meal] + '"></span>' +
      '<span class="mName">' + esc(r.name) + '</span><span class="kcalChip">' + (k == null ? "no count yet" : "about " + k + " kcal") + "</span></button>";
  }
  function renderPlan() {
    var el = $("areaBody");
    var target = budgetKcal();
    var html = '<div class="card"><h2>Your week</h2>' +
      '<p class="hint">' + (target ? "Planned towards about " + target + " kcal a day, from your setup. An estimate, not medical advice." :
        "Add your age and formula pick in setup and the plan will aim at a daily estimate. For now it plans tasty days.") + "</p>" +
      '<div class="row"><button class="primaryBtn" id="planWeekBtn">Plan my week</button></div>' +
      '<label>Messy note, type or say it. One meal per line works, like: tacos friday<textarea id="mealNote" rows="2" placeholder="tacos friday&#10;green smoothie tomorrow"></textarea></label>' +
      '<div class="row"><button class="pillBtn" id="mealNoteBtn">Sort my note</button><button class="pillBtn" id="mealNoteMic">Voice</button></div>' +
      '<p class="hint" id="mealNoteMsg"></p></div>';
    var has = Object.keys(state.plan).length > 0;
    if (!has) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-meal"/></svg><p>No meals planned yet.</p><p class="hint">Tap Plan my week and the days fill in.</p></div>';
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
        '<p class="dayTotal">Meals about ' + total + " kcal" + (dayTarget ? " of about " + dayTarget : "") +
        (badToday ? " · treat room kept aside today" : "") +
        (treats.length ? " · treats about " + tt.known + " kcal" + (tt.unknown ? " plus " + tt.unknown + " with no count" : "") : "") + "</p></div>";
    }
    el.innerHTML = html;
    $("planWeekBtn").addEventListener("click", function () { planWeek(); renderPlan(); toast("Your week is planned. Tap any meal for the recipe."); showWallyCelebration("plan"); });
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
      $("mealNoteMsg").textContent = done ? "Sorted " + done + (done === 1 ? " meal" : " meals") + " into your plan." + (missed.length ? " Could not match: " + missed.join(", ") + ". Try the recipe name." : "") : "Nothing matched yet. Try a recipe name, like tacos.";
    });
    wireMic($("mealNoteMic"), $("mealNote"));
    el.querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe")); }); });
  }

  function openRecipe(id) {
    var r = recipeById(id); if (!r) return;
    var k = kcalOf(r);
    var ads = state.profile ? MP.adaptations(r, [{ name: "You", allergies: state.profile.allergies || [], dislikes: [] }], MD) : [];
    var html = "<h2>" + esc(r.name) + "</h2>" +
      '<p class="hint">' + esc((r.cuisines || []).join(", ")) + " · " + r.minutes + " min · serves " + r.servings +
      (k == null ? " · no calorie count yet (an ingredient is not in the table)" : " · about " + k + " kcal per serving") + "</p>";
    if (r.picture) html += '<img class="photoImg" alt="Your recipe photo" src="' + r.picture + '">';
    if (ads.length) html += '<div class="swapBox">Made safe for you: ' + ads.map(function (a) {
      return esc(a.ingredient) + " becomes " + esc(a.swap); }).join("; ") + ".</div>";
    if ((r.ingredients || []).length) html += "<h3>Ingredients</h3><ul class='ingList'>" + r.ingredients.map(function (i) {
      return "<li>" + esc(i.qty) + " " + esc(i.unit) + " " + esc(i.name) + "</li>"; }).join("") + "</ul>";
    if ((r.steps || []).length) html += "<h3>Steps</h3><ol class='stepList'>" + r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    html += '<div class="row"><button class="primaryBtn" id="rmToday">Put on today</button><button class="pillBtn" id="rmClose">Close</button></div>';
    $("recipeModalCard").innerHTML = html;
    $("recipeModal").classList.remove("hidden");
    $("rmClose").addEventListener("click", function () { $("recipeModal").classList.add("hidden"); });
    $("rmToday").addEventListener("click", function () {
      var key = mpKey(L.todayKey());
      if (!state.plan[key]) state.plan[key] = {};
      state.plan[key][r.meal] = r.id; save();
      $("recipeModal").classList.add("hidden"); toast("On today. Enjoy.");
      if (currentArea === "meals") renderMeals(currentSub);
    });
  }

  function renderRecipes() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>Add your recipe</h2>' +
      '<div class="grid2"><label>Recipe name<input id="ownName" type="text" placeholder="Grandma soup"></label>' +
      '<label>Meal<select id="ownMeal"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner" selected>Dinner</option></select></label>' +
      '<label>Cook time in minutes<input id="ownMinutes" type="number" min="1" value="30"></label>' +
      '<label>Serves<input id="ownServings" type="number" min="1" value="2"></label></div>' +
      '<label>Ingredients, one per line, like 200 g chicken breast<textarea id="ownIngredients" rows="4"></textarea></label>' +
      '<label>Steps, one per line<textarea id="ownSteps" rows="4"></textarea></label>' +
      '<div class="row"><button class="primaryBtn" id="ownSave">Save my recipe</button></div>' +
      '<p class="hint">Or just a name. Type the meal and the app writes a starter recipe for you to approve.</p>' +
      '<div class="row"><input id="nameMealInput" type="text" placeholder="Type a meal name, like mushroom risotto"><button class="pillBtn" id="nameMealBtn">Get the recipe</button></div><div id="nameMealResult"></div>' +
      '<h3>Recipe as a picture</h3><p class="hint">Snap a recipe card or a page from a book. It saves with your name for it. The photo stays on your device.</p>' +
      '<div class="row"><input id="picName" type="text" placeholder="Name for the pictured recipe"><input id="picFile" type="file" accept="image/*"></div><div id="picPreview"></div>' +
      '<div class="row"><button class="pillBtn" id="picSave">Save picture recipe</button></div></div>' +
      '<div class="card"><h2>All recipes</h2><div class="row"><input id="recipeSearch" type="text" placeholder="Search recipes"></div><div id="recipeList" class="recipeGrid"></div></div>';
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
        $("picPreview").innerHTML = '<img class="photoImg" alt="Your recipe photo" src="' + picData + '">';
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
    });
    $("picSave").addEventListener("click", function () {
      if (!picData) { toast("Add a photo first."); return; }
      var name = $("picName").value.trim() || "My pictured recipe";
      state.customRecipes.push({ id: "custom." + Date.now(), name: name, meal: "dinner", cuisines: ["Mine"],
        minutes: 30, servings: 2, ingredients: [], steps: [], custom: true, picture: picData });
      save(); renderRecipes(); toast("Saved. It is in your recipes now.");
    });
    $("ownSave").addEventListener("click", function () {
      var name = $("ownName").value.trim(); if (!name) { toast("Give it a name first."); return; }
      var ings = $("ownIngredients").value.split(/\n+/).map(function (x) { return L.parseIngredientLine(x); }).filter(Boolean);
      var steps = $("ownSteps").value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      state.customRecipes.push({ id: "custom." + Date.now(), name: name, meal: $("ownMeal").value,
        cuisines: ["Mine"], minutes: Math.max(1, Number($("ownMinutes").value) || 30),
        servings: Math.max(1, Number($("ownServings").value) || 2),
        ingredients: ings, steps: steps, custom: true });
      save(); renderRecipes(); toast("Saved. Your recipe is in the list.");
    });
    $("nameMealBtn").addEventListener("click", function () {
      var name = $("nameMealInput").value.trim(); if (!name) return;
      var found = MP.findRecipeByName(name, MD, state.customRecipes || []);
      var r = found || MP.makeRecipeFromName(name, MD, state.customRecipes || []);
      $("nameMealResult").innerHTML = '<div class="swapBox">' + esc(r.name) + " · " + r.minutes + " min · " +
        (kcalOf(r) == null ? "no count yet" : "about " + kcalOf(r) + " kcal") +
        (found ? " (already in your recipes)" : ' <button class="miniBtn" id="nameMealSave">Save this recipe</button>') + "</div>";
      var sv = $("nameMealSave");
      if (sv) sv.addEventListener("click", function () { state.customRecipes.push(r); save(); renderRecipes(); toast("Saved."); });
    });
    function drawList(filter) {
      var list = allRecipes().filter(function (r) { return !filter || r.name.toLowerCase().indexOf(filter) !== -1; });
      $("recipeList").innerHTML = list.map(function (r) {
        var k = kcalOf(r);
        return '<button class="recipeCard" data-recipe="' + r.id + '">' + (r.picture ? '<img alt="" src="' + r.picture + '">' : "") +
          "<h3>" + esc(r.name) + "</h3><p>" + esc(r.meal) + " · " + r.minutes + " min</p><p>" +
          (k == null ? "no count yet" : "about " + k + " kcal per serving") + "</p></button>";
      }).join("") || '<p class="hint">No recipes match that search.</p>';
      $("recipeList").querySelectorAll("[data-recipe]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-recipe")); }); });
    }
    drawList("");
    $("recipeSearch").addEventListener("input", function () { drawList($("recipeSearch").value.trim().toLowerCase()); });
  }

  function renderFridge() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>Photo of your fridge</h2>' +
      '<p class="hint">The photo is looked at on your device and never uploaded. A photo cannot weigh food, so you confirm each amount before it saves.</p>' +
      '<input id="fridgePhoto" type="file" accept="image/*"><div id="photoPreview"></div>' +
      '<div class="row"><button class="pillBtn" id="photoScan">Look at my photo</button></div><div id="photoResults"></div></div>' +
      '<div class="card"><h2>Meal ideas from your fridge</h2><p class="hint">Recipes that use what you already have, food that goes off sooner first.</p>' +
      '<div class="row"><button class="primaryBtn" id="ideasBtn">Give me ideas</button></div><div id="ideasList"></div></div>';
    var photoData = "";
    $("fridgePhoto").addEventListener("change", function () {
      var f = $("fridgePhoto").files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { photoData = String(rd.result); $("photoPreview").innerHTML = '<img class="photoImg" alt="Your fridge photo" src="' + photoData + '">'; };
      rd.readAsDataURL(f);
    });
    function loadScript(src) { return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
    function detectRow(name, est) {
      return '<div class="treatRow"><span class="tName">' + esc(name) + (est ? " · about " + est.kcal + " kcal for " + esc(est.label) : "") +
        '</span><button class="miniBtn" data-addfood="' + esc(name) + '">Add to my food</button></div>';
    }
    function bindRows() {
      $("photoResults").querySelectorAll("[data-addfood]").forEach(function (b) {
        b.addEventListener("click", function () {
          var name = b.getAttribute("data-addfood");
          state.pantry.push({ id: "g" + Date.now(), name: name, qty: 1, unit: "pcs", storage: "fridge",
            added: mpKey(L.todayKey()), shelfDays: MP.shelfDays(name, "fridge", MD) });
          save(); b.textContent = "Added"; b.disabled = true; toast("Added to your food.");
        });
      });
    }
    $("photoScan").addEventListener("click", async function () {
      if (!photoData) { toast("Add a photo first."); return; }
      $("photoResults").innerHTML = '<p class="hint">Looking at your photo now.</p>';
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
      if (named.length) html += "<h3>Found in your photo</h3><p class='hint'>Check each one, then add. Amounts start as a typical serving.</p>" +
        named.map(function (x) { return detectRow(x.est.food, x.est); }).join("");
      else html += "<h3>Tap what is in your photo</h3><p class='hint'>The quick look could not name food in this photo. Tap each food you can see.</p>";
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
      if (!names.length) { $("ideasList").innerHTML = '<p class="hint">Your fridge list is empty. Add a photo or a few foods in Groceries first.</p>'; return; }
      var ctx = { preferences: (state.profile || {}).preferences || [], expiringNames: names,
        usedCounts: {}, recentIds: [], family: [], customRecipes: state.customRecipes || [] };
      var scored = allRecipes().map(function (r) { return { r: r, s: MP.recipeScore(r, ctx) }; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
      $("ideasList").innerHTML = scored.map(function (x) {
        var k = kcalOf(x.r);
        return '<button class="mealRow" data-idea="' + x.r.id + '"><span class="mName">' + esc(x.r.name) + '</span><span class="kcalChip">' +
          (k == null ? "no count yet" : "about " + k + " kcal") + "</span></button>";
      }).join("");
      $("ideasList").querySelectorAll("[data-idea]").forEach(function (b) { b.addEventListener("click", function () { openRecipe(b.getAttribute("data-idea")); }); });
    });
  }

  function renderTreats() {
    var el = $("areaBody");
    var byDay = {};
    (state.treats || []).forEach(function (t) { (byDay[t.dateKey] = byDay[t.dateKey] || []).push(t); });
    var days = Object.keys(byDay).sort().reverse();
    var html = '<div class="card"><h2>Treats</h2>' +
      '<p class="hint">Treats are part of life. They get written down here, never judged. A bad day even plans room for one.</p>' +
      '<div class="grid2"><label>What was it?<input id="trName" type="text" placeholder="Chocolate cake"></label>' +
      '<label>Calories if you know them (optional)<input id="trKcal" type="number" min="0" placeholder="320"></label></div>' +
      '<div class="row"><button class="primaryBtn" id="trAdd">Add treat</button></div>' +
      '<label>Quick add, one per line. A number at the end counts as calories.<textarea id="trQuick" rows="2" placeholder="Cake 320&#10;Chips"></textarea></label>' +
      '<div class="row"><button class="pillBtn" id="trQuickBtn">Sort my treats</button><button class="pillBtn" id="trMic">Voice</button></div></div>';
    if (!days.length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-heart"/></svg><p>No treats logged yet.</p></div>';
    days.forEach(function (d) {
      var tt = L.treatsTotal(byDay[d]);
      html += '<div class="dayCard"><h3>' + dayLabel(d) + " · " + d.slice(8) + "/" + d.slice(5, 7) + "</h3>" +
        byDay[d].map(function (t) {
          return '<div class="treatRow"><span class="tName">' + esc(t.name) + '</span><span class="kcalChip">' +
            (t.kcal ? "about " + t.kcal + " kcal" : "no count") + '</span><button class="miniBtn" data-del="' + t.id + '">Remove</button></div>';
        }).join("") +
        '<p class="dayTotal">Treats about ' + tt.known + " kcal" + (tt.unknown ? ", plus " + tt.unknown + " with no count" : "") + ". All fine.</p></div>";
    });
    el.innerHTML = html;
    $("trAdd").addEventListener("click", function () {
      var name = $("trName").value.trim(); if (!name) { toast("Name the treat first."); return; }
      state.treats.push({ id: "treat." + Date.now(), dateKey: L.todayKey(), name: name,
        kcal: Number($("trKcal").value) > 0 ? Number($("trKcal").value) : null, note: "" });
      save(); renderTreats(); toast("Written down. No judgement here.");
    });
    $("trQuickBtn").addEventListener("click", function () {
      var lines = $("trQuick").value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      lines.forEach(function (line) {
        var m = line.match(/^(.*?)\s+(\d{2,4})$/);
        state.treats.push({ id: "treat." + Date.now() + Math.floor(Math.random() * 999), dateKey: L.todayKey(),
          name: m ? m[1] : line, kcal: m ? Number(m[2]) : null, note: "" });
      });
      save(); renderTreats(); toast("Sorted. All written down.");
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
    var html = '<div class="card"><h2>Grocery list</h2><p class="hint">Built from your planned week. Food you already have is marked.</p>' +
      (items.length ? items.map(function (i) {
        return '<div class="listRow"><span class="grow">' + esc(i.name) + " · " + esc(i.qty) + " " + esc(i.unit) + "</span>" +
          (i.haveIt ? '<span class="haveIt">you have this</span>' : "") + "</div>";
      }).join("") : '<p class="hint">No plan yet. Plan your week in Meal plan and the list builds itself.</p>') +
      '<div class="row"><input id="extraName" type="text" placeholder="Add anything, like dish soap"><button class="pillBtn" id="extraAdd">Add</button></div>' +
      (state.extras || []).map(function (x) { return '<div class="listRow"><span class="grow">' + esc(x.name) + "</span></div>"; }).join("") + "</div>";
    html += '<div class="card"><h2>Food you have</h2>' +
      '<div class="grid2"><label>Food name<input id="gName" type="text" placeholder="Chicken breast"></label>' +
      '<label>Amount<input id="gQty" type="number" min="0" step="any" value="500"></label>' +
      '<label>Unit<select id="gUnit"><option>g</option><option>ml</option><option>pcs</option><option>slices</option></select></label>' +
      '<label>Stored in<select id="gStorage"><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="pantry">Pantry</option></select></label></div>' +
      '<div class="row"><button class="primaryBtn" id="gAdd">Add food</button></div>' +
      (pantrySorted.length ? pantrySorted.map(function (p) {
        var left = MP.daysLeft(p, new Date(), MD);
        return '<div class="listRow"><span class="grow">' + esc(p.name) + " · " + esc(p.qty) + " " + esc(p.unit) + "</span><span class='hint'>" +
          (left < 0 ? "past its guide date, check it first" : left === 0 ? "use today by the guide" : "about " + left + " days by the guide") + "</span></div>";
      }).join("") : '<p class="hint">Nothing here yet. Add what is in your fridge, freezer or pantry.</p>') +
      '<p class="hint">Times come from USDA food storage research and are a guide only. Always check food before eating it.</p></div>';
    el.innerHTML = html;
    $("extraAdd").addEventListener("click", function () {
      var n = $("extraName").value.trim(); if (!n) return;
      state.extras.push({ id: "x" + Date.now(), name: n }); save(); renderGroceries();
    });
    $("gAdd").addEventListener("click", function () {
      var n = $("gName").value.trim(); if (!n) { toast("Name the food first."); return; }
      state.pantry.push({ id: "g" + Date.now(), name: n.toLowerCase(), qty: Math.max(0, Number($("gQty").value) || 0),
        unit: $("gUnit").value, storage: $("gStorage").value, added: mpKey(L.todayKey()),
        shelfDays: MP.shelfDays(n, $("gStorage").value, MD) });
      save(); renderGroceries(); toast("Added.");
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
    (state.sessions || []).forEach(function (s) { if (s.dateKey === iso && s.status === "done") evs.push({ color: "#52695A", label: "Gym session", kind: "gym" }); });
    (state.routines || []).forEach(function (r) { if (L.routineDueOn(r, iso)) evs.push({ color: "#7A8B6F", label: r.name + (r.time ? " " + r.time : ""), kind: "routine" }); });
    (state.peptides || []).forEach(function (p) {
      (p.log || []).forEach(function (lg) { if (lg.dateKey === iso) evs.push({ color: p.color, label: p.name, kind: "peptide" }); });
    });
    (state.habits || []).forEach(function (h) { if (h.days && h.days[iso]) evs.push({ color: h.color || "#7A8B6F", label: h.name, kind: "habit" }); });
    L.todosOn(state.todos, iso).forEach(function (t) { evs.push({ color: t.color, label: t.title, kind: "todo", id: t.id, time: t.time, done: t.status === "done" }); });
    if (state.checkins[iso]) evs.push({ color: "#C08552", label: "Checked in: " + state.checkins[iso], kind: "checkin" });
    return evs;
  }
  function renderMonth() {
    var el = $("areaBody");
    var now = calCursor || L.todayKey();
    var parts = now.split("-"), year = Number(parts[0]), month = Number(parts[1]) - 1;
    var names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var grid = L.monthGrid(year, month);
    var html = '<div class="card"><div class="calHead"><button class="pillBtn" id="calPrev">Back</button>' +
      "<h3>" + names[month] + " " + year + '</h3><button class="pillBtn" id="calTodayBtn">Today</button><button class="pillBtn" id="calNext">Next</button></div>' +
      '<div class="calGrid">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) { return '<div class="calDow">' + d + "</div>"; }).join("");
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
      if (shapedD.waiting > 0) waitNote = '<p class="hint">Bad day: ' + shapedD.waiting + " more wait for another day. Nothing is lost.</p>";
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
    if (habs.length) html += '<p class="hint">Habits this day</p><div class="chipRow">' + habs.map(function (h) {
      var on = h.days && h.days[iso];
      return '<button class="chip' + (on ? " on" : "") + '" data-habitday="' + h.id + '">' + esc(h.name) + (on ? " ✓" : "") + "</button>";
    }).join("") + "</div>";
    if (!meals.length && !todos.length && !others.length && !habs.length) html += '<p class="hint">Nothing planned here yet. A blank day is fine.</p>';
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
    var html = '<div class="card"><h2>Add a habit</h2>' +
      '<div class="grid2"><label>Habit name<input id="hbName" type="text" placeholder="Drink water"></label>' +
      '<label>Colour<select id="hbColor"><option value="#52695A">Sage</option><option value="#7A8B6F">Leaf</option><option value="#AC9278">Taupe</option><option value="#C08552">Clay</option><option value="#6B7F8C">Slate</option></select></label></div>' +
      '<div class="row"><button class="primaryBtn" id="hbAdd">Add habit</button></div>' +
      '<p class="hint">Two starters from your app, tap to add: gym days and healthy eating days.</p><div class="chipRow">' +
      '<button class="chip" id="hbStartGym">Gym days</button><button class="chip" id="hbStartEat">Healthy eating days</button></div></div>';
    if (!(state.habits || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-cal"/></svg><p>No habits yet.</p><p class="hint">Small and daily beats big and rare.</p></div>';
    (state.habits || []).forEach(function (h) {
      var st = L.streakInfo(h.days || {}, today);
      html += '<div class="habitRow"><h3><span class="mealDot" style="background:' + esc(h.color || "#7A8B6F") + ';display:inline-block"></span> ' + esc(h.name) + "</h3>" +
        '<p class="hint">' + (st.current > 0 ? st.current + (st.current === 1 ? " day" : " days") + " in a row. Lovely." : "Starts today, whenever you are ready.") + "</p>" +
        '<div class="weekDots">' + st.last7.map(function (d) {
          var wd = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][L.parseKey(d.key).getDay()];
          return '<button class="wDot' + (d.done ? " done" : "") + (d.key === today ? " today" : "") + '" data-hdot="' + h.id + "|" + d.key + '">' + wd + "</button>";
        }).join("") + "</div>" +
        '<div class="row"><button class="pillBtn" data-htoday="' + h.id + '">' + ((h.days || {})[today] ? "Done today ✓ (tap to undo)" : "Done today") + "</button></div></div>";
    });
    el.innerHTML = html;
    function addHabit(name, color) {
      if (!name) { toast("Name the habit first."); return; }
      if ((state.habits || []).some(function (h) { return h.name.toLowerCase() === name.toLowerCase(); })) { toast("That one is already here."); return; }
      state.habits.push({ id: "habit." + Date.now(), name: name, color: color, days: {} });
      save(); renderHabits(); toast("Added. Small steps count.");
    }
    $("hbAdd").addEventListener("click", function () { addHabit($("hbName").value.trim(), $("hbColor").value); });
    $("hbStartGym").addEventListener("click", function () { addHabit("Gym days", "#52695A"); });
    $("hbStartEat").addEventListener("click", function () { addHabit("Healthy eating days", "#7A8B6F"); });
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
    var html = '<div class="card"><h2>To do, your way</h2>' +
      '<p class="hint">Write messy, one thing per line, or a whole brain dump. Dates and times sort themselves out.</p>' +
      '<textarea id="tdDump" rows="3" placeholder="call mum tomorrow at 6pm&#10;buy oats&#10;gym friday"></textarea>' +
      '<div class="row"><button class="primaryBtn" id="tdSort">Sort my list</button><button class="pillBtn" id="tdMic">Voice</button></div>' +
      '<p class="hint" id="tdMsg"></p></div>';
    var todayLevel = state.checkins[today] || "ok";
    groups.forEach(function (g) {
      if (!byGroup[g].length) return;
      var rowsList = byGroup[g], waitingNote = "";
      if (g === "Today" && todayLevel === "bad") {
        var shaped = L.shapeTodosForDay(byGroup[g], "bad");
        rowsList = shaped.shown;
        if (shaped.waiting > 0) waitingNote = '<p class="hint">' + shaped.waiting + (shaped.waiting === 1 ? " more thing waits" : " more things wait") + " for another day. Nothing is lost, it is all still here tomorrow.</p>";
      }
      html += '<div class="card"><h2>' + g + "</h2>" + (g === "Today" && todayLevel === "bad" ? '<p class="hint">Bad day: essentials only, on purpose.</p>' : "") + rowsList.map(function (t) {
        return '<div class="todoRow' + (t.status === "done" ? " done" : "") + '"><button class="todoCheck' + (t.status === "done" ? " done" : "") +
          '" data-todo="' + t.id + '">' + (t.status === "done" ? "✓" : "") + '</button><span class="mealDot" style="background:' + esc(t.color) + '"></span>' +
          '<span class="tTitle">' + esc(t.title) + "</span>" +
          (t.time ? '<span class="kcalChip">' + esc(t.time) + "</span>" : "") +
          '<span class="kcalChip">' + t.durationMin + ' min</span><button class="miniBtn" data-del="' + t.id + '">Remove</button></div>';
      }).join("") + waitingNote + "</div>";
    });
    if (!(state.todos || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-list"/></svg><p>Nothing on your list.</p><p class="hint">Dump it all in the box above. The app sorts it.</p></div>';
    el.innerHTML = html;
    $("tdSort").addEventListener("click", function () {
      var parsed = L.parseQuickDump($("tdDump").value, today);
      if (!parsed.length) { $("tdMsg").textContent = "Nothing sortable there yet. A few words per line works."; return; }
      parsed.forEach(function (p, i) { var t = L.makeTodo(p); t.id = "todo." + Date.now() + "." + i; state.todos.push(t); });
      save(); renderTodos(); toast("Sorted " + parsed.length + (parsed.length === 1 ? " thing" : " things") + ".");
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
      '<span class="kcalChip">' + item.sets + " sets × " + item.reps + (item.timed ? " sec" : " reps") + "</span></div>";
  }
  function routineCard(r) {
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var html = '<div class="card"><h2>' + esc(r.name) + (r.lightened ? " (lighter version)" : "") + "</h2>" +
      '<p class="hint">About ' + r.minutes + " min · " + (r.days && r.days.length ? r.days.map(function (d) { return days[d]; }).join(", ") : "any day") +
      (r.time ? " · " + esc(r.time) : "") + "</p>" +
      (r.items || []).map(function (it) { if (!it || typeof it !== "object") return ""; return exRow(it, exerciseById(it.exerciseId)); }).join("") +
      '<div class="row"><button class="primaryBtn" data-start="' + r.id + '">Start session</button>' +
      '<button class="pillBtn" data-delroutine="' + r.id + '">Remove routine</button></div></div>';
    return html;
  }
  function renderRoutines() {
    var el = $("areaBody");
    var goalOpts = L.GYM_GOALS.map(function (g) { return '<option value="' + g.id + '">' + esc(g.label) + "</option>"; }).join("");
    var dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var dayVals = [1, 2, 3, 4, 5, 6, 0];
    var html = '<div class="card"><h2>Build a routine</h2>' +
      '<div class="grid2"><label>Goal<select id="gyGoal">' + goalOpts + "</select></label>" +
      '<label>How long?<select id="gyMinutes"><option>20</option><option selected>30</option><option>45</option><option>60</option><option>90</option></select></label>' +
      '<label>Time of day<input id="gyTime" type="time" value="18:00"></label></div>' +
      '<p class="hint">Days</p><div class="dayChips" id="gyDays">' + dayNames.map(function (d, i) {
        return '<button class="chip" data-gyday="' + dayVals[i] + '">' + d + "</button>"; }).join("") + "</div>" +
      '<div class="row"><button class="primaryBtn" id="gyBuild">Build my routine</button></div>' +
      '<p class="hint">It lands on your calendar on those days, with a colour of its own. Weights are your call, always. Start light.</p></div>';
    if (!(state.routines || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-gym"/></svg><p>No routines yet.</p><p class="hint">Build one above, or show the app a machine in Machine photo.</p></div>';
    (state.routines || []).forEach(function (r) { html += routineCard(r); });
    el.innerHTML = html;
    el.querySelectorAll("[data-gyday]").forEach(function (b) { b.addEventListener("click", function () { b.classList.toggle("on"); }); });
    $("gyBuild").addEventListener("click", function () {
      var built = L.buildRoutine($("gyGoal").value, Number($("gyMinutes").value), EX.EXERCISES);
      if (!built || !built.items.length) { toast("That goal needs a different plan. Try another."); return; }
      var days = [];
      el.querySelectorAll("[data-gyday].on").forEach(function (b) { days.push(Number(b.getAttribute("data-gyday"))); });
      state.routines.push(Object.assign({}, built, { id: "routine." + Date.now(), days: days,
        time: $("gyTime").value || null, createdKey: L.todayKey() }));
      save(); renderRoutines(); toast("Built and on your calendar.");
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
    if (existing) { toast("A session is already going. It is waiting in Session."); openArea("gym", "gym-session"); return; }
    var light = (state.checkins[L.todayKey()] === "bad");
    var use = light ? L.lightenRoutine(r) : r;
    state.sessions.push({ id: "session." + Date.now(), dateKey: L.todayKey(), routineId: r.id,
      routineName: r.name, status: "active", idx: 0, set: 1, doneSets: 0,
      startedAt: Date.now(), items: use.items, lightened: !!use.lightened });
    save(); openArea("gym", "gym-session");
    toast(light ? "A lighter session today, on purpose." : "Session started. One set at a time.");
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
    return '<div class="card skinAsk"><h2>Who shows you the moves?</h2>' +
      '<p class="hint">Pick your trainer figure. Same moves, your pick, change it any time in Settings.</p>' +
      '<div class="row"><button class="pillBtn" data-skinpick="girl">Girl</button>' +
      '<button class="pillBtn" data-skinpick="boy">Boy</button>' +
      '<button class="pillBtn" data-skinpick="nb">Non-binary</button>' +
      '<button class="pillBtn" data-skindismiss="1">Not now</button></div></div>';
  }
  function wireSkinAsk(el) {
    el.querySelectorAll("[data-skinpick]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settings = state.settings || {};
        state.settings.trainerSkin = b.getAttribute("data-skinpick");
        state.settings.skinAsked = true;
        save(); renderSession();
        toast("Your trainer is set. Change any time in Settings.");
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
        toast(companionName() + " will rest the tips for this session.");
      }
    });
  }
  function renderSession() {
    stopGymTimer();
    var el = $("areaBody");
    var s = activeSession();
    if (!s) {
      var lvl = state.checkins[L.todayKey()];
      var html = '<div class="card"><h2>Session</h2><p class="hint">Pick a routine and the app walks you through it: sets, reps and rest, all here.</p>' +
        (lvl === "great" ? '<p class="hint">Great day energy: full sessions today, plus a stretch at the end if you like.</p>' : "") +
        (lvl === "bad" ? '<p class="hint">Bad day: sessions start lighter, on purpose.</p>' : "");
      html = skinAskHtml() + html;
      if (!(state.routines || []).length) html += '<p class="hint">No routines yet. Build one in Routines first.</p>';
      (state.routines || []).forEach(function (r) {
        html += '<div class="row"><button class="primaryBtn" data-start="' + r.id + '">Start ' + esc(r.name) + "</button></div>";
      });
      html += "</div>";
      var done = (state.sessions || []).filter(function (x) { return x.status === "done"; }).slice(-3).reverse();
      if (done.length) html += '<div class="card"><h2>Done sessions</h2>' + done.map(function (x) {
        return '<div class="listRow"><span class="grow">' + esc(x.routineName || "Session") + "</span><span class='hint'>" + esc(x.dateKey || "") + " · about " + (x.minutes || 0) + " min</span></div>";
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
    el.innerHTML = skinAskHtml() + '<div class="card"><h2>' + esc(s.routineName) + (s.lightened ? " · lighter today" : "") + '</h2>' +
      '<p class="hint">Exercise ' + (s.idx + 1) + " of " + s.items.length + ' · session time <span id="sessClock">0:00</span></p>' +
      '<div class="exRow"><span class="exTile"><svg><use href="#i-gym"/></svg></span><span class="eName sessionBig">' + esc(ex.name) +
      '<br><span class="eMeta">' + esc(ex.partLabel) + " · " + esc(ex.equipment) + "</span></span></div>" +
      '<p class="hint">' + esc(ex.cue) + "</p>" +
      '<div id="animMount"></div>' +
      '<div class="setPips">' + pips + '</div><p class="hint">Set ' + s.set + " of " + item.sets + "</p>" +
      (item.timed
        ? '<div class="timerBig" id="countBox">' + item.reps + ' sec</div><div class="row"><button class="primaryBtn" id="holdBtn">Start the hold</button></div>'
        : '<div class="repCount" id="repCount">0</div><p class="hint" style="text-align:center">reps done, tap + for each one, or tap Done set when you finish</p>' +
          '<div class="row"><button class="pillBtn" id="repMinus">Minus 1</button><button class="primaryBtn" id="repPlus">Plus 1 rep</button><button class="primaryBtn" id="setDone">Done set</button></div>' +
          '<div class="timerBig" id="countBox"></div><div class="row"><button class="pillBtn" id="restBtn">Start rest ' + item.restSec + ' sec</button></div>') +
      '<div class="row"><button class="pillBtn" id="nextEx">Next exercise</button><button class="pillBtn" id="finishBtn">Finish session</button></div></div>';
    var reps = 0;
    function tickClock() { var c = $("sessClock"); if (c) c.textContent = fmtClock((Date.now() - s.startedAt) / 1000); }
    tickClock();
    gymTimer = setInterval(tickClock, 1000);
    function countdown(sec, label, after) {
      /* Rest freezes the loop at its current pose and phase
         (pin 5): the loop clock is handed over, not reset. */
      var preT = (label === "Rest" && animHandle && animHandle.time) ? animHandle.time() : 0;
      stopGymTimer();
      var restAnim = null;
      if (label === "Rest") { mountAnim(ex, preT); restAnim = animHandle; if (restAnim) restAnim.setFrozen(true); }
      var left = sec;
      var box = $("countBox");
      function draw() { if (box) box.textContent = label + " " + fmtClock(left); }
      draw();
      gymTimer = setInterval(function () {
        left--; draw(); tickClock();
        if (left <= 0) { var tEnd = restAnim && restAnim.time ? restAnim.time() : 0; stopGymTimer(); gymTimer = setInterval(tickClock, 1000); if (box) box.textContent = "Done. Nicely done."; mountAnim(ex, tEnd); if (after) after(); }
      }, 1000);
    }
    if (item.timed) $("holdBtn").addEventListener("click", function () { countdown(item.reps, "Hold", function () {}); });
    else {
      $("repPlus").addEventListener("click", function () { reps++; $("repCount").textContent = reps; });
      $("repMinus").addEventListener("click", function () { reps = Math.max(0, reps - 1); $("repCount").textContent = reps; });
      $("restBtn").addEventListener("click", function () { countdown(item.restSec, "Rest", null); });
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
    if (!silent) { toast("Session saved. Your future self says thanks."); showWallyCelebration("session"); }
    renderSession();
  }
  function renderMachine() {
    var el = $("areaBody");
    el.innerHTML = '<div class="card"><h2>Show a machine</h2>' +
      '<p class="hint">Snap the machine if you like. A photo rarely names gym machines well, so tap the machine below that matches yours. Same result, no guessing.</p>' +
      '<input id="mcPhoto" type="file" accept="image/*"><div id="mcPreview"></div>' +
      '<div class="machineGrid" id="mcGrid">' + EX.MACHINES.map(function (m) {
        return '<button class="chip" data-machine="' + m.id + '">' + esc(m.name) + "</button>"; }).join("") + "</div>" +
      '<div id="mcResult"></div></div>';
    $("mcPhoto").addEventListener("change", function () {
      var f = $("mcPhoto").files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { $("mcPreview").innerHTML = '<img class="photoImg" alt="Your machine photo" src="' + String(rd.result) + '">'; };
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
          '<div class="row"><button class="primaryBtn" id="mcMake">Make a routine from this</button></div></div>';
        $("mcMake").addEventListener("click", function () {
          state.routines.push({ id: "routine." + Date.now(), name: m.name + " routine", goalId: null,
            minutes: 30, days: [], time: null, createdKey: L.todayKey(), items: items });
          save(); toast("Routine saved. It is in Routines."); openArea("gym", "gym-routines");
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
    if (!p.schedule) return "No days set";
    if (Array.isArray(p.schedule.days) && p.schedule.days.length) {
      var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return p.schedule.days.map(function (d) { return names[d]; }).join(", ");
    }
    if (p.schedule.intervalDays) return "Every " + p.schedule.intervalDays + (p.schedule.intervalDays === 1 ? " day" : " days");
    return "No days set";
  }
  function nextDoseLine(p) {
    var key = L.nextDoseKey(p, L.todayKey());
    if (!key) return "Next dose: no days set";
    var when = key === L.todayKey() ? "today" : key === L.addDays(L.todayKey(), 1) ? "tomorrow" : dayLabel(key) + " " + key.slice(8) + "/" + key.slice(5, 7);
    return "Next dose: " + when + (p.time ? " at " + p.time : "");
  }
  function renderPeptides(subId) {
    var el = $("areaBody");
    if (!L.disclaimerAgreed(state, D.DISCLAIMER_VERSION)) {
      el.innerHTML = '<div class="card"><h2>Before this part opens</h2>' +
        '<p>' + esc(D.DISCLAIMER_TEXT) + "</p>" +
        '<p class="hint">This area only tracks. It records the names, amounts and days you type in, and shows them on your calendar in their own colours. It never suggests an amount or a day. Those choices stay with you and your doctor.</p>' +
        '<p class="hint">Your agreement and the time you agreed are saved with your data, so the app can show it was done once, properly.</p>' +
        '<div class="row"><button class="primaryBtn" id="agreeBtn">I understand</button></div></div>';
      $("agreeBtn").addEventListener("click", function () {
        state.disclaimer = { agreedAt: new Date().toISOString(), version: D.DISCLAIMER_VERSION };
        save(); renderPeptides(subId); toast("Saved. This part is yours now.");
      });
      return;
    }
    if (subId === "pep-log") renderPepLog();
    else if (subId === "pep-next") renderPepNext();
    else renderPepList();
  }
  function renderPepList() {
    var el = $("areaBody");
    var dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var dayVals = [1, 2, 3, 4, 5, 6, 0];
    var html = '<div class="card"><h2>Add a peptide</h2>' +
      '<p class="hint">Only what you and your doctor already decided. The app never suggests an amount. It only keeps what you type.</p>' +
      '<div class="grid2"><label>Name, as your doctor calls it<input id="ppName" type="text" placeholder="The name on your packet"></label>' +
      '<label>Amount you take<input id="ppAmount" type="text" inputmode="decimal" placeholder="Only yours to type"></label>' +
      '<label>Unit<select id="ppUnit"><option>mg</option><option>mcg</option><option>units</option><option>ml</option><option>tablets</option><option>clicks</option></select></label>' +
      '<label>Time<input id="ppTime" type="time" value="09:00"></label></div>' +
      '<label>How it repeats<select id="ppMode"><option value="days">On set days</option><option value="interval">Every few days</option></select></label>' +
      '<div id="ppDaysBox"><p class="hint">Days</p><div class="dayChips" id="ppDays">' + dayNames.map(function (d, i) {
        return '<button class="chip" data-ppday="' + dayVals[i] + '">' + d + "</button>"; }).join("") + "</div></div>" +
      '<div id="ppIntBox" class="hidden"><div class="grid2"><label>Every how many days?<input id="ppInterval" type="number" min="1" value="7"></label>' +
      '<label>Starting on<input id="ppStart" type="date" value="' + L.todayKey() + '"></label></div></div>' +
      '<div class="row"><button class="primaryBtn" id="ppAdd">Save this peptide</button></div></div>';
    if (!(state.peptides || []).length) html += '<div class="card emptyCard"><svg class="ic icBig"><use href="#i-pep"/></svg><p>Nothing tracked yet.</p><p class="hint">Add one above and it gets its own colour.</p></div>';
    (state.peptides || []).forEach(function (p) {
      html += '<div class="card"><h2><span class="mealDot" style="background:' + esc(p.color) + ';display:inline-block"></span> ' + esc(p.name) + "</h2>" +
        '<p class="hint">You take ' + esc(p.amount) + " " + esc(p.unit) + " · " + scheduleText(p) + (p.time ? " · " + esc(p.time) : "") + "</p>" +
        '<p class="dayTotal">' + nextDoseLine(p) + "</p>" +
        '<div class="row"><label style="flex:1">Amount this time<input type="text" inputmode="decimal" id="amt-' + p.id + '" value="' + esc(p.amount) + '"></label>' +
        '<button class="primaryBtn" data-log="' + p.id + '">Log a dose</button>' +
        '<button class="pillBtn" data-delpep="' + p.id + '">Remove</button></div></div>';
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
      if (!name) { toast("Name it first, as your doctor calls it."); return; }
      var amount = $("ppAmount").value.trim();
      if (!amount) { toast("Type the amount you take. The app will not guess it."); return; }
      var schedule;
      if ($("ppMode").value === "interval") {
        var n = Math.max(1, Number($("ppInterval").value) || 1);
        schedule = { intervalDays: n, startKey: $("ppStart").value || L.todayKey() };
      } else {
        var days = [];
        el.querySelectorAll("[data-ppday].on").forEach(function (b) { days.push(Number(b.getAttribute("data-ppday"))); });
        if (!days.length) { toast("Pick at least one day."); return; }
        schedule = { days: days };
      }
      state.peptides.push({ id: "pep." + Date.now(), name: name, amount: amount, unit: $("ppUnit").value,
        color: L.nextColor((state.peptides || []).map(function (p) { return p.color; })), schedule: schedule, time: $("ppTime").value || null, log: [] });
      save(); renderPepList(); toast("Saved with its own colour.");
    });
    el.querySelectorAll("[data-log]").forEach(function (b) { b.addEventListener("click", function () {
      var p = peptideById(b.getAttribute("data-log")); if (!p) return;
      var amt = ($("amt-" + p.id) || {}).value || p.amount;
      var now = new Date();
      p.log.push({ dateKey: L.todayKey(), time: ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2),
        amount: String(amt).trim() || p.amount, unit: p.unit });
      save(); renderPepList(); toast("Logged. That is all it does, on purpose."); showWallyCelebration("dose");
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
    var html = '<div class="card"><h2>Dose log</h2><p class="hint">Everything you logged, newest first. Only you can change this list.</p>';
    if (!rows.length) html += '<p class="hint">Nothing logged yet.</p>';
    html += rows.map(function (r) {
      return '<div class="listRow"><span class="mealDot" style="background:' + esc(r.p.color) + '"></span>' +
        '<span class="grow">' + esc(r.p.name) + " · " + esc(r.lg.amount) + " " + esc(r.lg.unit) + "</span>" +
        '<span class="hint">' + esc(r.lg.dateKey) + (r.lg.time ? " " + esc(r.lg.time) : "") + "</span>" +
        '<button class="miniBtn" data-unlog="' + r.p.id + "|" + r.idx + '">Remove</button></div>';
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
    var html = '<div class="card"><h2>Next doses</h2><p class="hint">From the days you set. Times are yours, set when you added each one.</p>';
    if (!(state.peptides || []).length) html += '<p class="hint">Nothing tracked yet. Add one in My peptides.</p>';
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
        (keys.length ? keys.map(function (k) { return dayLabel(k) + " " + k.slice(8) + "/" + k.slice(5, 7); }).join(" · ") : "no days set") +
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
    return nm ? "Hi, " + nm + ". " + window.Wally.BUBBLES.welcome : window.Wally.BUBBLES.welcome;
  }
  function renderWallyCheckin() {
    var spot = $("wallySpot"); if (!spot) return;
    if (!guideOn() || !window.Wally) { spot.innerHTML = ""; return; }
    var level = state.checkins[L.todayKey()];
    if (level === "bad") spot.innerHTML = wallyWrap("soft", window.Wally.BUBBLES.soft);
    else if (level === "great") spot.innerHTML = wallyWrap("bright", window.Wally.BUBBLES.bright);
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
    var bubble = kind === "week" ? window.Wally.BUBBLES.celebrateWeek :
      bad ? window.Wally.BUBBLES.tea : window.Wally.BUBBLES.celebrateFirst;
    var box = $("wallyFloat");
    box.innerHTML = wallyWrap(bad ? "rough" : "celebrate", bubble, 64) + '<button class="miniBtn wallyX" id="wallyX">Close</button>';
    box.classList.remove("hidden");
    $("wallyX").addEventListener("click", function () { box.classList.add("hidden"); });
    if (wallyFloatTimer) clearTimeout(wallyFloatTimer);
    wallyFloatTimer = setTimeout(function () { box.classList.add("hidden"); }, 7000);
  }

  function renderCheckin() {
    var today = L.todayKey();
    var level = state.checkins[today];
    $("checkinRow").innerHTML = D.CHECKINS.map(function (c) {
      return '<button class="checkinBtn' + (level === c.id ? " active" : "") + '" data-level="' + c.id + '">' + esc(c.label) + "</button>";
    }).join("");
    document.querySelectorAll(".checkinBtn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.checkins[L.todayKey()] = b.getAttribute("data-level"); save(); renderToday();
        var c = D.CHECKINS.filter(function (x) { return x.id === b.getAttribute("data-level"); })[0];
        toast(c.hint);
      });
    });
    var cur = D.CHECKINS.filter(function (x) { return x.id === level; })[0];
    $("checkinHint").textContent = cur ? cur.hint : "Not checked in yet today. No pressure, Ok is the default.";
    renderWallyCheckin();
  }
  function renderToday() {
    var p = state.profile;
    $("stripHi").textContent = p && p.name ? "Hi, " + p.name : "";
    $("todayTitle").textContent = p && p.name ? "Hi, " + p.name : "Today";
    renderCheckin();
    var budget = L.estimateBudget(p || {});
    var level = state.checkins[L.todayKey()] || "ok";
    if (budget) {
      var day = L.mealBudgetFor(level, budget);
      $("budgetCard").hidden = false;
      $("budgetLine").textContent = "About " + day.meals + " kcal for meals today" +
        (day.treatRoom ? ", with " + day.treatRoom + " kcal kept for a treat" : "");
      var planned = 0, entry = state.plan[mpKey(L.todayKey())] || {};
      ["breakfast", "lunch", "dinner"].forEach(function (m) { var r = entry[m] ? recipeById(entry[m]) : null; var kk = kcalOf(r); if (kk) planned += kk; });
      $("budgetNote").textContent = "An estimate from the usual formula, not medical advice. Treats are always allowed. Nothing here judges you." +
        (planned ? " Planned meals today come to about " + planned + " kcal." : "");
    } else { $("budgetCard").hidden = true; }
    var setUp = !!(p && p.setupDone);
    $("todayEmpty").hidden = setUp;
    var ew = $("emptyWally");
    if (ew) ew.innerHTML = !setUp && guideOn() && window.Wally ? wallyWrap("welcome", window.Wally.BUBBLES.welcome, 64) : "";
    var split = L.areasForNeeds(setUp ? p.needs : ["meals", "gym", "peptides", "calendar"]);
    $("todayAreas").innerHTML = split.active.map(function (id) {
      var a = areaById(id);
      return '<button class="areaCard" data-open="' + id + '"><span class="dot ic-' + id + '">' +
        '<svg class="ic"><use href="' + iconFor(id) + '"/></svg></span><h3>' + esc(a.label) + "</h3>" +
        "<p>Tap to open</p></button>";
    }).join("");
    document.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = areaById(b.getAttribute("data-open")); openArea(a.id, a.subs[0].id); });
    });
  }

  /* --- Settings --- */
  function renderSettings() {
    var p = state.profile;
    $("profileSummary").textContent = !p ? "No setup yet." :
      [p.name, p.weightKg ? p.weightKg + " kg" : "", p.heightCm ? p.heightCm + " cm" : "",
       (p.goals || []).join(", ")].filter(Boolean).join(" · ") || "Setup saved.";
    $("disclaimerStatus").textContent = L.disclaimerAgreed(state, D.DISCLAIMER_VERSION) ?
      "You agreed to the tracking note on " + new Date(state.disclaimer.agreedAt).toLocaleString() + "." :
      "The peptide area asks you to agree to a short tracking note before it opens. This app is not a doctor and gives no medical advice.";
    var cname = companionName();
    $("guideStatus").textContent = guideOn() ? cname + " walks with you in this app." : cname + " is resting. He is still here when you want him.";
    $("guideToggleBtn").textContent = guideOn() ? cname + " rests for a while" : "Bring " + cname + " back";
    var restSpot = $("guideRestSpot");
    if (restSpot) restSpot.innerHTML = !guideOn() && window.Wally ? wallyWrap("rest", window.Wally.BUBBLES.tomorrow, 56) : "";
    var nm = $("guideNameInput"); if (nm && document.activeElement !== nm) nm.value = (state.settings && state.settings.companionName) || "";
    document.querySelectorAll(".skinBtn").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-skin") === trainerSkin());
    });
    var cp = $("calmPicsBtn");
    if (cp) cp.textContent = (state.settings && state.settings.calmPics) ? "Moving pictures instead" : "Still frames instead";
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
      toast("Blanket picked. It suits him.");
    });
  });
  document.querySelectorAll(".skinBtn").forEach(function (b) {
    b.addEventListener("click", function () {
      state.settings = state.settings || {};
      state.settings.trainerSkin = b.getAttribute("data-skin");
      state.settings.skinAsked = true;
      save(); renderSettings();
      toast("Your trainer is set. Same moves, your pick.");
    });
  });
  $("calmPicsBtn").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.calmPics = !state.settings.calmPics;
    save(); renderSettings();
    toast(state.settings.calmPics ? "Still frames in the gym. Calmer, same teaching." : "Moving pictures in the gym.");
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
    if (note) note.textContent = a.mode === "image" && !a.image ? "Pick a photo and it becomes your background, under a soft veil so words stay easy to read." :
      a.image ? "Your photo is saved with your account. Only you can remove it." : "";
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
      toast("Your photo is your background now.");
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast("That photo did not open. Try another one."); };
    img.src = url;
  });
  $("apprRemoveBtn").addEventListener("click", function () {
    state.settings = state.settings || {};
    state.settings.appearance = appearanceOf();
    state.settings.appearance.image = null;
    if (state.settings.appearance.mode === "image") state.settings.appearance.mode = "brand";
    save(); applyAppearance(); renderAppearance();
    toast("Photo removed. The calm board look is back.");
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
        mirrorNote = "Your last change could not reach your account yet. It is safe on this device and will try again.";
        renderAccount();
      });
    }, 800);
  }
  var bootAt = Date.now();
  /* Sign-in door errors, in plain kind words. */
  function authErrWords(e, what) {
    var c = (e && e.code) || "";
    if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found")
      return "That email and password do not match. Check them and try again.";
    if (c === "auth/email-already-in-use") return "That email already has an account. Sign in instead.";
    if (c === "auth/weak-password") return "That password is a bit short. Six or more characters works.";
    if (c === "auth/invalid-email") return "That email does not look right. Check it and try again.";
    if (c === "auth/too-many-requests") return "Too many tries just now. Rest a moment, then try again.";
    if (c === "auth/network-request-failed") return "The connection did not reach the sign-in. Check it and try again.";
    return what === "sign-up" ? "The account could not be made. Check the email and try again."
                               : "Sign-in did not finish. Check the email and password and try again.";
  }
  function renderAccount() {
    var box = $("accountBox"); if (!box) return;
    if (!doorStarted) {
      box.innerHTML = (Date.now() - bootAt < 4500) ?
        '<p class="hint">One moment, opening your account door.</p>' :
        '<p class="hint">Sign in needs a connection the first time, so the door is resting. Everything keeps working and saving on this device.</p>';
      return;
    }
    if (!authUser) {
      /* SCREEN 1 IS THE DOOR ONLY (door-first
         ruling, 15 Oct 2026): the app's mark, Google,
         email + password with ONE button. No name field
         (the name is screen 2, right after the door), no
         plan pick, no long text. The demo stays as its
         own quiet entry below. The password reset is not
         standing furniture: it appears with a failed try,
         where it is needed. */
      box.innerHTML = '<div class="doorMark"><img class="doorLogo" src="icon.svg" alt=""><span>Fit Hard</span></div>' +
        '<div class="row"><button class="pillBtn" id="accGoogleBtn">Continue with Google</button></div>' +
        '<div class="grid2"><label>Email<input id="accEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>' +
        '<label>Password<input id="accPass" type="password" autocomplete="current-password" placeholder="Your password"></label></div>' +
        '<div class="row"><button class="primaryBtn" id="accContinueBtn">Continue with email</button></div>' +
        '<div class="row hidden" id="accResetRow"><span class="hint">Forgot your password?</span>' +
        '<button class="miniBtn" id="accForgotBtn">Reset it</button></div>' +
        '<p class="hint">Just looking? The demo is filled with made-up examples, so you can try everything.</p>' +
        '<div class="row"><button class="pillBtn" id="accDemoBtn">Explore the demo</button>' +
        '<button class="pillBtn" id="accReviewerBtn">Reviewer access</button></div>' +
        (reviewerOpen ? '<div class="grid2"><label>Access code<input id="accCode" type="text" autocomplete="off" placeholder="From the review notes"></label></div>' +
          '<div class="row"><button class="pillBtn" id="accCodeBtn">Enter with code</button></div>' : "");
      function accPair() {
        var em = $("accEmail").value.trim(), pw = $("accPass").value;
        if (!em) { toast("Type your email first."); return null; }
        if (!pw) { toast("Type your password too."); return null; }
        return [em, pw];
      }
      function showReset() { var r = $("accResetRow"); if (r) r.classList.remove("hidden"); }
      $("accContinueBtn").addEventListener("click", function () {
        var p = accPair(); if (!p) return;
        /* One button, both roads: sign in; a credential
           refusal may simply mean "new here", so offer the
           pair to account creation. An existing email
           answers already-in-use, and the user hears the
           same one honest line as a wrong password. */
        window.FitAuth.signInWithEmail(p[0], p[1]).catch(function (e) {
          var c = (e && e.code) || "";
          if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") {
            window.FitAuth.signUpWithEmail(p[0], p[1]).then(function () { toast("Account made. Welcome in."); })
              .catch(function (e2) {
                showReset();
                if (((e2 && e2.code) || "") === "auth/email-already-in-use") toast("That email and password do not match. Check them and try again.");
                else toast(authErrWords(e2, "sign-up"));
              });
          } else { showReset(); toast(authErrWords(e, "sign-in")); }
        });
      });
      $("accForgotBtn").addEventListener("click", function () {
        var em = $("accEmail").value.trim();
        if (!em) { toast("Type your email first, then tap Reset it."); return; }
        window.FitAuth.resetPassword(em).then(function () { toast("Password reset sent. Check your email."); })
          .catch(function () { toast("That reset could not be sent. Check the email and your connection."); });
      });
      $("accGoogleBtn").addEventListener("click", function () {
        window.FitAuth.signInWithGoogle().catch(function () { toast("Google sign-in did not finish. The email sign-in is right here too."); });
      });
      $("accDemoBtn").addEventListener("click", function () { enterDemo(null); });
      $("accReviewerBtn").addEventListener("click", function () { reviewerOpen = true; renderAccount(); });
      var codeBtn = $("accCodeBtn");
      if (codeBtn) codeBtn.addEventListener("click", function () {
        var code = $("accCode").value.trim();
        if (!code) { toast("Type the access code first."); return; }
        sha256Hex(code).then(function (hash) {
          if (!hash) { toast("The code door needs a secure connection. The demo button always works."); return; }
          enterDemo(hash);
        });
      });
      return;
    }
    if (demoMode) {
      box.innerHTML = '<p class="hint">You are exploring the demo. Everything here is made up, and your own app is untouched.</p>' +
        '<div class="row"><button class="pillBtn" id="accLeaveBtn">Leave the demo</button></div>';
      $("accLeaveBtn").addEventListener("click", function () {
        window.FitAuth.signOutUser().catch(function () {});
      });
      return;
    }
    var planLine = (window.FitAuth && window.FitAuth.planOf(state) === "pro")
      ? '<p class="hint">Your plan: Pro.</p>'
      : '<div class="row"><span class="hint">Your plan: Free.</span><button class="miniBtn" id="accProBtn">See what Pro adds</button></div>';
    var warn = cloudWarnings.length ? '<p class="hint">One part of your saved data is growing large. Nothing is lost, and we keep an eye on it for you.</p>' : "";
    var note = mirrorNote ? '<p class="hint">' + esc(mirrorNote) + "</p>" : "";
    box.innerHTML = '<p class="hint">Signed in as ' + esc(authUser.email || "your account") + ". Your app follows you now.</p>" + planLine + warn + note +
      (deleteArmed ?
        '<p class="hint">Delete your account? Your cloud copy and your sign-in go away, and the copy on this device is wiped too. This cannot be undone.</p>' +
        (isPasswordUser() ? '<div class="grid2"><label>Your password, to be sure<input id="accDeletePass" type="password" autocomplete="current-password" placeholder="Your password"></label></div>' : "") +
        '<div class="row"><button class="pillBtn" id="accDeleteYes">Yes, delete my account</button><button class="pillBtn" id="accDeleteNo">Keep my account</button></div>' :
        '<div class="row"><button class="pillBtn" id="accOutBtn">Sign out</button><button class="pillBtn" id="accDeleteBtn">Delete my account</button></div>');
    var proBtn = $("accProBtn"); if (proBtn) proBtn.addEventListener("click", showProMoment);
    var out = $("accOutBtn"); if (out) out.addEventListener("click", function () {
      window.FitAuth.signOutUser().then(function () { toast("Signed out. Everything stays on this device."); });
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
    if (isPasswordUser() && !pw) { toast("Type your password to confirm, when you are ready."); return; }
    window.FitAuth.deleteAccount(authUser.uid, pw).then(function () {
      toast("Your account is deleted. Take care.");
      setTimeout(wipeDeviceAndReload, 600);
    }).catch(function (err) {
      if (err && (err.code === "fit/reauth-password" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential")) {
        toast("That password did not match. Nothing was removed. Check it and try again.");
      } else {
        toast("The delete did not finish. Nothing was removed, and you can try again.");
      }
      deleteArmed = false; renderAccount();
    });
  }
  function enterDemo(hash) {
    if (!window.FitAuth || !window.FitAuth.enterDemoSession) { toast("The demo door is resting. Try again with a connection."); return; }
    demoPending = true; demoPendingHash = hash || null;
    window.FitAuth.enterDemoSession().catch(function () {
      demoPending = false;
      toast("The demo could not open. Your own app is untouched.");
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
      toast("Welcome to the demo. Everything here is made up.");
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
  /* SCREEN 2 + THE FLOW THAT FOLLOWS (door-first ruling):
     after the door, a joining user with no name yet is
     asked ONE question, "What's your name?"; then the
     setup flow follows if they have not done it. A name
     from the provider (Google/Apple) lands in
     adoptSignInName first, so those users are not asked
     twice. The name never blocks the door itself, and an
     empty answer simply moves on. Once per session. */
  function joinFollowUp() {
    if (joinPopped || demoMode || !authUser) return;
    joinPopped = true;
    if (state.profile && state.profile.name) {
      if (!state.profile.setupDone) openSetup();
      return;
    }
    $("nameModal").classList.remove("hidden");
    var inp = $("nmName"); if (inp) { inp.value = ""; setTimeout(function () { inp.focus(); }, 60); }
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
    if (w) w.innerHTML = guideOn() && window.Wally ? wallyWrap("welcome", "You found the strong stuff.", 64) : "";
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
        toast("Signed in. Your app is together again.");
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
        if (wasDemo) { restoreParkedState(); renderAll(); toast("Demo closed. Your own app is just as you left it."); }
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
  $("nmDone").addEventListener("click", function () {
    var v = $("nmName").value.trim().slice(0, 60);
    state.profile = state.profile || {};
    if (v && !state.profile.name) state.profile.name = v;
    save(); $("nameModal").classList.add("hidden"); renderAll();
    if (!state.profile.setupDone) openSetup();
  });
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
      var id = typeof it === "string" ? it : it.id, label = typeof it === "string" ? it : it.label;
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
    if (spot) spot.innerHTML = guideOn() && window.Wally ? wallyWrap("welcome", window.Wally.BUBBLES.welcome, 84) : "";
    $("suCompanion").value = (state.settings && state.settings.companionName) || "";
    var p = state.profile || {};
    $("suName").value = p.name || "";
    $("suWeight").value = p.weightKg || ""; $("suHeight").value = p.heightCm || "";
    $("suAge").value = p.age || ""; $("suSex").value = p.formulaSex || "";
    $("suActivity").value = p.activity || "some"; $("suDeficit").value = p.deficit || "gentle";
    $("suGoal").innerHTML = D.GOALS.map(function (g) { return "<option" + ((p.goals || [])[0] === g ? " selected" : "") + ">" + esc(g) + "</option>"; }).join("");
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
