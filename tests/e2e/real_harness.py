"""Real-user harness: the app's REAL auth.js + Firestore code (patched only to point at local emulators), the REAL firestore.rules,
several independent browser contexts (= separate devices). Never touches production (demo project id, fake api key)."""
import os, re, json, time, subprocess, socket, urllib.request, contextlib
from playwright.sync_api import sync_playwright
from harness import server, PORT
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RULES_DIR = os.path.join(ROOT, "tests", "rules")
PROJECT = "demo-fit-hard"
def _wait(port, t=90):
    end = time.time() + t
    while time.time() < end:
        try: socket.create_connection(("127.0.0.1", port), 1).close(); return True
        except OSError: time.sleep(0.5)
    raise RuntimeError("emulator port %d not up" % port)
@contextlib.contextmanager
def emulators():
    subprocess.run(["cp", os.path.join(ROOT, "app", "firestore.rules"), os.path.join(RULES_DIR, "firestore.rules")], check=True)
    if not os.path.exists(os.path.join(RULES_DIR, "sdk-test.js")):
        subprocess.run(["bash", "-c", "cd %s && npx esbuild sdk-entry.js --bundle --format=esm --outfile=sdk-test.js --minify --log-level=error" % RULES_DIR], check=True)
    p = subprocess.Popen(["npx", "firebase", "emulators:start", "--only", "auth,firestore", "--project", PROJECT], cwd=RULES_DIR, stdout=open("/tmp/emu.log", "w"), stderr=subprocess.STDOUT, preexec_fn=os.setsid)
    try:
        _wait(8089); _wait(9099); time.sleep(1.5); yield
    finally:
        import signal
        try: os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except Exception: pass
def admin_docs(path):
    """Read a Firestore path with the emulator admin bypass (verifies what is really stored in the cloud)."""
    req = urllib.request.Request("http://127.0.0.1:8089/v1/projects/%s/databases/(default)/documents/%s" % (PROJECT, path), headers={"Authorization": "Bearer owner"})
    try: return json.load(urllib.request.urlopen(req, timeout=10))
    except Exception as e: return {"error": str(e)}
def clear_all():
    for u in ("http://127.0.0.1:8089/emulator/v1/projects/%s/databases/(default)/documents" % PROJECT, "http://127.0.0.1:9099/emulator/v1/projects/%s/accounts" % PROJECT):
        try: urllib.request.urlopen(urllib.request.Request(u, method="DELETE"), timeout=10)
        except Exception: pass
def _patched_auth():
    s = open(os.path.join(ROOT, "app", "auth.js")).read()
    s = re.sub(r'from "\./sdk/firebase-(app|auth|firestore)\.js"', 'from "/sdk-test.js"', s)
    s = s.replace("db = getFirestore(app);", 'db = getFirestore(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); connectFirestoreEmulator(db, "127.0.0.1", 8089);')
    s = s.replace('import { initializeApp } from "/sdk-test.js";', 'import { initializeApp, connectAuthEmulator, connectFirestoreEmulator } from "/sdk-test.js";')
    assert "connectAuthEmulator(auth" in s and "/sdk/" not in s
    return s
CONFIG = 'window.FIT_ACCOUNT_CONFIG = {apiKey:"fake-key",authDomain:"localhost",projectId:"%s",appId:"1:1:web:1"};' % PROJECT
class Device:
    """One browser context = one phone. Real auth against the emulator."""
    def __init__(self, browser, width=390, height=844, name="device"):
        self.name = name
        self.ctx = browser.new_context(viewport={"width": width, "height": height}, has_touch=True, service_workers="block")
        self.pg = self.ctx.new_page(); self.errors = []
        self.pg.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        self.pg.on("console", lambda m: self.errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text else None)
        self.pg.on("response", lambda r: self.errors.append("http %d %s" % (r.status, r.url[:120])) if r.status >= 400 and "8089" in r.url else None)
        auth_js = _patched_auth(); bundle = open(os.path.join(RULES_DIR, "sdk-test.js")).read()
        self.pg.route("**/auth.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body=auth_js))
        self.pg.route("**/sdk-test.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body=bundle))
        self.pg.route("**/accounts-config.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body=CONFIG))
    def open(self):
        self.pg.goto("http://localhost:%d/app/index.html" % PORT); self.pg.wait_for_timeout(1500); self.assert_emulator(); return self.pg
    def assert_emulator(self):
        """SAFETY: never let a test talk to production Firebase."""
        pid = self.pg.evaluate("window.FIT_ACCOUNT_CONFIG && window.FIT_ACCOUNT_CONFIG.projectId")
        if pid != PROJECT: raise RuntimeError("SAFETY: page is not on the emulator project (%r)" % pid)
    def state(self, key="fit-app-v1"):
        return self.pg.evaluate("(k)=>{var o={};Object.keys(localStorage).forEach(x=>{if(x.indexOf('fit-app-v1')===0)o[x]=localStorage.getItem(x)});return o}", key)
@contextlib.contextmanager
def world():
    with server(), emulators():
        clear_all()
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            try: yield b
            finally: b.close()

def auth_users():
    """email -> uid straight from the Auth emulator (admin)."""
    req = urllib.request.Request("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/%s/accounts:query" % PROJECT, data=b"{}", headers={"Authorization": "Bearer owner", "Content-Type": "application/json"}, method="POST")
    try: d = json.load(urllib.request.urlopen(req, timeout=10))
    except Exception as e: return {"error": str(e)}
    return {u.get("email"): u.get("localId") for u in d.get("userInfo", [])}
def cloud_text(uid):
    """Everything stored in the cloud for a uid, as one lowercase string (root doc + all slices)."""
    root = json.dumps(admin_docs("users/" + uid)); sl = json.dumps(admin_docs("users/%s/slices" % uid))
    return (root + sl).lower()
def wait_cloud(uid, needle, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        if needle.lower() in cloud_text(uid): return True
        time.sleep(1)
    return False
# ---- real-user actions
def sign_up(pg, email, pw):
    pg.fill("#accEmail", email); pg.click("#accNextBtn"); pg.wait_for_timeout(600)
    pg.fill("#accPass", pw); pg.click("#accContinueBtn"); pg.wait_for_timeout(2500)
def finish_tour(pg, name):
    pg.fill("#tourName", name); pg.click("#tourNext"); pg.click("#tourNext"); pg.click("#tourDone"); pg.wait_for_timeout(500)
def run_setup(pg, goal=None, full=False):
    """Walk the 3-step setup like a person. Returns number of clicks used."""
    n = 0
    pg.wait_for_selector("#setupModal:not(.hidden)", timeout=5000)
    if goal: pg.select_option("#suGoal", goal)
    pg.click("#suNext"); n += 1
    pg.click("#suNext"); n += 1
    pg.click("#suDone"); n += 1; pg.wait_for_timeout(700)
    return n
