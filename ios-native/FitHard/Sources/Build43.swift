import SwiftUI

// MARK: Build 43. A modern Train tab: today's date, the person's own week at a glance, and the exercises for any day.
// The days come only from the days the person chose. Two days a week shows two training days, the rest are rest days.

/// Seven day chips for this week. A training day shows its type icon and colour, a rest day shows a moon.
struct TrainWeekStrip: View {
    @EnvironmentObject var store: Store
    @Binding var sel: String
    var body: some View {
        let cal = Calendar.current
        let start = cal.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        let days = (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
        HStack(spacing: 6) {
            ForEach(days, id: \.self) { d in chip(d) }
        }
    }
    func chip(_ d: Date) -> some View {
        let k = dayKey(d)
        let r = store.routine(on: k)
        let tone = r.map { Color.tone($0.trainType.tone) } ?? Color.muted
        let isSel = sel == k
        let isToday = k == store.today
        return Button { sel = k; haptic(.soft) } label: {
            VStack(spacing: 4) {
                Text(d.formatted(.dateTime.weekday(.abbreviated))).font(.fh_caption).foregroundStyle(isToday ? Color.sage : Color.muted)
                Text(d.formatted(.dateTime.day())).font(.fh_subheadline_b).foregroundStyle(Color.ink)
                ZStack {
                    Circle().fill(tone.opacity(r == nil ? 0.10 : 0.22)).frame(width: 28, height: 28)
                    BrandIcon(r?.trainType.icon ?? "moon").font(.fh_caption).foregroundStyle(tone)
                }
            }
            .frame(maxWidth: .infinity).padding(.vertical, 8)
            .background(isSel ? tone.opacity(0.16) : Color.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(isSel ? tone : Color.clear, lineWidth: 2))
        }.buttonStyle(.plain).accessibilityIdentifier("train-day-\(k)")
        .accessibilityLabel(Text(d.formatted(.dateTime.weekday(.wide).day().month(.wide)) + ", " + (r?.name ?? NSLocalizedString("Rest day", comment: ""))))
    }
}

/// The exercises of one workout, each with its picture and the rep zone that fits the person's goal.
struct TrainDayList: View {
    @EnvironmentObject var store: Store
    let r: Routine
    var body: some View {
        let goal = store.s.profile.primaryGoal
        VStack(spacing: 8) {
            ForEach(Array(r.exIds.enumerated()), id: \.offset) { i, id in
                if let e = store.cat.exercise(id) {
                    let z = ProgressionEngine.range(for: e, goal: goal)
                    HStack(spacing: 12) {
                        ExerciseIcon(exercise: e, size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.name).font(.fh_subheadline_b).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                            Text("\(z.0) to \(z.1) reps").font(.fh_caption).foregroundStyle(Color.muted)
                        }
                        Spacer(minLength: 0)
                        Text("\(i + 1)").font(.fh_caption_b).foregroundStyle(Color.sage)
                    }.padding(8).background(Color.sage.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }
}
