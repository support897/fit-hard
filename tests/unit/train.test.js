const test = require('node:test'), assert = require('node:assert'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
global.window = global.window || {};
const T = require(path.join(APP, 'train-logic.js')), L = require(path.join(APP, 'logic.js')), E = require(path.join(APP, 'exercises-node.js'));
const mk = () => ({ id: 's1', status: 'active', startedAt: 1000, items: [], log: [], pausedAt: null, pausedTotalMs: 0, restEndsAt: null });
test('weight and reps validation', () => {
  assert.strictEqual(T.parseWeight('22,5'), 22.5); assert.strictEqual(T.parseWeight(''), null); assert.strictEqual(T.parseWeight('-3'), null);
  assert.strictEqual(T.parseWeight('abc'), null); assert.strictEqual(T.parseWeight('501'), null); assert.strictEqual(T.parseWeight('0'), null);
  assert.strictEqual(T.parseReps('12'), 12); assert.strictEqual(T.parseReps('-1'), null); assert.strictEqual(T.parseReps('x'), null);
});
test('logSet is idempotent per exercise+set and rejects bad input', () => {
  const s = mk(); T.logSet(s, { exerciseId: 'a', setNo: 1, reps: 10, weightKg: '20' }, 5);
  T.logSet(s, { exerciseId: 'a', setNo: 1, reps: 11, weightKg: '20' }, 6); assert.strictEqual(s.log.length, 1); assert.strictEqual(s.log[0].reps, 11);
  T.logSet(s, { exerciseId: 'a', setNo: 2, reps: 9, weightKg: '' }, 7); assert.strictEqual(s.log.length, 2); assert.strictEqual(s.log[1].weightKg, null);
  assert.deepStrictEqual(T.logSet(s, { exerciseId: 'a', setNo: 3, reps: 'z' }, 8), { ok: false, error: 'reps' });
  assert.deepStrictEqual(T.logSet(s, { exerciseId: 'a', setNo: 3, reps: 5, weightKg: 'heavy' }, 8), { ok: false, error: 'weight' });
  assert.strictEqual(s.log.length, 2);
});
test('pause/resume: elapsed excludes paused time; idempotent; rest shifts', () => {
  const s = mk(); T.startRest(s, 60, 11000);
  assert.strictEqual(T.elapsedMs(s, 21000), 20000);
  T.pause(s, 21000); T.pause(s, 25000); assert.strictEqual(s.pausedAt, 21000);
  assert.strictEqual(T.elapsedMs(s, 99000), 20000); assert.strictEqual(T.restLeftSec(s, 99000), 50);
  T.resume(s, 61000); T.resume(s, 70000);
  assert.strictEqual(s.pausedTotalMs, 40000); assert.strictEqual(T.elapsedMs(s, 71000), 30000);
  assert.strictEqual(T.restLeftSec(s, 71000), 40);
});
test('rest timer survives reload (absolute end) and never goes negative', () => {
  const s = mk(); T.startRest(s, 45, 100000); const copy = JSON.parse(JSON.stringify(s));
  assert.strictEqual(T.restLeftSec(copy, 110000), 35); assert.strictEqual(T.restLeftSec(copy, 999999), 0);
});
test('recovery rule: fresh=resume, 6h idle=stale, done=none', () => {
  const s = mk(); s.lastActiveAt = 1000;
  assert.strictEqual(T.recoveryState(s, 1000 + 3600000), 'resume'); assert.strictEqual(T.recoveryState(s, 1000 + T.STALE_MS), 'stale');
  s.status = 'done'; assert.strictEqual(T.recoveryState(s, 1e12), 'none');
});
test('last performance + overload note never prescribes a weight', () => {
  const a = { id: 'o', status: 'done', dateKey: '2026-11-01', log: [{ exerciseId: 'x', setNo: 1, reps: 10, weightKg: 20, at: 1 }, { exerciseId: 'x', setNo: 2, reps: 12, weightKg: 20, at: 2 }] };
  const b = { id: 'n', status: 'done', dateKey: '2026-11-05', log: [{ exerciseId: 'x', setNo: 1, reps: 12, weightKg: 22.5, at: 9 }, { exerciseId: 'x', setNo: 2, reps: 12, weightKg: 22.5, at: 10 }] };
  const lp = T.lastPerformance([a, b], 'x'); assert.strictEqual(lp.dateKey, '2026-11-05');
  assert.strictEqual(T.lastPerformance([a, b], 'x', 'n').dateKey, '2026-11-01'); assert.strictEqual(T.lastPerformance([a, b], 'zz'), null);
  const n = T.overloadNote(lp, 12); assert.strictEqual(n.kind, 'reachedTarget'); assert.strictEqual(n.weightKg, 22.5);
  assert.deepStrictEqual(Object.keys(n).sort(), ['kind', 'sets', 'targetReps', 'topReps', 'weightKg']);
  assert.strictEqual(T.overloadNote(T.lastPerformance([a], 'x'), 12).kind, 'repeat'); assert.strictEqual(T.overloadNote(null, 12).kind, 'none');
});
test('history summary and volume', () => {
  const s = { id: 'h', status: 'done', dateKey: 'd', startedAt: 5, minutes: 30, routineName: 'R', log: [{ reps: 10, weightKg: 20 }, { reps: 5, weightKg: null }] };
  const h = T.history([s, { id: 'a', status: 'active' }]); assert.strictEqual(h.length, 1); assert.strictEqual(h[0].volumeKg, 200); assert.strictEqual(h[0].sets, 2);
});
test('exercise filters: muscle, equipment, kind, text compose; all 871 reachable', () => {
  const X = E.EXERCISES, f = T.facets(X); assert(f.parts.length >= 10 && f.equipment.length >= 20);
  assert.strictEqual(T.filterExercises(X, {}).length, X.length);
  f.parts.forEach(p => assert(T.filterExercises(X, { part: p }).length > 0));
  f.equipment.forEach(q => assert(T.filterExercises(X, { equipment: q }).length > 0));
  const r = T.filterExercises(X, { part: 'Chest', equipment: 'dumbbell', q: 'press' }); assert(r.length > 0); r.forEach(e => { assert.strictEqual(e.partLabel, 'Chest'); assert.strictEqual(e.equipment, 'dumbbell'); });
  assert.strictEqual(T.filterExercises(X, { q: 'zzzzzz' }).length, 0);
});
test('exercise data integrity: ids unique, every exercise has part, equipment, cue', () => {
  const X = E.EXERCISES; assert.strictEqual(new Set(X.map(e => e.id)).size, X.length);
  assert(X.every(e => e.partLabel && e.equipment && typeof e.cue === 'string' && e.cue.length > 10), 'missing cue/part/equipment: ' + X.filter(e => !(e.partLabel && e.equipment && e.cue)).length);
});
test('session log fields survive repair and merge', () => {
  const s = { id: 's9', status: 'active', startedAt: 1, items: [], log: [{ exerciseId: 'a', setNo: 1, reps: 5, weightKg: 10, at: 3 }, { bad: true }, { exerciseId: 'a', setNo: 2, reps: -4, at: 1 }], pausedAt: 'x', pausedTotalMs: -5, restEndsAt: 7 };
  const r = L.repairState({ sessions: [s] }).sessions[0];
  assert.strictEqual(r.log.length, 1); assert.strictEqual(r.pausedAt, null); assert.strictEqual(r.pausedTotalMs, 0); assert.strictEqual(r.restEndsAt, 7);
  const m = L.mergeStates({ sessions: [s] }, { sessions: [Object.assign({}, s, { status: 'done' })] }); assert.strictEqual(m.sessions[0].status, 'done');
});
test('animation frame mapping: every mapped frame file exists, each map has 3 frames, ids belong to real exercises or known variants', () => {
  const fs = require('fs'), A = path.join(APP);
  const s = fs.readFileSync(path.join(A, 'anim.js'), 'utf8');
  const maps = [...s.matchAll(/"([^"]+)":\s*\[((?:"assets\/[^"]+",?\s*){3})\]/g)];
  assert(maps.length >= 300, 'maps ' + maps.length);
  const files = new Set(fs.readdirSync(path.join(A, 'assets')).map(f => 'assets/' + f));
  const missing = []; maps.forEach(([, id, arr]) => arr.match(/assets\/[^"]+/g).forEach(f => { if (!files.has(f)) missing.push(id + ' ' + f); }));
  assert.deepStrictEqual(missing, []);
  const ids = new Set(E.EXERCISES.map(e => e.id)); const known = maps.filter(([, id]) => ids.has(id)).length;
  assert(known >= 250, 'maps matching real exercise ids: ' + known);
});
