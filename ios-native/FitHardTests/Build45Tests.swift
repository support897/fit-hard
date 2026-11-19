import XCTest
import UIKit
@testable import Fit_Hard

@MainActor
final class Build45Tests: XCTestCase {
    func blank(_ w: CGFloat, _ h: CGFloat) -> UIImage {
        let f = UIGraphicsImageRendererFormat(); f.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: f).image { c in UIColor.gray.setFill(); c.fill(CGRect(x: 0, y: 0, width: w, height: h)) }
    }
    func testWordsPrintedOnAMachineBoostTheNameMatch() {
        XCTAssertEqual(MatchBrain.overlap("Leg Press Machine", ["leg", "press", "brand"]), 1, accuracy: 0.001)
        XCTAssertEqual(MatchBrain.overlap("Leg Press", ["curl"]), 0, accuracy: 0.001)
        XCTAssertEqual(MatchBrain.overlap("Leg Press", []), 0, accuracy: 0.001)
    }
    func testBigPhotosAreShrunkAndThreeViewsAreMade() {
        let n = MatchBrain.normalized(blank(3000, 2000))
        XCTAssertLessThanOrEqual(max(n.size.width, n.size.height), 900.5)
        XCTAssertEqual(MatchBrain.variants(blank(1200, 800)).count, 3)
    }
    func testABlankPhotoIsNeverCalledAConfidentMatch() {
        let ms = Catalog.shared.machines
        let res = MatchBrain.run(photo: blank(600, 400), refs: [], machines: ms, exNames: [:])
        XCTAssertFalse(res.confident)
        XCTAssertLessThanOrEqual(res.ranked.count, 5)
    }
    func testNoVideoFileMeansTheDrawnMotionStillShows() {
        guard let e = Catalog.shared.exercises.first else { return XCTFail("no exercises") }
        XCTAssertNil(ExerciseVideo.url(for: e, base: "no_such_clip", character: "nonbinary"))
    }
}
