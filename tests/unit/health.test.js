const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const H = require("../../app/health-logic.js"), L = require("../../app/logic.js"), E = require("../../app/events-logic.js");
test("medication needs name, amount and clinician confirmation; no range opinions", () => {
  assert.equal(H.validateMedication({ name: "", amount: "", confirmed: false }).ok, false);
  const v = H.validateMedication({ name: "X", amount: "99999", time: "09:00", confirmed: true }); assert.equal(v.ok, true);
  assert.equal(H.validateMedication({ name: "X", amount: "1", confirmed: false }).errors.confirmed, "required");
  assert.equal(H.validateMedication({ name: "X", amount: "1", time: "25:00", confirmed: true }).errors.time, "format");
});
test("statuses: taken / not_taken / unknown; legacy logs count as taken; bad status refused", () => {
  assert.deepEqual(H.STATUSES, ["taken", "not_taken", "unknown"]);
  assert.equal(H.statusOf({ dateKey: "2026-01-01" }), "taken"); assert.equal(H.statusOf({ status: "weird" }), "taken");
  const p = { amount: "5", unit: "mg", log: [] };
  assert.equal(H.addLog(p, { dateKey: "2026-01-01", status: "maybe" }).ok, false);
  assert.equal(H.addLog(p, { dateKey: "bad", status: "taken" }).ok, false);
  H.addLog(p, { dateKey: "2026-01-01", status: "not_taken" }); assert.equal(p.log[0].amount, "");
  H.addLog(p, { dateKey: "2026-01-02", status: "taken" }); assert.equal(p.log[1].amount, "5");
  assert.equal(H.dayStatus(p, "2026-01-01"), "not_taken"); assert.equal(H.dayStatus(p, "2026-01-03"), "none");
  H.addLog(p, { dateKey: "2026-01-01", status: "taken" }); assert.equal(H.dayStatus(p, "2026-01-01"), "taken");
});
test("audit: diff finds only real changes; append-only and capped", () => {
  const a = { name: "A", amount: "1", unit: "mg", time: "09:00", schedule: { days: [1, 3] } }, b = Object.assign({}, a, { amount: "2", schedule: { days: [3, 1] } });
  assert.deepEqual(Object.keys(H.diff(a, b)), ["amount"]);
  const p = {}; for (let i = 0; i < 130; i++) H.appendAudit(p, "edited", { n: [i, i + 1] }, "2026-01-01T00:00:00Z");
  assert.equal(p.audit.length, 100);
});
test("lock-screen text is generic by default for doses and appointments, never leaks the name", () => {
  for (const k of ["dose", "appt"]) { const g = H.notificationContent(k, "Secret", false); assert.equal(g.title, "Fit Hard"); assert.ok(!JSON.stringify(g).includes("Secret")); assert.equal(H.notificationContent(k, "Secret", true), null); }
  assert.equal(H.notificationContent("gym", "Legs", false), null);
});
test("repairState keeps and validates new health fields; merge unions appointments", () => {
  const s = L.repairState({ peptides: [{ id: "p", name: "N", amount: "1", unit: "mg", log: [{ dateKey: "2026-01-01" }, { dateKey: "junk" }, { dateKey: "2026-01-02", status: "zzz" }], instructions: 5, audit: [{ at: "x", action: "a" }, 7] }],
    appointments: [{ id: "a1", title: " Dr ", date: "2026-03-01", time: "10:00", remindMin: 60 }, { title: "", date: "2026-03-01" }, { title: "x", date: "bad" }] });
  assert.equal(s.peptides[0].log.length, 2); assert.equal(s.peptides[0].log[0].status, "taken"); assert.equal(s.peptides[0].log[1].status, "taken");
  assert.equal(s.peptides[0].instructions, ""); assert.equal(s.peptides[0].audit.length, 1);
  assert.equal(s.appointments.length, 1); assert.equal(s.appointments[0].title, "Dr");
  const m = L.mergeStates({ appointments: [{ id: "a1", title: "A", date: "2026-03-01" }] }, { appointments: [{ id: "a2", title: "B", date: "2026-03-02" }] });
  assert.equal(m.appointments.length, 2);
});
test("appointment reminders: opt-in only, lead time applied, past skipped", () => {
  const now = Date.parse("2026-03-01T08:00:00Z");
  const st = { appointments: [{ id: "a", title: "Dr", date: "2026-03-05", time: "10:00", remindMin: 60 }, { id: "b", title: "No", date: "2026-03-05", time: "10:00", remindMin: null }, { id: "c", title: "Past", date: "2026-02-01", time: "10:00", remindMin: 0 }] };
  const r = E.plan(st, now, "2026-03-01").filter(x => x.kind === "appt");
  assert.equal(r.length, 1); assert.equal(r[0].ref, "a"); assert.equal(r[0].lead, 60);
});
test("validateAppointment", () => { assert.equal(H.validateAppointment({ title: "x", date: "2026-01-01", time: "10:00" }).ok, true); assert.equal(H.validateAppointment({ title: "", date: "2026-01-01", time: "10:00" }).ok, false); assert.equal(H.validateAppointment({ title: "x", date: "2026-01-01", time: "" }).ok, false); });
test("export holds exactly the user's own data and statuses", () => {
  const x = H.exportHealth({ peptides: [{ name: "N", amount: "1", unit: "mg", log: [{ dateKey: "2026-01-01" }] }], appointments: [] }, "2026-01-02T00:00:00Z");
  assert.equal(x.kind, "health-export"); assert.equal(x.medications[0].log[0].status, "taken");
});
test("copy lint: the detector flags advice and no health-area string trips it", () => {
  assert.ok(H.adviceViolations("You should take it with food").length); assert.ok(H.adviceViolations("a typical dose is").length);
  assert.ok(H.adviceViolations("If you miss a dose, take it later").length); assert.ok(H.adviceViolations("reconstitute with water").length);
  assert.equal(H.adviceViolations("I confirm this is what my clinician told me.").length, 0);
  const src = fs.readFileSync(path.join(__dirname, "../../app/i18n.js"), "utf8");
  const bad = []; const re = /"((?:pep|legal|rem)\.[A-Za-z0-9_.]+)":\s*"((?:[^"\\]|\\.)*)"/g; let m, n = 0;
  while ((m = re.exec(src))) { n++; const v = H.adviceViolations(m[2]); if (v.length) bad.push(m[1] + ": " + v); }
  const app = fs.readFileSync(path.join(__dirname, "../../app/app.js"), "utf8");
  const re2 = /tr\("(?:pep|rem)\.[A-Za-z0-9_.]+",\s*null,\s*"((?:[^"\\]|\\.)*)"/g; while ((m = re2.exec(app))) { n++; const v = H.adviceViolations(m[1]); if (v.length) bad.push(m[1] + ": " + v); }
  assert.ok(n > 50, "scanned " + n); assert.deepEqual(bad, []);
});
test("security: no private keys or third-party analytics in the shipped bundle", () => {
  const dir = path.join(__dirname, "../../app"); const files = fs.readdirSync(dir).filter(f => /\.(js|html|json)$/.test(f));
  for (const f of files) { const t = fs.readFileSync(path.join(dir, f), "utf8");
    assert.ok(!/BEGIN (RSA |EC )?PRIVATE KEY|sk_live_|"private_key"|AKIA[0-9A-Z]{16}|client_secret/.test(t), "secret pattern in " + f);
    if (f !== "accounts-config.js") assert.ok(!/AIza[0-9A-Za-z_-]{30,}/.test(t), "api key outside config in " + f);
    assert.ok(!/google-analytics|googletagmanager|segment\.(com|io)|mixpanel|amplitude|hotjar|facebook\.net|sentry\.io|fullstory/.test(t), "analytics host in " + f); }
});
