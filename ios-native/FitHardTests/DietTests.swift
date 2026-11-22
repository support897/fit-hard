import XCTest
import SwiftUI
@testable import Fit_Hard

/// Diet (build 53): two profiles, the safe floor, and a logged photo meal updating the total and the 7 day chart.
@MainActor
final class DietTests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("d-\(UUID().uuidString).json") }
    func prof(_ f: (inout Profile) -> Void) -> Profile { var p = Profile(); p.setupDone = true; f(&p); return p }

    func testWomanLosingWeight() {
        let p = prof { $0.age = 32; $0.heightCm = 165; $0.weightKg = 70; $0.calcBasis = "female"; $0.activity = "light"; $0.primaryGoal = "lose" }
        XCTAssertEqual(NutritionService.bmr(p)!, 1410.25, accuracy: 0.01)
        let pl = NutritionService.plan(p)!
        XCTAssertEqual(pl.kcal, 1551.3, accuracy: 0.5)          // 20 percent under, because 500 would be more than 20 percent
        XCTAssertGreaterThanOrEqual(pl.kcal, 1200); XCTAssertFalse(pl.raised)
        XCTAssertLessThan(pl.weeklyKg, 0); XCTAssertGreaterThan(pl.weeklyKg, -0.5)
        XCTAssertEqual(NutritionService.targets(p)!.kcal, 1550)
    }
    func testManGainingWeight() {
        let p = prof { $0.age = 28; $0.heightCm = 180; $0.weightKg = 70; $0.calcBasis = "male"; $0.activity = "moderate"; $0.primaryGoal = "muscle" }
        XCTAssertEqual(NutritionService.bmr(p)!, 1690, accuracy: 0.01)
        let pl = NutritionService.plan(p)!
        XCTAssertEqual(pl.kcal, 1690 * 1.55 + 300, accuracy: 0.5)
        XCTAssertGreaterThan(pl.weeklyKg, 0); XCTAssertLessThan(pl.weeklyKg, 0.5)
    }
    func testNeverBelowTheSafeFloorAndMaintainIsDailyNeed() {
        let small = prof { $0.age = 50; $0.heightCm = 150; $0.weightKg = 45; $0.calcBasis = "female"; $0.activity = "sedentary"; $0.primaryGoal = "lose" }
        let pl = NutritionService.plan(small)!
        XCTAssertEqual(pl.kcal, 1200, accuracy: 0.01); XCTAssertTrue(pl.raised)
        let m = prof { $0.age = 40; $0.heightCm = 175; $0.weightKg = 80; $0.calcBasis = "male"; $0.activity = "light"; $0.primaryGoal = "fitter" }
        let mp = NutritionService.plan(m)!
        XCTAssertEqual(mp.kcal, mp.tdee, accuracy: 0.01)
        XCTAssertNil(NutritionService.plan(prof { $0.age = 16; $0.heightCm = 170; $0.weightKg = 60; $0.primaryGoal = "lose" }), "no target for under 18s")
    }
    func testTargetFollowsWeightAndGoalChanges() {
        let st = Store(url: tmp()); st.s.profile = prof { $0.age = 32; $0.heightCm = 165; $0.weightKg = 70; $0.calcBasis = "female"; $0.activity = "light"; $0.primaryGoal = "lose" }
        let a = st.targets!.kcal
        st.s.profile.weightKg = 80; XCTAssertNotEqual(st.targets!.kcal, a)
        st.s.profile.primaryGoal = "muscle"; XCTAssertGreaterThan(st.targets!.kcal, a)
    }
    func testFoodTableAndPhotoMealUpdateTotalAndChart() {
        XCTAssertGreaterThan(FoodDB.all.count, 100)
        let pizza = FoodDB.all.first { $0.n == "Pizza" }!
        let k = FoodDB.kcal(pizza, grams: pizza.g)
        XCTAssertEqual(k, Int((Double(pizza.k) * Double(pizza.g) / 100).rounded()))
        let st = Store(url: tmp())
        XCTAssertEqual(st.foodKcal(st.today), 0)
        st.addFood(pizza.n, kcal: k, grams: pizza.g, meal: "dinner", photo: true)
        st.addFood("Apple", kcal: 94, grams: 180, meal: "snack", photo: false)
        XCTAssertEqual(st.foodKcal(st.today), k + 94)
        let week = st.last7()
        XCTAssertEqual(week.count, 7); XCTAssertEqual(week.last?.day, st.today); XCTAssertEqual(week.last?.kcal, k + 94)
        XCTAssertTrue(FoodDB.search("fries").contains { $0.n == "French fries" })
    }
}
