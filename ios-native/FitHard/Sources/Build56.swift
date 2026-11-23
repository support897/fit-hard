import SwiftUI

// Build 56 (Part 3): day breakdown with a one tap swap, goal matched helpers, quick bug and feedback icons.
// Swap rule (TRAINER-KNOWLEDGE.md): same muscle part, same category, equipment the person has, level within one step of the old one.

extension Store {
    /// The exercises that could stand in for `old` today: same muscle and kind, usable equipment, similar level, not already in the day.
    @MainActor func swapPool(for old: Exercise, day: [String]) -> [Exercise] {
        let p = s.profile
        let eq = WorkoutGenerator.allowedEquipment(p)
        let lv = ["beginner": 0, "intermediate": 1, "expert": 2]
        let want = old.category ?? "strength"
        return cat.exercises.filter { e in
            guard e.part == old.part, (e.category ?? "strength") == want else { return false }
            if e.id == old.id { return true }
            if day.contains(e.id) { return false }
            guard eq.contains(e.equipment) || e.equipment == "body only" else { return false }
            guard abs((lv[e.level] ?? 1) - (lv[old.level] ?? 1)) <= 1, WorkoutGenerator.levelOk(e.level, p.experience) else { return false }
            return true
        }.sorted { (Clips.has(Clips.slug($0.id)) ? 0 : 1, $0.name) < (Clips.has(Clips.slug($1.id)) ? 0 : 1, $1.name) }
    }
    /// The next different exercise after `old` in the pool (wraps), or nil when there is none.
    @MainActor func swapPick(old: String, day: [String]) -> String? {
        guard let o = cat.exercise(old) else { return nil }
        let pool = swapPool(for: o, day: day)
        guard pool.count > 1, let i = pool.firstIndex(where: { $0.id == old }) else { return nil }
        return pool[(i + 1) % pool.count].id
    }
    /// Changes ONE exercise in the saved routine. Everything else in the day stays.
    func swapExercise(routine id: UUID, old: String, new: String) {
        guard let ri = s.routines.firstIndex(where: { $0.id == id }), let k = s.routines[ri].exIds.firstIndex(of: old) else { return }
        s.routines[ri].exIds[k] = new; s.routines[ri].customized = true
        if s.draftRoutine == id.uuidString { s.draft = []; s.draftStart = nil }
    }
}

/// A collapsible list of the day: name and sets by reps for each exercise, with a change icon. Closed until tapped.
struct DayBreakdown: View {
    @EnvironmentObject var store: Store
    let routine: Routine
    var ids: [String]? = nil
    var onSwap: ((String, String) -> Void)? = nil
    @State private var open = false
    var list: [String] { ids ?? routine.exIds }
    var body: some View {
        VStack(spacing: 0) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { open.toggle() } } label: {
                HStack {
                    Text(String(format: NSLocalizedString("The day: %lld exercises", comment: ""), list.count)).font(.fh_headline).foregroundStyle(Color.ink)
                    Spacer(); BrandIcon(open ? "chevron.up" : "chevron.down").foregroundStyle(Color.sage)
                }.frame(minHeight: 44).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityIdentifier("day-breakdown-toggle")
            if open {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(Array(list.enumerated()), id: \.offset) { i, id in
                            if let e = store.cat.exercise(id) { row(i, e); if i < list.count - 1 { Divider().overlay(Color.line) } }
                        }
                    }
                }.frame(maxHeight: 280)
            }
        }.padding(.horizontal, 14).background(Color.tint.opacity(0.6), in: RoundedRectangle(cornerRadius: 16))
    }
    func detail(_ e: Exercise) -> String {
        let c = e.category ?? "strength"
        if c == "cardio" || c == "stretching" { return NSLocalizedString("1 round", comment: "") }
        let z = ProgressionEngine.range(for: e, goal: store.s.profile.primaryGoal)
        return String(format: NSLocalizedString("%lld sets of %lld to %lld", comment: ""), WorkoutGenerator.setCount(for: e, profile: store.s.profile), z.0, z.1)
    }
    func row(_ i: Int, _ e: Exercise) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(e.name).font(.fh_subheadline_b).foregroundStyle(Color.ink).lineLimit(2)
                Text(detail(e)).font(.fh_caption).foregroundStyle(Color.muted)
            }
            Spacer(minLength: 6)
            Button {
                guard let n = store.swapPick(old: e.id, day: list) else { return }
                if let onSwap { onSwap(e.id, n) } else { store.swapExercise(routine: routine.id, old: e.id, new: n) }
            } label: {
                BrandIcon("arrow.triangle.2.circlepath").foregroundStyle(Color.sage).frame(width: 44, height: 44).background(Color.cream, in: Circle())
            }.buttonStyle(.plain).accessibilityLabel("Swap this exercise").accessibilityIdentifier("swap-ex-\(i)")
        }.frame(minHeight: 52)
    }
}

/// Two small icons on Today: report a bug, send feedback. Each opens the same form as the More menu.
struct QuickReach: View {
    @EnvironmentObject var store: Store
    @State private var kind: FeedbackKind? = nil
    var body: some View {
        HStack(spacing: 2) {
            Button { kind = .bug } label: { BrandIcon("bug").foregroundStyle(Color.sage).frame(width: 36, height: 36) }
                .accessibilityLabel("Report a bug").accessibilityIdentifier("today-bug")
            Button { kind = .feedback } label: { BrandIcon("bubble.feedback").foregroundStyle(Color.sage).frame(width: 36, height: 36) }
                .accessibilityLabel("Send feedback").accessibilityIdentifier("today-feedback")
        }.sheet(item: $kind) { k in
            NavigationStack { ReachOutView(kind: k).toolbar { ToolbarItem(placement: .navigationBarLeading) { Button("Close") { kind = nil } } } }
                .environmentObject(store).tint(Color.sage)
        }
    }
}
extension FeedbackKind: Identifiable { var id: String { rawValue } }

/// Shows an ingredient amount in metric or in US measures. Same amount, different unit. Oz and cups are rounded to what a cook can measure.
enum RecipeUnits {
    static func show(_ q: Double, _ unit: String, us: Bool) -> String {
        guard us else { return "\(RecipeService.fmt(q)) \(unitName(unit))" }
        switch unit {
        case "g":
            return "\(RecipeService.fmt(q / 28.35)) oz"
        case "ml":
            if q >= 60 { return "\(cups(q / 240)) \(q / 240 > 1.01 ? "cups" : "cup")" }
            if q >= 15 { return "\(RecipeService.fmt(q / 15)) tbsp" }
            return "\(RecipeService.fmt(q / 5)) tsp"
        default:
            return "\(RecipeService.fmt(q)) \(unitName(unit))"
        }
    }
    static func cups(_ c: Double) -> String {
        let r = (c * 4).rounded() / 4
        let whole = Int(r); let frac = r - Double(whole)
        let f = frac == 0.25 ? "1/4" : frac == 0.5 ? "1/2" : frac == 0.75 ? "3/4" : ""
        if whole == 0 { return f.isEmpty ? "1/4" : f }
        return f.isEmpty ? "\(whole)" : "\(whole) \(f)"
    }
}
