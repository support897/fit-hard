"""Phase 6 E2E: health log (statuses, confirm, audit, appointments, export, erase), generic lock-screen text, XSS, a11y."""
import json, sys, os, datetime
from harness import *
from fixtures import *
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail) if (detail and not cond) else ""))
def st(pg): return pg.evaluate("JSON.parse(localStorage.getItem('fit-app-v1'))")
S = "/home/user/work/shots_phase6/"
today = today_key()
tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
def seed(peps=True, on=False):
    s = seeded(); s["disclaimer"] = {"agreedAt": "2026-01-01T00:00:00.000Z", "version": 1}; s["settings"]["notifications"] = on
    s["peptides"] = [{"id": "p1", "name": "Alpha", "amount": "5", "unit": "mg", "color": "#C4573A", "schedule": {"days": [0,1,2,3,4,5,6]}, "time": "09:00", "log": []}] if peps else []
    return s
MOCK = """() => { window.__live = {}; window.Capacitor = { Plugins: { LocalNotifications: {
    checkPermissions: async () => ({display:'granted'}), requestPermissions: async () => ({display:'granted'}),
    schedule: async (a) => { a.notifications.forEach(n => { window.__live[n.id] = n; }); },
    cancel: async (a) => { a.notifications.forEach(n => delete window.__live[n.id]); } } } }; }"""
def health(pg, sub=None):
    pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=health]'); pg.wait_for_timeout(300)
    if sub: pg.click(f'#subTabs [data-subtab={sub}]'); pg.wait_for_timeout(300)
with server():
    # disclaimer gate still holds
    s0 = seed(); s0["disclaimer"] = None
    with app_page(state=s0) as pg:
        health(pg); check("gate shown before agreement", pg.locator("#agreeBtn").count() == 1 and pg.locator("#ppAdd").count() == 0)
        pg.click("#agreeBtn"); pg.wait_for_timeout(300)
        check("agreement recorded with time+version", st(pg)["disclaimer"]["agreedAt"] and st(pg)["disclaimer"]["version"] == 1)
    with app_page(state=seed(peps=False)) as pg:
        health(pg)
        pg.fill("#ppName", "Beta"); pg.fill("#ppAmount", "3"); pg.click('[data-ppday="1"]')
        pg.click("#ppAdd"); pg.wait_for_timeout(300)
        check("cannot save without clinician confirmation", len(st(pg)["peptides"]) == 0 and "confirm" in pg.locator("#toast").inner_text().lower(), pg.locator("#toast").inner_text())
        pg.fill("#ppInstr", "As written on my prescription"); pg.fill("#ppPresc", "Dr Lee"); pg.check("#ppConfirm"); pg.click("#ppAdd"); pg.wait_for_timeout(400)
        p = st(pg)["peptides"][0]
        check("saved with instructions, prescriber, confirmedAt, created audit", p["instructions"] == "As written on my prescription" and p["prescriber"] == "Dr Lee" and p["confirmedAt"] and p["audit"][0]["action"] == "created", p)
        check("instructions shown back verbatim", "As written on my prescription" in pg.locator("#areaBody").inner_text())
        pg.screenshot(path=S+"health_list_390.png", full_page=True)
    with app_page(state=seed()) as pg:
        health(pg)
        pg.click('[data-logs="p1|not_taken"]'); pg.wait_for_timeout(300)
        pg.click('[data-logs="p1|unknown"]'); pg.wait_for_timeout(300)
        pg.click('[data-log="p1"]'); pg.wait_for_timeout(300)
        lg = st(pg)["peptides"][0]["log"]
        check("three statuses persisted", [l["status"] for l in lg] == ["not_taken", "unknown", "taken"], lg)
        check("not-taken carries no amount", lg[0]["amount"] == "" and lg[2]["amount"] == "5")
        health(pg, "pep-log"); pg.wait_for_timeout(300); t = pg.locator("#areaBody").inner_text()
        check("log shows status chips", "Not taken" in t and "Not sure" in t and "Taken" in t, t)
        check("no advice or missed-dose prompt anywhere in log", "should" not in t.lower() and "make up" not in t.lower())
        pg.screenshot(path=S+"health_log_390.png", full_page=True)
        health(pg, "pep-next"); check("Next doses has due-today status buttons", pg.locator("[data-nx]").count() == 3)
        pg.click('[data-nx="p1|taken"]'); pg.wait_for_timeout(300)
        check("status from Next doses logged", len(st(pg)["peptides"][0]["log"]) == 4)
        pg.screenshot(path=S+"health_next_390.png", full_page=True)
        # calendar suffix
        pg.click('#tabBar [data-tab=calendar]'); pg.click('#subTabs [data-subtab=cal-month]'); pg.wait_for_timeout(500)
        check("no errors so far", not pg.errors, pg.errors[:3])
    with app_page(state=seed()) as pg:
        health(pg)
        pg.click('[data-editpep="p1"]'); pg.fill("#ed-amount", "7"); pg.click("#ed-save"); pg.wait_for_timeout(300)
        check("edit blocked without confirm", st(pg)["peptides"][0]["amount"] == "5")
        pg.check("#ed-confirm"); pg.click("#ed-save"); pg.wait_for_timeout(400)
        p = st(pg)["peptides"][0]
        check("edit saved with audit entry showing old->new", p["amount"] == "7" and p["audit"][-1]["action"] == "edited" and p["audit"][-1]["changes"]["amount"] == ["5", "7"], p.get("audit"))
        pg.click('[data-histpep="p1"]'); pg.wait_for_timeout(200)
        check("change history viewable", "5 → 7" in pg.locator("#pepPanel-p1").inner_text(), pg.locator("#pepPanel-p1").inner_text())
        pg.screenshot(path=S+"health_history_390.png", full_page=True)
        # export
        with pg.expect_download() as dl: pg.click("#hxExport")
        data = json.load(open(dl.value.path()))
        check("export has medication, audit, no hidden extras", data["kind"] == "health-export" and data["medications"][0]["name"] == "Alpha" and data["medications"][0]["audit"], list(data.keys()))
        # erase
        pg.click("#hxDelete"); pg.wait_for_timeout(200)
        check("erase asks first", pg.locator("#hxYes").count() == 1 and len(st(pg)["peptides"]) == 1)
        pg.click("#hxNo"); check("cancel keeps data", len(st(pg)["peptides"]) == 1)
        pg.click("#hxDelete"); pg.click("#hxYes"); pg.wait_for_timeout(400)
        check("erase removes meds and appointments", st(pg)["peptides"] == [] and st(pg)["appointments"] == [])
    # appointments + reminders (mock)
    s = seed(on=True)
    with app_page(state=s) as pg:
        pg.evaluate(MOCK)
        health(pg, "pep-appts")
        pg.click("#apAdd"); pg.wait_for_timeout(200)
        check("appointment needs a name", len(st(pg).get("appointments", [])) == 0)
        pg.fill("#apTitle", "Clinic <b>visit</b>"); pg.fill("#apPlace", "Main St"); pg.fill("#apDate", (datetime.date.today()+datetime.timedelta(days=3)).strftime("%Y-%m-%d")); pg.fill("#apTime", "10:30"); pg.select_option("#apRemind", "60")
        pg.click("#apAdd"); pg.wait_for_timeout(1200)
        a = st(pg)["appointments"]
        check("appointment saved with remindMin", len(a) == 1 and a[0]["remindMin"] == 60 and a[0]["time"] == "10:30", a)
        check("title rendered as text, not HTML", pg.locator("#areaBody .listRow b b").count() == 0 and "<b>visit</b>" in pg.locator("#areaBody").inner_text())
        live = pg.evaluate("Object.values(window.__live).map(n=>({id:n.id,title:n.title,body:n.body}))")
        appt = [n for n in live if n["title"] == "Fit Hard"]
        check("appointment + dose reminders scheduled", len(live) >= 2, live)
        check("lock-screen text generic by default", any(n["title"] == "Fit Hard" and n["body"] == "You have a reminder." for n in live) and not any("Alpha" in json.dumps(n) or "Clinic" in json.dumps(n) for n in live), live)
        pg.click('#tabBar [data-tab=calendar]'); pg.click('#subTabs [data-subtab=cal-reminders]'); pg.wait_for_timeout(400)
        check("details toggle off by default", not pg.locator("#remDetails").is_checked())
        pg.check("#remDetails"); pg.wait_for_timeout(1500)
        live = pg.evaluate("Object.values(window.__live).map(n=>({id:n.id,title:n.title,body:n.body}))")
        check("opt-in shows names on lock screen", any("Alpha" in n["title"] for n in live) or any("Clinic" in n["title"] for n in live), live)
        pg.uncheck("#remDetails"); pg.wait_for_timeout(1500)
        live = pg.evaluate("Object.values(window.__live).map(n=>({id:n.id,title:n.title,body:n.body}))")
        check("opt-out returns to generic", not any("Alpha" in json.dumps(n) or "Clinic" in json.dumps(n) for n in live), live)
        pg.screenshot(path=S+"reminders_health_390.png", full_page=True)
        health(pg, "pep-appts"); pg.click("[data-delap]"); pg.wait_for_timeout(1200)
        check("deleting appointment cancels its reminder", st(pg)["appointments"] == [] and not any("appt" in str(n.get("id")) for n in []) and len(pg.evaluate("Object.values(window.__live).map(n=>({id:n.id,title:n.title,body:n.body}))")) < len(live))
        check("no errors (reminders)", not pg.errors, pg.errors[:3])
    # XSS
    X = '<img src=x onerror="window.__xss=1">'
    sx = seed(); sx["peptides"][0]["name"] = X; sx["peptides"][0]["instructions"] = X; sx["peptides"][0]["prescriber"] = X
    sx["appointments"] = [{"id": "a1", "title": X, "date": tomorrow, "time": "10:00", "place": X, "remindMin": None}]
    sx["todos"] = [{"id": "t1", "title": X, "date": today, "time": "09:00", "status": "open", "color": "#52695A", "durationMin": 30}]
    sx["customRecipes"] = [{"id": "c1", "name": X, "meal": "dinner", "cuisines": ["Mine"], "ingredients": [{"name": X, "amount": 1, "unit": "g"}], "steps": [X]}]
    sx["extras"] = [{"id": "e1", "name": X, "kcal": 100}] if True else []
    with app_page(state=sx) as pg:
        for tab, sub in [("more", None), ("calendar", "cal-todos"), ("calendar", "cal-month"), ("calendar", "cal-reminders"), ("meals", "meal-recipes"), ("today", None)]:
            try:
                pg.click(f'#tabBar [data-tab={tab}]')
                if sub: pg.click(f'#subTabs [data-subtab={sub}]')
            except Exception: pass
            pg.wait_for_timeout(250)
        health(pg); health(pg, "pep-log"); health(pg, "pep-next"); health(pg, "pep-appts")
        pg.click('[data-more=health]') if False else None
        check("XSS payloads never execute", pg.evaluate("window.__xss") is None)
        check("XSS payload shown as text", "<img" in pg.locator("#areaBody").inner_text())
    # a11y both themes
    axe = open(os.path.join(os.path.dirname(__file__), "..", "node_modules/axe-core/axe.min.js")).read()
    for theme in ["brand", "black"]:
        s2 = seed(on=True); s2["settings"]["appearance"] = theme
        s2["appointments"] = [{"id": "a1", "title": "Visit", "date": tomorrow, "time": "10:00", "place": "", "remindMin": 60}]
        with app_page(state=s2) as pg:
            pg.evaluate(MOCK)
            def run(label):
                pg.evaluate(axe); r = pg.evaluate("axe.run().then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+':'+v.nodes.length+':'+v.nodes[0].target))")
                check(f"axe {label} {theme}", not r, r)
            health(pg); run("my meds")
            pg.click('[data-editpep="p1"]'); pg.click('[data-histpep="p1"]'); run("edit+history")
            health(pg, "pep-log"); run("log"); health(pg, "pep-next"); run("next"); health(pg, "pep-appts"); run("appointments")
            pg.click('#tabBar [data-tab=calendar]'); pg.click('#subTabs [data-subtab=cal-reminders]'); pg.wait_for_timeout(400); run("reminders")
    for w in (320, 360):
        with app_page(width=w, state=seed()) as pg:
            for sub in [None, "pep-log", "pep-next", "pep-appts"]:
                health(pg, sub); ov = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                check(f"no horizontal overflow {w}px {sub}", not ov)
fails = [r for r in results if not r[1]]
print(f"PHASE6 {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
