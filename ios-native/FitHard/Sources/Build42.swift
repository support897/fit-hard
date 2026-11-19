import SwiftUI

// MARK: Build 42. Done circles, colourful doses with a last time and a due reminder, optional food numbers, weekly meals from the kitchen.
// Fit Hard still records only what the person types. Nothing here suggests a dose, a product or a change.

/// Bright, friendly colours for doses and the calendar. Each has a deeper form for light screens and a softer form for the dark theme.
enum DosePalette {
    static let all: [(key: String, name: String, light: UInt32, dark: UInt32)] = [
        ("rose", "Rose", 0xD0476B, 0xF28DA8), ("coral", "Coral", 0xDB5E2F, 0xFF9A72), ("sun", "Sun", 0xB87F00, 0xFFC84D),
        ("lime", "Lime", 0x5E9B1F, 0xB4DE6B), ("mint", "Mint", 0x1E9B74, 0x6FDDB8), ("sky", "Sky", 0x2C86CB, 0x8DC3F2),
        ("iris", "Iris", 0x6B58D0, 0xB1A6F5), ("plum", "Plum", 0xA2479E, 0xE3A0E0)
    ]
    static func color(_ key: String) -> Color {
        let t = all.first(where: { $0.key == key }) ?? all[0]
        return Color(hex: Color.isDark ? t.dark : t.light)
    }
}

extension Med {
    /// The colour the person picked, or a steady one chosen from the dose's own id so each dose keeps its colour.
    var toneKey: String {
        if let c = color, DosePalette.all.contains(where: { $0.key == c }) { return "dose." + c }
        let h = id.uuidString.utf8.reduce(7) { ($0 &* 31 &+ Int($1)) % 9973 }
        return "dose." + DosePalette.all[h % DosePalette.all.count].key
    }
    var tone: Color { Color.tone(toneKey) }
}

/// Pure schedule rules, so reminders and the calendar read the same truth.
enum MedSchedule {
    static func due(_ m: Med, on day: String) -> Bool {
        guard !m.isPaused, let d = dateFromKey(day) else { return false }
        let cal = Calendar.current
        switch m.frequency {
        case "Weekly":
            if let a = m.lastTaken { return cal.component(.weekday, from: a) == cal.component(.weekday, from: d) }
            return (cal.component(.weekday, from: d) + 5) % 7 == 0
        case "Every few days":
            guard let n = m.everyDays, n > 1, let a = m.lastTaken else { return true }
            let diff = cal.dateComponents([.day], from: cal.startOfDay(for: a), to: cal.startOfDay(for: d)).day ?? 0
            return diff >= 0 && diff % n == 0
        default: return true
        }
    }
    /// The next moment this dose is due. Nil for "As directed", because the person said there is no set time.
    static func nextDue(_ m: Med, logs: [MedLog], now: Date = Date()) -> Date? {
        guard !m.isPaused, m.frequency != "As directed" else { return nil }
        let cal = Calendar.current
        let today = dayKey(now)
        let takenToday = logs.contains { $0.medId == m.id && $0.day == today && $0.status == "taken" }
        for k in 0..<70 {
            guard let day = cal.date(byAdding: .day, value: k, to: cal.startOfDay(for: now)) else { continue }
            if k == 0 && takenToday { continue }
            if !due(m, on: dayKey(day)) { continue }
            for t in m.allTimes.sorted() {
                let p = t.split(separator: ":").compactMap { Int($0) }
                guard p.count == 2, let dt = cal.date(bySettingHour: p[0], minute: p[1], second: 0, of: day) else { continue }
                if dt > now, m.lastTaken.map({ dt > $0 }) ?? true { return dt }
            }
        }
        return nil
    }
}

extension Store {
    /// Calories and protein show only when the person wants them: their own switch, or the "Calorie counts" need they picked.
    var showNumbers: Bool { s.settings.showNumbers ?? s.profile.needs.contains("calories") }

    func medDue(_ m: Med, on day: String) -> Bool { MedSchedule.due(m, on: day) }
    func nextDue(_ m: Med) -> Date? { MedSchedule.nextDue(m, logs: s.medLogs) }
    func dueText(_ d: Date) -> String {
        let cal = Calendar.current
        let t = timeString(d)
        if cal.isDateInToday(d) { return String(format: NSLocalizedString("Today %@", comment: ""), t) }
        if cal.isDateInTomorrow(d) { return String(format: NSLocalizedString("Tomorrow %@", comment: ""), t) }
        return d.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) + " " + t
    }
    /// The person says when they last took it. This is their word, never a guess.
    func setLastTaken(_ m: Med, _ d: Date?) {
        guard let i = s.meds.firstIndex(where: { $0.id == m.id }) else { return }
        s.meds[i].lastTaken = d
        Notifier.rebuild(self)
    }

    /// One tap on the calendar's circle marks an item done, another tap undoes it. Each kind writes to its own record.
    func toggleItemDone(_ it: CalItem, day: String) {
        if it.id.hasPrefix("meal-") {
            let meal = String(it.id.split(separator: "-").last ?? "")
            var e = s.eaten[day] ?? []
            if let i = e.firstIndex(of: meal) { e.remove(at: i); s.portions[day]?[meal] = nil } else { e.append(meal) }
            s.eaten[day] = e
        } else if it.id.hasPrefix("med-") {
            let raw = String(it.id.dropFirst(4).prefix(36))
            guard let uid = UUID(uuidString: raw), let m = s.meds.first(where: { $0.id == uid }) else { return }
            if it.done { s.medLogs.removeAll { $0.medId == uid && $0.day == day } }
            else {
                s.medLogs.removeAll { $0.medId == uid && $0.day == day }
                s.medLogs.append(MedLog(medId: uid, day: day, status: "taken"))
                if day == today { setLastTaken(m, Date()) }
            }
        } else if let eid = it.eventID, let i = s.events.firstIndex(where: { $0.id == eid }) {
            s.events[i].done.toggle()
        } else if it.id.hasPrefix("task-"), let i = s.tasks.firstIndex(where: { "task-\($0.id)" == it.id }) {
            s.tasks[i].done.toggle()
        } else if it.id.hasPrefix("train-"), s.workouts.contains(where: { dayKey($0.date) == day }) {
            say(NSLocalizedString("This one is done from your logged workout.", comment: ""))
        } else if let i = s.markedDone.firstIndex(of: it.id) { s.markedDone.remove(at: i) }
        else { s.markedDone.append(it.id) }
        haptic()
    }

    /// Every new week the meals are rebuilt around what is in the kitchen. The first run only notes the week.
    func weeklyRefresh() {
        guard s.onboarded, s.profile.setupDone else { return }
        let c = Calendar(identifier: .iso8601)
        let key = "\(c.component(.yearForWeekOfYear, from: Date()))-\(c.component(.weekOfYear, from: Date()))"
        if s.lastPlanWeek.isEmpty { s.lastPlanWeek = key; return }
        guard s.lastPlanWeek != key else { return }
        s.lastPlanWeek = key
        s.plan = [:]
        generatePlan(force: true)
        Notifier.rebuild(self)
        say(NSLocalizedString("A new week. Your meals are rebuilt from what is in your kitchen.", comment: ""))
    }
}
