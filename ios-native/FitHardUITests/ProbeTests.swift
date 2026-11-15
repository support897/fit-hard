import XCTest

/// TEMPORARY probe (build 37 diagnosis): dumps the seeded app's accessibility
/// tree and a screenshot into /tmp/fh-shots so the screenshots artifact carries
/// them home. Deleted once the bar finding is proven.
final class ProbeTests: XCTestCase {
    func testDumpTreeAndShot() {
        let a = XCUIApplication()
        a.launchArguments = ["-uiTestSeed", "-uiTestOffline"]
        a.launch()
        sleep(6)
        let dir = "/tmp/fh-shots"
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try? a.debugDescription.write(toFile: dir + "/tree.txt", atomically: true, encoding: .utf8)
        let png = XCUIScreen.main.screenshot().pngRepresentation
        try? png.write(to: URL(fileURLWithPath: dir + "/probe.png"))
        XCTAssertTrue(true)
    }
}
