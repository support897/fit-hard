import XCTest

/// TEMPORARY probe (build 37): dump the exact elements the Watch and
/// Taken queries return, with frames and hittability, at the failure moments.
/// Restored after the 15 Nov waiver ship with the /tmp/fh-shots folder cure:
/// the folder is created first, because the run-86 probe crashed on its absence.
final class ProbeTests: XCTestCase {
    func seeded() -> XCUIApplication {
        let app = XCUIApplication(); app.launchArguments += ["-uiTestSeed", "-uiTestOffline"]; app.launch(); return app
    }
    func any(_ app: XCUIApplication, _ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    func tab(_ app: XCUIApplication, _ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    func makeShotsFolder() { try? FileManager.default.createDirectory(atPath: "/tmp/fh-shots", withIntermediateDirectories: true) }

    func testProbeWatch() {
        makeShotsFolder()
        let app = seeded()
        tab(app, "tab-meals").tap()
        any(app, "meals-menu-button").tap(); any(app, "menu-plan").tap(); sleep(3)
        var out = "WATCH ELEMENTS\n"
        let watches = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'watch-reel-'")).allElementsBoundByIndex
        out += "count=\(watches.count)\n"
        for (i, e) in watches.prefix(8).enumerated() {
            out += "[\(i)] id=\(e.identifier) frame=\(e.frame) hittable=\(e.isHittable) exists=\(e.exists)\n"
        }
        out += "\nFULL TREE\n" + app.debugDescription
        try! out.write(toFile: "/tmp/fh-shots/probe-watch.txt", atomically: true, encoding: .utf8)
        XCTAssertTrue(true)
    }

    func testProbeDoses() {
        makeShotsFolder()
        let app = seeded()
        tab(app, "tab-more").tap()
        let doses = any(app, "my-doses"); _ = doses.waitForExistence(timeout: 10); doses.tap()
        _ = any(app, "doses-add").waitForExistence(timeout: 10)
        any(app, "doses-add").tap()
        let name = any(app, "med-name"); _ = name.waitForExistence(timeout: 5); name.tap(); name.typeText("Vitamin D drops")
        app.switches["This was provided by my clinician"].tap()
        any(app, "med-add").tap()
        _ = app.staticTexts["Vitamin D drops"].waitForExistence(timeout: 5); sleep(2)
        var out = "DOSE BUTTONS\n"
        for label in ["Taken", "Skipped", "Remind me later"] {
            let bs = app.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex
            out += "\(label): count=\(bs.count)\n"
            for (i, e) in bs.prefix(4).enumerated() {
                out += "[\(i)] frame=\(e.frame) hittable=\(e.isHittable) exists=\(e.exists)\n"
            }
        }
        out += "\nFULL TREE\n" + app.debugDescription
        try! out.write(toFile: "/tmp/fh-shots/probe-doses.txt", atomically: true, encoding: .utf8)
        XCTAssertTrue(true)
    }
}
