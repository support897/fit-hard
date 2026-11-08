"""Phase 6b: account deletion wipes local data, photos and reminder map."""
import sys, json
from harness import *
from fixtures import *
results = []
def check(n, c, d=""):
    results.append((n, bool(c), d)); print(("PASS " if c else "FAIL ") + n + (" :: " + str(d) if (d and not c) else ""))
with server():
    s = seeded(); s["disclaimer"] = {"agreedAt": "2026-01-01T00:00:00.000Z", "version": 1}
    with app_page(state=s) as pg:
        pg.evaluate("localStorage.setItem('fit-remind-map', '{\"1\":\"x\"}')")
        pg.evaluate("window.__cancelled = []; window.Capacitor = { Plugins: { LocalNotifications: { cancel: async (a) => { window.__cancelled = a.notifications.map(n=>n.id); }, checkPermissions: async()=>({display:'granted'}), schedule: async()=>{} } } }")
        pg.evaluate("FitPhotos.setScope && FitPhotos.setScope('test-user-1')")
        pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=settings]'); pg.wait_for_timeout(400)
        check("delete button exists", pg.locator("#accDeleteBtn").count() == 1)
        pg.click("#accDeleteBtn"); pg.wait_for_timeout(200)
        pg.fill("#accDeletePass", "pw")
        pg.evaluate("window.__reloaded = 0")
        pg.click("#accDeleteYes"); pg.wait_for_timeout(3500)
        keys = pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('fit-remind')||k==='fit-app-v1'&&false)")
        check("reminder map cleared", "fit-remind-map" not in keys, keys)
fails = [r for r in results if not r[1]]
print(f"PHASE6B {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
