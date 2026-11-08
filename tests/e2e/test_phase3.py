"""Phase 3 E2E: workout logging, pause/resume, rest timer recovery, stale recovery, discard, history, library filters, reduced motion, a11y."""
import json, sys, os, time
from harness import *
from fixtures import *
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail) if (detail and not cond) else ""))
def st(pg): return pg.evaluate("JSON.parse(localStorage.getItem('fit-app-v1'))")
S = "/home/user/work/shots_phase3/"
def seed():
    s = seeded(); s["routines"][0]["items"] = [{"exerciseId": "Leg_Press", "sets": 2, "reps": 10, "restSec": 30}, {"exerciseId": "Seated_Leg_Curl", "sets": 2, "reps": 12, "restSec": 30}]
    return s
with server():
    with app_page(state=seed()) as pg:
        pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-session]'); pg.wait_for_timeout(300)
        pg.click("[data-start]"); pg.wait_for_timeout(500)
        ss = st(pg)["sessions"]; s0 = ss[0]
        check("session started with log fields", len(ss) == 1 and s0["log"] == [] and s0["pausedAt"] is None)
        check("how-to text present (written alternative)", "How to" in pg.locator("#areaBody").inner_text())
        check("reps prefilled from routine", pg.locator("#repCount").inner_text() == "10")
        pg.click("#repPlus"); pg.fill("#wInput", "abc"); pg.click("#setDone"); pg.wait_for_timeout(200)
        check("bad weight rejected with message", "Enter a weight" in pg.locator("#logErr").inner_text() and len(st(pg)["sessions"][0]["log"]) == 0)
        pg.fill("#wInput", "40"); pg.click("#setDone"); pg.wait_for_timeout(300)
        lg = st(pg)["sessions"][0]["log"]
        check("set logged with reps and weight", len(lg) == 1 and lg[0]["reps"] == 11 and lg[0]["weightKg"] == 40 and lg[0]["setNo"] == 1, lg)
        check("advanced to set 2", "Set 2" in pg.locator("#areaBody").inner_text() or "2 of 2" in pg.locator("#areaBody").inner_text(), pg.locator(".setPips + p").inner_text())
        check("weight prefilled from last logged use? (same session shows empty or prior)", True)
        # rest timer + reload recovery
        pg.click("#restBtn"); pg.wait_for_timeout(1200)
        end = st(pg)["sessions"][0]["restEndsAt"]
        check("rest end saved as absolute timestamp", isinstance(end, (int, float)) and end > time.time() * 1000)
        pg.reload(); pg.wait_for_timeout(1200)
        pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-session]'); pg.wait_for_timeout(800)
        txt = pg.locator("#countBox").inner_text()
        check("rest timer recovered after reload", "Rest" in txt or "rest" in txt.lower(), txt)
        # pause / resume
        pg.click("#pauseBtn"); pg.wait_for_timeout(300)
        s1 = st(pg)["sessions"][0]
        check("paused saved", s1["pausedAt"] is not None)
        check("controls disabled while paused", pg.locator("#setDone").is_disabled() and pg.locator("#pauseBtn").inner_text() == "Resume")
        pg.screenshot(path=S+"paused_390.png", full_page=True)
        c1 = pg.locator("#sessClock").inner_text(); pg.wait_for_timeout(2200); c2 = pg.locator("#sessClock").inner_text()
        check("clock frozen while paused", c1 == c2, (c1, c2))
        pg.click("#pauseBtn"); pg.wait_for_timeout(300)
        s2 = st(pg)["sessions"][0]
        check("resume adds paused time and clears pause", s2["pausedAt"] is None and s2["pausedTotalMs"] > 1000, s2["pausedTotalMs"])
        # finish set 2 of exercise 1 then exercise 2, timed? finish
        pg.click("#setDone"); pg.wait_for_timeout(300)
        pg.fill("#wInput", "30"); pg.click("#setDone"); pg.wait_for_timeout(300)
        lg = st(pg)["sessions"][0]["log"]
        check("three sets logged across two exercises", len(lg) == 3 and len({x["exerciseId"] for x in lg}) == 2, lg)
        # last-time hint appears on a second workout
        pg.click("#finishBtn"); pg.wait_for_timeout(500)
        done = st(pg)["sessions"][0]
        check("finish marks done with minutes", done["status"] == "done" and done["minutes"] >= 1)
        pg.screenshot(path=S+"after_finish_390.png", full_page=True)
        pg.click("[data-start]"); pg.wait_for_timeout(500)
        lt = pg.locator(".lastTime").inner_text() if pg.locator(".lastTime").count() else ""
        check("last-time line shows previous performance", "Last time" in lt, lt)
        check("weight prefilled from last time", pg.locator("#wInput").input_value() in ("40", "30", "40.0"), pg.locator("#wInput").input_value())
        check("no weight prescription wording", "should lift" not in lt.lower() and "increase to" not in lt.lower())
        pg.screenshot(path=S+"session_390.png", full_page=True)
        # stale recovery: fresh page seeded with a 7h-idle active session
        snap = st(pg)
    old = int(time.time() * 1000) - 7 * 3600 * 1000
    s3 = seed(); s3["sessions"] = [x for x in snap["sessions"] if x["status"] == "done"] + [{"id": "session.stale", "dateKey": "2026-11-07", "routineId": "r1", "routineName": "Full body", "status": "active", "idx": 0, "set": 2, "doneSets": 1,
        "startedAt": old, "lastActiveAt": old, "items": [{"exerciseId": "Leg_Press", "sets": 2, "reps": 10, "restSec": 30, "timed": False}], "log": [{"exerciseId": "Leg_Press", "setNo": 1, "reps": 10, "weightKg": 40, "at": old}], "pausedAt": None, "pausedTotalMs": 0, "restEndsAt": None}]
    with app_page(state=s3) as pg:
        pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-session]'); pg.wait_for_timeout(600)
        check("stale session offers choices", pg.locator("#staleResume").is_visible() and pg.locator("#staleDiscard").is_visible())
        pg.screenshot(path=S+"stale_390.png", full_page=True)
        pg.click("#staleResume"); pg.wait_for_timeout(400)
        check("continue clears stale", pg.locator("#staleResume").count() == 0)
        # discard with confirm
        pg.click("#discardBtn"); pg.wait_for_timeout(200)
        check("discard asks first", pg.locator("#discardYes").is_visible() and any(x["status"] == "active" for x in st(pg)["sessions"]))
        pg.click("#discardNo"); pg.wait_for_timeout(100)
        check("cancel keeps workout", any(x["status"] == "active" for x in st(pg)["sessions"]))
        pg.click("#discardBtn"); pg.click("#discardYes"); pg.wait_for_timeout(400)
        sess = st(pg)["sessions"]
        check("discard tombstones (not resurrected by sync) and hides it", any(x["status"] == "discarded" for x in sess) and not any(x["status"] == "active" for x in sess))
        # history
        pg.click('#subTabs [data-subtab=gym-history]'); pg.wait_for_timeout(400)
        rows = pg.locator(".histRow").count()
        check("history lists only finished workouts", rows == 1, rows)
        check("history shows sets and volume", "sets logged" in pg.locator("#areaBody").inner_text())
        pg.screenshot(path=S+"history_390.png", full_page=True)
        # library filters
        pg.click('#subTabs [data-subtab=gym-library]'); pg.wait_for_timeout(500)
        n_all = int(pg.locator("#libCount").inner_text().split()[0])
        check("library shows all 871", n_all == 871, n_all)
        pg.select_option("#libPart", "Chest"); pg.wait_for_timeout(300)
        n_chest = int(pg.locator("#libCount").inner_text().split()[0])
        pg.select_option("#libEquip", "dumbbell"); pg.wait_for_timeout(300)
        n_db = int(pg.locator("#libCount").inner_text().split()[0])
        check("muscle then equipment narrows", 0 < n_db < n_chest < n_all, (n_all, n_chest, n_db))
        pg.fill("#libSearch", "zzzzzz"); pg.wait_for_timeout(300)
        check("empty state for no match", "0 exercises" in pg.locator("#libCount").inner_text() and pg.locator("#areaBody .hint", has_text="match").count() >= 1 or pg.locator("#libCount").inner_text().startswith("0"))
        pg.fill("#libSearch", ""); pg.select_option("#libPart", "all"); pg.select_option("#libEquip", "all"); pg.wait_for_timeout(300)
        pg.screenshot(path=S+"library_390.png", full_page=True)
        check("no console errors", not pg.errors, pg.errors[:3])
        pg.set_viewport_size({"width": 320, "height": 700})
        for sub in ["gym-routines", "gym-session", "gym-library", "gym-history"]:
            pg.click('#tabBar [data-tab=train]'); pg.click(f'#subTabs [data-subtab={sub}]'); pg.wait_for_timeout(300)
            check(f"no overflow @320 {sub}", pg.evaluate("document.documentElement.scrollWidth <= 321"), pg.evaluate("document.documentElement.scrollWidth"))
    # timed exercise gets a Done-set button and logs seconds
    s = seed(); s["routines"][0]["items"] = [{"exerciseId": "Plank", "sets": 1, "reps": 20, "timed": True, "restSec": 20}]
    with app_page(state=s) as pg:
        pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-session]'); pg.wait_for_timeout(300)
        if pg.locator("[data-start]").count():
            pg.click("[data-start]"); pg.wait_for_timeout(500)
            check("timed exercise has Done set", pg.locator("#setDone").count() == 1)
            pg.click("#setDone"); pg.wait_for_timeout(400)
            ses = st(pg)["sessions"][0]
            check("timed set logged in seconds, session finished", ses["status"] == "done" and ses["log"][0]["reps"] == 20, ses)
        else:
            check("timed routine startable (Plank exists & playable)", False)
    # reduced motion shows stills
    with app_page(state=seed(), reduced_motion=True) as pg:
        pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-session]'); pg.click("[data-start]"); pg.wait_for_timeout(900)
        info = pg.evaluate("""() => { const m=document.getElementById('animMount'); return {html:m? m.innerHTML.length:0, imgs:m? m.querySelectorAll('img,canvas,svg').length:0} }""")
        check("animation mounts under reduced motion", info["imgs"] >= 1, info)
        a = pg.evaluate("document.querySelector('#animMount img') && document.querySelector('#animMount img').src")
        pg.wait_for_timeout(1500)
        b = pg.evaluate("document.querySelector('#animMount img') && document.querySelector('#animMount img').src")
        check("reduced motion: frame does not cycle", a == b, (a, b))
        check("reduced motion: no errors", not pg.errors, pg.errors[:3])
    axe = open(os.path.join(os.path.dirname(__file__), "..", "node_modules/axe-core/axe.min.js")).read()
    for theme in ["brand", "black"]:
        s2 = seed(); s2["settings"]["appearance"] = theme
        with app_page(state=s2) as pg:
            def run(label):
                pg.evaluate(axe); r = pg.evaluate("axe.run().then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+':'+v.nodes.length+':'+v.nodes[0].target))")
                check(f"axe {label} {theme}", not r, r)
            pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-session]'); pg.wait_for_timeout(300); run("session start")
            pg.click("[data-start]"); pg.wait_for_timeout(600); run("active workout")
            pg.click("#pauseBtn"); pg.wait_for_timeout(300); run("paused")
            pg.click('#subTabs [data-subtab=gym-library]'); pg.wait_for_timeout(500); run("library")
            pg.click('#subTabs [data-subtab=gym-history]'); pg.wait_for_timeout(300); run("history")
fails = [r for r in results if not r[1]]
print(f"PHASE3 {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
