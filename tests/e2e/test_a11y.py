"""Accessibility smoke with axe-core on the primary screens (WCAG 2 A/AA rules)."""
import os
from harness import *
from fixtures import seeded
AXE = open(os.path.join(ROOT, "tests/node_modules/axe-core/axe.min.js")).read()
bad = 0
def run(pg, label):
    global bad
    pg.evaluate(AXE)
    res = pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,t:v.nodes.slice(0,3).map(n=>n.target.join(' '))})))")
    ser = [v for v in res if v["impact"] in ("serious", "critical")]
    print(("PASS " if not ser else "FAIL ") + label, ser if ser else "", "(minor/moderate: %s)" % [v["id"] for v in res if v not in ser] if res else "")
    bad += len(ser)
st = seeded()
with server():
    for appr in ["brand", "black"]:
        s = dict(st); s["settings"] = dict(st["settings"], appearance=appr)
        with app_page(state=s) as pg:
            pg.evaluate("document.body.dataset.appearance=%r" % appr)
            run(pg, f"[{appr}] Today")
            for tab in ["food", "train", "calendar", "more"]:
                pg.click(f'#tabBar [data-tab={tab}]'); pg.wait_for_timeout(300); run(pg, f"[{appr}] {tab}")
print("A11Y serious/critical violations:", bad)
sys.exit(1 if bad else 0)
