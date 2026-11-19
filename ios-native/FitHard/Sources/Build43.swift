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

/// The body part colour. One quiet rail of colour tells the muscle zone, so no icon is needed.
func partTone(_ part: String) -> String {
    let p = part.lowercased()
    if ["quad", "ham", "glute", "calf", "calves", "adduct", "abduct", "leg"].contains(where: { p.contains($0) }) { return "train.legs" }
    if ["chest", "tricep", "shoulder", "delt"].contains(where: { p.contains($0) }) { return "train.push" }
    if ["back", "lat", "trap", "bicep", "forearm"].contains(where: { p.contains($0) }) { return "train.pull" }
    if ["ab", "core", "oblique", "waist"].contains(where: { p.contains($0) }) { return "train.core" }
    if ["cardio"].contains(where: { p.contains($0) }) { return "train.cardio" }
    return "train.full"
}

/// One exercise line, set in type: a thin rail in the muscle colour, the body part as a small spaced label, the name in the serif,
/// and the rep zone on the right. No icon.
struct ExerciseLine: View {
    let e: Exercise
    var zone: String? = nil
    var detail: String? = nil
    var body: some View {
        let tone = Color.tone(partTone(e.part))
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 2).fill(tone).frame(width: 3)
            VStack(alignment: .leading, spacing: 3) {
                Text((e.partLabel ?? e.part).uppercased()).font(.fh_caption2_b).tracking(1.2).foregroundStyle(tone)
                Text(e.name).font(.fh_title3_b).foregroundStyle(Color.ink).multilineTextAlignment(.leading).lineLimit(2)
                if let detail { Text(detail).font(.fh_caption).foregroundStyle(Color.muted) }
            }
            Spacer(minLength: 8)
            if let zone {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(zone).font(.fh_title3_b).foregroundStyle(Color.ink)
                    Text("reps").font(.fh_caption2).foregroundStyle(Color.muted)
                }
            }
        }.frame(minHeight: 44)
    }
}

/// The exercises of one workout in a calm list with hairlines.
struct TrainDayList: View {
    @EnvironmentObject var store: Store
    let r: Routine
    var body: some View {
        let goal = store.s.profile.primaryGoal
        let items = r.exIds.compactMap { store.cat.exercise($0) }
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, e in
                let z = ProgressionEngine.range(for: e, goal: goal)
                ExerciseLine(e: e, zone: "\(z.0) to \(z.1)").padding(.vertical, 12)
                if i < items.count - 1 { Divider().overlay(Color.line) }
            }
        }
    }
}
