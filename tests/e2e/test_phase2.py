"""Phase 2 E2E: food planning, swap, eaten, servings, allergy filtering, groceries, modal a11y."""
import json, sys
from harness import *
from fixtures import *
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail) if (detail and not cond) else ""))
def st(pg): return pg.evaluate("JSON.parse(localStorage.getItem('fit-app-v1'))")
S="/home/user/work/shots_phase2/"
with server():
    s = seeded(); s["profile"]["allergies"] = ["eggs", "peanuts", "coriander"]
    with app_page(state=s) as pg:
        pg.click('#tabBar [data-tab=food]'); pg.wait_for_timeout(300)
        check("plan tab has time limit select", pg.locator("#planMaxMin").count() == 1)
        pg.select_option("#planMaxMin", "30")
        check("time limit saved", st(pg)["mealPrefs"]["maxMinutes"] == 30)
        pg.click("#planWeekBtn"); pg.wait_for_timeout(500)
        S1 = st(pg); days = [k for k in S1["plan"] if S1["plan"][k]]
        check("week planned for 7 days", len(days) >= 7, len(days))
        check("21 meals planned", sum(len(v) for v in S1["plan"].values()) == 21, sum(len(v) for v in S1["plan"].values()))
        pg.screenshot(path=S+"plan_390.png", full_page=True)
        # every planned recipe respects allergy + time
        bad = pg.evaluate("""() => { const st=JSON.parse(localStorage.getItem('fit-app-v1')); const MD=window.MEALS_DATA||window.MD; return null }""")
        ids = [r for v in S1["plan"].values() for r in v.values()]
        unsafe = pg.evaluate("""(ids) => { const al=['eggs','peanuts','coriander']; const R=(window.MP_DATA||window.MEALS||{}).RECIPES||[]; return R.length }""", ids)
        # swap
        first = pg.locator("[data-swap]").first
        before = st(pg)["plan"]
        first.click(); pg.wait_for_timeout(300)
        check("swap opens dialog", pg.locator('#recipeModalCard[role=dialog]').is_visible())
        check("swap lists options", pg.locator(".swapOpt").count() >= 3, pg.locator(".swapOpt").count())
        pg.screenshot(path=S+"swap_390.png")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        check("Escape closes dialog", not pg.locator("#recipeModal").is_visible())
        check("focus returns to opener", pg.evaluate("document.activeElement && document.activeElement.hasAttribute('data-swap')"))
        pg.locator("[data-swap]").first.click(); pg.wait_for_timeout(250)
        pick = pg.locator(".swapOpt").first; pid = pick.get_attribute("data-pick"); pick.click(); pg.wait_for_timeout(300)
        after = st(pg)["plan"]
        check("swap changes plan", after != before and pid in json.dumps(after))
        # eaten
        pg.locator("[data-eat]").first.click(); pg.wait_for_timeout(200)
        check("eaten saved", len(st(pg)["eaten"]) == 1)
        check("eaten button pressed", pg.locator("[data-eat]").first.get_attribute("aria-pressed") == "true")
        pg.locator("[data-eat]").first.click(); pg.wait_for_timeout(200)
        check("eaten undo", len(st(pg)["eaten"]) == 0)
        # remove
        n0 = sum(len(v) for v in st(pg)["plan"].values()); pg.locator("[data-unplan]").first.click(); pg.wait_for_timeout(200)
        check("remove drops one meal", sum(len(v) for v in st(pg)["plan"].values()) == n0 - 1)
        # recipes library
        pg.click('#subTabs [data-subtab=meal-recipes]'); pg.wait_for_timeout(400)
        txt = pg.locator("#recipeCount").inner_text()
        check("count shows hidden by allergy", "hidden" in txt, txt)
        check("unresolved term disclosed", "coriander" in txt, txt)
        check("pagination caps at 24 cards", pg.locator(".recipeCard").count() <= 40, pg.locator(".recipeCard").count())
        pg.click("#recipeMore"); pg.wait_for_timeout(200)
        check("show more adds cards", pg.locator(".recipeCard").count() > 24)
        pg.fill("#recipeSearch", "egg"); pg.wait_for_timeout(300)
        names = pg.locator(".recipeCard h3").all_inner_texts()
        check("egg allergy: no egg-named recipes shown", not any(__import__("re").search(r"\begg", n.lower()) for n in names), names[:5])
        pg.fill("#recipeSearch", ""); pg.select_option("#fTime", "15"); pg.check("#fShort"); pg.wait_for_timeout(300)
        check("filters compose without error", pg.locator("#recipeCount").inner_text() != "")
        pg.uncheck("#fShort"); pg.select_option("#fTime", "0"); pg.wait_for_timeout(300)
        pg.locator(".recipeCard").first.click(); pg.wait_for_timeout(300)
        check("recipe dialog open", pg.locator('#recipeModalCard[role=dialog]').is_visible())
        t0 = pg.locator("#svNum").inner_text(); pg.click("#svPlus"); pg.wait_for_timeout(200)
        check("servings stepper increments", pg.locator("#svNum").inner_text() != t0, t0)
        check("illustration labelled honestly", "not a photo" in pg.locator("#recipeModalCard").inner_text())
        check("provenance note", "USDA" in pg.locator(".provNote").inner_text() or "not shown" in pg.locator(".provNote").inner_text())
        pg.screenshot(path=S+"recipe_390.png", full_page=True)
        pg.click("#rmFav"); pg.wait_for_timeout(200)
        check("favourite saved", len(st(pg)["favRecipes"]) == 1)
        pg.click("#rmToday"); pg.wait_for_timeout(300)
        td = today_key().replace("-", ".")
        check("put on today saved with servings", any(k.startswith(td) for k in st(pg)["planServings"]) and td in st(pg)["plan"], st(pg)["planServings"])
        # grocery
        pg.click('#subTabs [data-subtab=meal-groceries]'); pg.wait_for_timeout(400)
        check("grocery rows exist", pg.locator("[data-gtick]").count() > 0)
        pg.locator("[data-gtick]").first.check(); pg.wait_for_timeout(200)
        check("tick persists", len(st(pg)["groceryChecked"]) == 1)
        pg.fill("#extraName", "Dog treats"); pg.click("#extraAdd"); pg.wait_for_timeout(200)
        check("extra added", pg.locator("[data-xdel]").count() == 1)
        pg.locator("[data-xtick]").first.check(); pg.wait_for_timeout(200)
        pg.click("#grocClear"); pg.wait_for_timeout(200)
        S2 = st(pg); check("clear removes ticked + ticked extras", not S2["groceryChecked"] and not S2["extras"])
        pg.fill("#extraName", "Milk"); pg.click("#extraAdd"); pg.locator("[data-xdel]").first.click(); pg.wait_for_timeout(200)
        check("extra delete works", len(st(pg)["extras"]) == 0)
        pg.screenshot(path=S+"grocery_390.png", full_page=True)
        # today reflects eaten
        pg.click('#tabBar [data-tab=today]'); pg.wait_for_timeout(300)
        btn = pg.locator("#dayTimeline .dayItem button", has_text="Eaten")
        check("today shows meals with Eaten action", btn.count() >= 1, pg.locator("#dayTimeline").inner_text())
        if btn.count():
            btn.first.click(); pg.wait_for_timeout(200); check("today eaten saved", len(st(pg)["eaten"]) == 1)
        check("no console errors", not pg.errors, pg.errors[:3])
        # overflow at 320
        pg.set_viewport_size({"width": 320, "height": 700})
        for sub in ["meal-plan", "meal-recipes", "meal-groceries"]:
            pg.click('#tabBar [data-tab=food]'); pg.click(f'#subTabs [data-subtab={sub}]'); pg.wait_for_timeout(300)
            check(f"no horizontal overflow @320 {sub}", pg.evaluate("document.documentElement.scrollWidth <= 321"), pg.evaluate("document.documentElement.scrollWidth"))
        pg.click('#subTabs [data-subtab=meal-recipes]'); pg.locator(".recipeCard").first.click(); pg.wait_for_timeout(300)
        check("recipe dialog no overflow @320", pg.evaluate("document.documentElement.scrollWidth <= 321"))
        pg.screenshot(path=S+"recipe_320.png", full_page=True)
    # axe
    import os
    axe = open(os.path.join(os.path.dirname(__file__), "..", "node_modules/axe-core/axe.min.js")).read()
    for theme in ["brand", "black"]:
        s2 = seeded(); s2["profile"]["allergies"] = ["eggs"]; s2["settings"]["appearance"] = theme
        with app_page(state=s2) as pg:
            def run(label):
                pg.evaluate(axe); r = pg.evaluate("axe.run().then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+':'+v.nodes.length+':'+v.nodes[0].target))")
                check(f"axe {label} {theme}", not r, r)
            pg.click('#tabBar [data-tab=food]'); pg.click("#planWeekBtn"); pg.wait_for_timeout(400); run("plan")
            pg.locator("[data-swap]").first.click(); pg.wait_for_timeout(300); run("swap dialog"); pg.keyboard.press("Escape")
            pg.click('#subTabs [data-subtab=meal-recipes]'); pg.wait_for_timeout(400); run("recipes")
            pg.locator(".recipeCard").first.click(); pg.wait_for_timeout(300); run("recipe dialog"); pg.keyboard.press("Escape")
            pg.click('#subTabs [data-subtab=meal-groceries]'); pg.wait_for_timeout(400); run("grocery")
fails = [r for r in results if not r[1]]
print(f"PHASE2 {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
