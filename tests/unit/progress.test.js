const test = require('node:test'), assert = require('node:assert'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
global.window = global.window || {};
const L = require(path.join(APP, 'logic.js')), P = require(path.join(APP, 'progress-logic.js'));
const TODAY = '2026-11-11'; // Wednesday
const sess = (id, date, log, t) => ({ id, status: 'done', dateKey: date, startedAt: t, routineName: 'R', minutes: 30, log: log.map(([e, r, w]) => ({ exerciseId: e, setNo: 1, reps: r, weightKg: w, at: t })) });
const base = (o) => Object.assign(L.repairState({}), o);

test('measure validation: ranges, formats, units are plain numbers', () => {
  assert.strictEqual(P.parseMeasure('weightKg', '72,5'), 72.5); assert.strictEqual(P.parseMeasure('weightKg', '19'), null); assert.strictEqual(P.parseMeasure('weightKg', '401'), null);
  assert.strictEqual(P.parseMeasure('waistCm', '81'), 81); assert.strictEqual(P.parseMeasure('waistCm', 'abc'), null); assert.strictEqual(P.parseMeasure('nope', '5'), null); assert.strictEqual(P.parseMeasure('armCm', ''), null);
});
test('week starts Monday', () => { assert.strictEqual(P.weekStart('2026-11-11'), '2026-11-09'); assert.strictEqual(P.weekStart('2026-11-09'), '2026-11-09'); assert.strictEqual(P.weekStart('2026-11-15'), '2026-11-09'); assert.strictEqual(P.weekStart('2026-11-16'), '2026-11-16'); });
test('empty state: no crash, nothing negative, gentle defaults', () => {
  const st = base({}); const f = P.flexibleStreak(st, TODAY); assert.deepStrictEqual(f, { activeWeeks: 0, currentRun: 0, bestRun: 0, returned: false });
  assert.strictEqual(P.milestones(st, TODAY).earned.length, 0); assert.strictEqual(P.milestones(st, TODAY).next, 'first_session'); assert.deepStrictEqual(P.personalBests(st).events, []);
  assert.strictEqual(P.weeklyReview(st, TODAY).step, 'build_routine'); assert.strictEqual(P.bodySummary([], 'weightKg'), null);
  assert.strictEqual(P.weeks(st, TODAY, 8).length, 8);
});
test('flexible streak: gaps end the run but never reduce totals or best; current week never breaks it', () => {
  const st = base({ sessions: [sess('a', '2026-10-05', [], 1), sess('b', '2026-10-12', [], 2), sess('c', '2026-10-19', [], 3), sess('d', '2026-11-09', [], 4)] });
  let f = P.flexibleStreak(st, TODAY); assert.strictEqual(f.activeWeeks, 4); assert.strictEqual(f.bestRun, 3); assert.strictEqual(f.currentRun, 1); assert.strictEqual(f.returned, true);
  st.sessions.pop(); f = P.flexibleStreak(st, '2026-10-21'); assert.strictEqual(f.currentRun, 3);
  f = P.flexibleStreak(st, '2026-11-11'); assert.strictEqual(f.currentRun, 0); assert.strictEqual(f.bestRun, 3); assert.strictEqual(f.activeWeeks, 3);
});
test('rest days and habits count toward consistency', () => {
  const st = base({ restDays: { '2026-11-10': true }, habits: [{ id: 'h', name: 'x', days: { '2026-11-03': true } }] });
  const w = P.weeks(st, TODAY, 2); assert.strictEqual(w[1].restDays, 1); assert.strictEqual(w[1].counted, true); assert.strictEqual(w[0].moveDays, 1); assert.strictEqual(w[0].counted, true);
  assert.strictEqual(P.flexibleStreak(st, TODAY).currentRun, 2);
});
test('personal bests compare only to the user own earlier sets', () => {
  const st = base({ sessions: [sess('a', '2026-10-01', [['x', 10, 20]], 1), sess('b', '2026-10-08', [['x', 12, 20]], 2), sess('c', '2026-10-15', [['x', 8, 20]], 3), sess('d', '2026-11-05', [['x', 5, 25], ['y', 10, null]], 4)] });
  const pb = P.personalBests(st); assert.deepStrictEqual(pb.events.map(e => [e.exerciseId, e.dateKey]), [['x', '2026-10-08'], ['x', '2026-11-05']]);
  assert.strictEqual(pb.best.x.weightKg, 25); assert.strictEqual(pb.best.y.reps, 10);
  assert.deepStrictEqual(P.recentBests(st, TODAY, 21).map(e => e.dateKey), ['2026-11-05']);
  assert.deepStrictEqual(P.strengthSeries(st, 'x').map(s => [s.reps, s.weightKg]), [[10, 20], [12, 20], [8, 20], [5, 25]]);
  assert.deepStrictEqual(P.loggedExercises(st), ['x', 'y']);
});
test('active and discarded sessions never count', () => {
  const st = base({ sessions: [Object.assign(sess('a', '2026-11-10', [['x', 10, 20]], 1), { status: 'active' }), Object.assign(sess('b', '2026-11-10', [['x', 10, 20]], 2), { status: 'discarded' })] });
  assert.strictEqual(P.milestones(st, TODAY).counts.sessions, 0); assert.strictEqual(P.personalBests(st).events.length, 0);
});
test('milestones only ever unlock and next is the first not yet reached', () => {
  const ses = []; for (let i = 0; i < 12; i++) ses.push(sess('s' + i, L.addDays('2026-09-01', i * 7), [['x', 10, 20 + i]], i));
  const m = P.milestones(base({ sessions: ses }), TODAY);
  ['first_session', 'first_log', 'sessions_5', 'sessions_10', 'first_pb', 'weeks_4', 'weeks_12'].forEach(id => assert(m.earned.includes(id), id));
  assert.strictEqual(m.next, 'sessions_25');
  const fewer = P.milestones(base({ sessions: ses.slice(0, 6) }), TODAY).earned; assert(fewer.every(id => m.earned.includes(id)));
});
test('body summary is neutral numbers; series sorted; non-metrics ignored', () => {
  const e = [{ date: '2026-11-05', weightKg: 70 }, { date: '2026-10-01', weightKg: 72.4 }, { date: '2026-11-09', waistCm: 80 }];
  const s = P.bodySummary(e, 'weightKg'); assert.strictEqual(s.count, 2); assert.strictEqual(s.change, -2.4); assert.strictEqual(s.first.date, '2026-10-01');
  assert.strictEqual(P.bodySummary(e, 'waistCm').change, 0); assert.strictEqual(P.bodySummary(e, 'hipCm'), null);
});
test('weekly review next step is a single gentle suggestion', () => {
  const r = base({ routines: [{ id: 'r', name: 'x', days: [1, 3, 5], items: [] }] });
  assert.strictEqual(P.weeklyReview(r, TODAY).step, 'one_small');
  r.sessions = [sess('a', '2026-11-09', [], 1)]; assert.strictEqual(P.weeklyReview(r, TODAY).step, 'next_session');
  r.sessions.push(sess('b', '2026-11-10', [], 2), sess('c', '2026-11-11', [], 3)); assert.strictEqual(P.weeklyReview(r, TODAY).step, 'enjoy');
  const rest = base({ routines: r.routines, restDays: { '2026-11-09': true } }); assert.strictEqual(P.weeklyReview(rest, TODAY).step, 'next_session');
});
test('export: JSON excludes photos note, CSV defends against formula injection', () => {
  const st = base({ body: [{ id: 'b', date: '2026-11-01', weightKg: 70 }], sessions: [sess('a', '2026-11-01', [['=cmd|x', 5, 10]], 1)] });
  const j = P.exportData(st, '2026-11-11T00:00:00Z'); assert.strictEqual(j.sessions.length, 1); assert(/photos stay on your device/i.test(j.note));
  const c = P.toCsv(st); assert(c.includes("'=cmd|x")); assert(!/\n=cmd/.test(c)); assert(c.split('\n')[0] === 'type,date,name,reps,weightKg,value');
});
test('state: body, restDays, reflections, prefs validate and merge', () => {
  const st = L.repairState({ body: [{ id: 'a', date: '2026-11-01', weightKg: 70, waistCm: 99999 }, { date: 'bad', weightKg: 70 }, { date: '2026-11-02' }], restDays: { '2026-11-02': true, '2026-11-03': false, x: true },
    reflections: { '2026-11-09': { easier: 'a'.repeat(900), change: 5, next: 'ok' }, nope: {} }, progressPrefs: { off: true, hideBody: 'yes' } });
  assert.strictEqual(st.body.length, 1); assert.strictEqual(st.body[0].waistCm, undefined); assert.deepStrictEqual(st.restDays, { '2026-11-02': true });
  assert.strictEqual(st.reflections['2026-11-09'].easier.length, 300); assert.strictEqual(st.reflections['2026-11-09'].change, ''); assert.deepStrictEqual(st.progressPrefs, { off: true, hideBody: false });
  const m = L.mergeStates({ body: [{ id: 'a', date: '2026-11-01', weightKg: 70 }], restDays: { '2026-11-02': true } }, { body: [{ id: 'b', date: '2026-11-03', weightKg: 71 }], restDays: { '2026-11-05': true }, progressPrefs: { off: true, hideBody: false } });
  assert.strictEqual(m.body.length, 2); assert.strictEqual(Object.keys(m.restDays).length, 2); assert.strictEqual(m.progressPrefs.off, true);
});
