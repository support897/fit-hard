import SwiftUI

// MARK: Build 44. Eating days the person chooses, a Sunday wrap of their own week, and a favourite plus how to on the machine photo match.
// Everything here reads only what the person did or chose. Nothing is suggested to take or to change.

extension Store {
    /// A free eating day is a weekday the person chose. The plan leaves it empty and nothing is counted against them.
    func isFreeMealDay(_ key: String) -> Bool {
        guard let d = dateFromKey(key) else { return false }
        return s.profile.freeMealDays.contains(Calendar.current.component(.weekday, from: d))
    }
    /// Counts for the last seven days, from the person's own records.
    var weekWrap: (workouts: Int, mealDays: Int, doses: Int) {
        let cal = Calendar.current
        let keys = (0..<7).compactMap { cal.date(byAdding: .day, value: -$0, to: Date()).map { dayKey($0) } }
        let w = s.workouts.filter { keys.contains(dayKey($0.date)) }.count
        let m = keys.filter { !(s.eaten[$0] ?? []).isEmpty }.count
        let d = s.medLogs.filter { keys.contains($0.day) && $0.status == "taken" }.count
        return (w, m, d)
    }
}

/// Pick the weekdays that are free eating days. The other days follow the meal plan.
struct FreeDaysPicker: View {
    @EnvironmentObject var store: Store
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    BundleImage(name: "wally-hello").frame(width: 56, height: 56)
                    Text("Pick your free eating days. On those days there is no meal plan, and nothing is counted against you.").font(.fh_subheadline).foregroundStyle(Color.ink)
                }
                Flow {
                    ForEach(Lists.weekdays, id: \.0) { d in
                        Chip(label: d.1, on: store.s.profile.freeMealDays.contains(d.0)) {
                            if let i = store.s.profile.freeMealDays.firstIndex(of: d.0) { store.s.profile.freeMealDays.remove(at: i) }
                            else { store.s.profile.freeMealDays.append(d.0) }
                            haptic(.soft)
                        }
                    }
                }
                Text(String(format: NSLocalizedString("%lld plan days and %lld free days each week.", comment: ""), 7 - store.s.profile.freeMealDays.count, store.s.profile.freeMealDays.count)).font(.fh_caption).foregroundStyle(Color.muted)
                BigButton(title: "Update my meals", icon: "sparkles") {
                    store.generatePlan(force: true); Notifier.rebuild(store); store.say(NSLocalizedString("Meals updated", comment: ""))
                }.accessibilityIdentifier("free-days-update")
            }.padding(16)
        }.background(Color.cream).navigationTitle("Eating days")
    }
}

/// A small, warm wrap of the person's own last seven days. It only counts what they really did.
struct WeekWrapCard: View {
    @EnvironmentObject var store: Store
    func tile(_ n: Int, _ label: String, _ icon: String, _ tone: String) -> some View {
        VStack(spacing: 4) {
            ZStack { Circle().fill(Color.tone(tone).opacity(0.2)); BrandIcon(icon).foregroundStyle(Color.tone(tone)) }.frame(width: 40, height: 40)
            Text("\(n)").font(.fh_title2_b).foregroundStyle(Color.ink)
            Text(LocalizedStringKey(label)).font(.fh_caption).foregroundStyle(Color.muted)
        }.frame(maxWidth: .infinity)
    }
    var body: some View {
        let w = store.weekWrap
        Card {
            HStack(spacing: 10) {
                BundleImage(name: "wally-celebrate").frame(width: 52, height: 52)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Your week").font(.fh_headline).foregroundStyle(Color.ink)
                    Text(w.workouts + w.mealDays + w.doses > 0 ? "Look at what you did. Next week starts fresh." : "A new week is a fresh start. Wally is with you.").font(.fh_caption).foregroundStyle(Color.muted)
                }
                Spacer(minLength: 0)
            }
            HStack {
                tile(w.workouts, "Workouts", "figure.strengthtraining.traditional", "train.full")
                tile(w.mealDays, "Days of meals", "m-lunch", "meal.lunch")
                tile(w.doses, "Doses taken", "cross.case", "dose.mint")
            }
        }.accessibilityIdentifier("week-wrap")
    }
}
