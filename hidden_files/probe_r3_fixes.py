import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8953/index.html"

def stub(uid, name):
    return """
window.FitAuth = {
  initDoor: function () { return true; },
  watchUser: function (cb) { setTimeout(function () { cb({ uid: "%s", email: "probe@example.com", displayName: "%s", isAnonymous: false, providerData: [{ providerId: "password" }], metadata: { creationTime: new Date().toUTCString() } }); }, 60); },
  loadCloudState: function () { return Promise.resolve(null); },
  saveCloudState: function () { return Promise.resolve({ warnings: [] }); },
  signOutUser: function () { return Promise.resolve(); },
  deleteAccount: function () { return Promise.resolve(); },
  syncPlan: function () { return Promise.resolve("free"); },
  planOf: function () { return "free"; },
  entitlement: function () { return false; },
  setAccountAge: function () {},
  resolveTier: function () { return Promise.resolve("free"); },
  entitlementDetail: function () { return { plan: "free", reason: "free", daysLeft: 0 }; },
  signUpWithEmail: function () { return Promise.reject(new Error("unused")); },
  signInWithEmail: function () { return Promise.reject(new Error("unused")); },
  resetPassword: function () { return Promise.resolve(); },
  signInWithGoogle: function () { return Promise.reject(new Error("unused")); },
  signInWithApple: function () { return Promise.reject(new Error("unused")); },
  enterDemoSession: function () { return Promise.reject(new Error("unused")); }
};
try { window.dispatchEvent(new Event("fit-auth-ready")); } catch (e) {}
""" % (uid, name)

def seed(uid, state):
    body = json.dumps(state)
    # An IIFE, never a bare arrow: add_init_script EVALUATES the
    # string, so an uncalled () => {...} seeds nothing (the R2
    # lesson, relearned in R3 when account A's legs failed).
    # Write-once: an init script re-runs on EVERY navigation,
    # so an unconditional seed would wipe the account's own
    # saved changes on reload (it ate the skip flag in run 3).
    return """(() => { try {
      if (!localStorage.getItem("fit-app-v1")) localStorage.setItem("fit-app-v1", JSON.stringify({ settings: { tourSeen: true } }));
      if (!localStorage.getItem("fit-app-v1-account-%s")) localStorage.setItem("fit-app-v1-account-%s", JSON.stringify(%s));
    } catch (e) {} })()""" % (uid, uid, body)

def J(expr):
    return "() => { return (" + expr + "); }"

async def wait_eval(pg, expr, timeout_ms=10000):
    waited = 0
    while waited <= timeout_ms:
        v = await pg.evaluate(J(expr))
        if v:
            return v
        await pg.wait_for_timeout(200)
        waited += 200
    return None

async def click(pg, sel):
    return await pg.evaluate(f"""() => {{ const el = document.querySelector({json.dumps(sel)}); if (!el) return false; el.click(); return true; }}""")

BASE_PROFILE = {"name": "Skipper", "needs": [], "preferences": [], "allergies": [], "goals": [],
                "setupDone": False, "firstSeenAt": "2026-11-02T00:00:00.000Z"}
DONE_PROFILE = dict(BASE_PROFILE, name="Settled", setupDone=True)

async def make_page(b, uid, name, state, width, store_cb=False):
    pg = await b.new_page(viewport={"width": width, "height": 844})
    body = stub(uid, name)
    if store_cb:
        body = body.replace("watchUser: function (cb) {", "watchUser: function (cb) { window.__fitCb = cb;")
    await pg.route("**/auth.js", lambda r: r.fulfill(content_type="text/javascript", body=body))
    await pg.add_init_script(seed(uid, state))
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(URL)
    return pg, errs

async def main():
    out = {"steps": []}
    def step(name, ok, extra=None):
        out["steps"].append({"step": name, "ok": bool(ok), **({"extra": extra} if extra is not None else {})})
    async with async_playwright() as pw:
        b = await pw.chromium.launch()

        # --- Setup quiet, account A: never skipped -> offered; skip -> flag; reload -> quiet; row -> road back
        state_a = {"profile": dict(BASE_PROFILE), "settings": {"tourSeen": True}}
        pg, errs_a = await make_page(b, "probe-r3-a", "Skipper", state_a, 390)
        ok = await wait_eval(pg, "!document.querySelector('#setupModal').classList.contains('hidden')")
        step("A: entry auto-offers setup when it was never skipped", ok)
        await click(pg, "#suSkip")
        await pg.wait_for_timeout(500)
        flag = await pg.evaluate(J("(() => { const s = JSON.parse(localStorage.getItem('fit-app-v1-account-probe-r3-a') || '{}'); return !!(s.profile && s.profile.setupSkipped); })()"))
        step("A: the skip writes setupSkipped onto the stored profile", flag)
        await pg.reload()
        inside = await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent ? '[' + document.querySelector('#stripHi').textContent + ']' : null")
        await pg.wait_for_timeout(2500)
        quiet = await pg.evaluate(J("document.querySelector('#setupModal').classList.contains('hidden')"))
        step("A: next entry stays quiet after the skip (no re-offer)", quiet is True, inside)
        row = await pg.evaluate(J("!!document.querySelector('#gsCard [data-gs=\"setup\"]')"))
        step("A: the checklist still carries the setup row (the road back stands)", row)
        await click(pg, '#gsCard [data-gs="setup"]')
        back = await wait_eval(pg, "!document.querySelector('#setupModal').classList.contains('hidden')")
        step("A: tapping the checklist setup row opens the sheet by hand", back)
        step("A: no page errors", not errs_a, errs_a[:2])
        await pg.close()

        # --- Setup quiet, account B: flag already set -> never offered
        state_b = {"profile": dict(BASE_PROFILE, setupSkipped=True), "settings": {"tourSeen": True}}
        pg, errs_b = await make_page(b, "probe-r3-b", "Skipper", state_b, 390)
        inside = await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent ? '[' + document.querySelector('#stripHi').textContent + ']' : null")
        await pg.wait_for_timeout(2500)
        quiet = await pg.evaluate(J("document.querySelector('#setupModal').classList.contains('hidden')"))
        step("B: an account carrying the flag is not offered setup on entry", quiet is True and inside, inside)
        step("B: no page errors", not errs_b, errs_b[:2])
        await pg.close()

        # --- Drawer, phone width: choosing a destination closes it
        state_c = {"profile": dict(DONE_PROFILE), "settings": {"tourSeen": True}}
        pg, errs_c = await make_page(b, "probe-r3-c", "Settled", state_c, 390)
        await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent ? true : null")
        await pg.evaluate(J("(() => { const x = document.querySelector('#wallyX'); if (x) x.click(); return true; })()"))
        await click(pg, "#sidebarToggle")
        open1 = await pg.evaluate(J("!document.body.classList.contains('sbHidden')"))
        step("C: drawer opens at phone width", open1)
        await click(pg, '.subBtn[data-area="meals"][data-sub="meal-plan"]')
        await pg.wait_for_timeout(400)
        closed1 = await pg.evaluate(J("document.body.classList.contains('sbHidden') && document.querySelector('#view-area').classList.contains('active')"))
        step("C: choosing an area closes the drawer and the area lands", closed1)
        await click(pg, "#sidebarToggle")
        open2 = await pg.evaluate(J("!document.body.classList.contains('sbHidden')"))
        await click(pg, '[data-view="settings"]')
        await pg.wait_for_timeout(400)
        closed2 = await pg.evaluate(J("document.body.classList.contains('sbHidden') && document.querySelector('#view-settings').classList.contains('active')"))
        step("C: choosing a top view closes the drawer too", open2 and closed2)
        step("C: no page errors", not errs_c, errs_c[:2])
        await pg.close()

        # --- Drawer, desktop control: choosing keeps it beside the content
        pg, errs_d = await make_page(b, "probe-r3-c", "Settled", state_c, 1280)
        await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent ? true : null")
        await pg.evaluate(J("(() => { const x = document.querySelector('#wallyX'); if (x) x.click(); return true; })()"))
        await click(pg, "#sidebarToggle")
        await click(pg, '.subBtn[data-area="meals"][data-sub="meal-plan"]')
        await pg.wait_for_timeout(400)
        stays = await pg.evaluate(J("!document.body.classList.contains('sbHidden') && document.querySelector('#view-area').classList.contains('active')"))
        step("D: at desktop width the drawer stays open beside the area (law unchanged)", stays)
        step("D: no page errors", not errs_d, errs_d[:2])
        await pg.close()

        # --- Landing view: sign out from Settings, sign back in, land on Today
        state_e = {"profile": dict(DONE_PROFILE), "settings": {"tourSeen": True}}
        pg, errs_e = await make_page(b, "probe-r3-e", "Settled", state_e, 390, store_cb=True)
        await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent ? true : null")
        await click(pg, '[data-view="settings"]')
        await pg.wait_for_timeout(400)
        on_settings = await pg.evaluate(J("document.querySelector('#view-settings').classList.contains('active')"))
        step("E: the account stands on Settings before the cycle", on_settings)
        await pg.evaluate(J("window.__fitCb(null)"))
        await pg.wait_for_timeout(600)
        await pg.evaluate(J("""window.__fitCb({ uid: "probe-r3-e", email: "probe@example.com", displayName: "Settled", isAnonymous: false, providerData: [{ providerId: "password" }], metadata: { creationTime: new Date().toUTCString() } })"""))
        landed = await wait_eval(pg, "document.querySelector('#view-today').classList.contains('active') && !document.querySelector('#view-settings').classList.contains('active')")
        step("E: re-entry lands on Today, not back on Settings", landed)
        step("E: no page errors", not errs_e, errs_e[:2])
        await pg.close()

        await b.close()
    failed = [s for s in out["steps"] if not s["ok"]]
    out["summary"] = {"total": len(out["steps"]), "failed": len(failed)}
    print(json.dumps(out, indent=1))
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
