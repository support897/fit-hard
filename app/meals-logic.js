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
  /* --- The free maker, hardened (RECIPES-1000-PLAN section 4) ---
     A typed name the library does not have still gets help, free, on the
     device, with no internet. The maker composes a starter recipe ONLY
     from the counted vocabulary: the KCAL100 keys in the nutrition table,
     minus the finished photo foods (pizza, cake, sandwich, donut are
     dishes, not ingredients). Before a made recipe is offered, recipeKcal
     must return a real number for it; a failed count gets ONE repair, and
     a count outside the Fit healthy band for its slot gets ONE recompose,
     then the maker declines in plain words. A name whose main food the
     app cannot count is answered plainly, never invented around. The old
     seed fabricated a recipe around any word at all (its fallback main was
     the literal text "main ingredient of your choice", which no table can
     count); that fabrication is what this hardening removes. */
  var MAKER_BANDS = { breakfast: [200, 650], lunch: [300, 800], dinner: [350, 900] };
  var MAKER_SKIP = { pizza: true, cake: true, sandwich: true, donut: true };
  var MAKER_STOP = ["grandma", "grandmas", "homemade", "easy", "best", "my", "the", "fresh", "quick",
    "simple", "a", "an", "and", "with", "in", "on", "of", "style", "recipe", "dish", "meal", "s"];
  var MAKER_STYLE = { greek: "Greek", thai: "Asian", indian: "Indian", mexican: "Mexican", italian: "Italian",
    asian: "Asian", japanese: "Asian", korean: "Asian", vietnamese: "Asian", spanish: "Mediterranean",
    moroccan: "Mediterranean", turkish: "Mediterranean", mediterranean: "Mediterranean", french: "Mediterranean",
    american: "American", australian: "Australian" };
  /* Food words the maker recognises as a food ask. A word here that does not
     resolve to the counted vocabulary (quinoa, duck, truffle) vetoes the name
     when it leads the dish: the dish is characterised by a food the app
     cannot count, so any recipe built anyway would be a guess wearing the
     name. Words not in this list and not in the vocabulary (dragon, supreme)
     are simply not food asks and are skipped. */
  var MAKER_FOOD_WORDS = ["mushroom", "tomato", "potato", "potatoes", "quinoa", "falafel", "miso", "lemon", "chicken", "beef", "lamb", "pork", "meat", "pumpkin", "berry", "berries", "apple", "banana", "carrot", "broccoli", "spinach", "cheese", "egg", "eggs", "salmon", "tuna", "prawn", "prawns", "tofu", "lentil", "lentils", "bean", "beans", "rice", "pasta", "spaghetti", "noodle", "noodles", "oat", "oats", "avocado", "corn", "pea", "peas", "zucchini", "capsicum", "onion", "garlic", "ginger", "chilli", "coconut", "peanut", "almond", "walnut", "honey", "yogurt", "yoghurt", "milk", "cream", "butter", "flour", "sugar", "chocolate", "coffee", "vanilla", "strawberry", "blueberry", "mango", "pineapple", "watermelon", "cucumber", "lettuce", "cabbage", "cauliflower", "sausage", "bacon", "ham", "turkey", "duck", "fish", "crab", "squid", "seaweed", "kimchi", "curry", "salsa", "pesto", "hummus", "tahini", "couscous", "barley", "millet", "truffle", "lobster", "wagyu", "steak", "venison", "kangaroo", "oyster", "oysters", "scallop", "scallops", "mussels", "clam", "clams", "octopus", "anchovy", "sardines", "trout", "tempeh", "seitan", "edamame", "okra", "eggplant", "aubergine", "cilantro", "coriander", "artichoke", "asparagus", "leek", "leeks", "parsnip", "kale", "fig", "figs", "pear", "peach", "plum", "melon", "grapes", "kiwi", "polenta", "gnocchi"];
  /* Dish form words. The first form word in the name picks the template and
     the slot; the healthy band is checked against that slot. */
  var MAKER_FORMS = [
    { id: "smoothie", words: ["smoothie", "smoothies", "shake", "shakes"], slot: "breakfast", minutes: 5, base: null },
    { id: "porridge", words: ["porridge", "oatmeal"], slot: "breakfast", minutes: 10, base: "rolled oats" },
    { id: "pancakes", words: ["pancake", "pancakes", "hotcakes"], slot: "breakfast", minutes: 20, base: "flour" },
    { id: "eggs", words: ["omelette", "omelet", "frittata", "scrambled"], slot: "lunch", minutes: 15, base: "egg" },
    { id: "risotto", words: ["risotto"], slot: "dinner", minutes: 35, base: "rice" },
    { id: "curry", words: ["curry", "korma", "masala", "tikka"], slot: "dinner", minutes: 30, base: "rice" },
    { id: "stir", words: ["stir"], slot: "dinner", minutes: 25, base: "noodles" },
    { id: "soup", words: ["soup", "stew", "bisque", "broth", "chowder"], slot: "dinner", minutes: 35, base: null },
    { id: "salad", words: ["salad"], slot: "lunch", minutes: 15, base: null },
    { id: "wrap", words: ["wrap", "wraps", "taco", "tacos", "burrito", "burritos"], slot: "lunch", minutes: 20, base: "tortilla" },
    { id: "bowl", words: ["bowl", "bowls"], slot: "lunch", minutes: 25, base: "rice" },
    { id: "sandwich", words: ["sandwich", "toastie", "melt"], slot: "lunch", minutes: 10, base: "bread" },
    { id: "pizza", words: ["pizza", "pizzas"], slot: "dinner", minutes: 25, base: "pizza base" },
    { id: "pasta", words: ["pasta", "spaghetti", "noodle", "noodles", "penne", "macaroni", "linguine", "fettuccine"], slot: "dinner", minutes: 25, base: "pasta" },
    { id: "bake", words: ["bake", "baked", "roast", "roasted", "traybake"], slot: "dinner", minutes: 45, base: null }
  ];
  var MAKER_FORM_DEFAULT = { id: "pan", words: [], slot: "dinner", minutes: 30, base: "rice" };
  var MAKER_ALIAS = { eggs: "egg", potatoes: "potato", tomatoes: "tomato", berries: "mixed berries",
    oats: "rolled oats", oat: "rolled oats", chicken: "chicken breast", beef: "beef mince", pork: "pork mince",
    lamb: "lamb mince", mince: "beef mince", fish: "white fish", shrimp: "prawns", shrimps: "prawns",
    beans: "black beans", bean: "black beans", lentil: "lentils", mushrooms: "mushroom", scallion: "spring onion",
    scallions: "spring onion", garbanzo: "chickpeas", garbanzos: "chickpeas", courgette: "zucchini",
    courgettes: "zucchini", yoghurt: "yogurt", capsicums: "capsicum", pea: "frozen peas", peas: "frozen peas",
    coconut: "coconut milk", oil: "olive oil", noodle: "noodles" };
  /* Flavour foods season a dish; they are never the main when a substantial
     food is named too (Greek lemon potatoes is a potato dish). */
  var MAKER_FLAVOUR = { lemon: true, lime: true, garlic: true, ginger: true, basil: true, parsley: true,
    oregano: true, cinnamon: true, cumin: true, "chilli flakes": true, "smoked paprika": true };
  var MAKER_LEGUMES = { lentils: true, chickpeas: true, "black beans": true, "kidney beans": true };
  /* Plan bases that can honestly be named as the stand in when a named
     food cannot be counted: the staple the dish is built on instead. */
  var MAKER_STAPLE_BASES = ["rice", "noodles", "pasta", "spaghetti", "couscous", "bread", "tortilla", "pizza base", "rolled oats"];
  var MAKER_SMOOTHIE_OK = { banana: true, "mixed berries": true, milk: true, "greek yogurt": true,
    yogurt: true, avocado: true, apple: true, orange: true, spinach: true };
  function makerVocabulary(nutrition) {
    const n = nutrition || nutritionRef();
    if (!n || !n.KCAL100) return [];
    return Object.keys(n.KCAL100).filter(function (k) { return !MAKER_SKIP[k]; });
  }
  function makerPlural(w) {
    const keep = ["rice", "pasta", "sushi", "gnocchi", "couscous", "hummus", "asparagus", "spinach", "broccoli", "cauliflower", "chicken", "miso", "spaghetti", "quinoa", "meat", "beef", "lamb", "pork"];
    if (!w || keep.indexOf(w) !== -1 || /s$/.test(w)) return w;
    if (/(o)$/.test(w)) return w + "es";
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
    if (/(ch|sh|x|z)$/.test(w)) return w + "es";
    return w + "s";
  }
  function makerMatchWord(w, vocab) {
    if (!w) return null;
    if (vocab.indexOf(w) !== -1) return w;
    if (MAKER_ALIAS[w] && vocab.indexOf(MAKER_ALIAS[w]) !== -1) return MAKER_ALIAS[w];
    const p = makerPlural(w);
    if (vocab.indexOf(p) !== -1) return p;
    if (MAKER_ALIAS[p] && vocab.indexOf(MAKER_ALIAS[p]) !== -1) return MAKER_ALIAS[p];
    const singles = [w.replace(/ies$/, "y"), w.replace(/oes$/, "o"), w.replace(/es$/, ""), w.replace(/s$/, "")];
    for (let i = 0; i < singles.length; i++) {
      if (vocab.indexOf(singles[i]) !== -1) return singles[i];
      if (MAKER_ALIAS[singles[i]] && vocab.indexOf(MAKER_ALIAS[singles[i]]) !== -1) return MAKER_ALIAS[singles[i]];
    }
    return null;
  }
  function makerIsFoodWord(w) {
    return MAKER_FOOD_WORDS.indexOf(w) !== -1 || MAKER_FOOD_WORDS.indexOf(makerPlural(w)) !== -1;
  }
  function makerCategory(name, DATA) {
    const d = DATA || dataRef();
    if (d && d.RECIPES) {
      for (let i = 0; i < d.RECIPES.length; i++) {
        const ings = d.RECIPES[i].ingredients || [];
        for (let j = 0; j < ings.length; j++) if (ings[j].name === name && ings[j].category) return ings[j].category;
      }
    }
    return "Other";
  }
  /* Reads a typed name into a build plan: the form, the slot, the main
     counted food and the supporting counted foods. Returns
     { uncountable: true } when the dish leads with a food the app cannot
     count, or names no counted food at all. */
  function makerPlan(name, nutrition) {
    const vocab = makerVocabulary(nutrition);
    if (!vocab.length) return { uncountable: true };
    const text = norm(name);
    const words = text.split(/[^a-z0-9]+/).filter(Boolean);
    const formWords = {};
    MAKER_FORMS.forEach(function (f) { f.words.forEach(function (w) { formWords[w] = f; }); });
    let form = null, cuisine = "Comfort";
    words.forEach(function (w) {
      if (!form && formWords[w]) form = formWords[w];
      if (MAKER_STYLE[w]) cuisine = MAKER_STYLE[w];
    });
    /* Canonical foods named, in name order: multi-word keys first so
       "tomato passata" wins over "tomato", then single words. */
    const matched = [];
    function noteMatch(key, at) { if (key && !matched.some(function (m) { return m.key === key; })) matched.push({ key: key, at: at }); }
    vocab.filter(function (k) { return k.indexOf(" ") !== -1; })
      .sort(function (a, b) { return b.length - a.length; })
      .forEach(function (k) { const at = text.indexOf(k); if (at !== -1) noteMatch(k, at); });
    let cursor = 0;
    const tokens = words.map(function (w) { const at = text.indexOf(w, cursor); cursor = at + w.length; return { w: w, at: at }; });
    tokens.forEach(function (t) { noteMatch(makerMatchWord(t.w, vocab), t.at); });
    matched.sort(function (a, b) { return a.at - b.at; });
    /* The lead ask: the first food word in the name decides. A counted food
       leads fine; a recognised food the table cannot count vetoes the name;
       style, form and filler words never decide. */
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i].w;
      if (MAKER_STOP.indexOf(w) !== -1 || MAKER_STYLE[w] || formWords[w]) continue;
      if (makerMatchWord(w, vocab)) break;
      if (makerIsFoodWord(w)) return { uncountable: true };
    }
    if (!matched.length) return { uncountable: true };
    const substantial = matched.filter(function (m) { return !MAKER_FLAVOUR[m.key]; });
    const main = (substantial[0] || matched[0]).key;
    const extras = matched.filter(function (m) { return m.key !== main; }).map(function (m) { return m.key; }).slice(0, 3);
    if (!form) form = main === "rolled oats" ? MAKER_FORMS[1] : MAKER_FORM_DEFAULT;
    if (form.id === "smoothie" && !MAKER_SMOOTHIE_OK[main]) form = MAKER_FORM_DEFAULT;
    let slot = form.slot;
    if (/\b(breakfast|brunch)\b/.test(text) && (form.id === "eggs" || form.id === "pan")) slot = "breakfast";
    let base = form.base;
    if (form.id === "pasta") base = words.indexOf("spaghetti") !== -1 ? "spaghetti" : (words.indexOf("noodle") !== -1 || words.indexOf("noodles") !== -1) ? "noodles" : "pasta";
    if (form.id === "stir") base = words.indexOf("rice") !== -1 ? "rice" : "noodles";
    /* Named foods the table cannot count, in name order. The lead check
       above already declines a name LED by such a food; a food riding
       along behind a counted lead (the quinoa in "chicken quinoa bowl")
       cannot join the recipe, so the plan records it and the maker card
       can say plainly that it is not in the dish. A word is accounted
       for when it resolves to the counted vocabulary or sits inside a
       matched multi word key. */
    const missing = [];
    tokens.forEach(function (t) {
      const w = t.w;
      if (MAKER_STOP.indexOf(w) !== -1 || MAKER_STYLE[w] || formWords[w]) return;
      if (makerMatchWord(w, vocab)) return;
      /* Covered only when the multi word key itself is written in the
         name (chilli in "chilli flakes"): the matched list also holds
         alias keys whose text never appears in the name (chicken for
         "chicken breast"), and those spans must not swallow the word
         that follows. */
      const covered = vocab.some(function (k) {
        if (k.indexOf(" ") === -1) return false;
        const at = text.indexOf(k);
        return at !== -1 && t.at >= at && t.at < at + k.length;
      });
      if (covered) return;
      if (makerIsFoodWord(w) && missing.indexOf(w) === -1) missing.push(w);
    });
    return { form: form, slot: slot, main: main, extras: extras, cuisine: cuisine, base: base, missing: missing };
  }
  function makerSteps(plan) {
    const m = plan.main, base = plan.base || "rice";
    switch (plan.form.id) {
      case "smoothie": return ["Put the milk, greek yogurt and " + m + " in a blender.", "Add the honey and blend until smooth.", "Pour into glasses and drink it fresh."];
      case "porridge": return ["Put the rolled oats and milk in a small pot.", "Simmer 5 minutes, stirring, until thick and creamy.", "Top with the " + m + " and the honey, and serve warm."];
      case "pancakes": return ["Whisk the flour, egg and milk into a smooth batter.", "Rest the batter 5 minutes while a pan warms.", "Ladle in small pancakes, about 2 minutes a side, in the butter.", "Stack with the " + m + " and the maple syrup, and serve."];
      case "eggs": return ["Whisk the eggs with a pinch of salt.", "Melt the butter and soften the " + m + " for 3 minutes.", "Pour in the eggs and stir gently until just set.", "Fold through the spinach and cheese, and serve right away."];
      case "risotto":
        if (m === "rice") return ["Warm the stock in a small pot and keep it low.", "Cook the onion and garlic in the olive oil until soft.", "Stir in the rice until glossy, then add the stock a ladle at a time, stirring, about 18 minutes, until tender and creamy.", "Rest 2 minutes, stir through the parmesan, and serve."];
        return ["Warm the stock in a small pot and keep it low.", "Cook the onion and garlic in the olive oil until soft.", "Stir in the rice until glossy, then add the stock a ladle at a time, stirring, about 18 minutes.", "Stir in the " + m + " for the last 8 minutes, until the rice is tender.", "Rest 2 minutes, stir through the parmesan, and serve."];
      case "curry": return ["Cook the rice and keep it warm.", "Soften the onion in a pot, then stir in the curry paste for 1 minute.", "Add the " + m + " and the coconut milk and simmer 15 minutes, until the " + m + " is tender.", "Serve over the rice, seasoned the way you like."];
      case "stir": return ["Cook the " + base + " and set aside.", "Slice the " + m + ", capsicum and broccoli into thin pieces.", "Sear the " + m + " in the hot olive oil, then add the vegetables for 4 minutes.", "Add the garlic, ginger and soy sauce, toss through the " + base + ", and serve."];
      case "soup": return ["Chop the " + m + ", potato, carrot and onion into small pieces.", "Warm the olive oil in a big pot and soften the onion for 5 minutes.", "Add everything else with the stock and bring it to a gentle boil.", "Simmer 25 minutes, until the " + m + " is tender.", "Season the way you like and serve hot."];
      case "salad": return ["Cook the " + m + " the way you like it, then slice it.", "Chop the lettuce, cucumber and cherry tomato into a big bowl.", "Whisk the olive oil with the lemon juice and pour it over.", "Top with the " + m + " and the feta, and serve with the bread."];
      case "wrap": return ["Warm the tortillas so they bend without cracking.", "Cook the " + m + " until done, then slice it.", "Chop the lettuce and tomato.", "Fill each tortilla with the " + m + ", lettuce, tomato, cheese and salsa, roll up, and serve."];
      case "bowl": return ["Cook the rice and let it steam for 5 minutes.", "Cook the " + m + " until done, then slice it.", "Grate the carrot and slice the cucumber.", "Bowl up the rice, " + m + " and vegetables, and spoon over the soy sauce."];
      case "sandwich": return ["Slice the tomato and wash the lettuce.", "Spread the mayonnaise on the bread.", "Layer the " + m + ", cheese, lettuce and tomato.", "Close it, cut in half, and serve."];
      case "pizza": return ["Heat the oven as hot as it goes.", "Spread the tomato passata over the pizza base.", "Top with the mozzarella and the " + m + ".", "Bake 10 to 12 minutes, until the cheese bubbles.", "Rest 2 minutes, slice, and serve."];
      case "pasta":
        if (plan.sauceMain) return ["Boil the " + base + " in salted water until just tender, then drain.", "Warm the olive oil and soften the onion and garlic.", "Add the " + m + " and simmer 12 minutes into a sauce.", "Stir through the " + base + ", rest 2 minutes, and serve with parmesan."];
        return ["Boil the " + base + " in salted water until just tender, then drain.", "Cook the " + m + " in the olive oil until golden.", "Add the onion, garlic and crushed tomato and simmer 10 minutes.", "Stir through the " + base + ", rest 2 minutes, and serve with parmesan."];
      case "bake": return ["Heat the oven to 200 degrees.", "Chop the potato, carrot and onion into chunks.", "Toss everything with the olive oil on a big tray, with the " + m + " on top.", "Bake about 35 minutes, until the " + m + " is cooked through and the edges are golden.", "Rest 5 minutes and serve."];
      default: return ["Cook the rice the way you like it, and keep it warm.", "Chop the onion and garlic, and cut the " + m + " into bite size pieces.", "Warm the olive oil in a wide pan and cook the " + m + " until golden.", "Add the onion and garlic and cook 5 minutes until soft.", "Season, rest 3 minutes, and serve over the rice."];
    }
  }
  /* Composes the starter recipe for a plan. Every ingredient comes from
     the counted vocabulary; amounts follow the library's own patterns
     (dry staples by weight, eggs and falafel by the piece, legumes at dry
     starter amounts). */
  function makerCompose(plan, name, DATA) {
    const ings = [], byName = {};
    function add(nm, qty, unit) {
      if (byName[nm]) { if (unit === byName[nm].unit && qty > byName[nm].qty) byName[nm].qty = qty; return byName[nm]; }
      const it = { name: nm, qty: qty, unit: unit, category: makerCategory(nm, DATA) };
      byName[nm] = it; ings.push(it); return it;
    }
    function setMain(grams) {
      const m = plan.main;
      if (MAKER_LEGUMES[m] && grams > 200) grams = 150;
      if (m === "egg") return add("egg", Math.max(2, Math.round(grams / 50)), "pcs");
      if (m === "falafel") return add("falafel", Math.max(4, Math.round(grams / 17)), "pcs");
      return add(m, grams, "g");
    }
    const M = plan.main, F = plan.form.id;
    plan.sauceMain = ["crushed tomato", "tomato passata", "tomato", "cherry tomato", "pesto", "salsa"].indexOf(M) !== -1;
    if (F === "pan") { setMain(300); add("onion", 1, "pcs"); add("garlic", 2, "cloves"); add("olive oil", 1, "tbsp"); add("rice", 160, "g"); }
    else if (F === "pasta") { add(plan.base, 180, "g"); if (plan.sauceMain) { setMain(400); } else { setMain(250); add("crushed tomato", 300, "g"); } add("onion", 1, "pcs"); add("garlic", 2, "cloves"); add("olive oil", 1, "tbsp"); add("parmesan", 20, "g"); }
    else if (F === "risotto") { add("rice", 160, "g"); if (M !== "rice") setMain(250); add("vegetable stock", 500, "ml"); add("onion", 1, "pcs"); add("garlic", 2, "cloves"); add("olive oil", 1, "tbsp"); add("parmesan", 30, "g"); }
    else if (F === "soup") { setMain(300); add("potato", 200, "g"); add("carrot", 120, "g"); add("onion", 1, "pcs"); add("vegetable stock", 600, "ml"); add("olive oil", 1, "tbsp"); }
    else if (F === "salad") { setMain(250); add("lettuce", 100, "g"); add("cucumber", 100, "g"); add("cherry tomato", 150, "g"); add("feta", 40, "g"); add("olive oil", 1, "tbsp"); add("lemon", 0.5, "pcs"); add("bread", 2, "slices"); }
    else if (F === "bowl") { add("rice", 160, "g"); setMain(250); add("carrot", 100, "g"); add("cucumber", 100, "g"); add("soy sauce", 1, "tbsp"); }
    else if (F === "wrap") { add("tortilla", 2, "pcs"); setMain(250); add("lettuce", 60, "g"); add("tomato", 1, "pcs"); add("cheese", 40, "g"); add("salsa", 60, "g"); }
    else if (F === "stir") { add(plan.base, 160, "g"); setMain(280); add("capsicum", 120, "g"); add("broccoli", 150, "g"); add("soy sauce", 2, "tbsp"); add("garlic", 2, "cloves"); add("ginger", 10, "g"); add("olive oil", 1, "tbsp"); }
    else if (F === "curry") { add("rice", 160, "g"); setMain(280); add("coconut milk", 200, "ml"); add("curry paste", 30, "g"); add("onion", 1, "pcs"); }
    else if (F === "smoothie") { add("milk", 300, "ml"); add("greek yogurt", 150, "g"); setMain(150); add("honey", 1, "tbsp"); }
    else if (F === "porridge") { add("rolled oats", 90, "g"); add("milk", 300, "ml"); setMain(120); add("honey", 1, "tbsp"); }
    else if (F === "pancakes") { add("flour", 150, "g"); add("egg", 2, "pcs"); add("milk", 200, "ml"); setMain(100); add("maple syrup", 1, "tbsp"); add("butter", 10, "g"); }
    else if (F === "eggs") { add("egg", 4, "pcs"); setMain(150); add("cheese", 30, "g"); add("spinach", 60, "g"); add("butter", 10, "g"); }
    else if (F === "bake") { setMain(400); add("potato", 300, "g"); add("carrot", 150, "g"); add("onion", 1, "pcs"); add("olive oil", 2, "tbsp"); }
    else if (F === "sandwich") { add("bread", 4, "slices"); setMain(120); add("lettuce", 40, "g"); add("tomato", 0.5, "pcs"); add("mayonnaise", 1, "tbsp"); add("cheese", 30, "g"); }
    else if (F === "pizza") { add("pizza base", 1, "pcs"); add("tomato passata", 100, "g"); add("mozzarella", 100, "g"); setMain(100); }
    /* Supporting foods named in the dish join in starter amounts. Other
       proteins stay out: one main per starter recipe. */
    const LIGHT = { cheese: 40, feta: 40, mozzarella: 60, parmesan: 20, avocado: 1, lemon: 0.5, lime: 0.5, salsa: 40, pesto: 40, olives: 40 };
    plan.extras.forEach(function (ex) {
      if (byName[ex]) return;
      if (LIGHT[ex] !== undefined) { add(ex, LIGHT[ex], ex === "avocado" || ex === "lemon" || ex === "lime" ? "pcs" : "g"); return; }
      if (MAKER_FLAVOUR[ex]) { add(ex, 10, "g"); return; }
      if (["pan", "salad", "bowl", "soup", "bake"].indexOf(F) !== -1) add(ex, 100, "g");
    });
    return { id: "custom." + Date.now(), name: String(name), meal: plan.slot, cuisines: [plan.cuisine],
      minutes: plan.form.minutes, servings: 2, custom: true, ingredients: ings, steps: makerSteps(plan) };
  }
  function makerAssert(recipe, nutrition) {
    const k = recipeKcal(recipe, nutrition || nutritionRef());
    return (typeof k === "number" && isFinite(k) && k > 0) ? k : null;
  }
  /* The ONE count repair: ingredients the table cannot price are dropped
     (unless one is the main, where dropping would fake the dish), and
     piece servings the table cannot weigh are weighed instead. Returns
     null when the count still cannot be made honestly. */
  function makerCountRepair(recipe, plan, nutrition) {
    const n = nutrition || nutritionRef();
    const r = JSON.parse(JSON.stringify(recipe));
    let mainBad = false;
    const kept = [];
    r.ingredients.forEach(function (it) {
      const per = n && n.KCAL100 ? n.KCAL100[it.name] : undefined;
      if (!(typeof per === "number" && isFinite(per))) { if (it.name === plan.main) mainBad = true; return; }
      if (ingredientGrams(it, n) === null) {
        const w = n.PIECE_G && n.PIECE_G[it.name];
        it.qty = Math.max(10, Math.round((Number(it.qty) || 1) * (w || 50)));
        it.unit = "g";
      }
      kept.push(it);
    });
    if (mainBad || !kept.length) return null;
    r.ingredients = kept;
    const k = makerAssert(r, n);
    return k === null ? null : { recipe: r, kcal: k };
  }
  /* The ONE band repair: amounts scale toward the band middle, the
     richest non-main, non-base gram ingredient can be dropped, and an
     under-band dish gains base. Then the caller judges the result. */
  function makerBandRepair(recipe, plan, nutrition, DATA) {
    const n = nutrition || nutritionRef();
    const band = MAKER_BANDS[recipe.meal], mid = (band[0] + band[1]) / 2;
    const r = JSON.parse(JSON.stringify(recipe));
    let k = recipeKcal(r, n);
    if (typeof k !== "number" || !(k > 0)) return { recipe: r, kcal: null };
    const factor = Math.min(2, Math.max(0.55, mid / k));
    r.ingredients.forEach(function (it) { if (it.unit === "g") it.qty = Math.max(10, Math.round(it.qty * factor / 5) * 5); });
    k = recipeKcal(r, n);
    let guard = 0;
    while (typeof k === "number" && k > band[1] && guard < 2) {
      let rich = null, richK = -1;
      r.ingredients.forEach(function (it) {
        if (it.unit !== "g" || it.name === plan.main || it.name === plan.base) return;
        const kk = (Number(it.qty) || 0) / 100 * (n.KCAL100[it.name] || 0);
        if (kk > richK) { richK = kk; rich = it; }
      });
      if (!rich) break;
      r.ingredients = r.ingredients.filter(function (x) { return x !== rich; });
      k = recipeKcal(r, n); guard++;
    }
    if (typeof k === "number" && k < band[0]) {
      const staple = r.ingredients.filter(function (it) { return ["rice", "pasta", "spaghetti", "noodles", "couscous"].indexOf(it.name) !== -1; })[0];
      if (staple) staple.qty += 120;
      else {
        const br = r.ingredients.filter(function (it) { return it.name === "bread"; })[0];
        if (br && br.unit === "slices") br.qty += 2;
        else r.ingredients.push({ name: "rice", qty: 120, unit: "g", category: makerCategory("rice", DATA) });
      }
      k = recipeKcal(r, n);
    }
    return { recipe: r, kcal: (typeof k === "number" && k > 0) ? k : null };
  }
  /* The maker door. Returns one of:
     { status: "found", recipe, kcal }        the library or the user's own recipes already have it
     { status: "made", recipe, kcal, missing, standin }
                                              composed, counted, in band (kcal null only when the
                                              count repair could not price the main; the surface
                                              then shows the honest no count yet chip). missing
                                              names the foods the typed name asked for that the
                                              table cannot count, so they are not in the recipe;
                                              standin names the staple base the dish is built
                                              on instead, or null when there is none.
     { status: "declined", kcal, slot, band } counted but outside the healthy band after one repair
     { status: "uncountable" }                the name leads with a food the app cannot count */
  function buildRecipeFromName(name, DATA, custom, nutrition) {
    const d = DATA || dataRef();
    const n = nutrition || nutritionRef();
    const found = findRecipeByName(name, d, custom || []);
    if (found) return { status: "found", recipe: found, kcal: recipeKcal(found, n) };
    const plan = makerPlan(name, n);
    if (plan.uncountable) return { status: "uncountable", recipe: null, kcal: null };
    function madeResult(recipe, kcal) {
      let standin = null;
      if (plan.base && MAKER_STAPLE_BASES.indexOf(plan.base) !== -1 &&
        recipe.ingredients.some(function (i) { return i.name === plan.base; })) standin = plan.base;
      return { status: "made", recipe: recipe, kcal: kcal, missing: plan.missing || [], standin: standin };
    }
    let recipe = makerCompose(plan, name, d);
    let kcal = makerAssert(recipe, n);
    if (kcal === null) {
      const fixed = makerCountRepair(recipe, plan, n);
      if (fixed) { recipe = fixed.recipe; kcal = fixed.kcal; }
      else return madeResult(recipe, null);
    }
    const band = MAKER_BANDS[recipe.meal];
    if (kcal < band[0] || kcal > band[1]) {
      const rep = makerBandRepair(recipe, plan, n, d);
      recipe = rep.recipe; kcal = rep.kcal;
      if (kcal === null) return madeResult(recipe, null);
      if (kcal < band[0] || kcal > band[1]) return { status: "declined", recipe: null, kcal: kcal, slot: recipe.meal, band: band };
    }
    return madeResult(recipe, kcal);
  }
  function makeRecipeFromName(name, DATA, custom) {
    const r = buildRecipeFromName(name, DATA, custom || [], null);
    return (r.status === "found" || r.status === "made") ? r.recipe : null;
  }
  const API = { shelfLookup: shelfLookup, shelfDays: shelfDays, expiryFor: expiryFor, daysLeft: daysLeft, sortByExpiry: sortByExpiry, personConflicts: personConflicts, swapFor: swapFor, adaptations: adaptations, recipeScore: recipeScore, pickRecipe: pickRecipe, dateKey: dateKey, parseKey: parseKey, buildPlan: buildPlan, reminderTime: reminderTime, formatTime: formatTime, buildGroceryList: buildGroceryList, findRecipeByName: findRecipeByName, makeRecipeFromName: makeRecipeFromName, buildRecipeFromName: buildRecipeFromName, makerVocabulary: makerVocabulary, makerBands: MAKER_BANDS, recipeKcal: recipeKcal, photoKcal: photoKcal, fridgeKcal: fridgeKcal, ingredientGrams: ingredientGrams };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.MP_LOGIC = API;
})(typeof window !== "undefined" ? window : globalThis);
