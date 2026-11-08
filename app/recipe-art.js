"use strict";
/* Fit Hard recipe illustrations (Phase 2). Every library recipe gets a calm,
   deterministic plate drawn from ITS OWN ingredients (colour per ingredient, layout
   from the recipe id). These are illustrations, not photographs, and the app says so.
   Recipes that carry a user photo (r.picture) keep that photo. Output is an SVG data URI. */
(function (root) {
  var COL = { "egg": "#F6D77A", "bread": "#D9A867", "pita bread": "#E3B77A", "tortilla": "#E8C990", "taco shells": "#E0A945", "pizza base": "#E8C27F",
    "pasta": "#EFD98B", "spaghetti": "#EFD98B", "noodles": "#EBD390", "couscous": "#EBD7A0", "rice": "#F4EEDC", "rolled oats": "#DCC9A3", "granola": "#C99A5B", "flour": "#F1E8D5",
    "chicken breast": "#E8C9A0", "chicken thigh": "#D9A26A", "beef mince": "#8A5A44", "beef strips": "#8F5A45", "lamb mince": "#8C5B4B", "pork mince": "#C98E78", "bacon": "#C0624F", "ham": "#E39C96", "salami": "#A94B45",
    "salmon": "#EE8F73", "tuna": "#D98B85", "white fish": "#F1E6D3", "prawns": "#F2A27F", "tofu": "#F3EAD2", "falafel": "#A98253",
    "tomato": "#D8483C", "cherry tomato": "#D8483C", "crushed tomato": "#B8392F", "tomato passata": "#B8392F", "salsa": "#C8402F", "capsicum": "#E0663A", "onion": "#E7D2E2", "red onion": "#B5679A", "spring onion": "#8DB360",
    "garlic": "#F3EBDD", "ginger": "#E2BF7C", "carrot": "#EF923A", "sweet potato": "#E1853F", "pumpkin": "#E9983C", "potato": "#E8D3A0", "broccoli": "#4F8A4F", "cauliflower": "#F1EEDF", "spinach": "#3F7A47",
    "lettuce": "#8FBF6A", "cabbage": "#A4C98A", "cucumber": "#7DB26B", "zucchini": "#6FA25A", "green beans": "#5E9A53", "frozen peas": "#7DBE63", "corn": "#F2CB4A", "avocado": "#7FAE54", "mushroom": "#C8B49A", "beetroot": "#8C2F52",
    "celery": "#A8CC87", "olives": "#5D6244", "lemon": "#F4E36A", "lime": "#A9D26B", "orange": "#F2A03D", "apple": "#D95B4F", "banana": "#F1D85C", "mixed berries": "#8A3F78",
    "black beans": "#3F3A38", "kidney beans": "#8A2F2E", "chickpeas": "#DDBE7F", "lentils": "#B98B52", "cheese": "#F4C752", "feta": "#F7F2E4", "mozzarella": "#F8F3E6", "halloumi": "#F2E5C0", "parmesan": "#F0DDA5", "ricotta": "#F7F3EA",
    "greek yogurt": "#FBF8F0", "sour cream": "#FAF6EC", "cream": "#F9F2E2", "milk": "#FCFAF4", "butter": "#F4DD7A", "mayonnaise": "#F6EED2", "pesto": "#6D9A45", "curry paste": "#C95B2E", "soy sauce": "#4A2E22",
    "honey": "#E7A93A", "maple syrup": "#B8741F", "peanut butter": "#B98445", "chia seeds": "#4A433E", "pine nuts": "#EEDDB0", "basil": "#4E8F47", "parsley": "#5E9B4C", "oregano": "#7C8F4A", "cinnamon": "#A5622F", "cumin": "#B98A4A",
    "smoked paprika": "#B5452F", "chilli flakes": "#C3322A", "garam masala": "#B27A3A", "taco seasoning": "#B8662F", "olive oil": "#C8B24A", "vegetable stock": "#CDB27A", "coconut milk": "#F6F1E4", "sugar": "#F5F0E6", "baking powder": "#EFEBE3", "breadcrumbs": "#D2A768", "pizza": "#E8C27F" };
  var CAT = { Produce: "#7DB26B", Dairy: "#F4E7B8", Bakery: "#D9A867", Pantry: "#C79A5E", Meat: "#C98068", Frozen: "#9CC2D6" };
  var MEALBG = { breakfast: ["#FCEBC8", "#F7D9A4"], lunch: ["#E3EEDB", "#CFE1C6"], dinner: ["#E7E1D4", "#D6CDBB"] };
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rnd(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function colorOf(ing) { return COL[String(ing.name).toLowerCase()] || CAT[ing.category] || "#C9B79A"; }
  var SKIP = { "olive oil": 1, "sugar": 1, "baking powder": 1, "flour": 1, "cumin": 1, "cinnamon": 1, "smoked paprika": 1, "chilli flakes": 1, "garam masala": 1, "taco seasoning": 1, "oregano": 1, "vegetable stock": 1, "soy sauce": 1 };
  function svgFor(recipe) {
    var ings = (recipe.ingredients || []).filter(function (i) { return !SKIP[String(i.name).toLowerCase()]; });
    if (!ings.length) ings = recipe.ingredients || [];
    var big = ings.slice().sort(function (a, b) { return (Number(b.qty) || 0) * (b.unit === "g" || b.unit === "ml" ? 1 : 40) - (Number(a.qty) || 0) * (a.unit === "g" || a.unit === "ml" ? 1 : 40); }).slice(0, 6);
    var r = rnd(hash(recipe.id || recipe.name)), bg = MEALBG[recipe.meal] || MEALBG.dinner;
    var p = [];
    p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" role="img" aria-hidden="true">');
    p.push('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></linearGradient></defs>');
    p.push('<rect width="240" height="150" fill="url(#g)"/>');
    p.push('<ellipse cx="120" cy="82" rx="86" ry="56" fill="#000" opacity=".07"/>');
    p.push('<ellipse cx="120" cy="76" rx="84" ry="56" fill="#FFFDF7" stroke="#E4D3B8" stroke-width="3"/>');
    p.push('<ellipse cx="120" cy="76" rx="62" ry="40" fill="none" stroke="#EFE5D2" stroke-width="2"/>');
    big.forEach(function (ing, i) {
      var col = colorOf(ing), n = 3 + Math.floor(r() * 3);
      for (var k = 0; k < n; k++) {
        var ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 44;
        var x = 120 + Math.cos(ang) * rad * 1.15, y = 76 + Math.sin(ang) * rad * .72, sz = 7 + r() * 8 - i * .4;
        if (i % 3 === 1) p.push('<rect x="' + (x - sz).toFixed(1) + '" y="' + (y - sz * .6).toFixed(1) + '" width="' + (sz * 2).toFixed(1) + '" height="' + (sz * 1.2).toFixed(1) + '" rx="' + (sz * .4).toFixed(1) + '" fill="' + col + '" transform="rotate(' + Math.round(r() * 80 - 40) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>');
        else if (i % 3 === 2) p.push('<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (sz * 1.2).toFixed(1) + '" ry="' + (sz * .6).toFixed(1) + '" fill="' + col + '" transform="rotate(' + Math.round(r() * 160 - 80) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>');
        else p.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + sz.toFixed(1) + '" fill="' + col + '"/>');
      }
    });
    p.push('</svg>');
    return p.join("");
  }
  var cache = {};
  function artFor(recipe) {
    if (!recipe) return "";
    if (recipe.picture) return recipe.picture;
    var k = recipe.id || recipe.name;
    if (!cache[k]) cache[k] = "data:image/svg+xml;utf8," + encodeURIComponent(svgFor(recipe));
    return cache[k];
  }
  var api = { artFor: artFor, svgFor: svgFor, COL: COL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FitRecipeArt = api;
})(typeof window !== "undefined" ? window : globalThis);
