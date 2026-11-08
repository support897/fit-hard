from harness import *
out=sys.argv[1]
with server(), app_page() as pg:
    pg.wait_for_timeout(800)
    pg.screenshot(path=f"{out}/signedin_today.png")
    print("body class:", pg.evaluate("document.body.className"))
    print(pg.evaluate("document.body.innerText.slice(0,500)"))
    print("errors:", pg.errors)
