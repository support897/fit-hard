"""Phase 1 E2E: tabs, sub-tabs, More, Today day plan, accessibility smoke, no console errors."""
import json, datetime
from harness import *

from fixtures import *

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail) if (detail and not cond) else ""))

with server():
    with app_page(state=seeded()) as pg:
        pg.screenshot(path="/home/user/work/shots_phase1/today_390.png", full_page=True)
        check("tab bar visible with 5 tabs", pg.locator("#tabBar .tabBtn:visible").count() == 5)
        check("old sidebar hidden", not pg.locator("#sidebar").is_visible())
        check("Today tab current", pg.locator('#tabBar [data-tab=today]').get_attribute("aria-current") == "page")
        items = pg.locator("#dayTimeline .dayItem").all_inner_texts()
        check("timeline has task+routine+habit", len(items) == 3, items)
        check("timeline sorted by time", [x.split("\n")[0] for x in items][:2] == ["09:00", "18:00"], items)
        check("next step shows earliest open", "Buy oats" in pg.locator("#nextStep").inner_text())
        # mark task done
        pg.locator('#dayTimeline .dayItem >> text=Buy oats').locator("xpath=ancestor::li").locator("button").click()
        pg.wait_for_timeout(200)
        check("task done persists in state", pg.evaluate("JSON.parse(localStorage.getItem('fit-app-v1')).todos[0].status") == "done")
        check("next step moves on", "Full body" in pg.locator("#nextStep").inner_text(), pg.locator("#nextStep").inner_text())
        # tabs navigate
        for tab, title, sub in [("food", "Food", "Meal plan"), ("train", "Train", "Routines"), ("calendar", "Calendar", "Month")]:
            pg.click(f'#tabBar [data-tab={tab}]'); pg.wait_for_timeout(250)
            check(f"{tab} tab opens {title}", pg.locator("#areaTitle").inner_text() == title and pg.locator(f'#tabBar [data-tab={tab}]').get_attribute("aria-current") == "page", pg.locator("#areaTitle").inner_text())
            check(f"{tab} shows sub tabs", pg.locator("#subTabs .subTab").count() >= 3)
        # sub tab switching + memory
        pg.click('#tabBar [data-tab=food]'); pg.click('#subTabs [data-subtab=meal-recipes]'); pg.wait_for_timeout(250)
        check("sub tab switches", "Recipes" in pg.locator("#areaSub").inner_text(), pg.locator("#areaSub").inner_text())
        pg.click('#tabBar [data-tab=today]'); pg.click('#tabBar [data-tab=food]'); pg.wait_for_timeout(200)
        check("tab remembers last section", pg.locator('#subTabs .subTab.active').get_attribute("data-subtab") == "meal-recipes")
        # More
        pg.click('#tabBar [data-tab=more]'); pg.wait_for_timeout(200)
        check("More lists 4 destinations", pg.locator("#moreList .moreRow").count() == 4)
        pg.click('[data-more=health]'); pg.wait_for_timeout(250)
        check("Health tracker opens peptides area", pg.locator("#areaTitle").inner_text() == "Peptides" and pg.locator('#tabBar [data-tab=more]').get_attribute("aria-current") == "page")
        pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=settings]'); pg.wait_for_timeout(250)
        check("Settings opens from More", pg.locator("#view-settings").is_visible())
        # quick actions
        pg.click('#tabBar [data-tab=today]'); pg.click('[data-qa=task]'); pg.wait_for_timeout(250)
        check("quick action Add a task -> To do list", "To do" in pg.locator("#areaSub").inner_text(), pg.locator("#areaSub").inner_text())
        # touch targets
        small = pg.evaluate("[...document.querySelectorAll('#tabBar .tabBtn,.subTab,.dayAct,.quickRow .pillBtn,.moreRow')].filter(e=>e.offsetParent&&(e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<44)).map(e=>e.className)")
        check("tap targets >= 44px", not small, small)
        # horizontal overflow
        pg.click('#tabBar [data-tab=today]')
        check("no horizontal overflow at 390", pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
        check("no console/page errors", not pg.errors, pg.errors)
    # empty state
    with app_page(state={"profile": {"name": "Sam", "setupDone": True, "needs": ["meals"]}, "settings": {"tourSeen": True}}) as pg:
        check("empty day shows calm message", pg.locator("#dayPlanEmpty").is_visible() and "Rest is a fine plan" in pg.locator("#dayPlanEmpty").inner_text())
        check("empty: no timeline rows", pg.locator("#dayTimeline .dayItem").count() == 0)
    # desktop rail
    with app_page(width=1280, height=800, state=seeded(), touch=False) as pg:
        box = pg.locator("#tabBar").bounding_box()
        check("desktop: tab bar is a left rail", box["x"] == 0 and box["width"] < 140 and box["height"] > 400, box)
        pg.screenshot(path="/home/user/work/shots_phase1/today_1280.png")
        ov = pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth")
        check("desktop: no horizontal overflow", ov)
        check("desktop: content not under rail", pg.locator("#main").bounding_box()["x"] >= 100, pg.locator("#main").bounding_box())
    # signed out: door only, no tabs
    with app_page(signed_out=True) as pg:
        check("signed out: no tab bar", not pg.locator("#tabBar").is_visible())
    # reduced motion + small phone
    with app_page(width=320, height=568, state=seeded(), reduced_motion=True) as pg:
        check("320px: no horizontal overflow", pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
        pg.screenshot(path="/home/user/work/shots_phase1/today_320.png")
        for tab in ["food", "train", "calendar", "more"]:
            pg.click(f'#tabBar [data-tab={tab}]'); pg.wait_for_timeout(200)
            check(f"320px {tab}: no overflow", pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
        check("320px: no errors", not pg.errors, pg.errors)
fails = [r for r in results if not r[1]]
print(f"\nPHASE 1 E2E: {len(results)-len(fails)} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
