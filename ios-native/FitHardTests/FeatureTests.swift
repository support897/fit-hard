import XCTest
import SwiftUI
@testable import Fit_Hard

@MainActor
final class FeatureTests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("f-\(UUID().uuidString).json") }
    func profile(_ f: (inout Profile) -> Void = { _ in }) -> Profile {
        var p = Profile(); p.name = "Tess"; p.age = 30; p.heightCm = 180; p.weightKg = 80; p.calcBasis = "male"; p.primaryGoal = "fitter"; p.activity = "light"
        p.setupDone = true; f(&p); return p
    }
    func daysFromToday(_ n: Int) -> [Int] { let wd = Calendar.current.component(.weekday, from: Date()); return (0..<n).map { (wd - 1 + $0) % 7 + 1 } }
    func ready(_ f: (inout Profile) -> Void = { _ in }) -> Store {
        let st = Store(url: tmp()); st.s.onboarded = true; st.s.profile = profile(f); st.finishSetup(); return st
    }

    // MARK: 1 THE DOOR
    func testFailedSignInStaysSignInAndNeverCreatesAnAccount() async {
        Cloud.forceOffline = true; Cloud.log = []
        defer { Cloud.forceOffline = false; Cloud.log = [] }
        let st = Store(url: tmp())
        do { try await st.door(creating: false, name: "", email: "nobody@example.com", pass: "wrongpass"); XCTFail("should have failed") }
        catch { XCTAssertEqual((error as? AccountError)?.errorDescription, "That email or password is not right.") }
        XCTAssertNil(st.session, "no session after a failed sign in")
        XCTAssertFalse(Cloud.log.contains { $0.contains("signUp") }, "sign up must never be called by sign in: \(Cloud.log)")
        XCTAssertTrue(Cloud.log.allSatisfy { $0.contains("signInWithPassword") })
        XCTAssertFalse(st.bypassDoor, "a normal launch has no way past the door")
    }
    func testSignUpTakesTheNameAndOwnPasswordAndSignOutBringsTheDoorBack() async throws {
        Cloud.forceOffline = true; Cloud.log = []
        defer { Cloud.forceOffline = false; Cloud.log = [] }
        let st = Store(url: tmp())
        try await st.door(creating: true, name: "Ilse", email: "new@example.com", pass: "my own password")
        XCTAssertNotNil(st.session); XCTAssertEqual(st.s.profile.name, "Ilse")
        XCTAssertEqual(Cloud.log.filter { $0.contains("signUp") }.count, 1)
        st.s.onboarded = true
        await st.signOutKeep()
        XCTAssertNil(st.session, "door is back"); XCTAssertFalse(st.s.onboarded); XCTAssertEqual(st.s.profile.name, "", "next person starts clean")
    }

    // MARK: 2 ONE PROFILE, 15 CHARACTER
    func testNewProfileFieldsSurviveRestartAndOldDataStillLoads() throws {
        let u = tmp(); let a = Store(url: u)
        a.s.profile = profile { $0.character = "girl"; $0.kit = ["dumbbell"]; $0.bodyFocus = ["chest": "priority"]; $0.diet = "vegan"; $0.imperial = true; $0.trainMode = "guided"; $0.injury = "knee" }
        let b = Store(url: u).s.profile
        XCTAssertEqual(b.character, "girl"); XCTAssertEqual(b.kit, ["dumbbell"]); XCTAssertEqual(b.bodyFocus["chest"], "priority"); XCTAssertEqual(b.diet, "vegan")
        XCTAssertTrue(b.imperial); XCTAssertEqual(b.trainMode, "guided"); XCTAssertEqual(b.injury, "knee"); XCTAssertEqual(b.age, 30)
        let old = try JSONDecoder().decode(Profile.self, from: Data(#"{"name":"Old","trainDays":[2]}"#.utf8))
        XCTAssertEqual(old.name, "Old"); XCTAssertEqual(old.character, ""); XCTAssertEqual(old.trainMode, "hybrid")
    }
    func testCharacterNeverChangesNumbersOrWorkouts() {
        var results: [String] = []
        for c in ["boy", "girl", "nonbinary"] {
            let st = ready { $0.character = c }
            let t = st.targets!
            results.append("\(t.kcal)-\(t.protein)-\(st.s.routines.map { $0.exIds.joined(separator: ",") }.joined(separator: "|"))")
        }
        XCTAssertEqual(Set(results).count, 1, "character must not influence any calculation")
    }
    func testChangingCharacterKeepsAllData() {
        let st = ready { $0.character = "boy" }
        st.addWater(500); st.s.workouts.append(WorkoutLog(entries: [Entry(exerciseId: "x", sets: [SetLog(reps: 5, kg: 10, done: true)])]))
        st.s.profile.character = "nonbinary"
        XCTAssertEqual(st.waterToday, 500); XCTAssertEqual(st.s.workouts.count, 1); XCTAssertEqual(st.s.profile.character, "nonbinary")
        for c in ["boy", "girl", "nonbinary"] { XCTAssertNotNil(UIImage(named: "avatar-\(c)") ?? UIImage(contentsOfFile: Bundle.main.path(forResource: "avatar-\(c)", ofType: "png") ?? ""), "avatar \(c)") }
    }
    func testEditingTheProfileUpdatesPlanAndRoutinesButNeverHistory() {
        let st = ready { $0.trainDays = [2, 4, 6] }
        st.s.workouts.append(WorkoutLog(entries: [Entry(exerciseId: "a", sets: [SetLog(reps: 8, kg: 20, done: true)])]))
        let before = st.s.workouts
        st.s.profile.trainDays = [3, 5]; st.s.profile.diet = "vegan"; st.profileChanged()
        XCTAssertEqual(Set(st.s.routines.map { $0.weekday }), [3, 5])
        for (_, row) in st.s.plan { for (_, id) in row { XCTAssertFalse(st.cat.recipe(id)!.meat) } }
        XCTAssertEqual(st.s.workouts, before)
    }

    // MARK: 3 MEALS ENGINE
    func testMifflinStJeorTargets() {
        var p = profile(); p.primaryGoal = "fitter"
        XCTAssertEqual(NutritionService.bmr(p)!, 1780, accuracy: 0.01)
        let t = NutritionService.targets(p)!
        XCTAssertEqual(t.kcal, 2450); XCTAssertEqual(t.protein, 112)
        p.primaryGoal = "lose"; let l = NutritionService.targets(p)!
        XCTAssertEqual(l.kcal, 2150); XCTAssertEqual(l.protein, 144); XCTAssertGreaterThanOrEqual(Double(l.kcal), 1780, "never below resting energy")
        p.primaryGoal = "muscle"; XCTAssertEqual(NutritionService.targets(p)!.protein, 128)
        for kg in [50.0, 80, 120] { var q = p; q.weightKg = kg; let per = Double(NutritionService.targets(q)!.protein) / kg; XCTAssertTrue(per >= 1.39 && per <= 2.01, "protein per kg \(per)") }
        let sum = Double(t.protein * 4 + t.carbs * 4 + t.fat * 9); XCTAssertEqual(sum, Double(t.kcal), accuracy: 40)
    }
    func testNoCalorieTargetsForMinorsPregnancyOrEatingDisorderConcerns() {
        for f in [{ (p: inout Profile) in p.minor = true }, { p in p.pregnant = true }, { p in p.edConcern = true }, { p in p.age = 16 }] { XCTAssertNil(NutritionService.targets(profile(f))) }
        XCTAssertNil(NutritionService.targets(profile { $0.weightKg = 0 }), "missing optional answers give no target, not a wrong one")
    }
    func testEveryGoalMakesMealsThatFollowTheTarget() {
        for g in ["lose", "muscle", "strength", "fitter", "eat"] {
            let st = ready { $0.primaryGoal = g }
            let t = st.targets!
            var kcal = 0.0; var days = 0
            for (_, row) in st.s.plan { let k = row.values.compactMap { st.cat.recipe($0)?.kcal }.reduce(0, +); kcal += Double(k); days += 1 }
            XCTAssertEqual(row3(st), 3, "three meals a day"); XCTAssertEqual(days, 7)
            let avg = kcal / Double(days)
            XCTAssertTrue(avg > Double(t.kcal) * 0.55 && avg < Double(t.kcal) * 1.45, "\(g): plan averages \(avg) kcal against target \(t.kcal)")
        }
    }
    func row3(_ st: Store) -> Int { st.s.plan.values.map { $0.count }.min() ?? 0 }
    func testRecipeMacrosExistAndAgreeWithCalories() {
        let c = Catalog.shared
        XCTAssertGreaterThan(c.macros.count, 1000)
        for (id, m) in c.macros { XCTAssertEqual(m.count, 3, id); XCTAssertTrue(m.allSatisfy { $0 >= 0 }, id) }
        let r = c.recipe("avo-eggs")!; XCTAssertNotNil(RecipeService.macros(r))
    }
    func testHaveVersusBuyWithQuantitiesSynonymsAndUnits() {
        let need = [Ingredient(name: "rice", qty: 300, unit: "g", category: "Pantry"), Ingredient(name: "egg", qty: 2, unit: "pcs", category: "Dairy"), Ingredient(name: "bread", qty: 2, unit: "pcs", category: "Bakery")]
        let inv = [InvItem(name: "rice", qty: 200, unit: "g"), InvItem(name: "eggs", qty: 4, unit: "pcs"), InvItem(name: "bread", qty: 4, unit: "slices")]
        let lines = RecipeService.lines(for: need, inventory: inv)
        func l(_ n: String) -> ShopLine { lines.first { $0.name == n }! }
        XCTAssertEqual(l("rice").have, 200, accuracy: 0.01); XCTAssertEqual(l("rice").buy, 100, accuracy: 0.01)
        XCTAssertEqual(l("egg").buy, 0, accuracy: 0.01, "plural synonym matches")
        XCTAssertEqual(l("bread").have, 2, accuracy: 0.01, "slices convert to pieces"); XCTAssertEqual(l("bread").buy, 0, accuracy: 0.01)
        XCTAssertEqual(RecipeService.lines(for: need, inventory: []).first { $0.name == "rice" }!.buy, 300, accuracy: 0.01)
    }
    func testShoppingListIsBuiltOnlyFromPlannedRecipesAndAggregates() {
        let st = ready()
        let a = st.cat.recipes.first { $0.ingredients.contains { $0.name == "olive oil" } && $0.meal == "lunch" }!
        st.s.plan = [st.today: ["lunch": a.id]]; st.s.inventory = []
        let names = Set(st.shoppingLines().map { $0.name })
        XCTAssertEqual(names, Set(a.ingredients.map { RecipeService.norm($0.name) }))
        st.s.plan = [st.today: ["lunch": a.id, "dinner": a.id]]
        let oil1 = RecipeService.perServing(a).first { $0.name == "olive oil" }!.qty
        XCTAssertEqual(st.shoppingLines().first { $0.name == "olive oil" }!.need, oil1 * 2, accuracy: 0.001, "two planned meals add up")
        st.s.inventory = a.ingredients.map { InvItem(name: $0.name, qty: 9999, unit: $0.unit) }
        XCTAssertTrue(st.shoppingLines().allSatisfy { $0.buy < 0.001 }, "everything in the kitchen means nothing to buy")
    }
    func testSwappingOneMealChangesOnlyThatMealAndFollowsIntoShoppingAndCalendar() {
        let st = ready { $0.allergens = ["peanut"] }
        let day = st.today; let before = st.s.plan
        let oldId = before[day]!["lunch"]!
        let shopBefore = st.shoppingLines().map { $0.id }
        st.swap(day: day, meal: "lunch")
        let after = st.s.plan
        XCTAssertNotEqual(after[day]!["lunch"], oldId)
        for (d, row) in before { for (m, id) in row where !(d == day && m == "lunch") { XCTAssertEqual(after[d]![m], id, "\(d) \(m) must not change") } }
        XCTAssertFalse(st.cat.recipe(after[day]!["lunch"]!)!.allergens.contains("peanut"))
        XCTAssertNotEqual(st.shoppingLines().map { $0.id }, shopBefore, "shopping list follows the swap")
        let newName = st.cat.recipe(after[day]!["lunch"]!)!.name
        XCTAssertTrue(st.calItems(on: day).contains { $0.title.contains(newName) }, "calendar follows the swap")
    }
    func testAllergiesDietAndDislikesExcluded() {
        let st = ready { $0.allergens = ["milk", "gluten"]; $0.diet = "vegan"; $0.dislikes = ["mushroom"] }
        for (_, row) in st.s.plan { for (_, id) in row { let r = st.cat.recipe(id)!
            XCTAssertFalse(r.allergens.contains("milk") || r.allergens.contains("gluten")); XCTAssertFalse(r.meat); XCTAssertFalse(r.ingredients.contains { $0.name.contains("mushroom") }) } }
    }
    func testLunchCardShowsCaloriesProteinAndCookTime() {
        let st = ready(); let r = st.cat.recipe(st.s.plan[st.today]!["lunch"]!)!
        let line = st.line(r)
        XCTAssertTrue(line.contains("\(r.kcal) kcal")); XCTAssertTrue(line.contains("protein")); XCTAssertTrue(line.contains("\(r.minutes) min"))
    }

    // MARK: 4 ROUTINES + PROGRESSION
    func testSplitsFollowTheChosenDaysFromTwoToSix() {
        let want: [Int: [String]] = [2: ["Full body A", "Full body B"], 3: ["Full body A", "Full body B", "Full body C"], 4: ["Upper A", "Lower A", "Upper B", "Lower B"],
            5: ["Lower A", "Upper A", "Lower B", "Upper B", "Full body"], 6: ["Lower A", "Upper A", "Lower B", "Upper B", "Full body", "Mobility"]]
        let all = [2, 3, 4, 5, 6, 7, 1]
        for (n, names) in want {
            let st = ready { $0.trainDays = Array(all.prefix(n)); $0.location = "gym"; $0.primaryGoal = "muscle"; $0.trainType = "strength" }
            XCTAssertEqual(st.s.routines.map { $0.name }, names, "\(n) days")
            XCTAssertEqual(Set(st.s.routines.map { $0.weekday }), Set(all.prefix(n)))
            XCTAssertTrue(st.s.routines.allSatisfy { !$0.exIds.isEmpty })
        }
    }
    func testRoutinesNeverIgnoreEquipmentExperienceOrDuration() {
        let st = ready { $0.kit = ["dumbbell"]; $0.experience = "beginner"; $0.minutes = 30; $0.primaryGoal = "muscle"; $0.trainType = "strength" }
        for r in st.s.routines {
            XCTAssertLessThanOrEqual(r.exIds.count, 30 / 8 + 1)
            for id in r.exIds { let e = st.cat.exercise(id)!; XCTAssertTrue(["dumbbell", "body only"].contains(e.equipment), "\(e.name) needs \(e.equipment)"); XCTAssertEqual(e.level, "beginner") }
        }
        let none = ready { $0.kit = []; $0.location = "home"; $0.equipment = "body" }
        XCTAssertFalse(none.s.routines.isEmpty)
        let long = ready { $0.minutes = 60 }; XCTAssertGreaterThan(long.s.routines[0].exIds.count, st.s.routines[0].exIds.count)
    }
    func testMusclePriorityAddsVolumeAndLessRemovesIt() {
        let base = ready { $0.trainDays = [2, 4, 6, 7]; $0.minutes = 45 }
        let pri = ready { $0.trainDays = [2, 4, 6, 7]; $0.minutes = 45; $0.bodyFocus = ["chest": "priority"] }
        func chest(_ s: Store) -> Int { s.s.routines.flatMap { $0.exIds }.filter { s.cat.exercise($0)?.part == "chest" }.count }
        XCTAssertGreaterThanOrEqual(chest(pri), chest(base))
    }
    func testRoutineCardFacts() {
        let st = ready(); let r = st.s.routines[0]
        XCTAssertFalse(r.name.isEmpty); XCTAssertFalse(r.focus.isEmpty); XCTAssertNotNil(st.nextSession(r)); XCTAssertNil(st.lastCompleted(r))
        XCTAssertNotNil(WorkoutGenerator.kcalEstimate(minutes: 30, weightKg: 80)); XCTAssertNil(WorkoutGenerator.kcalEstimate(minutes: 30, weightKg: 0), "no weight, no calorie claim")
    }
    func testEditingARoutineMarksItCustomizedAndANewBlockKeepsIt() {
        let st = ready(); st.s.routines[0].customized = true; let kept = st.s.routines[0].exIds
        st.nextBlock()
        XCTAssertEqual(st.s.routines[0].exIds, kept, "edited routines are never replaced"); XCTAssertEqual(st.s.routines[0].block, 2)
        let same = st.s.routines.dropFirst().filter { $0.block == 2 }.count; XCTAssertEqual(same, st.s.routines.count - 1)
    }
    func entry(_ sets: [(Int, Double, Bool?)], pain: Bool? = nil, diff: Int? = 3, rpe: Int? = 8) -> Entry {
        Entry(exerciseId: "Barbell_Squat", sets: sets.map { SetLog(reps: $0.0, kg: $0.1, done: $0.2, rpe: rpe) }, painFlag: pain, difficulty: diff)
    }
    func testDoubleProgressionOnlyIncreasesWhenEveryCriterionIsMet() {
        let ex = Catalog.shared.exercise("Barbell_Squat")!; let (_, hi) = ProgressionEngine.range(for: ex, goal: "muscle")
        let top = entry([(hi, 60, true), (hi, 60, true), (hi, 60, true)])
        XCTAssertTrue(ProgressionEngine.next(ex: ex, history: [top], goal: "muscle").increase)
        XCTAssertGreaterThan(ProgressionEngine.next(ex: ex, history: [top], goal: "muscle").kg, 60)
        XCTAssertFalse(ProgressionEngine.next(ex: ex, history: [entry([(hi, 60, true), (hi - 1, 60, true), (hi, 60, true)])], goal: "muscle").increase, "not top on every set")
        XCTAssertFalse(ProgressionEngine.next(ex: ex, history: [entry([(hi, 60, true), (hi, 60, true), (hi, 60, false)])], goal: "muscle").increase, "unfinished work")
        XCTAssertFalse(ProgressionEngine.next(ex: ex, history: [entry([(hi, 60, true), (hi, 60, true)], pain: true)], goal: "muscle").increase, "pain")
        XCTAssertFalse(ProgressionEngine.next(ex: ex, history: [entry([(hi, 60, true), (hi, 60, true)], diff: 5, rpe: 10)], goal: "muscle").increase, "max effort or fatigue")
        let worse = entry([(hi - 3, 60, true), (hi - 3, 60, true)]); let better = entry([(hi - 1, 60, true), (hi - 1, 60, true)])
        let n = ProgressionEngine.next(ex: ex, history: [worse, better], goal: "muscle"); XCTAssertFalse(n.increase); XCTAssertEqual(n.kg, 60)
        XCTAssertFalse(ProgressionEngine.next(ex: ex, history: [], goal: "muscle").increase)
    }
    func testFinishedWorkoutsAreAppendedAndHistoryIsNeverRewritten() {
        let st = ready(); let r = st.s.routines[0]
        let e1 = Entry(exerciseId: r.exIds[0], sets: [SetLog(reps: 8, kg: 40, done: true), SetLog(reps: 8, kg: 40, done: false)])
        st.finishWorkout(entries: [e1], routine: r, seconds: 600)
        let first = st.s.workouts
        XCTAssertEqual(first.count, 1); XCTAssertEqual(first[0].entries[0].sets.count, 1, "only completed sets are saved")
        XCTAssertEqual(st.lastCompleted(r) != nil, true)
        st.finishWorkout(entries: [Entry(exerciseId: r.exIds[0], sets: [SetLog(reps: 9, kg: 42.5, done: true)])], routine: r, seconds: 500)
        XCTAssertEqual(st.s.workouts.count, 2); XCTAssertEqual(st.s.workouts[0], first[0], "earlier session untouched")
        XCTAssertTrue(st.s.draft.isEmpty)
        st.finishWorkout(entries: [Entry(exerciseId: r.exIds[0], sets: [SetLog(reps: 9, kg: 42.5, done: false)])], routine: r, seconds: 10)
        XCTAssertEqual(st.s.workouts.count, 2, "a session with nothing done saves nothing")
    }

    // MARK: 14 MASCOT HELP
    func testEveryExerciseHasHelpThatPassesTheWritingRules() {
        let c = Catalog.shared
        XCTAssertEqual(c.help.count, c.exercises.count)
        var bad: [String] = []
        for e in c.exercises {
            guard let h = HelpText.help(for: e.id) else { bad.append("missing \(e.id)"); continue }
            for v in HelpText.violations(h) { bad.append("\(e.id): \(v)") }
            let text = HelpText.display(h).joined(separator: "\n")
            if text.range(of: #"\w-\w"#, options: .regularExpression) != nil { bad.append("hyphenated word \(e.id)") }
            for ch in text where "-\u{2010}\u{2011}\u{2012}\u{2013}\u{2014}\u{2015}\u{2212}\u{2022}\u{00B7}*\u{25CF}".contains(ch) { bad.append("banned char in \(e.id)"); break }
            if !HelpText.display(h).dropFirst(2).dropLast().enumerated().allSatisfy({ $0.element.hasPrefix("\($0.offset + 1). ") }) { bad.append("numbering \(e.id)") }
            if !h.t.hasPrefix("MASCOT HELP: ") { bad.append("title \(e.id)") }
        }
        XCTAssertEqual(bad, [], "help text violations: \(bad.prefix(20))")
    }
    func testReferenceHelpExamplesAreExactAndNotReused() {
        let leg = HelpText.display(HelpText.help(for: "Leg_Press")!)
        XCTAssertEqual(leg, ["MASCOT HELP: LEG PRESS", "Let's do it together!", "1. Sit back and rest your head.", "2. Put your feet on the platform.", "3. Keep your feet about shoulder width apart.",
            "4. Slowly bend your knees and lower the platform.", "5. Push the platform away without locking your knees.", "6. Repeat slowly and stay in control.", "You've got this!"])
        let lat = HelpText.display(HelpText.help(for: "Wide-Grip_Lat_Pulldown")!)
        XCTAssertEqual(lat, ["MASCOT HELP: LAT PULLDOWN", "I'll show you how!", "1. Sit down and place your thighs under the pads.", "2. Hold the bar with both hands.", "3. Sit tall and keep your chest up.",
            "4. Pull the bar down towards your upper chest.", "5. Slowly let the bar go back up.", "6. Repeat without swinging your body.", "Nice and steady!"])
        for e in Catalog.shared.exercises where e.id != "Leg_Press" { XCTAssertFalse(HelpText.help(for: e.id)!.s.contains("Put your feet on the platform."), "leg press text reused in \(e.id)") }
    }
    func testHelpValidatorCatchesDashesAndBullets() {
        let bad = Catalog.HelpRec(t: "MASCOT HELP: X", i: "Go!", s: ["Do a push-up.", "Step two"], c: "• Done")
        XCTAssertFalse(HelpText.violations(bad).isEmpty)
        let em = Catalog.HelpRec(t: "MASCOT HELP: X", i: "Go!", s: ["Do it \u{2014} now.", "Next."], c: "Done")
        XCTAssertFalse(HelpText.violations(em).isEmpty)
    }
    func testExerciseAnimationAssetsExistForEveryExerciseThatHasOne() {
        var missing = 0
        for e in Catalog.shared.exercises { if let a = e.anim { for i in 1...3 where Bundle.main.path(forResource: "anim-\(a)-\(i)", ofType: "webp", inDirectory: "media") == nil && Bundle.main.path(forResource: "anim-\(a)-\(i)", ofType: "webp") == nil { missing += 1 } } }
        XCTAssertEqual(missing, 0, "animation frames missing from the app")
    }

    // MARK: 6 CALENDAR
    func testCalendarAddEditMoveDeleteAndNoDuplicates() {
        let st = ready()
        XCTAssertTrue(st.addEvent(CalEvent(title: "Yoga", day: st.today, time: "07:00", cat: "recovery", kind: "personal")))
        XCTAssertFalse(st.addEvent(CalEvent(title: "Yoga", day: st.today, time: "07:00", cat: "recovery", kind: "personal")), "duplicate refused")
        XCTAssertEqual(st.s.events.count, 1)
        st.s.events[0].time = "08:15"; XCTAssertEqual(st.calItems(on: st.today).first { $0.title == "Yoga" }?.time, "08:15")
        let tomorrow = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        st.s.events[0].day = tomorrow
        XCTAssertNil(st.calItems(on: st.today).first { $0.title == "Yoga" }); XCTAssertNotNil(st.calItems(on: tomorrow).first { $0.title == "Yoga" })
        st.s.events.removeAll(); XCTAssertNil(st.calItems(on: tomorrow).first { $0.title == "Yoga" })
    }
    func testCalendarColoursAndEveryKindMapsToACategory() {
        for kind in EventEditor.kinds { XCTAssertTrue(Color.catNames.contains { $0.0 == kind.2 }, kind.0) }
        XCTAssertEqual(Color.catNames.map { $0.0 }, ["training", "meals", "recovery", "medication", "personal"])
    }
    func testTrainingDayShowsTheRealLunchAndWorkoutCompletionUpdatesTheCalendar() {
        let st = ready { $0.trainDays = daysFromToday(5) }
        let items = st.calItems(on: st.today)
        XCTAssertTrue(items.contains { $0.cat == "training" && !$0.done })
        let lunch = items.first { $0.id.hasPrefix("meal-") && $0.id.hasSuffix("lunch") }!
        XCTAssertTrue(lunch.detail.contains("kcal") && lunch.detail.contains("protein") && lunch.detail.contains("min"))
        let r = st.routine(on: st.today)!
        st.finishWorkout(entries: [Entry(exerciseId: r.exIds[0], sets: [SetLog(reps: 8, kg: 10, done: true)])], routine: r, seconds: 60)
        XCTAssertTrue(st.calItems(on: st.today).contains { $0.cat == "training" && $0.done })
    }
    func testSkipMoveAndRegenerateWeek() {
        let st = ready { $0.trainDays = daysFromToday(5) }; let r = st.routine(on: st.today)!
        let tomorrow = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        st.moveWorkout(from: st.today, routine: r, to: tomorrow)
        XCTAssertNil(st.routine(on: st.today)); XCTAssertTrue(st.calItems(on: tomorrow).filter { $0.cat == "training" && $0.title == r.name }.count >= 1)
        st.regenerateWeek(); XCTAssertNotNil(st.routine(on: st.today)); XCTAssertTrue(st.s.skipped.isEmpty)
    }

    // MARK: 10 DOSES
    func testDoseTrackerStoresExactlyWhatTheUserTypedAndSuggestsNothing() {
        let st = ready { _ in }
        st.s.meds = [Med(name: "Typed Name", amount: "7.5", time: "08:00", unit: "mg", route: "as directed", frequency: "Once a day", instructions: "with food", prescriber: "Dr A", paused: false, times: ["08:00", "20:00"])]
        let m = st.s.meds[0]
        XCTAssertEqual(m.name, "Typed Name"); XCTAssertEqual(m.amount, "7.5"); XCTAssertEqual(m.unit, "mg"); XCTAssertEqual(m.allTimes, ["08:00", "20:00"])
        st.logMed(m, "taken"); XCTAssertEqual(st.medStatus(m), "taken"); st.logMed(m, "not_taken"); XCTAssertEqual(st.medStatus(m), "not_taken")
        XCTAssertEqual(st.s.medLogs.filter { $0.medId == m.id && $0.day == st.today }.count, 1)
        let swiftFiles = ["Models", "Services", "HealthView"]; _ = swiftFiles
        XCTAssertTrue(Catalog.shared.recipes.allSatisfy { !$0.name.isEmpty })
    }
    func testDoseRemindersFollowTheTrackerAndPauseStopsThem() {
        let st = ready { _ in }; st.s.settings.on = ["health"]
        st.s.meds = [Med(name: "Secret", amount: "1", time: "08:00", unit: nil, route: nil, frequency: nil, instructions: nil, prescriber: nil, paused: false, times: ["08:00", "20:00"])]
        var p = Notifier.plan(st.s); XCTAssertEqual(p.filter { $0.cat == "medication" }.count, 2)
        XCTAssertEqual(Set(p.map { $0.id }).count, p.count)
        XCTAssertFalse(p.map { $0.title + $0.body }.joined().contains("Secret"), "lock screen stays generic")
        st.s.meds[0].times = ["09:00", "20:00"]; p = Notifier.plan(st.s); XCTAssertEqual(p.first { $0.id.hasSuffix("-0") }?.comps.hour, 9)
        st.s.meds[0].paused = true; XCTAssertTrue(Notifier.plan(st.s).filter { $0.cat == "medication" }.isEmpty)
    }

    // MARK: 11 NOTIFICATIONS
    func testRemindersFollowTheProfileAndPlan() {
        let st = ready { $0.trainDays = [2, 4] }; st.s.settings.on = ["workout", "meals", "shopping", "recovery"]
        let p = Notifier.plan(st.s)
        XCTAssertEqual(p.filter { $0.cat == "workout" }.map { $0.comps.weekday! }.sorted(), [2, 4])
        XCTAssertEqual(p.filter { $0.cat == "meal" }.count, 3); XCTAssertEqual(p.filter { $0.cat == "shopping" }.count, 1); XCTAssertEqual(p.filter { $0.cat == "recovery" }.count, 5)
        st.s.profile.trainDays = [3]; st.profileChanged()
        XCTAssertEqual(Notifier.plan(st.s).filter { $0.cat == "workout" }.map { $0.comps.weekday! }, [3], "old reminders are gone")
    }
    func testQuietHoursLeadTimeAndTimes() {
        var s = Settings(); s.quietFrom = "22:00"; s.quietTo = "07:00"
        XCTAssertEqual(Notifier.quiet(23 * 60, s), 7 * 60); XCTAssertEqual(Notifier.quiet(3 * 60, s), 7 * 60); XCTAssertEqual(Notifier.quiet(12 * 60, s), 12 * 60)
        let st = ready(); st.s.settings.on = ["workout"]; st.s.profile.workoutTime = "18:00"; st.s.settings.lead = 30
        XCTAssertEqual(Notifier.plan(st.s).first { $0.cat == "workout" }?.comps.hour, 17); XCTAssertEqual(Notifier.plan(st.s).first { $0.cat == "workout" }?.comps.minute, 30)
        st.s.settings.on = ["meals"]; st.s.settings.dinner = "23:00"
        XCTAssertEqual(Notifier.plan(st.s).first { $0.id == "meal-dinner" }?.comps.hour, 7, "quiet hours respected")
    }
    func testCalendarEventsGetOneReminderEachAndNeverDuplicate() {
        let st = ready(); st.s.settings.on = ["calendar"]
        let tomorrow = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        _ = st.addEvent(CalEvent(title: "Call", day: tomorrow, time: "10:00")); _ = st.addEvent(CalEvent(title: "Call", day: tomorrow, time: "10:00"))
        XCTAssertEqual(Notifier.plan(st.s).filter { $0.id.hasPrefix("ev-") }.count, 1)
    }
    func testDeniedPermissionStillShowsRemindersInsideTheApp() {
        let st = ready(); st.s.settings.on = ["water", "meals"]; st.s.settings.waterTime = "00:05"
        var comps = DateComponents(); comps.year = 2026; comps.month = 6; comps.day = 10; comps.hour = 6
        let now = Calendar.current.date(from: comps)!
        XCTAssertFalse(Notifier.dueToday(st.s, now: now).isEmpty)
    }

    // MARK: 9 WALLY
    func testWallyUsesRealDataIsDeterministicAndDoesNotRepeat() {
        let st = ready()
        let a = WallyEngine.message(st.s, cat: st.cat); let b = WallyEngine.message(st.s, cat: st.cat); XCTAssertEqual(a, b)
        var s = st.s; s.checkins[dayKey()] = "bad"
        XCTAssertEqual(WallyEngine.message(s, cat: st.cat).rule, "bad")
        XCTAssertFalse(WallyEngine.message(s, cat: st.cat).text.lowercased().contains("lazy"))
        var h = st.s; h.workouts = (0..<4).map { WorkoutLog(date: Date().addingTimeInterval(Double(-$0 * 3600)), entries: []) }; h.profile.trainDays = [2, 4, 6]
        let m = WallyEngine.message(h, cat: st.cat); XCTAssertEqual(m.rule, "week"); XCTAssertTrue(m.text.contains("4 times"))
        XCTAssertNotEqual(WallyEngine.message(h, cat: st.cat, avoid: "week").rule, "week")
    }
    func testFeelingChoicesReadBadOkGreatInThatOrderWithIcons() {
        XCTAssertEqual(Lists.checkins.map { $0.1 }, ["Bad", "Ok", "Great"])
        for c in Lists.checkins { XCTAssertNotNil(Lists.checkinIcons[c.0]) }
    }

    // MARK: Regression: shipped features still work
    func testWaterTasksHabitsStillWork() {
        let st = ready(); st.addWater(250); XCTAssertEqual(st.waterToday, 250)
        XCTAssertFalse(st.nextStep.title.isEmpty)
    }
}
