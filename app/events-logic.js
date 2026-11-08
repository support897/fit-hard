"use strict";
/* Fit Hard unified events + reminder reconciliation (Phase 4). Pure, no DOM.
   - Every reminder is source-linked: uid = kind|sourceId|date. Edit or delete the source and
     the next plan simply no longer contains that uid, so reconcile() cancels it. No orphans.
   - reconcile() diffs the previous plan against the next and only cancels/schedules the
     difference, so running it twice does nothing the second time (idempotent) and a
     notification can never be scheduled twice.
   - Times are LOCAL wall-clock moments resolved with resolveLocal(): in a spring-forward gap the
     reminder lands at the first valid moment after the gap and is flagged shifted; in a
     fall-back repeat it fires once, at the first occurrence. */
(function (root) {
  var L = root.FitLogic || (typeof require !== "undefined" ? (function () { try { return require("./logic.js"); } catch (e) { return null; } })() : null);
  var MAX_PENDING = 40;
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0); }
  function validKey(k) { return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k); }
  function validTime(t) { return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
  function resolveLocal(key, time) {
    if (!validKey(key) || !validTime(time)) return null;
    var y = +key.slice(0, 4), mo = +key.slice(5, 7), d = +key.slice(8, 10), h = +time.slice(0, 2), mi = +time.slice(3, 5);
    var dt = new Date(y, mo - 1, d, h, mi, 0, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    var shifted = dt.getHours() !== h || dt.getMinutes() !== mi;
    return { at: dt.getTime(), shifted: shifted };
  }
  function addMinutes(at, m) { return at - m * 60000; }
  function todoReminders(state, fromKey, nowMs) {
    var out = [];
    (state.todos || []).forEach(function (t) {
      if (!t || t.status === "done" || typeof t.remindMin !== "number" || t.remindMin < 0 || t.remindMin > 1440) return;
      var r = resolveLocal(t.date, t.time); if (!r) return;
      var at = addMinutes(r.at, t.remindMin);
      if (at <= nowMs || t.date < fromKey) return;
      out.push({ uid: "todo|" + t.id + "|" + t.date, kind: "todo", ref: t.id, name: t.title, key: t.date, time: t.time, at: at, shifted: r.shifted, lead: t.remindMin });
    });
    return out;
  }
  function apptReminders(state, fromKey, nowMs) {
    var out = [];
    (state.appointments || []).forEach(function (a) {
      if (!a || typeof a.remindMin !== "number" || !a.time) return;
      var r = resolveLocal(a.date, a.time); if (!r) return;
      var at = addMinutes(r.at, a.remindMin);
      if (at <= nowMs || a.date < fromKey) return;
      out.push({ uid: "appt|" + a.id + "|" + a.date, kind: "appt", ref: a.id, name: a.title, key: a.date, time: a.time, at: at, shifted: r.shifted, lead: a.remindMin });
    });
    return out;
  }
  function plan(state, nowMs, fromKey) {
    var base = L.planReminders(state, fromKey, { now: nowMs }).map(function (r) {
      var rl = resolveLocal(r.key, r.time);
      return { uid: r.kind + "|" + r.ref + "|" + r.key, kind: r.kind, ref: r.ref, name: r.name, key: r.key, time: r.time, at: rl ? rl.at : r.at, shifted: rl ? rl.shifted : false, lead: 0 };
    });
    var all = base.concat(todoReminders(state, fromKey, nowMs), apptReminders(state, fromKey, nowMs)), seen = {}, out = [];
    all.sort(function (a, b) { return a.at - b.at || (a.uid < b.uid ? -1 : 1); });
    all.forEach(function (r) { if (!seen[r.uid] && r.at > nowMs) { seen[r.uid] = true; out.push(r); } });
    return out.slice(0, MAX_PENDING);
  }
  /* Stable numeric id per uid, collision-safe within one plan. */
  function assignIds(items) {
    var used = {};
    return items.map(function (r) {
      var id = 1000 + (hash(r.uid) % 2000000000);
      while (used[id]) id++;
      used[id] = true; return Object.assign({}, r, { id: id });
    });
  }
  function fingerprint(n) { return [n.at, n.title, n.body].join("|"); }
  /* prev: { "<id>": fingerprint } (what the device holds). next: [{id,at,title,body}]. */
  function reconcile(prev, next) {
    prev = prev || {};
    var nextMap = {}, cancel = [], schedule = [];
    next.forEach(function (n) { nextMap[n.id] = fingerprint(n); });
    Object.keys(prev).forEach(function (id) { if (nextMap[id] !== prev[id]) cancel.push(Number(id)); });
    next.forEach(function (n) { if (prev[n.id] !== nextMap[n.id]) schedule.push(n); });
    return { cancel: cancel, schedule: schedule, map: nextMap, unchanged: next.length - schedule.length };
  }
  function listUpcoming(state, nowMs, fromKey, limit) { return plan(state, nowMs, fromKey).slice(0, limit || 10); }
  var api = { resolveLocal: resolveLocal, plan: plan, assignIds: assignIds, reconcile: reconcile, fingerprint: fingerprint, listUpcoming: listUpcoming, validTime: validTime, validKey: validKey, MAX_PENDING: MAX_PENDING };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitEvents = api;
})(typeof window !== "undefined" ? window : globalThis);
