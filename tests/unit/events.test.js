const test = require('node:test'), assert = require('node:assert'), path = require('path'), { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', '..', 'app');
global.window = global.window || {};
const L = require(path.join(APP, 'logic.js')), EV = require(path.join(APP, 'events-logic.js')), CI = require(path.join(APP, 'calendar-import.js'));
const NOW = new Date(2026, 10, 7, 8, 0).getTime(), TODAY = '2026-11-07';
const base = () => L.repairState({ settings: { notifications: true } });

test('todo reminders are opt-in, lead time applied, done/past/invalid skipped', () => {
  const st = base();
  st.todos = [
    { id: 'a', title: 'A', date: '2026-11-08', time: '09:00', status: 'open', remindMin: 30 },
    { id: 'b', title: 'B', date: '2026-11-08', time: '09:00', status: 'open', remindMin: null },
    { id: 'c', title: 'C', date: '2026-11-08', time: '09:00', status: 'done', remindMin: 0 },
    { id: 'd', title: 'D', date: '2026-11-01', time: '09:00', status: 'open', remindMin: 0 },
    { id: 'e', title: 'E', date: '2026-11-08', time: '25:99', status: 'open', remindMin: 0 },
    { id: 'f', title: 'F', date: '2026-02-31', time: '09:00', status: 'open', remindMin: 0 },
    { id: 'g', title: 'G', date: '2026-11-08', time: null, status: 'open', remindMin: 0 }];
  const p = EV.plan(L.repairState(JSON.parse(JSON.stringify(st))), NOW, TODAY);
  const t = p.filter(r => r.kind === 'todo'); assert.deepStrictEqual(t.map(r => r.ref), ['a']);
  assert.strictEqual(t[0].at, new Date(2026, 10, 8, 8, 30).getTime());
});
test('plan merges dose, gym, water, todo; sorted; capped; unique uids', () => {
  const st = base(); const wd = new Date(2026, 10, 8).getDay();
  st.routines = [{ id: 'r1', name: 'Gym', days: [wd], time: '18:00', items: [], createdKey: '2026-01-01' }];
  st.settings.waterReminder = '10:00';
  st.todos = []; for (let i = 0; i < 60; i++) st.todos.push({ id: 't' + i, title: 'T' + i, date: L.addDays(TODAY, 1 + (i % 10)), time: '09:00', status: 'open', remindMin: 0 });
  const p = EV.plan(L.repairState(st), NOW, TODAY);
  assert(p.length <= EV.MAX_PENDING); assert.strictEqual(new Set(p.map(r => r.uid)).size, p.length);
  for (let i = 1; i < p.length; i++) assert(p[i - 1].at <= p[i].at);
});
test('ids are stable and collision-free', () => {
  const items = []; for (let i = 0; i < 500; i++) items.push({ uid: 'todo|x' + i + '|2026-11-08' });
  const a = EV.assignIds(items), b = EV.assignIds(items);
  assert.deepStrictEqual(a.map(x => x.id), b.map(x => x.id)); assert.strictEqual(new Set(a.map(x => x.id)).size, 500);
});
test('reconcile is idempotent: second run does nothing; edit reschedules only the changed; delete cancels', () => {
  const n = (id, at, title) => ({ id, at, title, body: 'b' });
  let held = {}, next = [n(1, 100, 'A'), n(2, 200, 'B')];
  let r = EV.reconcile(held, next); assert.strictEqual(r.schedule.length, 2); assert.strictEqual(r.cancel.length, 0); held = r.map;
  r = EV.reconcile(held, next); assert.deepStrictEqual([r.schedule.length, r.cancel.length], [0, 0]);
  next = [n(1, 150, 'A'), n(2, 200, 'B')]; r = EV.reconcile(held, next);
  assert.deepStrictEqual(r.cancel, [1]); assert.deepStrictEqual(r.schedule.map(x => x.id), [1]); held = r.map;
  next = [n(2, 200, 'B')]; r = EV.reconcile(held, next); assert.deepStrictEqual(r.cancel, [1]); assert.strictEqual(r.schedule.length, 0); held = r.map;
  next = []; r = EV.reconcile(held, next); assert.deepStrictEqual(r.cancel, [2]); assert.deepStrictEqual(r.map, {});
});
test('source edit/delete flow produces no orphans end to end', () => {
  const st = base(); st.todos = [{ id: 'a', title: 'A', date: '2026-11-08', time: '09:00', status: 'open', remindMin: 10 }];
  let held = {}; const run = () => { const items = EV.assignIds(EV.plan(L.repairState(JSON.parse(JSON.stringify(st))), NOW, TODAY)).map(r => ({ id: r.id, at: r.at, title: r.name, body: 'x' })); const rc = EV.reconcile(held, items); held = rc.map; return rc; };
  assert.strictEqual(run().schedule.length, 1); assert.strictEqual(run().schedule.length, 0);
  st.todos[0].time = '10:00'; let rc = run(); assert.strictEqual(rc.cancel.length, 1); assert.strictEqual(rc.schedule.length, 1);
  st.todos[0].status = 'done'; rc = run(); assert.strictEqual(rc.cancel.length, 1); assert.strictEqual(rc.schedule.length, 0); assert.deepStrictEqual(held, {});
  st.todos[0].status = 'open'; run(); st.todos = []; rc = run(); assert.strictEqual(rc.cancel.length, 1); assert.deepStrictEqual(held, {});
});
for (const tz of ['UTC', 'America/Los_Angeles', 'Europe/London', 'Australia/Sydney', 'Australia/Lord_Howe', 'Pacific/Auckland']) {
  test('DST-safe local resolution in ' + tz, () => {
    const code = `
      const EV=require(${JSON.stringify(path.join(APP, 'events-logic.js'))}); const out={};
      const cases={ LA_gap:['2026-03-08','02:30'], LA_ok:['2026-03-08','03:30'], LA_fall:['2026-11-01','01:30'], LON_gap:['2026-03-29','01:30'], SYD_gap:['2026-10-04','02:30'], SYD_fall:['2026-04-05','02:30'], LH_gap:['2026-10-04','02:15'], AKL_gap:['2026-09-27','02:30'], normal:['2026-06-15','09:00'] };
      for (const k in cases){ const r=EV.resolveLocal(...cases[k]); const d=new Date(r.at); out[k]={shifted:r.shifted,h:d.getHours(),m:d.getMinutes(),day:d.getDate()}; }
      console.log(JSON.stringify(out));`;
    const o = JSON.parse(execFileSync('node', ['-e', code], { env: Object.assign({}, process.env, { TZ: tz }) }).toString());
    assert.deepStrictEqual(o.normal, { shifted: false, h: 9, m: 0, day: 15 });
    for (const k of Object.keys(o)) { assert(Number.isInteger(o[k].h) && o[k].h >= 0 && o[k].h < 24, k); }
    if (tz === 'America/Los_Angeles') { assert.strictEqual(o.LA_gap.shifted, true); assert.strictEqual(o.LA_gap.h, 3); assert.strictEqual(o.LA_ok.shifted, false); assert.strictEqual(o.LA_fall.shifted, false); assert.strictEqual(o.LA_fall.h, 1); }
    if (tz === 'Europe/London') { assert.strictEqual(o.LON_gap.shifted, true); }
    if (tz === 'Australia/Sydney') { assert.strictEqual(o.SYD_gap.shifted, true); assert.strictEqual(o.SYD_fall.shifted, false); }
    if (tz === 'Australia/Lord_Howe') { assert.strictEqual(o.LH_gap.shifted, true); }
    if (tz === 'UTC') for (const k of Object.keys(o)) assert.strictEqual(o[k].shifted, false);
  });
}
test('a reminder across a DST change still fires on the intended local clock time', () => {
  const code = `const EV=require(${JSON.stringify(path.join(APP, 'events-logic.js'))}); const a=EV.resolveLocal('2026-03-07','09:00'), b=EV.resolveLocal('2026-03-09','09:00'); console.log((b.at-a.at)/3600000)`;
  const h = Number(execFileSync('node', ['-e', code], { env: Object.assign({}, process.env, { TZ: 'America/Los_Angeles' }) }).toString());
  assert.strictEqual(h, 47);
});
test('resolveLocal rejects impossible dates and times', () => {
  ['2026-02-30', '2026-13-01', 'x', null, '2026-1-1'].forEach(k => assert.strictEqual(EV.resolveLocal(k, '09:00'), null));
  ['24:00', '9:00', '09:60', '', null].forEach(t => assert.strictEqual(EV.resolveLocal('2026-11-07', t), null));
});
const ICS = (events) => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//t//EN\r\n' + events.join('') + 'END:VCALENDAR\r\n';
const VE = (uid, sum, dt) => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20261101T000000Z\r\nDTSTART:${dt}\r\nDTEND:${dt.replace(/T(\d\d)/, (m, h) => 'T' + String(+h + 1).padStart(2, '0'))}\r\nSUMMARY:${sum}\r\nEND:VEVENT\r\n`;
const importOnce = (st, text, label) => { const parsed = CI.parseICS(text); const plan = CI.planImport(parsed, st.todos, { sourceLabel: label, repeatModel: 'none', now: NOW }); return CI.applyImport({ tasks: st.todos, imports: st.imports }, plan, label, s => ({ id: 'i' + st.todos.length, title: s.title, date: s.date, time: s.time, status: 'open', importUid: s.importUid, importKey: s.importKey })); };
test('import: re-import never doubles, even when the file gained events', () => {
  const st = { todos: [], imports: [] };
  const f1 = ICS([VE('u1', 'One', '20261110T090000'), VE('u2', 'Two', '20261111T090000')]);
  assert.strictEqual(importOnce(st, f1, 'X').added, 2);
  const again = importOnce(st, f1, 'X'); assert.strictEqual(again.added, 0); assert.strictEqual(again.dupes, 2);
  const f2 = ICS([VE('u1', 'One', '20261110T090000'), VE('u2', 'Two', '20261111T090000'), VE('u3', 'Three', '20261112T090000')]);
  const r = importOnce(st, f2, 'X'); assert.strictEqual(r.added, 1); assert.strictEqual(st.todos.length, 3);
});
test('import: junk, empty, oversized and untitled input is rejected safely', () => {
  assert(CI.parseICS('hello world').error || CI.parseICS('hello world').events.length === 0);
  assert.strictEqual(CI.parseICS('').events.length, 0);
  assert.strictEqual(CI.parseICS('x'.repeat(2000001)).error, 'file too large');
  const st = { todos: [], imports: [] }; const r = importOnce(st, ICS([VE('u9', '', '20261110T090000')]), 'X'); assert.strictEqual(r.added, 0); assert.strictEqual(r.skipped, 1);
});
test('import: cap on events per import and title length', () => {
  const evs = []; for (let i = 0; i < 1700; i++) evs.push(VE('c' + i, 'E' + i, '2026111' + '0T090000'));
  const st = { todos: [], imports: [] }; const r = importOnce(st, ICS(evs), 'X'); assert.strictEqual(r.added, 1500); assert.strictEqual(r.skipped, 200);
  const long = importOnce({ todos: [], imports: [] }, ICS([VE('L', 'Z'.repeat(500), '20261110T090000')]), 'Y'); assert.strictEqual(long.added, 1);
});
test('import: imported tasks carry no reminder until the user opts in', () => {
  const st = { todos: [], imports: [] }; importOnce(st, ICS([VE('u1', 'One', '20261110T090000')]), 'X');
  assert.strictEqual(L.repairState({ todos: st.todos }).todos[0].remindMin, null);
});
test('state: remindMin validated', () => {
  const t = L.repairState({ todos: [{ id: 'a', title: 'x', remindMin: 30 }, { id: 'b', title: 'y', remindMin: -5 }, { id: 'c', title: 'z', remindMin: 'soon' }] }).todos;
  assert.deepStrictEqual(t.map(x => x.remindMin), [30, null, null]);
});
