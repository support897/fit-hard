"use strict";
/* Fit Hard health log logic (Phase 6). RECORD-KEEPING ONLY.
   This module never computes, suggests, adjusts or corrects an amount, a schedule, a product, a route
   or a missed-dose action. It validates and stores what the user types and confirms, keeps a change
   audit, and builds privacy-safe notification text. */
(function (root) {
  var STATUSES = ["taken", "not_taken", "unknown"];
  var AUDIT_MAX = 100;
  function clean(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n); }
  function isKey(k) { return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k); }
  function isTime(t) { return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
  function statusOf(lg) { return lg && STATUSES.indexOf(lg.status) !== -1 ? lg.status : "taken"; }
  /* Medication record as typed by the user. Nothing is defaulted, guessed or range-checked for "safety":
     the app has no opinion about amounts. Only format and length are validated. */
  function validateMedication(f) {
    var e = {};
    if (!clean(f.name, 80)) e.name = "required";
    if (!clean(f.amount, 40)) e.amount = "required";
    if (f.time != null && f.time !== "" && !isTime(f.time)) e.time = "format";
    if (!f.confirmed) e.confirmed = "required";
    if (f.instructions && String(f.instructions).length > 500) e.instructions = "long";
    return { ok: Object.keys(e).length === 0, errors: e };
  }
  function scheduleKey(sc) { return sc ? JSON.stringify({ d: (sc.days || []).slice().sort(), i: sc.intervalDays || null, s: sc.startKey || null }) : ""; }
  var FIELDS = ["name", "amount", "unit", "time", "instructions", "prescriber"];
  function diff(before, after) {
    var ch = {};
    FIELDS.forEach(function (k) { var a = before[k] == null ? "" : String(before[k]), b = after[k] == null ? "" : String(after[k]); if (a !== b) ch[k] = [a, b]; });
    if (scheduleKey(before.schedule) !== scheduleKey(after.schedule)) ch.schedule = [scheduleKey(before.schedule), scheduleKey(after.schedule)];
    return ch;
  }
  /* Append-only audit of changes to a medication record. */
  function appendAudit(p, action, changes, nowIso) {
    p.audit = Array.isArray(p.audit) ? p.audit : [];
    p.audit.push({ at: nowIso, action: action, changes: changes || {} });
    if (p.audit.length > AUDIT_MAX) p.audit = p.audit.slice(-AUDIT_MAX);
    return p;
  }
  function addLog(p, entry) {
    if (STATUSES.indexOf(entry.status) === -1) return { ok: false, error: "status" };
    if (!isKey(entry.dateKey)) return { ok: false, error: "date" };
    var rec = { dateKey: entry.dateKey, time: isTime(entry.time) ? entry.time : null, status: entry.status,
      amount: entry.status === "taken" ? clean(entry.amount != null ? entry.amount : p.amount, 40) : "", unit: p.unit };
    p.log = Array.isArray(p.log) ? p.log : []; p.log.push(rec); return { ok: true, entry: rec };
  }
  function dayStatus(p, key) {
    var xs = (p.log || []).filter(function (l) { return l.dateKey === key; }); if (!xs.length) return "none";
    if (xs.some(function (l) { return statusOf(l) === "taken"; })) return "taken";
    return statusOf(xs[xs.length - 1]);
  }
  /* Privacy-safe lock-screen text. Names and details only when the user opts in. */
  function notificationContent(kind, name, showDetails) {
    var sensitive = kind === "dose" || kind === "appt";
    if (sensitive && !showDetails) return { title: "Fit Hard", body: "You have a reminder." };
    return null;
  }
  function validateAppointment(a) {
    var e = {};
    if (!clean(a.title, 80)) e.title = "required";
    if (!isKey(a.date)) e.date = "format";
    if (!isTime(a.time)) e.time = "format";
    return { ok: Object.keys(e).length === 0, errors: e };
  }
  /* Copy lint: wording that would amount to advice. Used by the test-suite over every health string. */
  var ADVICE = [
    /\byou should (take|use|inject|increase|decrease|reduce|skip|double|start|stop|try)\b/i,
    /\b(recommended|suggested|typical|usual|safe|ideal|optimal|standard|starting|maximum|minimum) (dose|dosage|amount|cycle|protocol|schedule)\b/i,
    /\b(take|taking) (it|one|two|a|your) (now|later|anyway|twice|double)\b/i,
    /\b(make up|catch up on|double up) (a |the |your )?(dose|doses)\b/i,
    /\bif you (miss|missed|forget|forgot)\b.*\b(take|dose|inject)\b/i,
    /\b(titrat|reconstitut|stack(ing)? with|cycling? (on|off)|inject(ion|ing)? (site|into))\w*/i,
    /\b(buy|order|source|purchase) (from|your|it)\b/i,
    /\b(diagnos(e|is|ed)|prescribe[sd]?|cures?)\b/i
  ];
  function adviceViolations(text) { var out = []; ADVICE.forEach(function (re) { var m = String(text || "").match(re); if (m) out.push(m[0]); }); return out; }
  function exportHealth(state, nowIso) {
    return { app: "Fit Hard", kind: "health-export", version: 1, exportedAt: nowIso, note: "Your own records exactly as you entered them. Fit Hard does not interpret them.",
      disclaimer: state.disclaimer || null, medications: (state.peptides || []).map(function (p) { return { name: p.name, amount: p.amount, unit: p.unit, time: p.time || null, schedule: p.schedule || null, instructions: p.instructions || "", prescriber: p.prescriber || "", confirmedAt: p.confirmedAt || null, log: (p.log || []).map(function (l) { return { date: l.dateKey, time: l.time || null, status: statusOf(l), amount: l.amount || "", unit: l.unit || "" }; }), audit: p.audit || [] }; }),
      appointments: state.appointments || [] };
  }
  var api = { STATUSES: STATUSES, statusOf: statusOf, validateMedication: validateMedication, diff: diff, appendAudit: appendAudit, addLog: addLog, dayStatus: dayStatus, notificationContent: notificationContent,
    validateAppointment: validateAppointment, adviceViolations: adviceViolations, exportHealth: exportHealth, clean: clean };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitHealth = api;
})(typeof window !== "undefined" ? window : globalThis);
