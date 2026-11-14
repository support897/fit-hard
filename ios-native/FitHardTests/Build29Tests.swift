import XCTest
import SwiftUI
import UIKit
@testable import Fit_Hard

@MainActor
final class Build29Tests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("b29-\(UUID().uuidString).json") }
    func daysFromToday(_ n: Int) -> [Int] { let wd = Calendar.current.component(.weekday, from: Date()); return (0..<n).map { (wd - 1 + $0) % 7 + 1 } }
    func ready(_ f: (inout Profile) -> Void = { _ in }) -> Store {
        var p = Profile(); p.name = "Tess"; p.age = 30; p.heightCm = 180; p.weightKg = 80; p.calcBasis = "male"; p.primaryGoal = "muscle"; p.activity = "light"
        p.trainType = "strength"; p.trainDays = daysFromToday(5); p.setupDone = true; f(&p)
        let st = Store(url: tmp()); st.s.onboarded = true; st.s.profile = p; st.finishSetup(); return st
    }
    func kcal(_ st: Store, _ day: String) -> Int { (st.s.plan[day] ?? [:]).values.compactMap { st.cat.recipe($0)?.kcal }.reduce(0, +) }

    // Item 2: a Bad check-in changes the plan, and changing the answer restores it
    func testBadCheckinMakesMealsAndWorkoutLighter() {
        let st = ready(); let day = st.today
        let before = st.s.plan[day] ?? [:]; let kBefore = kcal(st, day)
        let exBefore = st.routine(on: day)?.exIds.count ?? 0
        XCTAssertGreaterThan(exBefore, 0)
        st.setCheckin("bad")
        XCTAssertTrue(st.s.lightDays.contains(day))
        XCTAssertLessThanOrEqual(kcal(st, day), kBefore, "lighter meals, never heavier")
        XCTAssertNotEqual(st.s.plan[day] ?? [:], before, "the plan itself changed")
        XCTAssertLessThanOrEqual(st.routine(on: day)?.exIds.count ?? 99, 3)
        st.setCheckin("great")
        XCTAssertFalse(st.s.lightDays.contains(day)); XCTAssertEqual(st.s.plan[day] ?? [:], before, "the old plan comes back")
        XCTAssertEqual(st.routine(on: day)?.exIds.count ?? 0, exBefore)
    }
    func testBadCheckinNeverTouchesDosesOrEatenMeals() {
        let st = ready(); let day = st.today
        st.s.meds = [Med(name: "Test", amount: "1", times: ["08:00"])]
        let medsBefore = st.s.meds.count
        guard let first = st.mealTypes.first, let kept = st.s.plan[day]?[first] else { return XCTFail("no plan") }
        st.toggleEaten(first); st.setCheckin("bad")
        XCTAssertEqual(st.s.plan[day]?[first], kept, "a meal already eaten stays as it was")
        XCTAssertEqual(st.s.meds.count, medsBefore)
    }
    func testToastOnlyPromisesWhatTheCodeDoes() {
        let toast = Lists.checkins.first { $0.0 == "bad" }!.2
        XCTAssertTrue(toast.contains("Lighter meals") && toast.contains("easier workout"))
    }

    func testMissedSessionIsOfferedKindlyAndCanBeLetGo() {
        let wd = Calendar.current.component(.weekday, from: Date()); let yd = (wd + 5) % 7 + 1
        let st = ready { $0.trainDays = [yd, wd] }
        st.s.blockStart = "2000-01-01"
        guard let r = st.missedSession else { return XCTFail("yesterday's session should be offered") }
        st.letMissedSessionGo(r)
        XCTAssertNil(st.missedSession, "letting it go clears it for good")
        XCTAssertFalse(Lists.checkins.map { $0.2 }.joined().lowercased().contains("fail"))
    }

    // Item 3: animations follow the saved character
    func testCharacterFramesFollowThePickAndLegPressAnimates() {
        XCTAssertEqual(CharacterAnim.prefix("boy"), "boy"); XCTAssertEqual(CharacterAnim.prefix("girl"), "girl"); XCTAssertEqual(CharacterAnim.prefix("nonbinary"), "nb")
        guard let lp = Catalog.shared.exercises.first(where: { $0.id == "Leg_Press" }) else { return XCTFail("no leg press") }
        var seen = Set<String>()
        for c in ["boy", "girl", "nonbinary"] {
            let b = CharacterAnim.base(for: lp, character: c)
            XCTAssertNotNil(b, "Leg Press has a set for \(c)")
            if let b = b { seen.insert(b); for i in 1...3 { XCTAssertTrue(CharacterAnim.exists("anim-\(b)-\(i)")) } }
        }
        XCTAssertEqual(seen.count, 3, "each character gets its own frames")
    }

    func testEveryExerciseWithBoyAndNonbinarySetsAlsoHasGirlSet() {
        for ex in Catalog.shared.exercises {
            let k = CharacterAnim.key(ex)
            if CharacterAnim.exists("anim-boy-\(k)-1") && CharacterAnim.exists("anim-nb-\(k)-1") {
                XCTAssertNotNil(CharacterAnim.base(for: ex, character: "girl"), "girl set missing for \(k)")
            }
        }
    }

    // Item 4: typefaces
    func testSpecTypefacesLoad() {
        FHFonts.register()
        for n in ["Karla-Regular", "Karla-Bold", "ZillaSlab-SemiBold", "ZillaSlab-Bold"] { XCTAssertNotNil(UIFont(name: n, size: 14), n) }
    }

    // Item 5: brand icons
    func testEveryIconNameInUseHasADesignedBrandIcon() {
        var names = Set(Lists.goalIcons + Lists.needs.map { $0.icon } + Array(Lists.checkinIcons.values) + Color.catNames.map { $0.2 })
        names.formUnion(TrainType.allCases.map { $0.icon }); names.formUnion(MealKind.allCases.map { $0.icon })
        for n in names { XCTAssertNotNil(Glyphs.table[n] ?? (["gym", "training", "meals", "recovery", "medication", "peptides", "personal"].contains(n) ? Glyphs.table["moon"] : nil), "no designed icon for \(n)") }
    }

    // Item 7: training types, colour families, rest planned, different answers different plans
    func testTrainingTypesHaveIconLabelAndTwoSeparateColourFamilies() {
        var trainHex = Set<UInt32>(), mealHex = Set<UInt32>()
        for t in TrainType.allCases { XCTAssertFalse(t.label.isEmpty); XCTAssertNotNil(Glyphs.table[t.icon]); trainHex.insert(Color.toneTable[t.tone]!.0) }
        for m in MealKind.allCases { XCTAssertNotNil(Glyphs.table[m.icon]); mealHex.insert(Color.toneTable[m.tone]!.0) }
        XCTAssertEqual(trainHex.count, TrainType.allCases.count, "every training type has its own colour")
        XCTAssertEqual(mealHex.count, MealKind.allCases.count, "every meal has its own colour")
        XCTAssertTrue(trainHex.isDisjoint(with: mealHex), "food colours differ from training colours")
    }
    func testCalendarItemsCarryTypeAndMealTones() {
        let st = ready(); let items = st.calItems(on: st.today)
        XCTAssertTrue(items.filter { $0.cat == "meals" }.allSatisfy { $0.colorKey.hasPrefix("meal.") })
        XCTAssertTrue(items.filter { $0.cat == "training" }.allSatisfy { $0.colorKey.hasPrefix("train.") && $0.detail.contains(st.routine(on: st.today)!.trainType.label) })
    }
    func testRestDaysArePlannedAndSevenDaysKeepsOneRestDay() {
        let st = ready { $0.trainDays = daysFromToday(7) }
        XCTAssertLessThanOrEqual(st.s.routines.filter { $0.trainType != .mobility && $0.trainType != .cardio }.count, 5)
        XCTAssertEqual(st.s.routines.count, 6)
        let noRoutineDays = (0..<7).compactMap { i -> String? in
            let k = dayKey(Calendar.current.date(byAdding: .day, value: i, to: Date())!); return st.routine(on: k) == nil ? k : nil }
        XCTAssertEqual(noRoutineDays.count, 1)
        XCTAssertTrue(st.calItems(on: noRoutineDays[0]).contains { $0.id.hasPrefix("plannedrest-") && $0.detail == "Planned rest day" })
    }
    func testDifferentAnswersMakeDifferentPlans() {
        let a = ready { $0.primaryGoal = "lose"; $0.diet = "vegan"; $0.location = "home"; $0.trainDays = [2, 4]; $0.experience = "beginner" }
        let b = ready { $0.primaryGoal = "muscle"; $0.diet = "any"; $0.location = "gym"; $0.trainDays = [2, 3, 5, 6, 7]; $0.experience = "advanced"; $0.name = "Sam" }
        XCTAssertNotEqual(a.s.routines.map { $0.exIds }, b.s.routines.map { $0.exIds })
        XCTAssertNotEqual(a.s.routines.count, b.s.routines.count)
        XCTAssertNotEqual(a.targets, b.targets)
        XCTAssertNotEqual(a.s.plan[a.today] ?? [:], b.s.plan[b.today] ?? [:])
        XCTAssertLessThan(WorkoutGenerator.setCount(for: Catalog.shared.exercises.first { $0.category == "strength" }, profile: a.s.profile),
                          WorkoutGenerator.setCount(for: Catalog.shared.exercises.first { $0.category == "strength" }, profile: b.s.profile))
    }
    func testLoseGoalAddsCardioAndMobilityDayFromSixDays() {
        let a = ready { $0.primaryGoal = "lose"; $0.trainType = "mixed"; $0.trainDays = daysFromToday(3) }
        XCTAssertTrue(a.s.routines.contains { $0.trainType == .cardio })
        XCTAssertTrue(a.s.routines.filter { $0.trainType == .cardio }.allSatisfy { !$0.exIds.isEmpty })
        let m = ready { $0.trainDays = daysFromToday(6) }
        XCTAssertTrue(m.s.routines.contains { $0.trainType == .mobility && !$0.exIds.isEmpty })
    }

    // Item 8: why this meal is only true, portions, cook mode
    func testWhyThisMealOnlyStatesFacts() {
        let st = ready { $0.diet = "any"; $0.allergens = []; $0.cuisines = [] }
        for m in st.mealTypes {
            guard let r = st.s.plan[st.today]?[m].flatMap({ st.cat.recipe($0) }) else { continue }
            let why = st.whyThisMeal(r, meal: m).joined(separator: " ")
            XCTAssertFalse(why.contains("vegan") || why.contains("vegetarian") || why.contains("allergens") || why.contains("cuisine"), why)
            XCTAssertFalse(why.contains("Bad"), why)
        }
        let v = ready { $0.diet = "vegetarian"; $0.allergens = ["peanut"] }
        for m in v.mealTypes {
            guard let r = v.s.plan[v.today]?[m].flatMap({ v.cat.recipe($0) }) else { continue }
            XCTAssertFalse(r.meat); XCTAssertFalse(r.allergens.contains("peanut"))
            XCTAssertTrue(v.whyThisMeal(r, meal: m).contains { $0.contains("vegetarian") && $0.contains("Fits") })
        }
    }
    func testLogLightlyScalesCaloriesAndProtein() {
        let st = ready(); guard let m = st.mealTypes.first, let r = st.s.plan[st.today]?[m].flatMap({ st.cat.recipe($0) }) else { return XCTFail("no meal") }
        st.logPortion(m, 0.5)
        XCTAssertEqual(st.kcalToday, Int((Double(r.kcal) * 0.5).rounded())); XCTAssertEqual(st.portion(m), 0.5)
        st.toggleEaten(m); XCTAssertEqual(st.kcalToday, 0); XCTAssertEqual(st.portion(m), 0)
    }
    func testCookModeReadsTimesFromSteps() {
        XCTAssertEqual(CookMode.minutes(in: "Simmer for 10 minutes."), 10)
        XCTAssertEqual(CookMode.minutes(in: "Bake 20-25 min until golden"), 25)
        XCTAssertNil(CookMode.minutes(in: "Stir well and serve."))
    }
    func testSpanishStringsShip() {
        guard let p = Bundle.main.path(forResource: "es", ofType: "lproj"), let b = Bundle(path: p) else { return XCTFail("no es.lproj") }
        XCTAssertEqual(b.localizedString(forKey: "Today", value: nil, table: nil), "Hoy")
        XCTAssertEqual(b.localizedString(forKey: "Why this meal", value: nil, table: nil), "Por qué esta comida")
    }

    // Item 10: existing users answer the personalisation again, and keep everything
    func testExistingUserIsAskedAgainAndKeepsAllData() {
        let st = Store(url: tmp()); st.s.onboarded = true; st.s.profile.setupDone = true; st.s.profile.name = "Old"
        st.s.workouts = [WorkoutLog(entries: [Entry(exerciseId: "a", sets: [SetLog(reps: 8, kg: 20, done: true)])])]
        st.s.events = [CalEvent(title: "Yoga", day: st.today, time: "08:00", minutes: 30, cat: "personal", kind: "other", link: nil)]
        st.s.checkins["2026-01-01"] = "ok"
        XCTAssertEqual(st.s.personalizationVersion, 0); XCTAssertTrue(st.needsPersonalization)
        st.s.profile.age = 30; st.s.profile.heightCm = 170; st.s.profile.weightKg = 70; st.s.profile.primaryGoal = "lose"
        st.finishSetup(); st.s.personalizationVersion = Store.personalizationRound
        XCTAssertFalse(st.needsPersonalization)
        XCTAssertEqual(st.s.workouts.count, 1); XCTAssertEqual(st.s.events.count, 1); XCTAssertEqual(st.s.checkins["2026-01-01"], "ok")
        XCTAssertFalse(st.s.routines.isEmpty); XCTAssertFalse((st.s.plan[st.today] ?? [:]).isEmpty, "plans rebuilt")
        let old = try? JSONDecoder().decode(AppState.self, from: Data(#"{"onboarded":true}"#.utf8))
        XCTAssertEqual(old?.personalizationVersion, 0, "data from before build 29 decodes as needing the new setup")
    }

    // Item 1: Apple and Google land in the same account store, and sign in never creates
    func testProviderDoorSignUpCreatesAndSignInNeverDoes() async {
        Cloud.forceOffline = true; Cloud.log = []
        defer { Cloud.forceOffline = false; Cloud.log = [] }
        let a = Store(url: tmp())
        try? await a.providerDoor(creating: true, provider: "google.com", idToken: "x", accessToken: "y", rawNonce: nil, name: "Ana")
        XCTAssertNotNil(a.session); XCTAssertEqual(a.s.profile.name, "Ana")
        XCTAssertTrue(Cloud.log.contains { $0.contains("signInWithIdp") })
        let b = Store(url: tmp())
        do { try await b.providerDoor(creating: false, provider: "apple.com", idToken: "x", accessToken: nil, rawNonce: "n", name: ""); XCTFail("sign in must not create") }
        catch { XCTAssertTrue((error as? AccountError)?.errorDescription?.contains("Create a new account") ?? false) }
        XCTAssertNil(b.session)
    }
    func testNonceIsRandomAndHashIsHex() {
        XCTAssertNotEqual(Providers.nonce(), Providers.nonce()); XCTAssertEqual(Providers.nonce(32).count, 32)
        XCTAssertEqual(Providers.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    // Build 31: Spanish stragglers and the Health door.
    func testAllergenNamesNeverShowRawKeys() {
        for k in ["egg", "gluten", "milk", "peanut", "sesame", "soy", "tree_nut"] {
            XCTAssertFalse(allergenName(k).contains("_"), k)
            XCTAssertFalse(allergenName(k).hasPrefix("allergen."), k)
        }
    }
    func testTrainAndMealLabelsGoThroughLocalization() {
        XCTAssertEqual(TrainType.full.label, NSLocalizedString("Full body", comment: ""))
        XCTAssertEqual(MealKind.breakfast.label, NSLocalizedString("Breakfast", comment: ""))
    }
    func testHealthViewCanBeBuiltEmbeddedWithTheStoreFromTheEnvironment() {
        let host = UIHostingController(rootView: NavigationStack { HealthView(embedded: true) }.environmentObject(Store(url: tmp())))
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view)
    }

    // MARK: Build 32
    func esBundle() -> Bundle { Bundle(path: Bundle.main.path(forResource: "es", ofType: "lproj")!)! }

    func testThemesAreFourAndWhiteIsTheDefaultAndThePickTravelsWithTheAccount() throws {
        XCTAssertEqual(Settings().theme, "white")
        XCTAssertEqual(Settings.normalTheme("black"), "dark"); XCTAssertEqual(Settings.normalTheme("brown"), "dark"); XCTAssertEqual(Settings.normalTheme("burrow"), "beige")
        var st = AppState(); st.settings.theme = "brand"
        let back = try JSONDecoder().decode(AppState.self, from: JSONEncoder().encode(st))
        XCTAssertEqual(back.settings.theme, "brand", "the theme is part of the saved record, so a fresh install restore brings it back")
    }
    func testDoorWordsFollowTheChosenLanguageBothWays() {
        let es = esBundle()
        XCTAssertEqual(es.localizedString(forKey: "Email", value: nil, table: nil), "Correo electrónico")
        XCTAssertEqual(NSLocalizedString("Email", comment: ""), "Email", "English shows Email")
        for k in ["Use email", "Continue with Google", "Create account", "Sign in", "Your name", "Email", "Password", "Choose a password (8+ characters)", "One moment", "Forgot password?"] {
            XCTAssertNotEqual(es.localizedString(forKey: k, value: "MISSING", table: nil), "MISSING", "door string not in Spanish: \(k)")
        }
    }
    func testASecondAccountOnTheSamePhoneNeverInheritsTheFirstOnesNameOrData() async {
        Cloud.forceOffline = true; defer { Cloud.forceOffline = false }
        let st = Store(url: tmp())
        st.s.ownerUid = "uidA"; st.s.profile.name = "Alex"; st.s.onboarded = true; st.s.settings.theme = "dark"
        await st.connect(Session(uid: "uidB", email: "b@example.com", idToken: "t", refreshToken: "r"))
        XCTAssertEqual(st.s.ownerUid, "uidB"); XCTAssertFalse(st.hasName, "no name is carried over"); XCTAssertEqual(st.s.profile.name, ""); XCTAssertFalse(st.s.onboarded)
        XCTAssertEqual(st.s.settings.theme, "white")
    }
    func testHomeWeekGoalFollowsTheSavedDaysPickAndStreakCountsLoggedDays() {
        let st = Store(url: tmp())
        st.s.profile.trainDays = [2, 4, 6, 7]; st.saveWeekGoal()
        XCTAssertEqual(st.weekGoalCount, 4); XCTAssertEqual(st.s.profile.weekGoal, 4)
        st.s.profile.trainDays = [2]
        XCTAssertEqual(st.weekGoalCount, 4, "the goal changes only when the pick is saved")
        st.saveWeekGoal(); XCTAssertEqual(st.weekGoalCount, 1)
        let y = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        st.s.water[dayKey()] = 250; st.s.water[dayKey(y)] = 250
        XCTAssertEqual(st.streak, 2); XCTAssertGreaterThan(st.consistency, 0)
    }
    func testFourTrackersKeepThisWeekAndLastWeek() {
        let st = Store(url: tmp())
        st.logTracker(.weight, value: 70.5); st.logTracker(.sleep, value: 7.5); st.logTracker(.steps, value: 8000); st.logTracker(.water, value: 1500)
        for t in Store.Tracker.allCases { XCTAssertNotEqual(st.trackerText(t, offset: 0), "-", "\(t)") }
        XCTAssertEqual(st.trackerText(.sleep, offset: -1), "-"); XCTAssertEqual(st.s.body.last?.weight, 70.5)
    }
    func testDosesAreMarkedOnlyByThePersonNeverAutomatically() {
        // Her ruling (13 Nov): a dose is marked only by the person's own tap in My doses.
        // Nothing in the store marks one on its own; the build 32 workout start ask that did is gone.
        let st = Store(url: tmp())
        st.s.meds.append(Med(name: "my own entry", frequency: "As directed", paused: true))
        XCTAssertNil(st.medStatus(st.s.meds[0]), "unmarked until the person marks it")
        st.logMed(st.s.meds[0], "taken")
        XCTAssertEqual(st.medStatus(st.s.meds[0]), "taken")
    }
    func testMyDosesNextDoseAndCalendarTimesStayApart() {
        // Item 6, built as drawn: the next dose is the next unmarked one, and the calendar keeps
        // the due time and the taken time apart on the same line.
        let st = Store(url: tmp())
        st.s.meds.append(Med(name: "Morning mix", amount: "One scoop", time: "08:00", frequency: "Once a day", times: ["08:00"]))
        st.s.meds.append(Med(name: "Vitamin D drops", amount: "Two drops", time: "20:00", frequency: "Once a day", times: ["20:00"]))
        XCTAssertEqual(st.nextDoseToday()?.med.name, "Morning mix")
        XCTAssertEqual(st.unconfirmedDosesToday().count, 2)
        st.logMed(st.s.meds[0], "taken")
        XCTAssertEqual(st.nextDoseToday()?.med.name, "Vitamin D drops")
        XCTAssertEqual(st.unconfirmedDosesToday().count, 1)
        let items = st.calItems(on: st.today)
        let morning = items.first { $0.id.hasPrefix("med-") && $0.title.contains("Morning mix") }
        XCTAssertNotNil(morning, "the morning dose stands on the calendar")
        XCTAssertTrue(morning!.title.hasPrefix("Dose · "), "its own kind, not a generic check in")
        XCTAssertTrue(morning!.detail.contains("Due 08:00 · Taken "), "due and taken times stand apart")
        let evening = items.first { $0.id.hasPrefix("med-") && $0.title.contains("Vitamin D") }
        XCTAssertTrue(evening!.detail.contains("not marked yet"), "the unmarked dose says so plainly")
        st.logMed(st.s.meds[1], "taken")
        XCTAssertNil(st.nextDoseToday(), "every dose marked means no next dose")
        XCTAssertTrue(st.unconfirmedDosesToday().isEmpty, "the workout done line stays hidden then")
    }
    func testHeartsSavePerPersonAndUnheartEasesOff() {
        // Item 2: hearts live in the person's own state, survive a restart, and one tap removes them.
        let u = tmp(); let a = Store(url: u)
        a.toggleFavExercise("ex-1"); a.toggleFavExercise("ex-2")
        let rid = UUID(); a.s.routines.append(Routine(id: rid, name: "Mine", weekday: 2, focus: [], exIds: ["ex-9"]))
        a.toggleFavRoutine(rid)
        let b = Store(url: u)
        XCTAssertEqual(b.s.favExercises, ["ex-1", "ex-2"]); XCTAssertEqual(b.s.favRoutines, [rid.uuidString])
        XCTAssertTrue(b.heartedExerciseIds.contains("ex-9"), "a hearted routine feeds the tilt too")
        b.toggleFavExercise("ex-1"); XCTAssertEqual(b.s.favExercises, ["ex-2"])
    }
    func testGeneratorTiltsTowardHeartedExercises() {
        // Item 2, her own algorithm: with no hearts the alphabetically first pool exercise is picked;
        // hearting the last one by name brings it into the plan. Balance shape is unchanged: same
        // number of routines and picks either way.
        func quad(_ id: String, _ name: String) -> Exercise {
            Exercise(id: id, name: name, part: "quadriceps", partLabel: "Front legs", equipment: "body only", level: "beginner", category: "strength", cue: "Go", anim: nil)
        }
        let pool = [quad("a1", "Alpha squat"), quad("a2", "Bravo squat"), quad("a3", "Charlie squat"),
                    quad("a4", "Delta squat"), quad("a5", "Echo squat"), quad("z9", "Zulu squat")]
        var p = Profile(); p.trainDays = [3]; p.minutes = 24; p.experience = "beginner"; p.trainType = "strength"
        let plain = WorkoutGenerator.generate(profile: p, exercises: pool)
        let loved = WorkoutGenerator.generate(profile: p, exercises: pool, hearts: ["z9"])
        XCTAssertEqual(plain.flatMap { $0.exIds }, ["a1"])
        XCTAssertEqual(loved.flatMap { $0.exIds }, ["z9"])
        XCTAssertEqual(plain.count, loved.count)
    }
    func testMachineMatchConfidenceIsHonest() {
        // Item 1: a match is called confident only when it is close AND clearly ahead.
        // Anything else must land in the not sure state, never presented as fact.
        let a = Catalog.Machine(id: "a", name: "A", exerciseIds: [])
        let b = Catalog.Machine(id: "b", name: "B", exerciseIds: [])
        XCTAssertTrue(MachineMatcher.isConfident([(a, 0.30), (b, 0.60)]))
        XCTAssertTrue(MachineMatcher.isConfident([(a, 0.30)]))
        XCTAssertFalse(MachineMatcher.isConfident([(a, 0.30), (b, 0.35)]), "too close to call")
        XCTAssertFalse(MachineMatcher.isConfident([(a, 0.80), (b, 0.95)]), "nothing is close")
        XCTAssertFalse(MachineMatcher.isConfident([]))
    }
    func testEveryExerciseHasADesignedIconMark() {
        for ex in Catalog.shared.exercises {
            XCTAssertNotNil(Glyphs.table[ExerciseGlyph.part(ex.part)], "zone mark for \(ex.part)")
            XCTAssertNotNil(Glyphs.table[ExerciseGlyph.tool(ex.equipment)], "tool mark for \(ex.equipment)")
        }
    }

    // MARK: Build 33 meal reels
    func testReelMatchesStepsByWhatTheyAreInEnglishAndSpanish() {
        let cases: [(String, String)] = [
            ("Wash the carrots and broccoli.", "reel-wash"), ("Lava las zanahorias.", "reel-wash"),
            ("Chop the tomato.", "reel-chop"), ("Slice the bread.", "reel-chop"), ("Corta el tomate.", "reel-chop"), ("Pica la cebolla.", "reel-chop"),
            ("Stir the sauce.", "reel-stir"), ("Fry the onion.", "reel-stir"), ("Fr\u{00ED}e la cebolla.", "reel-stir"), ("Incorpora la salsa.", "reel-stir"),
            ("Serve right away.", "reel-serve"), ("Sirve enseguida.", "reel-serve")]
        for (text, pic) in cases { XCTAssertEqual(ReelLibrary.match(text)?.picture, pic, text) }
        XCTAssertNil(ReelLibrary.match("Toast the bread until golden."))
    }
    func testReelFallbackUsesServeForTheLastStepAndStirForTheRestAndNeverBlocks() {
        let f = ReelLibrary.frames(for: ["Toast the bread.", "Chop the tomato.", "Bake until golden."])
        XCTAssertEqual(f.map { $0.picture }, ["reel-stir", "reel-chop", "reel-serve"])
        XCTAssertEqual(f.map { $0.matched }, [false, true, false])
        XCTAssertEqual(ReelLibrary.missingVerbs(in: ["Toast the bread.", "Chop the tomato.", "Bake until golden."]), ["toast", "bake"])
        XCTAssertTrue(ReelLibrary.frames(for: []).isEmpty)
    }
    func testEveryRecipeWithStepsGetsAReelWithItsOwnWordsAndRealPictures() {
        for r in Catalog.shared.recipes where !r.steps.isEmpty {
            let f = ReelLibrary.frames(for: r.steps)
            XCTAssertEqual(f.count, r.steps.count, r.id)
            XCTAssertEqual(f.map { $0.text }, r.steps, "captions are the recipe's own words: \(r.id)")
            XCTAssertGreaterThan(ReelLibrary.duration(r.steps[0]), 3)
        }
        for name in ["reel-wash", "reel-chop", "reel-stir", "reel-serve"] { XCTAssertNotNil(ReelImages.image(name), "picture missing from the bundle: \(name)") }
        for e in ReelLibrary.entries { XCTAssertNotNil(ReelImages.image(e.picture), e.picture) }
    }
}
