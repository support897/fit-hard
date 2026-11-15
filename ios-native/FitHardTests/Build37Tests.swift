import XCTest
@testable import Fit_Hard

/// Build 37, My Doses: the pick list carries names and how-often starting picks
/// only — never an amount. A weekly dose stands on the calendar on Mondays
/// alone and rings on Mondays alone; a daily one stands and rings every day.
@MainActor
final class Build37Tests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("b37-\(UUID().uuidString).json") }
    func ready() -> Store {
        let st = Store(url: tmp())
        st.s.onboarded = true
        var p = Profile(); p.name = "Tess"; p.age = 30; p.heightCm = 170; p.weightKg = 70
        p.primaryGoal = "fitter"; p.experience = "intermediate"; p.setupDone = true
        st.s.profile = p; st.finishSetup()
        return st
    }
    /// This week's Monday and Tuesday, as day keys.
    func mondayTuesday() -> (String, String) {
        var comps = Calendar.current.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())
        comps.weekday = 2
        let monday = Calendar.current.date(from: comps)!
        let tuesday = Calendar.current.date(byAdding: .day, value: 1, to: monday)!
        return (dayKey(monday), dayKey(tuesday))
    }

    func testCatalogueNamesAreUniqueAndDefaultsAreReal() {
        let all = DoseCatalog.all
        XCTAssertGreaterThanOrEqual(all.count, 60, "the list is a big one, as she asked")
        XCTAssertEqual(Set(all.map { $0.name }).count, all.count, "no name stands twice")
        let freqs: Set<String> = ["Once a day", "Twice a day", "Weekly", "As directed"]
        for item in all {
            XCTAssertTrue(freqs.contains(item.frequency), "\(item.name) carries a real frequency")
            XCTAssertFalse(item.times.isEmpty, "\(item.name) carries at least one time")
            if item.frequency == "Twice a day" { XCTAssertEqual(item.times.count, 2, "\(item.name) is twice a day, so two times") }
            for t in item.times {
                let bits = t.split(separator: ":")
                XCTAssertEqual(bits.count, 2, "\(item.name) time \(t) is HH:mm")
                XCTAssertTrue(Int(bits[0]).map { (0...23).contains($0) } ?? false)
                XCTAssertTrue(Int(bits[1]).map { (0...59).contains($0) } ?? false)
            }
        }
        XCTAssertTrue(all.contains { $0.name == "Mounjaro" && $0.frequency == "Weekly" })
        XCTAssertTrue(all.contains { $0.name == "Ozempic" && $0.frequency == "Weekly" })
        XCTAssertTrue(all.contains { $0.name == "Saxenda" && $0.frequency == "Once a day" }, "Saxenda is once daily on its FDA label")
        XCTAssertTrue(all.contains { $0.name == "Magnesium" })
        XCTAssertTrue(all.contains { $0.name == "Fish oil" })
    }

    func testWeeklyDoseStandsOnTheCalendarOnMondaysOnly() {
        let st = ready()
        st.s.meds = [Med(name: "Ozempic", amount: "", frequency: "Weekly", times: ["08:00"])]
        let (mon, tue) = mondayTuesday()
        XCTAssertTrue(st.calItems(on: mon).contains { $0.id.hasPrefix("med-") }, "the weekly dose stands on Monday")
        XCTAssertFalse(st.calItems(on: tue).contains { $0.id.hasPrefix("med-") }, "and not on Tuesday")
    }

    func testDailyDoseStandsEveryDay() {
        let st = ready()
        st.s.meds = [Med(name: "Magnesium", amount: "", frequency: "Once a day", times: ["21:00"])]
        let (mon, tue) = mondayTuesday()
        XCTAssertTrue(st.calItems(on: mon).contains { $0.id.hasPrefix("med-") })
        XCTAssertTrue(st.calItems(on: tue).contains { $0.id.hasPrefix("med-") })
    }

    func testNotifierRingsWeeklyOnMondayAndDailyEveryDay() {
        let st = ready()
        let weekly = Med(name: "Ozempic", amount: "", frequency: "Weekly", times: ["08:00"])
        let daily = Med(name: "Magnesium", amount: "", frequency: "Once a day", times: ["21:00"])
        st.s.meds = [weekly, daily]
        let plan = Notifier.plan(st.s)
        let w = plan.first { $0.id == "med-\(weekly.id.uuidString)-0" }
        let d = plan.first { $0.id == "med-\(daily.id.uuidString)-0" }
        XCTAssertEqual(w?.comps.weekday, 2, "the weekly reminder carries Monday")
        XCTAssertNil(d?.comps.weekday, "the daily reminder carries no weekday, so it rings every day")
        XCTAssertEqual(w?.comps.hour, 8); XCTAssertEqual(d?.comps.hour, 21)
    }
}
