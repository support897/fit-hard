/* Fit App — demo fixture (Phase 6, P4; SPARK SHAPE, ruled by
   Store Review 14 Oct 2026). INVENTED data for "Alex Demo",
   seeded client-side into a demo session's OWN data space
   (an anonymous-auth session entered via "Explore the demo"
   or "Reviewer access"). There is no shared demo account
   and no server. This fixture is never merged into, and
   never overwrites, a real user's data: the app parks the
   device state before a demo session starts and restores
   it when the demo ends. The names here are invented;
   amounts are words, exactly as a user might type them. */
(function (root) {
  "use strict";
  function mpKey(iso) { return iso.replace(/-/g, "."); }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00"), m;
    d.setDate(d.getDate() + n);
    m = ("0" + (d.getMonth() + 1)).slice(-2);
    return d.getFullYear() + "-" + m + "-" + ("0" + d.getDate()).slice(-2);
  }
  /* picks: { days: [{breakfast, lunch, dinner} x7] (recipe ids
     for Monday..Sunday of this week), routine: a built routine
     object, disclaimerVersion: the current disclaimer version,
     mondayISO, todayISO } */
  function buildDemoState(picks) {
    var today = picks.todayISO, monday = picks.mondayISO;
    var plan = {};
    (picks.days || []).forEach(function (d, i) {
      if (d) plan[mpKey(addDays(monday, i))] = { breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner };
    });
    var routine = picks.routine || null;
    if (routine) { routine.days = [1, 3, 5]; routine.time = "18:00"; routine.createdKey = addDays(today, -7); if (!routine.name) routine.name = "Leg day"; }
    var habitDays = {}; habitDays[addDays(today, -1)] = true; habitDays[addDays(today, -2)] = true;
    var checkins = {}; checkins[addDays(today, -1)] = "ok"; checkins[today] = "great";
    return {
      profile: { name: "Alex", weightKg: 76, heightCm: 169, age: 36, formulaSex: "female",
        activity: "some", deficit: "gentle", goals: ["Lose weight kindly"],
        preferences: ["Quick meals"], allergies: [], needs: ["meals", "gym", "calendar", "peptides"], setupDone: true },
      checkins: checkins,
      plan: plan,
      customRecipes: [],
      treats: [{ id: "demo-treat-1", name: "Bakery muffin", kcal: 320 }],
      pantry: [],
      extras: [],
      routines: routine ? [routine] : [],
      sessions: [],
      peptides: [
        { id: "demo-pep-1", name: "Weekly peptide", color: "#52695A", amount: "My usual pen", unit: "",
          schedule: { type: "days", days: [1] }, time: "08:00",
          log: [{ dateKey: mpKey(addDays(monday, -7)), amount: "My usual pen" }, { dateKey: mpKey(monday), amount: "My usual pen" }] },
        { id: "demo-pep-2", name: "Evening peptide", color: "#AC9278", amount: "A small squeeze", unit: "",
          schedule: { type: "every", every: 3, start: addDays(today, -6) }, time: "21:00",
          log: [{ dateKey: mpKey(addDays(today, -3)), amount: "A small squeeze" }] }
      ],
      disclaimer: { agreedAt: new Date().toISOString(), version: picks.disclaimerVersion || 1 },
      habits: [
        { id: "demo-habit-1", name: "Morning walk", color: "#7A8B6F", days: habitDays },
        { id: "demo-habit-2", name: "Water before coffee", color: "#C08552", days: {} }
      ],
      todos: [
        { id: "demo-todo-1", title: "Book the physio", status: "done", time: null, date: addDays(today, -1), category: "health", durationMin: 15 },
        { id: "demo-todo-2", title: "Try the new leg routine", status: "open", time: "18:00", date: today, category: "health", durationMin: 30 },
        { id: "demo-todo-3", title: "Plan Saturday market run", status: "open", time: null, date: addDays(today, 2), category: "home", durationMin: 25 }
      ],
      settings: { notifications: false },
      demoUnlock: null
    };
  }
  var api = { buildDemoState: buildDemoState };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitDemo = api;
})(typeof window !== "undefined" ? window : globalThis);
