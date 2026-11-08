"""Phase 7 sweep: every tab and sub-tab x 2 themes x 3 widths: no errors, no horizontal overflow, screenshots."""
import sys
from harness import *
from fixtures import *
res = []
def check(n, c, d=""):
    res.append(c); print(("PASS " if c else "FAIL ") + n + (" :: " + str(d) if (d and not c) else ""))
with server():
    for theme in ["brand", "black"]:
        for w, h in [(320, 640), (390, 844), (1024, 768)]:
            s = seeded(); s["disclaimer"] = {"agreedAt": "2026-01-01T00:00:00.000Z", "version": 1}; s["settings"]["appearance"] = theme
            with app_page(width=w, height=h, state=s) as pg:
                tabs = pg.eval_on_selector_all("#tabBar [data-tab]", "e=>e.map(x=>x.dataset.tab)")
                for t in tabs:
                    pg.click(f'#tabBar [data-tab={t}]'); pg.wait_for_timeout(250)
                    if t == "more":
                        rows = pg.eval_on_selector_all("#moreList [data-more]", "e=>e.map(x=>x.dataset.more)")
                        for r in [x for x in rows if x != "setup"]:
                            pg.click('#tabBar [data-tab=more]'); pg.click(f'[data-more={r}]'); pg.wait_for_timeout(250)
                            subs = pg.eval_on_selector_all("#subTabs .subTab", "e=>e.filter(x=>x.offsetParent!==null).map(x=>x.dataset.subtab)")
                            for sb in subs or [None]:
                                if sb: pg.click(f'#subTabs [data-subtab={sb}]'); pg.wait_for_timeout(250)
                                ov = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                                check(f"{theme} {w} more/{r}/{sb} no overflow", not ov)
                                if w == 390 and sb in (None, subs[0] if subs else None): pg.screenshot(path=f"/home/user/work/shots_final/{theme}_{w}_more_{r}.png", full_page=True)
                        continue
                    subs = pg.eval_on_selector_all("#subTabs .subTab", "e=>e.filter(x=>x.offsetParent!==null).map(x=>x.dataset.subtab)")
                    for sb in subs or [None]:
                        if sb: pg.click(f'#subTabs [data-subtab={sb}]'); pg.wait_for_timeout(300)
                        ov = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                        check(f"{theme} {w} {t}/{sb} no overflow", not ov)
                        if w == 390: pg.screenshot(path=f"/home/user/work/shots_final/{theme}_{w}_{t}_{sb}.png", full_page=True)
                check(f"{theme} {w} no console errors", not pg.errors, pg.errors[:3])
print(f"SWEEP {sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
