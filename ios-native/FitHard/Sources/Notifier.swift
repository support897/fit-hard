import Foundation
import UserNotifications

/// All reminders are built from the user's own choices and rebuilt whenever anything changes.
/// Health reminders use generic text on the lock screen unless the user opts in.
enum Notifier {
    static let center = UNUserNotificationCenter.current()

    static func ask(_ done: @escaping (Bool) -> Void) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in
            DispatchQueue.main.async { done(ok) }
        }
    }
    static func status(_ done: @escaping (UNAuthorizationStatus) -> Void) {
        center.getNotificationSettings { s in DispatchQueue.main.async { done(s.authorizationStatus) } }
    }
    static func cancelAll() { center.removeAllPendingNotificationRequests() }

    struct Reminder: Equatable { let id: String; let title: String; let body: String; let comps: DateComponents; let repeats: Bool }

    private static func schedule(_ r: Reminder) {
        let c = UNMutableNotificationContent()
        c.title = r.title; c.body = r.body; c.sound = .default
        center.add(UNNotificationRequest(identifier: r.id, content: c, trigger: UNCalendarNotificationTrigger(dateMatching: r.comps, repeats: r.repeats)))
    }

    @MainActor
    static func rebuild(_ store: Store) {
        cancelAll()
        for r in plan(store.s) { schedule(r) }
    }

    /// Pure: what should be scheduled for this state. One reminder per event, stable ids, no duplicates.
    static func plan(_ s: AppState, now: Date = Date()) -> [Reminder] {
        var out: [Reminder] = []
        func add(_ id: String, _ title: String, _ body: String, _ comps: DateComponents, repeats: Bool) {
            guard !out.contains(where: { $0.id == id }) else { return }
            out.append(Reminder(id: id, title: title, body: body, comps: comps, repeats: repeats))
        }
        guard s.onboarded else { return [] }
        let on = Set(s.settings.on)
        let name = s.profile.name.isEmpty ? "" : ", \(s.profile.name)"

        if on.contains("workout") {
            let (h, m) = hm(s.profile.workoutTime)
            for wd in s.profile.trainDays where !(s.routine[String(wd)] ?? []).isEmpty {
                add("gym-\(wd)", "Workout time\(name)", "Your plan is ready. Tap to start.", DateComponents(hour: h, minute: m, weekday: wd), repeats: true)
            }
        }
        if on.contains("water") {
            let (h, m) = hm(s.settings.waterTime)
            add("water", "A glass of water?", "One tap to log it.", DateComponents(hour: h, minute: m), repeats: true)
        }
        if on.contains("meals") {
            for (k, t, label) in [("breakfast", s.settings.breakfast, "Breakfast"), ("lunch", s.settings.lunch, "Lunch"), ("dinner", s.settings.dinner, "Dinner")] {
                let (h, m) = hm(t)
                add("meal-\(k)", "\(label) time", "Your recipe is ready.", DateComponents(hour: h, minute: m), repeats: true)
            }
        }
        if on.contains("health") {
            for med in s.meds {
                let (h, m) = hm(med.time)
                let body = s.settings.detailsOnLock ? "Time to check in on \(med.name)." : "Open Fit Hard to check in."
                add("med-\(med.id.uuidString)", "Your check-in", body, DateComponents(hour: h, minute: m), repeats: true)
            }
            for a in s.appts where a.date > now {
                let title = "Appointment reminder"
                let body = s.settings.detailsOnLock ? a.title : "You have an appointment coming up."
                if let day = Calendar.current.date(byAdding: .day, value: -1, to: a.date), day > now {
                    add("appt-\(a.id.uuidString)-d", title, body,
                        Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: day), repeats: false)
                }
                if let hour = Calendar.current.date(byAdding: .hour, value: -1, to: a.date), hour > now {
                    add("appt-\(a.id.uuidString)-h", title, body,
                        Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: hour), repeats: false)
                }
            }
        }
        if on.contains("tasks") {
            for t in s.tasks.filter({ !$0.done }).prefix(20) {
                guard let day = t.day, let d = dateFromKey(day), let time = t.time else { continue }
                let (h, m) = hm(time)
                guard let when = Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: d), when > now else { continue }
                add("task-\(t.id.uuidString)", "To do", t.title,
                    Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: when), repeats: false)
            }
        }
        return out
    }
}
