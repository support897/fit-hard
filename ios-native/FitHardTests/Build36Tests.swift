import XCTest
@testable import Fit_Hard

/// Build 36, item C: the adaptation reads the person's own logs and nothing else;
/// the block machinery compares like with like. Each test crafts its logs by hand,
/// so a wrong verdict names the exact rule that broke.
@MainActor
final class Build36Tests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("b36-\(UUID().uuidString).json") }
    func ready(experience: String = "intermediate") -> Store {
        let st = Store(url: tmp())
        st.s.onboarded = true
        var p = Profile(); p.name = "Tess"; p.age = 30; p.heightCm = 170; p.weightKg = 70
        p.primaryGoal = "fitter"; p.experience = experience; p.setupDone = true
        st.s.profile = p; st.finishSetup()
        st.s.blockStart = dayKey()   // week 1 of the block unless a test moves it
        return st
    }
    func log(_ st: Store, daysAgo: Int, exercises: Int, rpe: Int? = nil, pain: Bool = false, routine: Routine? = nil) {
        let r = routine ?? st.s.routines.first!
        let date = Calendar.current.date(byAdding: .day, value: -daysAgo, to: Date())!
        let entries = r.exIds.prefix(exercises).map { id in
            Entry(exerciseId: id, sets: [SetLog(reps: 10, kg: 20, done: true, rpe: rpe)], painFlag: pain ? true : nil, difficulty: nil)
        }
        st.s.workouts.append(WorkoutLog(date: date, entries: Array(entries), seconds: 1800, routineId: r.id.uuidString, routineName: r.name))
    }

    func testBadFeelingMakesTodayLight() {
        let st = ready(); st.s.checkins[st.today] = "bad"
        XCTAssertEqual(st.todaysAdaptation().kind, .light)
        XCTAssertTrue(st.todaysAdaptation().reason?.contains("Bad") ?? false)
    }
    func testPainLastTimeMakesTodayLightEvenOnAGreatDay() {
        let st = ready(); log(st, daysAgo: 1, exercises: st.s.routines.first!.exIds.count, pain: true)
        st.s.checkins[st.today] = "great"
        XCTAssertEqual(st.todaysAdaptation().kind, .light, "pain is never pushed through")
    }
    func testGreatAndFinishedUnlocksOneSmallPush() {
        let st = ready(); log(st, daysAgo: 1, exercises: st.s.routines.first!.exIds.count, rpe: 7)
        st.s.checkins[st.today] = "great"
        XCTAssertEqual(st.todaysAdaptation().kind, .push)
    }
    func testGreatButUnfinishedStaysPlanned() {
        let st = ready(); log(st, daysAgo: 1, exercises: 1, rpe: 7)
        st.s.checkins[st.today] = "great"
        XCTAssertEqual(st.todaysAdaptation().kind, .asPlanned)
    }
    func testOkButUnfinishedSoftensToLight() {
        let st = ready(); log(st, daysAgo: 1, exercises: 1)
        st.s.checkins[st.today] = "ok"
        XCTAssertEqual(st.todaysAdaptation().kind, .light)
    }
    func testOkButVeryHardEffortSoftensToLight() {
        let st = ready(); log(st, daysAgo: 1, exercises: st.s.routines.first!.exIds.count, rpe: 10)
        st.s.checkins[st.today] = "ok"
        XCTAssertEqual(st.todaysAdaptation().kind, .light)
    }
    func testOkAndFinishedStaysPlanned() {
        let st = ready(); log(st, daysAgo: 1, exercises: st.s.routines.first!.exIds.count, rpe: 7)
        st.s.checkins[st.today] = "ok"
        XCTAssertEqual(st.todaysAdaptation().kind, .asPlanned)
    }
    func testDeloadWeekReadsDeload() {
        let st = ready(experience: "advanced")   // blockLength 4
        st.s.blockStart = dayKey(Calendar.current.date(byAdding: .day, value: -21, to: Date())!)
        XCTAssertEqual(st.blockWeek, 4)
        XCTAssertEqual(st.todaysAdaptation().kind, .deload)
    }
    func testBeginnerBlockRunsSixWeeks() {
        let st = ready(experience: "beginner")
        XCTAssertEqual(st.blockLength, 6)
        st.s.blockStart = dayKey(Calendar.current.date(byAdding: .day, value: -21, to: Date())!)
        XCTAssertEqual(st.todaysAdaptation().kind, .asPlanned, "week 4 of 6 is not the deload week")
    }
    func testFullPlanTapStandsAdaptationDown() {
        let st = ready(); st.s.checkins[st.today] = "bad"
        st.s.fullPlanDays.append(st.today)
        XCTAssertEqual(st.todaysAdaptation().kind, .asPlanned)
    }
    func testSwapTodayWinsOverTheWeekdayPlan() {
        let st = ready()
        guard st.s.routines.count > 1 else { return XCTFail("seed should build more than one routine") }
        let other = st.s.routines[1]
        st.s.dayRoutine[st.today] = other.id.uuidString
        XCTAssertEqual(st.routine(on: st.today)?.id, other.id)
    }
    func testTotalWorkComesFromTheLogsAlone() {
        let st = ready(); log(st, daysAgo: 1, exercises: 2)   // 2 entries x 1 set x 10 reps x 20 kg
        XCTAssertEqual(st.totalWorkAll, 400)
    }
    func testNextBlockSnapshotsTheFinishedBlockOnce() {
        let st = ready()
        st.s.blockStart = dayKey(Calendar.current.date(byAdding: .day, value: -2, to: Date())!)
        log(st, daysAgo: 1, exercises: 2)
        st.nextBlock()
        XCTAssertEqual(st.s.blockHistory.count, 1)
        XCTAssertEqual(st.s.blockHistory.first?.sessions, 1)
        XCTAssertEqual(st.s.blockHistory.first?.totalWork, 400)
        st.nextBlock()
        XCTAssertEqual(st.s.blockHistory.count, 2, "each finished block is snapshotted exactly once")
    }
}
