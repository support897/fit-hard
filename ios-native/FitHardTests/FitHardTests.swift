import XCTest
@testable import Fit_Hard

@MainActor
final class FitHardTests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("t-\(UUID().uuidString).json") }
    func ready(_ f: (inout AppState) -> Void = { _ in }) -> Store {
        let st = Store(url: tmp())
        st.s.onboarded = true; st.s.profile.name = "Tess"
        f(&st.s)
        return st
    }

    // Data assets
    func testCatalogCounts() {
        let c = Catalog.shared
        XCTAssertEqual(c.recipes.count, 1089)
        XCTAssertEqual(c.exercises.count, 871)
        XCTAssertEqual(c.machines.count, 36)
        XCTAssertFalse(c.ingredients.all.isEmpty)
        XCTAssertTrue(c.recipes.allSatisfy { $0.kcal > 0 && !$0.steps.isEmpty && !$0.ingredients.isEmpty })
    }

    // Journey: set allergy -> generate meals -> excluded items never appear
    func testEveryAllergyIsExcludedFromCandidatesPlanSwapsAndShopping() {
        for a in Lists.allergens {
            let st = ready { $0.profile.allergens = [a.id] }
            for m in Lists.meals { XCTAssertFalse(st.recipes(for: m).isEmpty, "no \(m) left for \(a.id)") }
            st.generatePlan()
            for (day, row) in st.s.plan {
                for (meal, rid) in row {
                    XCTAssertFalse(st.cat.recipe(rid)!.allergens.contains(a.id), "\(a.id) in plan")
                    st.swap(day: day, meal: meal)
                    XCTAssertFalse(st.cat.recipe(st.s.plan[day]![meal]!)!.allergens.contains(a.id), "\(a.id) after swap")
                }
            }
            let tagged = Set(st.cat.recipes.filter { $0.allergens.contains(a.id) }.flatMap { $0.ingredients.map { $0.name } })
            let allowed = Set(st.cat.recipes.filter { !$0.allergens.contains(a.id) }.flatMap { $0.ingredients.map { $0.name } })
            let onlyBad = tagged.subtracting(allowed)
            // Shopping list is built only from planned recipes, so no excluded-only ingredient can be on it.
            let planned = Set(st.s.plan.values.flatMap { $0.values }.compactMap { st.cat.recipe($0) }.flatMap { $0.ingredients.map { $0.name } })
            for bad in onlyBad { XCTAssertFalse(planned.contains(bad), "\(bad) in planned ingredients for \(a.id)") }
            let items = st.groceries().flatMap { $0.items }
            XCTAssertFalse(items.isEmpty); XCTAssertLessThanOrEqual(items.count, planned.count + 5)
        }
    }

    func testVegetarianNeverGetsMeat() {
        let st = ready { $0.profile.vegetarian = true }
        st.generatePlan()
        for (_, row) in st.s.plan { for (_, rid) in row { XCTAssertFalse(st.cat.recipe(rid)!.meat) } }
    }

    func testPlanHasSevenDaysOfThreeMeals() {
        let st = ready(); st.generatePlan()
        XCTAssertEqual(st.s.plan.count, 7)
        XCTAssertTrue(st.s.plan.values.allSatisfy { $0.count == 3 })
    }

    // Journey: fresh install -> profile -> restart -> restored
    func testStateRestoredAfterRestart() {
        let u = tmp()
        let a = Store(url: u)
        a.s.onboarded = true; a.s.profile.name = "Ilse"; a.s.profile.allergens = ["gluten"]; a.addWater(500)
        let b = Store(url: u)
        XCTAssertEqual(b.s.profile.name, "Ilse"); XCTAssertEqual(b.s.profile.allergens, ["gluten"]); XCTAssertEqual(b.waterToday, 500)
    }

    func testOlderOrEmptySavedDataStillLoads() throws {
        XCTAssertNoThrow(try JSONDecoder().decode(AppState.self, from: Data("{}".utf8)))
        let old = #"{"onboarded":true,"profile":{"name":"Old"},"water":{"2024-01-01":250},"settings":{"waterTime":"10:00"}}"#
        let s = try JSONDecoder().decode(AppState.self, from: Data(old.utf8))
        XCTAssertEqual(s.profile.name, "Old"); XCTAssertEqual(s.settings.theme, "white"); XCTAssertTrue(s.draft.isEmpty)
    }

    func testWaterNeverNegative() {
        let st = ready(); st.addWater(250); st.undoWater(250); st.undoWater(250)
        XCTAssertEqual(st.waterToday, 0)
    }

    // Journey: workout in progress survives app restart exactly once logged
    func testWorkoutDraftSurvivesRestartAndFinishClearsIt() {
        let u = tmp()
        let a = Store(url: u); a.s.onboarded = true
        let ex = a.cat.exercises[0]
        a.s.draft = [Entry(exerciseId: ex.id, sets: [SetLog(reps: 8, kg: 20)])]
        let b = Store(url: u)
        XCTAssertEqual(b.s.draft.first?.sets.first?.reps, 8)
        b.s.workouts.append(WorkoutLog(entries: b.s.draft)); b.s.draft = []
        XCTAssertEqual(Store(url: u).s.workouts.count, 1)
        XCTAssertTrue(Store(url: u).s.draft.isEmpty)
    }

    // Reminders
    func testHealthRemindersAreGenericOnLockScreenByDefault() {
        let st = ready { $0.meds = [Med(name: "SecretName", amount: "1", time: "08:00")]; $0.appts = [Appt(title: "SecretClinic", date: Date().addingTimeInterval(5 * 86400))]; $0.settings.on = ["health"] }
        let text = Notifier.plan(st.s).map { $0.title + " " + $0.body }.joined()
        XCTAssertFalse(text.contains("SecretName")); XCTAssertFalse(text.contains("SecretClinic"))
        st.s.settings.detailsOnLock = true
        let text2 = Notifier.plan(st.s).map { $0.title + " " + $0.body }.joined()
        XCTAssertTrue(text2.contains("SecretName")); XCTAssertTrue(text2.contains("SecretClinic"))
    }

    func testAppointmentGetsDayBeforeAndHourBeforeOnly() {
        let st = ready { $0.appts = [Appt(title: "A", date: Date().addingTimeInterval(3 * 86400))]; $0.settings.on = ["health"] }
        XCTAssertEqual(Notifier.plan(st.s).count, 2)
        st.s.appts = [Appt(title: "Past", date: Date().addingTimeInterval(-3600))]
        XCTAssertTrue(Notifier.plan(st.s).isEmpty)
    }

    func testEditingAReminderReplacesItAndNeverDuplicates() {
        let st = ready { $0.meds = [Med(name: "X", amount: "", time: "08:00")]; $0.settings.on = ["health"] }
        XCTAssertEqual(Notifier.plan(st.s).count, 1)
        st.s.meds[0].time = "09:30"
        let p = Notifier.plan(st.s)
        XCTAssertEqual(p.count, 1); XCTAssertEqual(p[0].comps.hour, 9); XCTAssertEqual(p[0].comps.minute, 30)
        XCTAssertEqual(Set(p.map { $0.id }).count, p.count)
    }

    func testTurnedOffGroupsScheduleNothingAndNothingBeforeOnboarding() {
        let st = ready { $0.settings.on = [] }
        XCTAssertTrue(Notifier.plan(st.s).isEmpty)
        let fresh = Store(url: tmp()); XCTAssertTrue(Notifier.plan(fresh.s).isEmpty)
    }

    func testTaskReminderOnlyForFutureUndoneTasks() {
        let tomorrow = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        let st = ready { $0.settings.on = ["tasks"]; $0.tasks = [TaskItem(title: "f", day: tomorrow, time: "10:00"), TaskItem(title: "d", day: tomorrow, time: "10:00", done: true), TaskItem(title: "p", day: "2020-01-01", time: "10:00")] }
        XCTAssertEqual(Notifier.plan(st.s).count, 1)
    }

    // Calendar
    func testCalendarShowsTaskAndMoveToTomorrowUpdatesIt() {
        let st = ready(); let t = TaskItem(title: "Call", day: st.today, time: nil); st.s.tasks = [t]
        XCTAssertEqual(st.items(on: st.today).tasks.count, 1)
        st.updateTask(t.id) { $0.day = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!) }
        XCTAssertEqual(st.items(on: st.today).tasks.count, 0)
    }

    func testRoutineTrainsOnlyOnChosenDays() {
        let st = ready { $0.profile.trainDays = [2, 4] }
        st.generateRoutine()
        for wd in [3, 5, 6, 7, 1] { XCTAssertTrue((st.s.routine[String(wd)] ?? []).isEmpty, "weekday \(wd)") }
        XCTAssertFalse((st.s.routine["2"] ?? []).isEmpty)
    }
}
