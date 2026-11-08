"use strict";
/* Fit Hard training logic (Phase 3). Pure functions, no DOM.
   Rules: never prescribes a load. Overload notes only restate what the user logged and
   offer an optional, user-judged next step (one more rep). Time maths uses absolute
   timestamps so a reload, sleep or background tab cannot corrupt a timer. */
(function (root) {
  var MAX_KG = 500, STALE_MS = 6 * 3600 * 1000;
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function parseWeight(v) {
    if (v == null) return null; var s = String(v).trim().replace(",", "."); if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var n = parseFloat(s); return n > 0 && n <= MAX_KG ? n : null;
  }
  function parseReps(v) { var n = Math.floor(Number(v)); return isFinite(n) && n >= 0 && n <= 999 ? n : null; }
  function ensure(s) {
    if (!Array.isArray(s.log)) s.log = [];
    if (num(s.pausedTotalMs) == null) s.pausedTotalMs = 0;
    if (s.pausedAt !== null && num(s.pausedAt) == null) s.pausedAt = null;
    if (s.restEndsAt !== null && num(s.restEndsAt) == null) s.restEndsAt = null;
    return s;
  }
  /* Idempotent: same exercise + set number replaces, so a double tap never double counts. */
  function logSet(s, e, now) {
    ensure(s);
    var reps = parseReps(e.reps); if (reps == null) return { ok: false, error: "reps" };
    var w = e.weightKg == null || e.weightKg === "" ? null : parseWeight(e.weightKg);
    if (e.weightKg != null && e.weightKg !== "" && w == null) return { ok: false, error: "weight" };
    var entry = { exerciseId: e.exerciseId, setNo: e.setNo, reps: reps, weightKg: w, at: now };
    var i = -1; s.log.forEach(function (x, k) { if (x.exerciseId === entry.exerciseId && x.setNo === entry.setNo) i = k; });
    if (i >= 0) s.log[i] = entry; else s.log.push(entry);
    s.lastActiveAt = now; return { ok: true, entry: entry };
  }
  function pause(s, now) { ensure(s); if (s.pausedAt == null) { s.pausedAt = now; s.lastActiveAt = now; } return s; }
  function resume(s, now) {
    ensure(s);
    if (s.pausedAt != null) {
      var d = Math.max(0, now - s.pausedAt); s.pausedTotalMs += d;
      if (s.restEndsAt != null) s.restEndsAt += d;
      s.pausedAt = null; s.lastActiveAt = now;
    }
    return s;
  }
  function elapsedMs(s, now) {
    ensure(s); var end = s.pausedAt != null ? s.pausedAt : now;
    return Math.max(0, end - (s.startedAt || end) - s.pausedTotalMs);
  }
  function startRest(s, sec, now) { ensure(s); s.restEndsAt = now + Math.max(0, sec) * 1000; s.lastActiveAt = now; return s; }
  function restLeftSec(s, now) {
    ensure(s); if (s.restEndsAt == null) return 0;
    var ref = s.pausedAt != null ? s.pausedAt : now;
    return Math.max(0, Math.ceil((s.restEndsAt - ref) / 1000));
  }
  function clearRest(s) { s.restEndsAt = null; return s; }
  /* Recovery rule: an active session untouched for 6h+ is "stale"; the app asks, never auto-deletes. */
  function recoveryState(s, now) {
    ensure(s); if (!s || s.status !== "active") return "none";
    var last = s.lastActiveAt || s.startedAt || now;
    return now - last >= STALE_MS ? "stale" : "resume";
  }
  function lastPerformance(sessions, exerciseId, excludeId) {
    var best = null;
    (sessions || []).forEach(function (ss) {
      if (ss.id === excludeId || ss.status === "discarded" || !Array.isArray(ss.log)) return;
      var sets = ss.log.filter(function (x) { return x.exerciseId === exerciseId; });
      if (!sets.length) return;
      var t = Math.max.apply(null, sets.map(function (x) { return x.at || 0; }));
      if (!best || t > best.at) best = { at: t, dateKey: ss.dateKey, sets: sets.slice().sort(function (a, b) { return a.setNo - b.setNo; }) };
    });
    return best;
  }
  /* Progressive overload as information only. */
  function overloadNote(last, targetReps) {
    if (!last || !last.sets.length) return { kind: "none" };
    var reps = last.sets.map(function (x) { return x.reps; }), top = Math.max.apply(null, reps);
    var ws = last.sets.map(function (x) { return x.weightKg; }).filter(function (x) { return x != null; });
    var w = ws.length ? Math.max.apply(null, ws) : null;
    var metTarget = targetReps > 0 && reps.every(function (r) { return r >= targetReps; });
    return { kind: metTarget ? "reachedTarget" : "repeat", topReps: top, weightKg: w, sets: last.sets.length, targetReps: targetReps };
  }
  function volumeKg(s) { return Math.round((s.log || []).reduce(function (a, x) { return a + (x.weightKg ? x.weightKg * x.reps : 0); }, 0)); }
  function history(sessions) {
    return (sessions || []).filter(function (x) { return x.status === "done"; }).slice().sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); })
      .map(function (x) { return { id: x.id, dateKey: x.dateKey, name: x.routineName, minutes: x.minutes || 0, sets: (x.log || []).length || x.doneSets || 0, volumeKg: volumeKg(x), logged: Array.isArray(x.log) && x.log.length > 0 }; });
  }
  function filterExercises(list, f) {
    var q = (f.q || "").toLowerCase().trim();
    return list.filter(function (e) {
      if (f.kind && f.kind !== "all" && (e.category || "strength") !== f.kind) return false;
      if (f.part && f.part !== "all" && e.partLabel !== f.part) return false;
      if (f.equipment && f.equipment !== "all" && e.equipment !== f.equipment) return false;
      if (q) { var n = f.nameOf ? f.nameOf(e) : e.name; if (String(e.name).toLowerCase().indexOf(q) === -1 && String(n).toLowerCase().indexOf(q) === -1) return false; }
      return true;
    });
  }
  function facets(list) {
    var p = {}, q = {}; list.forEach(function (e) { p[e.partLabel] = 1; q[e.equipment] = 1; });
    return { parts: Object.keys(p).sort(), equipment: Object.keys(q).sort() };
  }
  var api = { parseWeight: parseWeight, parseReps: parseReps, ensure: ensure, logSet: logSet, pause: pause, resume: resume, elapsedMs: elapsedMs, startRest: startRest,
    restLeftSec: restLeftSec, clearRest: clearRest, recoveryState: recoveryState, lastPerformance: lastPerformance, overloadNote: overloadNote, volumeKg: volumeKg,
    history: history, filterExercises: filterExercises, facets: facets, STALE_MS: STALE_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitTrain = api;
})(typeof window !== "undefined" ? window : globalThis);
