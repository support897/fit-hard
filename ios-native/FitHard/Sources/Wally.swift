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
            cands.append(WallyMsg(rule: "welcome", text: "Welcome, \(name). Tell me how you feel, then we start gently.", image: "wally-welcome"))
        }
        if s.checkins[key] == "bad" {
            cands.append(WallyMsg(rule: "bad", text: "A softer day is fine. Do what feels right. Rest counts.", image: "wally-rest"))
        }
        if !s.profile.trainDays.isEmpty && last7 >= s.profile.trainDays.count {
            cands.append(WallyMsg(rule: "week", text: "You trained \(last7) times this week. That is real progress.", image: "wally-celebrate"))
        }
        // Progress: any exercise in your routines ready for more weight
        for r in s.routines {
            for id in r.exIds {
                guard let ex = cat.exercise(id) else { continue }
                let hist = s.workouts.sorted { $0.date > $1.date }.compactMap { $0.entries.first(where: { $0.exerciseId == id && !$0.sets.isEmpty }) }
                let t = ProgressionEngine.next(ex: ex, history: hist, goal: goal)
                if t.increase {
                    cands.append(WallyMsg(rule: "progress", text: "You hit \(t.hi) reps on \(ex.name) every set. Try \(RecipeService.fmt(t.kg)) kg next.", image: "wally-celebrate"))
                    break
                }
            }
        }
        if let t = NutritionService.targets(s.profile), hour >= 15 {
            var p = 0
            for m in s.eaten[key] ?? [] { if let r = s.plan[key]?[m].flatMap({ cat.recipe($0) }) { p += RecipeService.macros(r)?.p ?? 0 } }
            if !(s.eaten[key] ?? []).isEmpty && Double(p) < 0.6 * Double(t.protein) {
                cands.append(WallyMsg(rule: "protein", text: "Protein is at \(p) of \(t.protein) g. A protein rich dinner would help.", image: "wally-hello"))
            }
        }
        if hour >= 14 {
            let have = s.water[key] ?? 0
            if Double(have) < 0.4 * Double(max(500, s.profile.waterGoal)) {
                cands.append(WallyMsg(rule: "water", text: "A glass of water? You are at \(have) of \(s.profile.waterGoal) ml.", image: "wally-hello"))
            }
        }
        if let y = Calendar.current.date(byAdding: .day, value: -1, to: now) {
            let wd = Calendar.current.component(.weekday, from: y)
            if s.routines.contains(where: { $0.weekday == wd }) && !s.workouts.contains(where: { dayKey($0.date) == dayKey(y) }) && !s.workouts.isEmpty {
                cands.append(WallyMsg(rule: "missed", text: "No stress about yesterday. Today is a fresh start.", image: "wally-hello"))
            }
        }
        let wd = Calendar.current.component(.weekday, from: now)
        if let r = s.routines.first(where: { $0.weekday == wd }), !s.workouts.contains(where: { dayKey($0.date) == key }) {
            cands.append(WallyMsg(rule: "training", text: "Today is \(r.name). \(r.exIds.count) exercises, about \(s.profile.minutes) minutes.", image: "wally-hello"))
        }
        cands.append(WallyMsg(rule: "rest", text: "Rest is part of the plan. Enjoy today.", image: "wally-rest"))
        let urgent: Set<String> = ["bad", "training", "welcome"]
        return cands.first(where: { $0.rule != avoid || urgent.contains($0.rule) }) ?? cands[cands.count - 1]
    }
}

struct WallyBubble: View {
    @EnvironmentObject var store: Store
    var body: some View {
        if store.s.settings.wallyQuiet { EmptyView() } else {
            let prev = store.s.wally.last(where: { $0.day != store.today })?.rule
            let m = WallyEngine.message(store.s, cat: store.cat, avoid: prev)
            HStack(spacing: 12) {
                BundleImage(name: m.image).frame(width: 64, height: 64)
                Text(m.text).font(.subheadline).foregroundStyle(Color.ink).frame(maxWidth: .infinity, alignment: .leading).accessibilityIdentifier("wally-text")
                Menu { Button("Talk to me less") { store.s.settings.wallyQuiet = true } } label: { Image(systemName: "ellipsis").frame(width: 36, height: 36) }.foregroundStyle(Color.muted)
            }.padding(12).background(Color.tint, in: RoundedRectangle(cornerRadius: 18))
            .onAppear { if store.s.wally.last?.day != store.today || store.s.wally.last?.rule != m.rule { store.s.wally.append(WallyNote(day: store.today, rule: m.rule)); if store.s.wally.count > 60 { store.s.wally.removeFirst() } } }
        }
    }
}

// MARK: The round question mark on every exercise
struct HelpButton: View {
    let exercise: Exercise
    @State private var show = false
    var body: some View {
        Button { show = true; haptic(.soft) } label: {
            Text("?").font(.title3.bold()).frame(width: 44, height: 44).background(Color.sage, in: Circle()).foregroundStyle(Color.surface)
        }.buttonStyle(.plain).accessibilityLabel("Help for \(exercise.name)").accessibilityIdentifier("help-button")
        .sheet(isPresented: $show) { HelpSheet(exercise: exercise) }
    }
}

struct HelpSheet: View {
    let exercise: Exercise
    @Environment(\.dismiss) var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                BundleImage(name: "wally-hello").frame(width: 80, height: 80)
                Spacer()
                Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").font(.title).foregroundStyle(Color.muted) }.accessibilityLabel("Close help").accessibilityIdentifier("help-close")
            }
            if let h = HelpText.help(for: exercise.id) {
                let lines = HelpText.display(h)
                ScrollView { VStack(alignment: .leading, spacing: 10) {
                    Text(lines[0]).font(.headline).accessibilityIdentifier("help-title")
                    Text(lines[1]).font(.title3.weight(.semibold))
                    ForEach(Array(lines.dropFirst(2).dropLast()), id: \.self) { Text($0).font(.body) }
                    Text(lines[lines.count - 1]).font(.title3.weight(.semibold)).foregroundStyle(Color.sage)
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
        Group { if c.isEmpty { Image(systemName: "person.crop.circle").resizable().scaledToFit().foregroundStyle(Color.muted) } else { BundleImage(name: "avatar-\(c)") } }
            .frame(width: size, height: size).clipShape(Circle()).overlay(Circle().stroke(Color.line, lineWidth: 1))
            .accessibilityLabel("Your character").accessibilityIdentifier("avatar")
    }
}
