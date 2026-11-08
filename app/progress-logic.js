"use strict";
/* Fit Hard progress logic (Phase 5). Pure, no DOM.
   Principles encoded here: nothing derived can go backwards (totals only grow), a missed week is
   never reported as a loss, rest counts, body numbers are neutral (no good/bad direction), and
   every personal best is the user's own earlier self, never a target we set. */
(function (root) {
  var L = root.FitLogic || (typeof require !== "undefined" ? (function () { try { return require("./logic.js"); } catch (e) { return null; } })() : null);
  var RANGE = { weightKg: [20, 400], waistCm: [30, 250], hipCm: [30, 250], chestCm: [30, 250], armCm: [10, 120], thighCm: [20, 150] };
  var METRICS = Object.keys(RANGE);
  function parseMeasure(metric, v) {
    if (!RANGE[metric] || v == null) return null; var s = String(v).trim().replace(",", "."); if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null; var n = parseFloat(s);
    return n >= RANGE[metric][0] && n <= RANGE[metric][1] ? n : null;
  }
  function weekStart(key) { var d = L.parseKey(key); var off = (d.getDay() + 6) % 7; return L.addDays(key, -off); }
  function sessionsDone(st) { return (st.sessions || []).filter(function (s) { return s.status === "done" && s.dateKey; }); }
  function movementDays(st) {
    var m = {};
    sessionsDone(st).forEach(function (s) { m[s.dateKey] = true; });
    (st.habits || []).forEach(function (h) { Object.keys(h.days || {}).forEach(function (k) { if (h.days[k]) m[k] = true; }); });
    return m;
  }
  function plannedPerWeek(st) {
    var n = 0; (st.routines || []).forEach(function (r) { if (Array.isArray(r.days)) n += new Set(r.days).size; }); return n;
  }
  function weekSummary(st, wk) {
    var end = L.addDays(wk, 6), mv = movementDays(st), rest = st.restDays || {};
    var sessions = sessionsDone(st).filter(function (s) { return s.dateKey >= wk && s.dateKey <= end; }).length;
    var moveDays = 0, restDays = 0;
    for (var i = 0; i < 7; i++) { var k = L.addDays(wk, i); if (mv[k]) moveDays++; if (rest[k]) restDays++; }
    return { weekStart: wk, sessions: sessions, moveDays: moveDays, restDays: restDays, counted: moveDays + restDays > 0, planned: plannedPerWeek(st) };
  }
  function weeks(st, today, n) {
    var cur = weekStart(today), out = [];
    for (var i = n - 1; i >= 0; i--) out.push(weekSummary(st, L.addDays(cur, -7 * i)));
    return out;
  }
  /* Flexible streak. The run counts consecutive counted weeks; the in-progress week never
     breaks it. A gap simply ends the *current run*; totals and best run are kept forever. */
  function flexibleStreak(st, today) {
    var all = {}; var mv = movementDays(st), rest = st.restDays || {};
    Object.keys(mv).concat(Object.keys(rest)).forEach(function (k) { all[weekStart(k)] = true; });
    var starts = Object.keys(all).sort(); var cur = weekStart(today);
    var best = 0, run = 0, prev = null;
    starts.forEach(function (w) { run = (prev && L.addDays(prev, 7) === w) ? run + 1 : 1; if (run > best) best = run; prev = w; });
    var current = 0, w = all[cur] ? cur : L.addDays(cur, -7);
    while (all[w]) { current++; w = L.addDays(w, -7); }
    var returned = !all[L.addDays(cur, -7)] && !!all[cur] && starts.length > 1;
    return { activeWeeks: starts.length, currentRun: current, bestRun: Math.max(best, current), returned: returned };
  }
  function chronologicalSets(st) {
    var out = [];
    (st.sessions || []).filter(function (s) { return s.status === "done" && Array.isArray(s.log); }).slice().sort(function (a, b) { return (a.startedAt || 0) - (b.startedAt || 0); })
      .forEach(function (s) { s.log.forEach(function (x) { out.push({ exerciseId: x.exerciseId, reps: x.reps, weightKg: x.weightKg, dateKey: s.dateKey, sid: s.id }); }); });
    return out;
  }
  /* A set beats the user's previous best when it has more weight, or the same weight with more reps,
     or (for unweighted sets) more reps. Compared only against the user's own earlier sets. */
  function beats(x, b) {
    if (!b) return true;
    var xw = x.weightKg || 0, bw = b.weightKg || 0;
    if (xw !== bw) return xw > bw;
    return x.reps > b.reps;
  }
  function personalBests(st) {
    var best = {}, events = [];
    chronologicalSets(st).forEach(function (x) {
      if (!(x.reps > 0)) return;
      var b = best[x.exerciseId];
      if (beats(x, b)) { if (b) events.push({ exerciseId: x.exerciseId, dateKey: x.dateKey, reps: x.reps, weightKg: x.weightKg, prevReps: b.reps, prevWeightKg: b.weightKg }); best[x.exerciseId] = x; }
    });
    return { best: best, events: events };
  }
  function recentBests(st, today, days) { var from = L.addDays(today, -(days || 21)); return personalBests(st).events.filter(function (e) { return e.dateKey >= from; }); }
  function strengthSeries(st, exId) {
    var by = {}, order = [];
    chronologicalSets(st).filter(function (x) { return x.exerciseId === exId && x.reps > 0; }).forEach(function (x) {
      if (!by[x.sid]) { by[x.sid] = { dateKey: x.dateKey, top: x }; order.push(x.sid); } else if (beats(x, by[x.sid].top)) by[x.sid].top = x;
    });
    return order.map(function (id) { return { dateKey: by[id].dateKey, reps: by[id].top.reps, weightKg: by[id].top.weightKg }; });
  }
  function loggedExercises(st) {
    var c = {}; chronologicalSets(st).forEach(function (x) { c[x.exerciseId] = (c[x.exerciseId] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || (a < b ? -1 : 1); });
  }
  var MILESTONES = [
    { id: "first_session", test: function (m) { return m.sessions >= 1; } },
    { id: "first_log", test: function (m) { return m.sets >= 1; } },
    { id: "sessions_5", test: function (m) { return m.sessions >= 5; } },
    { id: "sessions_10", test: function (m) { return m.sessions >= 10; } },
    { id: "sessions_25", test: function (m) { return m.sessions >= 25; } },
    { id: "sessions_50", test: function (m) { return m.sessions >= 50; } },
    { id: "first_pb", test: function (m) { return m.pbs >= 1; } },
    { id: "weeks_4", test: function (m) { return m.activeWeeks >= 4; } },
    { id: "weeks_12", test: function (m) { return m.activeWeeks >= 12; } },
    { id: "first_plan", test: function (m) { return m.plannedDays >= 7; } },
    { id: "first_rest", test: function (m) { return m.restDays >= 1; } }
  ];
  function milestones(st, today) {
    var m = { sessions: sessionsDone(st).length, sets: chronologicalSets(st).length, pbs: personalBests(st).events.length,
      activeWeeks: flexibleStreak(st, today).activeWeeks, plannedDays: Object.keys(st.plan || {}).filter(function (k) { return Object.keys(st.plan[k] || {}).length; }).length,
      restDays: Object.keys(st.restDays || {}).length };
    var earned = [], next = null;
    MILESTONES.forEach(function (x) { if (x.test(m)) earned.push(x.id); else if (!next) next = x.id; });
    return { earned: earned, next: next, counts: m };
  }
  function bodySeries(entries, metric) {
    return (entries || []).filter(function (e) { return typeof e[metric] === "number"; }).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .map(function (e) { return { date: e.date, value: e[metric] }; });
  }
  function bodySummary(entries, metric) {
    var s = bodySeries(entries, metric); if (!s.length) return null;
    var first = s[0], last = s[s.length - 1];
    return { count: s.length, first: first, last: last, change: Math.round((last.value - first.value) * 10) / 10 };
  }
  function weeklyReview(st, today) {
    var cur = weekStart(today), a = weekSummary(st, cur), b = weekSummary(st, L.addDays(cur, -7));
    var step;
    if (!(st.routines || []).length) step = "build_routine";
    else if (!a.sessions && !a.restDays) step = "one_small";
    else if (a.planned && a.sessions < a.planned) step = "next_session";
    else step = "enjoy";
    return { thisWeek: a, lastWeek: b, step: step, week: cur };
  }
  function cleanText(s) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300); }
  function exportData(st, nowIso) {
    return { app: "Fit Hard", kind: "progress-export", version: 1, exportedAt: nowIso, note: "Progress photos stay on your device and are not part of this file.",
      body: st.body || [], restDays: Object.keys(st.restDays || {}).sort(), reflections: st.reflections || {},
      sessions: sessionsDone(st).map(function (s) { return { id: s.id, date: s.dateKey, routine: s.routineName, minutes: s.minutes, sets: s.log || [] }; }) };
  }
  function toCsv(st) {
    var rows = [["type", "date", "name", "reps", "weightKg", "value"]];
    function q(v) { v = v == null ? "" : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    (st.body || []).forEach(function (e) { METRICS.forEach(function (m) { if (typeof e[m] === "number") rows.push(["body", e.date, m, "", "", e[m]]); }); });
    chronologicalSets(st).forEach(function (x) { rows.push(["set", x.dateKey, x.exerciseId, x.reps, x.weightKg, ""]); });
    return rows.map(function (r) { return r.map(q).join(","); }).join("\n");
  }
  var api = { METRICS: METRICS, RANGE: RANGE, parseMeasure: parseMeasure, weekStart: weekStart, weekSummary: weekSummary, weeks: weeks, flexibleStreak: flexibleStreak, personalBests: personalBests,
    recentBests: recentBests, strengthSeries: strengthSeries, loggedExercises: loggedExercises, milestones: milestones, MILESTONES: MILESTONES.map(function (m) { return m.id; }),
    bodySeries: bodySeries, bodySummary: bodySummary, weeklyReview: weeklyReview, cleanText: cleanText, exportData: exportData, toCsv: toCsv, plannedPerWeek: plannedPerWeek };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitProgress = api;
})(typeof window !== "undefined" ? window : globalThis);
