import Foundation
import UserNotifications

/// All reminders come from the user's own profile, plan, calendar and dose tracker, and are rebuilt whenever anything changes.
/// Every reminder has a stable id built from its source record, so nothing is duplicated and outdated ones are cancelled.
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

    struct Reminder: Equatable { let id: String; let title: String; let body: String; let comps: DateComponents; let repeats: Bool; var cat: String = "calendar" }

    static func registerCategories() {
        let med = UNNotificationCategory(identifier: "FH_MED", actions: [
            UNNotificationAction(identifier: "TAKEN", title: NSLocalizedString("Taken", comment: ""), options: []), UNNotificationAction(identifier: "SKIP", title: NSLocalizedString("Skip", comment: ""), options: [])], intentIdentifiers: [], options: [])
        let other = UNNotificationCategory(identifier: "FH_GENERIC", actions: [
            UNNotificationAction(identifier: "OPEN", title: NSLocalizedString("Open", comment: ""), options: [.foreground]), UNNotificationAction(identifier: "SNOOZE", title: NSLocalizedString("Snooze 10 min", comment: ""), options: [])], intentIdentifiers: [], options: [])
        center.setNotificationCategories([med, other])
    }

    private static func schedule(_ r: Reminder) {
        let c = UNMutableNotificationContent()
        c.title = r.title; c.body = r.body; c.sound = .default
        c.categoryIdentifier = r.cat == "medication" ? "FH_MED" : "FH_GENERIC"
        center.add(UNNotificationRequest(identifier: r.id, content: c, trigger: UNCalendarNotificationTrigger(dateMatching: r.comps, repeats: r.repeats)))
    }
    static func snooze(_ id: String, title: String, body: String) {
        let c = UNMutableNotificationContent(); c.title = title; c.body = body; c.sound = .default; c.categoryIdentifier = "FH_GENERIC"
        center.add(UNNotificationRequest(identifier: id + "-snooze", content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 600, repeats: false)))
    }

    @MainActor
    static func rebuild(_ store: Store) {
        if Cloud.offline { return }
        cancelAll()
        for r in plan(store.s) { schedule(r) }
    }

    static func mins(_ t: String) -> Int { let (h, m) = hm(t); return h * 60 + m }
    /// Moves a time that falls inside quiet hours to the end of quiet hours.
    static func quiet(_ minute: Int, _ s: Settings) -> Int {
        let a = mins(s.quietFrom), b = mins(s.quietTo)
        if a == b { return minute }
        let inside = a < b ? (minute >= a && minute < b) : (minute >= a || minute < b)
        return inside ? b : minute
    }
    static func comps(_ minute: Int, weekday: Int? = nil) -> DateComponents {
        let m = ((minute % 1440) + 1440) % 1440
        return DateComponents(hour: m / 60, minute: m % 60, weekday: weekday)
    }

    /// Pure: what should be scheduled for this state.
    static func plan(_ s: AppState, now: Date = Date()) -> [Reminder] {
        var out: [Reminder] = []
        func add(_ id: String, _ cat: String, _ title: String, _ body: String, _ c: DateComponents, repeats: Bool) {
            guard !out.contains(where: { $0.id == id }) else { return }
            out.append(Reminder(id: id, title: title, body: body, comps: c, repeats: repeats, cat: cat))
        }
        guard s.onboarded else { return [] }
        let on = Set(s.settings.on)
        let name = s.profile.name.isEmpty ? "" : ", \(s.profile.name)"
        let qs = s.settings

        if on.contains("workout") {
            for r in s.routines {
                let t = quiet(mins(s.profile.workoutTime) - qs.lead, qs)
                add("gym-\(r.weekday)", "workout", name.isEmpty ? NSLocalizedString("Workout time", comment: "") : String(format: NSLocalizedString("Workout time, %@", comment: ""), s.profile.name), String(format: NSLocalizedString("%@ is ready. Tap to start.", comment: ""), r.name), comps(t, weekday: r.weekday), repeats: true)
            }
        }
        if on.contains("recovery") {
            let trainDays = Set(s.routines.map { $0.weekday })
            for wd in 1...7 where !trainDays.contains(wd) {
                add("recovery-\(wd)", "recovery", NSLocalizedString("Recovery day", comment: ""), NSLocalizedString("A short walk or a stretch is plenty today.", comment: ""), comps(quiet(19 * 60, qs), weekday: wd), repeats: true)
            }
        }
        if on.contains("water") { add("water", "calendar", NSLocalizedString("A glass of water?", comment: ""), NSLocalizedString("One tap to log it.", comment: ""), comps(quiet(mins(qs.waterTime), qs)), repeats: true) }
        if on.contains("meals") {
            for (k, t, label) in [("breakfast", qs.breakfast, "Breakfast"), ("lunch", qs.lunch, "Lunch"), ("dinner", qs.dinner, "Dinner")] {
                add("meal-\(k)", "meal", String(format: NSLocalizedString("%@ time", comment: ""), NSLocalizedString(label, comment: "")), NSLocalizedString("Your recipe is ready.", comment: ""), comps(quiet(mins(t), qs)), repeats: true)
            }
        }
        if on.contains("shopping") {
            add("shop-weekly", "shopping", NSLocalizedString("Shopping list", comment: ""), NSLocalizedString("Your list for the week is ready.", comment: ""), comps(quiet(10 * 60, qs), weekday: 1), repeats: true)
        }
        if on.contains("health") {
            for med in s.meds where !med.isPaused {
                for (i, t) in med.allTimes.enumerated() {
                    let body = qs.detailsOnLock ? String(format: NSLocalizedString("Time to check in on %@.", comment: ""), med.name) : NSLocalizedString("Open Fit Hard to check in.", comment: "")
                    add("med-\(med.id.uuidString)-\(i)", "medication", NSLocalizedString("Your check-in", comment: ""), body, comps(mins(t)), repeats: true)   // times the user chose are never moved
                }
            }
            for a in s.appts where a.date > now {
                let title = NSLocalizedString("Appointment reminder", comment: "")
                let body = qs.detailsOnLock ? a.title : NSLocalizedString("You have an appointment coming up.", comment: "")
                if let day = Calendar.current.date(byAdding: .day, value: -1, to: a.date), day > now {
                    add("appt-\(a.id.uuidString)-d", "calendar", title, body, Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: day), repeats: false)
                }
                if let hour = Calendar.current.date(byAdding: .hour, value: -1, to: a.date), hour > now {
                    add("appt-\(a.id.uuidString)-h", "calendar", title, body, Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: hour), repeats: false)
                }
            }
        }
        if on.contains("tasks") || on.contains("calendar") {
            for t in s.tasks.filter({ !$0.done }).prefix(20) {
                guard let day = t.day, let d = dateFromKey(day), let time = t.time else { continue }
                let (h, m) = hm(time)
                guard let when = Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: d), when > now else { continue }
                add("task-\(t.id.uuidString)", "calendar", NSLocalizedString("To do", comment: ""), t.title, Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: when), repeats: false)
            }
            for e in s.events where e.remind && !e.done {
                guard let d = dateFromKey(e.day) else { continue }
                let (h, m) = hm(e.time)
                guard let base = Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: d), let when = Calendar.current.date(byAdding: .minute, value: -qs.lead, to: base), when > now else { continue }
                add("ev-\(e.id.uuidString)", "calendar", e.title, String(format: NSLocalizedString("Starts at %@.", comment: ""), e.time), Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: when), repeats: false)
            }
        }
        return out
    }

    /// For people who said no to notifications: the same reminders, shown inside the app for today.
    static func dueToday(_ s: AppState, now: Date = Date()) -> [(time: String, title: String)] {
        let wd = Calendar.current.component(.weekday, from: now)
        let nowMin = Calendar.current.component(.hour, from: now) * 60 + Calendar.current.component(.minute, from: now)
        var rows: [(Int, String)] = []
        for r in plan(s, now: now) {
            let c = r.comps
            let matches: Bool
            if r.repeats { matches = c.weekday == nil || c.weekday == wd } else { matches = c.day == Calendar.current.component(.day, from: now) && c.month == Calendar.current.component(.month, from: now) }
            guard matches, let h = c.hour, let m = c.minute, h * 60 + m >= nowMin - 30 else { continue }
            rows.append((h * 60 + m, r.title == NSLocalizedString("Your check-in", comment: "") ? NSLocalizedString("Your check-in", comment: "") : r.title))
        }
        return rows.sorted { $0.0 < $1.0 }.map { (String(format: "%02d:%02d", $0.0 / 60, $0.0 % 60), $0.1) }
    }
}

/// Handles the buttons on a notification (Taken, Skip, Snooze). Needs the live store.
final class NotifDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotifDelegate()
    weak var store: Store?
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent n: UNNotification, withCompletionHandler h: @escaping (UNNotificationPresentationOptions) -> Void) { h([.banner, .sound]) }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive r: UNNotificationResponse, withCompletionHandler h: @escaping () -> Void) {
        let id = r.notification.request.identifier
        let act = r.actionIdentifier
        Task { @MainActor in
            if id.hasPrefix("med-"), act == "TAKEN" || act == "SKIP", let st = self.store {
                let parts = id.dropFirst(4).split(separator: "-").prefix(5).joined(separator: "-")
                if let m = st.s.meds.first(where: { $0.id.uuidString == parts }) { st.logMed(m, act == "TAKEN" ? "taken" : "not_taken") }
            } else if act == "SNOOZE" {
                Notifier.snooze(id, title: r.notification.request.content.title, body: r.notification.request.content.body)
            }
            h()
        }
    }
}
