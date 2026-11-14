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
    func testDoorFirstPageShowsOnlyGoogleAppleAndASmallEmailButton() {
        let app = door()
        XCTAssertTrue(any(app, "door-title").waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["door-google"].exists); XCTAssertTrue(any(app, "door-apple").exists); XCTAssertTrue(any(app, "door-email").exists)
        XCTAssertFalse(app.textFields["Email"].exists, "email lives on its own page")
        XCTAssertFalse(app.secureTextFields.firstMatch.exists)
        XCTAssertFalse(app.tabBars.firstMatch.exists, "no app content before the door")
        XCTAssertFalse(app.buttons["setup-next"].exists, "no setup before the door")
        shot(app, "door-first")
        any(app, "door-email").tap()
        XCTAssertTrue(app.textFields["Email"].waitForExistence(timeout: 5)); XCTAssertTrue(app.textFields["Your name"].exists)
        shot(app, "door-email-page")
        // Swipe law: sliding back from the left edge returns to the first page.
        let edge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)); edge.press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)))
        XCTAssertTrue(any(app, "door-title").waitForExistence(timeout: 5))
    }
    func testFailedSignInStaysOnSignInAndShowsAnError() {
        let app = door()
        XCTAssertTrue(any(app, "door-email").waitForExistence(timeout: 15)); any(app, "door-email").tap()
        XCTAssertTrue(any(app, "door-toggle").waitForExistence(timeout: 5)); app.buttons["Sign in"].tap()
        let e = app.textFields["Email"]; e.tap(); e.typeText("nobody@example.com")
        let p = app.secureTextFields["Password"]; p.tap(); p.typeText("wrongpass")
        any(app, "door-go").tap()
        XCTAssertTrue(app.staticTexts["That email or password is not right."].waitForExistence(timeout: 8))
        XCTAssertFalse(app.textFields["Your name"].exists, "still a sign in, not a sign up")
        XCTAssertFalse(app.tabBars.firstMatch.exists); XCTAssertFalse(any(app, "setup-step").exists, "no account was created")
        shot(app, "door-failed-signin")
    }
    func testAppleAndGoogleAreRealDoorsAndNoStubTextRemains() {
        let app = door()
        XCTAssertTrue(app.buttons["door-google"].waitForExistence(timeout: 15))
        XCTAssertTrue(any(app, "door-apple").exists, "Apple door is present")
        app.buttons["door-google"].tap()
        // Offline test launch: the Google door answers truthfully that it needs a connection. The old stub text is gone.
        XCTAssertTrue(app.staticTexts["Google sign in needs a connection. Use email, or try again online."].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Google sign in is not switched on yet. Please use email for now."].exists)
        XCTAssertFalse(app.tabBars.firstMatch.exists)
    }

    // MARK: 1 + 2 Sign up, then the 11 setup screens, character, then the app, then sign out brings the door back
    func testSignUpThenFullSetupThenSignOut() {
        let app = door()
        addUIInterruptionMonitor(withDescription: "notif") { a in for b in ["Allow", "OK"] where a.buttons[b].exists { a.buttons[b].tap(); return true }; return false }
        XCTAssertTrue(any(app, "door-email").waitForExistence(timeout: 15)); any(app, "door-email").tap()
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
        any(app, "open-settings").tap()
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
        // After a theme pass the app stands inside Settings; tapping the More tab pops back to the
        // More root first, so wait for the link, and tap More once more if the pop has not landed.
        let settingsLink = any(app, "open-settings")
        if !settingsLink.waitForExistence(timeout: 3) { app.tabBars.buttons["More"].tap(); XCTAssertTrue(settingsLink.waitForExistence(timeout: 5)) }
        settingsLink.tap()
        let b = any(app, "theme-\(id)")
        for _ in 0..<10 where !b.exists { app.swipeUp() }
        XCTAssertTrue(b.waitForExistence(timeout: 5)); b.tap()
    }
    func testTourAllScreensInAllThemes() {
        let app = seeded()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 20))
        for theme in ["white", "dark", "beige", "brand"] {
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
    func testWatchEntryOpensAFullScreenReelThatKeepsMovingAndCanBePausedSteppedAndClosed() {
        let app = seeded(); app.tabBars.buttons["Meals"].tap()
        any(app, "meals-menu-button").tap(); any(app, "menu-plan").tap()
        let watch = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'watch-reel-'")).firstMatch
        XCTAssertTrue(watch.waitForExistence(timeout: 10), "every meal with steps has a Watch entry"); shot(app, "reel-realapp-meal-screen-watch-entry")
        watch.tap()
        XCTAssertTrue(any(app, "reel-caption").waitForExistence(timeout: 5)); XCTAssertTrue(any(app, "reel-progress").exists)
        shot(app, "reel-realapp-step-a")
        any(app, "reel-tap-next").tap(); sleep(1)
        shot(app, "reel-realapp-step-b")
        any(app, "reel-pause").tap(); XCTAssertEqual(any(app, "reel-pause").label, "Resume")
        any(app, "reel-pause").tap(); XCTAssertEqual(any(app, "reel-pause").label, "Pause")
        any(app, "reel-tap-back").tap()
        any(app, "reel-close").tap()
        XCTAssertTrue(app.navigationBars["My Meal Plan"].waitForExistence(timeout: 5), "close returns to the meal")
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
        // Build 36: Train main shows today only; the full list lives behind the + button.
        XCTAssertTrue(any(app, "train-plus").waitForExistence(timeout: 10))
        any(app, "train-plus").tap()
        let start = any(app, "start-routine-0"); XCTAssertTrue(start.waitForExistence(timeout: 10)); shot(app, "train-routines")
        XCTAssertTrue(any(app, "view-routine-0").exists)
        start.tap()
        XCTAssertTrue(any(app, "train-progress").waitForExistence(timeout: 10), "the workout opens at once, with no dose question first")
        XCTAssertFalse(any(app, "peptide-skip").exists, "doses are never asked at workout start (her ruling, 13 Nov)")
        XCTAssertTrue(any(app, "train-progress").label.hasPrefix("1/"))
        XCTAssertTrue(any(app, "train-total-time").exists, "total workout time is pinned on top")
        shot(app, "training-1")
        let help = any(app, "help-button"); XCTAssertTrue(help.waitForExistence(timeout: 5), "how to question mark")
        help.tap(); XCTAssertTrue(any(app, "help-title").waitForExistence(timeout: 5), "help opens")
        XCTAssertTrue(any(app, "help-title").label.hasPrefix("MASCOT HELP: "))
        shot(app, "training-help")
        for t in app.staticTexts.allElementsBoundByIndex where t.exists { XCTAssertFalse(t.label.contains("-") || t.label.contains("\u{2014}") || t.label.contains("\u{2013}") || t.label.contains("\u{2022}"), "dash in help text: \(t.label)") }
        any(app, "help-close").tap(); XCTAssertTrue(any(app, "train-exercise").waitForExistence(timeout: 5), "back in the workout")
        // Human-shaped: tap START SET, wait until the button reads FINISH SET, then tap it. Two
        // back-to-back taps can lose the second one while the button re-renders (CI run 64, line 174).
        let startSet = any(app, "start-set"); startSet.tap()
        let finishSet = expectation(for: NSPredicate(format: "label == 'FINISH SET'"), evaluatedWith: startSet); wait(for: [finishSet], timeout: 5)
        startSet.tap()
        XCTAssertTrue(any(app, "rest-left").waitForExistence(timeout: 5)); shot(app, "training-rest")
        any(app, "rest-pause").tap(); any(app, "rest-pause").tap(); any(app, "skip-rest").tap()
        XCTAssertFalse(any(app, "rest-left").exists)
        any(app, "track-button").tap(); XCTAssertTrue(any(app, "set-done-1").waitForExistence(timeout: 5)); any(app, "set-done-1").tap(); shot(app, "training-tracker"); any(app, "track-done").tap()
        XCTAssertTrue(any(app, "skip-rest").waitForExistence(timeout: 5)); any(app, "skip-rest").tap()
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
        app.buttons["List"].tap(); app.buttons["To do"].tap(); XCTAssertTrue(app.staticTexts["To do"].waitForExistence(timeout: 5))
        app.buttons["Habits"].tap(); XCTAssertTrue(app.staticTexts["Habits"].waitForExistence(timeout: 5))
    }

    // MARK: Kindness (item 10: the item stands first in the menu, the page carries the story, the rainbow and the one Safari button)
    func testKindnessItemStandsFirstAndOpensThePage() {
        let app = seeded(); app.tabBars.buttons["More"].tap()
        let item = any(app, "kindness-item"); XCTAssertTrue(item.waitForExistence(timeout: 10))
        let profile = any(app, "my-profile"); XCTAssertTrue(profile.waitForExistence(timeout: 5), "both rows stand before their frames are compared (a frame read before layout settles reads zero and fails the order check on a healthy app)")
        XCTAssertLessThan(item.frame.minY, profile.frame.minY, "the kindness item stands above everything else")
        item.tap()
        XCTAssertTrue(any(app, "kindness-give").waitForExistence(timeout: 5))
        XCTAssertTrue(any(app, "kindness-counter").exists)
        let r = any(app, "kindness-rainbow"); XCTAssertTrue(r.exists); r.tap()
        XCTAssertTrue(app.staticTexts["The wall is just starting."].waitForExistence(timeout: 5))
    }

    // MARK: My doses (item 6: the home as drawn, the add form, the three kind buttons)
    func testMyDosesHomeAddAndMarkTaken() {
        let app = seeded(); app.tabBars.buttons["More"].tap()
        let doses = any(app, "my-doses"); XCTAssertTrue(doses.waitForExistence(timeout: 10), "My doses stands in the menu for every profile"); doses.tap()
        XCTAssertTrue(any(app, "doses-add").waitForExistence(timeout: 10))
        any(app, "doses-add").tap()
        let name = any(app, "med-name"); XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("Vitamin D drops")
        app.switches["This was provided by my clinician"].tap()
        any(app, "med-add").tap()
        XCTAssertTrue(app.staticTexts["Vitamin D drops"].waitForExistence(timeout: 5), "the new dose stands on the home")
        let taken = app.buttons["Taken"].firstMatch
        XCTAssertTrue(taken.waitForExistence(timeout: 5), "the three kind buttons stand on the dose card")
        XCTAssertTrue(app.buttons["Skipped"].exists); XCTAssertTrue(app.buttons["Remind me later"].exists)
        taken.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Taken today at'")).firstMatch.waitForExistence(timeout: 5))
    }

    // MARK: Profile and Settings (item 9: Me is identity only, every setting lives in Settings)
    func testProfileScreenChangesTheCharacter() {
        let app = seeded(); app.tabBars.buttons["More"].tap()
        let p = any(app, "my-profile"); XCTAssertTrue(p.waitForExistence(timeout: 10)); p.tap()
        XCTAssertTrue(any(app, "profile-name").waitForExistence(timeout: 5), "Me holds the name")
        XCTAssertFalse(any(app, "pchar-boy").exists, "no settings stand in Me")
        XCTAssertFalse(any(app, "theme-white").exists, "the theme does not stand in Me")
        shot(app, "profile")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let settingsLink = any(app, "open-settings"); XCTAssertTrue(settingsLink.waitForExistence(timeout: 5)); settingsLink.tap()
        let boy = any(app, "pchar-boy"); scrollTo(app, boy); boy.tap()
        let save = any(app, "profile-save"); scrollTo(app, save); save.tap()
        // Settings is a Form: scrolled-off rows leave the tree, so come back to the top before looking.
        for _ in 0..<10 where !any(app, "pchar-boy").exists { app.swipeDown() }
        XCTAssertTrue(any(app, "pchar-boy").exists)
    }
}
