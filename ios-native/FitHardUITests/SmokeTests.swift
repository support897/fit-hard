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
        let black = app.buttons["Black"]
        for _ in 0..<6 where !black.exists { app.swipeUp() }
        XCTAssertTrue(black.waitForExistence(timeout: 5))
        black.tap()
        app.buttons["Brown"].tap()
        app.buttons["White"].tap()
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
}
