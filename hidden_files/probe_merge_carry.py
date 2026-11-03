import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8953/index.html"

# The sign-in merge, driven end to end: the stub's cloud
# record carries a profile WITHOUT the skip answer (the
# answer's mirror had not landed when the cycle ran — QA's
# candidate-check edge on build 21). The local record
# carries the answer. After the merge the answer must
# stand, and the sheet must stay quiet. The control page
# carries no answer anywhere: the sheet must offer.
CLOUD = {"profile": {"name": "Carrier", "needs": [], "preferences": [], "allergies": [], "goals": [],
                     "setupDone": False, "firstSeenAt": "2026-11-02T00:00:00.000Z"},
         "settings": {"tourSeen": True}}

def stub(uid, cloud):
    return """
window.FitAuth = {
  initDoor: function () { return true; },
  watchUser: function (cb) { setTimeout(function () { cb({ uid: "%s", email: "probe@example.com", displayName: "", isAnonymous: false, providerData: [{ providerId: "password" }], metadata: { creationTime: new Date().toUTCString() } }); }, 60); },
  loadCloudState: function () { return Promise.resolve(JSON.parse(JSON.stringify(%s))); },
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
""" % (uid, json.dumps(cloud))

def seed(uid, state):
    return """(() => { try {
      if (!localStorage.getItem("fit-app-v1-account-%s")) localStorage.setItem("fit-app-v1-account-%s", JSON.stringify(%s));
    } catch (e) {} })()""" % (uid, uid, json.dumps(state))

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

async def main():
    out = {"steps": []}
    def step(name, ok, extra=None):
        out["steps"].append({"step": name, "ok": bool(ok), **({"extra": extra} if extra is not None else {})})
    async with async_playwright() as pw:
        b = await pw.chromium.launch()

        # --- The carry: local answer, cloud without it
        uid = "probe-mc-1"
        local = {"profile": {"name": "Carrier", "needs": [], "preferences": [], "allergies": [], "goals": [],
                             "setupDone": False, "setupSkipped": True, "firstSeenAt": "2026-11-02T00:00:00.000Z"},
                 "settings": {"tourSeen": True}}
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.route("**/auth.js", lambda r: r.fulfill(content_type="text/javascript", body=stub(uid, CLOUD)))
        await pg.add_init_script(seed(uid, local))
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL)
        inside = await wait_eval(pg, "(document.querySelector('#stripHi')||{}).textContent ? '[' + document.querySelector('#stripHi').textContent + ']' : null")
        await pg.wait_for_timeout(1500)
        stored = await pg.evaluate(J("(() => { const s = JSON.parse(localStorage.getItem('fit-app-v1-account-probe-mc-1') || '{}'); return (s.profile && s.profile.setupSkipped === true) ? 'flag-kept' : 'flag-lost'; })()"))
        step("carry: the merged stored profile keeps the skip answer", stored == "flag-kept", stored)
        quiet = await pg.evaluate(J("document.querySelector('#setupModal').classList.contains('hidden')"))
        step("carry: the sheet stays quiet after the merge (no re-offer)", quiet is True and inside, inside)
        step("carry: no page errors", not errs, errs[:2])
        await pg.close()

        # --- The control: no answer anywhere, the offer must stand
        uid = "probe-mc-2"
        local2 = {"profile": {"name": "Carrier", "needs": [], "preferences": [], "allergies": [], "goals": [],
                              "setupDone": False, "firstSeenAt": "2026-11-02T00:00:00.000Z"},
                  "settings": {"tourSeen": True}}
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.route("**/auth.js", lambda r: r.fulfill(content_type="text/javascript", body=stub(uid, CLOUD)))
        await pg.add_init_script(seed(uid, local2))
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL)
        offered = await wait_eval(pg, "!document.querySelector('#setupModal').classList.contains('hidden')")
        step("control: with no answer anywhere, the sheet still offers", offered)
        step("control: no page errors", not errs, errs[:2])
        await pg.close()

        await b.close()
    failed = [s for s in out["steps"] if not s["ok"]]
    out["summary"] = {"total": len(out["steps"]), "failed": len(failed)}
    print(json.dumps(out, indent=1))
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
