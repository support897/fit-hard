import XCTest
@testable import Fit_Hard

/// Build 56: the 17 blocked clips, the swap rule, goals, units and the plain words recipes.
@MainActor
final class Build56Tests: XCTestCase {
    func prof(_ f: (inout Profile) -> Void) -> Profile { var p = Profile(); p.setupDone = true; f(&p); return p }

    func testSeventeenHaveNoClip() {
        XCTAssertEqual(Clips.blocked.count, 17)
        for s in Clips.blocked { XCTAssertFalse(Clips.has(s), s); XCTAssertNil(Clips.cached(s), s) }
    }
    func testGainGoalIsSurplusAndMaintainIsDailyNeed() {
        let g = prof { $0.age = 28; $0.heightCm = 180; $0.weightKg = 70; $0.calcBasis = "male"; $0.activity = "moderate"; $0.primaryGoal = "gain" }
        XCTAssertEqual(NutritionService.plan(g)!.kcal, 1690 * 1.55 + 300, accuracy: 0.5)
        var m = g; m.primaryGoal = "maintain"
        XCTAssertEqual(NutritionService.plan(m)!.kcal, 1690 * 1.55, accuracy: 0.5)
        XCTAssertEqual(Lists.goals.count, Lists.goalIds.count); XCTAssertEqual(Lists.goals.count, Lists.goalIcons.count)
        XCTAssertEqual(Array(Lists.goalIds.prefix(3)), ["lose", "gain", "muscle"])
    }
    func testSwapChangesOnlyOneExercise() {
        let st = Store(url: FileManager.default.temporaryDirectory.appendingPathComponent("s-\(UUID().uuidString).json"))
        st.s.onboarded = true; st.s.profile = prof { $0.name = "Tess"; $0.age = 30; $0.heightCm = 180; $0.weightKg = 80; $0.calcBasis = "male"; $0.activity = "light"; $0.location = "gym"; $0.experience = "intermediate"; $0.trainType = "strength"; let wd = Calendar.current.component(.weekday, from: Date()); $0.trainDays = (0..<4).map { (wd - 1 + $0) % 7 + 1 }; $0.primaryGoal = "muscle" }
        st.finishSetup(); st.generateRoutine()
        guard let r = st.s.routines.first(where: { $0.exIds.count > 2 }) else { return XCTFail("no routine") }
        let old = r.exIds[1]
        guard let new = st.swapPick(old: old, day: r.exIds) else { return XCTFail("no swap pick") }
        XCTAssertNotEqual(new, old)
        XCTAssertEqual(st.cat.exercise(new)?.part, st.cat.exercise(old)?.part)
        st.swapExercise(routine: r.id, old: old, new: new)
        let after = st.s.routines.first { $0.id == r.id }!.exIds
        XCTAssertEqual(after.count, r.exIds.count)
        for i in r.exIds.indices { if i == 1 { XCTAssertEqual(after[i], new) } else { XCTAssertEqual(after[i], r.exIds[i]) } }
    }
    func testUnitsConvert() {
        XCTAssertEqual(RecipeUnits.show(100, "g", us: false), "100 g")
        XCTAssertEqual(RecipeUnits.show(100, "g", us: true), "3.5 oz")
        XCTAssertEqual(RecipeUnits.show(240, "ml", us: true), "1 cup")
        XCTAssertEqual(RecipeUnits.show(120, "ml", us: true), "1/2 cup")
    }
    func testEveryRecipeHasPlainWordsWithSameStepCount() {
        let c = Catalog.shared
        XCTAssertEqual(c.humanSteps.count, c.recipes.count)
        for r in c.recipes { XCTAssertEqual(c.humanSteps[r.id]?.count, r.steps.count, r.id) }
    }
}
