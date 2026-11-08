// Data & asset invariants (guards the "do not delete data" rule). Run: node --test tests/unit
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', '..', 'app');
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['meals-data.js', 'exercises-data.js', 'anim-data.js', 'anim-data-expansion.js'])
  vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx, { filename: f });
const R = ctx.MP_DATA.RECIPES, EX = ctx.FIT_EX.EXERCISES, MA = ctx.FIT_EX.MACHINES;
test('recipes: 1089, unique ids, ingredients+steps present', () => {
  assert.strictEqual(R.length, 1089); assert.strictEqual(new Set(R.map(r => r.id)).size, 1089);
  assert(R.every(r => r.ingredients.length && r.steps.length));
});
test('exercises: 871 unique, 23 equipment types', () => {
  assert.strictEqual(EX.length, 871); assert.strictEqual(new Set(EX.map(e => e.id)).size, 871);
  assert.strictEqual(new Set(EX.map(e => e.equipment)).size, 23);
});
test('machines: 36 unique, all exerciseIds exist', () => {
  assert.strictEqual(MA.length, 36); assert.strictEqual(new Set(MA.map(m => m.id)).size, 36);
  const ids = new Set(EX.map(e => e.id));
  for (const m of MA) for (const id of m.exerciseIds || []) assert(ids.has(id), m.id + ' -> ' + id);
});
test('animation tracks reference real exercises', () => {
  const ids = new Set(EX.map(e => e.id));
  for (const k of Object.keys(ctx.FIT_ANIM)) assert(ids.has(k), k);
});
test('frame maps: every referenced frame file exists, 3 frames each', () => {
  const s = fs.readFileSync(path.join(APP, 'anim.js'), 'utf8');
  const maps = [...s.matchAll(/"([^"]+)":\s*\[((?:"assets\/[^"]+",?\s*){3})\]/g)];
  assert(maps.length >= 300);
  for (const [, id, arr] of maps) for (const f of arr.match(/assets\/[^"]+/g)) assert(fs.existsSync(path.join(APP, f)), id + ' ' + f);
});
test('all webp assets are 3-frame sets or wally/station art', () => {
  const files = fs.readdirSync(path.join(APP, 'assets')).filter(f => f.startsWith('anim-'));
  assert.strictEqual(files.length % 3, 0);
});
test('service worker precache list points at existing files', () => {
  const sw = fs.readFileSync(path.join(APP, 'service-worker.js'), 'utf8');
  const files = [...sw.matchAll(/"([^"]+\.(?:js|css|html|png|webp|woff2|webmanifest))"/g)].map(m => m[1]);
  assert(files.length > 100);
  for (const f of files) assert(fs.existsSync(path.join(APP, f)), 'missing precache file: ' + f);
});
test('modules load in node', () => {
  for (const f of ['logic.js', 'meals-logic.js', 'calendar-import.js', 'prices-data.js']) {
    global.window = global.window || {}; assert.doesNotThrow(() => require(path.join(APP, f)), f);
  }
});
