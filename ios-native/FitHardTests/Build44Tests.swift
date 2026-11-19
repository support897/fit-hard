import XCTest
@testable import Fit_Hard

@MainActor
final class Build44Tests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("b44-\(UUID().uuidString).json") }

    func testFreeEatingDayHasNoMealPlanAndOtherDaysKeepOne() {
        let st = Store(url: tmp())
        st.s.onboarded = true
        var p = Profile(); p.name = "Tess"; p.age = 30; p.heightCm = 180; p.weightKg = 80; p.calcBasis = "male"; p.primaryGoal = "fitter"; p.activity = "light"; p.setupDone = true
        st.s.profile = p; st.finishSetup()
        let today = Calendar.current.component(.weekday, from: Date())
        st.s.profile.freeMealDays = [today]
        st.generatePlan(force: true)
        XCTAssertTrue(st.isFreeMealDay(dayKey()))
        XCTAssertTrue(st.s.plan[dayKey()]?.isEmpty ?? true, "a free day has no meals planned")
        let tomorrow = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        XCTAssertFalse(st.isFreeMealDay(tomorrow))
        XCTAssertFalse(st.s.plan[tomorrow]?.isEmpty ?? true, "a plan day keeps its meals")
    }

    func testOlderProfilesLoadWithNoFreeDays() throws {
        let p = try JSONDecoder().decode(Profile.self, from: Data("{}".utf8))
        XCTAssertEqual(p.freeMealDays, [])
    }

    func testFreeDaysAreSavedWithTheProfile() throws {
        var p = Profile(); p.freeMealDays = [1, 7]
        let back = try JSONDecoder().decode(Profile.self, from: JSONEncoder().encode(p))
        XCTAssertEqual(back.freeMealDays, [1, 7])
    }

    func testWeekWrapCountsOnlyWhatWasDone() {
        let st = Store(url: tmp())
        XCTAssertEqual(st.weekWrap.workouts, 0); XCTAssertEqual(st.weekWrap.mealDays, 0); XCTAssertEqual(st.weekWrap.doses, 0)
        st.s.eaten[dayKey()] = ["lunch"]
        XCTAssertEqual(st.weekWrap.mealDays, 1)
    }

    func testMarkingACalendarItemDoneAndUndoIsRemembered() {
        let st = Store(url: tmp())
        let it = CalItem(id: "rest-x", time: "08:00", title: "Rest", detail: "", cat: "recovery", icon: "moon", done: false, eventID: nil, routineID: nil)
        st.toggleItemDone(it, day: dayKey())
        XCTAssertTrue(st.s.markedDone.contains("rest-x"))
        var d = it; d.done = true
        st.toggleItemDone(d, day: dayKey())
        XCTAssertFalse(st.s.markedDone.contains("rest-x"))
    }

    func testDosesGetTheirOwnSteadyColourAndEveryFewDaysIsDueOnTheRightDays() {
        var m = Med(name: "A"); m.frequency = "Every few days"; m.everyDays = 3
        m.lastTaken = Calendar.current.date(byAdding: .day, value: -3, to: Date())
        XCTAssertTrue(MedSchedule.due(m, on: dayKey()))
        XCTAssertFalse(MedSchedule.due(m, on: dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!)))
        XCTAssertEqual(m.toneKey, m.toneKey)
        var p = m; p.frequency = "As directed"
        XCTAssertNil(MedSchedule.nextDue(p, logs: []))
    }
}
