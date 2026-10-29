// "Bring my calendar in" — module checks (pure layer, no DOM).
// Run: node tests/import-check.mjs
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const CI = require("../calendar-import.js");
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };
const NOW = new Date("2026-10-14T10:00:00"); // Wednesday 14 Oct 2026
const fx = n => fs.readFileSync(new URL("./fixtures/" + n, import.meta.url), "utf8");

// --- Google: live repeats map, singles land, all-day stays all-day ---
const g = CI.parseICS(fx("google.ics"));
check("google: 4 events parsed", g.events.length === 4);
check("google: calendar name read", g.calendarName === "Work");
const gp = CI.planImport(g, [], { now: NOW, sourceLabel: "google" });
const byUid = {}; gp.add.forEach(s => { byUid[s.importUid] = s; });
check("google: weekly BYDAY=MO -> live 'every week'", byUid["g1@google.com"] && byUid["g1@google.com"].repeat === "every week");
check("google: daily open -> live 'every day'", byUid["g2@google.com"] && byUid["g2@google.com"].repeat === "every day");
check("google: all-day has no time", byUid["g3@google.com"] && byUid["g3@google.com"].time === null && byUid["g3@google.com"].date === "2026-10-20");
check("google: single keeps notes+location", byUid["g4@google.com"] && /referral/.test(byUid["g4@google.com"].notes) && /Smile/.test(byUid["g4@google.com"].location));
check("google: 2 live repeats counted", gp.liveRepeats === 2);

// --- Outlook: fortnightly + monthly must EXPAND, never map live ---
const o = CI.parseICS(fx("outlook.ics"));
const op = CI.planImport(o, [], { now: NOW, sourceLabel: "outlook" });
check("outlook: nothing mapped live", op.liveRepeats === 0 && op.add.every(s => !s.repeat));
const physio = op.add.filter(s => s.importUid === "o1@outlook.com");
check("outlook: fortnightly expanded to many instances", physio.length >= 20);
check("outlook: fortnightly spacing is 14 days", physio.length >= 2 && (new Date(physio[1].date) - new Date(physio[0].date)) === 14 * 864e5);
const rent = op.add.filter(s => s.importUid === "o2@outlook.com");
check("outlook: monthly expanded (12 in window)", rent.length >= 10 && rent.length <= 13);

// --- Apple: VTIMEZONE conversion, UNTIL expands, EXDATE honoured, overrides land ---
const a = CI.parseICS(fx("apple.ics"));
const ap = CI.planImport(a, [], { now: NOW, sourceLabel: "apple" });
const school = ap.add.filter(s => s.importUid === "a1@icloud.com");
check("apple: UNTIL daily expanded, not live", school.length >= 10 && school.every(s => !s.repeat));
check("apple: Sydney morning stays 08:30 local", school.length > 0 && school.every(s => s.time === "08:30"));
const yoga = ap.add.filter(s => s.importUid === "a2@icloud.com");
check("apple: EXDATE instance (21 Oct) absent", !yoga.some(s => s.date === "2026-10-21"));
check("apple: other yoga Wednesdays present", yoga.some(s => s.date === "2026-10-14"));
const club = ap.add.filter(s => s.importUid === "a3@icloud.com");
check("apple: overridden series expands (not live)", club.length > 1 && club.every(s => !s.repeat));
check("apple: the override instance lands at its new time", club.some(s => s.date === "2026-10-20" && s.time === "19:30"));
check("apple: the original 20 Oct 19:00 slot is not doubled", club.filter(s => s.date === "2026-10-20").length === 1);

// --- dedupe: re-import adds nothing ---
const existing = gp.add.map(s => ({ title: s.title, date: s.date, time: s.time, importUid: s.importUid, importKey: s.importKey }));
const gp2 = CI.planImport(g, existing, { now: NOW, sourceLabel: "google" });
check("dedupe: re-import adds 0", gp2.add.length === 0);
check("dedupe: re-import counts the dupes", gp2.dupes === gp.add.length);

// --- broken file: no crash, nothing added ---
let bp = null, crashed = false;
try { bp = CI.planImport(CI.parseICS(fx("broken.ics")), [], { now: NOW }); } catch (e) { crashed = true; }
check("broken: no crash, adds nothing", !crashed && bp && bp.add.length === 0);

// --- apply: registry written, counts honest ---
const state = { tasks: [], imports: [] };
const toTask = s => ({ title: s.title, date: s.date, time: s.time, durationMin: s.durationMin, repeat: s.repeat, importUid: s.importUid, importKey: s.importKey, source: "import" });
const res = CI.applyImport(state, gp, "Google Calendar", toTask);
check("apply: tasks added == plan", state.tasks.length === gp.add.length && res.added === gp.add.length);
check("apply: registry entry recorded with count", state.imports.length === 1 && state.imports[0].count === gp.add.length);



// --- repeatModel: "none" (Meal Prep seam Q1: a repeat-less host must
// never be handed a live repeat it cannot honour — everything expands).
{
  const planNone = CI.planImport(g, [], { now: NOW, sourceLabel: "Google Calendar", repeatModel: "none" });
  check("repeatModel none: nothing maps live", planNone.liveRepeats === 0 && planNone.add.every(s => !s._live && !s.repeat));
  check("repeatModel none: the weekly + daily series expand into many dated instances", planNone.add.length > 40 && planNone.expanded > 40);
  const planDef = CI.planImport(g, [], { now: NOW, sourceLabel: "Google Calendar" });
  check("default unchanged: the same file still live-maps", planDef.liveRepeats === 2 && planDef.add.length === 4);
}

console.log("RESULT pass=" + pass + " fail=" + fail);
process.exit(fail ? 1 : 0);