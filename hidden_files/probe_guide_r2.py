import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8953/index.html"
UID = "probe-guide-1"

STUB = """
window.FitAuth = {
  initDoor: function () { return true; },
  watchUser: function (cb) { setTimeout(function () { cb({ uid: "probe-guide-1", email: "probe@example.com", displayName: "Probe", isAnonymous: false, providerData: [{ providerId: "password" }], metadata: { creationTime: new Date().toUTCString() } }); }, 60); },
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
"""

SEED = """() => { try { localStorage.setItem("fit-app-v1", JSON.stringify({})); } catch (e) {} }"""

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

async def main():
    out = {"steps": []}
    def step(name, ok, extra=None):
        out["steps"].append({"step": name, "ok": bool(ok), **({"extra": extra} if extra is not None else {})})
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.route("**/auth.js", lambda r: r.fulfill(content_type="text/javascript", body=STUB))
        await pg.add_init_script(SEED)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL)

        # M1: entry tour, slimmed to 3 steps. The stub provider
        # carries a display name, so the tour greets with it
        # (adoptSignInName) instead of asking: either shape is
        # a valid step 1.
        ok = await wait_eval(pg, "!!document.querySelector('#tourCard .tourLine')")
        step("tour step 1 opens for a new account", ok)
        dots = await pg.evaluate(J("document.querySelector('.tourDots') ? document.querySelector('.tourDots').textContent : ''"))
        step("tour shows 3 dots", dots.count("●") + dots.count("○") == 3, dots)
        has_field = await pg.evaluate(J("!!document.querySelector('#tourName')"))
        if has_field:
            await pg.fill("#tourName", "Probe")
        else:
            line1 = await pg.evaluate(J("(document.querySelector('.tourLine')||{}).textContent || ''"))
            step("tour step 1 greets without asking when the provider already gave a name (adoption proven later by the strip greeting)", "Welcome in" in line1, line1)
        await click(pg, "#tourNext")
        line2 = await wait_eval(pg, "(document.querySelector('.tourLine')||{}).textContent && document.querySelector('.tourLine').textContent.indexOf('Four places live in the side menu') !== -1 ? document.querySelector('.tourLine').textContent : null")
        step("tour step 2 is the one areas line", line2, line2)
        await click(pg, "#tourNext")
        line3 = await wait_eval(pg, "(document.querySelector('.tourLine')||{}).textContent && document.querySelector('.tourLine').textContent.indexOf('That\\u2019s the tour') !== -1 || ((document.querySelector('.tourLine')||{}).textContent||'').indexOf('the tour') !== -1 ? (document.querySelector('.tourLine')||{}).textContent : null")
        step("tour step 3 is the done line", line3, line3)
        await click(pg, "#tourDone")

        # setup follows (setupDone false), skip it like a customer can
        ok = await wait_eval(pg, "!document.querySelector('#setupModal').classList.contains('hidden')")
        step("setup sheet follows the tour", ok)
        await click(pg, "#suSkip")
        await pg.wait_for_timeout(400)

        # checklist on Today with all rows unticked + setup row
        gs = await pg.evaluate(J("""(() => { const c = document.querySelector('#gsCard'); if (!c || c.hidden) return null;
          return Array.from(c.querySelectorAll('[data-gs]')).map(b => ({ id: b.getAttribute('data-gs'), done: b.classList.contains('done'), label: b.textContent.trim() })); })()"""))
        step("checklist visible after skip with setup+checkin+meals+water+gym rows", gs and [r["id"] for r in gs] == ["setup", "checkin", "meals", "water", "gym"] and not any(r["done"] for r in gs), gs)

        # check-in ticks from real state
        await click(pg, '[data-level="great"]')
        await pg.wait_for_timeout(400)
        done1 = await pg.evaluate(J("(() => { const b = document.querySelector('[data-gs=\"checkin\"]'); return b ? b.classList.contains('done') : null; })()"))
        step("checkin row ticks after a real check-in tap", done1 is True, done1)

        # meals row deep-links; coach mark at point of use; Got it = never again
        await click(pg, '[data-gs="meals"]')
        coach = await wait_eval(pg, "(document.querySelector('#coachSpot')||{}).textContent && document.querySelector('#coachSpot').textContent.indexOf('Plan the day here') !== -1 ? document.querySelector('#coachSpot').textContent.trim().slice(0, 80) : null")
        step("meals row lands on the plan and its coach mark shows", coach, coach)
        await click(pg, "#coachGot")
        await pg.wait_for_timeout(300)
        gone = await pg.evaluate(J("(document.querySelector('#coachSpot')||{}).textContent === ''"))
        step("Got it clears the coach mark", gone)
        seen1 = await pg.evaluate(J(f"(() => {{ const s = JSON.parse(localStorage.getItem('fit-app-v1-account-{UID}') || '{{}}'); return !!(s.settings && s.settings.coachSeen && s.settings.coachSeen['meal-plan']); }})()"))
        step("coach seen flag saved on the account record", seen1)

        # plan the week (meals row) + pick a water goal (water row), on the plan screen
        await click(pg, "#planWeekBtn")
        await pg.wait_for_timeout(500)
        ra = await pg.evaluate(J("(() => { const m = document.querySelector('#remindAsk'); return m && !m.classList.contains('hidden'); })()"))
        if ra: await click(pg, "#remindAskNo"); await pg.wait_for_timeout(300)
        await pg.evaluate("""() => { const s = document.querySelector('#waterGoal'); if (s) { s.value = '2500'; s.dispatchEvent(new Event('change', { bubbles: true })); } }""")
        await pg.wait_for_timeout(400)
        await click(pg, '[data-view="today"]')
        await pg.wait_for_timeout(400)
        rows2 = await pg.evaluate(J("""(() => { const o = {}; document.querySelectorAll('[data-gs]').forEach(b => { o[b.getAttribute('data-gs')] = b.classList.contains('done'); }); return o; })()"""))
        step("meals + water rows tick from real state", rows2 and rows2.get("meals") and rows2.get("water"), rows2)

        # gym row: coach mark, Wally on the empty state, build a routine
        await click(pg, '[data-gs="gym"]')
        coach2 = await wait_eval(pg, "(document.querySelector('#coachSpot')||{}).textContent && document.querySelector('#coachSpot').textContent.indexOf('Build a routine here') !== -1 ? true : null")
        step("gym coach mark shows at routines", coach2)
        await click(pg, "#coachGot")
        wallyEmpty = await pg.evaluate(J("(() => { const c = document.querySelector('#areaBody .emptyCard'); return c ? c.innerHTML.indexOf('wally-welcome') !== -1 : null; })()"))
        step("no-routines empty state carries Wally", wallyEmpty)
        await click(pg, '[data-gyday="1"]')
        await click(pg, "#gyBuild")
        await pg.wait_for_timeout(500)
        await click(pg, '[data-view="today"]')
        await pg.wait_for_timeout(400)
        gymDone = await pg.evaluate(J("(() => { const b = document.querySelector('[data-gs=\"gym\"]'); return b ? b.classList.contains('done') : null; })()"))
        step("gym row ticks after a real routine build", gymDone is True, gymDone)

        # calendar + peptides coach marks (one each, then never again)
        await click(pg, '[data-area="calendar"][data-sub="cal-habits"]')
        coach3 = await wait_eval(pg, "(document.querySelector('#coachSpot')||{}).textContent && document.querySelector('#coachSpot').textContent.indexOf('Habits and lists live here') !== -1 ? true : null", 6000)
        step("calendar coach mark shows once", coach3)
        if coach3: await click(pg, "#coachGot")
        await click(pg, '[data-area="peptides"][data-sub="pep-list"]')
        coach4 = await wait_eval(pg, "(document.querySelector('#coachSpot')||{}).textContent && document.querySelector('#coachSpot').textContent.indexOf('only keeps the record') !== -1 ? true : null", 6000)
        step("peptides coach mark shows once (records-only words)", coach4)
        if coach4: await click(pg, "#coachGot")
        agree = await pg.evaluate(J("!!document.querySelector('#agreeBtn')"))
        if agree: await click(pg, "#agreeBtn"); await pg.wait_for_timeout(300)
        pepEmpty = await pg.evaluate(J("(() => { const c = document.querySelector('#areaBody .emptyCard'); return c ? c.innerHTML.indexOf('wally-welcome') !== -1 : null; })()"))
        step("no-doses empty state carries Wally", pepEmpty)

        # finish setup via the checklist row: all rows done -> celebration -> close -> gone forever
        await click(pg, '[data-view="today"]')
        await pg.wait_for_timeout(400)
        await click(pg, '[data-gs="setup"]')
        ok = await wait_eval(pg, "!document.querySelector('#setupModal').classList.contains('hidden')", 6000)
        step("setup row opens the setup sheet", ok)
        await click(pg, "#suDone")
        await pg.wait_for_timeout(500)
        celeb = await wait_eval(pg, "(document.querySelector('#gsCard')||{}).textContent && document.querySelector('#gsCard').textContent.indexOf('All done.') !== -1 ? true : null", 6000)
        step("all rows done shows the Wally celebration state", celeb)
        await click(pg, "#gsDoneClose")
        await pg.wait_for_timeout(300)
        hiddenNow = await pg.evaluate(J("document.querySelector('#gsCard').hidden === true"))
        step("celebration close removes the checklist", hiddenNow)

        # M4: Show the guide again resets tour + marks + checklist, data intact
        await click(pg, '[data-view="settings"]')
        await pg.wait_for_timeout(400)
        await click(pg, "#guideAgainBtn")
        tourBack = await wait_eval(pg, "!!document.querySelector('#tourName') || !!document.querySelector('#tourNext')", 6000)
        step("Show the guide again restarts the tour", tourBack)
        await click(pg, "#tourSkip")
        await pg.wait_for_timeout(500)
        gsBack = await pg.evaluate(J("(() => { const c = document.querySelector('#gsCard'); return c ? !c.hidden : null; })()"))
        step("checklist is back after the reset", gsBack)
        await click(pg, '[data-area="meals"][data-sub="meal-plan"]')
        coachBack = await wait_eval(pg, "(document.querySelector('#coachSpot')||{}).textContent && document.querySelector('#coachSpot').textContent.indexOf('Plan the day here') !== -1 ? true : null", 6000)
        step("coach marks are back after the reset", coachBack)
        kept = await pg.evaluate(J(f"(() => {{ const s = JSON.parse(localStorage.getItem('fit-app-v1-account-{UID}') || '{{}}'); return {{ routines: (s.routines || []).length, name: s.profile && s.profile.name, setupDone: !!(s.profile && s.profile.setupDone), planDays: Object.keys(s.plan || {{}}).length }}; }})()"))
        step("the reset wiped no user data (routine, name, setup, plan all kept)", kept and kept["routines"] >= 1 and kept["name"] == "Probe" and kept["setupDone"] and kept["planDays"] >= 1, kept)

        # sign-out clears the strip greeting at once, no reload
        await click(pg, '[data-view="today"]')
        await pg.wait_for_timeout(400)
        hiBefore = await pg.evaluate(J("document.querySelector('#stripHi').textContent"))
        step("strip greets by name while signed in", hiBefore == "Hi, Probe", hiBefore)
        await click(pg, '[data-view="settings"]')
        await pg.wait_for_timeout(300)
        await click(pg, "#accOutBtn")
        hiAfter = await wait_eval(pg, "document.body.classList.contains('signedOut') ? '[' + document.querySelector('#stripHi').textContent + ']' : null", 6000)
        step("sign-out clears the strip greeting at once (no reload)", hiAfter == "[]", repr(hiAfter))

        out["pageErrors"] = errs
        out["allOk"] = all(s["ok"] for s in out["steps"]) and not errs
        await b.close()
    print(json.dumps(out, indent=1))

asyncio.run(main())
