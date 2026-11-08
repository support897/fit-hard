"use strict";
/* Fit Hard allergen + diet matching (Phase 2). Hard-exclusion layer.
   Rules: (1) every library ingredient has a curated tag set, conservative:
   "may contain" cases (pesto, granola, noodles, stock...) count as hits.
   (2) free-text ingredient names (custom recipes) are scanned with word-boundary
   keywords. (3) a user's typed term is resolved to allergen/diet keys through
   a synonym table (plural, "-free", "intolerant", "allergy" all handled); a term
   that is not recognised falls back to matching the ingredient NAME only, and the
   app says so out loud (unresolved()). (4) nothing here ever relaxes a constraint.
   This is a food-organisation aid, not medical advice: labels must still be read. */
(function (root) {
  var LABEL = { milk: "milk", egg: "egg", gluten: "gluten", soy: "soy", peanut: "peanut", tree_nut: "tree nuts",
    sesame: "sesame", fish: "fish", shellfish: "shellfish", meat: "meat", pork: "pork", beef: "beef", lamb: "lamb",
    chicken: "chicken", honey: "honey" };
  var CURATED = {
    "avocado": [],
    "lemon": [],
    "chilli flakes": [],
    "mixed berries": [],
    "chia seeds": [],
    "spinach": [],
    "tomato": [],
    "olive oil": [],
    "banana": [],
    "cinnamon": [],
    "crushed tomato": [],
    "capsicum": [],
    "onion": [],
    "cumin": [],
    "lettuce": [],
    "cucumber": [],
    "red onion": [],
    "olives": [],
    "rice": [],
    "corn": [],
    "black beans": [],
    "cherry tomato": [],
    "basil": [],
    "frozen peas": [],
    "carrot": [],
    "spring onion": [],
    "cabbage": [],
    "lime": [],
    "potato": [],
    "zucchini": [],
    "oregano": [],
    "broccoli": [],
    "garlic": [],
    "coconut milk": [],
    "sweet potato": [],
    "ginger": [],
    "parsley": [],
    "kidney beans": [],
    "smoked paprika": [],
    "tomato passata": [],
    "garam masala": [],
    "mushroom": [],
    "celery": [],
    "chickpeas": [],
    "lentils": [],
    "beetroot": [],
    "pumpkin": [],
    "green beans": [],
    "sugar": [],
    "cauliflower": [],
    "orange": [],
    "apple": [],
    "butter": ["milk"], "cheese": ["milk"], "cream": ["milk"], "feta": ["milk"], "greek yogurt": ["milk"], "halloumi": ["milk"],
    "milk": ["milk"], "mozzarella": ["milk"], "parmesan": ["milk"], "ricotta": ["milk"], "sour cream": ["milk"],
    "pesto": ["milk", "tree_nut"], "granola": ["gluten", "tree_nut", "peanut"], "mayonnaise": ["egg"],
    "egg": ["egg"], "pasta": ["gluten", "egg"], "spaghetti": ["gluten", "egg"], "noodles": ["gluten", "egg", "soy"],
    "bread": ["gluten", "sesame", "milk", "egg", "soy"], "breadcrumbs": ["gluten", "milk", "egg", "soy"],
    "pita bread": ["gluten", "sesame"], "pizza base": ["gluten", "milk"], "tortilla": ["gluten"], "taco shells": ["gluten"],
    "couscous": ["gluten"], "flour": ["gluten"], "rolled oats": ["gluten"], "soy sauce": ["soy", "gluten"],
    "tofu": ["soy"], "falafel": ["gluten", "sesame"], "peanut butter": ["peanut"], "pine nuts": ["tree_nut"],
    "salmon": ["fish"], "tuna": ["fish"], "white fish": ["fish"], "prawns": ["shellfish"],
    "bacon": ["meat", "pork"], "ham": ["meat", "pork"], "salami": ["meat", "pork"], "pork mince": ["meat", "pork"],
    "beef mince": ["meat", "beef"], "beef strips": ["meat", "beef"], "lamb mince": ["meat", "lamb"],
    "chicken breast": ["meat", "chicken"], "chicken thigh": ["meat", "chicken"], "honey": ["honey"],
    "curry paste": ["fish", "shellfish", "soy", "gluten", "peanut"], "taco seasoning": ["gluten"],
    "vegetable stock": ["gluten", "soy", "milk"], "baking powder": ["gluten"], "maple syrup": [], "salsa": []
  };
  /* word-boundary keyword scan for names the table does not know (custom recipes) */
  var KEYS = {
    milk: /\b(milk|cheese|butter|cream|yogh?urt|ghee|whey|casein|custard|halloumi|feta|mozzarella|parmesan|ricotta|paneer|cheddar|brie|labneh|kefir|ice cream)\b/,
    egg: /\b(eggs?|mayonnaise|mayo|meringue|aioli|omelette?)\b/,
    gluten: /\b(wheat|flour|bread|breadcrumbs?|pasta|spaghetti|noodles?|couscous|barley|rye|semolina|bulgur|farro|tortilla|pita|pizza|cracker|biscuit|cake|oats?|granola|soy sauce|seitan|panko|bun|roll|wrap|crumb)\b/,
    soy: /\b(soy|soya|soybeans?|tofu|tempeh|edamame|miso|tamari)\b/,
    peanut: /\b(peanuts?|groundnuts?|satay)\b/,
    tree_nut: /\b(almonds?|walnuts?|cashews?|pecans?|hazelnuts?|pistachios?|macadamias?|brazil nuts?|pine nuts?|nuts?|marzipan|praline|nutella|pesto)\b/,
    sesame: /\b(sesame|tahini|hummus|falafel)\b/,
    fish: /\b(fish|salmon|tuna|cod|haddock|sardines?|anchov(y|ies)|trout|mackerel|tilapia|barramundi|snapper|fish sauce)\b/,
    shellfish: /\b(prawns?|shrimps?|crabs?|lobsters?|crayfish|scallops?|mussels?|oysters?|clams?|squid|calamari|shellfish)\b/,
    pork: /\b(pork|bacon|ham|salami|prosciutto|chorizo|pancetta|sausages?)\b/,
    beef: /\b(beef|steak|brisket|veal)\b/,
    lamb: /\b(lamb|mutton)\b/,
    chicken: /\b(chicken|turkey)\b/,
    honey: /\b(honey)\b/
  };
  var PLANT = /\b(almond|oat|soy|soya|rice|coconut|cashew|hazelnut|cocoa|cacao|peanut)\s+(milk|cream|butter|yogh?urt)\b/;
  function norm(s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function uniq(a) { var o = [], i; for (i = 0; i < a.length; i++) if (o.indexOf(a[i]) === -1) o.push(a[i]); return o; }
  function tagsOfName(name) {
    var n = norm(name); if (!n) return [];
    var out = (CURATED[n] || []).slice();
    var noPlant = PLANT.test(n) ? n.replace(PLANT, " ") : n;
    Object.keys(KEYS).forEach(function (k) { if (KEYS[k].test(k === "milk" ? noPlant : n)) out.push(k); });
    if (/\bpeanut butter\b/.test(n)) out = out.filter(function (t) { return t !== "milk"; });
    if (out.indexOf("pork") !== -1 || out.indexOf("beef") !== -1 || out.indexOf("lamb") !== -1 || out.indexOf("chicken") !== -1 ||
        /\b(meat|mince|sausage|burger)\b/.test(n)) out.push("meat");
    return uniq(out);
  }
  /* user term -> {keys:[..], kind:'allergen'|'diet'|'name', name:'normalised'} */
  var SYN = [
    [/^(peanut|groundnut|monkey nut)s?$/, ["peanut"]],
    [/^tree nuts?$/, ["tree_nut"]], [/^nuts?$/, ["tree_nut", "peanut"]],
    [/^(almond|walnut|cashew|pecan|hazelnut|pistachio|macadamia|brazil nut|pine nut)s?$/, ["tree_nut"]],
    [/^(milk|dairy|lactose|cow s milk|cows milk|casein|whey|lactose intolerance)$/, ["milk"]],
    [/^(cheese|butter|cream|yogh?urt)s?$/, ["milk"]],
    [/^eggs?$/, ["egg"]], [/^(gluten|wheat|coeliac|celiac|coeliac disease|barley|rye)$/, ["gluten"]],
    [/^(soy|soya|soy bean|soya bean|soybean)s?$/, ["soy"]], [/^(sesame|tahini)( seeds?)?$/, ["sesame"]],
    [/^(fish|salmon|tuna|cod)$/, ["fish"]], [/^(shellfish|crustaceans?|prawns?|shrimps?|crabs?|lobsters?)$/, ["shellfish"]],
    [/^(seafood)$/, ["fish", "shellfish"]],
    [/^(pork|bacon|ham)$/, ["pork"]], [/^(beef)$/, ["beef"]], [/^(lamb)$/, ["lamb"]], [/^(chicken)$/, ["chicken"]],
    [/^(meat)$/, ["meat"]], [/^(honey)$/, ["honey"]]
  ];
  var DIET = [
    [/^vegetarian$/, ["meat", "fish", "shellfish"]], [/^vegan$/, ["meat", "fish", "shellfish", "milk", "egg", "honey"]],
    [/^pescatarian$/, ["meat"]]
  ];
  function strip(t) {
    t = norm(t).replace(/\b(allergy|allergic to|allergic|intolerance|intolerant|avoid|no|free|sensitivity|sensitive to|dislike|dislikes|i m|im|cant eat|can t eat)\b/g, " ");
    return t.replace(/\s+/g, " ").trim();
  }
  function resolveTerm(term) {
    var raw = norm(term); if (!raw) return null;
    var t = strip(term) || raw, i;
    for (i = 0; i < DIET.length; i++) if (DIET[i][0].test(t)) return { keys: DIET[i][1], kind: "diet", name: t };
    for (i = 0; i < SYN.length; i++) if (SYN[i][0].test(t)) return { keys: SYN[i][1], kind: "allergen", name: t };
    /* "gluten free" typed as a diet means: avoid gluten */
    return { keys: [], kind: "name", name: t };
  }
  function singular(w) { return w.replace(/(ies)$/, "y").replace(/(es)$/, function (m, a, off, s) { return /(ch|sh|x|s|o)es$/.test(s) ? "" : "e"; }).replace(/s$/, ""); }
  function nameHit(ingredientName, name) {
    var n = " " + norm(ingredientName) + " ", t = norm(name); if (!t) return false;
    var forms = uniq([t, singular(t), t + "s"]);
    return forms.some(function (f) { return f && n.indexOf(" " + f + " ") !== -1 || (f.length > 3 && n.indexOf(f) !== -1); });
  }
  function resolveAll(terms) { return (terms || []).map(resolveTerm).filter(Boolean); }
  function hits(ingredientName, terms) {
    var tags = tagsOfName(ingredientName), res = resolveAll(terms);
    return res.some(function (r) {
      if (r.keys.some(function (k) { return tags.indexOf(k) !== -1; })) return true;
      return r.kind === "name" && nameHit(ingredientName, r.name);
    });
  }
  function recipeFlags(recipe) {
    var all = [];
    ((recipe && recipe.ingredients) || []).forEach(function (i) { all = all.concat(tagsOfName(i.name)); });
    return uniq(all).filter(function (t) { return ["meat", "pork", "beef", "lamb", "chicken", "honey"].indexOf(t) === -1; });
  }
  function recipeConflicts(recipe, terms) {
    var out = [];
    ((recipe && recipe.ingredients) || []).forEach(function (i) { if (hits(i.name, terms) && out.indexOf(i.name) === -1) out.push(i.name); });
    return out;
  }
  function unresolved(terms) { return resolveAll(terms).filter(function (r) { return r.kind === "name"; }).map(function (r) { return r.name; }); }
  function label(tag) { return LABEL[tag] || tag; }
  var api = { tagsOfName: tagsOfName, resolveTerm: resolveTerm, resolveAll: resolveAll, hits: hits, recipeFlags: recipeFlags,
    recipeConflicts: recipeConflicts, unresolved: unresolved, label: label, CURATED: CURATED };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitAllergens = api;
})(typeof window !== "undefined" ? window : globalThis);
