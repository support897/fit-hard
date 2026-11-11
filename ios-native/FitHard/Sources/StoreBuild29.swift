import SwiftUI

/// Build 29: bad day changes the plan, light logging, "why this meal", re-personalisation.
extension Store {
    static let personalizationRound = 3
    var needsPersonalization: Bool { s.onboarded && s.personalizationVersion < Store.personalizationRound }
    var isLightToday: Bool { s.lightDays.contains(today) }

    // MARK: Check-in that really changes the day
    func setCheckin(_ c: String?) {
        let day = today
        let prev = s.checkins[day]
        if let c = c { s.checkins[day] = c } else { s.checkins[day] = nil }
        if c == "bad" { applyLightDay(day) } else if prev == "bad" { undoLightDay(day) }
    }
    /// Lighter meals (about 12 percent fewer kcal, protein kept, quick to cook) for meals not yet eaten, and an easier workout (see `routine(on:)`).
    /// Doses, reminders for doses and the calendar are not touched.
    func applyLightDay(_ day: String) {
        guard !s.lightDays.contains(day) else { return }
        s.planBackup[day] = s.plan[day] ?? [:]
        let eaten = Set(s.eaten[day] ?? [])
        if let t = targets {
            let light = Targets(kcal: Int(Double(t.kcal) * 0.88), protein: t.protein, carbs: t.carbs, fat: t.fat)
            let seed = UInt64(abs(day.hashValue % 100000) + 5)
            var row = s.plan[day] ?? [:]
            for (mi, meal) in mealTypes.enumerated() where !eaten.contains(meal) {
                if let r = RecipeService.pick(meal: meal, profile: s.profile, targets: light, count: mealTypes.count, seed: seed &+ UInt64(mi * 13 + 1),
                                              exclude: Set(row.values), avoid: row[meal], light: true,
                                              maxKcal: row[meal].flatMap { cat.recipe($0)?.kcal }.map { $0 - 1 }) { row[meal] = r.id }
            }
            s.plan[day] = row
        } else {
            // No targets (profile incomplete or targets off): pick the quickest-to-cook suitable recipe instead.
            var row = s.plan[day] ?? [:]
            for meal in mealTypes where !eaten.contains(meal) {
                let pool = RecipeService.cat.recipes.filter { $0.meal == meal && RecipeService.allowed($0, s.profile) }.sorted { ($0.minutes, $0.id) < ($1.minutes, $1.id) }
                if let r = pool.first(where: { $0.id != row[meal] && $0.kcal <= (row[meal].flatMap { cat.recipe($0)?.kcal } ?? Int.max) }) { row[meal] = r.id }
            }
            s.plan[day] = row
        }
        s.lightDays.append(day)
        Notifier.rebuild(self)
    }
    func undoLightDay(_ day: String) {
        guard let i = s.lightDays.firstIndex(of: day) else { return }
        let eaten = Set(s.eaten[day] ?? [])
        if let old = s.planBackup[day] {
            var row = s.plan[day] ?? [:]
            for (meal, id) in old where !eaten.contains(meal) { row[meal] = id }
            s.plan[day] = row
        }
        s.planBackup[day] = nil
        s.lightDays.remove(at: i)
        Notifier.rebuild(self)
    }
    func reapplyLightIfNeeded() {
        let day = today
        if s.lightDays.contains(day) { s.lightDays.removeAll { $0 == day }; s.planBackup[day] = nil; applyLightDay(day) }
    }

    // MARK: Log lightly
    func portion(_ meal: String, day: String? = nil) -> Double {
        let d = day ?? today
        guard (s.eaten[d] ?? []).contains(meal) else { return 0 }
        return s.portions[d]?[meal] ?? 1.0
    }
    func logPortion(_ meal: String, _ f: Double) {
        var e = s.eaten[today] ?? []
        if !e.contains(meal) { e.append(meal) }
        s.eaten[today] = e
        s.portions[today, default: [:]][meal] = f
        haptic()
    }

    // MARK: Why this meal (only facts that are true for this user and this recipe)
    func whyThisMeal(_ r: Recipe, meal: String, day: String? = nil) -> [String] {
        let p = s.profile
        var out: [String] = []
        let share = RecipeService.share(meal, count: mealTypes.count)
        if let t = targets {
            let want = Int(Double(t.kcal) * share)
            out.append(String(format: NSLocalizedString("%lld kcal, near the %lld kcal planned for %@ out of your %lld kcal day.", comment: ""), r.kcal, want, NSLocalizedString(MealKind(rawValue: meal)?.label ?? meal, comment: ""), t.kcal))
            if let m = RecipeService.macros(r) { out.append(String(format: NSLocalizedString("%lld g protein. Your day aims for %lld g, spread across %lld meals.", comment: ""), m.p, t.protein, mealTypes.count)) }
        } else if let m = RecipeService.macros(r) {
            out.append(String(format: NSLocalizedString("%lld g protein and %lld kcal.", comment: ""), m.p, r.kcal))
        }
        if p.cookMinutes > 0 && r.minutes <= p.cookMinutes { out.append(String(format: NSLocalizedString("Ready in %lld min, inside the %lld min you set for cooking.", comment: ""), r.minutes, p.cookMinutes)) }
        let liked = Set(r.cuisines).intersection(p.cuisines)
        if !liked.isEmpty { out.append(String(format: NSLocalizedString("Matches a cuisine you like: %@.", comment: ""), liked.sorted().map { cuisineName($0) }.joined(separator: ", "))) }
        if !p.allergens.isEmpty && !r.allergens.contains(where: { p.allergens.contains($0) }) { out.append(NSLocalizedString("Has none of the allergens you listed.", comment: "")) }
        if p.diet == "vegan" && RecipeService.allowed(r, p) { out.append(NSLocalizedString("Fits your vegan choice.", comment: "")) }
        else if (p.vegetarian || p.diet == "vegetarian") && !r.meat { out.append(NSLocalizedString("Fits your vegetarian choice.", comment: "")) }
        if s.lightDays.contains(day ?? today), s.plan[day ?? today]?[meal] == r.id { out.append(NSLocalizedString("Picked lighter and quicker because you checked in as Bad today.", comment: "")) }
        if out.isEmpty { out.append(NSLocalizedString("A suitable \(meal) from your recipes.", comment: "")) }
        return out
    }
}

extension Store {
    /// Yesterday's planned session that did not happen. Offered kindly: move it to today or let it go. Never shown after a skip or a rest day.
    var missedSession: Routine? {
        guard s.onboarded, let y = Calendar.current.date(byAdding: .day, value: -1, to: Date()) else { return nil }
        let k = dayKey(y)
        guard let r = routine(on: k) else { return nil }
        if s.workouts.contains(where: { dayKey($0.date) == k }) || s.restDays.contains(k) { return nil }
        if !s.blockStart.isEmpty && s.blockStart > k { return nil }
        return r
    }
    func doMissedSessionToday(_ r: Routine) {
        guard let y = Calendar.current.date(byAdding: .day, value: -1, to: Date()) else { return }
        moveWorkout(from: dayKey(y), routine: r, to: today); say("Moved to today")
    }
    func letMissedSessionGo(_ r: Routine) {
        guard let y = Calendar.current.date(byAdding: .day, value: -1, to: Date()) else { return }
        skipWorkout(day: dayKey(y), routine: r); say("No problem. On with today.")
    }
}

// MARK: Build 32: the user's own name, and nothing else
extension Store {
    /// True only when THIS signed-in user saved a name in their own profile. There is no default name.
    var hasName: Bool { !s.profile.name.trimmingCharacters(in: .whitespaces).isEmpty }
}

// MARK: Build 32: home page numbers (streak, week goal, consistency) and the four trackers
extension Store {
    /// Saved together with the days pick. The home goal count, bar and message read this.
    func saveWeekGoal() { s.profile.weekGoal = max(1, s.profile.trainDays.count) }
    var weekGoalCount: Int { s.profile.weekGoal > 0 ? s.profile.weekGoal : max(1, s.profile.trainDays.count) }
    var workoutsThisWeek: Int { weeks(1).last?.sessions ?? 0 }
    private var monCal: Calendar { var c = Calendar(identifier: .gregorian); c.firstWeekday = 2; return c }

    /// A day counts when anything was logged: a workout, a meal, water, a planned rest day or a check in.
    func isActiveDay(_ key: String) -> Bool {
        if s.restDays.contains(key) || s.checkins[key] != nil { return true }
        if (s.water[key] ?? 0) > 0 || !(s.eaten[key] ?? []).isEmpty { return true }
        return s.workouts.contains { dayKey($0.date) == key }
    }
    /// Days in a row with something logged. Today may still be empty without breaking the run.
    var streak: Int {
        var n = 0
        var d = Date()
        if !isActiveDay(dayKey(d)) { d = monCal.date(byAdding: .day, value: -1, to: d) ?? d }
        while n < 3650 && isActiveDay(dayKey(d)) { n += 1; d = monCal.date(byAdding: .day, value: -1, to: d) ?? d }
        return n
    }
    /// Active days out of the last 14, as a whole percent.
    var consistency: Int {
        var active = 0
        for i in 0..<14 { if let d = monCal.date(byAdding: .day, value: -i, to: Date()), isActiveDay(dayKey(d)) { active += 1 } }
        return Int((Double(active) / 14.0 * 100).rounded())
    }

    enum Tracker: String, CaseIterable, Identifiable {
        case weight, water, sleep, steps
        var id: String { rawValue }
        var title: String { switch self { case .weight: return "Weight"; case .water: return "Water"; case .sleep: return "Sleep"; case .steps: return "Steps" } }
        var icon: String { switch self { case .weight: return "scalemass"; case .water: return "drop"; case .sleep: return "moon.stars"; case .steps: return "footsteps" } }
        var unit: String { switch self { case .weight: return "kg"; case .water: return "ml"; case .sleep: return "h"; case .steps: return "" } }
    }
    /// The seven day keys of this week (offset 0) or last week (offset -1), Monday first.
    func weekKeys(_ offset: Int) -> [String] {
        let start = monCal.dateInterval(of: .weekOfYear, for: monCal.date(byAdding: .weekOfYear, value: offset, to: Date()) ?? Date())?.start ?? Date()
        return (0..<7).compactMap { monCal.date(byAdding: .day, value: $0, to: start) }.map { dayKey($0) }
    }
    /// Weight: the latest entry of the week. Water, sleep and steps: the average of the days that have a value. nil when nothing was logged.
    func trackerValue(_ t: Tracker, offset: Int) -> Double? {
        let keys = weekKeys(offset)
        func avg(_ v: [Double]) -> Double? { v.isEmpty ? nil : v.reduce(0, +) / Double(v.count) }
        switch t {
        case .weight: return s.body.filter { keys.contains($0.day) }.compactMap { $0.weight }.last
        case .water: return avg(keys.compactMap { s.water[$0] }.filter { $0 > 0 }.map { Double($0) })
        case .sleep: return avg(keys.compactMap { s.sleep[$0] }.filter { $0 > 0 })
        case .steps: return avg(keys.compactMap { s.steps[$0] }.filter { $0 > 0 }.map { Double($0) })
        }
    }
    func trackerText(_ t: Tracker, offset: Int) -> String {
        guard let v = trackerValue(t, offset: offset) else { return "-" }
        switch t {
        case .weight: return RecipeService.fmt(v) + " kg"
        case .water: return "\(Int(v.rounded())) ml"
        case .sleep: return RecipeService.fmt((v * 10).rounded() / 10) + " h"
        case .steps: return "\(Int(v.rounded()))"
        }
    }
    /// Typed in by the user. Weight also lands in the body log so Progress shows it.
    func logTracker(_ t: Tracker, value: Double) {
        guard value > 0 else { return }
        switch t {
        case .weight:
            if let i = s.body.firstIndex(where: { $0.day == today }) { s.body[i].weight = value } else { s.body.append(BodyEntry(day: today, weight: value)) }
        case .water: s.water[today] = Int(value)
        case .sleep: s.sleep[today] = min(24, value)
        case .steps: s.steps[today] = Int(value)
        }
        haptic()
    }
}

// MARK: Build 32: peptides asked on workout start. The user types it; the app only records it, never advises.
extension Store {
    func logPeptide(_ text: String) {
        let n = text.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        let existing = s.meds.first { $0.name.caseInsensitiveCompare(n) == .orderedSame }
        let m = existing ?? Med(name: n, frequency: "As directed", paused: true)
        if existing == nil { s.meds.append(m) }
        logMed(m, "taken")
    }
}
