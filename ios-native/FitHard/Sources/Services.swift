import Foundation

// MARK: Nutrition (one place, so no screen calculates calories differently)
struct Targets: Equatable { var kcal: Int; var protein: Int; var carbs: Int; var fat: Int }

enum NutritionService {
    static func bmr(_ p: Profile) -> Double? {
        guard p.age > 0, p.heightCm > 0, p.weightKg > 0 else { return nil }
        let s: Double = p.calcBasis == "male" ? 5 : (p.calcBasis == "female" ? -161 : -78)
        return 10 * p.weightKg + 6.25 * p.heightCm - 5 * Double(p.age) + s
    }
    static func multiplier(_ a: String) -> Double {
        switch a { case "sedentary": return 1.2; case "moderate": return 1.55; case "active": return 1.725; default: return 1.375 }
    }
    /// No calorie target for under 18s, pregnancy or eating disorder concerns. Those people are pointed to a clinician instead.
    static func targetsAllowed(_ p: Profile) -> Bool { !(p.minor || p.pregnant || p.edConcern || (p.age > 0 && p.age < 18)) }
    static func targets(_ p: Profile) -> Targets? {
        guard targetsAllowed(p), let b = bmr(p) else { return nil }
        let tdee = b * multiplier(p.activity)
        var kcal = tdee
        switch p.primaryGoal {
        case "lose": kcal = max(b, tdee * 0.88)        // gentle: about 12 percent under, never below resting energy
        case "muscle": kcal = tdee * 1.07
        default: break
        }
        let perKg = p.primaryGoal == "lose" ? 1.8 : (p.primaryGoal == "muscle" || p.primaryGoal == "strength" ? 1.6 : 1.4)
        let protein = min(2.0, max(1.4, perKg)) * p.weightKg
        let fat = kcal * 0.27 / 9
        let carbs = max(0, (kcal - protein * 4 - fat * 9) / 4)
        return Targets(kcal: Int((kcal / 10).rounded()) * 10, protein: Int(protein.rounded()), carbs: Int(carbs.rounded()), fat: Int(fat.rounded()))
    }
}

// MARK: Recipes, have-vs-buy, shopping
struct ShopLine: Identifiable, Hashable {
    let name: String; let cat: String; let unit: String; let need: Double; let have: Double
    var id: String { name + "|" + unit }
    var buy: Double { max(0, need - have) }
}

enum RecipeService {
    static var cat: Catalog { Catalog.shared }
    static func macros(_ r: Recipe) -> (p: Int, c: Int, f: Int)? {
        guard let m = cat.macros[r.id], m.count == 3 else { return nil }
        return (m[0], m[1], m[2])
    }
    static func norm(_ n: String) -> String {
        var s = n.lowercased().trimmingCharacters(in: .whitespaces)
        let syn = ["eggs": "egg", "yoghurt": "greek yogurt", "yogurt": "greek yogurt", "bell pepper": "capsicum", "pepper": "capsicum",
                   "scallion": "spring onion", "scallions": "spring onion", "courgette": "zucchini", "tomatoes": "tomato", "potatoes": "potato",
                   "onions": "onion", "carrots": "carrot", "lemons": "lemon", "limes": "lime", "cheddar": "cheese", "mince": "beef mince"]
        if let x = syn[s] { s = x }
        return s
    }
    static func allowed(_ r: Recipe, _ p: Profile) -> Bool {
        if r.allergens.contains(where: { p.allergens.contains($0) }) { return false }
        if (p.vegetarian || p.diet == "vegetarian" || p.diet == "vegan") && r.meat { return false }
        if p.diet == "vegan" && (r.allergens.contains("milk") || r.allergens.contains("egg") || (r.honey ?? false)) { return false }
        for d in p.dislikes where !d.isEmpty { if r.ingredients.contains(where: { $0.name.lowercased().contains(d.lowercased()) }) { return false } }
        return true
    }
    static func share(_ meal: String, count: Int) -> Double {
        if count <= 2 { return meal == "lunch" ? 0.45 : 0.55 }
        switch meal { case "breakfast": return 0.30; case "lunch": return 0.35; default: return 0.35 }   // near even, so protein is spread across meals (Schoenfeld and Aragon 2018)
    }
    /// Picks the recipe whose calories (and protein, when known) sit closest to the share of the day's target.
    static func pick(meal: String, profile p: Profile, targets t: Targets?, count: Int, seed: UInt64, exclude: Set<String>, avoid: String? = nil, light: Bool = false, maxKcal: Int? = nil) -> Recipe? {
        var pool = cat.recipes.filter { $0.meal == meal && allowed($0, p) && $0.id != avoid }
        let quick = pool.filter { $0.minutes <= max(p.cookMinutes, 20) + 15 }
        if quick.count >= 12 { pool = quick }
        if let mk = maxKcal { pool = pool.filter { $0.kcal <= mk }; if pool.isEmpty { return nil } }
        if light { let easy = pool.filter { $0.minutes <= 20 }; if easy.count >= 6 { pool = easy } }
        let liked = pool.filter { r in !Set(r.cuisines).isDisjoint(with: p.cuisines) }
        if liked.count >= 6 { pool = liked }
        var rng = SeededRNG(state: seed)
        pool.shuffle(using: &rng)
        guard let t = t else { return pool.first(where: { !exclude.contains($0.id) }) ?? pool.first }
        let tk = Double(t.kcal) * share(meal, count: count), tp = Double(t.protein) * share(meal, count: count)
        func score(_ r: Recipe) -> Double {
            var s = abs(Double(r.kcal) - tk) / max(1, tk)
            let pw = p.primaryGoal == "lose" ? 1.0 : 0.6   // Lose goal leans on protein dense meals (Jager et al. 2017)
            if let m = macros(r) { s += abs(Double(m.p) - tp) / max(1, tp) * pw } else { s += pw }
            if exclude.contains(r.id) { s += 0.5 }
            return s
        }
        return pool.prefix(60).min(by: { score($0) < score($1) })
    }
    // Units
    static func gpu(_ name: String, _ unit: String) -> Double? {
        if unit == "g" { return 1 }
        guard let n = cat.nutrition[norm(name)] else { return nil }
        return n.u[unit]
    }
    static func fmt(_ q: Double) -> String {
        if q >= 10 { return String(Int(q.rounded())) }
        let s = String(format: "%.1f", q)
        return s.hasSuffix(".0") ? String(s.dropLast(2)) : s
    }
    static func perServing(_ r: Recipe) -> [Ingredient] {
        let n = Double(max(1, r.servings))
        return r.ingredients.map { Ingredient(name: $0.name, qty: $0.qty / n, unit: $0.unit, category: $0.category) }
    }
    /// Inventory pooled in grams (or the recipe's own unit when no conversion exists).
    static func lines(for needs: [Ingredient], inventory: [InvItem]) -> [ShopLine] {
        var agg: [String: (q: Double, cat: String, name: String, unit: String)] = [:]
        for i in needs {
            let k = norm(i.name) + "|" + i.unit
            let cur = agg[k]
            agg[k] = ((cur?.q ?? 0) + i.qty, i.category ?? "Other", norm(i.name), i.unit)
        }
        var poolG: [String: Double] = [:]; var poolU: [String: Double] = [:]
        for inv in inventory {
            let n = norm(inv.name)
            if let g = gpu(n, inv.unit) { poolG[n, default: 0] += inv.qty * g } else { poolU[n + "|" + inv.unit, default: 0] += inv.qty }
        }
        var out: [ShopLine] = []
        for (_, v) in agg.sorted(by: { $0.key < $1.key }) {
            var have = 0.0
            if let g = gpu(v.name, v.unit), g > 0 {
                let needG = v.q * g
                let take = min(poolG[v.name] ?? 0, needG)
                poolG[v.name, default: 0] -= take
                have = take / g
            } else { have = min(v.q, poolU[v.name + "|" + v.unit] ?? 0) }
            out.append(ShopLine(name: v.name, cat: v.cat, unit: v.unit, need: v.q, have: have))
        }
        return out
    }
}

// MARK: Mascot help (stored locally, works offline)
enum HelpText {
    static func help(for id: String) -> Catalog.HelpRec? { Catalog.shared.help[id] }
    /// The exact text the user sees. Titles, intro, numbered steps and closing.
    static func display(_ h: Catalog.HelpRec) -> [String] {
        [h.t, h.i] + h.s.enumerated().map { "\($0.offset + 1). \($0.element)" } + [h.c]
    }
    static let banned: Set<Character> = ["-", "\u{2010}", "\u{2011}", "\u{2012}", "\u{2013}", "\u{2014}", "\u{2015}", "\u{2212}", "\u{2022}", "\u{00B7}", "*", "\u{25CF}"]
    static func violations(_ h: Catalog.HelpRec) -> [String] {
        var v: [String] = []
        let lines = display(h)
        for l in lines where l.contains(where: { banned.contains($0) }) { v.append("dash or bullet: \(l)") }
        if h.s.count < 2 || h.s.count > 8 { v.append("step count \(h.s.count)") }
        for s in h.s where s.split(separator: " ").count > 20 { v.append("long step: \(s)") }
        return v
    }
}

// MARK: Progression (double progression)
struct NextTarget { var kg: Double; var lo: Int; var hi: Int; var note: String; var increase: Bool }

enum ProgressionEngine {
    static let lower: Set<String> = ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"]
    static func range(for ex: Exercise, goal: String) -> (Int, Int) {
        let compound = ["barbell", "machine"].contains(ex.equipment)
        if goal == "strength" { return compound ? (5, 8) : (6, 10) }
        if goal == "muscle" { return compound ? (6, 10) : (8, 12) }
        return compound ? (8, 12) : (10, 15)
    }
    static func step(_ ex: Exercise, _ kg: Double) -> Double {
        if kg <= 0 { return 0 }
        let base = lower.contains(ex.part) ? 5.0 : 2.5
        return max(1.25, min(base, (kg * 0.05 / 1.25).rounded() * 1.25))
    }
    /// history is newest first. Weight goes up only when every set hit the top of the range, was completed with
    /// good effort, and there was no pain. Never forced, never silently rewritten.
    static func next(ex: Exercise, history: [Entry], goal: String) -> NextTarget {
        let (lo, hi) = range(for: ex, goal: goal)
        guard let last = history.first, !last.sets.isEmpty else {
            return NextTarget(kg: 0, lo: lo, hi: hi, note: "First time. Pick a weight you can lift \(lo) times with 2 reps left.", increase: false)
        }
        let kg = last.sets.map { $0.kg }.max() ?? 0
        if last.painFlag == true {
            return NextTarget(kg: kg, lo: lo, hi: hi, note: "You noted pain. Keep it light and gentle. If it stays, ask a professional.", increase: false)
        }
        let done = last.sets.filter { $0.done != false }
        let complete = done.count == last.sets.count && done.count >= 2
        let allTop = complete && done.allSatisfy { $0.reps >= hi }
        let effortOk = done.allSatisfy { ($0.rpe ?? 8) <= 9 } && (last.difficulty ?? 3) <= 4
        if allTop && effortOk {
            let nk = kg + step(ex, kg)
            return NextTarget(kg: nk, lo: lo, hi: hi, note: "You hit \(hi) on every set. Try \(RecipeService.fmt(nk)) kg.", increase: true)
        }
        if history.count >= 2 {
            let a = history[0].sets.reduce(0) { $0 + $1.reps }, b = history[1].sets.reduce(0) { $0 + $1.reps }
            if a < b && (history[0].sets.map { $0.kg }.max() ?? 0) >= (history[1].sets.map { $0.kg }.max() ?? 0) {
                return NextTarget(kg: kg, lo: lo, hi: hi, note: "A bit lower last time. Stay here. A lighter week is an option, your call.", increase: false)
            }
        }
        if !complete { return NextTarget(kg: kg, lo: lo, hi: hi, note: "Finish all your sets at \(RecipeService.fmt(kg)) kg first.", increase: false) }
        return NextTarget(kg: kg, lo: lo, hi: hi, note: "Aim for \(hi) reps on every set, then add weight.", increase: false)
    }
}

// MARK: Routines
enum WorkoutGenerator {
    static let focusParts: [String: [String]] = [
        "full": ["quadriceps", "chest", "lats", "hamstrings", "shoulders", "abdominals"],
        "upper": ["chest", "lats", "shoulders", "middle back", "biceps", "triceps"],
        "lower": ["quadriceps", "hamstrings", "glutes", "calves", "abdominals"],
        "push": ["chest", "shoulders", "triceps"], "pull": ["lats", "middle back", "biceps", "traps"],
        "legs": ["quadriceps", "hamstrings", "glutes", "calves"]
    ]
    static func slots(_ n: Int) -> [(String, String)] {
        switch n {
        case 1: return [("full", "Full body")]
        case 2: return [("full", "Full body A"), ("full", "Full body B")]
        case 3: return [("full", "Full body A"), ("full", "Full body B"), ("full", "Full body C")]
        case 4: return [("upper", "Upper A"), ("lower", "Lower A"), ("upper", "Upper B"), ("lower", "Lower B")]
        case 5: return [("lower", "Lower A"), ("upper", "Upper A"), ("lower", "Lower B"), ("upper", "Upper B"), ("full", "Full body")]
        default: return [("push", "Push A"), ("pull", "Pull A"), ("legs", "Legs A"), ("push", "Push B"), ("pull", "Pull B"), ("legs", "Legs B")]
        }
    }
    static func allowedEquipment(_ p: Profile) -> Set<String> {
        var s: Set<String> = ["body only"]
        if !p.kit.isEmpty { s.formUnion(p.kit); return s }
        switch p.location {
        case "home": s.formUnion(["dumbbell", "bands", "kettlebells", "exercise ball", "bench or box"])
        case "gym", "both": s.formUnion(["machine", "barbell", "dumbbell", "cable", "kettlebells", "e-z curl bar", "bench or box"])
        default: break
        }
        if p.equipment == "body" && p.kit.isEmpty && p.location != "gym" && p.location != "both" { return ["body only"] }
        return s
    }
    static func levelOk(_ lvl: String, _ exp: String) -> Bool {
        if exp == "beginner" { return lvl == "beginner" }
        if exp == "intermediate" { return lvl != "expert" }
        return true
    }
    static let order = ["barbell": 0, "machine": 1, "dumbbell": 2, "cable": 3, "kettlebells": 4, "body only": 5]
    static func kindOf(_ k: String) -> String { k == "lower" ? "legs" : k }
    static func cardioWanted(_ p: Profile) -> Bool { p.trainType == "mixed" || p.trainType == "general" || p.primaryGoal == "lose" || p.primaryGoal == "fitter" }
    static func extraSession(kind: String, name: String, day: Int, p: Profile, exercises: [Exercise], eq: Set<String>, block: Int, index: Int) -> Routine {
        let cat = kind == "cardio" ? "cardio" : "stretching"
        var pool = exercises.filter { $0.category == cat && ($0.equipment == "other" || $0.equipment == "body only" || eq.contains($0.equipment)) && levelOk($0.level, p.experience) }
            .sorted { ($0.anim != nil ? 0 : 1, $0.name) < ($1.anim != nil ? 0 : 1, $1.name) }
        if pool.isEmpty { pool = exercises.filter { $0.category == cat }.sorted { $0.name < $1.name } }
        let want = kind == "cardio" ? 2 : 6
        var picks: [String] = []
        if kind == "mobility" {
            for part in ["hamstrings", "quadriceps", "shoulders", "lower back", "chest", "glutes", "calves", "lats"] {
                if let e = pool.filter({ $0.part == part && !picks.contains($0.id) }).dropFirst(block - 1 > 0 ? (block - 1) % 2 : 0).first ?? pool.first(where: { $0.part == part && !picks.contains($0.id) }) { picks.append(e.id) }
                if picks.count >= want { break }
            }
        } else if !pool.isEmpty {
            for k in 0..<want { picks.append(pool[(index + k + block - 1) % pool.count].id) }
            picks = Array(NSOrderedSet(array: picks)) as? [String] ?? picks
        }
        let focus = kind == "cardio" ? ["cardio"] : ["mobility"]
        return Routine(name: name, weekday: day, focus: focus, exIds: picks, customized: false, block: block, week: 1, kind: kind)
    }
    static func generate(profile p: Profile, exercises: [Exercise], block: Int = 1) -> [Routine] {
        let days = p.trainDays.sorted { ($0 + 5) % 7 < ($1 + 5) % 7 }
        // Rest is planned, not earned: at most 5 lifting days; a 6th chosen day becomes mobility and a 7th stays a planned rest day.
        let liftDays = Array(days.prefix(5))
        let mobilityDay: Int? = days.count >= 6 ? days[5] : nil
        let withCardio = cardioWanted(p) && liftDays.count >= 3
        let lifts = withCardio ? liftDays.count - 1 : liftDays.count
        let sl = slots(max(1, lifts))
        let eq = allowedEquipment(p)
        var n = max(3, min(8, p.minutes / 8))
        if p.experience == "beginner" { n = min(n, 5) }
        var out: [Routine] = []
        for (i, d) in liftDays.enumerated() {
            if withCardio && i == liftDays.count - 1 {
                out.append(extraSession(kind: "cardio", name: "Cardio", day: d, p: p, exercises: exercises, eq: eq, block: block, index: i)); continue
            }
            let (kind, base) = sl[i % sl.count]
            let name = i >= sl.count ? base.replacingOccurrences(of: " A", with: " C").replacingOccurrences(of: " B", with: " C") : base
            var parts = focusParts[kind] ?? focusParts["full"]!
            let partCount = parts.count
            parts = parts.filter { p.bodyFocus[$0] != "less" || partCount <= 3 }
            let prio = parts.filter { p.bodyFocus[$0] == "priority" }
            var want = parts
            while want.count < n { want.append(contentsOf: prio.isEmpty ? parts : prio); if want.count > 40 { break } }
            want = Array(want.prefix(n))
            var picks: [String] = []
            for (k, part) in want.enumerated() {
                let pool = exercises.filter {
                    $0.part == part && eq.contains($0.equipment) && levelOk($0.level, p.experience) && ($0.category ?? "strength") == "strength" && !picks.contains($0.id)
                }.sorted { (($0.anim != nil ? 0 : 1), order[$0.equipment] ?? 9, $0.name) < (($1.anim != nil ? 0 : 1), order[$1.equipment] ?? 9, $1.name) }
                if pool.isEmpty { continue }
                let span = min(pool.count, 6)
                picks.append(pool[(i + k + (k % 3 == 0 ? block - 1 : 0)) % span].id)
            }
            var focus: [String] = []
            for id in picks { if let e = exercises.first(where: { $0.id == id }), !focus.contains(e.part) { focus.append(e.part) } }
            out.append(Routine(name: name, weekday: d, focus: focus, exIds: picks, customized: false, block: block, week: 1, kind: kindOf(kind)))
        }
        if let md = mobilityDay {
            out.append(extraSession(kind: "mobility", name: "Mobility", day: md, p: p, exercises: exercises, eq: eq, block: block, index: 0))
        }
        return out
    }
    /// Sets per exercise follow the person's experience (Schoenfeld et al. 2017: start modest, add volume with progress).
    static func setCount(for ex: Exercise?, profile p: Profile) -> Int {
        if let c = ex?.category, c == "cardio" || c == "stretching" { return 1 }
        switch p.experience { case "advanced": return 4; case "intermediate": return 3; default: return 2 }
    }
    /// Honest estimate only when body weight is known: about 4.5 METs for resistance training.
    static func kcalEstimate(minutes: Int, weightKg: Double) -> Int? {
        guard weightKg > 0 else { return nil }
        return Int((4.5 * weightKg * Double(minutes) / 60 / 5).rounded()) * 5
    }
}
