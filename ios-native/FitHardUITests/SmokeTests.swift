import XCTest

final class SmokeTests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func seeded() -> XCUIApplication { let a = XCUIApplication(); a.launchArguments = ["-uiTestSeed"]; a.launch(); return a }

    func testFiveTabsAndCalendarIsReachable() {
        let app = seeded()
        for t in ["Today", "Food", "Train", "Calendar", "More"] { XCTAssertTrue(app.tabBars.buttons[t].waitForExistence(timeout: 15), t) }
        app.tabBars.buttons["Calendar"].tap()
        XCTAssertTrue(app.navigationBars["Calendar"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Month"].exists); XCTAssertTrue(app.buttons["Habits"].exists); XCTAssertTrue(app.buttons["To do"].exists)
        app.buttons["To do"].tap()
        XCTAssertTrue(app.staticTexts["To do"].waitForExistence(timeout: 5))
        app.buttons["Habits"].tap()
        XCTAssertTrue(app.staticTexts["Habits"].waitForExistence(timeout: 5))
    }

    func testEveryTabOpens() {
        let app = seeded()
        for t in ["Food", "Train", "More", "Today"] {
            XCTAssertTrue(app.tabBars.buttons[t].waitForExistence(timeout: 15))
            app.tabBars.buttons[t].tap()
            XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 5), t)
        }
    }

    func testThemeCanBeSwitched() {
        let app = seeded()
        app.tabBars.buttons["More"].tap()
        let black = app.descendants(matching: .any)["theme-black"]
        for _ in 0..<8 where !black.exists { app.swipeUp() }
        XCTAssertTrue(black.waitForExistence(timeout: 5))
        black.tap()
        app.descendants(matching: .any)["theme-brown"].tap()
        app.descendants(matching: .any)["theme-white"].tap()
        XCTAssertTrue(app.tabBars.buttons["Today"].exists)
    }

    func testOnboardingBuildsTheApp() {
        let app = XCUIApplication(); app.launch()
        addUIInterruptionMonitor(withDescription: "notif") { a in
            for b in ["Allow", "OK"] where a.buttons[b].exists { a.buttons[b].tap(); return true }; return false }
        let name = app.textFields["Your name"]
        XCTAssertTrue(name.waitForExistence(timeout: 15))
        name.tap(); name.typeText("Uitest")
        for _ in 0..<6 {
            let next = app.buttons["Next"]; XCTAssertTrue(next.waitForExistence(timeout: 5)); next.tap()
        }
        let build = app.buttons["Build my app"]
        XCTAssertTrue(build.waitForExistence(timeout: 5)); build.tap()
        app.tap()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 40))
        XCTAssertTrue(app.tabBars.buttons["Calendar"].exists)
    }

    // MARK: Screenshot tour + real interactions, in every theme. PNGs go to /tmp/fh-shots for CI to collect.
    func shot(_ app: XCUIApplication, _ name: String) {
        try? FileManager.default.createDirectory(atPath: "/tmp/fh-shots", withIntermediateDirectories: true)
        let s = app.screenshot()
        try? s.pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/fh-shots/\(name).png"))
        let a = XCTAttachment(screenshot: s); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func setTheme(_ app: XCUIApplication, _ id: String) {
        app.tabBars.buttons["More"].tap()
        let b = app.descendants(matching: .any)["theme-\(id)"]
        for _ in 0..<8 where !b.exists { app.swipeUp() }
        XCTAssertTrue(b.waitForExistence(timeout: 5)); b.tap()
    }

    func testTourAllScreensInAllThemes() {
        let app = seeded()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 20))
        for theme in ["white", "black", "brown"] {
            setTheme(app, theme)
            shot(app, "\(theme)-more")
            for t in ["Today", "Food", "Train", "Calendar"] {
                app.tabBars.buttons[t].tap(); sleep(1); shot(app, "\(theme)-\(t.lowercased())")
            }
        }
    }

    func testCalendarTaskAndHabitCanBeAdded() {
        let app = seeded()
        XCTAssertTrue(app.tabBars.buttons["Calendar"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Calendar"].tap()
        shot(app, "cal-month")
        app.buttons["To do"].tap()
        let f = app.textFields["New task"]; XCTAssertTrue(f.waitForExistence(timeout: 5))
        f.tap(); f.typeText("Buy oats")
        app.buttons["Add"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Buy oats"].waitForExistence(timeout: 5), "task not listed")
        shot(app, "cal-todo-added")
        app.buttons["Habits"].tap()
        let h = app.textFields["New habit"]; XCTAssertTrue(h.waitForExistence(timeout: 5))
        h.tap(); h.typeText("Stretch\n")
        XCTAssertTrue(app.staticTexts["Stretch"].waitForExistence(timeout: 5), "habit not listed")
        shot(app, "cal-habit-added")
        app.buttons["Month"].tap()
        shot(app, "cal-month-after")
    }
}
