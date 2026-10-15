/* Copied from Meal Prep (her own app) on 14 Oct 2026 for the Fit App meals phase.
   Only the node require paths were renamed (data-node -> meals-data-node,
   nutrition-node -> meals-nutrition-node). Engine code is unchanged, so its
   gated history carries; any change here re-loops Meal Prep gates too. */
/* Meal Prep core logic. Pure functions, tested by tests/run-tests.mjs */
(function (global) {
  "use strict";
  function dataRef() {
    if (typeof module !== "undefined" && module.exports && typeof require !== "undefined") {
      try { return require("./meals-data-node.js"); } catch (e) { return null; }
    }
    return global.MP_DATA;
  }
  function shelfLookup(name, DATA) {
    const d = DATA || dataRef();
    const n = String(name || "").toLowerCase();
    let best = null;
    d.SHELF.forEach(function (s) {
      if (s.key !== "default" && n.indexOf(s.key) !== -1) {
        if (!best || s.key.length > best.key.length) best = s;
      }
    });
    return best || d.SHELF[d.SHELF.length - 1];
  }
  function shelfDays(name, storage, DATA) {
    const s = shelfLookup(name, DATA);
    const days = s[storage];
    return days && days > 0 ? days : (s.fridge || s.pantry || 5);
  }
  function expiryFor(item, DATA) {
    const added = new Date(String(item.added).replace(/\./g, "-") + "T12:00:00");
    const days = item.shelfDays || shelfDays(item.name, item.storage, DATA);
    const exp = new Date(added.getTime() + days * 86400000);
    return exp;
  }
  function daysLeft(item, today, DATA) {
    const t = new Date((today || new Date()).toISOString().slice(0, 10) + "T12:00:00");
    const exp = expiryFor(item, DATA);
    return Math.round((exp - t) / 86400000);
  }
  function sortByExpiry(items, today, DATA) {
    return items.slice().sort(function (a, b) { return daysLeft(a, today, DATA) - daysLeft(b, today, DATA); });
  }
  function norm(s) { return String(s || "").toLowerCase().trim(); }
  function termKeywords(term, DATA) {
    const d = DATA || dataRef();
    const t = norm(term);
    const groups = d.ALLERGEN_GROUPS || {};
    return [t].concat(groups[t] || []);
  }
  function ingredientMatchesTerm(ingredientName, term, DATA) {
    const n = norm(ingredientName); const t = norm(term);
    if (!n || !t) return false;
    /* Peanut butter and coconut milk or cream carry no dairy, so a milk allergy must not fire on them. */
    if (t === "milk" && (n.indexOf("coconut") !== -1 || n.indexOf("peanut butter") !== -1)) return false;
    return termKeywords(term, DATA).some(function (k) {
      return n.indexOf(k) !== -1 || k.indexOf(n) !== -1;
    });
  }
  function personConflicts(recipe, person, DATA) {
    const bad = (person.dislikes || []).concat(person.allergies || []).map(norm).filter(Boolean);
    const hits = [];
    recipe.ingredients.forEach(function (i) {
      bad.forEach(function (b) {
        if (ingredientMatchesTerm(i.name, b, DATA)) {
          if (hits.indexOf(i.name) === -1) hits.push(i.name);
        }
      });
    });
    return hits;
  }
  function swapFor(ingredientName, DATA) {
    const d = DATA || dataRef();
    const n = norm(ingredientName);
    for (let i = 0; i < d.SWAPS.length; i++) {
      if (n.indexOf(d.SWAPS[i].match) !== -1) return d.SWAPS[i].swap;
    }
    return "leaving it out";
  }
  function adaptations(recipe, family, DATA) {
    const out = [];
    (family || []).forEach(function (p) {
      const hits = personConflicts(recipe, p, DATA);
      hits.forEach(function (h) {
        let swap = swapFor(h, DATA);
        if (swap === "leaving it out") {
          const terms = (p.dislikes || []).concat(p.allergies || []);
          for (let ti = 0; ti < terms.length; ti++) {
            if (ingredientMatchesTerm(h, terms[ti], DATA)) { const ts = swapFor(terms[ti], DATA); if (ts !== "leaving it out") { swap = ts; break; } }
          }
        }
        out.push({ person: p.name, ingredient: h, swap: swap, allergy: (p.allergies || []).some(function (a) { return ingredientMatchesTerm(h, a, DATA); }) });
      });
    });
    return out;
  }
  function recipeScore(recipe, ctx) {
    let score = 0;
    const prefs = (ctx.preferences || []).map(norm);
    recipe.cuisines.forEach(function (c) { if (prefs.indexOf(norm(c)) !== -1) score += 25; });
    const expiring = (ctx.expiringNames || []).map(norm);
    recipe.ingredients.forEach(function (i) {
      expiring.forEach(function (e) { if (norm(i.name).indexOf(e) !== -1 || e.indexOf(norm(i.name)) !== -1) score += 12; });
    });
    const used = (ctx.usedCounts || {})[recipe.id] || 0;
    score -= used * 22;
    const family = ctx.family || [];
    let blocked = false;
    family.forEach(function (p) {
      (p.allergies || []).forEach(function (a) {
        recipe.ingredients.forEach(function (i) { if (norm(i.name).indexOf(norm(a)) !== -1 && a) blocked = blocked; });
      });
    });
    if ((ctx.recentIds || []).indexOf(recipe.id) !== -1) score -= 40;
    return score;
  }
  function pickRecipe(meal, ctx, DATA) {
    const d = DATA || dataRef();
    const pool = d.RECIPES.filter(function (r) { return r.meal === meal; });
    const custom = (ctx.customRecipes || []).filter(function (r) { return r.meal === meal; });
    const all = pool.concat(custom);
    let best = null, bestScore = -Infinity;
    all.forEach(function (r) {
      const s = recipeScore(r, ctx) + Math.random() * 15;
      if (s > bestScore) { bestScore = s; best = r; }
    });
    return best;
  }
  function dateKey(date) {
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), dd = String(date.getDate()).padStart(2, "0");
    return y + "." + m + "." + dd;
  }
  function parseKey(key) { const p = key.split("."); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12); }
  function buildPlan(startKey, numDays, ctx, DATA) {
    const plan = {};
    const recent = [];
    const usedCounts = {};
    for (let i = 0; i < numDays; i++) {
      const dt = parseKey(startKey); dt.setDate(dt.getDate() + i);
      const key = dateKey(dt);
      plan[key] = {};
      ["breakfast", "lunch", "dinner"].forEach(function (meal) {
        const r = pickRecipe(meal, Object.assign({}, ctx, { recentIds: recent.slice(-6), usedCounts: usedCounts }), DATA);
        if (r) { plan[key][meal] = r.id; recent.push(r.id); usedCounts[r.id] = (usedCounts[r.id] || 0) + 1; }
      });
    }
    return plan;
  }
  function reminderTime(eatTime, cookMinutes, setupMinutes) {
    const parts = eatTime.split(":");
    let total = Number(parts[0]) * 60 + Number(parts[1]) - Number(cookMinutes) - Number(setupMinutes);
    if (total < 0) total += 1440;
    const h = Math.floor(total / 60), m = total % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }
  function formatTime(t) {
    const p = t.split(":"); let h = Number(p[0]); const m = p[1];
    const suffix = h >= 12 ? "pm" : "am"; h = h % 12; if (h === 0) h = 12;
    return h + ":" + m + " " + suffix;
  }
  function buildGroceryList(plan, allRecipes, pantry) {
    const need = {};
    Object.keys(plan || {}).forEach(function (day) {
      ["breakfast", "lunch", "dinner"].forEach(function (meal) {
        const id = plan[day][meal]; if (!id) return;
        const r = allRecipes.filter(function (x) { return x.id === id; })[0]; if (!r) return;
        r.ingredients.forEach(function (i) {
          const k = norm(i.name) + "|" + i.unit;
          if (!need[k]) need[k] = { name: i.name, qty: 0, unit: i.unit, category: i.category || "Other" };
          need[k].qty += Number(i.qty) || 0;
        });
      });
    });
    const have = {};
    (pantry || []).forEach(function (p) { have[norm(p.name)] = p; });
    const out = [];
    Object.keys(need).forEach(function (k) {
      const item = need[k];
      const stocked = have[norm(item.name)];
      item.haveIt = !!stocked;
      item.qty = Math.round(item.qty * 10) / 10;
      out.push(item);
    });
    return out.sort(function (a, b) { return (a.category + a.name).localeCompare(b.category + b.name); });
  }
  function findRecipeByName(name, DATA, custom) {
    const d = DATA || dataRef();
    const n = norm(name);
    const all = d.RECIPES.concat(custom || []);
    let exact = all.filter(function (r) { return norm(r.name).indexOf(n) !== -1; })[0];
    if (exact) return exact;
    const words = n.split(/\s+/).filter(function (w) { return w.length > 2; });
    /* Form words describe the shape of a dish, not its identity, so they cannot carry a match on their own. */
    const FORM = ["soup", "salad", "wrap", "wraps", "bowl", "bowls", "and", "with", "the"];
    const keyWords = words.filter(function (w) { return FORM.indexOf(w) === -1; });
    let best = null, bestRatio = 0;
    all.forEach(function (r) {
      const hay = norm(r.name);
      let matched = 0;
      keyWords.forEach(function (w) { if (hay.indexOf(w) !== -1) matched++; });
      const ratio = keyWords.length ? matched / keyWords.length : 0;
      if (ratio > bestRatio) { bestRatio = ratio; best = r; }
    });
    return bestRatio >= 0.6 ? best : null;
  }
  /* --- Calories, from the USDA FoodData Central table in nutrition.js ---
     Unit constants: 1 tbsp counts as 15 g, 1 tsp as 5 g, 1 clove of garlic
     as 3 g. Piece weights (1 egg, 1 medium banana, 1 slice of bread and so
     on) live in the table as PIECE_G. 1 ml counts as 1 g for the liquids in
     these recipes (milk, coconut milk, vegetable stock, tomato passata,
     cream). A recipe with any ingredient missing from the table returns
     null, so the app shows no number rather than a partial fake. */
  function nutritionRef() {
    if (typeof module !== "undefined" && module.exports && typeof require !== "undefined") {
      try { return require("./meals-nutrition-node.js"); } catch (e) { /* fall through */ }
    }
    return (typeof window !== "undefined" ? window : globalThis).MP_NUTRITION;
  }
  function ingredientGrams(ing, nutrition) {
    const q = Number(ing.qty) || 0;
    if (ing.unit === "g" || ing.unit === "ml") return q;
    if (ing.unit === "tbsp") return q * 15;
    if (ing.unit === "tsp") return q * 5;
    if (ing.unit === "cloves") return q * 3;
    if (ing.unit === "pcs" || ing.unit === "slices") {
      const w = nutrition.PIECE_G ? nutrition.PIECE_G[ing.name] : null;
      return (w === null || w === undefined) ? null : q * w;
    }
    return null;
  }
  function round5(x) { return Math.round(x / 5) * 5; }
  function recipeKcal(recipe, nutrition) {
    const n = nutrition || nutritionRef();
    if (!n || !n.KCAL100 || !recipe || !recipe.ingredients || !recipe.servings) return null;
    let total = 0;
    for (let i = 0; i < recipe.ingredients.length; i++) {
      const ing = recipe.ingredients[i];
      const per100 = n.KCAL100[ing.name];
      if (per100 === null || per100 === undefined) return null;
      const g = ingredientGrams(ing, n);
      if (g === null) return null;
      total += g / 100 * per100;
    }
    return round5(total / recipe.servings);
  }
  function servingKcal(grams, per100) { return round5(grams / 100 * per100); }
  function estimateRange(kcal) { return { low: round5(kcal * 0.7), high: round5(kcal * 1.3) }; }
  function photoKcal(className, nutrition) {
    const n = nutrition || nutritionRef();
    if (!n || !n.PHOTO_SERVINGS || !n.KCAL100) return null;
    const s = n.PHOTO_SERVINGS[className];
    if (!s) return null;
    const per100 = n.KCAL100[s.food];
    if (per100 === null || per100 === undefined) return null;
    const kcal = servingKcal(s.grams, per100);
    const r = estimateRange(kcal);
    return { food: s.food, label: s.label, grams: s.grams, kcal: kcal, low: r.low, high: r.high };
  }
  function fridgeKcal(name, nutrition) {
    const n = nutrition || nutritionRef();
    if (!n || !n.FRIDGE_SERVINGS || !n.KCAL100) return null;
    const s = n.FRIDGE_SERVINGS[name];
    if (!s) return null;
    const per100 = n.KCAL100[name];
    if (per100 === null || per100 === undefined) return null;
    const kcal = servingKcal(s.grams, per100);
    const r = estimateRange(kcal);
    return { food: name, label: s.label, grams: s.grams, kcal: kcal, low: r.low, high: r.high };
  }
  function makeRecipeFromName(name, DATA, custom) {
    const found = findRecipeByName(name, DATA, custom || []);
    if (found) return found;
    const stop = ["grandma", "grandmas", "homemade", "easy", "best", "my", "the", "fresh", "quick", "simple"];
    const words = norm(name).split(/\s+/).filter(function (w) { return w.length > 2 && stop.indexOf(w) === -1; });
    /* The main ingredient is the first real food word in the name (lemon in Greek lemon potatoes,
       mushroom in mushroom risotto), never a style word like greek or thai. */
    const FOOD_WORDS = ["mushroom", "tomato", "potato", "potatoes", "quinoa", "falafel", "miso", "lemon", "chicken", "beef", "lamb", "pork", "meat", "pumpkin", "berry", "berries", "apple", "banana", "carrot", "broccoli", "spinach", "cheese", "egg", "eggs", "salmon", "tuna", "prawn", "tofu", "lentil", "lentils", "bean", "beans", "rice", "pasta", "spaghetti", "noodle", "noodles", "oat", "oats", "risotto", "avocado", "corn", "pea", "peas", "zucchini", "capsicum", "onion", "garlic", "ginger", "chilli", "coconut", "peanut", "almond", "walnut", "honey", "yogurt", "milk", "cream", "butter", "flour", "sugar", "chocolate", "coffee", "vanilla", "strawberry", "blueberry", "mango", "pineapple", "watermelon", "cucumber", "lettuce", "cabbage", "cauliflower", "sausage", "bacon", "ham", "turkey", "duck", "fish", "crab", "squid", "seaweed", "kimchi", "curry", "salsa", "pesto", "hummus", "tahini", "couscous", "barley", "millet", "smoothie"];
    const STYLE_WORDS = ["greek", "thai", "indian", "mexican", "italian", "asian", "american", "australian", "mediterranean", "french", "japanese", "korean", "vietnamese", "spanish", "moroccan", "turkish"];
    let main = null;
    for (let i = 0; i < words.length && !main; i++) if (FOOD_WORDS.indexOf(words[i]) !== -1) main = words[i];
    if (!main) {
      const rest = words.filter(function (w) { return STYLE_WORDS.indexOf(w) === -1; });
      if (rest.length && rest[0].length >= 4) main = rest[0];
    }
    function plural(w) {
      const keep = ["rice", "pasta", "sushi", "gnocchi", "couscous", "hummus", "asparagus", "spinach", "broccoli", "cauliflower", "chicken", "miso", "spaghetti", "quinoa", "meat", "beef", "lamb", "pork"];
      if (!w || keep.indexOf(w) !== -1 || /s$/.test(w)) return w;
      if (/(o)$/.test(w)) return w + "es";
      if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
      if (/(ch|sh|x|z)$/.test(w)) return w + "es";
      return w + "s";
    }
    const mainName = main ? plural(main) : "main ingredient of your choice";
    return {
      id: "custom." + Date.now(), name: name, meal: "dinner", cuisines: ["Comfort"], minutes: 30, servings: 2, custom: true,
      ingredients: [
        { name: mainName, qty: 400, unit: "g", category: "Other" },
        { name: "onion", qty: 1, unit: "pcs", category: "Produce" },
        { name: "garlic", qty: 2, unit: "cloves", category: "Produce" },
        { name: "olive oil", qty: 2, unit: "tbsp", category: "Pantry" },
        { name: "rice", qty: 200, unit: "g", category: "Pantry" }
      ],
      steps: ["Prep all ingredients and wash the fresh ones.", "Cook the " + mainName + " in olive oil until golden.", "Add onion and garlic and cook 5 minutes until soft.", "Add a splash of water, cover and simmer 12 minutes.", "Season to taste, rest 3 minutes and serve with rice."]
    };
  }
  const API = { shelfLookup: shelfLookup, shelfDays: shelfDays, expiryFor: expiryFor, daysLeft: daysLeft, sortByExpiry: sortByExpiry, personConflicts: personConflicts, swapFor: swapFor, adaptations: adaptations, recipeScore: recipeScore, pickRecipe: pickRecipe, dateKey: dateKey, parseKey: parseKey, buildPlan: buildPlan, reminderTime: reminderTime, formatTime: formatTime, buildGroceryList: buildGroceryList, findRecipeByName: findRecipeByName, makeRecipeFromName: makeRecipeFromName, recipeKcal: recipeKcal, photoKcal: photoKcal, fridgeKcal: fridgeKcal, ingredientGrams: ingredientGrams };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.MP_LOGIC = API;
})(typeof window !== "undefined" ? window : globalThis);
