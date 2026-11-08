"""E2E harness: serves the app, blocks the real Firebase module, injects a fake FitAuth
(test-only; nothing here ships). Usage: from harness import app_page."""
import contextlib, json, subprocess, time, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = int(os.environ.get("FH_PORT", "8123"))
FAKE_AUTH = r"""
(function(){
  var user = {uid: window.__FH_UID || 'test-user-1', email: 'tester@example.com', isAnonymous:false, providerData:[{providerId:'password'}]};
  var cloud = window.__FH_CLOUD || {};
  window.__fakeCloud = cloud;
  window.FitAuth = {
    initDoor: function(){return true;},
    watchUser: function(cb){ setTimeout(function(){cb(window.__FH_SIGNED_OUT?null:user);},50); },
    loadCloudState: function(uid){ return Promise.resolve(cloud[uid]||null); },
    saveCloudState: function(uid,s){ cloud[uid]=JSON.parse(JSON.stringify(s)); return Promise.resolve({warnings:[]}); },
    signOutUser: function(){return Promise.resolve();}, deleteAccount:function(){return Promise.resolve();},
    syncPlan:function(){return Promise.resolve('free');}, planOf:function(){return 'free';},
    entitlement:function(){return 'free';}, entitlementDetail:function(){return {tier:'free'};},
    setAccountAge:function(){}, resolveTier:function(){return 'free';},
    signUpWithEmail:function(){return Promise.resolve();}, signInWithEmail:function(){return Promise.resolve();},
    signInWithGoogle:function(){return Promise.resolve();}, signInWithApple:function(){return Promise.resolve();},
    resetPassword:function(){return Promise.resolve();}
  };
  window.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ window.dispatchEvent(new Event('fit-auth-ready')); },0); });
})();
"""
@contextlib.contextmanager
def server():
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try: yield p
    finally: p.terminate()

@contextlib.contextmanager
def app_page(width=390, height=844, state=None, signed_out=False, reduced_motion=False, lang=None, touch=True):
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": width, "height": height}, has_touch=touch, reduced_motion="reduce" if reduced_motion else "no-preference")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        pg.route("**/auth.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body="/* blocked in tests */"))
        pg.route("**/sdk/**", lambda r: r.fulfill(status=200, content_type="text/javascript", body=""))
        pre = ""
        if signed_out: pre += "window.__FH_SIGNED_OUT=true;"
        if state is not None:
            pre += "try{localStorage.setItem('fit-app-v1', %s);}catch(e){}" % json.dumps(json.dumps(state))
        pg.add_init_script(pre + FAKE_AUTH)
        pg.goto(f"http://localhost:{PORT}/app/index.html")
        pg.wait_for_timeout(1200)
        pg.errors = errs
        try: yield pg
        finally: b.close()
