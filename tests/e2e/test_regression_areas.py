"""Regression: every section of every area still renders content with no errors (all 12 subsections)."""
from fixtures import *
res = []
with server(), app_page(state=seeded()) as pg:
    for tab, area in [("food", "meals"), ("train", "gym"), ("calendar", "calendar")]:
        pg.click(f'#tabBar [data-tab={tab}]'); pg.wait_for_timeout(200)
        subs = pg.eval_on_selector_all("#subTabs .subTab", "els=>els.map(e=>e.dataset.subtab)")
        for s in subs:
            pg.click(f'#subTabs [data-subtab={s}]'); pg.wait_for_timeout(350)
            n = len(pg.locator("#areaBody").inner_text().strip())
            ok = n > 20 and pg.locator('#subTabs .subTab.active').get_attribute("data-subtab") == s
            res.append(ok); print(("PASS " if ok else "FAIL ") + f"{area}/{s} renders ({n} chars)")
    pg.click('#tabBar [data-tab=more]'); pg.click('[data-more=health]')
    for s in pg.eval_on_selector_all("#subTabs .subTab", "els=>els.map(e=>e.dataset.subtab)"):
        pg.click(f'#subTabs [data-subtab={s}]'); pg.wait_for_timeout(350)
        n = len(pg.locator("#areaBody").inner_text().strip()); ok = n > 20
        res.append(ok); print(("PASS " if ok else "FAIL ") + f"peptides/{s} renders ({n} chars)")
    ok = not pg.errors; res.append(ok); print(("PASS " if ok else "FAIL ") + "no errors", pg.errors)
print(f"REGRESSION: {sum(res)} passed, {len(res)-sum(res)} failed"); sys.exit(0 if all(res) else 1)
