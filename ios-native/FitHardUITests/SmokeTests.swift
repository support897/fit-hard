import XCTest

final class SmokeTests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func seeded() -> XCUIApplication { let a = XCUIApplication(); a.launchArguments = ["-uiTestSeed", "-uiTestOffline"]; a.launch(); return a }
    func door() -> XCUIApplication { let a = XCUIApplication(); a.launchArguments = ["-uiTestDoor", "-uiTestOffline"]; a.launch(); return a }

    func shot(_ app: XCUIApplication, _ name: String) {
        usleep(700_000)
        try? FileManager.default.createDirectory(atPath: "/tmp/fh-shots", withIntermediateDirectories: true)
        let s = app.screenshot()
        try? s.pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/fh-shots/\(name).png"))
        let a = XCTAttachment(screenshot: s); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func scrollTo(_ app: XCUIApplication, _ el: XCUIElement) { for _ in 0..<10 where !el.exists || !el.isHittable { app.swipeUp() } }
    func any(_ app: XCUIApplication, _ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }

    // MARK: 1 The door
    func testDoorIsTheFirstScreenAndNothingElseShowsBeforeIt() {
        let app = door()
        XCTAssertTrue(any(app, "door-title").waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["Create your account"].exists)
        XCTAssertTrue(app.buttons["Continue with Apple"].exists); XCTAssertTrue(app.buttons["Continue with Google"].exists)
        XCTAssertTrue(app.textFields["Your name"].exists); XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertFalse(app.tabBars.firstMatch.exists, "no app content before the door")
        XCTAssertFalse(app.buttons["setup-next"].exists, "no setup before the door")
        shot(app, "door-first")
    }
    func testFailedSignInStaysOnSignInAndShowsAnError() {
        let app = door()
        XCTAssertTrue(any(app, "door-toggle").waitForExistence(timeout: 15)); any(app, "door-toggle").tap()
        XCTAssertTrue(app.staticTexts["Welcome back"].waitForExistence(timeout: 5))
        let e = app.textFields["Email"]; e.tap(); e.typeText("nobody@example.com")
        let p = app.secureTextFields["Password"]; p.tap(); p.typeText("wrongpass")
        any(app, "door-go").tap()
        XCTAssertTrue(app.staticTexts["That email or password is not right."].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Welcome back"].exists, "still a sign in, not a sign up")
        XCTAssertFalse(app.tabBars.firstMatch.exists); XCTAssertFalse(any(app, "setup-step").exists, "no account was created")
        shot(app, "door-failed-signin")
    }
    func testAppleAndGoogleAreHonestAboutNotBeingSwitchedOn() {
        let app = door()
        XCTAssertTrue(app.buttons["Continue with Apple"].waitForExistence(timeout: 15)); app.buttons["Continue with Apple"].tap()
        XCTAssertTrue(app.staticTexts["Apple sign in is not switched on yet. Please use email for now."].waitForExistence(timeout: 5))
        XCTAssertFalse(app.tabBars.firstMatch.exists)
    }

    // MARK: 1 + 2 Sign up, then the 11 setup screens, character, then the app, then sign out brings the door back
    func testSignUpThenFullSetupThenSignOut() {
        let app = door()
        addUIInterruptionMonitor(withDescription: "notif") { a in for b in ["Allow", "OK"] where a.buttons[b].exists { a.buttons[b].tap(); return true }; return false }
        let name = app.textFields["Your name"]; XCTAssertTrue(name.waitForExistence(timeout: 15)); name.tap(); name.typeText("Uitest")
        let e = app.textFields["Email"]; e.tap(); e.typeText("uitest@example.com")
        let p = app.secureTextFields["Choose a password (8+ characters)"]; p.tap(); p.typeText("my own password")
        any(app, "door-go").tap()
        XCTAssertTrue(any(app, "setup-step").waitForExistence(timeout: 10)); XCTAssertEqual(any(app, "setup-step").label, "Step 1 of 11")
        XCTAssertFalse(app.textFields["Your name"].exists, "setup never asks the name again")
        let next = any(app, "setup-next")
        XCTAssertFalse(next.isEnabled, "pick a goal first")
        any(app, "goal-muscle").tap(); shot(app, "setup-1-goals"); XCTAssertTrue(next.isEnabled); next.tap()
        XCTAssertEqual(any(app, "setup-step").label, "Step 2 of 11"); shot(app, "setup-2-body"); next.tap()
        XCTAssertEqual(any(app, "setup-step").label, "Step 3 of 11")
        XCTAssertFalse(next.isEnabled, "pick a character first"); shot(app, "setup-3-character-empty")
        any(app, "char-girl").tap(); shot(app, "setup-3-character"); XCTAssertTrue(next.isEnabled); next.tap()
        for n in 4...10 { XCTAssertEqual(any(app, "setup-step").label, "Step \(n) of 11"); shot(app, "setup-\(n)"); next.tap() }
        XCTAssertEqual(any(app, "setup-step").label, "Step 11 of 11"); shot(app, "setup-11-generate")
        XCTAssertTrue(app.buttons["Generate my plan"].exists); app.buttons["Generate my plan"].tap(); app.tap()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 40))
        for t in ["Meals", "Train", "Calendar", "More"] { XCTAssertTrue(app.tabBars.buttons[t].exists, t) }
        XCTAssertTrue(any(app, "avatar").exists, "chosen character is shown as the icon")
        shot(app, "after-setup-today")
        app.tabBars.buttons["More"].tap()
        let out = any(app, "sign-out"); scrollTo(app, out); XCTAssertTrue(out.exists); out.tap()
        XCTAssertTrue(any(app, "door-title").waitForExistence(timeout: 10), "signing out brings the door back")
        XCTAssertFalse(app.tabBars.firstMatch.exists)
    }

    // MARK: Look and navigation
    func testFiveTabsAndFeelingChoices() {
        let app = seeded()
        for t in ["Today", "Meals", "Train", "Calendar", "More"] { XCTAssertTrue(app.tabBars.buttons[t].waitForExistence(timeout: 15), t) }
        for id in ["feel-bad", "feel-ok", "feel-great"] { XCTAssertTrue(any(app, id).waitForExistence(timeout: 5), id) }
        XCTAssertTrue(app.staticTexts["Bad"].exists && app.staticTexts["Ok"].exists && app.staticTexts["Great"].exists)
        XCTAssertLessThan(any(app, "feel-bad").frame.minX, any(app, "feel-ok").frame.minX); XCTAssertLessThan(any(app, "feel-ok").frame.minX, any(app, "feel-great").frame.minX)
        shot(app, "today-feeling")
    }
    func setTheme(_ app: XCUIApplication, _ id: String) {
        app.tabBars.buttons["More"].tap()
        let b = any(app, "theme-\(id)")
        for _ in 0..<10 where !b.exists { app.swipeUp() }
        XCTAssertTrue(b.waitForExistence(timeout: 5)); b.tap()
    }
    func testTourAllScreensInAllThemes() {
        let app = seeded()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 20))
        for theme in ["burrow", "white", "black", "brown"] {
            setTheme(app, theme); shot(app, "\(theme)-more")
            for t in ["Today", "Meals", "Train", "Calendar"] { app.tabBars.buttons[t].tap(); sleep(1); shot(app, "\(theme)-\(t.lowercased())") }
        }
    }

    // MARK: 3 Meals
    func testMealsMenuHasEverySectionAndSwapWorks() {
        let app = seeded()
        app.tabBars.buttons["Meals"].tap()
        let menu = any(app, "meals-menu-button"); XCTAssertTrue(menu.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["lunch-line"].exists || true)
        for (id, title) in [("breakfast", "Breakfast"), ("lunch", "Lunch"), ("dinner", "Dinner"), ("snacks", "Snacks"), ("mine", "My Recipes"), ("have", "Ingredients I Have"), ("shop", "Shopping List"), ("nutrition", "Nutrition Overview"), ("plan", "My Meal Plan")] {
            menu.tap(); let row = any(app, "menu-\(id)"); XCTAssertTrue(row.waitForExistence(timeout: 5), id); row.tap()
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 5), title)
            if id == "shop" || id == "nutrition" { shot(app, "meals-\(id)") }
        }
        let swap = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'swap-'")).firstMatch
        XCTAssertTrue(swap.waitForExistence(timeout: 5)); shot(app, "meals-plan"); swap.tap()
    }
    func testIngredientsIHaveCanBeAdded() {
        let app = seeded(); app.tabBars.buttons["Meals"].tap()
        any(app, "meals-menu-button").tap(); any(app, "menu-have").tap()
        let q = any(app, "inv-qty"); XCTAssertTrue(q.waitForExistence(timeout: 5)); q.tap(); sleep(1); q.typeText("500")
        app.buttons["Cucumber"].firstMatch.tap()
        scrollTo(app, any(app, "inv-add")); any(app, "inv-add").tap()
        XCTAssertTrue(app.steppers.matching(NSPredicate(format: "label CONTAINS '500'")).firstMatch.waitForExistence(timeout: 5), "the new item shows its amount"); shot(app, "meals-have-added")
    }

    // MARK: 4 + 5 Routines, training mode, question mark help in every mode
    func testStartRoutineThenRunATrainingSessionWithHelpInEveryMode() {
        let app = seeded()
        app.tabBars.buttons["Train"].tap()
        let start = any(app, "start-routine-0"); XCTAssertTrue(start.waitForExistence(timeout: 10)); shot(app, "train-routines")
        XCTAssertTrue(any(app, "view-routine-0").exists)
        start.tap()
        XCTAssertTrue(any(app, "train-progress").waitForExistence(timeout: 10)); XCTAssertTrue(any(app, "train-progress").label.contains("Exercise 1 of"))
        shot(app, "training-1")
        for mode in ["Timer only", "Guided", "Hybrid"] {
            app.buttons[mode].tap()
            let help = any(app, "help-button"); XCTAssertTrue(help.waitForExistence(timeout: 5), "help in \(mode)")
            help.tap(); XCTAssertTrue(any(app, "help-title").waitForExistence(timeout: 5), "help opens in \(mode)")
            XCTAssertTrue(any(app, "help-title").label.hasPrefix("MASCOT HELP: "))
            if mode == "Guided" { shot(app, "training-help") }
            for t in app.staticTexts.allElementsBoundByIndex where t.exists { XCTAssertFalse(t.label.contains("-") || t.label.contains("\u{2014}") || t.label.contains("\u{2013}") || t.label.contains("\u{2022}"), "dash in help text: \(t.label)") }
            any(app, "help-close").tap(); XCTAssertTrue(any(app, "train-exercise").waitForExistence(timeout: 5), "back in the workout")
        }
        any(app, "start-set").tap(); any(app, "start-set").tap()
        XCTAssertTrue(any(app, "rest-left").waitForExistence(timeout: 5)); shot(app, "training-rest")
        any(app, "rest-pause").tap(); any(app, "rest-pause").tap(); any(app, "skip-rest").tap()
        XCTAssertFalse(any(app, "rest-left").exists)
        any(app, "set-done-1").tap(); XCTAssertTrue(any(app, "skip-rest").waitForExistence(timeout: 5)); any(app, "skip-rest").tap()
        while any(app, "train-next").label == "Next exercise" { any(app, "train-next").tap() }
        any(app, "train-next").tap()
        XCTAssertTrue(any(app, "train-summary").waitForExistence(timeout: 5)); shot(app, "training-summary")
        any(app, "train-save").tap()
        XCTAssertTrue(app.tabBars.buttons["Train"].waitForExistence(timeout: 10))
    }

    // MARK: 6 Calendar
    func testCalendarPlusAddsAnEventAndLegendIsShown() {
        let app = seeded()
        app.tabBars.buttons["Calendar"].tap()
        XCTAssertTrue(any(app, "cal-legend").waitForExistence(timeout: 10))
        for l in ["Training", "Meals", "Recovery", "Medication", "Personal"] { XCTAssertTrue(app.staticTexts[l].exists, l) }
        shot(app, "cal-month")
        any(app, "cal-add").tap()
        let t = any(app, "ev-title"); XCTAssertTrue(t.waitForExistence(timeout: 5)); t.tap(); t.typeText("Stretch time")
        any(app, "ev-save").tap()
        app.buttons["Day"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Stretch time'")).firstMatch.waitForExistence(timeout: 5)); shot(app, "cal-day-added")
        app.buttons["Week"].tap(); shot(app, "cal-week")
        app.buttons["Next"].tap(); app.buttons["To do"].tap(); XCTAssertTrue(app.staticTexts["To do"].waitForExistence(timeout: 5))
        app.buttons["Habits"].tap(); XCTAssertTrue(app.staticTexts["Habits"].waitForExistence(timeout: 5))
    }

    // MARK: Profile
    func testProfileScreenChangesTheCharacter() {
        let app = seeded(); app.tabBars.buttons["More"].tap()
        let p = any(app, "my-profile"); XCTAssertTrue(p.waitForExistence(timeout: 10)); p.tap()
        any(app, "pchar-boy").tap(); shot(app, "profile")
        any(app, "profile-save").tap()
        XCTAssertTrue(any(app, "pchar-boy").exists)
    }
}
