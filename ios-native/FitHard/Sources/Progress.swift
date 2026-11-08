import Foundation

/// Progress is only ever compared with your own past. No shame, no punishment: rest counts.
struct WeekStat: Identifiable { let id: String; let start: Date; let sessions: Int; let rest: Int }

extension Store {
    private var cal: Calendar { var c = Calendar(identifier: .gregorian); c.firstWeekday = 2; return c }
    func weekStart(_ d: Date) -> Date { cal.dateInterval(of: .weekOfYear, for: d)?.start ?? d }

    func weeks(_ n: Int = 8) -> [WeekStat] {
        let thisWeek = weekStart(Date())
        return (0..<n).reversed().compactMap { i -> WeekStat? in
            guard let st = cal.date(byAdding: .weekOfYear, value: -i, to: thisWeek),
                  let en = cal.date(byAdding: .day, value: 7, to: st) else { return nil }
            let sessions = s.workouts.filter { $0.date >= st && $0.date < en }.count
            let rest = s.restDays.filter { k in if let d = dateFromKey(k) { return d >= st && d < en } else { return false } }.count
            return WeekStat(id: dayKey(st), start: st, sessions: sessions, rest: rest)
        }
    }
    var weekSummary: String {
        guard let cur = weeks(1).last else { return "" }
        let planned = s.profile.trainDays.count
        if cur.sessions == 0 { return "A fresh week. Your next step is ready when you are." }
        return "\(cur.sessions) workout\(cur.sessions == 1 ? "" : "s") this week" + (planned > 0 ? " · you planned \(planned). Fewer is fine too." : "")
    }
    var activeWeeks: Int { weeks(52).filter { $0.sessions > 0 || $0.rest > 0 }.count }
    var currentRun: Int {
        var n = 0
        for w in weeks(52).reversed() { if w.sessions > 0 || w.rest > 0 { n += 1 } else if n == 0 && w.id == weeks(1).last?.id { continue } else { break } }
        return n
    }
    var isRestToday: Bool { s.restDays.contains(today) }
    func toggleRest() { if let i = s.restDays.firstIndex(of: today) { s.restDays.remove(at: i) } else { s.restDays.append(today) }; haptic() }

    var milestones: (earned: [String], next: String?) {
        let n = s.workouts.count
        let defs: [(Int, String)] = [(1, "First workout"), (5, "5 workouts"), (10, "10 workouts"), (25, "25 workouts"), (50, "50 workouts"), (100, "100 workouts")]
        let earned = defs.filter { n >= $0.0 }.map { $0.1 }
        return (earned, defs.first(where: { n < $0.0 })?.1)
    }
    struct PB: Identifiable { let id: String; let name: String; let text: String }
    func personalBests() -> [PB] {
        var best: [String: (Double, Int)] = [:]
        for w in s.workouts { for e in w.entries { for st in e.sets {
            let cur = best[e.exerciseId]
            if cur == nil || st.kg > cur!.0 || (st.kg == cur!.0 && st.reps > cur!.1) { best[e.exerciseId] = (st.kg, st.reps) }
        } } }
        return best.compactMap { k, v in cat.exercise(k).map { PB(id: k, name: $0.name, text: v.0 > 0 ? "\(v.1) × \(v.0.formatted()) kg" : "\(v.1) reps") } }.sorted { $0.name < $1.name }
    }
    var loggedExercises: [Exercise] {
        var ids: [String] = []
        for w in s.workouts.sorted(by: { $0.date > $1.date }) { for e in w.entries where !ids.contains(e.exerciseId) { ids.append(e.exerciseId) } }
        return ids.compactMap { cat.exercise($0) }
    }
    struct Point: Identifiable { let id = UUID(); let date: Date; let value: Double; let reps: Int }
    func strengthSeries(_ id: String) -> [Point] {
        s.workouts.sorted { $0.date < $1.date }.compactMap { w in
            guard let e = w.entries.first(where: { $0.exerciseId == id }), let top = e.sets.max(by: { ($0.kg, $0.reps) < ($1.kg, $1.reps) }) else { return nil }
            return Point(date: w.date, value: top.kg > 0 ? top.kg : Double(top.reps), reps: top.reps)
        }
    }

    // Treats
    var treatsToday: [Treat] { s.treats.filter { $0.day == today } }
    func addTreat(_ name: String, _ kcal: Int?) {
        let n = name.trimmingCharacters(in: .whitespaces); guard !n.isEmpty else { return }
        s.treats.append(Treat(day: today, name: n, kcal: (kcal ?? 0) > 0 ? kcal : nil)); haptic(); say("Saved. All fine.")
    }
    func quickTreats(_ text: String) {
        for line in text.split(whereSeparator: \.isNewline).map({ String($0).trimmingCharacters(in: .whitespaces) }) where !line.isEmpty {
            let parts = line.split(separator: " ")
            if let last = parts.last, let k = Int(last), parts.count > 1 { addTreat(parts.dropLast().joined(separator: " "), k) } else { addTreat(line, nil) }
        }
    }
    var usualTreats: [Treat] {
        var counts: [String: Int] = [:]; var latest: [String: Treat] = [:]
        for t in s.treats { let k = t.name.lowercased(); counts[k, default: 0] += 1; latest[k] = t }
        return counts.keys.sorted { counts[$0]! > counts[$1]! }.prefix(6).compactMap { latest[$0] }
    }

    // Habits
    func habitDone(_ h: Habit, _ day: String? = nil) -> Bool { h.done.contains(day ?? today) }
    func toggleHabit(_ h: Habit) {
        guard let i = s.habits.firstIndex(where: { $0.id == h.id }) else { return }
        if let j = s.habits[i].done.firstIndex(of: today) { s.habits[i].done.remove(at: j) } else { s.habits[i].done.append(today); haptic() }
    }

    // Challenge: tasks tick themselves from what you already log
    func challengeDone(_ task: String, day: String) -> Bool {
        switch task {
        case "workout": return s.workouts.contains { dayKey($0.date) == day }
        case "meals": return !(s.eaten[day] ?? []).isEmpty
        case "water": return (s.water[day] ?? 0) >= s.profile.waterGoal
        case "checkin": return s.checkins[day] != nil
        default: return false
        }
    }
    func startChallenge(days: Int, tasks: [String]) { s.challenge = Challenge(start: today, days: days, tasks: tasks); haptic(.medium) }
    func endChallenge() { s.challenge = nil }
    var challengeDayNumber: Int {
        guard let c = s.challenge, let st = dateFromKey(c.start) else { return 0 }
        return (Calendar.current.dateComponents([.day], from: st, to: Date()).day ?? 0) + 1
    }

    // Calendar
    func items(on day: String) -> (meals: [Recipe], workout: Bool, plannedWorkout: Bool, tasks: [TaskItem], appts: [Appt]) {
        let meals = Lists.meals.compactMap { m in s.plan[day]?[m].flatMap { cat.recipe($0) } }
        let did = s.workouts.contains { dayKey($0.date) == day }
        var planned = false
        if let d = dateFromKey(day) { planned = !(s.routine[String(Calendar.current.component(.weekday, from: d))] ?? []).isEmpty }
        return (meals, did, planned, s.tasks.filter { $0.day == day }, s.appts.filter { dayKey($0.date) == day })
    }

    // Fridge
    func fridgeMatches(_ have: Set<String>) -> [(Recipe, Int, Int)] {
        guard !have.isEmpty else { return [] }
        return cat.recipes.compactMap { r -> (Recipe, Int, Int)? in
            if r.allergens.contains(where: { s.profile.allergens.contains($0) }) || (s.profile.vegetarian && r.meat) { return nil }
            let names = Set(r.ingredients.map { $0.name })
            let hit = names.intersection(have).count
            return hit == 0 ? nil : (r, hit, names.count)
        }.sorted { Double($0.1) / Double($0.2) > Double($1.1) / Double($1.2) }
    }
}
