import SwiftUI

/// One merged view of a day for the calendar, built from the real records (plan, routines, events, doses, tasks).
struct CalItem: Identifiable, Hashable {
    let id: String; let time: String; let title: String; let detail: String
    let cat: String        // training | meals | recovery | medication | personal
    let icon: String; let done: Bool; let eventID: UUID?; let routineID: UUID?
}

extension Color {
    static func cat(_ c: String) -> Color {
        let dark = Color.pal == 1 || Color.pal == 2
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
        let p = RecipeService.macros(r).map { "\($0.p) g protein" } ?? "protein not available"
        return "\(r.kcal) kcal · \(p) · \(r.minutes) min"
    }
    func routine(on day: String) -> Routine? {
        guard let d = dateFromKey(day) else { return nil }
        let wd = Calendar.current.component(.weekday, from: d)
        guard let r = s.routines.first(where: { $0.weekday == wd }) else { return nil }
        return s.skipped.contains("\(day)|\(r.id.uuidString)") ? nil : r
    }
    func calItems(on day: String) -> [CalItem] {
        var out: [CalItem] = []
        for meal in Lists.meals {
            if let r = s.plan[day]?[meal].flatMap({ cat.recipe($0) }) {
                let done = day == today ? (s.eaten[day] ?? []).contains(meal) : (s.eaten[day] ?? []).contains(meal)
                out.append(CalItem(id: "meal-\(day)-\(meal)", time: mealTime(meal), title: "\(meal.capitalized): \(r.name)", detail: line(r), cat: "meals", icon: "fork.knife", done: done, eventID: nil, routineID: nil))
            }
        }
        if let r = routine(on: day) {
            let done = s.workouts.contains { dayKey($0.date) == day }
            out.append(CalItem(id: "train-\(day)-\(r.id)", time: s.profile.workoutTime, title: r.name, detail: "\(r.exIds.count) exercises · \(s.profile.minutes) min", cat: "training", icon: "dumbbell", done: done, eventID: nil, routineID: r.id))
        }
        for e in s.events where e.day == day {
            let icon = e.cat == "training" ? "dumbbell" : e.cat == "meals" ? "fork.knife" : e.cat == "recovery" ? "moon" : e.cat == "medication" ? "cross.case" : "person"
            out.append(CalItem(id: "ev-\(e.id)", time: e.time, title: e.title, detail: "\(e.minutes) min" + (e.notes.isEmpty ? "" : " · \(e.notes)"), cat: e.cat, icon: icon, done: e.done, eventID: e.id, routineID: e.link.flatMap { UUID(uuidString: $0) }))
        }
        if s.restDays.contains(day) { out.append(CalItem(id: "rest-\(day)", time: "08:00", title: "Rest day", detail: "Recovery counts", cat: "recovery", icon: "moon", done: true, eventID: nil, routineID: nil)) }
        for m in s.meds where !m.isPaused {
            for t in m.allTimes {
                let st = s.medLogs.last(where: { $0.medId == m.id && $0.day == day })?.status
                out.append(CalItem(id: "med-\(m.id)-\(t)-\(day)", time: t, title: "Check in: \(m.name)", detail: st ?? "", cat: "medication", icon: "cross.case", done: st == "taken", eventID: nil, routineID: nil))
            }
        }
        for t in s.tasks where t.day == day {
            out.append(CalItem(id: "task-\(t.id)", time: t.time ?? "09:00", title: t.title, detail: "To do", cat: "personal", icon: "checklist", done: t.done, eventID: nil, routineID: nil))
        }
        for a in s.appts where dayKey(a.date) == day {
            out.append(CalItem(id: "appt-\(a.id)", time: timeString(a.date), title: a.title, detail: "Appointment", cat: "personal", icon: "calendar", done: false, eventID: nil, routineID: nil))
        }
        return out.sorted { ($0.time, $0.id) < ($1.time, $1.id) }
    }
    /// Adds an event unless the same title, day and time already exist.
    @discardableResult func addEvent(_ e: CalEvent) -> Bool {
        if s.events.contains(where: { $0.title == e.title && $0.day == e.day && $0.time == e.time }) { say("Already on your calendar"); return false }
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
        for m in s.eaten[today] ?? [] { if let r = s.plan[today]?[m].flatMap({ cat.recipe($0) }) { k += r.kcal; p += RecipeService.macros(r)?.p ?? 0 } }
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
