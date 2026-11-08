import Foundation
import SwiftUI
import UserNotifications

func dayKey(_ d: Date = Date()) -> String {
    let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}
func dateFromKey(_ k: String) -> Date? {
    let p = k.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
}
func hm(_ s: String) -> (Int, Int) {
    let p = s.split(separator: ":").compactMap { Int($0) }
    return (p.first ?? 9, p.count > 1 ? p[1] : 0)
}
func timeDate(_ s: String) -> Date {
    let (h, m) = hm(s)
    return Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
}
func timeString(_ d: Date) -> String {
    let c = Calendar.current.dateComponents([.hour, .minute], from: d)
    return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
}
func haptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
    UIImpactFeedbackGenerator(style: style).impactOccurred()
}

struct SeededRNG: RandomNumberGenerator {
    var state: UInt64
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }
}

@MainActor
final class Store: ObservableObject {
    @Published var s: AppState { didSet { save() } }
    @Published var toast: String? = nil
    @Published var session: Session? = nil
    @Published var syncNote = ""
    @Published var training: Routine? = nil
    var cloudReady = false
    /// Test launches skip the sign-up door. A normal launch never does: the account is mandatory.
    var bypassDoor = false
    var backupTask: Task<Void, Never>? = nil
    let cat = Catalog.shared
    let url: URL

    /// `url` lets tests use a throwaway file. `-uiTestSeed` launches with a ready-made onboarded profile.
    init(url custom: URL? = nil) {
        let seeded = ProcessInfo.processInfo.arguments.contains("-uiTestSeed")
        let doorTest = ProcessInfo.processInfo.arguments.contains("-uiTestDoor")
        let skipDoor = ProcessInfo.processInfo.arguments.contains("-uiTestSetup")
        if let c = custom { url = c } else if seeded || doorTest || skipDoor {
            url = FileManager.default.temporaryDirectory.appendingPathComponent("fithard-uitest-\(UUID().uuidString).json")
        } else {
            let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            url = dir.appendingPathComponent("fithard-state.json")
        }
        if let d = try? Data(contentsOf: url), let st = try? JSONDecoder().decode(AppState.self, from: d) { s = st } else { s = AppState() }
        if seeded && !s.onboarded {
            s.profile.name = "Tester"; s.profile.goals = ["Get stronger"]; s.profile.primaryGoal = "strength"; s.profile.needs = ["meals", "gym", "calendar"]
            s.profile.age = 30; s.profile.heightCm = 170; s.profile.weightKg = 70; s.profile.character = "nonbinary"
            s.onboarded = true; finishSetup()
        }
        if seeded || skipDoor { bypassDoor = true }
        if custom != nil || seeded || doorTest || skipDoor { return }
        loadSession()
        if session != nil { Task { [weak self] in if let x = self?.session { await self?.connect(x) } } }
    }

    private func save() {
        if let d = try? JSONEncoder().encode(s) { try? d.write(to: url, options: .atomic) }
        scheduleBackup()
    }
    func say(_ m: String) {
        toast = m
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) { [weak self] in if self?.toast == m { self?.toast = nil } }
    }

    func updateTask(_ id: UUID, _ f: (inout TaskItem) -> Void) {
        guard let i = s.tasks.firstIndex(where: { $0.id == id }) else { return }
        f(&s.tasks[i]); Notifier.rebuild(self)
    }

    // MARK: Water
    var today: String { dayKey() }
    var waterToday: Int { s.water[today] ?? 0 }
    func addWater(_ ml: Int = 250) {
        s.water[today, default: 0] += ml
        haptic()
        say("+\(ml) ml")
    }
    func undoWater(_ ml: Int = 250) { s.water[today] = max(0, (s.water[today] ?? 0) - ml) }

    // MARK: Meals
    func recipes(for meal: String) -> [Recipe] {
        cat.recipes.filter { r in
            r.meal == meal
            && !r.allergens.contains(where: { s.profile.allergens.contains($0) })
            && !(s.profile.vegetarian && r.meat)
        }
    }
    var targets: Targets? { NutritionService.targets(s.profile) }
    var mealTypes: [String] { s.profile.mealsPerDay <= 2 ? ["lunch", "dinner"] : Lists.meals }
    func generatePlan(days: Int = 7) {
        var used = Set<String>()
        let seed = UInt64(abs(s.profile.name.hashValue % 100000) + 17)
        for i in 0..<days {
            guard let d = Calendar.current.date(byAdding: .day, value: i, to: Date()) else { continue }
            let key = dayKey(d)
            if s.plan[key] != nil && i == 0 && !(s.plan[key]?.isEmpty ?? true) && s.profile.setupDone { continue }
            var row: [String: String] = [:]
            for (mi, meal) in mealTypes.enumerated() {
                if let pick = RecipeService.pick(meal: meal, profile: s.profile, targets: targets, count: mealTypes.count,
                                                 seed: seed &+ UInt64(i * 31 + mi * 7 + 1), exclude: used) {
                    row[meal] = pick.id; used.insert(pick.id)
                }
            }
            s.plan[key] = row
        }
    }
    /// Swaps ONE meal. Everything else stays. Calories and protein stay close, and the shopping list and calendar follow because they read the plan.
    func swap(day: String, meal: String) {
        let cur = s.plan[day]?[meal]
        let seed = UInt64(Date().timeIntervalSince1970.rounded()) & 0xFFFFFF
        if let r = RecipeService.pick(meal: meal, profile: s.profile, targets: targets, count: mealTypes.count, seed: seed,
                                      exclude: Set(s.plan.values.flatMap { $0.values }), avoid: cur) {
            s.plan[day, default: [:]][meal] = r.id; haptic()
        }
    }
    func setMeal(day: String, meal: String, recipe: Recipe) { s.plan[day, default: [:]][meal] = recipe.id }
    func toggleEaten(_ meal: String) {
        var e = s.eaten[today] ?? []
        if let i = e.firstIndex(of: meal) { e.remove(at: i) } else { e.append(meal); haptic() }
        s.eaten[today] = e
    }
    var kcalToday: Int {
        (s.eaten[today] ?? []).compactMap { m in s.plan[today]?[m].flatMap { cat.recipe($0)?.kcal } }.reduce(0, +)
    }
    func groceries() -> [(category: String, items: [(key: String, label: String)])] {
        var agg: [String: (qty: Double, unit: String, cat: String)] = [:]
        for i in 0..<7 {
            guard let d = Calendar.current.date(byAdding: .day, value: i, to: Date()) else { continue }
            for (_, rid) in s.plan[dayKey(d)] ?? [:] {
                guard let r = cat.recipe(rid) else { continue }
                for ing in r.ingredients {
                    let k = ing.name + "|" + ing.unit
                    let cur = agg[k] ?? (0, ing.unit, ing.category ?? "Other")
                    agg[k] = (cur.qty + ing.qty * 1.0 / Double(max(1, r.servings)) * 1.0, ing.unit, ing.category ?? "Other")
                }
            }
        }
        var out: [String: [(String, String)]] = [:]
        for (k, v) in agg {
            let name = String(k.split(separator: "|").first ?? "")
            let q = v.qty >= 10 ? String(Int(v.qty.rounded())) : String(format: "%.1f", v.qty).replacingOccurrences(of: ".0", with: "")
            out[v.cat, default: []].append((k, "\(name.capitalized), \(q) \(v.unit)"))
        }
        return out.keys.sorted().map { c in (c, out[c]!.sorted { $0.1 < $1.1 }.map { (key: $0.0, label: $0.1) }) }
    }

    // MARK: Training
    private let groups: [String: [String]] = [
        "push": ["chest", "shoulders", "triceps"], "pull": ["lats", "middle back", "biceps"],
        "legs": ["quadriceps", "hamstrings", "glutes", "calves"], "core": ["abdominals", "lower back"],
        "full": ["quadriceps", "chest", "lats", "shoulders", "abdominals"],
        "upper": ["chest", "lats", "shoulders", "biceps", "triceps"], "lower": ["quadriceps", "hamstrings", "glutes", "calves", "abdominals"]
    ]
    private func allowedEquipment() -> Set<String> {
        switch s.profile.equipment {
        case "body": return ["body only"]
        case "home": return ["body only", "dumbbell", "bands", "kettlebells", "exercise ball", "chair", "bench or box"]
        default: return ["machine", "barbell", "dumbbell", "cable", "body only", "kettlebells", "e-z curl bar", "bench or box"]
        }
    }
    func generateRoutine() {
        let block = max(1, s.routines.first?.block ?? 1)
        let rs = WorkoutGenerator.generate(profile: s.profile, exercises: cat.exercises, block: block)
        s.routines = rs
        syncRoutineDays()
        if s.blockStart.isEmpty { s.blockStart = dayKey() }
    }
    /// Keeps the weekday map (used by Today, Calendar and reminders) in step with the routine cards.
    func history(for id: String) -> [Entry] {
        s.workouts.sorted { $0.date > $1.date }.compactMap { $0.entries.first(where: { $0.exerciseId == id && !$0.sets.isEmpty }) }
    }
    func lastCompleted(_ r: Routine) -> Date? { s.workouts.filter { $0.routineId == r.id.uuidString }.map { $0.date }.max() }
    func nextSession(_ r: Routine) -> Date? {
        for i in 0..<8 { if let d = Calendar.current.date(byAdding: .day, value: i, to: Date()), Calendar.current.component(.weekday, from: d) == r.weekday { return d } }
        return nil
    }
    var blockWeek: Int {
        guard let d = dateFromKey(s.blockStart) else { return 1 }
        return (Calendar.current.dateComponents([.day], from: d, to: Date()).day ?? 0) / 7 + 1
    }
    /// A new 4 week block changes only some exercises, and never touches a routine the user has edited.
    func nextBlock() {
        let nb = (s.routines.first?.block ?? 1) + 1
        let fresh = WorkoutGenerator.generate(profile: s.profile, exercises: cat.exercises, block: nb)
        var out: [Routine] = []
        for old in s.routines {
            if old.customized { out.append(old); continue }
            if var f = fresh.first(where: { $0.weekday == old.weekday }) { f.id = old.id; f.block = nb; out.append(f) } else { out.append(old) }
        }
        s.routines = out; s.blockStart = dayKey(); syncRoutineDays(); Notifier.rebuild(self)
    }
    func finishWorkout(entries: [Entry], routine: Routine?, seconds: Int) {
        let done = entries.map { e -> Entry in var x = e; x.sets = e.sets.filter { $0.done == true }; return x }.filter { !$0.sets.isEmpty }
        if !done.isEmpty {
            s.workouts.append(WorkoutLog(entries: done, seconds: seconds, routineId: routine?.id.uuidString, routineName: routine?.name))
        }
        s.draft = []; s.draftStart = nil; s.draftRoutine = nil
        markWorkoutDone(routineID: routine?.id.uuidString)
        Notifier.rebuild(self)
    }
    func syncRoutineDays() {
        var r: [String: [String]] = [:]
        for x in s.routines { r[String(x.weekday)] = x.exIds }
        s.routine = r
    }
    func finishSetupKit() {
        if s.profile.kit.isEmpty { s.profile.kit = s.profile.location == "home" ? ["dumbbell", "bands", "kettlebells", "bench or box"] : ["barbell", "dumbbell", "machine", "cable", "kettlebells", "bench or box", "e-z curl bar"] }
    }
    func finishSetup() {
        s.profile.setupDone = true; s.profile.profileVersion = 2
        s.profile.vegetarian = s.profile.diet == "vegetarian" || s.profile.diet == "vegan"
        s.profile.equipment = s.profile.location == "home" ? "home" : "gym"
        if s.profile.kit.isEmpty { s.profile.kit = s.profile.location == "home" ? ["dumbbell", "bands", "kettlebells", "bench or box"] : ["barbell", "dumbbell", "machine", "cable", "kettlebells", "bench or box", "e-z curl bar"] }
        if s.profile.needs.isEmpty { s.profile.needs = ["meals", "gym", "calendar"] }
        if s.profile.goals.isEmpty { s.profile.goals = ["Feel fitter"] }
        if s.profile.primaryGoal.isEmpty { s.profile.primaryGoal = "fitter" }
        generatePlan(); generateRoutine()
    }
    /// Editing the profile anywhere calls this, so the plan, routines and reminders all follow the one profile.
    func profileChanged() {
        s.profile.vegetarian = s.profile.diet == "vegetarian" || s.profile.diet == "vegan"
        generatePlan(); generateRoutine(); Notifier.rebuild(self)
    }
    var todaysExercises: [Exercise] {
        let wd = Calendar.current.component(.weekday, from: Date())
        return (s.routine[String(wd)] ?? []).compactMap { cat.exercise($0) }
    }
    var workedOutToday: Bool { s.workouts.contains { dayKey($0.date) == today } }
    func lastSets(for id: String) -> [SetLog]? {
        s.workouts.sorted { $0.date > $1.date }.compactMap { $0.entries.first(where: { $0.exerciseId == id })?.sets }.first
    }

    // MARK: Health (user-entered, clinician-provided records only)
    func medStatus(_ m: Med, day: String? = nil) -> String? {
        s.medLogs.last(where: { $0.medId == m.id && $0.day == (day ?? today) })?.status
    }
    func logMed(_ m: Med, _ status: String) {
        s.medLogs.removeAll { $0.medId == m.id && $0.day == today }
        s.medLogs.append(MedLog(medId: m.id, day: today, status: status))
        haptic()
    }
    func eraseHealth() { s.meds = []; s.medLogs = []; s.appts = [] ; Notifier.rebuild(self) }

    // MARK: Today's next step
    struct Step { let icon: String; let title: String; let tab: Int }
    var nextStep: Step {
        let hour = Calendar.current.component(.hour, from: Date())
        if s.checkins[today] == nil { return Step(icon: "heart", title: "How are you feeling?", tab: 0) }
        if !todaysExercises.isEmpty && !workedOutToday && hour >= 6 { return Step(icon: "dumbbell", title: "Today's workout is ready", tab: 2) }
        if let m = Lists.meals.first(where: { !(s.eaten[today] ?? []).contains($0) && s.plan[today]?[$0] != nil }) {
            return Step(icon: "fork.knife", title: "Next up: \(m)", tab: 1)
        }
        if waterToday < s.profile.waterGoal { return Step(icon: "drop", title: "A glass of water?", tab: 0) }
        return Step(icon: "sparkles", title: "All done. Rest is part of the plan.", tab: 0)
    }

    func resetAll() {
        s = AppState()
        Notifier.cancelAll()
    }
}
