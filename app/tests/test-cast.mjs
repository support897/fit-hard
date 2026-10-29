/* Fit Hard — the standing TEST-USER cast (Security TEST-PLAN,
   spec issued 14 Oct 2026; Ilse's order via HQ).
   Identities: TU-A / TU-B / TU-C, emails on example.com
   (sec-fithard-a@example.com pattern), display names
   "Test User A/B/C". TU-A = content-rich (the victim in
   attack cases), TU-B = second user / attacker (sparse,
   marked), TU-C = personalisation contrast.
   Residency (Fit pattern, live-only project): the cast is
   MINTED PER RUN on fit-app-7f25f and deleted at the end of
   the run; run sheets state the mode. Credentials are made
   through the app's own doors by the desk running the run
   and never live in this repo.
   Every seed is synthetic and marked as test content in the
   seed itself (names + TEST SEED markers). Nothing here is
   a real person or real data. */
export const CAST_EMAILS = {
  A: "sec-fithard-a@example.com",
  B: "sec-fithard-b@example.com",
  C: "sec-fithard-c@example.com"
};

export function makeCast(todayKey) {
  const A = {
    profile: { name: "Test User A", weightKg: 82, heightCm: 168, age: 34, formulaSex: "female",
      activity: "some", deficit: "gentle", goals: ["Lose weight gently"],
      preferences: ["Italian"], allergies: ["peanut"],
      needs: ["meals", "gym", "peptides", "calendar"], setupDone: true },
    checkins: { [todayKey]: "rough" },
    plan: {}, customRecipes: [], treats: [{ name: "TEST SEED treat", kcal: 200 }],
    pantry: [], extras: [],
    routines: [], sessions: [],
    peptides: [
      { id: "tu-a-pep-1", name: "TEST SEED peptide one", color: "#52695A", amount: "My usual pen", unit: "", schedule: { type: "days", days: [1] }, time: "08:00", log: [{ dateKey: todayKey, note: "TEST SEED" }] },
      { id: "tu-a-pep-2", name: "TEST SEED peptide two", color: "#AC9278", amount: "A small squeeze", unit: "", schedule: { type: "every", n: 3, from: todayKey }, time: "21:00", log: [] }
    ],
    disclaimer: { agreedAt: "2026-10-14T00:00:00.000Z", version: 1 },
    habits: [
      { id: "tu-a-habit-1", name: "TEST SEED morning walk", color: "#7A8B6F", days: { [todayKey]: true } },
      { id: "tu-a-habit-2", name: "Water before coffee", color: "#C08552", days: {} }
    ],
    todos: [
      { id: "tu-a-t1", title: "TEST SEED timed task", status: "open", time: "18:00", dayKey: todayKey },
      { id: "tu-a-t2", title: "Untimed one", status: "open", time: null, dayKey: todayKey },
      { id: "tu-a-t3", title: "Untimed two", status: "open", time: null, dayKey: todayKey },
      { id: "tu-a-t4", title: "Untimed three", status: "open", time: null, dayKey: todayKey },
      { id: "tu-a-t5", title: "Finished one", status: "done", time: null, dayKey: todayKey }
    ],
    settings: { companionName: "Biscuit",
      appearance: { mode: "black", image: "data:image/jpeg;base64,TESTSEEDA" },
      wally: { plan: true } },
    demoUnlock: null
  };
  const B = {
    profile: { name: "Test User B", weightKg: null, heightCm: null, age: null, formulaSex: null,
      activity: "some", deficit: "gentle", goals: [], preferences: [], allergies: [],
      needs: ["calendar"], setupDone: true },
    checkins: {}, plan: {}, customRecipes: [], treats: [], pantry: [], extras: [],
    routines: [], sessions: [], peptides: [], disclaimer: null,
    habits: [],
    todos: [{ id: "tu-b-t1", title: "TEST SEED marker B", status: "open", time: null, dayKey: todayKey }],
    settings: { companionName: "Mabel", appearance: { mode: "white", image: null } },
    demoUnlock: null
  };
  const C = {
    profile: { name: "Test User C", weightKg: 70, heightCm: 175, age: 41, formulaSex: "male",
      activity: "lots", deficit: "steady", goals: ["Build strength"],
      preferences: [], allergies: [], needs: ["gym", "calendar"], setupDone: true },
    checkins: { [todayKey]: "good" },
    plan: {}, customRecipes: [], treats: [], pantry: [], extras: [],
    routines: [], sessions: [], peptides: [], disclaimer: null,
    habits: [{ id: "tu-c-habit-1", name: "TEST SEED stretching", color: "#52695A", days: { [todayKey]: true } }],
    todos: [
      { id: "tu-c-t1", title: "TEST SEED contrast one", status: "open", time: null, dayKey: todayKey },
      { id: "tu-c-t2", title: "Contrast two", status: "open", time: null, dayKey: todayKey },
      { id: "tu-c-t3", title: "Contrast three", status: "open", time: null, dayKey: todayKey }
    ],
    settings: { companionName: "Noodle", wallyOff: true,
      appearance: { mode: "image", image: "data:image/png;base64,TESTSEEDC" } },
    demoUnlock: null
  };
  return { A, B, C };
}
