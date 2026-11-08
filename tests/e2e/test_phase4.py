"""Phase 4 E2E: reminders (mock native plugin), reconcile/no duplicates/no orphans, permission fallbacks, import safety, a11y."""
import json, sys, os, time, datetime
from harness import *
from fixtures import *
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail) if (detail and not cond) else ""))
def st(pg): return pg.evaluate("JSON.parse(localStorage.getItem('fit-app-v1'))")
S = "/home/user/work/shots_phase4/"
tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
def seed(on=False):
    s = seeded(); s["settings"]["notifications"] = on
    s["todos"] = [{"id": "t1", "title": "Dentist", "date": tomorrow, "time": "09:00", "status": "open", "color": "#52695A", "durationMin": 30},
                  {"id": "t2", "title": "Call mum", "date": tomorrow, "time": "11:00", "status": "open", "color": "#52695A", "durationMin": 15}]
    s["routines"] = []; return s
MOCK = """(perm) => { window.__calls = []; window.__live = {};
  window.Capacitor = { Plugins: { LocalNotifications: {
    checkPermissions: async () => ({display: perm}), requestPermissions: async () => ({display: perm}),
    schedule: async (a) => { a.notifications.forEach(n => { if (window.__live[n.id]) window.__dupes = (window.__dupes||0)+1; window.__live[n.id] = n; }); window.__calls.push(['schedule', a.notifications.map(n=>n.id)]); },
    cancel: async (a) => { a.notifications.forEach(n => delete window.__live[n.id]); window.__calls.push(['cancel', a.notifications.map(n=>n.id)]); } } } }; }"""
def goto_rem(pg):
    pg.click('#tabBar [data-tab=calendar]'); pg.click('#subTabs [data-subtab=cal-reminders]'); pg.wait_for_timeout(500)
def goto_todos(pg):
    pg.click('#tabBar [data-tab=calendar]'); pg.click('#subTabs [data-subtab=cal-todos]'); pg.wait_for_timeout(400)
with server():
    # ---- web: no native plugin
    with app_page(state=seed()) as pg:
        goto_todos(pg)
        check("remind select on timed tasks", pg.locator("[data-remind]").count() == 2)
        pg.select_option('[data-remind=t1]', "30"); pg.wait_for_timeout(300)
        check("remindMin saved", [t for t in st(pg)["todos"] if t["id"] == "t1"][0]["remindMin"] == 30)
        check("web explains in-app only", "inside the app" in pg.locator("#toast").inner_text(), pg.locator("#toast").inner_text())
        goto_rem(pg)
        check("web status = unavailable with honest text", pg.locator("#remStatus").get_attribute("data-status") == "unavailable" and "iPhone or Android" in pg.locator("#remStatus").inner_text())
        check("no fake toggle on web", not pg.locator("#remToggle").is_visible())
        check("upcoming lists the reminder with lead time", "Dentist" in pg.locator("#remList").inner_text() and "30 min before" in pg.locator("#remList").inner_text(), pg.locator("#remList").inner_text())
        pg.screenshot(path=S+"reminders_web_390.png", full_page=True)
        check("no console errors (web)", not pg.errors, pg.errors[:3])
    # ---- native mock: granted
    with app_page(state=seed(on=True)) as pg:
        pg.evaluate(MOCK, "granted")
        goto_todos(pg)
        pg.select_option('[data-remind=t1]', "10"); pg.wait_for_timeout(1200)
        live = pg.evaluate("Object.keys(window.__live).length")
        check("one reminder scheduled after opt-in", live == 1, live)
        pg.select_option('[data-remind=t2]', "0"); pg.wait_for_timeout(1200)
        check("second reminder added without touching the first", pg.evaluate("Object.keys(window.__live).length") == 2)
        calls_before = pg.evaluate("window.__calls.length")
        pg.evaluate("document.querySelector('[data-remind=t1]').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(1200)
        check("re-saving identical data makes no native calls (idempotent)", pg.evaluate("window.__calls.length") == calls_before, pg.evaluate("window.__calls"))
        pg.select_option('[data-remind=t1]', "60"); pg.wait_for_timeout(1200)
        live = pg.evaluate("Object.values(window.__live)")
        t1at = [n for n in live if n["title"] == "Dentist"]
        check("edit moves the reminder (no duplicate)", len(live) == 2 and len(t1at) == 1, [n["title"] for n in live])
        hm = pg.evaluate("(() => { const n = Object.values(window.__live).find(x => x.title === 'Dentist'); const d = new Date(n.schedule.at); return d.getHours() + ':' + d.getMinutes() + ' ' + d.getDate(); })()")
        check("1h before 09:00 lands at 8:00 local tomorrow", hm == "8:0 " + str(int(tomorrow[-2:])), hm)
        check("body present", all(n.get("body") for n in live))
        pg.locator('[data-todo=t2]').click(); pg.wait_for_timeout(1200)
        titles = [n["title"] for n in pg.evaluate("Object.values(window.__live)")]
        check("completing a task cancels its reminder", titles == ["Dentist"], titles)
        pg.locator('[data-del=t1]').click(); pg.wait_for_timeout(1200)
        check("deleting a task leaves no orphan", pg.evaluate("Object.keys(window.__live).length") == 0)
        check("never scheduled the same id twice while live", pg.evaluate("window.__dupes || 0") == 0)
        map_ = pg.evaluate("localStorage.getItem('fit-remind-map')"); check("device map matches live set", map_ == "{}", map_)
        goto_rem(pg)
        check("status on", pg.locator("#remStatus").get_attribute("data-status") == "on")
        pg.screenshot(path=S+"reminders_on_390.png", full_page=True)
        pg.click("#remToggle"); pg.wait_for_timeout(800)
        check("turning off persists", st(pg)["settings"]["notifications"] is False)
        check("status off after toggle", pg.locator("#remStatus").get_attribute("data-status") == "off")
    # ---- native mock: legacy ids are cleaned once
    with app_page(state=seed(on=True)) as pg:
        pg.evaluate("() => localStorage.setItem('fit-remind-ids', JSON.stringify([1234, 5678]))")
        pg.evaluate(MOCK, "granted")
        goto_todos(pg); pg.select_option('[data-remind=t1]', "0"); pg.wait_for_timeout(1200)
        cancelled = pg.evaluate("window.__calls.filter(c=>c[0]==='cancel').flatMap(c=>c[1])")
        check("legacy reminder ids cancelled once", 1234 in cancelled and 5678 in cancelled and pg.evaluate("localStorage.getItem('fit-remind-ids')") is None, cancelled)
    # ---- native mock: denied
    with app_page(state=seed(on=True)) as pg:
        pg.evaluate(MOCK, "denied")
        goto_rem(pg)
        check("denied: honest message + in-app fallback", pg.locator("#remStatus").get_attribute("data-status") == "denied" and "still show on Today" in pg.locator("#remStatus").inner_text(), pg.locator("#remStatus").inner_text())
        pg.screenshot(path=S+"reminders_denied_390.png", full_page=True)
    with app_page(state=seed(on=False)) as pg:
        pg.evaluate(MOCK, "denied"); goto_rem(pg)
        pg.evaluate("document.getElementById('remToggle') && 0")
        check("off+denied reports blocked, offers no toggle", pg.locator("#remStatus").get_attribute("data-status") == "denied" and not pg.locator("#remToggle").is_visible())
    # ---- import safety
    ics = lambda evs: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//t//EN\r\n" + "".join(evs) + "END:VCALENDAR\r\n"
    def ve(uid, title, d): return f"BEGIN:VEVENT\r\nUID:{uid}\r\nDTSTAMP:20261101T000000Z\r\nDTSTART:{d}T090000\r\nDTEND:{d}T100000\r\nSUMMARY:{title}\r\nEND:VEVENT\r\n"
    nxt = (datetime.date.today() + datetime.timedelta(days=3)).strftime("%Y%m%d"); nxt2 = (datetime.date.today() + datetime.timedelta(days=4)).strftime("%Y%m%d")
    open("/home/user/work/t1.ics", "w").write(ics([ve("a1", "Imported A", nxt)]))
    open("/home/user/work/t2.ics", "w").write(ics([ve("a1", "Imported A", nxt), ve("b2", "Imported <b>B</b>", nxt2)]))
    open("/home/user/work/bad.ics", "w").write("this is not a calendar")
    with app_page(state=seed()) as pg:
        pg.click('#tabBar [data-tab=calendar]'); pg.wait_for_timeout(300)
        pg.click("#calImportBtn"); pg.wait_for_timeout(400)
        check("import dialog has role=dialog", pg.locator('#importCard[role=dialog]').is_visible())
        pg.set_input_files("#importFile", "/home/user/work/bad.ics"); pg.wait_for_timeout(500)
        check("bad file gets a friendly error and adds nothing", "calendar" in pg.locator("#importResult").inner_text().lower() and len(st(pg)["todos"]) == 2, pg.locator("#importResult").inner_text())
        pg.set_input_files("#importFile", "/home/user/work/t1.ics"); pg.wait_for_timeout(600)
        n1 = len(st(pg)["todos"]); check("first import adds one", n1 == 3, n1)
        pg.set_input_files("#importFile", "/home/user/work/t1.ics"); pg.wait_for_timeout(600)
        check("same file again adds nothing", len(st(pg)["todos"]) == 3, len(st(pg)["todos"]))
        pg.set_input_files("#importFile", "/home/user/work/t2.ics"); pg.wait_for_timeout(600)
        check("file with one new event adds only that one", len(st(pg)["todos"]) == 4, len(st(pg)["todos"]))
        imp = [t for t in st(pg)["todos"] if t.get("source") == "import"]
        check("imported tasks have no reminder by default", all(t.get("remindMin") is None for t in imp))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        check("Escape closes import dialog", not pg.locator("#importSheet").is_visible())
        pg.click("#calImportBtn"); pg.fill("#importUrl", "http://insecure.example/cal.ics"); pg.click("#importGo"); pg.wait_for_timeout(300)
        check("non-https link refused", "https" in pg.locator("#importResult").inner_text(), pg.locator("#importResult").inner_text())
        pg.keyboard.press("Escape")
        pg.click('#subTabs [data-subtab=cal-todos]'); pg.wait_for_timeout(400)
        check("imported title shown as text, not HTML", pg.locator("#areaBody b", has_text="B").count() == 0)
        # 320 overflow
        pg.set_viewport_size({"width": 320, "height": 700})
        for sub in ["cal-month", "cal-todos", "cal-reminders"]:
            pg.click('#tabBar [data-tab=calendar]'); pg.click(f'#subTabs [data-subtab={sub}]'); pg.wait_for_timeout(350)
            check(f"no overflow @320 {sub}", pg.evaluate("document.documentElement.scrollWidth <= 321"), pg.evaluate("document.documentElement.scrollWidth"))
        check("no console errors (import)", not pg.errors, pg.errors[:3])
    axe = open(os.path.join(os.path.dirname(__file__), "..", "node_modules/axe-core/axe.min.js")).read()
    for theme in ["brand", "black"]:
        s2 = seed(on=True); s2["settings"]["appearance"] = theme
        with app_page(state=s2) as pg:
            pg.evaluate(MOCK, "granted")
            def run(label):
                pg.evaluate(axe); r = pg.evaluate("axe.run().then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+':'+v.nodes.length+':'+v.nodes[0].target))")
                check(f"axe {label} {theme}", not r, r)
            goto_todos(pg); pg.select_option('[data-remind=t1]', "10"); pg.wait_for_timeout(300); run("todos")
            goto_rem(pg); run("reminders")
            pg.click('#subTabs [data-subtab=cal-month]'); pg.wait_for_timeout(300); pg.click("#calImportBtn"); pg.wait_for_timeout(400); run("import dialog")
fails = [r for r in results if not r[1]]
print(f"PHASE4 {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
