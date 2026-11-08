const test = require('node:test'), assert = require('node:assert'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
global.window = global.window || {};
const A = require(path.join(APP, 'allergens.js')), L = require(path.join(APP, 'logic.js')), F = require(path.join(APP, 'food-logic.js'));
const MD = require(path.join(APP, 'meals-data-node.js')), MN = require(path.join(APP, 'meals-nutrition-node.js')), ML = require(path.join(APP, 'meals-logic.js'));
const R = MD.RECIPES, kcalOf = r => ML.recipeKcal(r, MN);

test('every library ingredient has an explicit curated allergen entry', () => {
  const names = new Set(); R.forEach(r => r.ingredients.forEach(i => names.add(i.name)));
  const missing = [...names].filter(n => !(n in A.CURATED)); assert.deepStrictEqual(missing, []);
});
const TERMS = { eggs: 'egg', egg: 'egg', peanut: 'peanut', peanuts: 'peanut', 'tree nuts': 'tree_nut', almond: 'tree_nut', nuts: 'tree_nut', shrimp: 'shellfish', prawns: 'shellfish', shellfish: 'shellfish',
  fish: 'fish', salmon: 'fish', wheat: 'gluten', gluten: 'gluten', 'gluten free': 'gluten', coeliac: 'gluten', lactose: 'milk', dairy: 'milk', 'dairy free': 'milk', milk: 'milk', cheese: 'milk',
  soy: 'soy', soya: 'soy', sesame: 'sesame', 'Peanut Allergy': 'peanut', 'EGGS': 'egg', 'vegan': 'meat', 'vegetarian': 'meat', pork: 'pork', beef: 'beef' };
test('hard exclusion: for every term, no safe recipe contains a flagged ingredient (all 1089 recipes)', () => {
  for (const [term, key] of Object.entries(TERMS)) {
    const prof = { allergies: [term] }; let excluded = 0;
    for (const r of R) {
      const flagged = r.ingredients.some(i => A.tagsOfName(i.name).includes(key));
      const safe = F.isSafe(r, prof) && L.recipeSafe(r, prof);
      if (flagged) assert.strictEqual(safe, false, `${term}: ${r.id} contains ${key} but is "safe"`);
      if (!safe) excluded++;
    }
    assert(excluded > 0, `${term} excluded nothing`);
  }
});
test('regression: plural/synonym terms that used to exclude nothing now exclude', () => {
  const before = { eggs: 1089, peanuts: 1089, 'tree nuts': 1089, shrimp: 1089, wheat: 1089, lactose: 1089, sesame: 1089, soya: 1089 };
  for (const t of Object.keys(before)) assert(R.filter(r => F.isSafe(r, { allergies: [t] })).length < before[t], t);
});
test('plant milks are not dairy; nutmeg/butternut are not nuts; peanut butter is not dairy', () => {
  assert(!A.tagsOfName('coconut milk').includes('milk')); assert(!A.tagsOfName('almond milk').includes('milk')); assert(A.tagsOfName('almond milk').includes('tree_nut'));
  assert(!A.tagsOfName('nutmeg').includes('tree_nut')); assert(!A.tagsOfName('butternut pumpkin').includes('tree_nut')); assert(!A.tagsOfName('peanut butter').includes('milk'));
});
test('unknown terms are reported as name-only matches (disclosed, never ignored)', () => {
  assert.deepStrictEqual(A.unresolved(['eggs', 'mushrooms', 'coriander']), ['mushrooms', 'coriander']);
  assert(R.filter(r => F.isSafe(r, { allergies: ['mushrooms'] })).length < R.length);
});
test('custom recipes with free-text ingredients are scanned too', () => {
  const r = { id: 'c1', ingredients: [{ name: 'Cashews' }, { name: 'oat milk' }] };
  assert(!F.isSafe(r, { allergies: ['tree nuts'] })); assert(F.isSafe(r, { allergies: ['dairy'] }));
});
test('planner is deterministic and never plans an unsafe recipe', () => {
  const diets = [[], ['eggs'], ['peanuts', 'tree nuts'], ['gluten'], ['lactose'], ['soy', 'sesame'], ['shellfish', 'fish'], ['vegetarian'], ['vegan']];
  for (const al of diets) {
    const prof = { allergies: al, preferences: ['Italian'] };
    const a = L.planDayMeals(2000 * 0.9, R, kcalOf, prof, []), b = L.planDayMeals(2000 * 0.9, R, kcalOf, prof, []);
    assert.deepStrictEqual(a, b);
    for (const m of ['breakfast', 'lunch', 'dinner']) { assert(a[m], `${al}: no ${m}`); assert(F.isSafe(R.find(r => r.id === a[m].id), prof), `${al} ${m} unsafe`); }
  }
});
test('week plan: no repeats within 7 days, time limit respected, gaps reported not relaxed', () => {
  const prof = { allergies: ['eggs'] }, recent = [], ids = [];
  for (let i = 0; i < 7; i++) { const d = L.planDayMeals(1900, R, kcalOf, prof, recent, { maxMinutes: 30 }); ['breakfast', 'lunch', 'dinner'].forEach(m => { assert(d[m]); const r = R.find(x => x.id === d[m].id); assert(r.minutes <= 30); ids.push(r.id); recent.push(r.id); }); }
  assert.strictEqual(new Set(ids).size, ids.length);
  const none = L.planDayMeals(1900, R, kcalOf, { allergies: [] }, [], { maxMinutes: 5 });
  assert.strictEqual(none.complete, false);
});
test('alternatives: safe, same meal, excludes current, within time, deterministic', () => {
  const prof = { allergies: ['dairy'] }, cur = R.find(r => r.meal === 'dinner');
  const o = { recipes: R, meal: 'dinner', currentId: cur.id, profile: prof, recentIds: [], kcalOf, targetKcal: 600, maxMinutes: 30 };
  const a = F.alternatives(o), b = F.alternatives(o);
  assert(a.length > 5); assert.deepStrictEqual(a.map(r => r.id), b.map(r => r.id));
  a.forEach(r => { assert.strictEqual(r.meal, 'dinner'); assert.notStrictEqual(r.id, cur.id); assert(F.isSafe(r, prof)); assert(r.minutes <= 30); });
});
test('filterRecipes: counts hidden-by-allergy honestly; filters compose', () => {
  const f = { profile: { allergies: ['gluten'] } };
  const hidden = F.countHidden(R, f); assert(hidden > 500);
  assert.strictEqual(F.filterRecipes(R, f).length + hidden, R.length);
  const q = F.filterRecipes(R, { meal: 'lunch', maxMinutes: 20, maxIngredients: 8 }); q.forEach(r => { assert.strictEqual(r.meal, 'lunch'); assert(r.minutes <= 20); assert(r.ingredients.length <= 8); });
});
test('shopping list: scales by servings, merges tsp/tbsp, subtracts pantry, ignores past days', () => {
  const t = L.todayKey(), k = F.mpKey(t);
  const rec = { id: 'tr', name: 'T', meal: 'dinner', servings: 2, minutes: 10, cuisines: [], steps: [], ingredients: [{ name: 'rice', qty: 200, unit: 'g', category: 'Pantry' }, { name: 'cumin', qty: 1, unit: 'tsp', category: 'Pantry' }, { name: 'cumin', qty: 1, unit: 'tbsp', category: 'Pantry' }] };
  const st = L.repairState({ plan: {} }); st.plan[k] = { dinner: 'tr' }; st.plan[F.mpKey(L.addDays(t, -2))] = { dinner: 'tr' };
  let rows = F.shoppingList({ state: st, recipes: [rec], fromIso: t, days: 7 });
  assert.strictEqual(rows.find(r => r.name === 'rice').qty, 200);
  const cumin = rows.find(r => r.name === 'cumin'); assert.strictEqual(cumin.unit, 'tbsp'); assert.strictEqual(cumin.qty, 4 / 3);
  st.planServings[k + '.dinner'] = 6; rows = F.shoppingList({ state: st, recipes: [rec], fromIso: t, days: 7 });
  assert.strictEqual(rows.find(r => r.name === 'rice').qty, 600);
  st.pantry = [{ name: 'rice', qty: 250, unit: 'g' }]; rows = F.shoppingList({ state: st, recipes: [rec], fromIso: t, days: 7 });
  assert.strictEqual(rows.find(r => r.name === 'rice').qty, 350); assert.strictEqual(rows.find(r => r.name === 'rice').partialHave, 250);
  st.pantry = [{ name: 'rice', qty: 900, unit: 'g' }]; rows = F.shoppingList({ state: st, recipes: [rec], fromIso: t, days: 7 });
  assert.strictEqual(rows.find(r => r.name === 'rice').covered, true);
  st.groceryChecked['rice|g'] = true; assert.strictEqual(F.shoppingList({ state: st, recipes: [rec], fromIso: t, days: 7 }).find(r => r.name === 'rice').checked, true);
});
test('fmtQty / scaleQty', () => {
  assert.strictEqual(F.fmtQty(F.scaleQty(1, 3, 2), 'pcs'), '1.5'); assert.strictEqual(F.fmtQty(0.2, 'tsp'), '0.5'); assert.strictEqual(F.fmtQty(333, 'g'), '335'); assert.strictEqual(F.fmtQty(47.6, 'g'), '48');
});
test('every recipe has a computable calorie value with a USDA source note', () => {
  assert(R.every(r => kcalOf(r) != null)); assert(MN.SOURCES && Object.keys(MN.SOURCES).length >= 100);
});
test('state: new Phase 2 fields validate and survive cloud merge', () => {
  const st = L.repairState({ planServings: { '2026.11.07.lunch': 4, bad: 3, '2026.11.07.dinner': 99 }, eaten: { '2026-11-07.lunch': true, nope: true }, groceryChecked: { 'a|g': true, 'b|g': false }, mealPrefs: { maxMinutes: 2 } });
  assert.deepStrictEqual(st.planServings, { '2026.11.07.lunch': 4 }); assert.deepStrictEqual(st.eaten, { '2026-11-07.lunch': true });
  assert.deepStrictEqual(st.groceryChecked, { 'a|g': true }); assert.strictEqual(st.mealPrefs.maxMinutes, 0);
  const m = L.mergeStates({ eaten: { '2026-11-07.lunch': true } }, { groceryChecked: { 'x|g': true }, mealPrefs: { maxMinutes: 20 } });
  assert(m.eaten['2026-11-07.lunch'] && m.groceryChecked['x|g'] && m.mealPrefs.maxMinutes === 20);
});
