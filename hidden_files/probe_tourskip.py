import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8953/index.html"

# The email-door shape: a brand-new account, no provider name
# (displayName ""), no stored state anywhere. loadCloudState
# resolves null, exactly as a first-ever sign-in does.
def stub(uid):
    return """
window.FitAuth = {
  initDoor: function () { return true; },
  watchUser: function (cb) { setTimeout(function () { cb({ uid: "%s", email: "probe@example.com", displayName: "", isAnonymous: false, providerData: [{ providerId: "password" }], metadata: { creationTime: new Date().toUTCString() } }); }, 60); },
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
""" % uid

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

CENSUS = """(() => {
  const keys = Object.keys(localStorage).filter(k => k.indexOf('fit-app-v1-account-') === 0);
  let prof = 'NO-ACCOUNT-KEY';
  if (keys.length) { try { const s = JSON.parse(localStorage.getItem(keys[0]) || '{}'); prof = s.profile ? ('profile name=' + JSON.stringify(s.profile.name) + ' setupDone=' + !!s.profile.setupDone + ' needs=' + Array.isArray(s.profile.needs)) : 'profile NULL'; } catch (e) { prof = 'PARSE-ERR ' + e; } }
  const rows = Array.from(document.querySelectorAll('#gsCard [data-gs]')).map(b => b.getAttribute('data-gs')).join(',');
  return JSON.stringify({
    stored: prof,
    setupOffered: !document.querySelector('#setupModal').classList.contains('hidden'),
    tourVisible: !document.querySelector('#tourRoot').classList.contains('hidden'),
    gsRows: rows
  });
})()"""

async def make_page(b, uid, width=390):
    pg = await b.new_page(viewport={"width": width, "height": 844})
    await pg.route("**/auth.js", lambda r: r.fulfill(content_type="text/javascript", body=stub(uid)))
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(URL)
    return pg, errs

async def census(pg):
    raw = await pg.evaluate(J(CENSUS))
    return json.loads(raw)

async def main():
    out = {"steps": []}
    def step(name, ok, extra=None):
        out["steps"].append({"step": name, "ok": bool(ok), **({"extra": extra} if extra is not None else {})})
    async with async_playwright() as pw:
        b = await pw.chromium.launch()

        # --- S1: Skip at step 1
        pg, errs = await make_page(b, "probe-ts-1")
        t = await wait_eval(pg, "!document.querySelector('#tourRoot').classList.contains('hidden') && !!document.querySelector('#tourName')")
        step("S1: fresh account meets the tour with the name field", t)
        await click(pg, "#tourSkip")
        await pg.wait_for_timeout(700)
        c = await census(pg)
        step("S1: after Skip, a profile stands in the stored state", c["stored"].startswith("profile"), c)
        step("S1: after Skip, the setup sheet offers itself", c["setupOffered"], c)
        step("S1: the checklist carries the setup row", "setup" in c["gsRows"].split(","), c)
        if not c["setupOffered"]:
            await click(pg, '#gsCard [data-gs="setup"]')
            await pg.wait_for_timeout(500)
            c2 = await census(pg)
            step("S1: tapping the checklist setup row opens the sheet", c2["setupOffered"], c2)
        # Cross-entry: the skip's birth must survive a reload,
        # and the setup road must stand on the next entry too
        # (the trap QA filed was read across entries).
        await click(pg, "#suSkip")
        await pg.wait_for_timeout(400)
        await pg.reload()
        await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent !== null && document.querySelector('#gsCard') ? true : null")
        await pg.wait_for_timeout(1200)
        c3 = await census(pg)
        step("S1: after reload, the skipped tour's profile still stands", c3["stored"].startswith("profile"), c3)
        step("S1: after reload, the checklist still carries the setup row", "setup" in c3["gsRows"].split(","), c3)
        if not c3["setupOffered"]:
            await click(pg, '#gsCard [data-gs="setup"]')
            await pg.wait_for_timeout(500)
            c4 = await census(pg)
            step("S1: after reload, tapping the setup row opens the sheet", c4["setupOffered"], c4)
        step("S1: no page errors", not errs, errs[:2])
        await pg.close()

        # --- S2: X at step 1
        pg, errs = await make_page(b, "probe-ts-2")
        t = await wait_eval(pg, "!document.querySelector('#tourRoot').classList.contains('hidden') && !!document.querySelector('#tourName')")
        step("S2: fresh account meets the tour with the name field", t)
        await click(pg, "#tourX")
        await pg.wait_for_timeout(700)
        c = await census(pg)
        step("S2: after X, a profile stands in the stored state", c["stored"].startswith("profile"), c)
        step("S2: after X, the setup sheet offers itself", c["setupOffered"], c)
        step("S2: no page errors", not errs, errs[:2])
        await pg.close()

        # --- S3: blank Next to step 2, then Skip
        pg, errs = await make_page(b, "probe-ts-3")
        t = await wait_eval(pg, "!document.querySelector('#tourRoot').classList.contains('hidden') && !!document.querySelector('#tourName')")
        step("S3: fresh account meets the tour with the name field", t)
        await click(pg, "#tourNext")
        await pg.wait_for_timeout(500)
        s2 = await pg.evaluate(J("!!document.querySelector('#tourSkip') && document.querySelectorAll('.tourDots')[0].textContent.indexOf('●') !== -1"))
        step("S3: blank Next reaches step 2", s2)
        await click(pg, "#tourSkip")
        await pg.wait_for_timeout(700)
        c = await census(pg)
        step("S3: after step-2 Skip, a profile stands in the stored state", c["stored"].startswith("profile"), c)
        step("S3: after step-2 Skip, the setup sheet offers itself", c["setupOffered"], c)
        step("S3: no page errors", not errs, errs[:2])
        await pg.close()

        # --- S4: control — the tour completed with a typed name
        pg, errs = await make_page(b, "probe-ts-4")
        t = await wait_eval(pg, "!document.querySelector('#tourRoot').classList.contains('hidden') && !!document.querySelector('#tourName')")
        step("S4: fresh account meets the tour with the name field", t)
        await pg.fill("#tourName", "Completer")
        await click(pg, "#tourNext")
        await pg.wait_for_timeout(400)
        await click(pg, "#tourNext")
        await pg.wait_for_timeout(400)
        await click(pg, "#tourDone")
        await pg.wait_for_timeout(700)
        c = await census(pg)
        step("S4: completed tour stores the named profile", c["stored"].startswith("profile") and "Completer" in c["stored"], c)
        step("S4: completed tour offers the setup sheet", c["setupOffered"], c)
        step("S4: no page errors", not errs, errs[:2])
        await pg.close()

        await b.close()
    failed = [s for s in out["steps"] if not s["ok"]]
    out["summary"] = {"total": len(out["steps"]), "failed": len(failed)}
    print(json.dumps(out, indent=1))
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
