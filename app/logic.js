/* Fit App core logic. Pure functions, tested by tests/run-tests.mjs.
   Dates, streaks and the messy-note parser are adapted from Pace
   (her own app). The feeling adaptation mapping is built on Pace's
   adaptDay idea. Nothing in this file ever labels a day failed,
   late or missed. Parked means parked, never dropped. */
(function (root) {
"use strict";

function pad(n) { return (n < 10 ? "0" : "") + n; }
function toKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseKey(key) { var p = String(key).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
function addDays(key, n) { var d = parseKey(key); d.setDate(d.getDate() + n); return toKey(d); }
function todayKey(now) { return toKey(now || new Date()); }

/* --- Calorie budget estimate ---------------------------------------
   Standard Mifflin-St Jeor formula (published 1990, the estimate
   most dietitians start from), activity multipliers from the same
   literature. Every result is an estimate, shown in the app as
   "about" with a general-information line. Needs age + the
   formula's sex input; without them there is no honest number,
   so the function returns null rather than guessing. */
var ACTIVITY = { low: 1.2, some: 1.375, lots: 1.55 };
var DEFICIT = { none: 0, gentle: 250, steady: 500 };
function round10(x) { return Math.round(x / 10) * 10; }
function estimateBudget(profile) {
  if (!profile) return null;
  var w = Number(profile.weightKg), h = Number(profile.heightCm), a = Number(profile.age);
  if (!(w > 0) || !(h > 0) || !(a > 0)) return null;
  if (profile.formulaSex !== "female" && profile.formulaSex !== "male") return null;
  var bmr = 10 * w + 6.25 * h - 5 * a + (profile.formulaSex === "male" ? 5 : -161);
  var mult = ACTIVITY[profile.activity] || ACTIVITY.some;
  var maintenance = round10(bmr * mult);
  var deficit = DEFICIT[profile.deficit] != null ? DEFICIT[profile.deficit] : DEFICIT.gentle;
  var target = maintenance - deficit;
  if (target < 1200) target = 1200; /* safety floor, design decision in SPEC.md */
  return { bmr: round10(bmr), maintenance: maintenance, target: target, deficit: deficit };
}

/* --- Morning check-in adaptation ------------------------------------
   One answer shapes the whole day. A bad day never punishes: the gym
   goes lighter, the calendar keeps essentials only, and the meal
   plan holds back a small treat room on purpose. */
function adaptForCheckin(level) {
  if (level === "bad") return { level: "bad", calendarMode: "essentials",
    gymMode: "lighter", treatRoomKcal: 150, stretch: false };
  if (level === "great") return { level: "great", calendarMode: "full",
    gymMode: "full", treatRoomKcal: 0, stretch: true };
  return { level: "ok", calendarMode: "normal",
    gymMode: "normal", treatRoomKcal: 0, stretch: false };
}
function mealBudgetFor(level, budget) {
  if (!budget) return null;
  var room = adaptForCheckin(level).treatRoomKcal;
  return { meals: budget.target - room, treatRoom: room, total: budget.target };
}

/* --- Areas from needs ------------------------------------------------ */
function areasForNeeds(needs) {
  var wanted = {}, out = { active: [], later: [] };
  (needs || []).forEach(function (n) {
    var map = { meals: "meals", calories: "meals", gym: "gym",
      peptides: "peptides", calendar: "calendar" };
    if (map[n]) wanted[map[n]] = true;
  });
  /* An empty pick means "not chosen yet", never a dead
     home (QA dogfood F1, 15 Oct 2026): the four areas
     show, in house order, until the user picks a set.
     The sidebar has always read an empty set this way. */
  var anyWanted = Object.keys(wanted).length > 0;
  ["peptides", "meals", "gym", "calendar"].forEach(function (id) {
    if (!anyWanted || wanted[id]) out.active.push(id); else out.later.push(id);
  });
  return out;
}

/* --- Peptides -------------------------------------------------------- */
function nextColor(used, palette) {
  var p = palette || ["#52695A", "#AC9278", "#7A8B6F", "#8A6D4F", "#6B7F8C", "#97795D", "#5D7263", "#B08968"];
  for (var i = 0; i < p.length; i++) if ((used || []).indexOf(p[i]) === -1) return p[i];
  return p[(used || []).length % p.length];
}
/* Schedule shape: { days: [0..6] } (0 = Sunday) or
   { intervalDays: n, startKey: "YYYY-MM-DD" }. Returns the first
   dose date on or after fromKey, or null for a broken schedule. */
function nextDoseKey(pep, fromKey) {
  if (!pep) return null;
  var s = pep.schedule || {};
  var i, key;
  if (Array.isArray(s.days) && s.days.length) {
    for (i = 0; i < 8; i++) {
      key = addDays(fromKey, i);
      if (s.days.indexOf(parseKey(key).getDay()) !== -1) return key;
    }
    return null;
  }
  if (s.intervalDays > 0 && s.startKey) {
    var diff = Math.round((parseKey(fromKey) - parseKey(s.startKey)) / 86400000);
    if (diff <= 0) return s.startKey;
    var rem = diff % s.intervalDays;
    return rem === 0 ? fromKey : addDays(fromKey, s.intervalDays - rem);
  }
  return null;
}
function disclaimerAgreed(state, currentVersion) {
  if (!state || !state.disclaimer) return false;
  if (typeof state.disclaimer.agreedAt !== "string" || !state.disclaimer.agreedAt) return false;
  /* Store Review fix, 14 Oct: the recorded version must match the
     current text version, so a future wording change re-asks. */
  if (typeof currentVersion === "number" && state.disclaimer.version !== currentVersion) return false;
  return true;
}

/* --- Habits: streak maths, ported from Pace ------------------------- */
function streakInfo(days, today) {
  days = days || {};
  var last7 = [];
  for (var i = 6; i >= 0; i--) { var k = addDays(today, -i); last7.push({ key: k, done: !!days[k] }); }
  var cur = 0;
  var k2 = days[today] ? today : addDays(today, -1);
  while (days[k2]) { cur++; k2 = addDays(k2, -1); }
  return { current: cur, last7: last7 };
}

/* --- Messy-note parser, ported from Pace ----------------------------
   Turns "gym tomorrow at 6pm, take dose friday" into tidy items.
   Used by to-dos first; meals and quick-add ride it later. */
var WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function nextWeekday(baseKey, wd, strictlyAfter) {
  var d = parseKey(baseKey);
  var diff = (wd - d.getDay() + 7) % 7;
  if (diff === 0 && strictlyAfter) diff = 7;
  d.setDate(d.getDate() + diff);
  return toKey(d);
}
function parseQuickNote(raw, baseKey) {
  var s = " " + String(raw || "").trim().replace(/\s+/g, " ") + " ";
  if (s.trim().length < 2) return null;
  var date = baseKey, dm, time = null, tm;
  if (/\bday after tomorrow\b/i.test(s)) { date = addDays(baseKey, 2); s = s.replace(/\bday after tomorrow\b/i, " "); }
  else if (/\btomorrow\b/i.test(s)) { date = addDays(baseKey, 1); s = s.replace(/\btomorrow\b/i, " "); }
  else if ((dm = s.match(/\bin (\d+) days?\b/i))) { date = addDays(baseKey, +dm[1]); s = s.replace(dm[0], " "); }
  else if ((dm = s.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) {
    date = nextWeekday(baseKey, WEEKDAYS.indexOf(dm[1].toLowerCase()), true);
    if ((parseKey(date) - parseKey(baseKey)) / 86400000 < 7) date = addDays(date, 7);
    s = s.replace(dm[0], " ");
  } else if ((dm = s.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) {
    date = nextWeekday(baseKey, WEEKDAYS.indexOf(dm[1].toLowerCase()), false);
    s = s.replace(dm[0], " ");
  }
  if ((tm = s.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)) || (tm = s.match(/\b(\d{1,2})(am|pm)\b/i))) {
    var h = +tm[1], mi = +(tm[2] || 0), ap = (tm[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    time = pad(h) + ":" + pad(mi);
    s = s.replace(tm[0], " ");
  }
  var title = s.replace(/\s+/g, " ").trim().replace(/^[\s,.\-]+|[\s,.\-]+$/g, "");
  if (title.length < 2) return null;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title: title, date: date, time: time };
}
function parseQuickDump(text, baseKey) {
  var out = [];
  String(text || "").split(/\n+/).forEach(function (line) {
    line.split(/;\s*/).forEach(function (part) {
      var item = parseQuickNote(part, baseKey);
      if (item) out.push(item);
    });
  });
  return out;
}

/* --- State repair: fix shapes, drop NOTHING --------------------------
   Every list keeps its length. A broken entry is repaired field by
   field into a safe shape, the way Meal Prep repairs groceries. */
function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
function safeList(x, fix) {
  if (!Array.isArray(x)) return [];
  return x.map(function (item, i) { return fix(isObj(item) ? item : {}, i); });
}
function emptyState() {
  return { profile: null, checkins: {}, plan: {}, customRecipes: [], treats: [],
    pantry: [], extras: [], routines: [], sessions: [], peptides: [], habits: [], todos: [], imports: [],
    disclaimer: null, settings: { notifications: false }, demoUnlock: null };
}
/* Routine and session items, normalised slot by slot (QA
   Phase 4 finding F2, 14 Oct 2026): a poisoned entry (null,
   a number, a half object) keeps its SLOT — the count never
   changes — and becomes a safe item shape the views can read
   without throwing. An item whose exerciseId is not a string
   keeps exerciseId null; the views render no row for it, but
   the slot, and therefore the user's count, survives. */
function safeRoutineItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(function (it) {
    if (!it || typeof it !== "object") return { exerciseId: null, sets: 1, reps: 1, timed: false, restSec: 45 };
    return Object.assign({}, it, {
      exerciseId: typeof it.exerciseId === "string" ? it.exerciseId : null,
      sets: Number(it.sets) > 0 ? Number(it.sets) : 1,
      reps: Number(it.reps) > 0 ? Number(it.reps) : 1,
      timed: !!it.timed,
      restSec: Number(it.restSec) >= 0 ? Number(it.restSec) : 45 });
  });
}
function repairState(raw) {
  var out = emptyState();
  if (!isObj(raw)) return out;
  if (isObj(raw.profile)) {
    var p = raw.profile;
    out.profile = {
      name: typeof p.name === "string" ? p.name : "",
      weightKg: Number(p.weightKg) > 0 ? Number(p.weightKg) : null,
      heightCm: Number(p.heightCm) > 0 ? Number(p.heightCm) : null,
      age: Number(p.age) > 0 ? Number(p.age) : null,
      formulaSex: p.formulaSex === "male" || p.formulaSex === "female" ? p.formulaSex : null,
      activity: ["low", "some", "lots"].indexOf(p.activity) !== -1 ? p.activity : "some",
      deficit: ["none", "gentle", "steady"].indexOf(p.deficit) !== -1 ? p.deficit : "gentle",
      goals: Array.isArray(p.goals) ? p.goals.filter(function (g) { return typeof g === "string"; }) : [],
      preferences: Array.isArray(p.preferences) ? p.preferences.filter(function (g) { return typeof g === "string"; }) : [],
      allergies: Array.isArray(p.allergies) ? p.allergies.filter(function (g) { return typeof g === "string"; }) : [],
      needs: Array.isArray(p.needs) ? p.needs.filter(function (g) { return typeof g === "string"; }) : [],
      setupDone: !!p.setupDone
    };
  }
  if (isObj(raw.checkins)) Object.keys(raw.checkins).forEach(function (k) {
    /* History migration (her word, 15 Oct 2026): check-ins
       saved under the old set are carried onto the new
       words, never dropped: rough to bad, steady to ok,
       good to great. */
    var CHECKIN_MIGRATION = { rough: "bad", steady: "ok", good: "great" };
    var cv = CHECKIN_MIGRATION[raw.checkins[k]] || raw.checkins[k];
    if (["bad", "ok", "great"].indexOf(cv) !== -1) out.checkins[k] = cv;
  });
  if (isObj(raw.plan)) out.plan = raw.plan;
  if (isObj(raw.tier)) out.tier = { plan: raw.tier.plan === "pro" ? "pro" : "free" };
  out.customRecipes = safeList(raw.customRecipes, function (r, i) {
    return Object.assign({}, r, { id: typeof r.id === "string" && r.id ? r.id : "custom." + i,
      name: typeof r.name === "string" && r.name ? r.name : "My recipe" });
  });
  out.treats = safeList(raw.treats, function (t, i) {
    return Object.assign({}, t, { id: typeof t.id === "string" && t.id ? t.id : "treat." + i,
      name: typeof t.name === "string" && t.name ? t.name : "Treat",
      kcal: Number(t.kcal) > 0 ? Number(t.kcal) : null });
  });
  out.pantry = safeList(raw.pantry, function (g, i) {
    return Object.assign({}, g, { id: typeof g.id === "string" && g.id ? g.id : "g" + i,
      name: typeof g.name === "string" && g.name ? g.name : "food" });
  });
  out.extras = safeList(raw.extras, function (x, i) {
    return Object.assign({}, x, { id: typeof x.id === "string" && x.id ? x.id : "x" + i,
      name: typeof x.name === "string" && x.name ? x.name : "extra" });
  });
  out.peptides = safeList(raw.peptides, function (pp, i) {
    var base = Object.assign({}, pp, { id: typeof pp.id === "string" && pp.id ? pp.id : "pep." + i,
      name: typeof pp.name === "string" && pp.name ? pp.name : "Peptide",
      color: typeof pp.color === "string" && pp.color ? pp.color : null,
      log: Array.isArray(pp.log) ? pp.log : [] });
    /* Schedule shapes of record are { days:[..] } and
       { intervalDays:n, startKey } (what the intake writes and
       nextDoseKey reads). Older/fixture shapes are translated
       here, at the repair boundary, keeping every field:
       { type:"every", every:n, start } gains its intervalDays
       twin; { type:"daily" } gains the all-week days list. */
    var sc = base.schedule;
    if (sc && typeof sc === "object" && !Array.isArray(sc.days) && !(sc.intervalDays > 0)) {
      if (sc.type === "every" && sc.every > 0) base.schedule = Object.assign({}, sc, { intervalDays: sc.every, startKey: sc.start || base.startKey || null });
      else if (sc.type === "daily") base.schedule = Object.assign({}, sc, { days: [0, 1, 2, 3, 4, 5, 6] });
    }
    return base;
  });
  /* Each peptide keeps its OWN colour (her rule): a missing or
     repeated colour is replaced with the next free palette colour. */
  var usedColors = {};
  out.peptides.forEach(function (pp) {
    if (!pp.color || usedColors[pp.color]) pp.color = nextColor(out.peptides.filter(function (x) { return x !== pp && x.color; }).map(function (x) { return x.color; }));
    usedColors[pp.color] = true;
  });
  out.routines = safeList(raw.routines, function (r, i) {
    return Object.assign({}, r, { id: typeof r.id === "string" && r.id ? r.id : "routine." + i,
      createdKey: typeof r.createdKey === "string" && r.createdKey ? r.createdKey : todayKey(),
      name: typeof r.name === "string" && r.name ? r.name : "Routine",
      days: Array.isArray(r.days) ? r.days.filter(function (d) { return Number(d) >= 0 && Number(d) <= 6; }) : [],
      time: typeof r.time === "string" && r.time ? r.time : null,
      items: safeRoutineItems(r.items),
      goalId: typeof r.goalId === "string" ? r.goalId : null });
  });
  out.sessions = safeList(raw.sessions, function (ss, i) {
    return Object.assign({}, ss, { id: typeof ss.id === "string" && ss.id ? ss.id : "session." + i,
      dateKey: typeof ss.dateKey === "string" ? ss.dateKey : null,
      items: safeRoutineItems(ss.items),
      status: ss.status === "active" ? "active" : "done" });
  });
  out.habits = safeList(raw.habits, function (hb, i) {
    return Object.assign({}, hb, { id: typeof hb.id === "string" && hb.id ? hb.id : "habit." + i,
      name: typeof hb.name === "string" && hb.name ? hb.name : "Habit",
      days: isObj(hb.days) ? hb.days : {} });
  });
  out.todos = safeList(raw.todos, function (t, i) {
    return Object.assign({}, t, { id: typeof t.id === "string" && t.id ? t.id : "todo." + i,
      title: typeof t.title === "string" && t.title ? t.title : "To do",
      date: typeof t.date === "string" && t.date ? t.date : null,
      time: typeof t.time === "string" && t.time ? t.time : null,
      color: typeof t.color === "string" && t.color ? t.color : "#8A7A63",
      category: typeof t.category === "string" && t.category ? t.category : "general",
      durationMin: Number(t.durationMin) > 0 ? Number(t.durationMin) : 25,
      status: t.status === "done" ? "done" : "open" });
  });
  /* The import registry (Bring my calendar in): rows are kept
     as written; a non-array becomes an empty registry. Repair
     never drops a row. */
  out.imports = Array.isArray(raw.imports) ? raw.imports.filter(function (r) { return isObj(r); }) : [];
  if (isObj(raw.disclaimer) && typeof raw.disclaimer.agreedAt === "string") {
    out.disclaimer = { agreedAt: raw.disclaimer.agreedAt,
      version: Number(raw.disclaimer.version) || 1 };
  }
  /* QA Phase 8 F1: settings is CARRIED THROUGH, never rebuilt
     from a whitelist — a closed rebuild silently ate
     the guide-off flag and the guide celebration flags
     on every load (and would eat any future settings key,
     including keys arriving through the Phase 6 merge, whose
     output passes through this repair too). The one coercion
     stays: notifications is a boolean. */
  if (isObj(raw.settings)) {
    out.settings = Object.assign({}, raw.settings);
    out.settings.notifications = !!raw.settings.notifications;
  }
  /* P4 demo unlock (SPARK SHAPE): a code-door demo session
     carries the SHA-256 of its access code here; auth.js
     writes it into the cloud root doc, where the rules gate
     checks it against the desk-held record. A string or
     nothing — anything else is dropped. */
  out.demoUnlock = typeof raw.demoUnlock === "string" && raw.demoUnlock ? raw.demoUnlock : null;
  return out;
}

/* --- Meal planning to a budget (Phase 2) ------------------------------
   The calorie engine itself is Meal Prep's (meals-logic.js, copied
   whole). These functions sit on top: pick one recipe per meal so
   the day lands close to the budget, never serve a recipe that
   clashes with the user's allergies, and add treats as kind
   information, never as a verdict. kcalOf(recipe) returns kcal or
   null; a recipe with no honest number is never picked for a
   budgeted plan (it can still be picked when there is no budget). */
var MEAL_SHARES = { breakfast: 0.25, lunch: 0.35, dinner: 0.4 };
/* Allergen families: an allergy word stands for its whole
   family, not just the literal word. QA Phase 2 finding F2
   (14 Oct 2026): "milk" alone let parmesan, yogurt and butter
   through the plan filter. The families mirror Meal Prep's
   ALLERGEN_GROUPS (vendored in meals-data.js, used by the
   swap-box path) so both Fit paths block the same recipes;
   milk gains "whey" per QA's fix shape, and "dairy" is an
   alias for the milk family (setup allergies are free text).
   Exceptions first: coconut in any form and peanut butter
   carry no dairy and never fire milk (Meal Prep's rule);
   cocoa and cacao butter are plant fats, not dairy. */
var ALLERGEN_FAMILIES = {
  "milk": ["butter", "cheese", "feta", "mozzarella", "yogurt", "cream", "halloumi", "parmesan", "whey"],
  "dairy": ["milk", "butter", "cheese", "feta", "mozzarella", "yogurt", "cream", "halloumi", "parmesan", "whey"],
  "cheese": ["feta", "mozzarella", "halloumi", "parmesan"],
  "gluten": ["flour", "bread", "pasta", "spaghetti", "couscous", "tortilla", "pita", "pizza base", "noodles", "taco shells", "soy sauce", "rolled oats"],
  "egg": ["mayonnaise"]
};
function ingredientHitsAllergy(ingredientName, allergies) {
  var n = " " + String(ingredientName || "").toLowerCase() + " ";
  return (allergies || []).some(function (a) {
    var t = String(a || "").toLowerCase().trim();
    if (!t) return false;
    if ((t === "milk" || t === "dairy") && (n.indexOf("coconut") !== -1 || n.indexOf("peanut butter") !== -1 || n.indexOf("cocoa butter") !== -1 || n.indexOf("cacao butter") !== -1)) return false;
    var terms = [t].concat(ALLERGEN_FAMILIES[t] || []);
    return terms.some(function (k) { return n.indexOf(k) !== -1; });
  });
}
function recipeSafe(recipe, profile) {
  if (!profile || !profile.allergies || !profile.allergies.length) return true;
  return !(recipe.ingredients || []).some(function (i) { return ingredientHitsAllergy(i.name, profile.allergies); });
}
function planDayMeals(budgetKcal, recipes, kcalOf, profile, recentIds) {
  var out = { total: 0, complete: true };
  ["breakfast", "lunch", "dinner"].forEach(function (meal) {
    var pool = (recipes || []).filter(function (r) { return r.meal === meal && recipeSafe(r, profile); });
    if (!pool.length) { out[meal] = null; out.complete = false; return; }
    var target = budgetKcal ? budgetKcal * MEAL_SHARES[meal] : null;
    var best = null, bestScore = -Infinity;
    pool.forEach(function (r) {
      var k = kcalOf(r);
      var score = 0;
      if (target != null) {
        if (k == null) score = -100000; /* no honest number, not for a budgeted day */
        else score = -Math.abs(k - target);
      } else score = k == null ? -1 : 0;
      if (profile && profile.preferences && r.cuisines) {
        r.cuisines.forEach(function (c) { if (profile.preferences.indexOf(c) !== -1) score += 12; });
      }
      if ((recentIds || []).indexOf(r.id) !== -1) score -= 30;
      if (score > bestScore) { bestScore = score; best = { recipe: r, kcal: k }; }
    });
    out[meal] = best ? { id: best.recipe.id, kcal: best.kcal } : null;
    if (!best) out.complete = false;
    else if (best.kcal == null) out.complete = false;
    else out.total += best.kcal;
  });
  return out;
}
function treatsTotal(treats) {
  var known = 0, unknown = 0;
  (treats || []).forEach(function (t) { if (Number(t.kcal) > 0) known += Number(t.kcal); else unknown++; });
  return { known: known, unknown: unknown };
}
/* "200 g chicken breast" / "2 pcs egg" / "1 tbsp honey" / "egg" */
function parseIngredientLine(line) {
  var s = String(line || "").trim();
  if (!s) return null;
  var m = s.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|pcs|slices|tbsp|tsp|cloves)?\s+(.+)$/i);
  if (m) {
    var qty = Number(m[1]), unit = (m[2] || "pcs").toLowerCase();
    if (unit === "kg") { qty = qty * 1000; unit = "g"; }
    if (unit === "l") { qty = qty * 1000; unit = "ml"; }
    return { qty: qty, unit: unit, name: m[3].trim().toLowerCase() };
  }
  return { qty: 1, unit: "pcs", name: s.toLowerCase() };
}

/* --- To-do categories + durations, ported from Pace ---------------- */
var TODO_CATEGORIES = [
  { id: "health", words: ["doctor", "dentist", "medicine", "tablet", "gym", "walk", "run", "yoga", "physio", "dose", "appointment"], color: "#A9604F" },
  { id: "food", words: ["cook", "shop", "groceries", "market", "meal", "recipe", "fridge"], color: "#8A6D4F" },
  { id: "home", words: ["clean", "tidy", "wash", "laundry", "kitchen", "bedroom", "bins", "garden", "dishes"], color: "#6C8A5F" },
  { id: "people", words: ["call", "visit", "birthday", "friend", "mum", "mom", "dad", "kids", "school", "message", "text"], color: "#C08552" },
  { id: "work", words: ["work", "meeting", "email", "report", "client", "boss", "presentation"], color: "#6B7F8C" },
  { id: "rest", words: ["rest", "nap", "read", "bath", "breathe", "meditate", "break"], color: "#7C7390" }
];
function categoryFor(title) {
  var t = " " + String(title).toLowerCase() + " ";
  for (var i = 0; i < TODO_CATEGORIES.length; i++) {
    for (var j = 0; j < TODO_CATEGORIES[i].words.length; j++) {
      if (t.indexOf(TODO_CATEGORIES[i].words[j]) !== -1) return { id: TODO_CATEGORIES[i].id, color: TODO_CATEGORIES[i].color };
    }
  }
  return { id: "general", color: "#8A7A63" };
}
function estimateDuration(title) {
  var t = String(title).toLowerCase();
  if (/\b(email|message|text|reply|call|phone)\b/.test(t)) return 10;
  if (/\b(clean|tidy|organise|organize|declutter|laundry|garden)\b/.test(t)) return 30;
  if (/\b(shop|groceries|appointment|doctor|dentist|meeting)\b/.test(t)) return 45;
  if (/\b(write|report|plan|study|pack|prep)\b/.test(t)) return 45;
  return 25;
}
function makeTodo(parsed) {
  var cat = categoryFor(parsed.title);
  return { title: parsed.title, date: parsed.date, time: parsed.time || null,
    durationMin: estimateDuration(parsed.title), category: cat.id, color: cat.color, status: "open" };
}
function todosOn(todos, key) {
  return (todos || []).filter(function (t) { return t.date === key; }).slice().sort(function (a, b) {
    if (a.time && b.time) return a.time < b.time ? -1 : 1;
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
}
/* Month grid maths: weeks start Monday. Returns 42 keys or fewer,
   trimmed to whole weeks that touch the month. */
function monthGrid(year, month) {
  var first = new Date(year, month, 1, 12);
  var startOffset = (first.getDay() + 6) % 7; /* Monday = 0 */
  var start = new Date(year, month, 1 - startOffset, 12);
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var cells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  var out = [];
  for (var i = 0; i < cells; i++) { var d = new Date(start); d.setDate(start.getDate() + i); out.push(toKey(d)); }
  return out;
}

/* --- Gym routines (Phase 4) -------------------------------------------
   buildRoutine is deterministic: same goal, minutes and exercise
   list always give the same routine, so it can be unit-tested and
   a user can trust that a rebuild will not shuffle their plan. */
var GYM_GOALS = [
  { id: "legs", label: "Leg day", parts: ["quadriceps", "hamstrings", "glutes", "calves"], sets: 3, reps: 12, restSec: 45 },
  { id: "back", label: "Back day", parts: ["lats", "middle back", "lower back"], sets: 3, reps: 12, restSec: 45 },
  { id: "push", label: "Chest and shoulders", parts: ["chest", "shoulders"], sets: 3, reps: 12, restSec: 45 },
  { id: "arms", label: "Arm day", parts: ["biceps", "triceps"], sets: 3, reps: 12, restSec: 40 },
  { id: "full", label: "Full body", parts: ["quadriceps", "chest", "lats", "abdominals", "glutes"], sets: 3, reps: 10, restSec: 45 },
  { id: "gentle", label: "Gentle start", parts: ["quadriceps", "glutes", "chest", "abdominals"], sets: 2, reps: 10, restSec: 60 }
];
/* D2 eligibility (Exercises Phase 0, gated whole 17 Oct 2026):
   the ONE pool the routine builder may pick from — category
   strength AND level beginner, nothing else, no exceptions
   list. Intermediate is hand-picked only ("A step up"); expert
   enters no routine by any path in v1; non-strength categories
   are library held classes, never routine reps. Records that
   predate the D1 schema (no category field) read as strength:
   the shipped library was curated beginner strength only, and
   repair-never-drops means old records keep working. */
function routinePool(exercises) {
  return (exercises || []).filter(function (e) {
    return !!e && e.level === "beginner" && (e.category === "strength" || e.category == null);
  });
}
/* F7 load leg (Exercises Phase 2, the QA fence's stated
   behaviour): an exercise may be PLAYED from a saved routine
   or session only when it is in the library AND it is strength
   (or a pre-schema record, which reads as strength) AND its
   level is beginner or intermediate. Expert exercises, the
   non-strength held classes and unknown ids NEVER play. The
   saved data itself is never edited by this rule:
   safeRoutineItems keeps every slot, repairState stays
   library-blind, and an unplayable saved item simply does not
   start — the session player skips it, the routine card shows
   it calm and library-only, and the data stays the user's. */
function routinePlayable(ex) {
  return !!ex && (ex.category === "strength" || ex.category == null) &&
    (ex.level === "beginner" || ex.level === "intermediate");
}
function playableItems(items, exercises) {
  var byId = {};
  (exercises || []).forEach(function (e) { if (e && e.id) byId[e.id] = e; });
  return (items || []).filter(function (it) {
    return !!it && routinePlayable(byId[it.exerciseId]);
  });
}
function buildRoutine(goalId, minutes, exercises, ctx) {
  var goal = null;
  GYM_GOALS.forEach(function (g) { if (g.id === goalId) goal = g; });
  if (!goal) return null;
  var count = Math.max(3, Math.min(8, Math.round((Number(minutes) || 30) / 9)));
  /* Trainer matching (design section 6): when the context
     carries completed sessions, candidates at stations the user
     has already used come first within each part. Preference
     only: the pool is the same set, the parts are the same, and
     with no logged stations the library order stands untouched,
     so a build with no history is byte-identical to the plain
     build. Array sort is stable, so ties keep library order. */
  var source = exercises;
  if (ctx && ctx.sessions) {
    var usedStations = trainerUsedStations(ctx.sessions, exercises);
    if (Object.keys(usedStations).length) {
      source = (exercises || []).slice().sort(function (a, b) {
        var ua = a && usedStations[a.station] ? 0 : 1;
        var ub = b && usedStations[b.station] ? 0 : 1;
        return ua - ub;
      });
    }
  }
  var eligible = routinePool(source);
  var byPart = {};
  goal.parts.forEach(function (p) {
    byPart[p] = eligible.filter(function (e) { return e.part === p; });
  });
  var items = [], used = {};
  var round = 0, added = true;
  while (items.length < count && added) {
    added = false;
    for (var i = 0; i < goal.parts.length && items.length < count; i++) {
      var pool = byPart[goal.parts[i]];
      var ex = pool[round];
      if (ex && !used[ex.id]) {
        used[ex.id] = true; added = true;
        items.push({ exerciseId: ex.id, sets: goal.sets,
          reps: ex.timed ? ex.timed : goal.reps, timed: !!ex.timed, restSec: goal.restSec });
      }
    }
    round++;
  }
  var built = { goalId: goal.id, name: goal.label, minutes: Number(minutes) || 30, items: items };
  if (ctx) trainerStartVolume(built, goal, ctx);
  return built;
}
/* Bad-day lightening (used by the morning check-in in Phase 7,
   built here because it is gym maths): fewer sets, never zero,
   and the last exercise rests. Nothing is removed outright. */
function lightenRoutine(routine) {
  if (!routine || !routine.items) return routine;
  var out = JSON.parse(JSON.stringify(routine));
  out.items = out.items.map(function (it) {
    var copy = Object.assign({}, it);
    copy.sets = Math.max(1, copy.sets - 1);
    copy.restSec = copy.restSec + 15;
    return copy;
  });
  if (out.items.length > 3) out.items = out.items.slice(0, out.items.length - 1);
  out.lightened = true;
  return out;
}
function routineDueOn(routine, isoKey) {
  if (!routine || !routine.days || !routine.days.length || !routine.createdKey) return false;
  if (isoKey < routine.createdKey) return false;
  var wd = parseKey(isoKey).getDay(); /* 0 = Sunday */
  return routine.days.indexOf(wd) !== -1;
}

/* --- Trainer layer (Exercises trainer slice) ----------------------------
   The design of record is hidden_files/TRAINER-MATCHING-DESIGN.md.
   Everything here personalises INSIDE the D2 pool: routinePool is
   never widened, saved data is never edited, and the only history
   read is the user's own logged sessions. Weight is part of the
   context the app passes and is deliberately never read into the
   arithmetic and never reaches copy (design sections 2 and 7):
   two contexts that differ only in weight build the identical
   routine, and the suite pins that. */

/* TRAINER_UNLOCK_SESSIONS is a DESK DESIGN PARAMETER, adopted by
   this slice: design section 5 proposed 8 completed sessions and
   ruled the number is decided at the trainer slice. It is not the
   user's words and not a user ruling; the gates may amend it on
   record. After this many completed sessions in total,
   intermediate strength may be offered to HAND-PICKS only. The
   auto-builder's pool is untouched by it, and expert stays
   library-only at every count (D2 plus the QA rider, absolute). */
var TRAINER_UNLOCK_SESSIONS = 8;
/* The step ladder's ceiling (design section 4 names the step and
   the ceiling without sizing the space between): at a goal's
   template the step is +1 set, and sets may climb at most this
   far above the template. Also a desk parameter of this slice. */
var TRAINER_SET_HEADROOM = 1;
var TRAINER_STEP_GAP_DAYS = 14;
var TRAINER_STEP_PAIR = 2;

function trainerDoneSessions(sessions) {
  return (sessions || []).filter(function (s) { return !!s && s.status === "done"; }).slice().sort(function (a, b) {
    var ka = a.dateKey || "", kb = b.dateKey || "";
    if (ka !== kb) return ka < kb ? -1 : 1;
    var ta = Number(a.startedAt) || 0, tb = Number(b.startedAt) || 0;
    if (ta !== tb) return ta - tb;
    var ia = String(a.id || ""), ib = String(b.id || "");
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}
function trainerTotalDone(sessions) { return trainerDoneSessions(sessions).length; }
function stepUpUnlocked(sessions) { return trainerTotalDone(sessions) >= TRAINER_UNLOCK_SESSIONS; }
function trainerHistoryFor(sessions, routineId) {
  return trainerDoneSessions(sessions).filter(function (s) { return s.routineId === routineId; });
}
/* Stations the user has actually trained at, read from their
   completed sessions (design section 6b). */
function trainerUsedStations(sessions, exercises) {
  var byId = {};
  (exercises || []).forEach(function (e) { if (e && e.id) byId[e.id] = e; });
  var used = {};
  trainerDoneSessions(sessions).forEach(function (s) {
    (s.items || []).forEach(function (it) {
      var ex = it && byId[it.exerciseId];
      if (ex && ex.station) used[ex.station] = true;
    });
  });
  return used;
}
function trainerVolumeOf(item) {
  return item ? { sets: Number(item.sets) || 0, reps: Number(item.reps) || 0 } : null;
}
/* Ladder rank, only ever used to compare two volumes of the same
   exercise under the same goal: sets weigh more than reps. */
function trainerRank(vol, goal) { return (vol.sets - goal.sets) * 32 + (vol.reps - goal.reps); }
/* One small step up (design section 4): +1 rep while reps are
   below the goal's reps, else +1 set, never both, never past
   the ceiling. Returns null at the ceiling. */
function trainerStepUp(vol, goal) {
  if (vol.reps < goal.reps) return { sets: vol.sets, reps: vol.reps + 1 };
  if (vol.sets < goal.sets + TRAINER_SET_HEADROOM) return { sets: vol.sets + 1, reps: vol.reps };
  return null;
}
/* The volume change one exercise has earned, from one routine's
   own completed sessions (design section 4). `refItem` is the
   volume the user was actually training at (the saved routine's
   item, or the fresh build's item when they are the same).
   Returns { kind: "up" | "back", vol } or null when the plan
   holds. Timed holds keep their prescribed volume: progression
   never stretches a hold. */
function trainerItemChange(refItem, goal, history, today) {
  var cur = trainerVolumeOf(refItem);
  if (!cur || !refItem || refItem.timed) return null;
  var mine = [];
  history.forEach(function (s) {
    (s.items || []).forEach(function (it) {
      if (it && it.exerciseId === refItem.exerciseId) {
        mine.push({ vol: trainerVolumeOf(it), lightened: !!s.lightened });
      }
    });
  });
  if (!mine.length) return null;
  var last = history[history.length - 1];
  var gap = today && last.dateKey ? Math.round((parseKey(today) - parseKey(last.dateKey)) / 86400000) : 0;
  if (gap >= TRAINER_STEP_GAP_DAYS) {
    /* Step back, kindly: the last volume this exercise was
       completed twice at. Only full sessions set the target: a
       lightened day never drags the plan down (design section
       4). A lightened completion still counts as showing up, so
       it is the gap clock above that it resets, never this. */
    var stats = {};
    mine.forEach(function (m, idx) {
      if (m.lightened) return;
      var k = m.vol.sets + "x" + m.vol.reps;
      if (!stats[k]) stats[k] = { vol: m.vol, count: 0, lastIdx: -1 };
      stats[k].count++; stats[k].lastIdx = idx;
    });
    var target = null, bestIdx = -1;
    Object.keys(stats).forEach(function (k) {
      var st = stats[k];
      if (st.count >= TRAINER_STEP_PAIR && st.lastIdx > bestIdx) { bestIdx = st.lastIdx; target = st.vol; }
    });
    if (target && trainerRank(target, goal) < trainerRank(cur, goal)) return { kind: "back", vol: target };
    return null;
  }
  /* Step up: the most recent pair of completions credits the
     step when each was finished at the current volume, or was a
     lightened session finished in full (a bad day counts whole,
     design sections 1 and 4). One completion alone holds. */
  var recent = mine.slice(-TRAINER_STEP_PAIR);
  if (recent.length < TRAINER_STEP_PAIR) return null;
  var credits = recent.every(function (m) {
    return m.lightened || (m.vol.sets === cur.sets && m.vol.reps === cur.reps);
  });
  if (!credits) return null;
  var up = trainerStepUp(cur, goal);
  return up ? { kind: "up", vol: up } : null;
}
/* Apply the earned volume changes to a list of items. When
   refItems is given (a rebuild carrying a saved routine's line
   forward), each exercise's change is read against the saved
   volume it was trained at, and an earned level above the fresh
   template is carried, never silently dropped. Input items are
   never mutated. kind is "up" when any exercise steps up, else
   "back" when any steps back, else "none": the gap branch is
   routine-wide, so the two never mix in one pass. */
function trainerApplyVolumes(items, goal, history, today, refItems) {
  var ref = {};
  (refItems || []).forEach(function (it) { if (it) ref[it.exerciseId] = it; });
  var kind = "none";
  var out = (items || []).map(function (it) {
    if (!it) return it;
    var refItem = ref[it.exerciseId] || it;
    var r = trainerItemChange(refItem, goal, history, today);
    if (r) {
      if (r.kind === "up") kind = "up"; else if (kind === "none") kind = "back";
      return Object.assign({}, it, { sets: r.vol.sets, reps: r.vol.reps });
    }
    var refVol = trainerVolumeOf(refItem), myVol = trainerVolumeOf(it);
    if (refItems && refVol && myVol && trainerRank(refVol, goal) > trainerRank(myVol, goal)) {
      return Object.assign({}, it, { sets: refVol.sets, reps: refVol.reps });
    }
    return it;
  });
  return { kind: kind, items: out };
}
/* The trainer's read on a SAVED routine: what a user-tapped
   rebuild would change today. Pure advice; it edits nothing.
   The app shows it plainly and applies it only on the user's
   tap (design section 4: no auto-edits to saved routines). */
function trainerAdvice(routine, sessions, today) {
  var none = { kind: "none", items: (routine && routine.items) || [] };
  if (!routine || !routine.goalId) return none;
  var goal = null;
  GYM_GOALS.forEach(function (g) { if (g.id === routine.goalId) goal = g; });
  if (!goal) return none;
  var history = trainerHistoryFor(sessions, routine.id);
  if (!history.length) return none;
  return trainerApplyVolumes(routine.items, goal, history, today, null);
}
/* The trainer layer on a fresh build (design sections 3 and 4).
   A brand new user's first routines start one set lighter when
   their own setup words say start gently: the lowest activity
   option, or the Gentle start goal itself. Starting smaller is
   the plan working, never a judgement, and no copy says why in
   body terms. A build for a goal the user already trains
   carries that routine's progression forward. */
function trainerStartVolume(built, goal, ctx) {
  if (!trainerTotalDone(ctx.sessions)) {
    var profile = ctx.profile || {};
    if (profile.activity === "low" || goal.id === "gentle") {
      built.items = built.items.map(function (it) {
        return Object.assign({}, it, { sets: Math.max(1, (Number(it.sets) || 1) - 1) });
      });
    }
    return;
  }
  var prev = ctx.prevRoutine;
  if (!prev || prev.goalId !== goal.id) return;
  var history = trainerHistoryFor(ctx.sessions, prev.id);
  if (!history.length) return;
  var r = trainerApplyVolumes(built.items, goal, history, ctx.todayKey, prev.items);
  built.items = r.items;
}

/* --- Reminder planning (Tranche A-4) ------------------------------------
   Pure: which dose + gym moments deserve a device-local reminder next.
   The app layer turns these into scheduled phone notifications inside
   the store wrap; on the web nothing is scheduled (in-app surfaces
   carry the day). Times are the user's own schedule, read only. */
function planReminders(st, fromKey, opts) {
  opts = opts || {};
  var nowMs = typeof opts.now === "number" ? opts.now : null;
  var out = [];
  function push(kind, ref, name, key, time) {
    if (!key || !time) return;
    var parts = String(time).split(":");
    var d = parseKey(key);
    d.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
    var at = d.getTime();
    if (nowMs !== null && at <= nowMs) return;
    out.push({ kind: kind, ref: ref, name: name, key: key, time: time, at: at });
  }
  (st.peptides || []).forEach(function (p) {
    if (!p.time) return;
    var cursor = fromKey, found = 0, guard = 0;
    while (found < 3 && guard < 40) {
      var k = nextDoseKey(p, cursor);
      if (!k || k > addDays(fromKey, 21)) break;
      push("dose", p.id, p.name, k, p.time);
      found++; guard++;
      cursor = addDays(k, 1);
    }
  });
  (st.routines || []).forEach(function (r) {
    if (!r.time || !r.days || !r.days.length) return;
    var found = 0;
    for (var i = 0; i < 28 && found < 4; i++) {
      var key = addDays(fromKey, i);
      if (routineDueOn(r, key)) { push("gym", r.id, r.name, key, r.time); found++; }
    }
  });
  out.sort(function (a, b) { return a.at - b.at; });
  return out.slice(0, 32);
}

/* --- Account state merge (Phase 6) -------------------------------------
   When accounts open, a user's cloud copy and device copy must join
   without losing anything (Data Never Deleted): lists join by id,
   day-keyed maps join by key, the disclaimer keeps the EARLIEST
   agreement on record, and the profile comes from whichever copy
   finished setup (else the cloud). The result is repaired before
   it is returned, so a broken cloud doc cannot poison the app. */
function mergeStates(cloud, local) {
  cloud = isObj(cloud) ? cloud : {};
  local = isObj(local) ? local : {};
  function unionList(a, b, progressRule) {
    /* QA Phase 6 F1: a list field that is not an array (a
       corrupt or drifted cloud doc) counts as EMPTY — the
       merge must never throw at sign-in time. */
    var la = Array.isArray(a) ? a : [], lb = Array.isArray(b) ? b : [];
    var out = [], seen = {};
    la.concat(lb).forEach(function (item, i) {
      var id = isObj(item) && typeof item.id === "string" && item.id ? item.id : "row" + i;
      if (!seen[id]) { seen[id] = true; out.push(item); return; }
      /* Same id on both sides: the cloud copy wins BY RULE,
         except progress never runs backwards — a finished
         copy beats an unfinished one either way round
         (QA's carried observation, ruled at this desk
         14 Oct: items carry no updatedAt, so the honest
         rule is progress-first, cloud otherwise). */
      if (progressRule) {
        var at = out.findIndex(function (o) { return isObj(o) && o.id === id; });
        if (at >= 0 && progressRule(out[at], item)) out[at] = item;
      }
    });
    return out;
  }
  function progressed(item) { return isObj(item) && (item.status === "done" || item.done === true); }
  function progressFirst(existing, incoming) {
    return progressed(incoming) && !progressed(existing);
  }
  function unionMap(a, b) { return Object.assign({}, isObj(a) ? a : {}, isObj(b) ? b : {}); }
  var out = {};
  var lp = isObj(local.profile) ? local.profile : null, cp = isObj(cloud.profile) ? cloud.profile : null;
  out.profile = (lp && lp.setupDone) ? lp : (cp || lp);
  out.checkins = unionMap(cloud.checkins, local.checkins);
  out.plan = unionMap(cloud.plan, local.plan);
  out.customRecipes = unionList(cloud.customRecipes, local.customRecipes);
  out.treats = unionList(cloud.treats, local.treats);
  out.pantry = unionList(cloud.pantry, local.pantry);
  out.extras = unionList(cloud.extras, local.extras);
  out.routines = unionList(cloud.routines, local.routines);
  out.sessions = unionList(cloud.sessions, local.sessions, progressFirst);
  out.peptides = unionList(cloud.peptides, local.peptides);
  out.habits = unionList(cloud.habits, local.habits);
  out.todos = unionList(cloud.todos, local.todos, progressFirst);
  var cd = isObj(cloud.disclaimer) && cloud.disclaimer.agreedAt ? cloud.disclaimer : null;
  var ld = isObj(local.disclaimer) && local.disclaimer.agreedAt ? local.disclaimer : null;
  out.disclaimer = cd && ld ? (cd.agreedAt <= ld.agreedAt ? cd : ld) : (cd || ld);
  out.settings = unionMap(cloud.settings, local.settings);
  out.demoUnlock = typeof cloud.demoUnlock === "string" && cloud.demoUnlock ? cloud.demoUnlock :
    (typeof local.demoUnlock === "string" && local.demoUnlock ? local.demoUnlock : null);
  return repairState(out);
}

/* --- Bad-day list shaping (Phase 7) ------------------------------------
   On a bad day the to-do list shows the essentials: finished
   items, timed commitments, and the first two untimed things.
   Everything else WAITS, counted and named, never hidden away
   or dropped (Pace's adaptDay law, in this app's todo shape). */
function shapeTodosForDay(todos, level) {
  var list = (todos || []).slice();
  if (level !== "bad") return { shown: list, waiting: 0 };
  var done = list.filter(function (t) { return t.status === "done"; });
  var timed = list.filter(function (t) { return t.status !== "done" && t.time; });
  var untimed = list.filter(function (t) { return t.status !== "done" && !t.time; });
  var shown = done.concat(timed, untimed.slice(0, 2));
  return { shown: shown, waiting: Math.max(0, untimed.length - 2) };
}

/* --- Accounts size watch (Security flag F1 ruling: sliced
   storage WITH a size watch) ---
   Firestore caps one document at 1 MiB (1048576 bytes). Each
   state slice is its own document, and this watch measures
   every slice's JSON size so the app can warn the user well
   before any slice nears the ceiling. The warn line is set
   at 700000 bytes: early enough to act, never a surprise. */
var SLICE_WARN_BYTES = 700000;
function sliceBytes(value) {
  var json = JSON.stringify(value == null ? null : value);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
  return json.length;
}
function sliceSizes(state) {
  var out = {};
  if (!state) return out;
  Object.keys(state).forEach(function (k) { out[k] = sliceBytes(state[k]); });
  return out;
}
function oversizedSlices(state, limit) {
  var lim = typeof limit === "number" ? limit : SLICE_WARN_BYTES;
  var sizes = sliceSizes(state);
  return Object.keys(sizes).filter(function (k) { return sizes[k] > lim; });
}

var api = { pad: pad, toKey: toKey, parseKey: parseKey, addDays: addDays, todayKey: todayKey,
  shapeTodosForDay: shapeTodosForDay,
  SLICE_WARN_BYTES: SLICE_WARN_BYTES, sliceSizes: sliceSizes, oversizedSlices: oversizedSlices,
  mergeStates: mergeStates,
  GYM_GOALS: GYM_GOALS, routinePool: routinePool, buildRoutine: buildRoutine, lightenRoutine: lightenRoutine, routineDueOn: routineDueOn,
  routinePlayable: routinePlayable, playableItems: playableItems,
  TRAINER_UNLOCK_SESSIONS: TRAINER_UNLOCK_SESSIONS, trainerTotalDone: trainerTotalDone,
  stepUpUnlocked: stepUpUnlocked, trainerHistoryFor: trainerHistoryFor,
  trainerUsedStations: trainerUsedStations, trainerAdvice: trainerAdvice,
  TODO_CATEGORIES: TODO_CATEGORIES, categoryFor: categoryFor, estimateDuration: estimateDuration,
  makeTodo: makeTodo, todosOn: todosOn, monthGrid: monthGrid,
  MEAL_SHARES: MEAL_SHARES, ingredientHitsAllergy: ingredientHitsAllergy, recipeSafe: recipeSafe,
  planDayMeals: planDayMeals, treatsTotal: treatsTotal, parseIngredientLine: parseIngredientLine,
  estimateBudget: estimateBudget, adaptForCheckin: adaptForCheckin,
  mealBudgetFor: mealBudgetFor, areasForNeeds: areasForNeeds, nextColor: nextColor,
  nextDoseKey: nextDoseKey, planReminders: planReminders, disclaimerAgreed: disclaimerAgreed, streakInfo: streakInfo,
  parseQuickNote: parseQuickNote, parseQuickDump: parseQuickDump,
  emptyState: emptyState, repairState: repairState };
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.FitLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
