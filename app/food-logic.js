"use strict";
/* Fit Hard food logic (Phase 2). Pure, deterministic, no DOM.
   - filterRecipes: library search + filters, hard allergy exclusion first.
   - alternatives:  ranked, safe swap candidates for one planned meal.
   - shoppingList:  aggregated, serving-scaled, pantry-aware list for a day range.
   - scaleQty / fmtQty: honest display of scaled amounts.
   Nothing here invents nutrition or price data. */
(function (root) {
  function fa() {
    if (root.FitAllergens) return root.FitAllergens;
    if (typeof module !== "undefined" && module.exports && typeof require !== "undefined") { try { return require("./allergens.js"); } catch (e) {} }
    return null;
  }
  function logic() {
    if (root.FitLogic) return root.FitLogic;
    if (typeof module !== "undefined" && module.exports && typeof require !== "undefined") { try { return require("./logic.js"); } catch (e) {} }
    return null;
  }
  function norm(s) { return String(s == null ? "" : s).toLowerCase().trim(); }
  function mpKey(iso) { return String(iso).replace(/-/g, "."); }
  function allergyTerms(profile) { return (profile && profile.allergies) || []; }
  function isSafe(recipe, profile) {
    var t = allergyTerms(profile); if (!t.length) return true;
    var A = fa();
    if (A && A.recipeConflicts(recipe, t).length) return false;
    var L = logic(); if (L && !L.recipeSafe(recipe, profile)) return false;
    return true;
  }
  function filterRecipes(recipes, f) {
    f = f || {};
    var q = norm(f.query), favs = f.favourites || [];
    var out = (recipes || []).filter(function (r) {
      if (f.meal && r.meal !== f.meal) return false;
      if (f.maxMinutes && Number(r.minutes) > f.maxMinutes) return false;
      if (f.maxIngredients && (r.ingredients || []).length > f.maxIngredients) return false;
      if (f.favouritesOnly && favs.indexOf(r.id) === -1) return false;
      if (f.cuisine && (r.cuisines || []).indexOf(f.cuisine) === -1) return false;
      if (f.hideUnsafe !== false && !isSafe(r, f.profile)) return false;
      if (q) {
        var hay = norm(r.name) + " " + norm((f.nameOf && f.nameOf(r)) || "") + " " + (r.cuisines || []).map(norm).join(" ");
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    return out.sort(function (a, b) { var x = norm(a.name), y = norm(b.name); return x < y ? -1 : x > y ? 1 : (a.id < b.id ? -1 : 1); });
  }
  function countHidden(recipes, f) {
    var all = filterRecipes(recipes, Object.assign({}, f, { hideUnsafe: false }));
    var safe = filterRecipes(recipes, f);
    return all.length - safe.length;
  }
  /* Ranked swap candidates for one slot. Excludes the current recipe, anything unsafe, anything over the
     time limit, and recently eaten ids (unless nothing else exists). Order: closeness to the slot kcal target
     (when known), cuisine preference, then id for a stable tie-break. */
  function alternatives(opts) {
    var recipes = opts.recipes || [], meal = opts.meal, profile = opts.profile || {};
    var recent = opts.recentIds || [], kcalOf = opts.kcalOf || function () { return null; };
    var pool = recipes.filter(function (r) {
      return r.meal === meal && r.id !== opts.currentId && isSafe(r, profile) && (!opts.maxMinutes || Number(r.minutes) <= opts.maxMinutes);
    });
    var fresh = pool.filter(function (r) { return recent.indexOf(r.id) === -1; });
    if (fresh.length) pool = fresh;
    var target = opts.targetKcal || null;
    var scored = pool.map(function (r) {
      var k = kcalOf(r), s = 0;
      if (target != null) s -= k == null ? 100000 : Math.abs(k - target);
      (profile.preferences || []).forEach(function (p) { if ((r.cuisines || []).indexOf(p) !== -1) s += 12; });
      return { r: r, s: s };
    });
    scored.sort(function (a, b) { return b.s - a.s || (a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0); });
    return scored.map(function (x) { return x.r; });
  }
  function scaleQty(qty, servings, baseServings) {
    var q = Number(qty) || 0, s = Number(servings) || 0, b = Number(baseServings) || 0;
    if (!b || !s) return q;
    return q * s / b;
  }
  function fmtQty(q, unit) {
    q = Number(q) || 0;
    if (unit === "g" || unit === "ml") return String(q >= 100 ? Math.round(q / 5) * 5 : Math.round(q));
    var r = Math.round(q * 2) / 2;       /* halves for pcs, slices, tsp, tbsp, cloves */
    if (r === 0 && q > 0) r = 0.5;
    return (r % 1 === 0) ? String(r) : String(r);
  }
  /* tsp/tbsp merge into tsp; show as tbsp once there are 3 tsp or more */
  function tidyUnit(item) {
    if (item.unit === "tsp" && item.qty >= 3) { item.qty = item.qty / 3; item.unit = "tbsp"; }
    return item;
  }
  function shoppingList(opts) {
    var state = opts.state || {}, recipes = opts.recipes || [], plan = state.plan || {};
    var from = opts.fromIso, days = opts.days || 7, L = logic();
    var need = {}, order = [];
    function recipeBy(id) { for (var i = 0; i < recipes.length; i++) if (recipes[i].id === id) return recipes[i]; return null; }
    for (var d = 0; d < days; d++) {
      var iso = L.addDays(from, d), entry = plan[mpKey(iso)] || {};
      ["breakfast", "lunch", "dinner"].forEach(function (m) {
        var id = entry[m]; if (!id) return;
        var r = recipeBy(id); if (!r) return;
        var sv = (state.planServings || {})[mpKey(iso) + "." + m] || r.servings;
        (r.ingredients || []).forEach(function (i) {
          var unit = i.unit === "tbsp" ? "tsp" : i.unit, q = Number(i.qty) || 0;
          if (i.unit === "tbsp") q = q * 3;
          var key = norm(i.name) + "|" + unit;
          if (!need[key]) { need[key] = { key: key, name: i.name, unit: unit, qty: 0, category: i.category || "Other" }; order.push(key); }
          need[key].qty += scaleQty(q, sv, r.servings);
        });
      });
    }
    var have = {};
    (state.pantry || []).forEach(function (p) { var k = norm(p.name) + "|" + p.unit; have[k] = (have[k] || 0) + (Number(p.qty) || 0); });
    var rows = order.map(function (k) {
      var it = need[k], h = have[k] || 0;
      var covered = h >= it.qty - 1e-9, buy = Math.max(0, it.qty - h);
      var row = { key: it.key, name: it.name, unit: it.unit, category: it.category, need: it.qty, have: h, qty: covered ? it.qty : buy, covered: covered && h > 0 };
      if (!covered) row.partialHave = h > 0 ? h : 0;
      tidyUnit(row);
      row.checked = !!(state.groceryChecked || {})[it.key];
      return row;
    });
    rows.sort(function (a, b) { return (a.category + a.name) < (b.category + b.name) ? -1 : 1; });
    return rows;
  }
  var api = { isSafe: isSafe, filterRecipes: filterRecipes, countHidden: countHidden, alternatives: alternatives,
    scaleQty: scaleQty, fmtQty: fmtQty, shoppingList: shoppingList, mpKey: mpKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitFood = api;
})(typeof window !== "undefined" ? window : globalThis);
