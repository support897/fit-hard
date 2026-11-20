import XCTest
@testable import Fit_Hard

@MainActor
final class Build50Tests: XCTestCase {
    func testAnonymousNoteCarriesNoEmailNameOrAccount() {
        let p = FeedbackService.payload(kind: .bug, message: "x", email: "a@b.com", name: "Ann", anonymous: true, uid: "u1", topic: "Other")
        XCTAssertEqual(p["email"], ""); XCTAssertEqual(p["name"], ""); XCTAssertEqual(p["uid"], ""); XCTAssertEqual(p["kind"], "bug")
    }
    func testNamedNoteCarriesEmailAndAccount() {
        let p = FeedbackService.payload(kind: .feedback, message: "hi", email: "a@b.com", name: "Ann", anonymous: false, uid: "u1", topic: "Idea")
        XCTAssertEqual(p["email"], "a@b.com"); XCTAssertEqual(p["uid"], "u1"); XCTAssertEqual(p["kind"], "feedback")
    }
    func testKindnessNumbersAreSane() {
        XCTAssertEqual(KindnessStats.joined, 20467)
        XCTAssertGreaterThan(KindnessStats.nextMilestone, KindnessStats.joined)
        XCTAssertEqual(GlowRainbow.colours.count, 7)
    }
    func testMyWallEntryIsKept() {
        let e = WallEntry(name: "Test Kind", message: "hello")
        KindnessWall.addMine(e)
        XCTAssertEqual(KindnessWall.mine().first, e)
    }
}
