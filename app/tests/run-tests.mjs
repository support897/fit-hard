import { createRequire } from "module";
const require = createRequire(import.meta.url);
const L = require("../logic.js");
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name); } }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* dates */
check("todayKey shape", /^\d{4}-\d{2}-\d{2}$/.test(L.todayKey(new Date(2026, 9, 14))));
check("addDays over month edge", L.addDays("2026-01-31", 1) === "2026-02-01");
check("addDays back", L.addDays("2026-03-01", -1) === "2026-02-28");

/* budget: Mifflin-St Jeor, female 82kg 168cm age 34
   BMR = 820 + 1050 - 170 - 161 = 1539 -> round10 1540
   some activity x1.375 = 2117.5 -> maintenance 2120
   gentle target = 2120 - 250 = 1870 */
const b = L.estimateBudget({ weightKg: 82, heightCm: 168, age: 34, formulaSex: "female", activity: "some", deficit: "gentle" });
check("budget bmr", b && b.bmr === 1540);
check("budget maintenance", b && b.maintenance === 2120);
check("budget gentle target", b && b.target === 1870);
check("budget null without age", L.estimateBudget({ weightKg: 82, heightCm: 168 }) === null);
check("budget null without formula sex", L.estimateBudget({ weightKg: 82, heightCm: 168, age: 34 }) === null);
check("budget floor 1200 holds", L.estimateBudget({ weightKg: 45, heightCm: 150, age: 60, formulaSex: "female", activity: "low", deficit: "steady" }).target >= 1200);
const bm = L.estimateBudget({ weightKg: 90, heightCm: 180, age: 40, formulaSex: "male", activity: "lots", deficit: "none" });
check("budget male no deficit = maintenance", bm && bm.target === bm.maintenance);

/* check-in adaptation */
check("bad gives treat room + lighter gym + essentials",
  eq(L.adaptForCheckin("bad"), { level: "bad", calendarMode: "essentials", gymMode: "lighter", treatRoomKcal: 150, stretch: false }));
check("great gives stretch", L.adaptForCheckin("great").stretch === true);
check("unknown level defaults to ok", L.adaptForCheckin("whatever").level === "ok");
const day = L.mealBudgetFor("bad", b);
check("bad day meal budget leaves treat room", day.meals === 1720 && day.treatRoom === 150 && day.total === 1870);
check("steady day meal budget is full target", L.mealBudgetFor("steady", b).meals === 1870);

/* needs -> areas */
check("calories need lights meals only", eq(L.areasForNeeds(["calories"]).active, ["meals"]));
check("needs keep house order peptides first", eq(L.areasForNeeds(["gym", "peptides"]).active, ["peptides", "gym"]));
check("no needs means the four show (never a dead home)", eq(L.areasForNeeds([]).active, ["peptides", "meals", "gym", "calendar"]) && L.areasForNeeds([]).later.length === 0);
check("missing needs means the four show too", L.areasForNeeds(undefined).active.length === 4);

/* peptides */
check("next colour skips used", L.nextColor(["#52695A", "#AC9278"]) === "#7A8B6F");
const pepDays = { schedule: { days: [3] } }; /* Wednesday */
check("next dose same day counts", L.nextDoseKey(pepDays, "2026-10-14") === "2026-10-14"); /* 14 Oct 2026 is a Wednesday */
check("next dose rolls to next week", L.nextDoseKey(pepDays, "2026-10-15") === "2026-10-21");
const pepInt = { schedule: { intervalDays: 7, startKey: "2026-10-05" } };
check("interval dose on cycle", L.nextDoseKey(pepInt, "2026-10-12") === "2026-10-12");
check("interval dose off cycle", L.nextDoseKey(pepInt, "2026-10-13") === "2026-10-19");
check("interval dose before start is start", L.nextDoseKey(pepInt, "2026-10-01") === "2026-10-05");
check("broken schedule is null, not a guess", L.nextDoseKey({ schedule: {} }, "2026-10-14") === null);
check("disclaimer agreed only with timestamp", !L.disclaimerAgreed({}) && L.disclaimerAgreed({ disclaimer: { agreedAt: "2026-10-14T00:00:00.000Z" } }));

/* habits streaks (ported from Pace) */
const st = L.streakInfo({ "2026-10-12": true, "2026-10-13": true }, "2026-10-14");
check("streak alive from yesterday", st.current === 2);
check("streak last7 length", st.last7.length === 7);
check("streak today ticked counts today", L.streakInfo({ "2026-10-14": true, "2026-10-13": true }, "2026-10-14").current === 2);

/* messy-note parser (ported from Pace) */
const q = L.parseQuickNote("gym tomorrow at 6pm", "2026-10-14");
check("quick note parses date + time + title", q && q.date === "2026-10-15" && q.time === "18:00" && q.title === "Gym");
const dump = L.parseQuickDump("take dose friday; walk the dog", "2026-10-14");
check("quick dump splits into two", dump.length === 2 && dump[0].date === "2026-10-16");
check("quick note too short is null", L.parseQuickNote("x", "2026-10-14") === null);

/* repair never drops */
const broken = { profile: { name: 42, needs: "gym" },
  treats: [{ name: "Cake" }, 7, { id: "t9", name: "Pie", kcal: "lots" }],
  peptides: [{ name: "Pep A" }, null],
  todos: [{ title: "Thing" }, {}],
  habits: [{ name: "Water", days: "nope" }],
  disclaimer: { agreedAt: 5 } };
const r = L.repairState(broken);
check("repair keeps every treat", r.treats.length === 3);
check("repair keeps every peptide", r.peptides.length === 2);
check("repair keeps every todo", r.todos.length === 2);
check("repair fixes bad name types", r.treats[0].name === "Cake" && r.peptides[0].name === "Pep A");
check("repair bad kcal becomes null not fake", r.treats[2].kcal === null);
check("repair bad disclaimer does not count as agreed", !L.disclaimerAgreed(r));
check("repair of nothing is an empty state", L.repairState(null).profile === null && L.repairState(null).todos.length === 0);
/* QA Phase 8 F1 class: settings is carried through repair, never whitelist-rebuilt. */
check("repair keeps settings.wallyOff across loads", L.repairState({ settings: { wallyOff: true } }).settings.wallyOff === true);
check("repair still carries a legacy guide key (never dropped)", L.repairState({ settings: { mossOff: true } }).settings.mossOff === true);
check("repair keeps Wally celebration flags", (() => { const s = L.repairState({ settings: { wally: { plan: true, dose: true } } }).settings; return s.wally.plan === true && s.wally.dose === true; })());
check("repair keeps an unknown future settings key", L.repairState({ settings: { futureKey: "x" } }).settings.futureKey === "x");
check("repair still coerces notifications to boolean", L.repairState({ settings: { notifications: "yes" } }).settings.notifications === true && L.repairState({ settings: {} }).settings.notifications === false);
check("merge output keeps settings keys through repair", L.mergeStates({ settings: { wallyOff: true } }, { settings: {} }).settings.wallyOff === true);
check("F1 WRITER CURE: the anchor resolves cloud-first at the merge (a local guest-setup stamp never moves the account's; birth only when none exists anywhere)", (() => { const mA = L.mergeStates({ profile: { firstSeenAt: "2026-09-01T00:00:00.000Z", setupDone: true, name: "Cloud" } }, { profile: { firstSeenAt: "2026-10-20T00:00:00.000Z", setupDone: true, name: "Local" } }); const mB = L.mergeStates({ profile: { setupDone: true } }, { profile: { firstSeenAt: "2026-10-20T00:00:00.000Z", setupDone: true } }); const mC = L.mergeStates(null, { profile: { firstSeenAt: "2026-10-20T00:00:00.000Z", setupDone: true } }); return mA.profile.firstSeenAt === "2026-09-01T00:00:00.000Z" && mA.profile.name === "Local" && mB.profile.firstSeenAt === "2026-10-20T00:00:00.000Z" && mC.profile.firstSeenAt === "2026-10-20T00:00:00.000Z"; })());

/* QA Phase 4 F2 class tests: poisoned routine/session items are
   normalised slot by slot, count preserved, never a crash shape. */
const poisoned = L.repairState({ routines: [{ id: "r1", name: "Arm day", items: [{ exerciseId: "curl", sets: 3, reps: 12 }, null, 42, { sets: "x" }] }],
  sessions: [{ id: "s1", items: [null, { exerciseId: "press", sets: 2, reps: 10 }] }] });
check("repair keeps every routine item slot", poisoned.routines[0].items.length === 4);
check("repair normalises poisoned items to safe objects", poisoned.routines[0].items.every(it => it && typeof it === "object" && "exerciseId" in it && typeof it.sets === "number"));
check("repair keeps the valid item intact", poisoned.routines[0].items[0].exerciseId === "curl" && poisoned.routines[0].items[0].sets === 3);
check("repair turns null items into empty slots", poisoned.routines[0].items[1].exerciseId === null && poisoned.routines[0].items[2].exerciseId === null);
check("repair normalises session items the same way", poisoned.sessions[0].items.length === 2 && poisoned.sessions[0].items[0].exerciseId === null && poisoned.sessions[0].items[1].exerciseId === "press");
const good = L.repairState({ disclaimer: { agreedAt: "2026-10-14T01:00:00.000Z", version: 1 } });
check("repair keeps a real agreement", L.disclaimerAgreed(good) && good.disclaimer.version === 1);

/* --- Phase 2: meals engine (copied from Meal Prep) + budget planning --- */
const MDATA = require("../meals-data-node.js");
const MNUT = require("../meals-nutrition-node.js");
const ML = require("../meals-logic.js");
check("library has 1089 recipes (26 core + 180 pack batches 1-2 + 684 healthy-filtered from pack batches 3-10 + 199 Fit native from batches 11-12; the 24 pre-ruling out-of-band recipes removed under Ilse's healthy-fence ruling, 17 Oct 2026)", MDATA.RECIPES.length === 1089);
const nullKcal = MDATA.RECIPES.filter(r => ML.recipeKcal(r, MNUT) === null);
check("every library recipe has a real kcal number", nullKcal.length === 0);
/* SR-K3 class tests (added 14 Oct with the corrected dry-weight table re-copy):
   the five staples recipes weigh dry must carry dry USDA values, and three
   staple recipes must match hand arithmetic on the dry basis. */
check("dry staples carry dry values", MNUT.KCAL100.rice === 365 && MNUT.KCAL100.pasta === 371 && MNUT.KCAL100.spaghetti === 371 && MNUT.KCAL100.noodles === 384 && MNUT.KCAL100.couscous === 376);
check("dry staple sources say dry or raw", ["rice", "pasta", "spaghetti", "noodles", "couscous"].every(k => /dry|raw/i.test(MNUT.SOURCES[k].desc)));
const tunaR = MDATA.RECIPES.find(r => r.id === "tuna-rice");
const tunaHand = Math.round(((290 * 1.16 + 200 * 3.65 + 150 * 0.88 + 1 * 301 * 0.15 + 2 * 15 * 6.80 + 1 * 15 * 0.53) / tunaR.servings) / 5) * 5;
check("hand checked kcal Tuna Rice Bowls (dry rice) is " + tunaHand, ML.recipeKcal(tunaR, MNUT) === tunaHand);
/* Pesto Pasta carried this hand check until 17 Oct 2026, when it left the
   library under Ilse's healthy-fence ruling (910 kcal, over the dinner
   band). The check moves to Spaghetti Bolognese, a surviving in-band
   core dinner on the same dry pasta basis. */
const bolR = MDATA.RECIPES.find(r => r.id === "spaghetti-bol");
const bolHand = Math.round(((400 * 3.71 + 500 * 2.15 + 400 * 0.32 + 1 * 110 * 0.40 + 1 * 61 * 0.41 + 2 * 3 * 1.49 + 40 * 4.20) / bolR.servings) / 5) * 5;
check("hand checked kcal Spaghetti Bolognese (dry spaghetti) is " + bolHand, ML.recipeKcal(bolR, MNUT) === bolHand);
const koftaR = MDATA.RECIPES.find(r => r.id === "lamb-kofta");
const koftaHand = Math.round(((500 * 2.82 + 250 * 3.76 + 1 * 301 * 0.15 + 200 * 0.97 + 2 * 5 * 3.75 + 20 * 0.36) / koftaR.servings) / 5) * 5;
check("hand checked kcal Lamb Kofta (dry couscous) is " + koftaHand, ML.recipeKcal(koftaR, MNUT) === koftaHand);
check("every meal type has at least 8 recipes", ["breakfast", "lunch", "dinner"].every(m => MDATA.RECIPES.filter(r => r.meal === m).length >= 8));
const kcalOf = r => ML.recipeKcal(r, MNUT);
/* --- The free maker, hardened (RECIPES-1000-PLAN section 4) ---
   Vocabulary only, a hard count assertion with one repair, the healthy
   fence per slot, and plain words where a name cannot be built. */
const makerVocab = ML.makerVocabulary(MNUT);
check("maker vocabulary is the counted table minus the finished photo foods (106 of 110)",
  makerVocab.length === 106 && ["pizza", "cake", "sandwich", "donut"].every(k => makerVocab.indexOf(k) === -1) &&
  makerVocab.every(k => Object.prototype.hasOwnProperty.call(MNUT.KCAL100, k)));
check("maker counted guarantee starts at the table: every KCAL100 value is a finite number over zero",
  Object.keys(MNUT.KCAL100).every(k => typeof MNUT.KCAL100[k] === "number" && isFinite(MNUT.KCAL100[k]) && MNUT.KCAL100[k] > 0));
const makerFound = ML.buildRecipeFromName("tuna rice", MDATA, [], MNUT);
check("maker finds before it makes (tuna rice is the library recipe)",
  makerFound.status === "found" && makerFound.recipe.id === "tuna-rice");
const makerMade = ML.buildRecipeFromName("Mushroom risotto", MDATA, [], MNUT);
check("maker composes a new name from counted foods only, counted and in the dinner band",
  makerMade.status === "made" && makerMade.recipe.name === "Mushroom risotto" && makerMade.recipe.custom === true &&
  makerMade.recipe.meal === "dinner" && makerMade.kcal === ML.recipeKcal(makerMade.recipe, MNUT) &&
  makerMade.kcal >= ML.makerBands.dinner[0] && makerMade.kcal <= ML.makerBands.dinner[1] &&
  makerMade.recipe.ingredients.every(i => makerVocab.indexOf(i.name) !== -1));
const makerBattery = ["Mushroom risotto", "spinach frittata", "apple pancakes", "prawn linguine", "chicken korma", "tuna rice"];
const makerResults = makerBattery.map(n => ML.buildRecipeFromName(n, MDATA, [], MNUT));
check("maker battery: every made recipe uses only counted ingredients and carries its asserted count",
  makerResults.every(r => r.status !== "made" ||
    (r.recipe.ingredients.every(i => makerVocab.indexOf(i.name) !== -1) && r.kcal === ML.recipeKcal(r.recipe, MNUT))));
check("maker battery: no false number and no false zero (a reported count is real and over zero)",
  makerResults.every(r => r.status !== "made" || r.kcal === null || (typeof r.kcal === "number" && r.kcal > 0)));
check("maker battery: every counted made recipe sits inside the healthy band for its slot",
  makerResults.every(r => r.status !== "made" || r.kcal === null ||
    (r.kcal >= ML.makerBands[r.recipe.meal][0] && r.kcal <= ML.makerBands[r.recipe.meal][1])));
check("maker never fabricates: the old seed's placeholder main appears in no made recipe",
  makerResults.every(r => r.status !== "made" || r.recipe.ingredients.every(i => i.name !== "main ingredient of your choice")));
["truffle pasta", "wagyu beef bowl", "roast duck", "quinoa salad", "miso soup", "unicorn stew", "leftover surprise"].forEach(n => {
  const r = ML.buildRecipeFromName(n, MDATA, [], MNUT);
  check("maker answers plainly, never invents, for an uncountable lead (" + n + ")", r.status === "uncountable" && r.recipe === null);
});
const makerDeclined = ML.buildRecipeFromName("butter bacon bake", MDATA, [], MNUT);
check("maker fence: a counted bake that stays over the dinner band after one repair is declined, not saved",
  makerDeclined.status === "declined" && makerDeclined.recipe === null && makerDeclined.kcal > ML.makerBands.dinner[1] &&
  makerDeclined.slot === "dinner" && makerDeclined.band[0] === 350 && makerDeclined.band[1] === 900);
const nutNoPiece = JSON.parse(JSON.stringify(MNUT)); delete nutNoPiece.PIECE_G.onion;
const makerRepairA = ML.buildRecipeFromName("mushroom risotto", MDATA, [], nutNoPiece);
check("maker count repair: a piece weight missing from the table is weighed instead, and the count survives",
  makerRepairA.status === "made" && typeof makerRepairA.kcal === "number" &&
  makerRepairA.recipe.ingredients.some(i => i.name === "onion" && i.unit === "g"));
const nutNullSide = JSON.parse(JSON.stringify(MNUT)); nutNullSide.KCAL100.parmesan = null;
const makerRepairB = ML.buildRecipeFromName("mushroom risotto", MDATA, [], nutNullSide);
check("maker count repair: an unpriceable side ingredient is dropped once, and the count lands",
  makerRepairB.status === "made" && typeof makerRepairB.kcal === "number" &&
  !makerRepairB.recipe.ingredients.some(i => i.name === "parmesan"));
const nutNullMain = JSON.parse(JSON.stringify(MNUT)); nutNullMain.KCAL100.mushroom = null;
const makerNoCount = ML.buildRecipeFromName("mushroom risotto", MDATA, [], nutNullMain);
check("maker no-count terminal: an unpriceable main is offered honestly with no number, recipe intact",
  makerNoCount.status === "made" && makerNoCount.kcal === null &&
  makerNoCount.recipe.ingredients.some(i => i.name === "mushroom"));
/* Maker delta: the named-food disclosure. A food word the table cannot
   count, riding behind a counted lead, is named on the result so the
   card can say it is not in the dish, with the staple that stands in. */
const makerMissOne = ML.buildRecipeFromName("chicken quinoa bowl", MDATA, [], MNUT);
check("maker disclosure: a non-lead uncountable food is named, with its stand in (chicken quinoa bowl)",
  makerMissOne.status === "made" && eq(makerMissOne.missing, ["quinoa"]) && makerMissOne.standin === "rice" &&
  makerMissOne.recipe.ingredients.some(i => i.name === "rice") &&
  !makerMissOne.recipe.ingredients.some(i => i.name === "quinoa"));
check("maker disclosure: a fully counted name flags nothing (Mushroom risotto)",
  makerMade.status === "made" && eq(makerMade.missing, []));
const makerMissTwo = ML.buildRecipeFromName("chicken quinoa miso bowl", MDATA, [], MNUT);
check("maker disclosure: two missing foods are both named, in name order",
  makerMissTwo.status === "made" && eq(makerMissTwo.missing, ["quinoa", "miso"]) && makerMissTwo.standin === "rice");
const makerMissNoBase = ML.buildRecipeFromName("spinach quinoa salad", MDATA, [], MNUT);
check("maker disclosure: a missing food with no staple base names no stand in (spinach quinoa salad)",
  makerMissNoBase.status === "made" && eq(makerMissNoBase.missing, ["quinoa"]) && makerMissNoBase.standin === null);
check("maker surface: the door is buildRecipeFromName, words exist in both languages with no dashes, saving waits for the tap",
  (() => { const fs2 = require("fs");
    const src = fs2.readFileSync(new URL("../app.js", import.meta.url), "utf8");
    const h = src.slice(src.indexOf("$(\"nameMealBtn\")"), src.indexOf("$(\"nameMealBtn\")") + 3400);
    const L3 = require(require("path").join(process.cwd(), "i18n.js"));
    const keys = ["meal.makerHow", "meal.makerCant", "meal.makerBand", "meal.makerMissing"];
    const words = keys.every(k => L3.EN[k] && L3.ES[k] && !/[-—–]/.test(L3.EN[k]) && !/[-—–]/.test(L3.ES[k]));
    return h.indexOf("buildRecipeFromName") >= 0 && h.indexOf("meal.makerCant") >= 0 && h.indexOf("meal.makerBand") >= 0 &&
      h.indexOf("meal.makerMissing") >= 0 &&
      h.indexOf("meal.makerHow") >= 0 && h.indexOf("customRecipes.push") > h.indexOf("id=\"nameMealSave\"") && words; })());
const samProfile = { allergies: [], preferences: ["Healthy"] };
const plan1870 = L.planDayMeals(1870, MDATA.RECIPES, kcalOf, samProfile, []);
check("budget plan picks all three meals", !!(plan1870.breakfast && plan1870.lunch && plan1870.dinner));
check("budget plan total near 1870 (within 25 pct)", plan1870.total > 1400 && plan1870.total < 2340);
check("budget plan total equals sum of parts", plan1870.total === plan1870.breakfast.kcal + plan1870.lunch.kcal + plan1870.dinner.kcal);
const nutProfile = { allergies: ["peanut"], preferences: [] };
check("peanut allergy blocks peanut butter oats", !L.recipeSafe(MDATA.RECIPES.find(r => r.id === "oat-bowls"), nutProfile));
const nutPlan = L.planDayMeals(1870, MDATA.RECIPES, kcalOf, nutProfile, []);
const nutIds = [nutPlan.breakfast.id, nutPlan.lunch.id, nutPlan.dinner.id];
check("allergy plan never serves the blocked recipe", nutIds.indexOf("oat-bowls") === -1);
check("coconut milk is not a milk allergy hit", !L.ingredientHitsAllergy("coconut milk", ["milk"]));
check("real milk is a milk allergy hit", L.ingredientHitsAllergy("milk", ["milk"]));
/* QA Phase 2 F2 class tests: the milk family, not just the word. */
check("milk family fires on dairy ingredients", ["parmesan", "greek yogurt", "butter", "cream", "feta", "mozzarella", "cheese", "halloumi", "whey powder"].every(x => L.ingredientHitsAllergy(x, ["milk"])));
check("milk family exceptions never fire", ["coconut milk", "coconut cream", "coconut yogurt", "peanut butter", "cocoa butter"].every(x => !L.ingredientHitsAllergy(x, ["milk"])));
check("dairy alias fires the milk family", L.ingredientHitsAllergy("parmesan", ["dairy"]) && !L.ingredientHitsAllergy("coconut yogurt", ["dairy"]));
check("QA-proven servings now blocked for milk allergy", ["greek-salad", "greek-yogurt-bowl", "falafel-pita"].every(id => !L.recipeSafe(MDATA.RECIPES.find(r => r.id === id), { allergies: ["milk"] })));
check("milk-allergy day plan serves only safe recipes", (() => { const p = L.planDayMeals(1870, MDATA.RECIPES, kcalOf, { allergies: ["milk"], preferences: [] }, []); return [p.breakfast, p.lunch, p.dinner].every(r => r && L.recipeSafe(r, { allergies: ["milk"] })); })());
const noBudget = L.planDayMeals(null, MDATA.RECIPES, kcalOf, samProfile, []);
check("no-budget plan still picks three meals", !!(noBudget.breakfast && noBudget.lunch && noBudget.dinner));
const varied = L.planDayMeals(1870, MDATA.RECIPES, kcalOf, samProfile, [plan1870.dinner.id]);
check("recent dinner is not forced to repeat", varied.dinner.id !== plan1870.dinner.id || MDATA.RECIPES.filter(r => r.meal === "dinner").length < 2);
check("treats total counts known, flags unknown", JSON.stringify(L.treatsTotal([{ kcal: 320 }, { kcal: null }, { kcal: 80 }])) === JSON.stringify({ known: 400, unknown: 1 }));
check("ingredient line with grams", JSON.stringify(L.parseIngredientLine("200 g chicken breast")) === JSON.stringify({ qty: 200, unit: "g", name: "chicken breast" }));
check("ingredient line kg converts to g", L.parseIngredientLine("1 kg rice").qty === 1000 && L.parseIngredientLine("1 kg rice").unit === "g");
check("ingredient line bare name", L.parseIngredientLine("egg").name === "egg");
check("ingredient line blank is null", L.parseIngredientLine("  ") === null);
const gl2 = ML.buildGroceryList({ "2026.10.15": { breakfast: "avo-eggs", lunch: "greek-salad", dinner: "tacos" } }, MDATA.RECIPES, []);
check("grocery list builds from a plan day", gl2.length > 8 && gl2.every(i => i.qty > 0));
const fridgeEst = ML.fridgeKcal("egg", MNUT);
check("fridge kcal estimate exists for egg", !!fridgeEst && fridgeEst.kcal > 0 && fridgeEst.high > fridgeEst.low);
const photoEst = ML.photoKcal("banana", MNUT);
check("photo kcal estimate exists for banana", !!photoEst && photoEst.kcal > 0 && photoEst.high > photoEst.low);

/* --- Phase 3: calendar maths, todo categories (Pace ports) --- */
const oct = L.monthGrid(2026, 9); /* October 2026 starts on a Thursday */
check("month grid starts on Monday 28 Sep", oct[0] === "2026-09-28");
check("month grid covers 31 Oct", oct.indexOf("2026-10-31") !== -1);
check("month grid is whole weeks", oct.length % 7 === 0);
const feb = L.monthGrid(2027, 1); /* Feb 2027 starts on a Monday */
check("feb 2027 grid starts 1 Feb", feb[0] === "2027-02-01" && feb.length === 28);
check("category gym is health colour family", L.categoryFor("gym session").id === "health");
check("category groceries is food", L.categoryFor("buy groceries").id === "food");
check("category unknown is general grey", L.categoryFor("xyzzy").color === "#8A7A63");
check("duration call is 10", L.estimateDuration("call mum") === 10);
check("duration shop is 45", L.estimateDuration("shop for food") === 45);
const td = L.makeTodo({ title: "Gym", date: "2026-10-15", time: "18:00" });
check("makeTodo shapes a full item", td.status === "open" && td.durationMin === 25 && !!td.color);
const ordered = L.todosOn([{ title: "B", date: "2026-10-15", time: null }, { title: "A", date: "2026-10-15", time: "09:00" }, { title: "C", date: "2026-10-16", time: "09:00" }], "2026-10-15");
check("todosOn filters the day and sorts timed first", ordered.length === 2 && ordered[0].title === "A");
const repTodo = L.repairState({ todos: [{ title: "Keep me", date: "2026-10-15" }, { title: 9, status: "done" }] });
check("todo repair keeps both, defaults the broken one", repTodo.todos.length === 2 && repTodo.todos[1].title === "To do" && repTodo.todos[1].status === "done" && repTodo.todos[0].durationMin === 25);

/* --- Phase 4: gym data + routine maths --- */
const GX = require("../exercises-node.js");
check("the 27 curated exercises still lead the library (the Phase 2 splice appends after them)", GX.EXERCISES.slice(0, 27).length === 27 && GX.EXERCISES[0].id === "Leg_Press");
check("every exercise has name, part, equipment, cue", GX.EXERCISES.every(e => e.name && e.part && e.equipment && e.cue));
check("every cue is short (40 words max) and dash free", GX.EXERCISES.every(e => e.cue.split(/\s+/).length <= 40 && !/—|–/.test(e.cue)));
check("every exercise carries a dataset level", GX.EXERCISES.every(e => ["beginner", "intermediate", "expert"].indexOf(e.level) >= 0));
check("every exercise carries its dataset source id", GX.EXERCISES.every(e => /^free-exercise-db\//.test(e.source)));
/* Exercises Phase 1: D1 schema live on the shipped 27. */
check("P1 schema: every exercise carries category + station (D1)", GX.EXERCISES.every(e => typeof e.category === "string" && e.category.length > 0 && typeof e.station === "string" && e.station.length > 0));
check("P1 schema: categories are dataset values", GX.EXERCISES.every(e => ["strength", "stretching", "plyometrics", "powerlifting", "olympic weightlifting", "strongman", "cardio"].indexOf(e.category) >= 0));
check("P1 schema: every station resolves in MACHINES", GX.EXERCISES.every(e => GX.MACHINES.some(m => m.id === e.station)));
check("P1 schema: station matches the MACHINES link both ways", GX.EXERCISES.every(e => { const m = GX.MACHINES.find(x => x.id === e.station); return !!m && m.exerciseIds.indexOf(e.id) >= 0; }));
check("P1 D3: GYM_GOALS unchanged (six goals, same parts)", L.GYM_GOALS.length === 6 && JSON.stringify(L.GYM_GOALS.map(g => g.id)) === JSON.stringify(["legs", "back", "push", "arms", "full", "gentle"]));
const exIds = new Set(GX.EXERCISES.map(e => e.id));
check("every machine maps to real exercises", GX.MACHINES.every(m => m.exerciseIds.length && m.exerciseIds.every(id => exIds.has(id))));
const legDay = L.buildRoutine("legs", 45, GX.EXERCISES);
check("leg day 45 min gives 5 exercises", legDay.items.length === 5);
check("leg day covers quads, hams, glutes, calves", ["quadriceps", "hamstrings", "glutes", "calves"].every(p =>
  legDay.items.some(it => GX.EXERCISES.find(e => e.id === it.exerciseId).part === p)));
check("routine build is deterministic", JSON.stringify(L.buildRoutine("legs", 45, GX.EXERCISES)) === JSON.stringify(legDay));
/* Exercises Phase 1: D2 pool is the builder's only road. */
check("P1 D2: pool of the full library is exactly its beginner strength set, and holds all 27 shipped", L.routinePool(GX.EXERCISES).length === 365 && L.routinePool(GX.EXERCISES).every(e => e.level === "beginner" && e.category === "strength") && GX.EXERCISES.slice(0, 27).every(e => L.routinePool(GX.EXERCISES).some(p => p.id === e.id)));
const MIXED = GX.EXERCISES.concat([
  { id: "Fake_Intermediate", name: "Fake Intermediate", part: "quadriceps", partLabel: "Front of thigh", equipment: "machine", level: "intermediate", category: "strength", cue: "x", timed: null, source: "test" },
  { id: "Fake_Expert", name: "Fake Expert", part: "quadriceps", partLabel: "Front of thigh", equipment: "machine", level: "expert", category: "strength", cue: "x", timed: null, source: "test" },
  { id: "Fake_Stretch", name: "Fake Stretch", part: "quadriceps", partLabel: "Front of thigh", equipment: "body only", level: "beginner", category: "stretching", cue: "x", timed: null, source: "test" },
  { id: "Fake_Jump", name: "Fake Jump", part: "quadriceps", partLabel: "Front of thigh", equipment: "body only", level: "beginner", category: "plyometrics", cue: "x", timed: null, source: "test" }
]);
check("P1 D2: pool excludes intermediate, expert and non-strength from a mixed list", L.routinePool(MIXED).length === 365 && L.routinePool(MIXED).every(e => ["Fake_Intermediate", "Fake_Expert", "Fake_Stretch", "Fake_Jump"].indexOf(e.id) < 0));
check("P1 D2: builder never selects an ineligible record at any goal or length", L.GYM_GOALS.every(g => [20, 30, 45, 60, 90].every(mins => L.buildRoutine(g.id, mins, MIXED).items.every(it => ["Fake_Intermediate", "Fake_Expert", "Fake_Stretch", "Fake_Jump"].indexOf(it.exerciseId) < 0))));
check("P1 D2: goldens hold — six goals at 30 min byte-identical to the pre-pool build", JSON.stringify(["legs", "back", "push", "arms", "full", "gentle"].map(g => L.buildRoutine(g, 30, GX.EXERCISES).items)) === JSON.stringify([
  [{ exerciseId: "Leg_Press", sets: 3, reps: 12, timed: false, restSec: 45 }, { exerciseId: "Seated_Leg_Curl", sets: 3, reps: 12, timed: false, restSec: 45 }, { exerciseId: "Butt_Lift_Bridge", sets: 3, reps: 12, timed: false, restSec: 45 }],
  [{ exerciseId: "Close-Grip_Front_Lat_Pulldown", sets: 3, reps: 12, timed: false, restSec: 45 }, { exerciseId: "Seated_Cable_Rows", sets: 3, reps: 12, timed: false, restSec: 45 }, { exerciseId: "Hyperextensions_Back_Extensions", sets: 3, reps: 12, timed: false, restSec: 45 }],
  [{ exerciseId: "Butterfly", sets: 3, reps: 12, timed: false, restSec: 45 }, { exerciseId: "Alternating_Cable_Shoulder_Press", sets: 3, reps: 12, timed: false, restSec: 45 }, { exerciseId: "Cable_Chest_Press", sets: 3, reps: 12, timed: false, restSec: 45 }],
  [{ exerciseId: "Dumbbell_Alternate_Bicep_Curl", sets: 3, reps: 12, timed: false, restSec: 40 }, { exerciseId: "Bench_Dips", sets: 3, reps: 12, timed: false, restSec: 40 }, { exerciseId: "Machine_Bicep_Curl", sets: 3, reps: 12, timed: false, restSec: 40 }],
  [{ exerciseId: "Leg_Press", sets: 3, reps: 10, timed: false, restSec: 45 }, { exerciseId: "Butterfly", sets: 3, reps: 10, timed: false, restSec: 45 }, { exerciseId: "Close-Grip_Front_Lat_Pulldown", sets: 3, reps: 10, timed: false, restSec: 45 }],
  [{ exerciseId: "Leg_Press", sets: 2, reps: 10, timed: false, restSec: 60 }, { exerciseId: "Butt_Lift_Bridge", sets: 2, reps: 10, timed: false, restSec: 60 }, { exerciseId: "Butterfly", sets: 2, reps: 10, timed: false, restSec: 60 }]
]));
/* --- Exercises Phase 2: the splice (844 in, 5 held) + QA's F1–F8 fence --- */
check("P2: library holds 871 exercises (27 shipped + 844 spliced)", GX.EXERCISES.length === 871 && GX.EXERCISES.slice(27).length === 844);
check("P2: the shipped 27 are field-identical after the splice (sha256 of record)", require("crypto").createHash("sha256").update(JSON.stringify(GX.EXERCISES.slice(0, 27))).digest("hex") === "60fc533dc3fadd1b5c86e57a3f3d9508604da2e366d80845ff2a2ba0fb640cb8");
check("P2: census by category and level, counted from the shipped file itself", (() => { const c = {}; GX.EXERCISES.forEach(e => { const k = e.category + "/" + e.level; c[k] = (c[k] || 0) + 1; });
  return JSON.stringify(Object.keys(c).sort().map(k => k + "=" + c[k])) === JSON.stringify(["cardio/beginner=8", "cardio/intermediate=6", "olympic weightlifting/beginner=2", "olympic weightlifting/expert=9", "olympic weightlifting/intermediate=23", "plyometrics/beginner=57", "plyometrics/intermediate=4", "powerlifting/beginner=3", "powerlifting/expert=7", "powerlifting/intermediate=28", "strength/beginner=365", "strength/expert=26", "strength/intermediate=189", "stretching/beginner=82", "stretching/expert=12", "stretching/intermediate=29", "strongman/beginner=6", "strongman/expert=2", "strongman/intermediate=13"]); })());
check("P2: the held five are absent from the library (the zero-instruction queue of record)", ["Iron_Cross", "One-Arm_Kettlebell_Swings", "Push_Press", "Side_Bridge", "Side_Jackknife"].every(id => !exIds.has(id)));
check("P2 F1: pool census is 365, set-equal to the file's beginner strength (which already excludes the two held pool members)", (() => {
  const pool = L.routinePool(GX.EXERCISES);
  const expect = GX.EXERCISES.filter(e => e.level === "beginner" && e.category === "strength").map(e => e.id).sort();
  return pool.length === 365 && JSON.stringify(pool.map(e => e.id).sort()) === JSON.stringify(expect);
})());
check("P2 F2: builder soak over the full library — every goal at every length picks only pool members", L.GYM_GOALS.every(g => [20, 30, 45, 60, 90].every(mins => { const poolIds = new Set(L.routinePool(GX.EXERCISES).map(e => e.id)); return L.buildRoutine(g.id, mins, GX.EXERCISES).items.every(it => poolIds.has(it.exerciseId)); })));
check("P2 F3/F6: hand paths — intermediate strength plays by hand; expert, held classes and unknown ids never play", (() => {
  const inter = GX.EXERCISES.find(e => e.level === "intermediate" && e.category === "strength");
  const expert = GX.EXERCISES.find(e => e.level === "expert");
  const heldClass = GX.EXERCISES.find(e => e.category === "stretching");
  const one = (id) => [{ exerciseId: id, sets: 3, reps: 12, timed: false, restSec: 45 }];
  return L.playableItems(one(inter.id), GX.EXERCISES).length === 1 && L.playableItems(one(expert.id), GX.EXERCISES).length === 0 &&
    L.playableItems(one(heldClass.id), GX.EXERCISES).length === 0 && L.playableItems(one("Nope_Not_Real"), GX.EXERCISES).length === 0;
})());
check("P2 F3: expert enters no routine by any path — every expert id in the library fails the play rule", GX.EXERCISES.filter(e => e.level === "expert").length === 56 && GX.EXERCISES.filter(e => e.level === "expert").every(e => !L.routinePlayable(e)));
check("P2 F7: a poisoned saved routine keeps every slot at repair, and only playable items play (the stated load behaviour)", (() => {
  const expert = GX.EXERCISES.find(e => e.level === "expert");
  const inter = GX.EXERCISES.find(e => e.level === "intermediate" && e.category === "strength");
  const heldClass = GX.EXERCISES.find(e => e.category === "stretching");
  const items = [expert.id, "Nope_Not_Real", inter.id, heldClass.id, "Leg_Press"].map(id => ({ exerciseId: id, sets: 3, reps: 12, timed: false, restSec: 45 }));
  const kept = L.repairState({ routines: [{ id: "rX", name: "Poisoned", items: items }] }).routines[0].items;
  const played = L.playableItems(kept, GX.EXERCISES).map(it => it.exerciseId);
  return kept.length === 5 && JSON.stringify(kept.map(it => it.exerciseId)) === JSON.stringify([expert.id, "Nope_Not_Real", inter.id, heldClass.id, "Leg_Press"]) &&
    JSON.stringify(played) === JSON.stringify([inter.id, "Leg_Press"]);
})());
check("P2 F7: the session door, the player, the station road and the library add path all route through the play rule (source)", (() => {
  const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return src.indexOf("L.playableItems(use.items, EX.EXERCISES)") >= 0 && src.indexOf("!L.routinePlayable(ex)") >= 0 &&
    src.indexOf("L.playableItems(items, EX.EXERCISES)") >= 0 && src.indexOf("function renderLibrary") >= 0 &&
    src.indexOf("data-libadd") >= 0 && src.indexOf('ex.level !== "expert"') >= 0 && src.indexOf("gym.nothingPlayable") >= 0;
})());
check("P2 F4: the D2 labels are language-layer chrome in both languages (source)", (() => {
  const i18n = require("fs").readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
  const pairs = [["gym.stepUp", "A step up", "Un paso más"], ["gym.advanced", "Advanced", "Avanzado"], ["gym.libraryOnly", "Library only", "Solo biblioteca"]];
  return pairs.every(([k, en, es]) => i18n.indexOf('"' + k + '": "' + en + '"') >= 0 && i18n.indexOf('"' + k + '": "' + es + '"') >= 0) &&
    i18n.indexOf('"sub.gym-library": "Exercise library"') >= 0 && i18n.indexOf('"sub.gym-library": "Biblioteca de ejercicios"') >= 0 &&
    require("fs").readFileSync(new URL("../data.js", import.meta.url), "utf8").indexOf('"gym-library"') >= 0;
})());
check("P2 D5: Plank is the library's only timed record; no spliced record is auto-timed", GX.EXERCISES.filter(e => e.timed != null).length === 1 && GX.EXERCISES.filter(e => e.timed != null)[0].id === "Plank" && GX.EXERCISES.slice(27).every(e => e.timed === null));
check("P2 F8: 67 machine exercises, every one station-linked and resolving; the Smith leg press clusters with Leg press by movement", (() => {
  const mach = GX.EXERCISES.filter(e => e.equipment === "machine");
  return mach.length === 67 && mach.every(e => !!e.station && GX.MACHINES.some(m => m.id === e.station)) &&
    GX.EXERCISES.find(e => e.id === "Smith_Machine_Leg_Press").station === "leg-press";
})());
check("P2 cues: every spliced cue is 10 to 27 words, dash free, digit free and claims free", (() => {
  const P2_BANNED = ["you should take", "recommended dose", "dosage", "take more", "increase the dose", "mg per kg", "we recommend taking", "burns fat", "detox", "burn fat", "lose weight", "weight loss", "cure", "diagnos", "therapy", "rehab", "pain relief", "guaranteed"];
  return GX.EXERCISES.slice(27).every(e => { const w = e.cue.split(/\s+/).length, low = e.cue.toLowerCase();
    return w >= 10 && w <= 27 && !/—|–/.test(e.cue) && !/[0-9]/.test(e.cue) && P2_BANNED.every(b => low.indexOf(b) === -1); });
})());
check("P2 cues: no two exercises in the whole library share a cue", new Set(GX.EXERCISES.map(e => e.cue)).size === GX.EXERCISES.length);
check("P2: 36 stations ship (the 12 of record + 24 new homes)", GX.MACHINES.length === 36);
check("20 min gives the 3 exercise floor", L.buildRoutine("back", 20, GX.EXERCISES).items.length === 3);
check("90 min caps at 8 exercises", L.buildRoutine("full", 90, GX.EXERCISES).items.length <= 8);
check("unknown goal is null, no crash", L.buildRoutine("nope", 30, GX.EXERCISES) === null);
const light = L.lightenRoutine(legDay);
check("lightened routine drops a set, keeps exercises", light.items[0].sets === legDay.items[0].sets - 1 && light.items.length >= 3);
check("lightened rest grows by 15 sec", light.items[0].restSec === legDay.items[0].restSec + 15);
check("lightening never mutates the original", legDay.items[0].sets === 3);
const fakeRoutine = { days: [5], createdKey: "2026-10-14" };
check("routine due on a Friday after creation", L.routineDueOn(fakeRoutine, "2026-10-16") === true);
check("routine not due before creation", L.routineDueOn(fakeRoutine, "2026-10-09") === false);
check("routine not due on a Wednesday", L.routineDueOn(fakeRoutine, "2026-10-14") === false);

/* --- Trainer slice: matching + progression inside the pool ---------
   The design of record is TRAINER-MATCHING-DESIGN.md. The unlock
   count (8) is a DESK DESIGN PARAMETER adopted by this slice, not
   a user ruling; the pins below hold the shape the gates read. */
function trSess(rid, key, items, lightened, at) {
  return { id: "sess." + rid + "." + key + "." + (at || 0) + (lightened ? ".L" : ""), dateKey: key, routineId: rid,
    routineName: "Leg day", status: "done", startedAt: at || 0, items: items, lightened: !!lightened };
}
const trBase = L.buildRoutine("legs", 30, GX.EXERCISES);
const trPrev = { id: "routine.tr1", goalId: "legs", name: "Leg day", minutes: 30, items: trBase.items };
const trOne = [trSess("routine.tr1", "2026-10-16", trBase.items, false, 1)];
const trTwo = [trSess("routine.tr1", "2026-10-14", trBase.items, false, 1), trSess("routine.tr1", "2026-10-16", trBase.items, false, 2)];
check("TR: a fresh profile with context builds byte-identical to the golden plain build (the history-driven layer has nothing to read; the Gentle start goal is the section 3 exception pinned below)", ["legs", "back", "push", "arms", "full"].every(g =>
  JSON.stringify(L.buildRoutine(g, 30, GX.EXERCISES, { profile: { activity: "some" }, sessions: [], todayKey: "2026-10-18" }).items) ===
  JSON.stringify(L.buildRoutine(g, 30, GX.EXERCISES).items)));
check("TR: the pool never widens under any history (rich context, every goal and length, mixed list)", (() => {
  const rich = trTwo.concat([trSess("routine.tr9", "2026-10-15", [{ exerciseId: "Fake_Expert", sets: 3, reps: 12, timed: false, restSec: 45 }], false, 3)]);
  const poolIds = new Set(L.routinePool(MIXED).map(e => e.id));
  return L.GYM_GOALS.every(g => [20, 30, 45, 60, 90].every(mins =>
    L.buildRoutine(g.id, mins, MIXED, { profile: { activity: "some" }, sessions: rich, todayKey: "2026-10-18" }).items.every(it => poolIds.has(it.exerciseId))));
})());
check("TR: weight is quiet context only (two contexts differing only in weightKg build identically)", (() => {
  const a = L.buildRoutine("legs", 30, GX.EXERCISES, { profile: { activity: "some", weightKg: 50 }, sessions: trTwo, prevRoutine: trPrev, todayKey: "2026-10-18" });
  const b = L.buildRoutine("legs", 30, GX.EXERCISES, { profile: { activity: "some", weightKg: 140 }, sessions: trTwo, prevRoutine: trPrev, todayKey: "2026-10-18" });
  return JSON.stringify(a) === JSON.stringify(b);
})());
check("TR: a new user's first routines start one set lighter on their own gentle words (lowest activity, or the Gentle start goal)", (() => {
  const low = L.buildRoutine("legs", 30, GX.EXERCISES, { profile: { activity: "low" }, sessions: [], todayKey: "2026-10-18" });
  const gent = L.buildRoutine("gentle", 30, GX.EXERCISES, { profile: { activity: "some" }, sessions: [], todayKey: "2026-10-18" });
  const plain = L.buildRoutine("legs", 30, GX.EXERCISES, { profile: { activity: "some" }, sessions: [], todayKey: "2026-10-18" });
  return low.items.every(it => it.sets === 2) && gent.items.every(it => it.sets === 1) && plain.items.every(it => it.sets === 3);
})());
check("TR: station preference reorders inside the pool only (a used station's move is picked, the set stays the pool)", (() => {
  const hist = [trSess("routine.other", "2026-10-16", [{ exerciseId: "Ball_Leg_Curl", sets: 3, reps: 12, timed: false, restSec: 45 }], false, 1)];
  const built = L.buildRoutine("legs", 30, GX.EXERCISES, { profile: { activity: "some" }, sessions: hist, todayKey: "2026-10-18" });
  return JSON.stringify(built.items.map(i => i.exerciseId)) === JSON.stringify(["Leg_Press", "Ball_Leg_Curl", "Physioball_Hip_Bridge"]) &&
    JSON.stringify(L.buildRoutine("legs", 30, GX.EXERCISES, { profile: { activity: "some" }, sessions: hist, todayKey: "2026-10-18" })) === JSON.stringify(built);
})());
check("TR: one completion holds the plan (no step before the pair)", L.trainerAdvice(trPrev, trOne, "2026-10-18").kind === "none" &&
  JSON.stringify(L.trainerAdvice(trPrev, trOne, "2026-10-18").items) === JSON.stringify(trBase.items));
check("TR: two completions at the current volume step exactly one small step (the design's at-template step, +1 set)", (() => {
  const adv = L.trainerAdvice(trPrev, trTwo, "2026-10-18");
  return adv.kind === "up" && adv.items.every(it => it.sets === 4 && it.reps === 12) &&
    JSON.stringify(trPrev.items) === JSON.stringify(trBase.items);
})());
check("TR: the step does not repeat on the same history (the pair must be earned at the new volume)", (() => {
  const stepped = { id: "routine.tr1", goalId: "legs", items: L.trainerAdvice(trPrev, trTwo, "2026-10-18").items };
  return L.trainerAdvice(stepped, trTwo, "2026-10-18").kind === "none";
})());
check("TR: below the template, the step is +1 rep (the design's other half)", (() => {
  const below = { id: "routine.tr2", goalId: "legs", items: [{ exerciseId: "Leg_Press", sets: 3, reps: 10, timed: false, restSec: 45 }] };
  const hist = [trSess("routine.tr2", "2026-10-14", below.items, false, 1), trSess("routine.tr2", "2026-10-16", below.items, false, 2)];
  const adv = L.trainerAdvice(below, hist, "2026-10-18");
  return adv.kind === "up" && adv.items[0].sets === 3 && adv.items[0].reps === 11;
})());
check("TR: at the ladder ceiling the plan holds (no step past it)", (() => {
  const ceil = { id: "routine.tr3", goalId: "legs", items: [{ exerciseId: "Leg_Press", sets: 4, reps: 12, timed: false, restSec: 45 }] };
  const hist = [trSess("routine.tr3", "2026-10-14", ceil.items, false, 1), trSess("routine.tr3", "2026-10-16", ceil.items, false, 2)];
  return L.trainerAdvice(ceil, hist, "2026-10-18").kind === "none";
})());
check("TR: a fresh build for a trained goal carries the earned step forward", (() => {
  const built = L.buildRoutine("legs", 30, GX.EXERCISES, { profile: {}, sessions: trTwo, prevRoutine: trPrev, todayKey: "2026-10-18" });
  return built.items.every(it => it.sets === 4 && it.reps === 12);
})());
check("TR: 14 quiet days steps back to the last volume completed twice, kindly and only then", (() => {
  const steppedItems = trBase.items.map(it => Object.assign({}, it, { sets: 4 }));
  const stepped = { id: "routine.tr1", goalId: "legs", items: steppedItems };
  const hist = [trSess("routine.tr1", "2026-09-01", trBase.items, false, 1), trSess("routine.tr1", "2026-09-03", trBase.items, false, 2),
    trSess("routine.tr1", "2026-09-05", steppedItems, false, 3)];
  const back = L.trainerAdvice(stepped, hist, "2026-10-18");
  const insideGap = L.trainerAdvice(stepped, hist, "2026-09-18");
  return back.kind === "back" && back.items.every(it => it.sets === 3 && it.reps === 12) && insideGap.kind === "none";
})());
check("TR: a lightened finished session counts in full (the pair lands with one lightened leg)", (() => {
  const lightItems = trBase.items.map(it => Object.assign({}, it, { sets: 2 }));
  const hist = [trSess("routine.tr1", "2026-10-14", trBase.items, false, 1), trSess("routine.tr1", "2026-10-16", lightItems, true, 2)];
  return L.trainerAdvice(trPrev, hist, "2026-10-18").kind === "up";
})());
check("TR: a lightened session is a showing-up (it resets the quiet clock, so no step back follows it)", (() => {
  const steppedItems = trBase.items.map(it => Object.assign({}, it, { sets: 4 }));
  const stepped = { id: "routine.tr1", goalId: "legs", items: steppedItems };
  const lightItems = trBase.items.map(it => Object.assign({}, it, { sets: 3 }));
  const hist = [trSess("routine.tr1", "2026-09-01", trBase.items, false, 1), trSess("routine.tr1", "2026-09-03", trBase.items, false, 2),
    trSess("routine.tr1", "2026-10-17", lightItems, true, 3)];
  return L.trainerAdvice(stepped, hist, "2026-10-18").kind === "none";
})());
check("TR: timed holds are never stretched by progression", (() => {
  const plank = { id: "routine.tr4", goalId: "full", items: [{ exerciseId: "Plank", sets: 3, reps: 30, timed: true, restSec: 45 }] };
  const hist = [trSess("routine.tr4", "2026-10-14", plank.items, false, 1), trSess("routine.tr4", "2026-10-16", plank.items, false, 2)];
  const adv = L.trainerAdvice(plank, hist, "2026-10-18");
  return adv.kind === "none" && adv.items[0].reps === 30;
})());
check("TR: the step-up unlock opens at exactly 8 completed sessions, counted across routines", (() => {
  const seven = trTwo.concat(trTwo, trTwo, trOne).slice(0, 7).map((s, i) => Object.assign({}, s, { id: "u" + i }));
  const eight = seven.concat([trSess("routine.trX", "2026-10-17", trBase.items, false, 9)]);
  return L.TRAINER_UNLOCK_SESSIONS === 8 && L.trainerTotalDone(seven) === 7 && !L.stepUpUnlocked(seven) &&
    L.trainerTotalDone(eight) === 8 && L.stepUpUnlocked(eight);
})());
check("TR: expert stays refused at every history size (the play rule never reads the unlock)", (() => {
  const expert = GX.EXERCISES.find(e => e.level === "expert");
  const many = []; for (let i = 0; i < 40; i++) many.push(trSess("routine.trZ", "2026-10-10", trBase.items, false, i));
  return !L.routinePlayable(expert) && L.stepUpUnlocked(many) &&
    L.playableItems([{ exerciseId: expert.id, sets: 3, reps: 12, timed: false, restSec: 45 }], GX.EXERCISES).length === 0;
})());
check("TR: the unlock gates hand-picks at the surface and at the add function (source)", (() => {
  const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return src.indexOf('ex.level === "intermediate" && !L.stepUpUnlocked(state.sessions)') !== -1 &&
    src.indexOf('e.level !== "intermediate" || L.stepUpUnlocked(state.sessions)') !== -1 &&
    src.indexOf("data-rebuild") !== -1 && src.indexOf("L.trainerAdvice") !== -1 && src.indexOf("prevRoutine") !== -1;
})());
check("TR: trainer copy lives in the language layer, kind and weight-free in both languages", (() => {
  const L3 = require(require("path").join(process.cwd(), "i18n.js"));
  const keys = ["gym.stepReadyHint", "gym.stepBackHint", "gym.rebuildBtn", "gym.rebuiltStep", "gym.rebuiltBack", "gym.stepUpLocked"];
  return keys.every(k => typeof L3.EN[k] === "string" && typeof L3.ES[k] === "string" &&
    !/[-—–]/.test(L3.EN[k]) && !/[-—–]/.test(L3.ES[k]) &&
    !/weight|peso|kilo|blame|fail|missed|lost progress/i.test(L3.EN[k] + " " + L3.ES[k]));
})());

/* --- Phase 5: peptides copy fence + disclaimer record --- */
const fs = await import("fs");
const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
check("PLANS TITLE (Test chair's cosmetic note, b6): the Plans state card carries no second 'Plans' heading under the page title", !appSrc.includes('<div class="card"><h2>\' + esc(tr("plan.title"))') && appSrc.includes("esc(tierStateLine())"));
const dataSrc = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");
const htmlSrc = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const allCopy = (appSrc + dataSrc + htmlSrc).toLowerCase();
const BANNED = ["you should take", "recommended dose", "dosage", "take more", "increase the dose",
  "increase your dose", "mg per kg", "we recommend taking", "you should eat", "burns fat", "detox"];
BANNED.forEach(function (w) { check("copy fence: no '" + w + "'", allCopy.indexOf(w) === -1); });
const agreed = L.repairState({ disclaimer: { agreedAt: "2026-10-14T00:00:00.000Z", version: 1 } });
check("recorded agreement reads as agreed", L.disclaimerAgreed(agreed) === true);
const forged = L.repairState({ disclaimer: { agreedAt: "", version: 1 } });
check("agreement without a time is not an agreement", L.disclaimerAgreed(forged) === false);
const oldVersion = { disclaimer: { agreedAt: "2026-10-14T00:00:00.000Z", version: 0 } };
check("old disclaimer version does not count as agreed (Store Review fix)", L.disclaimerAgreed(oldVersion, 1) === false);
check("current disclaimer version counts as agreed", L.disclaimerAgreed({ disclaimer: { agreedAt: "2026-10-14T00:00:00.000Z", version: 1 } }, 1) === true);
["mounjaro", "ozempic", "wegovy", "zepbound", "saxenda", "rybelsus", "trulicity"].forEach(function (w) {
  check("no named substance in shipped copy: " + w, allCopy.indexOf(w) === -1);
});
const pepState = L.repairState({ peptides: [
  { name: "A", amount: "2.5" }, { name: "B", amount: "1" }] });
check("two peptides repaired with distinct colours", pepState.peptides[0].color !== pepState.peptides[1].color);
check("peptide next dose chains without repeats", (() => {
  var p = { schedule: { days: [3] } };
  var a = L.nextDoseKey(p, "2026-10-14");
  var b2 = L.nextDoseKey(p, L.addDays(a, 1));
  return a === "2026-10-14" && b2 === "2026-10-21";
})());

/* --- Phase 6: account merge + door (P2 live flip) --- */
const cloudState = { profile: { name: "Cloud", setupDone: false }, treats: [{ id: "t1", name: "Cloud cake" }],
  checkins: { "2026-10-13": "great" }, disclaimer: { agreedAt: "2026-10-13T08:00:00.000Z", version: 1 },
  todos: [{ id: "a", title: "Cloud task" }] };
const localState = { profile: { name: "Sam", setupDone: true }, treats: [{ id: "t2", name: "Local chips" }],
  checkins: { "2026-10-14": "bad" }, disclaimer: { agreedAt: "2026-10-14T08:00:00.000Z", version: 1 },
  todos: [{ id: "b", title: "Local task" }] };
const merged = L.mergeStates(cloudState, localState);
check("merge keeps both treats (nothing dropped)", merged.treats.length === 2);
check("merge keeps both check-ins", merged.checkins["2026-10-13"] === "great" && merged.checkins["2026-10-14"] === "bad");
check("merge keeps the earliest disclaimer agreement", merged.disclaimer.agreedAt === "2026-10-13T08:00:00.000Z");
check("merge profile comes from the finished setup", merged.profile.name === "Sam");
check("merge keeps both todos", merged.todos.length === 2);
check("merge with empty cloud returns local safely", L.mergeStates(null, localState).treats.length === 1);
check("size watch measures every slice", (() => { const s = L.sliceSizes({ treats: [{ id: "a" }], profile: { name: "Sam" } }); return typeof s.treats === "number" && s.treats > 0 && typeof s.profile === "number"; })());
check("size watch flags only over-line slices", (() => { const big = { sessions: [{ note: "x".repeat(800000) }], profile: { name: "Sam" } }; const over = L.oversizedSlices(big); return over.length === 1 && over[0] === "sessions"; })());
check("size watch warn line sits under the 1 MiB ceiling", L.SLICE_WARN_BYTES < 1048576);
check("auth door is email+password beside Google + Apple (Ilse ruling 15 Oct)", (() => { const src = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return src.indexOf("signInWithEmailAndPassword") >= 0 && src.indexOf("createUserWithEmailAndPassword") >= 0 && src.indexOf("sendPasswordResetEmail") >= 0 && src.indexOf("sendSignInLinkToEmail") === -1 && src.indexOf("GoogleAuthProvider") >= 0 && src.indexOf("OAuthProvider") >= 0; })());
check("delete reauths a password user with the typed password", (() => { const src = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return src.indexOf("fit/reauth-password") >= 0 && src.indexOf("EmailAuthProvider.credential") >= 0 && src.indexOf("reauth-link") === -1; })());
check("NO DEMO (her 20:57 rule): auth carries no anonymous door at all", (() => { const src = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return src.indexOf("signInAnonymously") === -1 && src.indexOf("enterDemoSession") === -1 && src.indexOf("ensureDoor") === -1; })());
check("the door step 1 is pure and big (big mark, icon-only Google + Apple, one email field, big round next arrow)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const s1 = src.slice(src.indexOf("doorBigName"), src.indexOf("function doorNext()")); return src.indexOf("doorBigMark") >= 0 && s1.indexOf('tr("door.sub")') >= 0 && require(require("path").join(process.cwd(), "i18n.js")).EN["door.sub"] === "Sign in or make your account" && s1.indexOf("doorIcons") >= 0 && s1.indexOf("accGoogleBtn") >= 0 && s1.indexOf("accAppleBtn") >= 0 && s1.indexOf("accNextBtn") >= 0 && s1.indexOf('tr("door.orEmail")') >= 0 && require(require("path").join(process.cwd(), "i18n.js")).EN["door.orEmail"] === "or with email" && s1.indexOf("accPass") === -1 && s1.indexOf("accContinueBtn") === -1 && s1.indexOf("accForgotBtn") === -1 && src.indexOf('id=\"accName\"') === -1 && src.indexOf("accSignInBtn") === -1 && src.indexOf("accSignUpBtn") === -1 && src.indexOf("accLinkBtn") === -1 && src.indexOf("sendSignInLink") === -1; })());
check("the password lives on step 2 only (email shown with Change, one button, honest caption, reset line)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const s2 = src.slice(src.indexOf("doorStep === 2"), src.indexOf("doorBigName")); return s2.indexOf("accPass") >= 0 && s2.indexOf("accChangeBtn") >= 0 && s2.indexOf("accContinueBtn") >= 0 && s2.indexOf("accForgotBtn") >= 0; })());
check("the ruled step-2 words live verbatim in the language layer's English table (Quality's Item 1)", (() => { const L = require(require("path").join(process.cwd(), "i18n.js")); return L.EN["door.continueBtn"] === "Continue" && L.EN["door.continueHint"] === "This one button does both. It signs you in, or makes your account if you are new."; })());
check("the language layer: Spanish covers every non-legal English key; a missing key falls back to English", (() => { const L = require(require("path").join(process.cwd(), "i18n.js")); const en = Object.keys(L.EN), es = Object.keys(L.ES); return en.every((k) => L.LEGAL[k] || es.indexOf(k) >= 0) && L.use("es") === "es" && L.t("door.sub") === "Inicia sesión o crea tu cuenta" && L.t("no.such.key") === "no.such.key"; })());
check("the legal fence holds a real string: the tracking-note status renders English under Spanish", (() => { const L = require(require("path").join(process.cwd(), "i18n.js")); return L.use("es") === "es" && L.t("legal.noteStatus") === L.EN["legal.noteStatus"] && L.t("legal.noteStatus").indexOf("not a doctor") >= 0 && L.ES["legal.noteStatus"] === undefined; })());
check("the layer's legal disclaimer text is the data text of record, char for char", (() => { const L = require(require("path").join(process.cwd(), "i18n.js")); const fsx = require("fs"); const dsrc = fsx.readFileSync(new URL("../data.js", import.meta.url), "utf8"); const m = dsrc.match(/DISCLAIMER_TEXT = "([^"]+)" \+\s*"([^"]+)" \+\s*"([^"]+)";/); return !!m && L.EN["legal.disclaimer"] === m[1] + m[2] + m[3]; })());
check("speech boxes: every player bubble in the layer equals its track text of record", (() => { const L = require(require("path").join(process.cwd(), "i18n.js")); const fsx = require("fs"); global.window = global.window || {}; eval(fsx.readFileSync(new URL("../anim-data.js", import.meta.url), "utf8")); const T = global.window.FIT_ANIM || {}; return Object.keys(T).every((id) => (T[id].bubbles || []).every((b, i) => L.EN["bub." + id + "." + i] === b && typeof L.ES["bub." + id + "." + i] === "string")); })());
check("FIT-L4-1: the CEO page ships door-only (no dashboard shell or numbers in the static document)", (() => { const h = require("fs").readFileSync(new URL("../owner.html", import.meta.url), "utf8"); return h.indexOf("doorBox") >= 0 && h.indexOf("dashBox") === -1 && h.indexOf("signups") === -1 && h.indexOf("ownerMount") >= 0; })());
check("FIT-L4-1: the shell mounts only after the owner gate reads _owner/config, and leaves on sign-out", (() => { const j = require("fs").readFileSync(new URL("../owner.js", import.meta.url), "utf8"); const iCfg = j.indexOf('"_owner", "config"'); const iMount = j.indexOf("mountShell();", iCfg); return iCfg >= 0 && iMount > iCfg && j.indexOf("const SHELL") >= 0 && j.indexOf("unmountShell(); show(") >= 0; })());
check("the legal fence: legal keys never resolve from the ordinary tables (English until human-checked)", (() => { const L = require(require("path").join(process.cwd(), "i18n.js")); return Object.keys(L.ES).every((k) => k.indexOf("legal.") !== 0) && Object.keys(L.HUMAN.es).length === 0 && L.use("es") === "es" && L.t("legal.disclaimer") === L.EN["legal.disclaimer"] && L.t("legal.disclaimer").indexOf("not a doctor") >= 0; })());
check("the language layer ships wired (script order, boot resolution, Settings row, SW precache)", (() => { const idx = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); const app = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const sw = require("fs").readFileSync(new URL("../service-worker.js", import.meta.url), "utf8"); return idx.indexOf("i18n.js") > 0 && idx.indexOf("i18n.js") < idx.indexOf("app.js") && app.indexOf("Lang.use(state.settings") >= 0 && idx.indexOf("langEsBtn") >= 0 && app.indexOf('setLang("es")') >= 0 && sw.indexOf('"i18n.js"') >= 0; })());
check("the one email button walks both roads (sign-in, then create on a credential refusal)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const i = src.indexOf("accContinueBtn"); const j = src.indexOf("signInWithEmail", i); const k = src.indexOf("signUpWithEmail", j); return i >= 0 && j > i && k > j && src.indexOf("auth/email-already-in-use", k) > k; })());
check("the reset path lives on the password step, behind the email step (frame shape of record)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const s2 = src.slice(src.indexOf("doorStep === 2"), src.indexOf("doorBigName")); const s1 = src.slice(src.indexOf("doorBigName"), src.indexOf("function doorNext()")); return s2.indexOf("accForgotBtn") >= 0 && src.indexOf("resetPassword") >= 0 && s1.indexOf("accForgotBtn") === -1; })());
check("no-founder sweep: zero founder references in shipped files", (() => { const fs2 = require("fs"); const files = ["index.html","styles.css","app.js","auth.js","logic.js","data.js","wally.js","i18n.js","accounts-config.js","meals-data.js","meals-logic.js","meals-nutrition.js","exercises-data.js","anim.js","anim-data.js","anim-data-expansion.js","i18n-content.js","calendar-import.js","vendor/ical/ical.min.js","service-worker.js","manifest.webmanifest","privacy.html","owner.js","owner.html"]; const hit = files.filter(f => /ilse|placencia/i.test(fs2.readFileSync(new URL("../" + f, import.meta.url), "utf8"))); return hit.length === 0; })());
check("the guide's tour asks the name inside the app (Law F via the tour; no name screen exists)", (() => { const fs2 = require("fs"); const html = fs2.readFileSync(new URL("../index.html", import.meta.url), "utf8"); const src = fs2.readFileSync(new URL("../app.js", import.meta.url), "utf8"); return html.indexOf('id="tourRoot"') >= 0 && html.indexOf('id="tourCard"') >= 0 && html.indexOf('id="nameModal"') === -1 && html.indexOf('id="nameBubble"') === -1 && src.indexOf("renderTour") >= 0 && require(require("path").join(process.cwd(), "i18n.js")).EN["tour.ask"] === "What's your name?" && src.indexOf('tr("tour.skip")') >= 0 && require(require("path").join(process.cwd(), "i18n.js")).EN["tour.skip"] === "Skip tour" && src.indexOf("tourSeen") >= 0 && src.indexOf("joinFollowUp") >= 0 && src.indexOf("adoptSignInName") >= 0 && src.indexOf("user.displayName") >= 0; })());
check("the tour runs once and closes for good (tourSeen saved in settings, X and Skip both end it)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const end = src.slice(src.indexOf("function endTour()"), src.indexOf("function onSignedIn")); return src.indexOf("state.settings.tourSeen") >= 0 && end.indexOf("tourSeen = true") >= 0 && src.indexOf('id="tourX"') >= 0 && src.indexOf('id="tourSkip"') >= 0 && src.indexOf('id="tourDone"') >= 0; })());
check("a blank name SAILS (HQ 22:52: a missing name blocks nothing, the stop line is retired everywhere)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const adv = src.slice(src.indexOf("function tourAdvance()"), src.indexOf("function endTour()")); return src.indexOf("Type your name first") === -1 && adv.indexOf("if (v && (tourReplay || !state.profile.name)") >= 0 && adv.indexOf("return;") === -1 && adv.indexOf("tourStep += 1") > adv.indexOf("if (v && (tourReplay || !state.profile.name)"); })());
check("the tour replays from Settings (door present, tourSeen never consulted by the replay, replay never re-arms the re-offer)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const html = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); const rp = src.slice(src.indexOf("function replayTour()"), src.indexOf("function replayTour()") + 420); const et = src.slice(src.indexOf("function endTour()"), src.indexOf("function replayTour()")); return html.indexOf('id="tourReplayBtn"') >= 0 && rp.indexOf("tourSeen") === -1 && rp.indexOf("renderTour()") >= 0 && et.indexOf("!wasReplay && tourAskedName") >= 0; })());
check("a replay can never erase a saved name (names are only written from a non-blank field)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); return src.indexOf('state.profile.name = ""') === -1 && src.indexOf("delete state.profile.name") === -1 && src.indexOf("tourReplay && name ? esc(name)") >= 0; })());
check("the name re-offer: unanswered tour end owes ONE next-visit bubble, spent at show, never same-session", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const html = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); const end = src.slice(src.indexOf("function endTour()"), src.indexOf("/* THE UPGRADE MOMENT")); const maybe = src.slice(src.indexOf("function maybeNameReoffer()"), src.indexOf("function tourDots()")); return html.indexOf('id="nameReoffer"') >= 0 && end.indexOf('nameReoffer = "pending"') >= 0 && end.indexOf("tourAskedName") >= 0 && maybe.indexOf('state.settings.nameReoffer !== "pending"') >= 0 && maybe.indexOf('nameReoffer = "done"') >= 0 && maybe.indexOf("tourRanThisSession") >= 0 && maybe.indexOf("reofferShownThisSession = true") > maybe.indexOf('nameReoffer = "done"'); })());
check("Wally greets the user by name in his welcome line", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const L = require(require("path").join(process.cwd(), "i18n.js")); return src.indexOf("wallyWelcomeLine") >= 0 && src.indexOf('tr("today.hiName", { name: nm })') >= 0 && L.EN["today.hiName"] === "Hi, {name}."; })());
check("area cards carry theme ink (button text cannot fall back to black)", (() => { const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); const row = css.split("\n").find(x => x.indexOf(".areaCard{") === 0) || ""; return row.indexOf("color:var(--ink)") >= 0; })());
check("image mode: muted text takes the darker token, veil stays .90", (() => { const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); const img = css.slice(css.indexOf('body[data-appearance="image"]'), css.indexOf('*{box-sizing')); return img.indexOf("--mut:#5D4C3A") >= 0 && img.indexOf("rgba(250,238,214,.90)") >= 0; })());
check("check-in set reads exactly Bad, Ok, Great in order", (() => { const src = require("fs").readFileSync(new URL("../data.js", import.meta.url), "utf8"); const block = src.slice(src.indexOf("var CHECKINS"), src.indexOf("var DISCLAIMER_VERSION")); const li = ["label: \"Bad\"", "label: \"Ok\"", "label: \"Great\""].map(x => block.indexOf(x)); const ii = ["id: \"bad\"", "id: \"ok\"", "id: \"great\""].map(x => block.indexOf(x)); return li.every(v => v >= 0) && li[0] < li[1] && li[1] < li[2] && ii.every(v => v >= 0) && ii[0] < ii[1] && ii[1] < ii[2]; })());
check("saved old check-ins migrate, none dropped (rough/steady/good)", (() => { const r = L.repairState({ checkins: { "2026-10-01": "rough", "2026-10-02": "steady", "2026-10-03": "good", "2026-10-04": "bad" } }); return r.checkins["2026-10-01"] === "bad" && r.checkins["2026-10-02"] === "ok" && r.checkins["2026-10-03"] === "great" && r.checkins["2026-10-04"] === "bad" && Object.keys(r.checkins).length === 4; })());
check("nav ruling: phone-open sidebar takes the screen minus a 44px sliver", (() => { const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return css.indexOf("calc(100vw - 44px)") >= 0 && css.indexOf("#sbShield") >= 0; })());
check("nav ruling: sliver shield exists + tapping it closes the menu", (() => { const html = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); const app = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); return html.indexOf('id="sbShield"') >= 0 && app.indexOf('"sbShield"') >= 0 && app.indexOf("sbOpen = false") >= 0; })());
check("owner door matches the app door (password sign-in, no link)", (() => { const src = require("fs").readFileSync(new URL("../owner.js", import.meta.url), "utf8"); return src.indexOf("signInWithEmailAndPassword") >= 0 && src.indexOf("sendSignInLinkToEmail") === -1; })());
check("merge dedupes same id, keeps one copy", L.mergeStates({ treats: [{ id: "t2", name: "X" }] }, localState).treats.length === 1);
/* QA Phase 6 F1 class: a corrupt cloud doc must fall back, never throw. */
check("merge never throws on QA F1 broken doc (string list, numeric profile)", (() => { try { const m = L.mergeStates({ todos: "junk", profile: 42 }, localState); return Array.isArray(m.todos) && m.todos.length === 1 && m.todos[0].id === "b"; } catch (e) { return false; } })());
check("merge treats non-array lists on both sides as empty", (() => { try { return L.mergeStates({ treats: "junk" }, { treats: 7 }).treats.length === 0; } catch (e) { return false; } })());
/* Collision rule (desk ruling on QA's carried observation): progress never runs backwards. */
check("collision: local done beats cloud open", L.mergeStates({ todos: [{ id: "x", title: "T", status: "open" }] }, { todos: [{ id: "x", title: "T", status: "done" }] }).todos[0].status === "done");
check("collision: cloud done beats local open", L.mergeStates({ todos: [{ id: "x", title: "T", status: "done" }] }, { todos: [{ id: "x", title: "T", status: "open" }] }).todos[0].status === "done");
check("collision: session done flag beats unfinished either way", L.mergeStates({ sessions: [{ id: "s", done: false }] }, { sessions: [{ id: "s", done: true }] }).sessions[0].done === true && L.mergeStates({ sessions: [{ id: "s", done: true }] }, { sessions: [{ id: "s", done: false }] }).sessions[0].done === true);
const htmlIndex = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
/* P2 door flip (14 Oct): the door is LIVE now. The invariants
   that replace dormancy: config loads before app.js, auth.js
   loads as a module, the config is this app's own project,
   and every non-door file still carries zero firebase code. */
check("door flip: index.html loads accounts-config.js before app.js", htmlIndex.indexOf("accounts-config.js") !== -1 && htmlIndex.indexOf("accounts-config.js") < htmlIndex.indexOf("app.js"));
check("door flip: auth.js loads as a module", htmlIndex.indexOf('type="module" src="auth.js"') !== -1);
check("door flip: config is the Fit App project only", (() => { const c = fs.readFileSync(new URL("../accounts-config.js", import.meta.url), "utf8"); return c.indexOf("fit-app-7f25f") !== -1 && c.indexOf("FIT_ACCOUNT_CONFIG = null") === -1; })());
check("door flip: auth.js announces fit-auth-ready", fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8").indexOf("fit-auth-ready") !== -1);
/* --- NO DEMO (her 20:57 rule, build 17): the demo is GONE.
   The door is sign up or sign in, always. These pins hold
   the absence: no entry, no session, no seed, no words. --- */
check("NO DEMO: the app carries no demo entry, session or seed anywhere", (() => { const fs8 = require("fs"); const a = fs8.readFileSync(new URL("../app.js", import.meta.url), "utf8"); const au = fs8.readFileSync(new URL("../auth.js", import.meta.url), "utf8"); const h = fs8.readFileSync(new URL("../index.html", import.meta.url), "utf8"); const sw = fs8.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8"); return !fs8.existsSync(new URL("../demo-seed.js", import.meta.url)) && a.indexOf("accDemoBtn") === -1 && a.indexOf("accReviewerBtn") === -1 && a.indexOf("accCodeBtn") === -1 && a.indexOf("enterDemo") === -1 && a.indexOf("startDemo") === -1 && a.indexOf("demoMode") === -1 && a.indexOf("FitDemo") === -1 && au.indexOf("enterDemoSession") === -1 && h.indexOf("demo-seed") === -1 && h.indexOf("demoBanner") === -1 && sw.indexOf("demo-seed") === -1; })());
check("NO DEMO: the word layer carries no demo words in either language", (() => { const i9 = require("fs").readFileSync(new URL("../i18n.js", import.meta.url), "utf8"); return ["door.demoBtn","door.demoHint","door.reviewerBtn","acc.demoExploring","acc.leaveDemo","plan.demoLine","toast.demoClosed"].every(k => i9.indexOf('"' + k + '"') === -1); })());
check("demo unlock rides repair as string-or-null", L.repairState({ demoUnlock: "abc" }).demoUnlock === "abc" && L.repairState({ demoUnlock: 42 }).demoUnlock === null && L.repairState({}).demoUnlock === null);
check("demo unlock merges cloud-first", L.mergeStates({ demoUnlock: "c" }, { demoUnlock: "l" }).demoUnlock === "c" && L.mergeStates({}, { demoUnlock: "l" }).demoUnlock === "l");
check("P4 F1 fence: slice setDoc is INVOKED only after the root write (invocation order, not await order)", (() => { const a = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8"); const iRoot = a.indexOf("await setDoc(doc(db, \"users\", uid), rootDocData)"); const iSliceCall = a.indexOf("setDoc(doc(db, \"users\", uid, \"slices\""); return iRoot !== -1 && iSliceCall !== -1 && iSliceCall > iRoot && a.indexOf("sliceData.push") !== -1; })());
const loadedFiles = ["app.js", "logic.js", "data.js", "meals-logic.js", "meals-data.js", "meals-nutrition.js", "exercises-data.js"];
const leaks = loadedFiles.filter(f => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8").toLowerCase().indexOf("firebase") !== -1);
check("door flip: zero firebase strings in the non-door files", leaks.length === 0);

/* --- Phase 7: rough-day shaping --- */
const shapeSrc = [
  { id: "1", title: "A", status: "open", time: null }, { id: "2", title: "B", status: "open", time: "18:00" },
  { id: "3", title: "C", status: "open", time: null }, { id: "4", title: "D", status: "open", time: null },
  { id: "5", title: "E", status: "done", time: null }];
const shapedBad = L.shapeTodosForDay(shapeSrc, "bad");
check("bad day shows done + timed + first two untimed", shapedBad.shown.length === 4);
check("bad day counts the waiting ones, drops none", shapedBad.waiting === 1 && shapedBad.shown.length + shapedBad.waiting === 5);
check("bad day keeps the timed commitment", shapedBad.shown.some(t => t.id === "2"));
check("ok day shows everything", L.shapeTodosForDay(shapeSrc, "ok").shown.length === 5);
check("good day shows everything", L.shapeTodosForDay(shapeSrc, "good").waiting === 0);
check("shaping never mutates the source list", shapeSrc.length === 5);

/* --- v2: Wally build rules (Lab art of record) --- */
const wallySrc = fs.readFileSync(new URL("../wally.js", import.meta.url), "utf8");
check("wally art is the simple-flat welcome of record", wallySrc.indexOf("assets/wally-welcome.webp") !== -1);
check("wally rest state is the rest art of record", wallySrc.indexOf("assets/wally-rest.webp") !== -1);
check("all wally poses exist", ["welcome", "bright", "celebrate", "soft", "rough", "rest"].every(p => wallySrc.indexOf(p + ":") !== -1));
check("rough day pose is its own frame of record", wallySrc.indexOf("assets/wally-rough.webp") !== -1);
const WALLY_BUBBLES = ["You showed up. Noted.", "Small counts.", "Burrow day counts too.",
  "Rest is training too.", "Tea first. Then, maybe.", "Tomorrow is also a day."];
WALLY_BUBBLES.forEach(function (bb) {
  check("wally bubble verbatim: " + bb, wallySrc.indexOf(bb) !== -1);
  bb.split(". ").forEach(function (line) {
    const words = line.replace(/[.,]/g, "").split(/\s+/).filter(Boolean).length;
    check("bubble line is 6 words or fewer: " + line, words <= 6);
  });
  check("bubble has no dashes: " + bb, !/—|–|-/.test(bb));
});
/* Moss is OUT of every shipped surface (the settings-key
   migration read in app.js is a data key, not the character). */
const shipped = ["../index.html", "../styles.css", "../data.js", "../privacy.html", "../wally.js"]
  .map(u => fs.readFileSync(new URL(u, import.meta.url), "utf8")).join("\n");
check("no Moss anywhere in shipped surfaces", !/moss/i.test(shipped));
check("no retired guide code in app.js", (() => { const a = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"); return a.indexOf("window.Moss") === -1 && a.indexOf("moss.js") === -1 && a.indexOf("Moss") === -1; })());
check("old palette hexes are gone from the skin", ["#DE5A83", "#8B5CF6", "#2F7CF6", "#1F9D8A", "#F2A93B", "#FFF8F4", "#2B2230"].every(h => shipped.indexOf(h) === -1 && fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").indexOf(h) === -1));

/* --- v2: name, icon, fonts --- */
const indexSrc = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
check("the app is Fit Hard in the title", indexSrc.indexOf("<title>Fit Hard</title>") !== -1);
check("manifest carries the locked name", (() => { const m = JSON.parse(fs.readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8")); return m.name === "Fit Hard" && m.short_name === "FitHard"; })());
check("the shipped icon is the Gentle Stretch record export (byte-identical to the brand master, never a code drawing)", (() => { const cr2 = require("crypto"); const h = (p) => cr2.createHash("md5").update(fs.readFileSync(new URL(p, import.meta.url))).digest("hex"); return h("../icons/icon-512.png") === h("../brand/icon-final/icon-master-512.png") && h("../icons/icon-32.png") === h("../brand/icon-final/icon-master-32.png"); })());
check("fonts are self-hosted (no Google Fonts link)", indexSrc.indexOf("fonts.googleapis") === -1 && shipped.indexOf("Zilla Slab") !== -1 && shipped.indexOf("Karla") !== -1);

/* --- v2: Law E appearance --- */
check("four appearance themes exist in the skin", ["brand", "white", "black", "image"].every(m => m === "brand" || shipped.indexOf('[data-appearance="' + m + '"]') !== -1));
check("appearance survives repair (Law B settings carry-through)", (() => { const st = L.repairState({ settings: { appearance: { mode: "black", image: null } } }).settings; return st.appearance.mode === "black"; })());
check("blanket customisation lives in app.js (pack spec)", (() => { const a = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"); return a.indexOf("blanketColor") !== -1 && a.indexOf("BLANKETS") !== -1; })());
check("appearance engine + photo shrink live in app.js", (() => { const a = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"); return a.indexOf("appearanceOf") !== -1 && a.indexOf("toDataURL") !== -1 && a.indexOf("--bgimg") !== -1; })());
function lum(hex) { const v = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
check("brand: ink on cream is AAA", ratio("#3E2F26", "#FAEED6") >= 7);
check("brand: sage on cream passes AA", ratio("#52695A", "#FAEED6") >= 4.5);
check("brand: muted text on cream passes AA", ratio("#6E5D4B", "#FAEED6") >= 4.5);
check("white theme: ink on white is AAA", ratio("#3E2F26", "#FFFFFF") >= 7);
check("black theme: ink on ground is AAA", ratio("#F6EDDD", "#17120E") >= 7);
check("black theme: dark text on sage accent passes AA", ratio("#221A12", "#A9BFA5") >= 4.5);
check("image veil keeps ink readable over a black photo", (() => { const r = Math.round(0.9 * 250 + 0.1 * 0), g = Math.round(0.9 * 238 + 0.1 * 0), b = Math.round(0.9 * 214 + 0.1 * 0); const h = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join(""); return ratio("#3E2F26", h) >= 7; })());
check("service worker is fitapp-v90 with the v2 file list (build 17 fold)", (() => { const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8"); return sw.indexOf("fitapp-v90") !== -1 && sw.indexOf("fitapp-v89") === -1 && sw.indexOf("demo-seed.js") === -1 && sw.indexOf("wally.js") !== -1 && sw.indexOf("moss.js") === -1 && sw.indexOf("ZillaSlab-700.woff2") !== -1 && sw.indexOf("wally-rest.webp") !== -1; })());
check("FIT-001: every service worker precache entry ships in the store bundle (no excluded names, every file on disk)", (() => { const fs2 = require("fs"); const sw = fs2.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8"); const m = sw.match(/var FILES = \[(.*?)\];/s); if (!m) return false; const entries = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]); const excluded = e => e === "privacy.html" || e === "anim-preview.html" || /(^|\/)owner\.(html|js)$/.test(e); return entries.every(e => e === "./" || (!excluded(e) && fs2.existsSync(new URL("../" + e, import.meta.url)))); })());
check("FIT-003: every file input carries an accessible name (aria-label)", (() => { const fs3 = require("fs"); const idx = fs3.readFileSync(new URL("../index.html", import.meta.url), "utf8"); const app = fs3.readFileSync(new URL("../app.js", import.meta.url), "utf8"); const tags = (idx + app).match(/<input[^>]*type="file"[^>]*>/g) || []; return tags.length >= 5 && tags.every(t => /aria-label="[^"]+"/.test(t)); })());
check("QA leg 7: a completed restored profile closes the setup sheet (settle helper, restore landings, unconditional door-first boot)", (() => { const app = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); return app.indexOf("function settleSetupSheet()") !== -1 && (app.match(/settleSetupSheet\(\);/g) || []).length >= 2 && app.indexOf("demoReturning") === -1 && app.slice(app.lastIndexOf("initAccounts();")).indexOf('showView("settings")') !== -1; })());
check("QA leg 6: fridge Add buttons bind once only (dataset.bound guard in bindRows)", (() => { const app = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const i = app.indexOf("function bindRows()"); return i !== -1 && app.slice(i, i + 400).indexOf("b.dataset.bound") !== -1; })());
check("PAYMENTS: the routine cap gates all three creation entries through the entitlement seam, and the locked tap speaks (EN+ES)", (() => { const fs4 = require("fs"); const app = fs4.readFileSync(new URL("../app.js", import.meta.url), "utf8"); const L3 = require(require("path").join(process.cwd(), "i18n.js")); return app.indexOf("var FREE_ROUTINE_CAP = 3;") !== -1 && app.indexOf("function planNow()") !== -1 && app.indexOf("window.FitAuth.entitlement()") !== -1 && app.indexOf("function lockedTap()") !== -1 && (app.match(/maySaveRoutine\(\)/g) || []).length >= 4 && L3.EN["pro.lockedTap"] === "That is a Pro extra. Unlock with a paid plan." && L3.ES["pro.lockedTap"] === "Eso es un extra Pro. Desbloquéalo con un plan de pago."; })());
check("PAYMENTS §3: the entitlement evaluation is existence-only (the rules gate reads no record field; the client touches only its tier slice) — cancelled-in-period opens and expiry closes through the receiver's record lifecycle", (() => { const fs5 = require("fs"); const rules = fs5.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"); const auth = fs5.readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return rules.indexOf("return exists(/databases/$(database)/documents/_comp/$(uid));") !== -1 && auth.indexOf('doc(db, "_comp"') === -1 && auth.indexOf('doc(db, "users", uid, "slices", "tier")') !== -1; })());
check("F1 (QA build 5): the free month anchors to the AUTH account creation time, never the per-device profile stamp (the auth fact wins in resolution)", (() => { const a6 = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return a6.indexOf("u.metadata.creationTime") !== -1 && a6.indexOf("function noteAuthAnchor") !== -1 && a6.indexOf("resolveTier(resolvedPlan, authAnchorIso || accountAgeStart, Date.now())") !== -1; })());
check("F2 (G7): the paywall carries the renewal disclosure + Privacy/Terms links on Plans AND the Pro modal, prices composed from the buttons' own source; the modal body sells the built set only", (() => { const fs6 = require("fs"); const app = fs6.readFileSync(new URL("../app.js", import.meta.url), "utf8"); const html = fs6.readFileSync(new URL("../index.html", import.meta.url), "utf8"); const L4 = require(require("path").join(process.cwd(), "i18n.js")); return app.indexOf("function paywallLegalHtml()") !== -1 && app.indexOf("paywallLegalHtml() + ") !== -1 && app.indexOf('renew.innerHTML = paywallLegalHtml()') !== -1 && app.indexOf("priceText(\"monthly\").text") !== -1 && html.indexOf('id="proRenew"') !== -1 && html.indexOf('href="https://support897.github.io/fit-hard/privacy.html"') !== -1 && typeof L4.EN["plan.renewPro"] === "string" && L4.EN["plan.renewPro"].indexOf("Apple ID subscriptions") !== -1 && L4.ES["plan.renewPro"] === "Pro ({m} al mes · {y} al año) se renueva solo hasta que lo canceles. Cancela cuando quieras en las suscripciones de tu Apple ID. Pro sigue abierto hasta el fin del periodo pagado." && L4.EN["plan.renewForever"] === "Forever is one payment. It never renews." && L4.ES["plan.renewForever"] === "Forever es un solo pago. Nunca se renueva." && L4.EN["pro.body"] === "Unlimited saved routines, for every goal and every machine." && L4.ES["pro.body"] === "Rutinas guardadas ilimitadas, para cada objetivo y cada máquina."; })());
check("LOGO (her order, 19 Oct): every shipped mark is the APPROVED graphic (the Gentle Stretch record exports) — no code-drawn icon.svg anywhere on a shipped surface; the door + owner marks use icon-512 (byte-identical to the brand master)", (() => { const fs7 = require("fs"); const cr = require("crypto"); const rd = (p) => fs7.readFileSync(new URL(p, import.meta.url), "utf8"); const surfaces = ["../index.html", "../app.js", "../owner.html", "../manifest.webmanifest", "../service-worker.js"].map(rd).join("\n"); const md5 = (p) => cr.createHash("md5").update(fs7.readFileSync(new URL(p, import.meta.url))).digest("hex"); return surfaces.indexOf("icon.svg") === -1 && !fs7.existsSync(new URL("../icon.svg", import.meta.url)) && rd("../app.js").indexOf('doorBigMark"><img src="icons/icon-512.png"') !== -1 && md5("../icons/icon-512.png") === md5("../brand/icon-final/icon-master-512.png"); })());


/* --- Test-user cast (Security TEST-PLAN, 14 Oct): build-side
   halves of the PZ + SAVED + NS legs. The live legs run on
   the project with the cast minted per run. --- */
const { makeCast, CAST_EMAILS } = await import("./test-cast.mjs");
const cast = makeCast(L.todayKey());
check("cast identities follow the spec pattern", CAST_EMAILS.A === "sec-fithard-a@example.com" && CAST_EMAILS.B === "sec-fithard-b@example.com" && CAST_EMAILS.C === "sec-fithard-c@example.com");
check("cast worlds are marked test content", [cast.A, cast.B, cast.C].every(u => u.profile.name.indexOf("Test User") === 0));
check("PZ: the three worlds differ (background, guide name, check-in)",
  cast.A.settings.appearance.mode !== cast.C.settings.appearance.mode &&
  cast.B.settings.appearance.mode !== cast.A.settings.appearance.mode &&
  new Set([cast.A, cast.B, cast.C].map(u => u.settings.companionName)).size === 3 &&
  cast.A.checkins[L.todayKey()] === "rough" && cast.C.checkins[L.todayKey()] === "good");
function countsOf(st) { return [st.peptides.length, st.habits.length, st.todos.length, st.treats.length].join("/"); }
check("SAVED: cast round trip through repair keeps counts in = out",
  [cast.A, cast.B, cast.C].every(u => countsOf(L.repairState(JSON.parse(JSON.stringify(u)))) === countsOf(u)));
check("SAVED: cast round trip keeps the whole world (appearance, guide, disclaimer)",
  (() => { const a = L.repairState(JSON.parse(JSON.stringify(cast.A)));
    return a.settings.appearance.mode === "black" && a.settings.appearance.image.indexOf("TESTSEEDA") !== -1 &&
      a.settings.companionName === "Biscuit" && a.disclaimer && a.disclaimer.version === 1; })());
check("PZ: shaping is per-user (A rough shapes, C good shows all, neither touches the other)",
  (() => { const a = L.repairState(JSON.parse(JSON.stringify(cast.A)));
    const c = L.repairState(JSON.parse(JSON.stringify(cast.C)));
    const sa = L.shapeTodosForDay(a.todos, a.checkins[L.todayKey()]);
    const sc = L.shapeTodosForDay(c.todos, c.checkins[L.todayKey()]);
    return sa.shown.length < a.todos.length && sa.shown.length + sa.waiting === a.todos.length &&
      sc.shown.length === c.todos.length && c.todos.length === 3 && a.todos.length === 5; })());
check("NS-3: a Law E upload lives inside the owner's settings (uid slice), never the root keys",
  (() => { const auth = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8");
    return auth.indexOf('const ROOT_KEYS = ["profile", "disclaimer"]') !== -1 &&
      cast.A.settings.appearance.image.indexOf("data:image/") === 0; })());
check("peptide tracking data rides the uid slices like everything private",
  (() => { const auth = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8");
    return auth.indexOf('"slices"') !== -1 && cast.A.peptides.length === 2; })());
check("DSI fence: every server delete call lives inside deleteAccount",
  (() => { const auth = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8");
    const start = auth.indexOf("async function deleteAccount");
    const end = auth.indexOf("window.FitAuth = {", start);
    const span = auth.slice(start, end);
    const outside = auth.slice(0, start) + auth.slice(end);
    return span.indexOf("deleteDoc(") !== -1 && span.indexOf("deleteUser(") !== -1 &&
      outside.indexOf("deleteDoc(") === -1 && outside.indexOf("await deleteUser") === -1; })());


/* --- Two-hat build (pattern v2): comp, tier, owner space --- */
check("repair carries the tier slice (pro survives)", L.repairState({ tier: { plan: "pro" } }).tier.plan === "pro");
check("repair normalises a junk tier to free, never crashes", L.repairState({ tier: { plan: "gold" } }).tier.plan === "free" && L.repairState({ tier: "pro" }).tier === undefined);
check("tier never touches the meal plan (name collision guard)", (() => { const st = L.repairState({ plan: { "2026.10.14": { dinner: "Soup" } }, tier: { plan: "pro" } }); return st.plan["2026.10.14"].dinner === "Soup" && st.tier.plan === "pro"; })());
const authSrc2 = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8");
check("syncPlan asks the tier slice, never a comp read", authSrc2.indexOf("syncPlan") !== -1 && authSrc2.indexOf('"tier"') !== -1 && authSrc2.indexOf('"_comp"') === -1 && authSrc2.indexOf('"slices", "tier"') !== -1);
check("planOf reads the tier slice only", authSrc2.indexOf("state.tier") !== -1);
check("entitlement resolves fail-closed from the sync ask (pattern ruling)", authSrc2.indexOf("function entitlement()") !== -1 && authSrc2.indexOf("resolvedPlan") !== -1);
check("the app bundle has no owner trace (OA-4 build half)", (() => {
  const bundle = ["../index.html", "../app.js", "../auth.js", "../styles.css"]
    .map(u => fs.readFileSync(new URL(u, import.meta.url), "utf8")).join("\n");
  return bundle.indexOf("owner.html") === -1 && bundle.indexOf("_owner") === -1 && bundle.indexOf("owner.js") === -1; })());
check("owner surface reads only the _owner space (NS-1/TW-4 build half)", (() => {
  const o = fs.readFileSync(new URL("../owner.js", import.meta.url), "utf8");
  return o.indexOf('"_owner"') !== -1 && o.indexOf('doc(db, "users"') === -1 && o.indexOf('collection(db, "users"') === -1; })());
check("owner dashboard carries the seven pattern sections (in the post-gate shell, FIT-L4-1)", (() => {
  const h = fs.readFileSync(new URL("../owner.js", import.meta.url), "utf8");
  return ["overview", "people", "money", "reviews", "outreach", "community", "avatars"].every(x => h.indexOf('data-sec=\\"' + x + '\\"') !== -1); })());
check("service worker never caches the owner route", fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8").indexOf("/owner.html") !== -1);
check("two-hat draft rules fence the whole model", (() => {
  const r = fs.readFileSync(new URL("../firestore-twohat.rules", import.meta.url), "utf8");
  return r.indexOf("match /_comp/{uid}") !== -1 && r.indexOf("match /_owner/config") !== -1 &&
    r.indexOf('slice != "tier"') !== -1 && r.indexOf("compOk(uid)") !== -1 &&
    r.indexOf("allow read, write: if false") !== -1; })());

/* --- Exercise animations (locked look, QA pins 1-10) --- */
const animDataSrc = fs.readFileSync(new URL("../anim-data.js", import.meta.url), "utf8");
const animWin = { window: {} };
new Function("window", animDataSrc)(animWin.window);
const ANIM = animWin.window.FIT_ANIM || {};
const animIds = GX.EXERCISES.slice(0, 27).map(x => x.id);
check("anim: every exercise of the animated 27 has a track", animIds.every(id => !!ANIM[id]));
check("anim: anim-data.js carries the animated 27 only; spliced tracks live in the expansion sibling (Phase 2 boundary, moved for the wired two hundred fifty)", GX.EXERCISES.slice(27).every(x => !ANIM[x.id]));
check("anim: no orphan tracks", Object.keys(ANIM).every(id => animIds.indexOf(id) !== -1));
function adist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function aangle(a, b, c) { const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]]; return Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]))))) * 180 / Math.PI; }
function invOk(tr, inv) {
  const A = tr.keys[0], B = tr.keys[1];
  if (inv.kind === "same") return JSON.stringify(A[inv.joint]) === JSON.stringify(B[inv.joint]);
  if (inv.kind === "extends") return adist(B[inv.joint], B[inv.ref]) - adist(A[inv.joint], A[inv.ref]) >= inv.min;
  if (inv.kind === "drops") return B[inv.joint][1] - A[inv.joint][1] >= inv.min;
  if (inv.kind === "rises") return A[inv.joint][1] - B[inv.joint][1] >= inv.min;
  if (inv.kind === "pulls") return A[inv.joint][0] - B[inv.joint][0] >= inv.min;
  if (inv.kind === "closer") return adist(A[inv.j[0]], A[inv.j[1]]) - adist(B[inv.j[0]], B[inv.j[1]]) >= inv.min;
  if (inv.kind === "spreads") return adist(B[inv.j[0]], B[inv.j[1]]) - adist(A[inv.j[0]], A[inv.j[1]]) >= inv.min;
  if (inv.kind === "alt") return Math.max(Math.abs(A[inv.joint][0] - B[inv.joint][0]), Math.abs(A[inv.joint][1] - B[inv.joint][1])) >= inv.min;
  if (inv.kind === "flat") return Math.abs(A[inv.j[0]][1] - A[inv.j[1]][1]) <= 2 && A[inv.j[0]][1] >= 205;
  if (inv.kind === "angle") { const K = inv.at ? B : A, v = aangle(K[inv.j[0]], K[inv.j[1]], K[inv.j[2]]); return v >= inv.min && v <= inv.max; }
  if (inv.kind === "backAngle") { const K = inv.at ? B : A, v = Math.abs(Math.atan2(K.sh[1] - K.hip[1], K.sh[0] - K.hip[0]) * 180 / Math.PI); return v >= inv.min && v <= inv.max; }
  return false;
}
check("anim: form invariants hold on every track (pin 1)", animIds.every(id => (ANIM[id].invariants || []).length >= 1 && ANIM[id].invariants.every(inv => invOk(ANIM[id], inv))));
check("anim: loop times pinned and sane (pin 2)", animIds.every(id => { const t = ANIM[id].t; return Array.isArray(t) && t.length === 3 && t[0] > 0.3 && t[0] < t[1] && t[1] < t[2] && t[2] <= 3.2; }));
check("anim: three bubbles per exercise, watch point in range (pins 6-7)", animIds.every(id => { const b = ANIM[id].bubbles; return Array.isArray(b) && b.length === 3 && b.every(x => typeof x === "string" && x.trim().length > 0) && ANIM[id].watch >= 0 && ANIM[id].watch <= 2; }));
const bubbleCopy = animIds.map(id => ANIM[id].bubbles.join(" ")).join(" ").toLowerCase();
check("anim: bubble claims lint (pin 7)", BANNED.every(w => bubbleCopy.indexOf(w) === -1) &&
  ["burn", "torch fat", "fix your", "you must", "no pain", "mg", "dose"].every(w => bubbleCopy.indexOf(w) === -1));
const animJsSrc = fs.readFileSync(new URL("../anim.js", import.meta.url), "utf8");
check("anim: player exposes the frozen-clock DOM hook (pin 2)", animJsSrc.indexOf("data-exercise") !== -1 && animJsSrc.indexOf("data-phase") !== -1 && animJsSrc.indexOf("IntersectionObserver") !== -1);
check("anim: poison leg degrades calmly (pin 8)", animJsSrc.indexOf("animMissing") !== -1 && animJsSrc.indexOf("still count") !== -1);
check("anim: Wally in the player is the art of record file (identity rule)", animJsSrc.indexOf("assets/wally-welcome.webp") !== -1);
check("anim: library bytes under the 300 KB pin (pin 10)", Buffer.byteLength(animJsSrc) + Buffer.byteLength(animDataSrc) < 300000);
const swSrc2 = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
check("anim: service worker precaches the rig + data (pin 10)", swSrc2.indexOf('"anim.js"') !== -1 && swSrc2.indexOf('"anim-data.js"') !== -1 && swSrc2.indexOf('"anim-data-expansion.js"') !== -1 && swSrc2.indexOf("fitapp-v90") !== -1);
check("anim: shell loads the rig before the app", (() => { const h = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"); return h.indexOf("anim-data.js") !== -1 && h.indexOf("anim-data.js") < h.indexOf("app.js") && h.indexOf("anim.js") < h.indexOf("app.js"); })());
check("anim: art of record untouched (identity rule)", (() => {
  const crypto = require("node:crypto");
  const h = f => crypto.createHash("md5").update(fs.readFileSync(new URL("../assets/" + f, import.meta.url))).digest("hex");
  return h("wally-welcome.webp") === "5d3829c0728b95475625e2671c593697" && h("wally-rest.webp") === "1fa2df38c121be88e1797e02beeab798";
})());
check("anim: Wally's player seats are the declared derivatives, byte-identical to the sheet's finals", (() => {
  const crypto = require("node:crypto");
  const h = f => crypto.createHash("md5").update(fs.readFileSync(new URL("../assets/" + f, import.meta.url))).digest("hex");
  return h("wally-hello.webp") === "9fd73239ef7779cb7d94704b869f5279" && h("wally-profile.webp") === "6c516208569a8e1db9c5c742cfaed8a6" && h("wally-celebrate.webp") === "aa5b2c4f24b8fd28b90b55364060334e";
})());
check("anim: the player seats Wally hello -> profile -> rest, and the float's celebrate pose has its own art", (() => {
  const a = fs.readFileSync(new URL("../anim.js", import.meta.url), "utf8");
  const w = fs.readFileSync(new URL("../wally.js", import.meta.url), "utf8");
  return a.indexOf("assets/wally-hello.webp") !== -1 && a.indexOf("assets/wally-profile.webp") !== -1 && a.indexOf("assets/wally-rest.webp") !== -1 &&
    a.indexOf('setSeat(frozen ? "rest" : "profile")') !== -1 && w.indexOf('celebrate: "assets/wally-celebrate.webp"') !== -1 && w.indexOf('celebrate: "celebrate"') !== -1 &&
    swSrc2.indexOf("assets/wally-hello.webp") !== -1 && swSrc2.indexOf("assets/wally-profile.webp") !== -1 && swSrc2.indexOf("assets/wally-celebrate.webp") !== -1;
})());
check("anim: trainer skins wired in Settings + session ask", (() => {
  const h = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const a = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return h.indexOf('data-skin="girl"') !== -1 && h.indexOf('data-skin="boy"') !== -1 && h.indexOf('data-skin="nb"') !== -1 &&
    a.indexOf("trainerSkin") !== -1 && a.indexOf("skinAsked") !== -1 && a.indexOf("guideStamp") !== -1 && a.indexOf("calmPics") !== -1;
})());


/* --- upgrade moment (house popup, adapted) --- */
check("upgrade popup exists with the locked price in plain words", (() => { const h = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); return h.indexOf('id="proModal"') >= 0 && h.indexOf("A$7.99 a month, or A$59.99 a year. Your first month is free.") >= 0 && h.indexOf('id="proNotNow"') >= 0 && h.indexOf("Not now") >= 0; })());
check("PS-1 retired in Tranche B: the modal carries the truthful state line, price untouched", (() => {
  const h = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const L = require(require("path").join(process.cwd(), "i18n.js"));
  const pricePin = L.EN["pro.price"] === "A$7.99 a month, or A$59.99 a year. Your first month is free." &&
                   L.ES["pro.price"] === "A$7.99 al mes, o A$59.99 al año. Tu primer mes es gratis.";
  return h.indexOf('data-i18n="pro.notOnSale"') === -1 && h.indexOf('id="proStateLine"') >= 0 &&
    L.EN["pro.notOnSale"] === undefined && L.ES["pro.notOnSale"] === undefined &&
    L.EN["pro.stateWait"] === "Pro is not on sale in the store yet. The free app stays yours, and Pro opens when the store does." &&
    L.ES["pro.stateWait"] === "Pro todavía no está a la venta en la tienda. La versión gratis es tuya para siempre, y Pro llega con la tienda." && pricePin;
})());
check("A-2: picture recipes take ingredients and count from the table; without them, no number is invented", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const form = src.indexOf('id="picIngredients"') >= 0 && src.indexOf("meal.picIngsHint") >= 0;
  const handler = src.slice(src.indexOf('$(\"picSave\")'), src.indexOf('$(\"picSave\")') + 700);
  const save = handler.indexOf("picIngredients") >= 0 && handler.indexOf("parseIngredientLine") >= 0;
  const guard = src.indexOf("!r.ingredients || !r.ingredients.length") >= 0;
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const words = L2.EN["meal.picIngsHint"] === "Want the calories counted? Add the ingredients too, one per line." && !!L2.ES["meal.picIngsHint"];
  const parsed = ["1 egg", "100 g rice"].map((x) => L.parseIngredientLine(x)).filter(Boolean);
  const withIngs = { ingredients: parsed, servings: 1 };
  return form && save && guard && words && typeof ML.recipeKcal(withIngs, MNUT) === "number";
})());
check("A-4: the reminder planner walks both dose shapes + routine days, skips the past, sorts and caps", (() => {
  const st = { peptides: [{ id: "p1", name: "Pen", time: "08:00", schedule: { days: [1, 3, 5] } },
                          { id: "p2", name: "Cream", time: "21:00", schedule: { intervalDays: 2, startKey: "2026-10-17" } }],
               routines: [{ id: "r1", name: "Leg day", time: "07:30", days: [6], createdKey: "2026-10-01" }] };
  const out = L.planReminders(st, "2026-10-17", { now: new Date(2026, 9, 17, 6, 0).getTime() });
  const keys = out.map((o) => o.kind + ":" + o.key + ":" + o.time);
  const want = ["gym:2026-10-17:07:30", "dose:2026-10-17:21:00", "dose:2026-10-19:08:00", "dose:2026-10-19:21:00",
                "dose:2026-10-21:08:00", "dose:2026-10-21:21:00", "dose:2026-10-23:08:00", "gym:2026-10-24:07:30"];
  const late = L.planReminders(st, "2026-10-17", { now: new Date(2026, 9, 17, 22, 0).getTime() });
  return want.every((w) => keys.indexOf(w) >= 0) && out.length === 10 &&
    late.every((o) => o.key !== "2026-10-17") && out.every((o, i2) => i2 === 0 || out[i2 - 1].at <= o.at);
})());
check("A-4: reminders are opt-in, wrap-only, and fenced off the save path", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const idx = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const keys = ["set.reminders", "set.remindersHint", "set.remindersWeb", "rem.turnOn", "rem.turnOff", "rem.doseBody", "rem.gymBody", "rem.notAllowed"];
  return L.emptyState().settings.notifications === false &&
    src.indexOf("LocalNotifications") >= 0 && src.indexOf("FitRemind.sync()") >= 0 &&
    src.indexOf("requestPermissions") >= 0 && idx.indexOf('id="remindBtn"') >= 0 &&
    keys.every((k) => L2.EN[k] && L2.ES[k]);
})());
check("A-4: repair translates fixture schedule shapes + stamps missing routine createdKey (nothing dropped)", (() => {
  const raw = { peptides: [{ id: "px", name: "Cream", time: "21:00", color: "#8B5CF6", schedule: { type: "every", every: 3, start: "2026-10-10" } },
                           { id: "py", name: "Daily", time: "09:00", color: "#52695A", schedule: { type: "daily" } }],
                routines: [{ id: "rx", name: "Leg day", days: [1], time: "18:00", items: [] }] };
  const fixed = L.repairState(raw);
  const cream = fixed.peptides[0], daily = fixed.peptides[1];
  return cream.schedule.intervalDays === 3 && cream.schedule.startKey === "2026-10-10" && cream.schedule.type === "every" &&
    Array.isArray(daily.schedule.days) && daily.schedule.days.length === 7 &&
    typeof fixed.routines[0].createdKey === "string" && fixed.routines[0].createdKey.length === 10 &&
    L.nextDoseKey(cream, "2026-10-17") === "2026-10-19";
})());
/* The CORE recipe set is defined by file position: the records written
   before the PACK1000-BEGIN (batches 1-2) splice marker in meals-data.js.
   Positional array slices are not used: the retroactive fence of
   17 Oct 2026 removed 4 originals, so a loaded-array position no longer
   identifies the core block. */
const coreRecipeIds = (() => {
  const dataSrc = fs.readFileSync(new URL("../meals-data.js", import.meta.url), "utf8");
  const cut = dataSrc.indexOf("PACK1000-BEGIN (batches 1-2)");
  return [...dataSrc.slice(0, cut).matchAll(/\{\s*id: "([^"]+)"/g)].map((m) => m[1]);
})();
check("A-3: Spanish content covers the A-3 core set (the original 27 exercises, the original 12 machines, their parts and equips) and the core recipes, both closed sets", (() => {
  global.window = global; require("../i18n-content.js");
  const es = global.LangContent.es;
  const EXD = require("../exercises-node.js"), MDD = require("../meals-data-node.js");
  const CORE_MACHINES = ["leg-press", "leg-extension", "leg-curl", "lat-pulldown", "cable-station", "pec-deck", "smith", "bench-barbell", "dumbbells", "bicep-machine", "calf-machine", "bodyweight"];
  const coreEx = EXD.EXERCISES.slice(0, 27);
  const coreMachines = EXD.MACHINES.filter((m) => CORE_MACHINES.indexOf(m.id) >= 0);
  const parts = [...new Set(coreEx.map((e) => e.partLabel))], equips = [...new Set(coreEx.map((e) => e.equipment))];
  const core = MDD.RECIPES.filter((r) => coreRecipeIds.indexOf(r.id) >= 0);
  /* Re-scoped 18 Oct 2026 (pack Spanish phase): the recipe table now covers
     the whole shipped library, so exactness is asserted against every
     shipped recipe id; the core set below remains the A-3 closed set. */
  const recipeKeysExact = JSON.stringify(Object.keys(es.recipe).sort()) === JSON.stringify(MDD.RECIPES.map((r) => r.id).sort());
  return coreEx.every((e) => es.exercise[e.id] && es.exerciseCue[e.id]) &&
    coreMachines.length === 12 && coreMachines.every((m) => es.machine[m.id]) && core.length === coreRecipeIds.length &&
    core.every((r) => es.recipe[r.id]) && recipeKeysExact &&
    parts.every((p) => es.part[p]) && equips.every((q) => es.equip[q]);
})());
check("EXERCISES SPANISH (18 Oct 2026): the exercise, exerciseCue and station tables are exactly the shipped sets (871 exercises, 36 stations); every Spanish cue holds the register (no dashes, no digits, no medical claims or advice, sane word band); every shipped part label and equipment value is covered", (() => {
  global.window = global; require("../i18n-content.js");
  const es = global.LangContent.es;
  const EXD = require("../exercises-node.js");
  const shippedEx = EXD.EXERCISES.map((e) => e.id).sort();
  const shippedMachines = EXD.MACHINES.map((m) => m.id).sort();
  const BANNED_ES = ["quema grasa", "quemas grasa", "quemar grasa", "pierde peso", "perder peso",
    "baja de peso", "adelgaza", "cura", "curar", "diagnóstico", "diagnostico", "terapia",
    "rehabilitación", "rehabilitacion", "dosis", "tratamiento", "alivia el dolor", "sana tu",
    "garantizado", "transforma tu cuerpo", "detox", "desintoxica"];
  const cueOk = (c) => {
    if (typeof c !== "string" || !c.length || /—|–/.test(c) || /[0-9]/.test(c)) return false;
    const low = " " + c.toLowerCase() + " ";
    if (BANNED_ES.some((b) => low.indexOf(b) >= 0)) return false;
    const w = c.split(/\s+/).filter(Boolean).length;
    return w >= 10 && w <= 36;
  };
  const parts = [...new Set(EXD.EXERCISES.map((e) => e.partLabel))];
  const equips = [...new Set(EXD.EXERCISES.map((e) => e.equipment))];
  return EXD.EXERCISES.length === 871 && EXD.MACHINES.length === 36 &&
    JSON.stringify(Object.keys(es.exercise).sort()) === JSON.stringify(shippedEx) &&
    JSON.stringify(Object.keys(es.exerciseCue).sort()) === JSON.stringify(shippedEx) &&
    JSON.stringify(Object.keys(es.machine).sort()) === JSON.stringify(shippedMachines) &&
    EXD.EXERCISES.every((e) => typeof es.exercise[e.id] === "string" && es.exercise[e.id].length > 0) &&
    EXD.EXERCISES.slice(27).every((e) => cueOk(es.exerciseCue[e.id])) &&
    parts.every((p) => es.part[p]) && equips.every((q) => es.equip[q]);
})());
check("SEARCH-BY-DISPLAY (18 Oct 2026): the exercise library search matches the displayed name as well as the stored name, accents folded; the recipe search already matches its displayed name (source)", (() => {
  const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return src.indexOf("function foldName(") >= 0 &&
    src.indexOf("var q = foldName(libState.q.trim());") >= 0 &&
    src.indexOf("foldName(e.name).indexOf(q) === -1 && foldName(exName(e)).indexOf(q) === -1") >= 0 &&
    src.indexOf("recName(r).toLowerCase().indexOf(filter)") >= 0;
})());
check("SEARCH-BY-DISPLAY: a Spanish display name finds its row (the stored name alone never could), the English stored name still finds it, the stored name still finds it under Spanish, and an unaccented query finds an accented display name", (() => {
  global.window = global; require("../i18n-content.js");
  const es = global.LangContent.es;
  const EXD = require("../exercises-node.js");
  const fold = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hit = (q, stored, disp) => fold(stored).indexOf(fold(q)) >= 0 || fold(disp).indexOf(fold(q)) >= 0;
  const squat = EXD.EXERCISES.find((e) => e.id === "Barbell_Full_Squat");
  const crunch = EXD.EXERCISES.find((e) => e.id === "Ab_Crunch_Machine");
  return es.exercise[squat.id] === "Sentadilla completa con barra" &&
    fold(squat.name).indexOf("sentadilla") === -1 &&
    hit("Sentadilla completa", squat.name, es.exercise[squat.id]) &&
    hit("barbell full squat", squat.name, es.exercise[squat.id]) &&
    hit("barbell full", squat.name, es.exercise[squat.id]) &&
    es.exercise[crunch.id].indexOf("máquina") >= 0 && hit("maquina", crunch.name, es.exercise[crunch.id]) &&
    hit("máquina", crunch.name, es.exercise[crunch.id]);
})());
check("A-3: the content resolver serves Spanish only in Spanish, and falls back silently otherwise", (() => {
  global.window = global; require("../i18n-content.js");
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  L2.use("es");
  const esHit = L2.content("exercise", "Leg_Press") === "Prensa de piernas" && L2.content("recipe", "no.such.id") === null;
  L2.use("en");
  return esHit && L2.content("exercise", "Leg_Press") === null;
})());
check("A-3: library names render through the layer; stored user names are never translated", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const idx = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  return src.indexOf("function recName(r)") >= 0 && src.indexOf("r.custom") >= 0 &&
    src.indexOf("esc(recName(r))") >= 0 && src.indexOf("esc(exName(ex))") >= 0 && src.indexOf("esc(exCue(ex))") >= 0 &&
    src.indexOf("esc(machName(m))") >= 0 && idx.indexOf("i18n-content.js") >= 0;
})());
check("A-3 F1: the session player's part and equipment line renders through the layer, never raw", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return src.indexOf("esc(exPart(ex))") >= 0 && src.indexOf("esc(ex.partLabel)") === -1 && src.indexOf("esc(ex.equipment)") === -1;
})());
check("A-3b: Spanish slice 2 covers every ingredient name, unit and step list in the core recipe set", (() => {
  global.window = global; require("../i18n-content.js");
  const es = global.LangContent.es;
  const MDD = require("../meals-data-node.js");
  const core = MDD.RECIPES.filter((r) => coreRecipeIds.indexOf(r.id) >= 0);
  const names = new Set(), units = new Set();
  core.forEach((r) => (r.ingredients || []).forEach((g) => { names.add(g.name); units.add(g.unit); }));
  /* Re-scoped 18 Oct 2026 (pack Spanish phase): step lists now cover the
     whole shipped library; exactness rides every shipped recipe id. */
  const stepKeysExact = JSON.stringify(Object.keys(es.steps).sort()) === JSON.stringify(MDD.RECIPES.map((r) => r.id).sort());
  return [...names].every((n) => es.ingredient[n]) && [...units].every((u) => es.unit[u]) &&
    core.every((r) => Array.isArray(es.steps[r.id]) && es.steps[r.id].length === (r.steps || []).length) && stepKeysExact;
})());
check("PACK SPANISH (18 Oct 2026): every pack recipe in the shipped library holds a Spanish name and a full Spanish step list; every pack ingredient name and unit is covered; the excluded 24 hold no entries; the recipe and steps tables are exactly the shipped recipe id set", (() => {
  global.window = global; require("../i18n-content.js");
  const es = global.LangContent.es;
  const MDD = require("../meals-data-node.js");
  const EXCLUDED24 = ["pizza-night", "pesto-pasta", "breakfast-burrito", "pumpkin-soup",
    "pack-beef-burritos", "pack-beef-burrito-bowl", "pack-pork-meatballs", "pack2-breakfast-pizza",
    "pack2-cheese-scones", "pack2-diner-pancakes", "pack2-cauliflower-soup", "pack-chicken-corn-soup",
    "pack-fish-veg-tray", "pack2-beetroot-yogurt-salad", "pack-chicken-vegetable-soup",
    "pack2-ratatouille-baked-eggs", "pack2-greek-bean-soup", "pack-tomato-basil-soup",
    "pack-beetroot-ricotta-toast", "pack2-creamy-mushroom-soup", "pack-sweet-potato-soup",
    "pack2-peanut-chicken-salad", "pack-beef-vegetable-soup", "pack2-baked-fish-greek-style"];
  const pack = MDD.RECIPES.filter((r) => coreRecipeIds.indexOf(r.id) < 0);
  const names = new Set(), units = new Set();
  pack.forEach((r) => (r.ingredients || []).forEach((g) => { names.add(g.name); units.add(g.unit); }));
  const shippedIds = MDD.RECIPES.map((r) => r.id).sort();
  return pack.length >= 1000 &&
    pack.every((r) => typeof es.recipe[r.id] === "string" && es.recipe[r.id].length > 0 &&
      Array.isArray(es.steps[r.id]) && es.steps[r.id].length === (r.steps || []).length &&
      es.steps[r.id].every((s) => typeof s === "string" && s.length > 0 && s.indexOf("{") < 0 && s.indexOf("#") < 0)) &&
    [...names].every((n) => es.ingredient[n]) && [...units].every((u) => es.unit[u]) &&
    EXCLUDED24.every((id) => !es.recipe[id] && !es.steps[id]) &&
    JSON.stringify(Object.keys(es.recipe).sort()) === JSON.stringify(shippedIds) &&
    JSON.stringify(Object.keys(es.steps).sort()) === JSON.stringify(shippedIds);
})());
check("A-3b: steps resolve as arrays in Spanish; modal + groceries wire through the helpers; custom stays raw", (() => {
  global.window = global; require("../i18n-content.js");
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  L2.use("es");
  const arr = L2.content("steps", "avo-eggs");
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string" &&
    src.indexOf("function recSteps(r)") >= 0 && src.indexOf("recIngName(r, i.name)") >= 0 &&
    src.indexOf('libIng[i.name] ? cName("ingredient", i.name, i.name) : i.name') >= 0;
})());
check("A-5: the shared import module ships byte-identical to Pace's fleet copy (hash-pinned)", (() => {
  const crypto = require("crypto");
  const h = crypto.createHash("sha256").update(fs.readFileSync(new URL("../calendar-import.js", import.meta.url))).digest("hex");
  return h === "68492adef5887b693793335c272b49b9da07a598c6654db534deb28786d01db5";
})());
check("A-5: the import registry lives in state, repairs clean, and imported to-dos keep their import fields", (() => {
  const st = L.repairState({ imports: [{ key: "imp-x", source: "Google Calendar", at: "2026-10-17T00:00:00.000Z", count: 4 }, "junk"],
    todos: [{ id: "todo.imp.1", title: "Dentist", date: "2026-10-20", time: "09:00", importUid: "g4@x", importKey: "imp-x", source: "import", originalText: "Smile — referral" }] });
  return Array.isArray(L.emptyState().imports) && st.imports.length === 1 && st.imports[0].count === 4 &&
    st.todos[0].importUid === "g4@x" && st.todos[0].source === "import" && st.todos[0].originalText.indexOf("referral") >= 0;
})());
check("A-5: wiring is whole — sheet, repeatModel none, demo-fenced entries, scripts + precache, EN+ES words", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const idx = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const keys = ["cal.importTitle", "cal.importIntro", "cal.guideGoogle", "cal.guideApple", "cal.guideOutlook", "cal.guideFile", "cal.importGo", "cal.importBadFile", "cal.importToastDone"];
  return idx.indexOf('id="importSheet"') >= 0 && idx.indexOf("vendor/ical/ical.min.js") < idx.indexOf("calendar-import.js") &&
    idx.indexOf("calendar-import.js") < idx.indexOf("app.js") &&
    src.indexOf('repeatModel: "none"') >= 0 && src.indexOf("applyImport({ tasks: state.todos, imports: state.imports }") >= 0 &&
    src.indexOf('if (!window.CI) return;') >= 0 && src.indexOf('id="tourImportBtn"') >= 0 &&
    sw.indexOf('"calendar-import.js"') >= 0 && sw.indexOf('"vendor/ical/ical.min.js"') >= 0 &&
    keys.every((k) => L2.EN[k] && L2.ES[k]) && L2.EN["cal.guideFile"] === "Pick the .ics file your old calendar exported. It is read once, copied in, and the file itself is never changed.";
})());
check("the moment opens only from the free plan line or a locked tap (never on open)", (() => { const src = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const L = require(require("path").join(process.cwd(), "i18n.js")); return src.indexOf("accProBtn") >= 0 && (src.match(/showProMoment/g) || []).length === 3 && src.indexOf("function lockedTap()") >= 0 && L.EN["pro.seeAdds"] === "See what Pro adds" && src.indexOf('tr("pro.seeAdds")') >= 0; })());

/* SESSION PLAYER TOP TIMER (Ilse order 17 Oct 2026, 23:14): one calm bar
   at the top of the player, above the animation, in all three phases. */
check("top timer: the bar markup sits in the session card above the animation stage", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const bar = src.indexOf('id="timerBar"');
  const stage = src.indexOf('id="animMount"');
  return bar >= 0 && stage >= 0 && bar < stage &&
    src.indexOf('id="timerBarClock"') >= 0 && src.indexOf('id="timerBarLabel"') >= 0 &&
    src.indexOf('class="timerBar"') >= 0;
})());
check("top timer: hold and rest are drawn from countdown()'s own counter (one timer, never forked)", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function countdown("), src.indexOf("function finishSession"));
  return (src.match(/function countdown\(/g) || []).length === 1 &&
    body.indexOf("barPhase = label") >= 0 && body.indexOf("barLeft = left") >= 0 &&
    body.indexOf('barPhase = "work"') >= 0 && body.indexOf("drawBar()") >= 0;
})());
check("top timer: guide maths is reps x 3.5 rounded to the nearest 5", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const m = src.match(/function setGuideSec\(reps\) \{[^}]+\}/);
  if (!m) return false;
  const setGuideSec = eval("(" + m[0] + ")");
  return setGuideSec(12) === 40 && setGuideSec(10) === 35 && setGuideSec(8) === 30 &&
    setGuideSec(20) === 70 && setGuideSec(3) === 10;
})());
check("top timer: the bar redraws on the session tick, so it works in stills mode too (it is a clock)", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const tick = src.slice(src.indexOf("function tickClock()"), src.indexOf("function countdown("));
  return tick.indexOf("drawBar()") >= 0 && src.indexOf("function drawBar()") >= 0;
})());
check("top timer: its words ride the language layer in both languages, guide word included", (() => {
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  return L2.EN["gym.timerGuide"] === "Guide {t}" && L2.ES["gym.timerGuide"] === "Guía {t}" &&
    src.indexOf('tr("gym.timerGuide"') >= 0 && src.indexOf('tr("gym.holdLabel")') >= 0 &&
    L2.EN["gym.timerGuide"].indexOf("-") === -1 && L2.ES["gym.timerGuide"].indexOf("-") === -1;
})());

check("machine photo v2: the app never claims to name the machine from the photo (accuracy law)", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const flow = src.slice(src.indexOf("Machine photo: user-verified picture match"), src.indexOf("function renderGym"));
  /* The claim scan runs on the flow with the honesty key's
     own name removed first: "machineConfidenceUnavailable"
     is the denial itself, not a claim. The words scan drops
     "looks like" for one honest sentence: "the machine that
     looks like yours" is the USER comparing, and the hint
     line says plainly the app cannot name it. */
  const flowScan = flow.slice(flow.indexOf("function stationFramesFor")).split("machineConfidenceUnavailable").join("");
  const claims = ["we found", "we matched", "recognised", "recognized", "identified your", "detected your", "confidence", "your machine is", "auto-match"];
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const words = ["gym.matchAsk", "gym.noneMatch", "gym.noneHint", "gym.howTo", "gym.movingAlt", "gym.machineHint"].map((k) => (L2.EN[k] || "") + " " + (L2.ES[k] || "")).join(" ").toLowerCase();
  return flow.length > 0 && claims.every((c) => flowScan.toLowerCase().indexOf(c) === -1 && words.indexOf(c) === -1) &&
    flow.toLowerCase().indexOf("looks like") === -1 &&
    L2.EN["gym.machineHint"].indexOf("cannot reliably name") >= 0 && L2.EN["gym.machineHint"].indexOf("Nothing is auto-selected") >= 0 && typeof L2.EN["gym.machineConfidenceUnavailable"] === "string" && typeof L2.ES["gym.machineConfidenceUnavailable"] === "string" &&
    L2.EN["gym.machineConfidenceUnavailable"].indexOf("not available") >= 0;
})());
check("machine photo v2: the picture picker renders one tile per station, art only where generated frames exist", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const flow = src.slice(src.indexOf("Machine photo: user-verified picture match"), src.indexOf("function renderGym"));
  /* Station art derives from the player's frame sets (one
     source, no hand-kept per-station list): a station shows
     art exactly when its first exercise holds a set. The
     one station whose exercise holds none is the calf
     machine (Standing Calf Raises, parked). */
  const animWin = { window: {} };
  new Function("window", fs.readFileSync(new URL("../anim.js", import.meta.url), "utf8"))(animWin.window);
  const FF = animWin.window.FitAnim.framesFor;
  const CORE12 = ["leg-press", "leg-extension", "leg-curl", "lat-pulldown", "cable-station", "pec-deck", "smith", "bench-barbell", "dumbbells", "bicep-machine", "calf-machine", "bodyweight"];
  const stationArt = GX.MACHINES.every((m) => {
    const fr = FF(m.exerciseIds[0], "girl");
    /* Expansion Wiring A (18 Oct): the bands and exercise-ball
       stations lead with a wired exercise (Back Flyes With
       Bands, Ball Leg Curl), so their tiles carry art now;
       every other Phase 2 station still leads with an unwired
       spliced exercise and keeps its name tile, honestly.
       Expansion Wiring G (18 Oct): the triceps dip machine
       leads with Dip Machine, wired in Batch G, so its tile
       carries art now too; the count stands at 14 of 36.
       Expansion Wiring J (18 Oct): the hack squat machine
       leads with Hack Squat, wired in Batch J, so its tile
       carries art now too; the count stands at 15 of 36.
       Expansion Wiring L (18 Oct): the chest press machine,
       the plate loaded machine and the shoulder press
       machine lead with Leverage Chest Press, Leverage
       Deadlift and Leverage Shoulder Press, wired in
       Batch L, so their tiles carry art now too; the
       seated row machine still leads with the held
       Leverage High Row and keeps its name tile; the
       count stands at 18 of 36.
       Expansion Wiring M (18 Oct): no Batch M exercise
       leads its station (the four cable sets join the
       cable station behind Seated Cable Rows, Lying Leg
       Curls joins the leg curl station behind Seated Leg
       Curl, Machine Bench Press behind Leverage Chest
       Press, Machine Preacher Curls behind Machine Bicep
       Curl, Machine Shoulder Military Press behind
       Leverage Shoulder Press, Machine Triceps Extension
       behind Dip Machine, Monster Walk behind Back Flyes
       With Bands), so the count stands at 18 of 36.
       Expansion Wiring N (18 Oct): no Batch N exercise
       leads its station either (the five dumbbell sets
       join the dumbbells station behind One-Arm Dumbbell
       Row, the cable side bends join the cable station
       behind Seated Cable Rows, the long bar row joins
       the bench barbell station behind the barbell bench
       press, the lat pulldown joins the lat pulldown
       station behind Close-Grip Front Lat Pulldown, the
       medicine ball slam joins the medicine ball station
       behind Backward Medicine Ball Throw and the Otis-Up
       joins the other gear behind Ab Roller, and those
       two tiles keep their name tiles honestly), so the
       count stands at 18 of 36.
       Expansion Wiring O (18 Oct): no Batch O exercise
       leads its station either (the two Pallof presses
       join the cable station behind Seated Cable Rows,
       Parallel Bar Dip and Platform Hamstring Slides
       join the other gear behind Ab Roller, Physioball
       Hip Bridge joins the exercise ball behind Ball
       Leg Curl, Plie Dumbbell Squat and Power Partials
       join the dumbbells behind One-Arm Dumbbell Row,
       and Preacher Curl joins the bench barbell behind
       the barbell bench press), so the count stands at
       18 of 36. The triceps dip machine is settled by
       the same read: its list is Dip Machine then
       Machine Triceps Extension, both wired, so its
       tile carries the Dip Machine art as it has since
       Wiring G; Parallel Bar Dip is other gear and
       leads nothing.
       Expansion Wiring P (18 Oct): no Batch P exercise
       leads its station either (Pull Through, Reverse
       Cable Curl, Reverse Grip Triceps Pushdown and
       Rope Crunch join the cable station behind Seated
       Cable Rows, Reverse Barbell Curl and Rocking
       Standing Calf Raise join the bench barbell
       behind the barbell bench press, Reverse Flyes
       joins the dumbbells behind One-Arm Dumbbell
       Row, Reverse Machine Flyes joins the pec deck
       behind Butterfly, Reverse Plate Curls and
       Seated Band Hamstring Curl join the other gear
       behind Ab Roller, and Rope Straight-Arm
       Pulldown joins the lat pulldown behind
       Close-Grip Front Lat Pulldown), so the count
       stands at 18 of 36.
       Expansion Wiring W (18 Oct): Thigh Abductor
       leads the hip machine and is wired in Batch
       Y, so its tile carries art now; Thigh
       Adductor joins it on the same station. The
       other nine join behind leads already drawn
       (Straight-Arm Pulldown behind Close-Grip
       Front Lat Pulldown, Straight Bar Bench Mid
       Rows, Straight Raises On Incline Bench and
       T-Bar Row With Handle behind the barbell
       bench press, and the Suspended Push-Up,
       Suspended Reverse Crunch, Suspended Row,
       Svend Press and Trap Bar Deadlift behind
       Ab Roller on other gear, whose tile keeps
       its name tile honestly), so the count
       stands at 19 of 36.
       Expansion Wiring X (18 Oct): no Batch Z exercise
       leads its station either (the triceps overhead
       extension with rope and both triceps pushdowns
       join the cable station behind Seated Cable Rows,
       the underhand cable pulldowns and the wide grip
       lat pulldown join the lat pulldown behind
       Close-Grip Front Lat Pulldown, the upright
       barbell row, the wide grip standing barbell
       curl and the wrist rotations with straight bar
       join the bench barbell behind the barbell bench
       press, the upright row with bands joins the
       bands behind Back Flyes With Bands, Weighted
       Crunches joins the medicine ball behind
       Backward Medicine Ball Throw and Wrist Roller
       joins the other gear behind Ab Roller, and
       those two tiles keep their name tiles
       honestly), so the count stands at 19 of 36. */
    if (m.id === "bands" || m.id === "exercise-ball" || m.id === "triceps-dip-machine" || m.id === "hack-squat-machine" || m.id === "chest-press-machine" || m.id === "plate-loaded-machine" || m.id === "shoulder-press-machine" || m.id === "hip-machine") return Array.isArray(fr) && fr.length === 3 && fr.every((f) => fs.existsSync(new URL("../" + f, import.meta.url)));
    if (CORE12.indexOf(m.id) === -1) return fr === null;
    if (m.exerciseIds[0] === "Standing_Calf_Raises") return fr === null;
    return Array.isArray(fr) && fr.length === 3 && fr.every((f) => fs.existsSync(new URL("../" + f, import.meta.url)));
  });
  return flow.indexOf('class="machineTile"') >= 0 && flow.indexOf('data-machine="') >= 0 && flow.indexOf("EX.MACHINES.map") >= 0 &&
    flow.indexOf("machineTileImg") >= 0 && GX.MACHINES.length === 36 &&
    flow.indexOf("STATION_FRAMES") === -1 && flow.indexOf("stationFramesFor(m)") >= 0 && stationArt;
})());
check("machine photo v2: a tap opens the station view with the moving picture, Wally, the cue and the routine road", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const st = src.slice(src.indexOf("function renderStation"), src.indexOf("function renderMachine"));
  return st.indexOf('id="mcFrameImg"') >= 0 && st.indexOf("assets/wally-profile.webp") >= 0 &&
    st.indexOf("mcBubbleLine") >= 0 && st.indexOf("exCue(first)") >= 0 && st.indexOf('id="animMount"') >= 0 &&
    st.indexOf("mountAnim(first)") >= 0 && st.indexOf('id="mcMake"') >= 0 &&
    src.indexOf("if (!photoSelected) { renderStation(m); return; }") >= 0 && src.indexOf('id="mcConfirmYes"') >= 0 && src.indexOf("gym.machineConfidenceUnavailable") >= 0;
})());
check("machine photo v2: the none-of-these road reaches the full station name list", (() => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const flow = src.slice(src.indexOf("function renderMachine"), src.indexOf("function renderGym"));
  const names = flow.slice(flow.indexOf('id="mcNames"'));
  return flow.indexOf('id="mcNone"') >= 0 && names.indexOf('class="chip" type="button" data-machine="') >= 0 &&
    names.indexOf("EX.MACHINES.map") >= 0 && flow.indexOf('tr("gym.noneHint")') >= 0;
})());
check("machine photo v2: its words live in the layer in both languages, dash free", (() => {
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const keys = ["gym.matchAsk", "gym.noneMatch", "gym.noneHint", "gym.howTo", "gym.movingAlt"];
  return keys.every((k) => typeof L2.EN[k] === "string" && typeof L2.ES[k] === "string" && !/[—–]/.test(L2.EN[k] + L2.ES[k])) &&
    L2.EN["gym.matchAsk"].indexOf("Search a name") >= 0 && L2.EN["gym.matchAsk"].indexOf("tap the machine") >= 0;
})());

/* --- Graphic wiring: the generated frame sets inside the
   player + station views (roll-out wiring slice). --- */
const animWinG = { window: {} };
new Function("window", fs.readFileSync(new URL("../anim.js", import.meta.url), "utf8"))(animWinG.window);
const FRAMESG = animWinG.window.FIT_FRAMES || {};
const FFG = animWinG.window.FitAnim.framesFor;
const expectedSets = GX.EXERCISES.slice(0, 27).map((x) => x.id).filter((id) => id !== "Standing_Calf_Raises").sort();
const expectedFigSets = expectedSets.filter((id) => id !== "Barbell_Bench_Press_-_Medium_Grip");
/* Expansion Batches A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y and Z (18 Oct):
   two hundred fifty girl sets for spliced exercises; no boy or
   non-binary art exists for them yet. */
const EXP_SETS = ["Alternate_Hammer_Curl", "Alternate_Incline_Dumbbell_Curl", "Alternating_Deltoid_Raise", "Alternating_Floor_Press", "Anti-Gravity_Press", "Back_Flyes_-_With_Bands", "Balance_Board", "Ball_Leg_Curl", "Band_Assisted_Pull-Up", "Band_Hip_Adductions", "Band_Pull_Apart"];
const EXP_SETS_B = ["Barbell_Curl", "Barbell_Curls_Lying_Against_An_Incline", "Barbell_Incline_Bench_Press_-_Medium_Grip", "Barbell_Rear_Delt_Row", "Barbell_Seated_Calf_Raise", "Barbell_Shrug", "Barbell_Shrug_Behind_The_Back", "Barbell_Side_Bend", "Barbell_Side_Split_Squat", "Barbell_Walking_Lunge", "Battling_Ropes"];
const EXP_SETS_C = ["Bench_Press_-_With_Bands", "Bent_Over_Low-Pulley_Side_Lateral", "Bent_Over_One-Arm_Long_Bar_Row", "Bent_Over_Two-Dumbbell_Row", "Bent_Over_Two-Dumbbell_Row_With_Palms_In", "Bosu_Ball_Cable_Crunch_With_Side_Bends", "Bradford_Rocky_Presses", "Cable_Crossover", "Cable_Deadlifts", "Cable_Hammer_Curls_-_Rope_Attachment"];
const EXP_SETS_D = ["Cable_Hip_Adduction", "Cable_Incline_Pushdown", "Cable_Incline_Triceps_Extension", "Cable_Internal_Rotation", "Cable_Iron_Cross", "Cable_Judo_Flip", "Cable_Lying_Triceps_Extension", "Cable_One_Arm_Tricep_Extension", "Cable_Preacher_Curl", "Cable_Rear_Delt_Fly", "Cable_Reverse_Crunch", "Cable_Rope_Overhead_Triceps_Extension"];
const EXP_SETS_E = ["Cable_Rope_Rear-Delt_Rows", "Cable_Russian_Twists", "Cable_Seated_Crunch", "Cable_Seated_Lateral_Raise", "Cable_Shoulder_Press", "Cable_Shrugs", "Calf-Machine_Shoulder_Shrug", "Calf_Press", "Car_Drivers", "Chair_Squat"];
const EXP_SETS_F = ["Close-Grip_Barbell_Bench_Press", "Close-Grip_Dumbbell_Press", "Close-Grip_EZ-Bar_Curl_with_Band", "Close-Grip_EZ-Bar_Press", "Close-Grip_EZ_Bar_Curl", "Close-Grip_Push-Up_off_of_a_Dumbbell", "Close-Grip_Standing_Barbell_Curl", "Cocoons", "Conans_Wheel", "Concentration_Curls", "Cross-Body_Crunch", "Cross_Body_Hammer_Curl"];
const EXP_SETS_G = ["Cross_Over_-_With_Bands", "Decline_Barbell_Bench_Press", "Decline_Dumbbell_Bench_Press", "Decline_Dumbbell_Flyes", "Decline_Dumbbell_Triceps_Extension", "Decline_EZ_Bar_Triceps_Extension", "Decline_Smith_Press", "Dip_Machine", "Dumbbell_Bench_Press", "Dumbbell_Bench_Press_with_Neutral_Grip", "Dumbbell_Bicep_Curl", "Dumbbell_Flyes"];
const EXP_SETS_H = ["Dumbbell_Incline_Row", "Dumbbell_Incline_Shoulder_Raise", "Dumbbell_Lunges", "Dumbbell_Raise", "Dumbbell_Scaption", "Dumbbell_Seated_One-Leg_Calf_Raise", "Dumbbell_Shrug", "Dumbbell_Side_Bend", "Dumbbell_Squat", "EZ-Bar_Curl", "EZ-Bar_Skullcrusher"];
const EXP_SETS_I = ["Exercise_Ball_Crunch", "Exercise_Ball_Pull-In", "Extended_Range_One-Arm_Kettlebell_Floor_Press", "External_Rotation_with_Band", "External_Rotation_with_Cable", "Finger_Curls", "Flexor_Incline_Dumbbell_Curls", "Front_Cable_Raise", "Front_Dumbbell_Raise", "Front_Incline_Dumbbell_Raise", "Front_Raise_And_Pullover"];
const EXP_SETS_J = ["Front_Two-Dumbbell_Raise", "Goblet_Squat", "Hack_Squat", "Hammer_Curls", "Hammer_Grip_Incline_DB_Bench_Press", "Hip_Extension_with_Bands", "Hip_Flexion_with_Band", "Incline_Bench_Pull", "Incline_Cable_Chest_Press", "Incline_Dumbbell_Bench_With_Palms_Facing_In", "Incline_Dumbbell_Curl", "Incline_Dumbbell_Flyes"];
const EXP_SETS_K = ["Incline_Dumbbell_Flyes_-_With_A_Twist", "Incline_Dumbbell_Press", "Incline_Hammer_Curls", "Incline_Inner_Biceps_Curl", "Internal_Rotation_with_Band", "Inverted_Row_with_Straps", "JM_Press", "Kettlebell_Halo", "Kettlebell_Overhead_Triceps_Extension", "Kettlebell_Pirate_Ships", "Knee_Hip_Raise_On_Parallel_Bars", "Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists"];
const EXP_SETS_L = ["Kneeling_High_Pulley_Row", "Kneeling_Single-Arm_High_Pulley_Row", "Landmine_180s", "Lateral_Raise_-_With_Bands", "Leverage_Chest_Press", "Leverage_Deadlift", "Leverage_Decline_Chest_Press", "Leverage_Incline_Chest_Press", "Leverage_Iso_Row", "Leverage_Shoulder_Press", "Leverage_Shrug"];
const EXP_SETS_M = ["Low_Cable_Crossover", "Low_Cable_Triceps_Extension", "Low_Pulley_Row_To_Neck", "Lying_Close-Grip_Bar_Curl_On_High_Pulley", "Lying_Leg_Curls", "Machine_Bench_Press", "Machine_Preacher_Curls", "Machine_Shoulder_Military_Press", "Machine_Triceps_Extension", "Monster_Walk"];
const EXP_SETS_N = ["One-Arm_Flat_Bench_Dumbbell_Flye", "One-Arm_High-Pulley_Cable_Side_Bends", "One-Arm_Incline_Lateral_Raise", "One-Arm_Long_Bar_Row", "One-Arm_Medicine_Ball_Slam", "One-Arm_Side_Laterals", "One_Arm_Dumbbell_Bench_Press", "One_Arm_Dumbbell_Preacher_Curl", "One_Arm_Lat_Pulldown", "Otis-Up"];
const EXP_SETS_O = ["Pallof_Press", "Pallof_Press_With_Rotation", "Parallel_Bar_Dip", "Physioball_Hip_Bridge", "Platform_Hamstring_Slides", "Plie_Dumbbell_Squat", "Power_Partials", "Preacher_Curl"];
const EXP_SETS_P = ["Pull_Through", "Reverse_Barbell_Curl", "Reverse_Cable_Curl", "Reverse_Flyes", "Reverse_Grip_Triceps_Pushdown", "Reverse_Machine_Flyes", "Reverse_Plate_Curls", "Rocking_Standing_Calf_Raise", "Rope_Crunch", "Rope_Straight-Arm_Pulldown", "Seated_Band_Hamstring_Curl"];
const EXP_SETS_Q = ["Seated_Barbell_Twist", "Seated_Cable_Shoulder_Press", "Seated_Calf_Raise", "Seated_Dumbbell_Curl", "Seated_Dumbbell_Inner_Biceps_Curl", "Seated_Dumbbell_Press"];
const EXP_SETS_R = ["Seated_Side_Lateral_Raise", "Seated_Triceps_Press", "Shotgun_Row", "Shoulder_Press_-_With_Bands", "Side_Laterals_to_Front_Raise", "Single-Arm_Cable_Crossover", "Single-Leg_High_Box_Squat", "Single-Leg_Leg_Extension", "Single_Dumbbell_Raise", "Sled_Overhead_Backward_Walk", "Sled_Overhead_Triceps_Extension"];
const EXP_SETS_S = ["Sled_Reverse_Flye", "Sled_Row", "Smith_Incline_Shoulder_Raise", "Smith_Machine_Behind_the_Back_Shrug", "Smith_Machine_Bench_Press", "Smith_Machine_Bent_Over_Row", "Smith_Machine_Calf_Raise", "Smith_Machine_Close-Grip_Bench_Press"];
const EXP_SETS_T = ["Smith_Machine_Incline_Bench_Press", "Smith_Machine_One-Arm_Upright_Row", "Smith_Machine_Overhead_Shoulder_Press"];
const EXP_SETS_U = ["Smith_Machine_Stiff-Legged_Deadlift", "Smith_Machine_Upright_Row", "Smith_Single-Leg_Split_Squat", "Speed_Band_Overhead_Triceps", "Spell_Caster", "Split_Squat_with_Dumbbells", "Squats_-_With_Bands", "Standing_Alternating_Dumbbell_Press", "Standing_Barbell_Calf_Raise"];
const EXP_SETS_V = ["Standing_Biceps_Cable_Curl", "Standing_Bradford_Press", "Standing_Cable_Chest_Press", "Standing_Cable_Lift", "Standing_Cable_Wood_Chop", "Standing_Concentration_Curl", "Standing_Dumbbell_Press", "Standing_Dumbbell_Triceps_Extension", "Standing_Dumbbell_Upright_Row", "Standing_Leg_Curl", "Standing_Low-Pulley_Deltoid_Raise", "Standing_Military_Press"];
const EXP_SETS_W = ["Standing_Olympic_Plate_Hand_Squeeze"];
const EXP_SETS_X = ["Standing_Overhead_Barbell_Triceps_Extension", "Standing_Palm-In_One-Arm_Dumbbell_Press", "Standing_Rope_Crunch", "Stiff-Legged_Dumbbell_Deadlift"];
const EXP_SETS_Y = ["Straight-Arm_Pulldown", "Straight_Bar_Bench_Mid_Rows", "Straight_Raises_on_Incline_Bench", "Suspended_Push-Up", "Suspended_Reverse_Crunch", "Suspended_Row", "Svend_Press", "T-Bar_Row_with_Handle", "Thigh_Abductor", "Thigh_Adductor", "Trap_Bar_Deadlift"];
const EXP_SETS_Z = ["Triceps_Overhead_Extension_with_Rope", "Triceps_Pushdown_-_Rope_Attachment", "Triceps_Pushdown_-_V-Bar_Attachment", "Underhand_Cable_Pulldowns", "Upright_Barbell_Row", "Upright_Row_-_With_Bands", "Weighted_Crunches", "Wide-Grip_Lat_Pulldown", "Wide-Grip_Standing_Barbell_Curl", "Wrist_Roller", "Wrist_Rotations_with_Straight_Bar"];
const ALL_EXP_SETS = EXP_SETS.concat(EXP_SETS_B).concat(EXP_SETS_C).concat(EXP_SETS_D).concat(EXP_SETS_E).concat(EXP_SETS_F).concat(EXP_SETS_G).concat(EXP_SETS_H).concat(EXP_SETS_I).concat(EXP_SETS_J).concat(EXP_SETS_K).concat(EXP_SETS_L).concat(EXP_SETS_M).concat(EXP_SETS_N).concat(EXP_SETS_O).concat(EXP_SETS_P).concat(EXP_SETS_Q).concat(EXP_SETS_R).concat(EXP_SETS_S).concat(EXP_SETS_T).concat(EXP_SETS_U).concat(EXP_SETS_V).concat(EXP_SETS_W).concat(EXP_SETS_X).concat(EXP_SETS_Y).concat(EXP_SETS_Z);
const expectedGirlSets = expectedSets.concat(ALL_EXP_SETS).sort();
check("graphic wiring: the frame map covers exactly the completed sets per figure (girl 276 = 26 core + 250 expansion, boy 25, nb 25)", (() => {
  return eq(Object.keys(FRAMESG.girl || {}).sort(), expectedGirlSets) && expectedGirlSets.length === 276 &&
    eq(Object.keys(FRAMESG.boy || {}).sort(), expectedFigSets) && eq(Object.keys(FRAMESG.nb || {}).sort(), expectedFigSets) && expectedFigSets.length === 25 &&
    ["girl", "boy", "nb"].every((fig) => Object.keys(FRAMESG[fig]).every((id) => Array.isArray(FRAMESG[fig][id]) && FRAMESG[fig][id].length === 3));
})());
check("graphic wiring: the expansion two hundred fifty hold no boy or nb set and resolve the girl set by the fallback", (() => {
  return ALL_EXP_SETS.every((id) => !(id in (FRAMESG.boy || {})) && !(id in (FRAMESG.nb || {})) &&
    eq(FFG(id, "boy"), FRAMESG.girl[id]) && eq(FFG(id, "nb"), FRAMESG.girl[id]) && eq(FFG(id, "girl"), FRAMESG.girl[id]));
})());
check("graphic wiring: Band Skull Crusher (held at the master) carries no set under any figure", (() => {
  return !("Band_Skull_Crusher" in (FRAMESG.girl || {})) && !("Band_Skull_Crusher" in (FRAMESG.boy || {})) && !("Band_Skull_Crusher" in (FRAMESG.nb || {})) &&
    FFG("Band_Skull_Crusher", "girl") === null && FFG("Band_Skull_Crusher", "boy") === null;
})());
check("graphic wiring: Barbell Incline Shoulder Raise (held at the master, production refusal) carries no set under any figure", (() => {
  return !("Barbell_Incline_Shoulder_Raise" in (FRAMESG.girl || {})) && !("Barbell_Incline_Shoulder_Raise" in (FRAMESG.boy || {})) && !("Barbell_Incline_Shoulder_Raise" in (FRAMESG.nb || {})) &&
    FFG("Barbell_Incline_Shoulder_Raise", "girl") === null && FFG("Barbell_Incline_Shoulder_Raise", "boy") === null;
})());
check("graphic wiring: Bent Over Dumbbell Rear Delt Raise With Head On Bench (held at the master, production refusal) carries no set under any figure", (() => {
  return !("Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench" in (FRAMESG.girl || {})) && !("Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench" in (FRAMESG.boy || {})) && !("Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench" in (FRAMESG.nb || {})) &&
    FFG("Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench", "girl") === null && FFG("Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench", "boy") === null;
})());
check("graphic wiring: Cable Crunch (held at the master, production refusal) carries no set under any figure", (() => {
  return !("Cable_Crunch" in (FRAMESG.girl || {})) && !("Cable_Crunch" in (FRAMESG.boy || {})) && !("Cable_Crunch" in (FRAMESG.nb || {})) &&
    FFG("Cable_Crunch", "girl") === null && FFG("Cable_Crunch", "boy") === null;
})());
check("graphic wiring: Cable Wrist Curl (held on form at the master) carries no set under any figure", (() => {
  return !("Cable_Wrist_Curl" in (FRAMESG.girl || {})) && !("Cable_Wrist_Curl" in (FRAMESG.boy || {})) && !("Cable_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Cable_Wrist_Curl", "girl") === null && FFG("Cable_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Calf Raises With Bands (held on form at the master) carries no set under any figure", (() => {
  return !("Calf_Raises_-_With_Bands" in (FRAMESG.girl || {})) && !("Calf_Raises_-_With_Bands" in (FRAMESG.boy || {})) && !("Calf_Raises_-_With_Bands" in (FRAMESG.nb || {})) &&
    FFG("Calf_Raises_-_With_Bands", "girl") === null && FFG("Calf_Raises_-_With_Bands", "boy") === null;
})());
check("graphic wiring: Dumbbell Tricep Extension Pronated Grip (held at the master, production refusal) carries no set under any figure", (() => {
  return !("Dumbbell_Tricep_Extension_-Pronated_Grip" in (FRAMESG.girl || {})) && !("Dumbbell_Tricep_Extension_-Pronated_Grip" in (FRAMESG.boy || {})) && !("Dumbbell_Tricep_Extension_-Pronated_Grip" in (FRAMESG.nb || {})) &&
    FFG("Dumbbell_Tricep_Extension_-Pronated_Grip", "girl") === null && FFG("Dumbbell_Tricep_Extension_-Pronated_Grip", "boy") === null;
})());
check("graphic wiring: External Rotation (refused at the master itself, nothing banked) carries no set under any figure", (() => {
  return !("External_Rotation" in (FRAMESG.girl || {})) && !("External_Rotation" in (FRAMESG.boy || {})) && !("External_Rotation" in (FRAMESG.nb || {})) &&
    FFG("External_Rotation", "girl") === null && FFG("External_Rotation", "boy") === null;
})());
check("graphic wiring: Leverage High Row (refused at the master itself, its corrected attempt, nothing banked) carries no set under any figure", (() => {
  return !("Leverage_High_Row" in (FRAMESG.girl || {})) && !("Leverage_High_Row" in (FRAMESG.boy || {})) && !("Leverage_High_Row" in (FRAMESG.nb || {})) &&
    FFG("Leverage_High_Row", "girl") === null && FFG("Leverage_High_Row", "boy") === null;
})());
check("graphic wiring: Lying Cambered Barbell Row (held on form at the master) carries no set under any figure", (() => {
  return !("Lying_Cambered_Barbell_Row" in (FRAMESG.girl || {})) && !("Lying_Cambered_Barbell_Row" in (FRAMESG.boy || {})) && !("Lying_Cambered_Barbell_Row" in (FRAMESG.nb || {})) &&
    FFG("Lying_Cambered_Barbell_Row", "girl") === null && FFG("Lying_Cambered_Barbell_Row", "boy") === null;
})());
check("graphic wiring: Lying Supine Dumbbell Curl (refused at the master itself, nothing banked) carries no set under any figure", (() => {
  return !("Lying_Supine_Dumbbell_Curl" in (FRAMESG.girl || {})) && !("Lying_Supine_Dumbbell_Curl" in (FRAMESG.boy || {})) && !("Lying_Supine_Dumbbell_Curl" in (FRAMESG.nb || {})) &&
    FFG("Lying_Supine_Dumbbell_Curl", "girl") === null && FFG("Lying_Supine_Dumbbell_Curl", "boy") === null;
})());
check("graphic wiring: One Arm Pronated Dumbbell Triceps Extension (refused at the master itself, its corrected attempt, nothing banked) carries no set under any figure", (() => {
  return !("One_Arm_Pronated_Dumbbell_Triceps_Extension" in (FRAMESG.girl || {})) && !("One_Arm_Pronated_Dumbbell_Triceps_Extension" in (FRAMESG.boy || {})) && !("One_Arm_Pronated_Dumbbell_Triceps_Extension" in (FRAMESG.nb || {})) &&
    FFG("One_Arm_Pronated_Dumbbell_Triceps_Extension", "girl") === null && FFG("One_Arm_Pronated_Dumbbell_Triceps_Extension", "boy") === null;
})());
check("graphic wiring: One Arm Supinated Dumbbell Triceps Extension (refused at the master itself, nothing banked) carries no set under any figure", (() => {
  return !("One_Arm_Supinated_Dumbbell_Triceps_Extension" in (FRAMESG.girl || {})) && !("One_Arm_Supinated_Dumbbell_Triceps_Extension" in (FRAMESG.boy || {})) && !("One_Arm_Supinated_Dumbbell_Triceps_Extension" in (FRAMESG.nb || {})) &&
    FFG("One_Arm_Supinated_Dumbbell_Triceps_Extension", "girl") === null && FFG("One_Arm_Supinated_Dumbbell_Triceps_Extension", "boy") === null;
})());
check("graphic wiring: Palms-Down Dumbbell Wrist Curl Over A Bench (held on form at the master) carries no set under any figure", (() => {
  return !("Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.girl || {})) && !("Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.boy || {})) && !("Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.nb || {})) &&
    FFG("Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench", "girl") === null && FFG("Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench", "boy") === null;
})());
check("graphic wiring: Palms-Down Wrist Curl Over A Bench (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Palms-Down_Wrist_Curl_Over_A_Bench" in (FRAMESG.girl || {})) && !("Palms-Down_Wrist_Curl_Over_A_Bench" in (FRAMESG.boy || {})) && !("Palms-Down_Wrist_Curl_Over_A_Bench" in (FRAMESG.nb || {})) &&
    FFG("Palms-Down_Wrist_Curl_Over_A_Bench", "girl") === null && FFG("Palms-Down_Wrist_Curl_Over_A_Bench", "boy") === null;
})());
check("graphic wiring: Palms-Up Barbell Wrist Curl Over A Bench (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.girl || {})) && !("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.boy || {})) && !("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.nb || {})) &&
    FFG("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench", "girl") === null && FFG("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench", "boy") === null;
})());
check("graphic wiring: Palms-Up Dumbbell Wrist Curl Over A Bench (held on form at the master) carries no set under any figure", (() => {
  return !("Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.girl || {})) && !("Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.boy || {})) && !("Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench" in (FRAMESG.nb || {})) &&
    FFG("Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench", "girl") === null && FFG("Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench", "boy") === null;
})());
check("graphic wiring: Preacher Hammer Dumbbell Curl (held on form at the master) carries no set under any figure", (() => {
  return !("Preacher_Hammer_Dumbbell_Curl" in (FRAMESG.girl || {})) && !("Preacher_Hammer_Dumbbell_Curl" in (FRAMESG.boy || {})) && !("Preacher_Hammer_Dumbbell_Curl" in (FRAMESG.nb || {})) &&
    FFG("Preacher_Hammer_Dumbbell_Curl", "girl") === null && FFG("Preacher_Hammer_Dumbbell_Curl", "boy") === null;
})());
check("graphic wiring: Seated Dumbbell Palms-Down Wrist Curl (held on form at the master) carries no set under any figure", (() => {
  return !("Seated_Dumbbell_Palms-Down_Wrist_Curl" in (FRAMESG.girl || {})) && !("Seated_Dumbbell_Palms-Down_Wrist_Curl" in (FRAMESG.boy || {})) && !("Seated_Dumbbell_Palms-Down_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Seated_Dumbbell_Palms-Down_Wrist_Curl", "girl") === null && FFG("Seated_Dumbbell_Palms-Down_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Seated Bent-Over One-Arm Dumbbell Triceps Extension (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.girl || {})) && !("Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.boy || {})) && !("Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.nb || {})) &&
    FFG("Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension", "girl") === null && FFG("Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension", "boy") === null;
})());
check("graphic wiring: Seated Dumbbell Palms-Up Wrist Curl (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Seated_Dumbbell_Palms-Up_Wrist_Curl" in (FRAMESG.girl || {})) && !("Seated_Dumbbell_Palms-Up_Wrist_Curl" in (FRAMESG.boy || {})) && !("Seated_Dumbbell_Palms-Up_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Seated_Dumbbell_Palms-Up_Wrist_Curl", "girl") === null && FFG("Seated_Dumbbell_Palms-Up_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Seated One-Arm Dumbbell Palms-Up Wrist Curl (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl" in (FRAMESG.girl || {})) && !("Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl" in (FRAMESG.boy || {})) && !("Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl", "girl") === null && FFG("Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Seated Palm-Up Barbell Wrist Curl (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Seated_Palm-Up_Barbell_Wrist_Curl" in (FRAMESG.girl || {})) && !("Seated_Palm-Up_Barbell_Wrist_Curl" in (FRAMESG.boy || {})) && !("Seated_Palm-Up_Barbell_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Seated_Palm-Up_Barbell_Wrist_Curl", "girl") === null && FFG("Seated_Palm-Up_Barbell_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Seated Palms-Down Barbell Wrist Curl (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Seated_Palms-Down_Barbell_Wrist_Curl" in (FRAMESG.girl || {})) && !("Seated_Palms-Down_Barbell_Wrist_Curl" in (FRAMESG.boy || {})) && !("Seated_Palms-Down_Barbell_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Seated_Palms-Down_Barbell_Wrist_Curl", "girl") === null && FFG("Seated_Palms-Down_Barbell_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Seated Two-Arm Palms-Up Low-Pulley Wrist Curl (held on form at the master) carries no set under any figure", (() => {
  return !("Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl" in (FRAMESG.girl || {})) && !("Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl" in (FRAMESG.boy || {})) && !("Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl", "girl") === null && FFG("Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Smith Machine Decline Press (held at the master, its frames never attempted under the batch stop, master banked) carries no set under any figure", (() => {
  return !("Smith_Machine_Decline_Press" in (FRAMESG.girl || {})) && !("Smith_Machine_Decline_Press" in (FRAMESG.boy || {})) && !("Smith_Machine_Decline_Press" in (FRAMESG.nb || {})) &&
    FFG("Smith_Machine_Decline_Press", "girl") === null && FFG("Smith_Machine_Decline_Press", "boy") === null;
})());
check("graphic wiring: Smith Machine Hip Raise (refused at the master itself, nothing banked) carries no set under any figure", (() => {
  return !("Smith_Machine_Hip_Raise" in (FRAMESG.girl || {})) && !("Smith_Machine_Hip_Raise" in (FRAMESG.boy || {})) && !("Smith_Machine_Hip_Raise" in (FRAMESG.nb || {})) &&
    FFG("Smith_Machine_Hip_Raise", "girl") === null && FFG("Smith_Machine_Hip_Raise", "boy") === null;
})());
check("graphic wiring: Smith Machine Reverse Calf Raises (refused at the master itself, nothing banked) carries no set under any figure", (() => {
  return !("Smith_Machine_Reverse_Calf_Raises" in (FRAMESG.girl || {})) && !("Smith_Machine_Reverse_Calf_Raises" in (FRAMESG.boy || {})) && !("Smith_Machine_Reverse_Calf_Raises" in (FRAMESG.nb || {})) &&
    FFG("Smith_Machine_Reverse_Calf_Raises", "girl") === null && FFG("Smith_Machine_Reverse_Calf_Raises", "boy") === null;
})());
check("graphic wiring: Spider Curl (held on form at the master) carries no set under any figure", (() => {
  return !("Spider_Curl" in (FRAMESG.girl || {})) && !("Spider_Curl" in (FRAMESG.boy || {})) && !("Spider_Curl" in (FRAMESG.nb || {})) &&
    FFG("Spider_Curl", "girl") === null && FFG("Spider_Curl", "boy") === null;
})());
check("graphic wiring: Standing Bent-Over One-Arm Dumbbell Triceps Extension (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.girl || {})) && !("Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.boy || {})) && !("Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.nb || {})) &&
    FFG("Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension", "girl") === null && FFG("Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension", "boy") === null;
})());
check("graphic wiring: Standing Bent-Over Two-Arm Dumbbell Triceps Extension (held on form, nothing banked) carries no set under any figure", (() => {
  return !("Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.girl || {})) && !("Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.boy || {})) && !("Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.nb || {})) &&
    FFG("Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension", "girl") === null && FFG("Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension", "boy") === null;
})());
check("graphic wiring: Standing One-Arm Dumbbell Curl Over Incline Bench (refused at the frame two curl edit, its master banked, the batch stopped there) carries no set under any figure", (() => {
  return !("Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench" in (FRAMESG.girl || {})) && !("Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench" in (FRAMESG.boy || {})) && !("Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench" in (FRAMESG.nb || {})) &&
    FFG("Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench", "girl") === null && FFG("Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench", "boy") === null;
})());
check("graphic wiring: Standing One-Arm Dumbbell Triceps Extension (held on form at the master) carries no set under any figure", (() => {
  return !("Standing_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.girl || {})) && !("Standing_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.boy || {})) && !("Standing_One-Arm_Dumbbell_Triceps_Extension" in (FRAMESG.nb || {})) &&
    FFG("Standing_One-Arm_Dumbbell_Triceps_Extension", "girl") === null && FFG("Standing_One-Arm_Dumbbell_Triceps_Extension", "boy") === null;
})());
check("graphic wiring: Standing Palms-Up Barbell Behind The Back Wrist Curl (held on form at the master) carries no set under any figure", (() => {
  return !("Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl" in (FRAMESG.girl || {})) && !("Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl" in (FRAMESG.boy || {})) && !("Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl" in (FRAMESG.nb || {})) &&
    FFG("Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl", "girl") === null && FFG("Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl", "boy") === null;
})());
check("graphic wiring: Stiff Leg Barbell Good Morning (held at the master, its frames never attempted under the batch stop, master banked) carries no set under any figure", (() => {
  return !("Stiff_Leg_Barbell_Good_Morning" in (FRAMESG.girl || {})) && !("Stiff_Leg_Barbell_Good_Morning" in (FRAMESG.boy || {})) && !("Stiff_Leg_Barbell_Good_Morning" in (FRAMESG.nb || {})) &&
    FFG("Stiff_Leg_Barbell_Good_Morning", "girl") === null && FFG("Stiff_Leg_Barbell_Good_Morning", "boy") === null;
})());
check("graphic wiring: Tricep Dumbbell Kickback (held on form, its true deep master banked and its start frames never made, the kickback family at the frame stage) carries no set under any figure", (() => {
  return !("Tricep_Dumbbell_Kickback" in (FRAMESG.girl || {})) && !("Tricep_Dumbbell_Kickback" in (FRAMESG.boy || {})) && !("Tricep_Dumbbell_Kickback" in (FRAMESG.nb || {})) &&
    FFG("Tricep_Dumbbell_Kickback", "girl") === null && FFG("Tricep_Dumbbell_Kickback", "boy") === null;
})());
check("graphic wiring: Two-Arm Dumbbell Preacher Curl (held on form, its sibling-canvas master banked and its frames never attempted) carries no set under any figure", (() => {
  return !("Two-Arm_Dumbbell_Preacher_Curl" in (FRAMESG.girl || {})) && !("Two-Arm_Dumbbell_Preacher_Curl" in (FRAMESG.boy || {})) && !("Two-Arm_Dumbbell_Preacher_Curl" in (FRAMESG.nb || {})) &&
    FFG("Two-Arm_Dumbbell_Preacher_Curl", "girl") === null && FFG("Two-Arm_Dumbbell_Preacher_Curl", "boy") === null;
})());
check("graphic wiring: Standing Calf Raises holds no set under any figure, the parked exercise stays on the rig", (() => {
  return !("Standing_Calf_Raises" in (FRAMESG.girl || {})) && !("Standing_Calf_Raises" in (FRAMESG.boy || {})) && !("Standing_Calf_Raises" in (FRAMESG.nb || {})) &&
    FFG("Standing_Calf_Raises", "girl") === null && FFG("Standing_Calf_Raises", "boy") === null && FFG("Standing_Calf_Raises", "nb") === null;
})());
check("graphic wiring: every frame path in the map exists on disk", (() => {
  return ["girl", "boy", "nb"].every((fig) => Object.keys(FRAMESG[fig]).every((id) => FRAMESG[fig][id].every((f) => fs.existsSync(new URL("../" + f, import.meta.url)))));
})());
check("graphic wiring: each figure resolves its own sets; only the held bench press falls back to the girl set", (() => {
  return eq(FFG("Plank", "boy"), FRAMESG.boy["Plank"]) && eq(FFG("Plank", "nb"), FRAMESG.nb["Plank"]) &&
    FFG("Leg_Press", "boy")[0] === "assets/anim-boy-leg_press-1.webp" && FFG("Leg_Press", "nb")[0] === "assets/anim-nb-leg_press-1.webp" &&
    !("Barbell_Bench_Press_-_Medium_Grip" in FRAMESG.boy) && !("Barbell_Bench_Press_-_Medium_Grip" in FRAMESG.nb) &&
    eq(FFG("Barbell_Bench_Press_-_Medium_Grip", "boy"), FRAMESG.girl["Barbell_Bench_Press_-_Medium_Grip"]) &&
    eq(FFG("Barbell_Bench_Press_-_Medium_Grip", "nb"), FRAMESG.girl["Barbell_Bench_Press_-_Medium_Grip"]) &&
    eq(FFG("Leg_Press", "girl"), ["assets/station-leg-press-1.webp", "assets/station-leg-press-2.webp", "assets/station-leg-press-3.webp"]) &&
    FFG("No_Such_Exercise", "girl") === null;
})());
check("graphic wiring: the player prefers frames and keeps the rig as the fallback", (() => {
  const a = fs.readFileSync(new URL("../anim.js", import.meta.url), "utf8");
  const mountSlice = a.slice(a.indexOf("function mount("), a.indexOf("function renderAt"));
  return mountSlice.indexOf("framesFor(exId, skin)") >= 0 && mountSlice.indexOf("animFrameImg") >= 0 &&
    mountSlice.indexOf("buildStage(svg, track, skin)") >= 0 && mountSlice.indexOf("animStillImg") >= 0 &&
    a.indexOf("window.FIT_FRAMES = FRAMES") >= 0;
})());
check("graphic wiring: the service worker precaches every frame asset by name", (() => {
  const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
  return ["girl", "boy", "nb"].every((fig) => Object.keys(FRAMESG[fig]).every((id) => FRAMESG[fig][id].every((f) => sw.indexOf('"' + f + '"') >= 0)));
})());

/* --- Expansion Wiring A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y and Z (18 Oct): the
   two hundred fifty expansion tracks. Loaded the way the browser loads them:
   the track data, the
   language layer, the content tables, then the sibling. --- */
const expWin = { window: {} };
new Function("window", fs.readFileSync(new URL("../anim-data.js", import.meta.url), "utf8"))(expWin.window);
new Function("window", fs.readFileSync(new URL("../i18n.js", import.meta.url), "utf8"))(expWin.window);
new Function("window", fs.readFileSync(new URL("../i18n-content.js", import.meta.url), "utf8"))(expWin.window);
new Function("window", fs.readFileSync(new URL("../anim-data-expansion.js", import.meta.url), "utf8"))(expWin.window);
const EXP_ANIM = expWin.window.FIT_ANIM || {};
const EXP_ES = expWin.window.FIT_ANIM_EXPANSION_ES || {};
const EXP_LANG = expWin.window.Lang || { EN: {}, ES: {} };
const EXP_LC = expWin.window.LangContent || { es: { exerciseCue: {} } };
const wordStream = (s) => String(s || "").toLowerCase().replace(/[.,;:]/g, " ").split(/\s+/).filter(Boolean).join(" ");
check("expansion wiring: the sibling carries exactly the two hundred fifty Batch A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y and Z tracks (277 with the shipped set; the held Band Skull Crusher, Barbell Incline Shoulder Raise, Bent Over Dumbbell Rear Delt Raise With Head On Bench, Cable Crunch, Cable Wrist Curl, Calf Raises With Bands, Dumbbell Tricep Extension Pronated Grip, External Rotation, Leverage High Row, Lying Cambered Barbell Row, Lying Supine Dumbbell Curl, One Arm Pronated Dumbbell Triceps Extension, One Arm Supinated Dumbbell Triceps Extension, Palms-Down Dumbbell Wrist Curl Over A Bench, Palms-Down Wrist Curl Over A Bench, Palms-Up Barbell Wrist Curl Over A Bench, Palms-Up Dumbbell Wrist Curl Over A Bench, Preacher Hammer Dumbbell Curl, Seated Bent-Over One-Arm Dumbbell Triceps Extension, Seated Dumbbell Palms-Down Wrist Curl, Seated Dumbbell Palms-Up Wrist Curl, Seated One-Arm Dumbbell Palms-Up Wrist Curl, Seated Palm-Up Barbell Wrist Curl, Seated Palms-Down Barbell Wrist Curl, Seated Two-Arm Palms-Up Low-Pulley Wrist Curl, Smith Machine Decline Press, Smith Machine Hip Raise, Smith Machine Reverse Calf Raises, Spider Curl, Standing Bent-Over One-Arm Dumbbell Triceps Extension, Standing Bent-Over Two-Arm Dumbbell Triceps Extension, Standing One-Arm Dumbbell Curl Over Incline Bench, Standing One-Arm Dumbbell Triceps Extension, Standing Palms-Up Barbell Behind The Back Wrist Curl, Stiff Leg Barbell Good Morning, Tricep Dumbbell Kickback and Two-Arm Dumbbell Preacher Curl are not among them)", (() => {
  return eq(ALL_EXP_SETS.filter((id) => !!EXP_ANIM[id]).sort(), ALL_EXP_SETS.slice().sort()) &&
    Object.keys(EXP_ANIM).length === 277 && !("Band_Skull_Crusher" in EXP_ANIM) && !("Barbell_Incline_Shoulder_Raise" in EXP_ANIM) && !("Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench" in EXP_ANIM) && !("Cable_Crunch" in EXP_ANIM) && !("Cable_Wrist_Curl" in EXP_ANIM) && !("Calf_Raises_-_With_Bands" in EXP_ANIM) && !("Dumbbell_Tricep_Extension_-Pronated_Grip" in EXP_ANIM) && !("External_Rotation" in EXP_ANIM) && !("Leverage_High_Row" in EXP_ANIM) && !("Lying_Cambered_Barbell_Row" in EXP_ANIM) && !("Lying_Supine_Dumbbell_Curl" in EXP_ANIM) && !("One_Arm_Pronated_Dumbbell_Triceps_Extension" in EXP_ANIM) && !("One_Arm_Supinated_Dumbbell_Triceps_Extension" in EXP_ANIM) && !("Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench" in EXP_ANIM) && !("Palms-Down_Wrist_Curl_Over_A_Bench" in EXP_ANIM) && !("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench" in EXP_ANIM) && !("Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench" in EXP_ANIM) && !("Preacher_Hammer_Dumbbell_Curl" in EXP_ANIM) && !("Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in EXP_ANIM) && !("Seated_Dumbbell_Palms-Down_Wrist_Curl" in EXP_ANIM) && !("Seated_Dumbbell_Palms-Up_Wrist_Curl" in EXP_ANIM) && !("Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl" in EXP_ANIM) && !("Seated_Palm-Up_Barbell_Wrist_Curl" in EXP_ANIM) && !("Seated_Palms-Down_Barbell_Wrist_Curl" in EXP_ANIM) && !("Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl" in EXP_ANIM) && !("Smith_Machine_Decline_Press" in EXP_ANIM) && !("Smith_Machine_Hip_Raise" in EXP_ANIM) && !("Smith_Machine_Reverse_Calf_Raises" in EXP_ANIM) && !("Spider_Curl" in EXP_ANIM) && !("Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension" in EXP_ANIM) && !("Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension" in EXP_ANIM) && !("Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench" in EXP_ANIM) && !("Standing_One-Arm_Dumbbell_Triceps_Extension" in EXP_ANIM) && !("Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl" in EXP_ANIM) && !("Stiff_Leg_Barbell_Good_Morning" in EXP_ANIM) && !("Tricep_Dumbbell_Kickback" in EXP_ANIM) && !("Two-Arm_Dumbbell_Preacher_Curl" in EXP_ANIM) &&
    GX.EXERCISES.slice(27).every((x) => ALL_EXP_SETS.indexOf(x.id) !== -1 || !EXP_ANIM[x.id]);
})());
check("expansion wiring: every expansion track is player shaped (two key poses, sane loop times, three full bubbles, watch in range)", ALL_EXP_SETS.every((id) => { const tr = EXP_ANIM[id]; return !!tr && !!tr.keys && !!tr.keys[0] && !!tr.keys[0].hip && !!tr.keys[1] && Array.isArray(tr.t) && tr.t.length === 3 && tr.t[0] > 0.3 && tr.t[0] < tr.t[1] && tr.t[1] < tr.t[2] && tr.t[2] <= 3.2 && Array.isArray(tr.bubbles) && tr.bubbles.length === 3 && tr.bubbles.every((x) => typeof x === "string" && x.trim().length > 0) && tr.watch >= 0 && tr.watch <= 2; }));
check("expansion wiring: form invariants hold on every expansion track", ALL_EXP_SETS.every((id) => (EXP_ANIM[id].invariants || []).length >= 1 && EXP_ANIM[id].invariants.every((inv) => invOk(EXP_ANIM[id], inv))));
check("expansion wiring: the bubbles are the exercise's own English cue words, nothing added and nothing dropped", ALL_EXP_SETS.every((id) => { const ex = GX.EXERCISES.find((e) => e.id === id); return !!ex && wordStream(EXP_ANIM[id].bubbles.join(" ")) === wordStream(ex.cue); }));
check("expansion wiring: the Spanish bubbles are the shipped Spanish cue's words, and the layer resolves them", (() => {
  if (EXP_LANG.use("es") !== "es") return false;
  return ALL_EXP_SETS.every((id) => Array.isArray(EXP_ES[id]) && wordStream(EXP_ES[id].join(" ")) === wordStream((EXP_LC.es.exerciseCue || {})[id]) &&
    EXP_ANIM[id].bubbles.every((b, i) => EXP_LANG.EN["bub." + id + "." + i] === b && EXP_LANG.ES["bub." + id + "." + i] === EXP_ES[id][i] && EXP_LANG.t("bub." + id + "." + i) === EXP_ES[id][i]));
})());
check("expansion wiring: bubble claims lint and the no-dash rule hold on the two hundred fifty in both languages", (() => {
  const copy = ALL_EXP_SETS.map((id) => EXP_ANIM[id].bubbles.join(" ") + " " + (EXP_ES[id] || []).join(" ")).join(" ").toLowerCase();
  /* "dose" is read as a whole word here: the shipped Spanish
     cue's "mirándose" holds those letters inside a reflexive
     verb and is not dosing language. */
  return BANNED.every((w) => copy.indexOf(w) === -1) &&
    ["burn", "torch fat", "fix your", "you must", "no pain", "mg"].every((w) => copy.indexOf(w) === -1) &&
    !/\bdose\b/.test(copy) && !/[—–]/.test(copy);
})());
check("expansion wiring: the shell loads the sibling after the content tables and before the app", (() => {
  const h = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  return h.indexOf("anim-data-expansion.js") > h.indexOf("i18n-content.js") && h.indexOf("anim-data-expansion.js") < h.indexOf("app.js");
})());

/* --- Tranche B: the tier machine (item 6) --- */
const authSrcB = fs.readFileSync(new URL("../auth.js", import.meta.url), "utf8");
const appSrcB = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function tierBlock() {
  const a = authSrcB.indexOf("TIER-MACHINE-BEGIN"), b = authSrcB.indexOf("TIER-MACHINE-END");
  if (a < 0 || b < 0) return null;
  const start = authSrcB.indexOf("*/", a) + 2, end = authSrcB.lastIndexOf("/*", b);
  const src = authSrcB.slice(start, end);
  return new Function("resolvedPlan",
    src + "\nreturn { setAccountAge: setAccountAge, resolveTier: resolveTier, entitlementDetail: entitlementDetail };");
}
check("TB: the tier machine block extracts from auth.js", (() => { try { return !!tierBlock(); } catch (e) { return false; } })());
check("TB: comp wins over every other leg", (() => {
  const F = tierBlock(); const f = F(null);
  const now = Date.parse("2026-10-17T00:00:00.000Z");
  return f.resolveTier("pro", null, now).reason === "comp" &&
         f.resolveTier("pro", "2020-01-01T00:00:00.000Z", now).plan === "pro" &&
         f.resolveTier("pro", "2026-10-17T00:00:00.000Z", now).reason === "comp";
})());
check("TB: free month window edges at day 0, 29, 30, 31", (() => {
  const F = tierBlock(); const f = F(null);
  const start = Date.parse("2026-09-17T12:00:00.000Z"), day = 86400000;
  const iso = new Date(start).toISOString();
  const d0 = f.resolveTier("free", iso, start);
  const d29 = f.resolveTier("free", iso, start + 29 * day);
  const d30 = f.resolveTier("free", iso, start + 30 * day);
  const d31 = f.resolveTier("free", iso, start + 31 * day);
  return d0.plan === "pro" && d0.reason === "freemonth" && d0.daysLeft === 30 &&
         d29.plan === "pro" && d29.daysLeft === 1 &&
         d30.plan === "free" && d30.reason === "free" && d31.plan === "free";
})());
check("TB: fail-closed with no sync and no account age", (() => {
  const F = tierBlock(); const f = F(null);
  return f.resolveTier(null, null, Date.now()).plan === "free" &&
         f.resolveTier(null, "not a date", Date.now()).plan === "free" &&
         f.entitlementDetail().plan === "free";
})());
check("TB: entitlementDetail follows the handed-over account age", (() => {
  const F = tierBlock(); const f = F(null);
  f.setAccountAge(new Date(Date.now() - 10 * 86400000).toISOString());
  const d = f.entitlementDetail();
  return d.plan === "pro" && d.reason === "freemonth" && d.daysLeft === 20;
})());
check("TB: firstSeenAt is stamped at first load and carried across repairs", (() => {
  return appSrcB.indexOf("function repairKeep") >= 0 &&
    appSrcB.indexOf("firstSeenAt: (state.profile && state.profile.firstSeenAt)") >= 0 &&
    (appSrcB.match(/repairKeep\(/g) || []).length >= 6 &&
    authSrcB.indexOf("setAccountAge") >= 0 && appSrcB.indexOf("setAccountAge") >= 0;
})());
check("TB: no feature enforces a cap (the tier is display + resolution only)", (() => {
  const logic = fs.readFileSync(new URL("../logic.js", import.meta.url), "utf8");
  const builder = logic.slice(logic.indexOf("function routinePool"), logic.indexOf("function buildRoutine") + 1500);
  return logic.indexOf("entitlement") === -1 && builder.indexOf("tier") === -1 && builder.indexOf("entitlement") === -1 &&
    appSrcB.indexOf("buildRoutine") >= 0 && appSrcB.slice(appSrcB.indexOf("buildRoutine") - 200, appSrcB.indexOf("buildRoutine") + 200).indexOf("tierDetail") === -1;
})());

/* --- Tranche B: the Plans screen (item 6) --- */
check("TB: the Plans view exists and the modal button lands there", (() => {
  return htmlB.indexOf('id="view-plans"') >= 0 && htmlB.indexOf('id="plansBox"') >= 0 &&
    appSrcB.indexOf("function renderPlans") >= 0 && appSrcB.indexOf('showView("plans")') >= 0 &&
    appSrcB.indexOf('id="accPlansBtn"') >= 0;
})());
check("TB: Forever lives on the Plans surface only, never in the modal", (() => {
  const modal = htmlB.slice(htmlB.indexOf('id="proModal"'), htmlB.indexOf('id="recipeModal"'));
  return modal.indexOf("Forever") === -1 && modal.indexOf("forever") === -1 &&
    appSrcB.indexOf("plan.t3Name") >= 0 && appSrcB.indexOf('id="planBuyForever"') >= 0 &&
    appSrcB.indexOf("plan.t3Body") >= 0;
})());
check("TB: Plans carries the restore road and the three tiers in the layer", (() => {
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  const keys = ["plan.t0Name", "plan.t0Body", "plan.t1Name", "plan.t1Body", "plan.t2Name", "plan.t2Body", "plan.t3Name", "plan.t3Body", "plan.restoreBtn", "acc.planFreeMonth"];
  return keys.every((k) => typeof L2.EN[k] === "string" && typeof L2.ES[k] === "string" && !/[—–]/.test(L2.EN[k] + L2.ES[k])) &&
    appSrcB.indexOf('id="planRestoreBtn"') >= 0;
})());
check("TB: the enabling wiring is honest (the RC Apple public key stands in the config; the Android slot stays empty until a Play app exists)", (() => {
  return htmlB.indexOf('revenueCatIosKey: "appl_') >= 0 && htmlB.indexOf('revenueCatAndroidKey: ""') >= 0 &&
    appSrcB.indexOf("function purchasable()") >= 0 && appSrcB.indexOf("pro.stateWait") >= 0 &&
    appSrcB.indexOf('P.configure({ apiKey: apiKey() })') >= 0;
})());
check("TB + SR leg: the Plans purchasability line has its OWN key pair, verbatim in EN + ES", (() => {
  const L2 = require(require("path").join(process.cwd(), "i18n.js"));
  return L2.EN["plan.notOnSale"] === "Pro is not on sale in the store yet. The free app stays yours, and Pro opens when the store does." &&
    L2.ES["plan.notOnSale"] === "Pro todavía no está a la venta en la tienda. La versión gratis es tuya para siempre, y Pro llega con la tienda." &&
    L2.EN["plan.notOnSale"] !== L2.EN["pro.notOnSale"] &&
    appSrcB.indexOf('tr("plan.notOnSale")') >= 0;
})());
check("TB + SR leg: the modal button routes to the Plans screen (the old account-box loop is gone)", (() => {
  const go = appSrcB.slice(appSrcB.indexOf('$("proGo")'), appSrcB.indexOf('$("proGo")') + 200);
  return go.indexOf("openPlans()") >= 0 && go.indexOf("accountBox") === -1 && go.indexOf('showView("settings")') === -1;
})());
check("TB: the client never writes the comp record (the seam only reads and refreshes)", (() => {
  return appSrcB.indexOf('"_comp"') === -1 && appSrcB.indexOf("_comp") === -1 &&
    appSrcB.indexOf("syncPlan(authUser.uid, false)") >= 0;
})());

/* --- Tranche B: own-currency prices (item 7) --- */
check("TB: prices module carries Finance's Fit lines exactly", (() => {
  const P = require(require("path").join(process.cwd(), "prices-data.js"));
  const jp = P.priceFor("JP", "monthly"), inY = P.priceFor("IN", "yearly"), eu = P.priceFor("DE", "forever"), us = P.priceFor("US", "monthly");
  return jp.text === "¥590" && jp.worth === "A$5.99" &&
         inY.text === "₹1,199" && inY.worth === "A$21.00" &&
         eu.text === "€75.99" && eu.worth === "A$134.10" &&
         us.text === "$5.99" && us.worth === "A$7.99" &&
         P.priceFor("BR", "monthly").text === "R$16.90" &&
         P.priceFor("PH", "forever").text === "₱2,539";
})());
check("TB: unpriced countries fall back, never invent (NZ, GB, MX, ES line is the euro line)", (() => {
  const P = require(require("path").join(process.cwd(), "prices-data.js"));
  return P.priceFor("NZ", "monthly") === null && P.priceFor("GB", "monthly") === null &&
         P.priceFor("MX", "monthly") === null && P.priceFor("ES", "monthly").text === "€4.99" &&
         P.homePrice("monthly") === "A$7.99" && P.homePrice("yearly") === "A$59.99" && P.homePrice("forever") === "A$149";
})());
check("TB: currency coverage is 7 priced lines over 30 country codes", (() => {
  const P = require(require("path").join(process.cwd(), "prices-data.js"));
  return P.LINES.length === 7 && Object.keys(P.COUNTRIES).length === 30;
})());
check("TB: prices ride the bundle (script tag, precache, store refresh)", (() => {
  const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
  const refresh = fs.readFileSync(new URL("../hidden_files/refresh_store_web.py", import.meta.url), "utf8");
  return htmlB.indexOf('src="prices-data.js"') >= 0 && sw.indexOf('"prices-data.js"') >= 0 && refresh.indexOf('"prices-data.js"') >= 0;
})());

/* Native door fix: inside the store wraps the Google and Apple
   doors run natively through the Capacitor Firebase
   Authentication plugin and complete the web session from the
   returned credential; browsers keep the popup doors. */
check("ND: native door route present (plugin detected, credential completes the session)", (() => { const src = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return src.indexOf("function nativeDoorPlugin()") >= 0 && src.indexOf("Capacitor.isNativePlatform()") >= 0 && src.indexOf("Plugins.FirebaseAuthentication") >= 0 && src.indexOf("plugin.signInWithGoogle()") >= 0 && src.indexOf("plugin.signInWithApple()") >= 0 && src.indexOf("skipNativeAuth") === -1 && src.indexOf("GoogleAuthProvider.credential(credential.idToken)") >= 0 && src.indexOf("rawNonce: credential.nonce") >= 0 && src.indexOf("signInWithCredential(auth,") >= 0; })());
check("ND: web popup doors stay the browser road (the popup calls stand verbatim; the fleet-census bound wraps their promise, never their mechanism)", (() => { const src = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return src.indexOf('withDoorTimeout(signInWithPopup(auth, new GoogleAuthProvider()), 30000)') >= 0 && src.indexOf('withDoorTimeout(signInWithPopup(auth, new OAuthProvider("apple.com")), 30000)') >= 0; })());
check("BOUNDED DOORS (fleet census, 19 Oct): every door promise races a clock — native Google/Apple 60s, popup + email + reset 30s — a never-settling sheet rejects fit/door-timeout into the caller's honest line", (() => { const a7 = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return a7.indexOf("function withDoorTimeout(promise, ms)") !== -1 && a7.indexOf('e.code = "fit/door-timeout"') !== -1 && a7.indexOf("withDoorTimeout(nativeSignInWithGoogle(plugin), 60000)") !== -1 && a7.indexOf("withDoorTimeout(nativeSignInWithApple(plugin), 60000)") !== -1 && a7.indexOf("withDoorTimeout(signInWithEmailAndPassword(auth, email, password), 30000)") !== -1; })());
check("MIRROR NOTE TRUTH (the Test chair's flash observation, 21 Oct): the tier slice's by-design comp refusal never fails the mirror; every other refusal still does", (() => { const a8 = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return a8.indexOf('pair[0] === "tier" && pair[1] && pair[1].plan === "pro" && e && e.code === "permission-denied"') !== -1 && a8.indexOf("if (badSlice.length) throw badSlice[0];") !== -1; })());
check("CALENDAR MONTH FIT (QA finding F-B9-1): the month grid columns can shrink below content size — a planned week never pushes the Sunday column off the phone", (() => { const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return css.includes("grid-template-columns:repeat(7,minmax(0,1fr))") && css.includes("min-width:0;overflow:hidden") && css.includes("text-overflow:ellipsis"); })());
check("CHROME CLEARS THE STATUS BAR (fleet ruling, Ilse 21 Oct): the top strip and the sidebar grow by the safe-area inset taken once as --sat", (() => { const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return css.includes("--sat: env(safe-area-inset-top, 0px);") && css.includes("padding-top:calc(8px + var(--sat))") && css.includes("top:calc(49px + var(--sat))") && css.includes("height:calc(100vh - 49px - var(--sat))"); })());
check("NO DOUBLE-TAP ZOOM (fleet ruling, 21 Oct): the viewport caps scaling and the shell takes touch-action manipulation, so a double tap never zooms the app", (() => { const h = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return h.includes("maximum-scale=1, user-scalable=no") && css.includes("touch-action:manipulation"); })());
check("DOOR FIRST (Polar F1, as amended by the account-mandatory ruling, 21 Oct): a cold open with no setup done lands on the door, never the setup form, and the door carries NO guest road", (() => { const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const i9 = require("fs").readFileSync(new URL("../i18n.js", import.meta.url), "utf8"); const boot = a.slice(a.lastIndexOf("initAccounts();")); return boot.includes('showView("settings")') && !boot.includes("if (!demoReturning) openSetup();") && !a.includes("accGuestBtn") && !i9.includes("door.guestBtn"); })());
check("DOOR PURITY (fleet ruling, 21 Oct): before entry the app shows the door only — renderAccount toggles signedOut, the sheet hides the menu, the float, every other settings card and the guide controls", (() => { const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const h = require("fs").readFileSync(new URL("../index.html", import.meta.url), "utf8"); const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return a.includes('document.body.classList.toggle("signedOut", !authUser);') && h.includes('id="accountCard"') && h.includes('id="guideControls"') && css.includes("body.signedOut #guideControls{display:none}") && css.includes("body.signedOut #view-settings .card:not(#accountCard){display:none}"); })());
check("THE DOOR CURE (fleet bisect of record, as amended to the proven control, 21 Oct): on native the Auth is initializeAuth naming browserLocalPersistence, never plain getAuth — the shape that left sign-ins unregistered on device", (() => { const a = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); return a.includes("initializeAuth(app, { persistence: browserLocalPersistence })") && a.includes("window.Capacitor.isNativePlatform()") && a.includes(": getAuth(app);"); })());
check("BIRTH INTEGRITY (F-B11-1): every profile-creating site routes through ensureFullProfile so the four arrays always stand, buildSidebar reads needs under a guard, and the setup SKIP births the stamped whole default on a profile-less state and always persists — a render can never throw on a thin profile, and no road out of the setup leaves the app unborn", (() => { const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); return a.includes("function ensureFullProfile()") && (a.match(/ensureFullProfile\(\);/g) || []).length >= 4 && !a.includes("state.profile = state.profile || {};") && a.includes("var needs = (state.profile && state.profile.needs) || [];") && a.includes("else ensureFullProfile();"); })());
check("D-A + D-B (door-feel ruling, 21 Oct): a tokenless native return is named fit/door-unfinished, never exchanged; a cancel reads as a cancel, silently; while an attempt flies the door is busy and a second tap is a no-op", (() => { const au = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return (au.match(/fit\/door-unfinished/g) || []).length === 2 && a.includes("function isDoorCancel(e)") && a.includes("auth/popup-closed-by-user") && a.includes("function doorAttempt(promise, failKey)") && a.includes("doorBusyOn();") && css.includes("#accountBox.doorBusy button{opacity:.55;pointer-events:none}"); })());
check("SIGN-OUT FINISHES + SPEAKS (QA fix order, 24 Oct): the local session ends by hand whatever the sync does, the server call is bounded, and any failure answers with the sign-out failure line in both languages — the bare silent .then of build 12 can never return", (() => { const au = require("fs").readFileSync(new URL("../auth.js", import.meta.url), "utf8"); const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const i9 = require("fs").readFileSync(new URL("../i18n.js", import.meta.url), "utf8"); return au.includes("return withDoorTimeout(signOut(auth), 10000);") && a.includes("function signOutFlow(okKey)") && a.includes('signOutFlow("acc.signedOut")') && a.indexOf("toast.demoClosed") === -1 && !a.includes('signOutUser().then(function () { toast(tr("acc.signedOut")); })') && !a.includes("signOutUser().catch(function () {})") && a.includes('toast(tr("acc.signOutFail"))') && (i9.match(/"acc\.signOutFail":/g) || []).length === 2 && a.includes("if (!authUser || !window.FitAuth) return;\n      window.FitAuth.saveCloudState(authUser.uid, state)"); })());
check("MODAL SAFE TOP + NO SCROLL CHAIN (Polar device findings F2+F3): sheets pad for the device safe area and their scroll never chains to the page", (() => { const css = require("fs").readFileSync(new URL("../styles.css", import.meta.url), "utf8"); return css.includes("env(safe-area-inset-top, 0px)") && css.includes("overscroll-behavior:contain"); })());
check("EVERY VIEW OPENS AT ITS TOP (Polar device finding F3): showView resets the window scroll", (() => { const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); return a.includes("if (window.scrollTo) window.scrollTo(0, 0);"); })());
check("A ROUTINE NEEDS A DAY (Polar device finding F4): building with no day picked answers plainly and builds nothing", (() => { const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const i9 = require("fs").readFileSync(new URL("../i18n.js", import.meta.url), "utf8"); return a.includes('if (!days.length) { toast(tr("gym.pickDayFirst")); return; }') && i9.includes('"gym.pickDayFirst": "Pick at least one day first."'); })());
check("ONE SET, ONE REP (Polar device finding F5): the sets chip singularises both counts through the word keys", (() => { const a = require("fs").readFileSync(new URL("../app.js", import.meta.url), "utf8"); const i9 = require("fs").readFileSync(new URL("../i18n.js", import.meta.url), "utf8"); return i9.includes('"gym.setsChip": "{sets} {setsWord} x {reps} {unit}"'.replace(" x ", " × ")) && a.includes("function setsChipFor(item)") && a.includes('item.sets === 1 ? tr("gym.setOne") : tr("gym.setsWord")') && a.includes('item.reps === 1 ? tr("gym.repOne") : tr("gym.reps")'); })());
check("ND: Sign in with Apple entitlement ships and is wired for Debug and Release", (() => { const fsx = require("fs"); const ent = fsx.readFileSync(new URL("../../store-build/ios/App/App/App.entitlements", import.meta.url), "utf8"); const pbx = fsx.readFileSync(new URL("../../store-build/ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8"); return ent.indexOf("com.apple.developer.applesignin") >= 0 && ent.indexOf("<string>Default</string>") >= 0 && pbx.split("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;").length - 1 === 2 && pbx.indexOf("App.entitlements */ = {isa = PBXFileReference") >= 0; })());
check("ND: reversed client ID URL scheme carries the real value from the shipped GoogleService-Info.plist", (() => { const fs = require("fs"); const p = fs.readFileSync(new URL("../../store-build/ios/App/App/Info.plist", import.meta.url), "utf8"); const g = fs.readFileSync(new URL("../../store-build/ios/App/App/GoogleService-Info.plist", import.meta.url), "utf8"); const m = g.match(/<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/); return p.indexOf("CFBundleURLTypes") >= 0 && p.indexOf("CFBundleURLSchemes") >= 0 && !!m && p.indexOf(m[1]) >= 0 && p.indexOf("PLACEHOLDER") < 0; })());
check("ND: plugin installed and configured (providers apple + google, skipNativeAuth in the config)", (() => { const fsx = require("fs"); const pkg = JSON.parse(fsx.readFileSync(new URL("../../store-build/package.json", import.meta.url), "utf8")); const cfg = fsx.readFileSync(new URL("../../store-build/capacitor.config.json", import.meta.url), "utf8"); return !!(pkg.dependencies && pkg.dependencies["@capacitor-firebase/authentication"]) && cfg.indexOf('"FirebaseAuthentication"') >= 0 && cfg.indexOf('"apple.com"') >= 0 && cfg.indexOf('"google.com"') >= 0 && cfg.indexOf('"skipNativeAuth":true') >= 0; })());
check("ND: Firebase SDK vendored locally (no CDN module load in the shipped doors)", (() => { const fsx = require("fs"); const a = fsx.readFileSync(new URL("../auth.js", import.meta.url), "utf8"); const o = fsx.readFileSync(new URL("../owner.js", import.meta.url), "utf8"); const sw = fsx.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8"); const names = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"]; const doorsLocal = names.every(n => a.indexOf("./sdk/" + n) >= 0 && o.indexOf("./sdk/" + n) >= 0); const noCdn = a.indexOf("gstatic") === -1 && o.indexOf("gstatic") === -1; const setLoads = names.every(n => { const s = fsx.readFileSync(new URL("../sdk/" + n, import.meta.url), "utf8"); return !/from\s*["']https?:/.test(s) && !/import\s*\(\s*["']https?:/.test(s); }); const stamps = fsx.readFileSync(new URL("../sdk/firebase-app.js", import.meta.url), "utf8").indexOf("10.12.2") >= 0 && fsx.readFileSync(new URL("../sdk/firebase-firestore.js", import.meta.url), "utf8").indexOf("10.12.2") >= 0; const authLocal = fsx.readFileSync(new URL("../sdk/firebase-auth.js", import.meta.url), "utf8").indexOf("./firebase-app.js") >= 0 && fsx.readFileSync(new URL("../sdk/firebase-firestore.js", import.meta.url), "utf8").indexOf("./firebase-app.js") >= 0; const cached = names.every(n => sw.indexOf("sdk/" + n) >= 0); return doorsLocal && noCdn && setLoads && stamps && authLocal && cached; })());

/* --- Challenge (build 17, Wave 1 slice 2) --- */
check("challenge repair: junk becomes null, clamps hold, tasks dedupe + filter", (() => {
  const L2 = require("../logic.js");
  if (L2.repairChallenge({ mode: "wild", startISO: "junk", tasks: [{ kind: "workout" }] }) !== null) return false;
  const c = L2.repairChallenge({ mode: "hard", startISO: "2026-10-01", lengthDays: 9999, tasks: [{ kind: "workout" }, { kind: "workout" }, { kind: "nope" }, { kind: "habit" }, { kind: "custom", label: "Read" }, { kind: "custom", label: "Read" }] });
  return c.lengthDays === 365 && c.tasks.length === 2 && c.mode === "hard";
})());
check("challenge day: real signals satisfy, a miss is a gap, nothing erases", (() => {
  const L2 = require("../logic.js");
  const t = L2.todayKey(), y = L2.addDays(t, -1);
  const st = L2.repairState({ challenge: { mode: "steady", startISO: y, lengthDays: 75, tasks: [{ kind: "workout" }, { kind: "checkin" }] },
    sessions: [{ id: "s1", dateKey: y, status: "done", items: [] }], checkins: {} });
  st.checkins[y] = "ok";
  if (!L2.challengeDay(st, y).done) return false;
  const p = L2.challengeProgress(st, t);
  return p.dayIndex === 2 && p.daysDone === 1 && p.days[0].state === "done" && p.days[1].state === "today" && p.days[2].state === "future";
})());
check("challenge: rest day is neither done nor missed; strict moves only the count", (() => {
  const L2 = require("../logic.js");
  const t = L2.todayKey(), y = L2.addDays(t, -1);
  const st = L2.repairState({ challenge: { mode: "hard", startISO: y, lengthDays: 75, tasks: [{ kind: "meals" }] }, checkins: {} });
  st.challenge.restDays[y] = true;
  let p = L2.challengeProgress(st, t);
  if (p.days[0].state !== "rest" || p.daysDone !== 0) return false;
  delete st.challenge.restDays[y];
  p = L2.challengeProgress(st, t);
  if (p.days[0].state !== "missed" || p.daysDone !== 0) return false;
  st.challenge.ticks[y] = { meals: true };
  p = L2.challengeProgress(st, t);
  if (p.daysDone !== 1) return false;
  st.challenge.strict = true; st.challenge.countFrom = t;
  p = L2.challengeProgress(st, t);
  return p.daysDone === 0 && L2.challengeDay(st, y).done === true;
})());
check("challenge UI: the card, the three modes and the engine calls are in the app", (() => {
  const fs9 = require("fs");
  const a = fs9.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const h = fs9.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const i9 = fs9.readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
  return h.indexOf('id="challengeCard"') !== -1 && a.indexOf("function renderChallenge()") !== -1 &&
    a.indexOf("L.challengeProgress(state, today)") !== -1 && a.indexOf('data-chmode') !== -1 &&
    (i9.match(/"ch\.title":/g) || []).length === 2 && (i9.match(/"ch\.task\.workout":/g) || []).length === 2;
})());
check("water state: repair keeps sane per-day ml, merge takes the fuller day", (() => {
  const L2 = require("../logic.js");
  const t = L2.todayKey();
  const a = L2.repairState({ water: { [t]: 500, junk: 5 } });
  if (a.water[t] !== 500 || Object.keys(a.water).length !== 1) return false;
  const m = L2.mergeStates({ water: { [t]: 900 } }, { water: { [t]: 300 } });
  return m.water[t] === 900 && L2.waterGoalMl({ settings: {} }) === 2000 && L2.waterGoalMl({ settings: { waterGoalMl: 2600 } }) === 2600;
})());


check("water taps: repair recomputes the day total from taps, junk taps filtered", (() => {
  const L2 = require("../logic.js");
  const t = L2.todayKey();
  const a = L2.repairState({ water: { [t]: 100 }, waterTaps: { [t]: [250, 500, 5, "x", 6000] } });
  return a.water[t] === 750 && a.waterTaps[t].length === 2;
})());
check("water reminder: one nudge a day at the chosen time, today only while the goal is open", (() => {
  const L2 = require("../logic.js");
  const t = L2.todayKey();
  const st = L2.repairState({ settings: { waterReminder: "23:59", notifications: true }, water: {} });
  const plan = L2.planReminders(st, t, { now: 0 });
  const waters = plan.filter(r => r.kind === "water");
  if (waters.length !== 7 || waters[0].time !== "23:59") return false;
  st.water[t] = 9999;
  const plan2 = L2.planReminders(st, t, { now: 0 });
  return plan2.filter(r => r.kind === "water").length === 6;
})());
check("water UI: the card, the sip buttons and both languages are in the app", (() => {
  const fs9 = require("fs");
  const a = fs9.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const i9 = fs9.readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
  return a.indexOf("function waterCardHtml()") !== -1 && a.indexOf('data-water="250"') !== -1 &&
    a.indexOf("function wireWater()") !== -1 && (i9.match(/"water\.title":/g) || []).length === 2 &&
    a.indexOf('r.kind === "water" ? tr("water.remindTitle") : r.name') !== -1;
})());


check("food fast roads: favourites repair + merge, recents read the plan newest first", (() => {
  const L2 = require("../logic.js");
  const t = L2.todayKey(), y = L2.addDays(t, -1);
  const st = L2.repairState({ favRecipes: ["a", "b", "a", 5, ""], plan: { [y.replace(/-/g, ".")]: { dinner: "r-old" }, [t.replace(/-/g, ".")]: { breakfast: "r-new", dinner: "r-old" } } });
  if (JSON.stringify(st.favRecipes) !== JSON.stringify(["a", "b", "a", 5, ""].filter(x => typeof x === "string" && x))) return false;
  const rec = L2.recentRecipeIds(st, t);
  if (JSON.stringify(rec) !== JSON.stringify(["r-new", "r-old"])) return false;
  const m = L2.mergeStates({ favRecipes: ["x"] }, { favRecipes: ["y", "x"] });
  return JSON.stringify(m.favRecipes) === JSON.stringify(["x", "y"]);
})());
check("food UI: favourite star, grouped lists, same-as-yesterday, usual treats + free barcode lookup", (() => {
  const fs9 = require("fs");
  const a = fs9.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const i9 = fs9.readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
  return a.indexOf('id="rmFav"') !== -1 && a.indexOf("L.recentRecipeIds(state, L.todayKey())") !== -1 &&
    a.indexOf('id="sameYesterdayBtn"') !== -1 && a.indexOf("data-utchip") !== -1 &&
    a.indexOf("https://world.openfoodfacts.org/api/v2/product/") !== -1 &&
    (i9.match(/"meal\.barcodeBtn":/g) || []).length === 2 && (i9.match(/"meal\.favAdd":/g) || []).length === 2;
})());


check("money trust: the free list, the one-item Pro list and the yearly maths stand on Plans, prices match the store anchors", (() => {
  const fs9 = require("fs");
  const a = fs9.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const i9 = require("../i18n.js");
  const pd = fs9.readFileSync(new URL("../prices-data.js", import.meta.url), "utf8");
  return a.indexOf('tr("plan.freeItems").split("|")') !== -1 && a.indexOf('tr("plan.yearlyMaths"') !== -1 &&
    i9.EN["plan.freeItems"].split("|").length === 10 && i9.ES["plan.freeItems"].split("|").length === 10 &&
    pd.indexOf('"monthly":7.99') !== -1 && pd.indexOf('"yearly":59.99') !== -1 && pd.indexOf('"forever":149') !== -1 &&
    a.indexOf('"A$7.99"') !== -1 && a.indexOf('"A$59.99"') !== -1 && a.indexOf('"A$149"') !== -1;
})());

console.log("RESULT pass=" + pass + " fail=" + fail);
if (fail) process.exit(1);

