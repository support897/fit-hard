import SwiftUI

/// One merged view of a day for the calendar, built from the real records (plan, routines, events, doses, tasks).
struct CalItem: Identifiable, Hashable {
    let id: String; let time: String; let title: String; let detail: String
    let cat: String        // training | meals | recovery | medication | personal
    let icon: String; let done: Bool; let eventID: UUID?; let routineID: UUID?
    var tone: String? = nil
    var colorKey: String { tone ?? cat }
}

extension Color {
    static func cat(_ c: String) -> Color {
        let dark = Color.isDark
        switch c {
        case "training": return Color(hex: dark ? 0x7BD389 : 0x2F7A44)
        case "meals": return Color(hex: dark ? 0xF28DB2 : 0xB8467A)
        case "recovery": return Color(hex: dark ? 0x8DB8EE : 0x2F63A0)
        case "medication": return Color(hex: dark ? 0xC7A0EE : 0x7343A0)
        default: return Color(hex: dark ? 0xF0A868 : 0xA85F1B)
        }
    }
    static let catNames: [(String, String, String)] = [("training", "Training", "dumbbell"), ("meals", "Meals", "fork.knife"), ("recovery", "Recovery", "moon"), ("medication", "Medication", "cross.case"), ("personal", "Personal", "person")]
}

extension Store {
    func mealTime(_ meal: String) -> String { meal == "breakfast" ? s.settings.breakfast : meal == "lunch" ? s.settings.lunch : s.settings.dinner }
    func line(_ r: Recipe) -> String {
        let p = RecipeService.macros(r).map { String(format: NSLocalizedString("%lld g protein", comment: ""), $0.p) } ?? NSLocalizedString("protein not available", comment: "")
        return "\(r.kcal) kcal · \(p) · \(r.minutes) min"
    }
    func routine(on day: String) -> Routine? {
        guard let d = dateFromKey(day) else { return nil }
        let wd = Calendar.current.component(.weekday, from: d)
        // Swap today (build 36, item C): a routine the person picked for this exact day wins
        // over the weekday plan. It is their call for one day; the block itself is untouched.
        if let rid = s.dayRoutine[day], let picked = s.routines.first(where: { $0.id.uuidString == rid }) {
            var r = picked
            if s.skipped.contains("\(day)|\(r.id.uuidString)") { return nil }
            if s.lightDays.contains(day), r.trainType != .mobility, r.exIds.count > 3 { r.exIds = Array(r.exIds.prefix(3)); r.name += NSLocalizedString(", lighter", comment: "") }
            return r
        }
        guard var r = s.routines.first(where: { $0.weekday == wd }) else { return nil }
        if s.skipped.contains("\(day)|\(r.id.uuidString)") { return nil }
        // A Bad check-in makes that day's workout an easier one: the first three exercises, two sets each (see TrainingMode).
        if s.lightDays.contains(day), r.trainType != .mobility, r.exIds.count > 3 { r.exIds = Array(r.exIds.prefix(3)); r.name += NSLocalizedString(", lighter", comment: "") }
        return r
    }
    func calItems(on day: String) -> [CalItem] {
        var out: [CalItem] = []
        for meal in Lists.meals {
            if let r = s.plan[day]?[meal].flatMap({ cat.recipe($0) }) {
                let done = day == today ? (s.eaten[day] ?? []).contains(meal) : (s.eaten[day] ?? []).contains(meal)
                out.append(CalItem(id: "meal-\(day)-\(meal)", time: mealTime(meal), title: "\(NSLocalizedString(MealKind(rawValue: meal)?.label ?? meal.capitalized, comment: "")): \(r.name)", detail: line(r), cat: "meals", icon: "m-" + meal, done: done, eventID: nil, routineID: nil, tone: "meal." + meal))
            }
        }
        if let r = routine(on: day) {
            let done = s.workouts.contains { dayKey($0.date) == day }
            out.append(CalItem(id: "train-\(day)-\(r.id)", time: s.profile.workoutTime, title: r.name, detail: String(format: NSLocalizedString("%@ · %lld exercises · %lld min", comment: ""), NSLocalizedString(r.trainType.label, comment: ""), r.exIds.count, s.profile.minutes), cat: "training", icon: r.trainType.icon, done: done, eventID: nil, routineID: r.id, tone: r.trainType.tone))
        }
        for e in s.events where e.day == day {
            var icon = e.cat == "training" ? "dumbbell" : e.cat == "meals" ? "fork.knife" : e.cat == "recovery" ? "moon" : e.cat == "medication" ? "cross.case" : "person"
            var tone: String? = nil
            if e.cat == "training" {
                let t = e.link.flatMap { id in s.routines.first { $0.id.uuidString == id } }?.trainType ?? TrainType.infer(name: e.title)
                icon = t.icon; tone = t.tone
            } else if e.cat == "meals" {
                let low = e.title.lowercased()
                let k = low.contains("breakfast") ? "breakfast" : low.contains("lunch") ? "lunch" : low.contains("dinner") ? "dinner" : "snacks"
                icon = "m-" + k; tone = "meal." + k
            }
            out.append(CalItem(id: "ev-\(e.id)", time: e.time, title: e.title, detail: "\(e.minutes) min" + (e.notes.isEmpty ? "" : " · \(e.notes)"), cat: e.cat, icon: icon, done: e.done, eventID: e.id, routineID: e.link.flatMap { UUID(uuidString: $0) }, tone: tone))
        }
        // Rest is planned, not earned: a day with no session shows as a planned rest day.
        if s.onboarded, routine(on: day) == nil, !s.restDays.contains(day), !s.events.contains(where: { $0.day == day && $0.cat == "training" }) {
            out.append(CalItem(id: "plannedrest-\(day)", time: "08:00", title: NSLocalizedString("Rest", comment: ""), detail: NSLocalizedString("Planned rest day", comment: ""), cat: "recovery", icon: TrainType.rest.icon, done: false, eventID: nil, routineID: nil, tone: TrainType.rest.tone))
        }
        if s.restDays.contains(day) { out.append(CalItem(id: "rest-\(day)", time: "08:00", title: NSLocalizedString("Rest day", comment: ""), detail: NSLocalizedString("Recovery counts", comment: ""), cat: "recovery", icon: "moon", done: true, eventID: nil, routineID: nil)) }
        for m in s.meds where !m.isPaused {
            for t in m.allTimes {
                let st = s.medLogs.last(where: { $0.medId == m.id && $0.day == day })?.status
                // Due time and taken time always stand apart (Item 6 design, frame 3).
                let detail: String
                if st == "taken", let at = medTakenAt(m, day: day) {
                    detail = String(format: NSLocalizedString("Due %@ · Taken %@", comment: ""), t, timeString(at))
                } else if st == "not_taken" {
                    detail = String(format: NSLocalizedString("Due %@ · Skipped", comment: ""), t)
                } else {
                    detail = String(format: NSLocalizedString("Due %@ · not marked yet", comment: ""), t)
                }
                out.append(CalItem(id: "med-\(m.id)-\(t)-\(day)", time: t, title: String(format: NSLocalizedString("Supplement · %@", comment: ""), m.name), detail: detail, cat: "medication", icon: "cross.case", done: st == "taken", eventID: nil, routineID: nil))
            }
        }
        for t in s.tasks where t.day == day {
            out.append(CalItem(id: "task-\(t.id)", time: t.time ?? "09:00", title: t.title, detail: NSLocalizedString("To do", comment: ""), cat: "personal", icon: "checklist", done: t.done, eventID: nil, routineID: nil))
        }
        for a in s.appts where dayKey(a.date) == day {
            out.append(CalItem(id: "appt-\(a.id)", time: timeString(a.date), title: a.title, detail: NSLocalizedString("Appointment", comment: ""), cat: "personal", icon: "calendar", done: false, eventID: nil, routineID: nil))
        }
        return out.sorted { ($0.time, $0.id) < ($1.time, $1.id) }
    }
    /// Adds an event unless the same title, day and time already exist.
    @discardableResult func addEvent(_ e: CalEvent) -> Bool {
        if s.events.contains(where: { $0.title == e.title && $0.day == e.day && $0.time == e.time }) { say(NSLocalizedString("Already on your calendar", comment: "")); return false }
        s.events.append(e); Notifier.rebuild(self); return true
    }
    func skipWorkout(day: String, routine r: Routine) { s.skipped.append("\(day)|\(r.id.uuidString)"); Notifier.rebuild(self) }
    func moveWorkout(from day: String, routine r: Routine, to newDay: String) {
        skipWorkout(day: day, routine: r)
        _ = addEvent(CalEvent(title: r.name, day: newDay, time: s.profile.workoutTime, minutes: s.profile.minutes, cat: "training", kind: "workout", link: r.id.uuidString))
    }
    func regenerateWeek() {
        s.skipped = []; s.plan = [:]; generatePlan(); generateRoutine(); Notifier.rebuild(self)
    }
    func markWorkoutDone(routineID: String?) {
        for i in s.events.indices where s.events[i].day == today && s.events[i].cat == "training" && (routineID == nil || s.events[i].link == routineID) { s.events[i].done = true }
    }

    // MARK: Nutrition today
    var eatenMacros: (kcal: Int, p: Int) {
        var k = 0, p = 0
        var kf = 0.0, pf = 0.0
        for m in s.eaten[today] ?? [] { if let r = s.plan[today]?[m].flatMap({ cat.recipe($0) }) { kf += Double(r.kcal) * portion(m); pf += Double(RecipeService.macros(r)?.p ?? 0) * portion(m) } }
        k = Int(kf.rounded()); p = Int(pf.rounded())
        return (k, p)
    }

    // MARK: Shopping (built only from planned recipes, minus what is in the kitchen)
    func shoppingLines(days: Int = 7) -> [ShopLine] {
        var needs: [Ingredient] = []
        for i in 0..<days {
            guard let d = Calendar.current.date(byAdding: .day, value: i, to: Date()) else { continue }
            for meal in Lists.meals { if let r = s.plan[dayKey(d)]?[meal].flatMap({ cat.recipe($0) }) { needs += RecipeService.perServing(r) } }
        }
        return RecipeService.lines(for: needs, inventory: s.inventory)
    }
    func buyQty(_ l: ShopLine) -> Double { s.shopQty[l.id] ?? l.buy }
    func markAvailable(_ l: ShopLine) {
        s.inventory.append(InvItem(name: l.name, qty: max(buyQty(l), 0.1), unit: l.unit)); s.shopQty[l.id] = nil
    }
}
