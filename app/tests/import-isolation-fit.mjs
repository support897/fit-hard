// "Bring my calendar in" — ISOLATION battery, Fit adoption shape.
// The module only ever receives the importing user's own space.
// Fit hands it a shim { tasks: state.todos, imports: state.imports }
// (the same arrays), so this battery drives the module through that
// exact shim over the fleet TU cast: an import into B leaves A and C
// byte-identical, B still receives the full set even when A already
// holds the same calendar, and re-import inside B dedupes to zero.
// Run: TZ=Australia/Sydney node tests/import-isolation-fit.mjs
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const CI = require("../calendar-import.js");
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };
const NOW = new Date("2026-10-14T10:00:00");
const load = (n) => JSON.parse(fs.readFileSync(new URL("./fixtures/users/" + n, import.meta.url), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const ics = fs.readFileSync(new URL("./fixtures/google.ics", import.meta.url), "utf8");
// Fit's space shape over the TU fixtures: their task list is the
// space's to-do list; the registry starts as repairState makes it.
const space = (u) => ({ tasks: u.tasks || [], imports: Array.isArray(u.imports) ? u.imports : [] });
const toTask = (s) => ({ id: "todo.imp." + s.importUid + "." + s.date, title: s.title, date: s.date, time: s.time, durationMin: s.durationMin, status: "open", source: "import", importUid: s.importUid, importKey: s.importKey });

const A = load("tu-a.state.json"), B = load("tu-b.state.json"), C = load("tu-c.state.json");
const aBefore = JSON.stringify(A), cBefore = JSON.stringify(C);
const bSpace = space(B);
const planB = CI.planImport(CI.parseICS(ics), bSpace.tasks, { now: NOW, sourceLabel: "Google Calendar", repeatModel: "none" });
check("NS-2: dedupe never crosses users — B is offered events despite A holding the same calendar", planB.add.length > 0 && planB.dupes === 0);
const resB = CI.applyImport(bSpace, planB, "Google Calendar", toTask);
check("NS-2: B's import lands in B's space only, registry written once", resB.added === planB.add.length && bSpace.imports.length === 1 && bSpace.imports[0].count === resB.added);
check("NS-2: A and C are byte-identical after B's import", JSON.stringify(A) === aBefore && JSON.stringify(C) === cBefore);
const planB2 = CI.planImport(CI.parseICS(ics), bSpace.tasks, { now: NOW, sourceLabel: "Google Calendar", repeatModel: "none" });
const resB2 = CI.applyImport(bSpace, planB2, "Google Calendar", toTask);
check("NS-2: re-import inside B adds nothing and writes no second registry row", resB2.added === 0 && planB2.dupes === planB.add.length && bSpace.imports.length === 1);
const aSpace = space(clone(A));
const planA = CI.planImport(CI.parseICS(ics), aSpace.tasks, { now: NOW, sourceLabel: "Google Calendar", repeatModel: "none" });
check("NS-2: a malformed file writes nothing anywhere", (() => {
  const bad = CI.parseICS(fs.readFileSync(new URL("./fixtures/broken.ics", import.meta.url), "utf8"));
  const before = JSON.stringify(aSpace);
  if (!bad.error && bad.events.length) CI.applyImport(aSpace, CI.planImport(bad, aSpace.tasks, { now: NOW, repeatModel: "none" }), "x", toTask);
  return JSON.stringify(aSpace) === before;
})());
console.log("RESULT pass=" + pass + " fail=" + fail);
process.exit(fail ? 1 : 0);
