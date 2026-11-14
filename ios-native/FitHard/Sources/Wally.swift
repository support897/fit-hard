import SwiftUI

// MARK: Wally, the coach. Deterministic rules over the user's real data. Never shames.
struct WallyMsg: Equatable { let rule: String; let text: String; let image: String }

enum WallyEngine {
    static func message(_ s: AppState, cat: Catalog, now: Date = Date(), avoid: String? = nil) -> WallyMsg {
        let key = dayKey(now)
        let hour = Calendar.current.component(.hour, from: now)
        let name = s.profile.name
        let goal = s.profile.primaryGoal
        var cands: [WallyMsg] = []
        let weekAgo = Calendar.current.date(byAdding: .day, value: -7, to: now) ?? now
        let last7 = s.workouts.filter { $0.date >= weekAgo }.count
        if s.workouts.isEmpty && s.checkins.isEmpty {
            cands.append(WallyMsg(rule: "welcome", text: name.trimmingCharacters(in: .whitespaces).isEmpty ? NSLocalizedString("Welcome. Tell me how you feel, then we start gently.", comment: "") : String(format: NSLocalizedString("Welcome, %@. Tell me how you feel, then we start gently.", comment: ""), name), image: "wally-welcome"))
        }
        if s.checkins[key] == "bad" {
            cands.append(WallyMsg(rule: "bad", text: NSLocalizedString("A softer day is fine. Do what feels right. Rest counts.", comment: ""), image: "wally-rest"))
        }
        if !s.profile.trainDays.isEmpty && last7 >= s.profile.trainDays.count {
            cands.append(WallyMsg(rule: "week", text: String(format: NSLocalizedString("You trained %lld times this week. That is real progress.", comment: ""), last7), image: "wally-celebrate"))
        }
        // Progress: any exercise in your routines ready for more weight
        for r in s.routines {
            for id in r.exIds {
                guard let ex = cat.exercise(id) else { continue }
                let hist = s.workouts.sorted { $0.date > $1.date }.compactMap { $0.entries.first(where: { $0.exerciseId == id && !$0.sets.isEmpty }) }
                let t = ProgressionEngine.next(ex: ex, history: hist, goal: goal)
                if t.increase {
                    cands.append(WallyMsg(rule: "progress", text: String(format: NSLocalizedString("You hit %lld reps on %@ every set. Try %@ kg next.", comment: ""), t.hi, ex.name, RecipeService.fmt(t.kg)), image: "wally-celebrate"))
                    break
                }
            }
        }
        if let t = NutritionService.targets(s.profile), hour >= 15 {
            var p = 0
            for m in s.eaten[key] ?? [] { if let r = s.plan[key]?[m].flatMap({ cat.recipe($0) }) { p += RecipeService.macros(r)?.p ?? 0 } }
            if !(s.eaten[key] ?? []).isEmpty && Double(p) < 0.6 * Double(t.protein) {
                cands.append(WallyMsg(rule: "protein", text: String(format: NSLocalizedString("Protein is at %lld of %lld g. A protein rich dinner would help.", comment: ""), p, t.protein), image: "wally-hello"))
            }
        }
        if hour >= 14 {
            let have = s.water[key] ?? 0
            if Double(have) < 0.4 * Double(max(500, s.profile.waterGoal)) {
                cands.append(WallyMsg(rule: "water", text: String(format: NSLocalizedString("A glass of water? You are at %lld of %lld ml.", comment: ""), have, s.profile.waterGoal), image: "wally-hello"))
            }
        }
        if let y = Calendar.current.date(byAdding: .day, value: -1, to: now) {
            let wd = Calendar.current.component(.weekday, from: y)
            if s.routines.contains(where: { $0.weekday == wd }) && !s.workouts.contains(where: { dayKey($0.date) == dayKey(y) }) && !s.workouts.isEmpty {
                cands.append(WallyMsg(rule: "missed", text: NSLocalizedString("No stress about yesterday. Today is a fresh start.", comment: ""), image: "wally-hello"))
            }
        }
        let wd = Calendar.current.component(.weekday, from: now)
        if let r = s.routines.first(where: { $0.weekday == wd }), !s.workouts.contains(where: { dayKey($0.date) == key }) {
            cands.append(WallyMsg(rule: "training", text: String(format: NSLocalizedString("Today is %@. %lld exercises, about %lld minutes.", comment: ""), r.name, r.exIds.count, s.profile.minutes), image: "wally-hello"))
        }
        cands.append(WallyMsg(rule: "rest", text: NSLocalizedString("Rest is part of the plan. Enjoy today.", comment: ""), image: "wally-rest"))
        let urgent: Set<String> = ["bad", "training", "welcome"]
        return cands.first(where: { $0.rule != avoid || urgent.contains($0.rule) }) ?? cands[cands.count - 1]
    }
}

struct WallyBubble: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    /// Build 36, item F: tapping Wally makes him react — a little bounce (never when
    /// reduced motion is on) and a kind line from this written set. He never nags,
    /// never blocks a tap, and his words never touch medicine or doses.
    @State private var reaction: Int? = nil
    static let reactions: [String] = [
        "You found me. I am always in your corner.",
        "That tickles. Ready when you are.",
        "We go at your pace. Always.",
        "Small steps count. They add up.",
        "I am glad you are here."
    ]
    var body: some View {
        if store.s.settings.wallyQuiet { EmptyView() } else {
            let prev = store.s.wally.last(where: { $0.day != store.today })?.rule
            let m = WallyEngine.message(store.s, cat: store.cat, avoid: prev)
            HStack(spacing: 12) {
                Button {
                    reaction = ((reaction ?? -1) + 1) % Self.reactions.count; haptic(.soft)
                } label: {
                    BundleImage(name: m.image).frame(width: 64, height: 64)
                        .scaleEffect(reaction != nil && !reduceMotion ? 1.1 : 1.0)
                        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.5), value: reaction)
                }.buttonStyle(.plain).accessibilityLabel("Wally").accessibilityIdentifier("wally-tap")
                Text(reaction.map { Self.reactions[$0] } ?? m.text).font(.fh_subheadline).foregroundStyle(Color.ink).frame(maxWidth: .infinity, alignment: .leading).accessibilityIdentifier("wally-text")
                Menu { Button("Talk to me less") { store.s.settings.wallyQuiet = true } } label: { BrandIcon( "ellipsis").frame(width: 36, height: 36) }.foregroundStyle(Color.muted)
            }.padding(12).background(Color.tint, in: RoundedRectangle(cornerRadius: 18)).accessibilityIdentifier("wally-bubble")
            .onAppear { if store.s.wally.last?.day != store.today || store.s.wally.last?.rule != m.rule { store.s.wally.append(WallyNote(day: store.today, rule: m.rule)); if store.s.wally.count > 60 { store.s.wally.removeFirst() } } }
        }
    }
}

/// The slim Wally who sits with you between sets (build 36, item F, the "during"):
/// the work screen itself stays clean for the lift, and in the rests he is there —
/// one kind line, tap him and he reacts, same written set as the bubble. Quiet and
/// reduced motion are respected exactly as in the bubble.
struct WallyStrip: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @State private var reaction: Int? = nil
    var body: some View {
        if store.s.settings.wallyQuiet { EmptyView() } else {
            HStack(spacing: 10) {
                Button {
                    reaction = ((reaction ?? -1) + 1) % WallyBubble.reactions.count; haptic(.soft)
                } label: {
                    BundleImage(name: "wally-rest").frame(width: 40, height: 40)
                        .scaleEffect(reaction != nil && !reduceMotion ? 1.12 : 1.0)
                        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.5), value: reaction)
                }.buttonStyle(.plain).accessibilityLabel("Wally").accessibilityIdentifier("wally-strip-tap")
                Text(reaction.map { WallyBubble.reactions[$0] } ?? NSLocalizedString("Rest is part of the plan. Breathe.", comment: ""))
                    .font(.fh_caption).foregroundStyle(Color.muted).frame(maxWidth: .infinity, alignment: .leading)
            }.padding(.horizontal, 12).padding(.vertical, 6).background(Color.tint.opacity(0.6), in: RoundedRectangle(cornerRadius: 14)).accessibilityIdentifier("wally-strip")
        }
    }
}

// MARK: The round question mark on every exercise
struct HelpButton: View {
    let exercise: Exercise
    @State private var show = false
    var body: some View {
        Button { show = true; haptic(.soft) } label: {
            Text("?").font(.fh_title3_b).frame(width: 44, height: 44).background(Color.sage, in: Circle()).foregroundStyle(Color.surface)
        }.buttonStyle(.plain).accessibilityLabel("Help for \(exercise.name)").accessibilityIdentifier("help-button")
        .sheet(isPresented: $show) { HelpSheet(exercise: exercise) }
    }
}

struct HelpSheet: View {
    @EnvironmentObject var store: Store
    let exercise: Exercise
    @Environment(\.dismiss) var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                BundleImage(name: "wally-hello").frame(width: 80, height: 80)
                Spacer()
                Button { dismiss() } label: { BrandIcon( "xmark.circle.fill").font(.fh_title).foregroundStyle(Color.muted) }.accessibilityLabel("Close help").accessibilityIdentifier("help-close")
            }
            if let a = store.animBase(exercise) { AnimatedFrames(base: a).frame(height: 150).frame(maxWidth: .infinity) }
            if let h = HelpText.help(for: exercise.id) {
                let lines = HelpText.display(h)
                ScrollView { VStack(alignment: .leading, spacing: 10) {
                    Text(lines[0]).font(.fh_headline).accessibilityIdentifier("help-title")
                    Text(lines[1]).font(.fh_title3_b)
                    ForEach(Array(lines.dropFirst(2).dropLast()), id: \.self) { Text($0).font(.fh_body) }
                    Text(lines[lines.count - 1]).font(.fh_title3_b).foregroundStyle(Color.sage)
                } }
            } else { Text("Help for this exercise is coming soon.").foregroundStyle(Color.muted) }
            Spacer(minLength: 0)
            BigButton(title: "Got it") { dismiss() }
        }.padding(20).background(Color.cream.ignoresSafeArea()).presentationDetents([.medium, .large])
    }
}

struct AvatarView: View {
    @EnvironmentObject var store: Store
    var size: CGFloat = 36
    var body: some View {
        let c = store.s.profile.character
        Group { if c.isEmpty { BrandIcon( "person.crop.circle").resizable().scaledToFit().foregroundStyle(Color.muted) } else { BundleImage(name: "avatar-\(c)") } }
            .frame(width: size, height: size).clipShape(Circle()).overlay(Circle().stroke(Color.line, lineWidth: 1))
            .accessibilityLabel("Your character").accessibilityIdentifier("avatar")
    }
}
