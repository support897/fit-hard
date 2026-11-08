"""Real-user journeys with the REAL auth code + Firestore emulator + real rules, separate devices. See docs/TEST_PLAN.md."""
import sys, json, time
from real_harness import *
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (" :: " + str(detail)[:300] if (detail and not cond) else ""), flush=True)
S = "/home/user/work/shots_real/"; os.makedirs(S, exist_ok=True)
def real_errors(d): return [e for e in d.errors if "status of 400" not in e and "status of 401" not in e]   # auth REST answers 400 for first sign-in try / wrong password by design
def text(pg): return pg.inner_text("body")
def sign_out(pg):
    pg.wait_for_timeout(500)
    pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=settings]'); pg.wait_for_timeout(400); 
    try: pg.click("#accOutBtn", timeout=6000)
    except Exception:
        print("DEBUG accountBox:", pg.inner_text("#accountBox")[:300].replace("\n"," | "), "| body class:", pg.evaluate("document.body.className")); pg.screenshot(path=S + "debug_signout.png", full_page=True); raise
    pg.wait_for_timeout(1500)
with world() as b:
    maya = Device(b, name="maya-phone"); pg = maya.open()
    # J1 door
    check("J1 signed-out user meets the door, not the app", "Sign in or make your account" in text(pg) and "How are you feeling" not in text(pg), text(pg)[:200])
    pg.screenshot(path=S + "j1_door.png")
    pg.fill("#accEmail", ""); pg.click("#accNextBtn"); pg.wait_for_timeout(500)
    check("J1 empty email gets a kind message", pg.locator("#accPass").count() == 0 or not pg.locator("#accPass").is_visible(), text(pg)[:300])
    pg.fill("#accEmail", "not-an-email"); pg.click("#accNextBtn"); pg.wait_for_timeout(500)
    check("J1 bad email refused", not (pg.locator("#accPass").count() and pg.locator("#accPass").is_visible()), text(pg)[:300])
    pg.fill("#accEmail", "maya@example.com"); pg.click("#accNextBtn"); pg.wait_for_timeout(500)
    pg.fill("#accPass", "abc"); pg.click("#accContinueBtn"); pg.wait_for_timeout(800)
    check("J1 short password explained", "short" in pg.inner_text("#toast").lower(), pg.inner_text("#toast"))
    pg.fill("#accPass", "Maya-pass-123"); pg.click("#accContinueBtn"); pg.wait_for_timeout(2500)
    check("J1 account created, lands on Today with the tour", pg.locator("#tourName").count() == 1 and "How are you feeling" in text(pg), text(pg)[:200])
    # J2 onboarding
    finish_tour(pg, "Maya")
    clicks = run_setup(pg, goal="Lose weight gently")
    check("J2 setup is 3 short steps (<=3 taps) and ends on Today", clicks == 3 and "Hi, Maya" in text(pg), text(pg)[:120])
    pg.screenshot(path=S + "j2_today_new_user.png", full_page=True)
    # data lands in the cloud for Maya only
    uids = auth_users(); mu = uids.get("maya@example.com")
    check("J1 Auth emulator holds Maya", bool(mu), uids)
    check("J2 Maya's profile reaches the cloud", mu and wait_cloud(mu, "Maya"), cloud_text(mu)[:200] if mu else "")
    # J5 second user on a separate device
    dev = Device(b, name="dev-phone"); pd = dev.open()
    sign_up(pd, "dev@example.com", "Dev-pass-123"); finish_tour(pd, "Dev"); run_setup(pd)
    uids = auth_users(); du = uids.get("dev@example.com")
    check("J5 Dev is a different account", du and du != mu, uids)
    check("J5 Dev sees only Dev (no Maya) in the UI", "Hi, Dev" in text(pd) and "Maya" not in text(pd), text(pd)[:150])
    check("J5 Dev's local storage holds no Maya data", "maya" not in json.dumps(dev.state()).lower())
    pd.click('#tabBar [data-tab=calendar]'); pd.click('#subTabs [data-subtab=cal-todos]'); pd.wait_for_timeout(400)
    time.sleep(2)
    check("J5 Dev's cloud docs contain Dev and no Maya", wait_cloud(du, "Dev") and "maya" not in cloud_text(du), cloud_text(du)[:200])
    check("J5 Maya's cloud docs contain no Dev", "dev" not in cloud_text(mu).replace("device", "").replace("develop", ""), cloud_text(mu)[:200])
    # J4 sign out and back in on a NEW device
    sign_out(pg)
    check("J4 sign-out returns to the door and wipes local copy", "Sign in or make your account" in text(pg) and "maya" not in json.dumps(maya.state()).lower(), json.dumps(maya.state())[:200])
    new = Device(b, name="maya-new-phone"); pn = new.open()
    pn.fill("#accEmail", "maya@example.com"); pn.click("#accNextBtn"); pn.wait_for_timeout(500)
    pn.fill("#accPass", "wrong-password-1"); pn.click("#accContinueBtn"); pn.wait_for_timeout(2000)
    msg = pn.inner_text("#toast") + text(pn)
    check("J4 wrong password gets a kind, specific message", ("password" in msg.lower() and ("not" in msg.lower() or "wrong" in msg.lower() or "didn" in msg.lower() or "try" in msg.lower())), msg[:300])
    pn.fill("#accPass", "Maya-pass-123"); pn.click("#accContinueBtn"); pn.wait_for_timeout(3500)
    check("J4 Maya's data restored on a brand-new device", "Hi, Maya" in text(pn) and "Dev" not in text(pn), text(pn)[:200])
    check("J4 no new setup/tour nag for a returning user", pn.locator("#tourName").count() == 0 and pn.locator("#setupModal:not(.hidden)").count() == 0)
    # same device account switch: Dev signs in on Maya's new phone
    pn.screenshot(path=S + "j4_returning.png", full_page=True)
    sign_out(pn)
    pn.wait_for_selector("#accEmail", timeout=10000); pn.wait_for_timeout(800)
    pn.fill("#accEmail", "dev@example.com"); pn.click("#accNextBtn"); pn.wait_for_timeout(500)
    pn.fill("#accPass", "Dev-pass-123"); pn.click("#accContinueBtn")
    try: pn.wait_for_function("document.body.innerText.indexOf('Hi, Dev')>=0", timeout=15000)
    except Exception: pass
    pn.wait_for_timeout(1000)
    pn.screenshot(path=S + "j5_switch.png"); print("SWITCHTEXT", text(pn)[:300].replace("\n"," | "), pn.evaluate("Object.keys(localStorage)"))
    check("J5 same phone, other account: shows Dev, nothing of Maya", "Hi, Dev" in text(pn) and "Maya" not in text(pn) and "maya" not in json.dumps(new.state()).lower(), text(pn)[:150])
    # J11 delete account
    pg2 = pn
    pg2.click('#tabBar [data-tab=more]'); pg2.click('[data-more=settings]'); pg2.wait_for_timeout(400)
    pg2.click("#accDeleteBtn"); pg2.wait_for_timeout(300); pg2.fill("#accDeletePass", "Dev-pass-123"); pg2.click("#accDeleteYes"); pg2.wait_for_timeout(4000)
    check("J11 Dev's account is gone from Auth", "dev@example.com" not in auth_users(), auth_users())
    check("J11 Dev's cloud documents are gone", "dev" not in cloud_text(du).replace("device","") or "error" in cloud_text(du) or "not_found" in cloud_text(du), cloud_text(du)[:200])
    check("J11 Maya untouched by Dev's deletion", "maya" in cloud_text(mu))
    for d in (maya, dev, new): check("no unexpected console errors on " + d.name, not real_errors(d), real_errors(d)[:3])
fails = [r for r in results if not r[1]]
print(f"REAL_JOURNEYS {len(results)-len(fails)}/{len(results)}"); sys.exit(1 if fails else 0)
