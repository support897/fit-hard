"""Phase 5 E2E: progress overview, strength, body, photos, review, export, opt-out, Wally states, a11y."""
import json, sys, os, time, datetime, re
from harness import *
from fixtures import *
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail) if (detail and not cond) else ""))
def st(pg): return pg.evaluate("JSON.parse(localStorage.getItem('fit-app-v1'))")
S = "/home/user/work/shots_phase5/"
today = datetime.date.today()
def d(n): return (today - datetime.timedelta(days=n)).strftime("%Y-%m-%d")
def sess(i, n, reps, w):
    t = int((time.time() - n * 86400) * 1000)
    return {"id": f"s{i}", "status": "done", "dateKey": d(n), "routineId": "r1", "routineName": "Full body", "startedAt": t, "minutes": 30, "idx": 1, "set": 1, "doneSets": 2,
            "items": [{"exerciseId": "Leg_Press", "sets": 2, "reps": 10, "restSec": 30, "timed": False}], "lastActiveAt": t,
            "log": [{"exerciseId": "Leg_Press", "setNo": 1, "reps": reps, "weightKg": w, "at": t}], "pausedAt": None, "pausedTotalMs": 0, "restEndsAt": None}
def rich():
    s = seeded(); s["sessions"] = [sess(1, 28, 10, 40), sess(2, 21, 12, 40), sess(3, 14, 8, 40), sess(4, 3, 6, 45)]; return s
def go(pg, sub):
    pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=progress]'); pg.wait_for_timeout(250)
    pg.click(f'#subTabs [data-subtab={sub}]'); pg.wait_for_timeout(350)
with server():
    with app_page(state=seeded()) as pg:
        pg.click('#tabBar [data-tab=more]'); pg.wait_for_timeout(200)
        check("More has Progress row", pg.locator('[data-more=progress]').count() == 1)
        pg.click('#tabBar [data-tab=today]'); pg.wait_for_timeout(200)
        check("Today progress card visible, gentle copy", pg.locator("#progressCard").is_visible() and "fresh week" in pg.locator("#progressLine").inner_text().lower(), pg.locator("#progressLine").inner_text())
        pg.click("#progressOpen"); pg.wait_for_timeout(300)
        check("progress card opens overview", pg.locator("#areaTitle").inner_text() == "Progress" and pg.locator("#activeWeeks").inner_text() == "0")
        txt = pg.locator("#areaBody").inner_text()
        check("empty state is encouraging, not negative", "away. No rush" in txt and "fresh week" in txt.lower(), txt[:300])
        pg.screenshot(path=S+"overview_empty_390.png", full_page=True)
        pg.click("#restToggle"); pg.wait_for_timeout(250)
        check("rest day saved + counts", st(pg)["restDays"].get(today.strftime("%Y-%m-%d")) is True and pg.locator("#activeWeeks").inner_text() == "1")
        check("rest toggle aria-pressed", pg.locator("#restToggle").get_attribute("aria-pressed") == "true")
        check("first rest milestone earned", "rest day" in pg.locator("#msList").inner_text().lower())
        pg.click("#restToggle"); pg.wait_for_timeout(250)
        check("rest day undo", not st(pg)["restDays"] and pg.locator("#activeWeeks").inner_text() == "0")
    with app_page(state=rich()) as pg:
        go(pg, "prog-overview")
        check("sessions counted this week", "1 workout" in pg.locator("#progWeek").inner_text(), pg.locator("#progWeek").inner_text())
        check("active weeks total", pg.locator("#activeWeeks").inner_text() == "4", pg.locator("#activeWeeks").inner_text())
        check("milestones listed", "first workout" in pg.locator("#msList").inner_text().lower())
        check("personal best shown with own history", "Leg" in pg.locator("#pbList").inner_text() and "45 kg" in pg.locator("#pbList").inner_text(), pg.locator("#pbList").inner_text())
        check("chart has text alternative", "Workouts per week" in pg.locator('[role=img]').first.get_attribute("aria-label"))
        check("no red/negative wording on overview", not re.search(r"\b(behind|missed|failed|lost|broke|lazy)\b", pg.locator("#areaBody").inner_text(), re.I))
        pg.screenshot(path=S+"overview_390.png", full_page=True)
        go(pg, "prog-strength")
        check("strength table lists sessions", pg.locator(".dataTable tbody tr").count() == 4, pg.locator(".dataTable tbody tr").count())
        check("sparkline has aria label", "Leg" in pg.locator(".sparkline").get_attribute("aria-label"))
        pg.screenshot(path=S+"strength_390.png", full_page=True)
        go(pg, "prog-body")
        pg.fill("#bd_weightKg", "abc"); pg.click("#bdSave"); pg.wait_for_timeout(150)
        check("bad number rejected", "plain number" in pg.locator("#bdErr").inner_text() and not st(pg)["body"])
        pg.fill("#bd_weightKg", ""); pg.click("#bdSave"); pg.wait_for_timeout(150)
        check("empty entry rejected kindly", "at least one" in pg.locator("#bdErr").inner_text())
        pg.fill("#bd_weightKg", "700"); pg.click("#bdSave"); pg.wait_for_timeout(150)
        check("out-of-range rejected", not st(pg)["body"])
        pg.fill("#bd_weightKg", "72,5"); pg.fill("#bd_waistCm", "80"); pg.click("#bdSave"); pg.wait_for_timeout(300)
        b = st(pg)["body"]; check("entry saved with validated numbers", len(b) == 1 and b[0]["weightKg"] == 72.5 and b[0]["waistCm"] == 80, b)
        check("entry listed neutrally", "72.5" in pg.locator("#areaBody").inner_text())
        pg.fill("#bd_weightKg", "71"); pg.click("#bdSave"); pg.wait_for_timeout(300)
        check("two entries: neutral first→latest summary", "→" in pg.locator("#areaBody").inner_text())
        pg.locator("[data-bdel]").first.click(); pg.wait_for_timeout(250)
        check("delete one entry", len(st(pg)["body"]) == 1)
        pg.click("#bodyHide"); pg.wait_for_timeout(250)
        check("hide body tracking persists and hides numbers", st(pg)["progressPrefs"]["hideBody"] is True and "72.5" not in pg.locator("#areaBody").inner_text())
        pg.click("#bodyShow"); pg.wait_for_timeout(250)
        pg.click("#bodyWipe"); pg.wait_for_timeout(150)
        check("wipe asks first", pg.locator("#wipeYes").is_visible() and len(st(pg)["body"]) == 1)
        pg.click("#wipeNo"); pg.click("#bodyWipe"); pg.click("#wipeYes"); pg.wait_for_timeout(250)
        check("wipe deletes all body entries", st(pg)["body"] == [])
        # photos
        pg.set_input_files("#phFile", "/home/user/work/test_photo.jpg"); pg.wait_for_timeout(1200)
        check("photo saved and shown", pg.locator(".phItem img").count() == 1, pg.locator("#phErr").inner_text())
        raw = pg.evaluate("JSON.stringify(localStorage)")
        check("photo bytes never in localStorage/state", "data:image" not in raw and "ph." not in raw)
        dbs = pg.evaluate("indexedDB.databases().then(d=>d.map(x=>x.name))")
        check("photo vault is a per-account local database", any(n.startswith("fit-photos-") for n in dbs), dbs)
        w = pg.evaluate("""async () => { const xs = await window.FitPhotos.list('progress'); const b = xs[0].blob; const bm = await createImageBitmap(b); return [bm.width, bm.height, b.type, b.size] }""")
        check("photo downscaled to <=900px and re-encoded as JPEG (EXIF stripped)", max(w[0], w[1]) <= 900 and w[2] == "image/jpeg", w)
        pg.screenshot(path=S+"body_390.png", full_page=True)
        pg.locator("[data-pdel]").first.click(); pg.wait_for_timeout(500)
        check("photo delete works", pg.locator(".phItem").count() == 0)
        pg.set_input_files("#phFile", {"name": "x.txt", "mimeType": "text/plain", "buffer": b"hello"}); pg.wait_for_timeout(600)
        check("non-image rejected with friendly message", "could not be used" in pg.locator("#phErr").inner_text(), pg.locator("#phErr").inner_text())
        # review
        go(pg, "prog-review")
        check("one suggested step shown", pg.locator("#revStep").count() == 1)
        pg.fill("#rf1", "Stairs"); pg.fill("#rf3", "Walk Sunday"); pg.click("#rfSave"); pg.wait_for_timeout(250)
        r = st(pg)["reflections"]; check("reflection saved privately", len(r) == 1 and list(r.values())[0]["easier"] == "Stairs", r)
        # export
        go(pg, "prog-overview")
        with pg.expect_download() as dl: pg.click("#expJson")
        data = json.load(open(dl.value.path())); check("JSON export valid, sessions + note, no photos", data["kind"] == "progress-export" and len(data["sessions"]) == 4 and "photos stay" in data["note"].lower())
        with pg.expect_download() as dl2: pg.click("#expCsv")
        csv = open(dl2.value.path()).read(); check("CSV export header + set rows", csv.startswith("type,date,name,reps,weightKg,value") and csv.count("\nset,") == 4, csv[:120])
        # off / on
        pg.click("#progOff"); pg.wait_for_timeout(300)
        check("opt-out: overview replaced with calm off card", pg.locator("#progOn").is_visible() and st(pg)["progressPrefs"]["off"] is True)
        pg.click('#tabBar [data-tab=today]'); pg.wait_for_timeout(250)
        check("opt-out hides Today progress card", not pg.locator("#progressCard").is_visible())
        check("opt-out keeps the data", len(st(pg)["sessions"]) == 4)
        pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=progress]'); pg.wait_for_timeout(300)
        check("off state survives navigation", pg.locator("#progOn").is_visible())
        pg.click("#progOn"); pg.wait_for_timeout(300)
        check("turn back on", pg.locator("#activeWeeks").is_visible() and st(pg)["progressPrefs"]["off"] is False)
        # celebrations opt-out
        pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=settings]'); pg.wait_for_timeout(300)
        pg.click("#celebBtn"); pg.wait_for_timeout(200)
        check("celebrations off persisted", st(pg)["settings"]["noCelebrate"] is True and pg.locator("#celebBtn").get_attribute("aria-pressed") == "true")
        pg.click('#tabBar [data-tab=food]'); pg.click("#planWeekBtn"); pg.wait_for_timeout(500)
        check("no celebration popup when muted", not pg.locator("#wallyFloat").is_visible())
        poses = pg.evaluate("window.Wally.POSES")
        check("all six Wally states exist", all(p in poses for p in ["welcome", "ready", "celebrate", "rest", "gentle", "curious"]), poses)
        check("no console errors", not pg.errors, pg.errors[:3])
        pg.set_viewport_size({"width": 320, "height": 700})
        for sub in ["prog-overview", "prog-strength", "prog-body", "prog-review"]:
            go(pg, sub); check(f"no overflow @320 {sub}", pg.evaluate("document.documentElement.scrollWidth <= 321"), pg.evaluate("document.documentElement.scrollWidth"))
    # machine photo -> My gym machines
    with app_page(state=seeded()) as pg:
        pg.click('#tabBar [data-tab=train]'); pg.click('#subTabs [data-subtab=gym-machine]'); pg.wait_for_timeout(400)
        pg.set_input_files("#mcPhoto", "/home/user/work/test_photo.jpg"); pg.wait_for_timeout(500)
        pg.locator("[data-machine]").first.click(); pg.wait_for_timeout(300)
        check("machine needs user confirmation (no auto-recognition)", pg.locator("#mcConfirmYes").is_visible() and "not" in pg.locator("#mcConfirm").inner_text().lower())
        pg.click("#mcConfirmYes"); pg.wait_for_timeout(1500)
        check("photo saved to My gym machines after confirmation", pg.locator("#myMachines .phItem").count() == 1, pg.locator("#myMachines").inner_text())
        check("machine photo not in app state", "data:image" not in pg.evaluate("localStorage.getItem('fit-app-v1')"))
        pg.locator("[data-mdel]").first.click(); pg.wait_for_timeout(500)
        check("saved machine photo can be deleted", pg.locator("#myMachines .phItem").count() == 0)
    axe = open(os.path.join(os.path.dirname(__file__), "..", "node_modules/axe-core/axe.min.js")).read()
    for theme in ["brand", "black"]:
        s2 = rich(); s2["settings"]["appearance"] = theme; s2["body"] = [{"id": "b1", "date": d(2), "weightKg": 70}, {"id": "b2", "date": d(1), "weightKg": 69.5}]
        with app_page(state=s2) as pg:
            def run(label):
                pg.evaluate(axe); r = pg.evaluate("axe.run().then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+':'+v.nodes.length+':'+v.nodes[0].target))")
                check(f"axe {label} {theme}", not r, r)
            run("today")
            for sub in ["prog-overview", "prog-strength", "prog-body", "prog-review"]:
                go(pg, sub); run(sub)
fails = [r for r in results if not r[1]]
print(f"PHASE5 {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
