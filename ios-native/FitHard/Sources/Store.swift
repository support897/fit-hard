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
    let cat = Catalog.shared
    private let url: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent("fithard-state.json")
        if let d = try? Data(contentsOf: url), let st = try? JSONDecoder().decode(AppState.self, from: d) { s = st } else { s = AppState() }
    }

    private func save() {
        if let d = try? JSONEncoder().encode(s) { try? d.write(to: url, options: .atomic) }
    }
    func say(_ m: String) {
        toast = m
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) { [weak self] in if self?.toast == m { self?.toast = nil } }
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
    func generatePlan(days: Int = 7) {
        var used = Set<String>()
        let seed = UInt64(abs(s.profile.name.hashValue % 100000) + 17)
        for i in 0..<days {
            guard let d = Calendar.current.date(byAdding: .day, value: i, to: Date()) else { continue }
            let key = dayKey(d)
            if s.plan[key] != nil && i == 0 && !(s.plan[key]?.isEmpty ?? true) { continue }
            var row: [String: String] = [:]
            for (mi, meal) in Lists.meals.enumerated() {
                var pool = recipes(for: meal)
                let liked = pool.filter { r in !Set(r.cuisines).isDisjoint(with: s.profile.cuisines) }
                if liked.count >= 6 { pool = liked }
                var rng = SeededRNG(state: seed &+ UInt64(i * 31 + mi * 7 + 1))
                pool.shuffle(using: &rng)
                if let pick = pool.first(where: { !used.contains($0.id) }) ?? pool.first {
                    row[meal] = pick.id; used.insert(pick.id)
                }
            }
            s.plan[key] = row
        }
    }
    func swap(day: String, meal: String) {
        let pool = recipes(for: meal).filter { $0.id != s.plan[day]?[meal] }
        if let r = pool.randomElement() { s.plan[day, default: [:]][meal] = r.id; haptic() }
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
        let days = s.profile.trainDays.sorted { ($0 + 5) % 7 < ($1 + 5) % 7 }
        let plans: [[String]]
        switch days.count {
        case 0: plans = []
        case 1, 2: plans = Array(repeating: ["full"], count: days.count)
        case 3: plans = [["push"], ["pull"], ["legs", "core"]]
        default: plans = (0..<days.count).map { $0 % 2 == 0 ? ["upper"] : ["lower"] }
        }
        let n = max(3, min(8, s.profile.minutes / 7))
        let eq = allowedEquipment()
        var routine: [String: [String]] = [:]
        for (i, d) in days.enumerated() {
            let parts = plans[i].flatMap { groups[$0] ?? [] }
            var picks: [String] = []
            var round = 0
            while picks.count < n && round < 4 {
                for p in parts where picks.count < n {
                    let pool = cat.exercises.filter {
                        $0.part == p && eq.contains($0.equipment) && $0.level != "expert" && ($0.category ?? "strength") == "strength" && !picks.contains($0.id)
                    }.sorted { ($0.anim != nil ? 0 : 1, $0.name) < ($1.anim != nil ? 0 : 1, $1.name) }
                    if pool.isEmpty { continue }
                    picks.append(pool[min(pool.count - 1, round + i)].id)
                }
                round += 1
            }
            routine[String(d)] = picks
        }
        s.routine = routine
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
