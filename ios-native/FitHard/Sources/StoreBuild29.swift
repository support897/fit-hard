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
