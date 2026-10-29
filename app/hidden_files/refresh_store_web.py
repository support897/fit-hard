"""Refresh store-build/dist + www from the repo bundle list.
The bundle is the app ONLY: owner.* (web-only dashboard),
privacy.html (hosted) and anim-preview.html (dev) never ship."""
import os, shutil, sys

ROOT = os.path.expanduser("~/workspace/fit-app")
FILES = ["index.html", "styles.css", "app.js", "logic.js", "data.js", "wally.js",
         "i18n.js", "i18n-content.js", "prices-data.js", "calendar-import.js", "demo-seed.js", "auth.js", "accounts-config.js", "meals-data.js",
         "meals-nutrition.js", "meals-logic.js", "exercises-data.js",
         "anim-data.js", "anim-data-expansion.js", "anim.js",
         "service-worker.js", "manifest.webmanifest"]
DIRS = ["icons", "fonts", "assets", "vendor", "sdk"]

for target in ["dist", "www"]:
    base = os.path.join(ROOT, "store-build", target)
    for f in FILES:
        shutil.copy(os.path.join(ROOT, f), os.path.join(base, f))
    for d in DIRS:
        dst = os.path.join(base, d)
        if os.path.exists(dst): shutil.rmtree(dst)
        shutil.copytree(os.path.join(ROOT, d), dst)
    bad = [x for x in os.listdir(base) if x.startswith("owner") or x == "privacy.html" or x == "anim-preview.html"]
    assert not bad, f"{target} carries excluded files: {bad}"
    # FIT-001 cure (18 Oct): every path the service worker precaches must
    # exist inside the refreshed bundle, or its install dies on a 404.
    import re as _re
    _sw = open(os.path.join(base, "service-worker.js")).read()
    _listed = _re.findall(r'"([^"]+)"', _re.findall(r"FILES\s*=\s*\[(.*?)\]", _sw, _re.S)[0])
    _missing = [e for e in _listed if e != "./" and not os.path.exists(os.path.join(base, e))]
    assert not _missing, f"{target}: SW precaches files the bundle does not carry: {_missing}"
    have = sorted(os.listdir(base))
    print(target, "refreshed:", len(have), "entries")
print("bundle list:", len(FILES), "files +", len(DIRS), "dirs")
