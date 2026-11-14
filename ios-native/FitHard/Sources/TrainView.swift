import SwiftUI

/// Train (build 36, item C, her words): the main screen shows ONLY today's workout —
/// one big play, its name, time, effort and today's adapted label. Everything else
/// (all workouts, swap today, the library, history and machines) lives behind the
/// + button at the top. Plan settings live in Settings, per the Settings law.
struct TrainView: View {
    @EnvironmentObject var store: Store
    @State private var showAll = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if store.s.routines.isEmpty { buildCard }
                    else if let r = store.routine(on: store.today) { dayCard(r) }
                    else { restCard }
                    quickCard
                }.padding(16)
            }
            .background(Color.cream).navigationTitle("Train")
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) {
                Button { showAll = true } label: { BrandIcon("plus").font(.fh_title3_b).frame(width: 40, height: 40) }
                    .accessibilityLabel("All workouts and more").accessibilityIdentifier("train-plus")
            } }
            .sheet(isPresented: $showAll) { TrainAllSheet().environmentObject(store) }
        }
    }

    var buildCard: some View {
        Card { BundleImage(name: "wally-rest").frame(height: 100).frame(maxWidth: .infinity)
            Text("No routines yet. Pick your training days and I will build them.").foregroundStyle(Color.muted)
            BigButton(title: "Build my routines", icon: "sparkles") { store.generateRoutine(); Notifier.rebuild(store) } }
    }

    var restCard: some View {
        Card {
            SectionTitle(text: "Today")
            Text("Planned rest day. Recovery is part of the plan.").font(.fh_headline)
            if let t = dateFromKey(store.today).flatMap({ Calendar.current.date(byAdding: .day, value: 1, to: $0) }),
               let next = store.routine(on: dayKey(t)) {
                Text(String(format: NSLocalizedString("Next up: %@, tomorrow.", comment: ""), next.name)).font(.fh_subheadline).foregroundStyle(Color.muted)
            }
            Text("Want to train anyway? The + button at the top holds every workout.").font(.fh_caption).foregroundStyle(Color.muted)
        }
    }

    func dayCard(_ r: Routine) -> some View {
        let adapt = store.todaysAdaptation()
        let done = store.workedOutToday
        let ex = r.exIds.compactMap { store.cat.exercise($0) }
        return Card {
            HStack { Text(String(format: NSLocalizedString("Block %lld, week %lld of %lld", comment: ""), r.block, min(store.blockWeek, store.blockLength), store.blockLength)).font(.fh_caption).foregroundStyle(Color.muted); Spacer(); TypeBadge(type: r.trainType) }
            Text(r.name).font(.fh_title_b)
            HStack(spacing: 8) {
                Text(adapt.label).font(.fh_caption_b).padding(.horizontal, 10).padding(.vertical, 4)
                    .background(adapt.kind == .asPlanned ? Color.tint : Color.sage.opacity(0.25), in: Capsule()).foregroundStyle(Color.ink)
                Text(String(format: NSLocalizedString("%lld exercises · about %lld min", comment: ""), r.exIds.count, adapt.minutes(store.s.profile.minutes))).font(.fh_caption).foregroundStyle(Color.muted)
            }
            if let reason = adapt.reason { Text(reason).font(.fh_subheadline).foregroundStyle(Color.ink) }
            if store.s.dayRoutine[store.today] == r.id.uuidString {
                HStack { Text("Swapped in for today.").font(.fh_caption).foregroundStyle(Color.muted); Spacer()
                    Button("Undo swap") { store.s.dayRoutine[store.today] = nil }.font(.fh_caption_b).foregroundStyle(Color.sage) }
            }
            if store.s.fullPlanDays.contains(store.today) {
                HStack { Text("Full plan is on for today.").font(.fh_caption).foregroundStyle(Color.muted); Spacer()
                    Button("Back to adapted") { store.s.fullPlanDays.removeAll { $0 == store.today } }.font(.fh_caption_b).foregroundStyle(Color.sage) }
            } else if adapt.kind != .asPlanned {
                Button("See the full plan") { store.s.fullPlanDays.append(store.today) }.font(.fh_caption_b).foregroundStyle(Color.sage).accessibilityIdentifier("full-plan")
            }
            if !ex.isEmpty {
                HStack(spacing: -8) { ForEach(Array(ex.prefix(4).enumerated()), id: \.offset) { _, e in ExerciseIcon(exercise: e, size: 44) } }
                Text(ex.prefix(3).map { $0.name }.joined(separator: " · ") + (ex.count > 3 ? " +\(ex.count - 3)" : "")).font(.fh_subheadline).foregroundStyle(Color.muted)
            }
            if done {
                BrandLabel("Done today", icon: "checkmark.seal.fill").foregroundStyle(Color.sage)
                BigButton(title: "Train again", icon: "play.fill", filled: false) { store.training = r }.accessibilityIdentifier("start-today")
            } else {
                BigButton(title: "START", icon: "play.fill") { store.training = r }.accessibilityIdentifier("start-today")
            }
        }
    }

    var quickCard: some View {
        BigButton(title: "Quick workout, no equipment", icon: "bolt", filled: false) {
            let ids = store.cat.exercises.filter { $0.equipment == "body only" && ($0.category ?? "strength") == "strength" && $0.level == "beginner" }.sorted { ($0.anim != nil ? 0 : 1, $0.name) < ($1.anim != nil ? 0 : 1, $1.name) }.prefix(5).map { $0.id }
            store.s.draft = []; store.training = Routine(name: NSLocalizedString("Quick workout", comment: ""), weekday: 0, focus: [], exIds: Array(ids))
        }.accessibilityIdentifier("quick-workout")
    }
}

/// Everything that is not today's workout, behind the + button: all workouts, swap
/// today, the exercise library, history and machines.
struct TrainAllSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var mode = 0
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $mode) { Text("Workouts").tag(0); Text("Swap today").tag(1); Text("Library").tag(2); Text("History").tag(3); Text("Machines").tag(4) }.pickerStyle(.segmented).padding(16)
                switch mode { case 0: RoutinesList(); case 1: SwapTodayView(); case 2: LibraryView(); case 3: HistoryView(); default: MachineScreen() }
            }.background(Color.cream).navigationTitle("All workouts").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        // Starting a workout from inside the sheet closes the sheet first (the house
        // pattern from RoutineDetail), so the player opens clean at the root.
        .onChange(of: store.training) { t in if t != nil { dismiss() } }
    }
}

/// Swap today: today's session becomes another routine for this one day. A routine
/// whose focus was trained yesterday carries the 48 hour note — a note, never a block.
struct SwapTodayView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    var yesterdayFocus: Set<String> {
        let y = Calendar.current.date(byAdding: .day, value: -1, to: Date()).map { dayKey($0) } ?? ""
        guard let log = store.s.workouts.first(where: { dayKey($0.date) == y }),
              let rid = log.routineId, let r = store.s.routines.first(where: { $0.id.uuidString == rid }) else { return [] }
        return Set(r.focus)
    }
    var body: some View {
        ScrollView { VStack(spacing: 12) {
            Text("Pick a different workout for today only. Your block and your week stay as they are.").font(.fh_caption).foregroundStyle(Color.muted).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(store.s.routines) { r in
                Button {
                    store.s.dayRoutine[store.today] = r.id.uuidString; haptic(); dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text(r.name).font(.fh_subheadline_b); Spacer(); TypeBadge(type: r.trainType) }
                        Text(r.focus.map { focusName($0) }.joined(separator: ", ")).font(.fh_caption).foregroundStyle(Color.muted)
                        if !yesterdayFocus.isDisjoint(with: Set(r.focus)) {
                            Text("You trained this yesterday. 48 hours of rest is best.").font(.fh_caption).foregroundStyle(Color.taupe)
                        }
                    }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain).foregroundStyle(Color.ink).accessibilityIdentifier("swap-\(r.weekday)")
            }
        }.padding(16) }
    }
}

/// The same designed heart as recipes, now on exercises (build 35, item 2). One tap keeps it,
/// one tap takes it off. Hearts are saved per person and tilt the plan maker toward them.
struct ExerciseHeart: View {
    @EnvironmentObject var store: Store
    let e: Exercise
    var body: some View {
        let on = store.s.favExercises.contains(e.id)
        Button { store.toggleFavExercise(e.id); haptic() } label: {
            BrandIcon(on ? "heart.fill" : "heart").frame(width: 36, height: 36)
        }.buttonStyle(.plain).foregroundStyle(on ? Color.sage : Color.muted)
            .accessibilityLabel(on ? "Remove from favourites" : "Keep as favourite")
            .accessibilityIdentifier("fav-ex-\(e.id)")
    }
}

struct ExerciseRow: View {
    @EnvironmentObject var store: Store
    let e: Exercise
    var body: some View {
        NavigationLink { ExerciseDetail(e: e) } label: {
            HStack(spacing: 12) {
                if let a = store.animBase(e) { AnimatedFrames(base: a).frame(width: 64, height: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 12)) }
                else { BrandIcon( "figure.strengthtraining.traditional").frame(width: 64, height: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 12)) }
                VStack(alignment: .leading) { Text(e.name).font(.fh_subheadline_b).multilineTextAlignment(.leading); Text(e.partLabel ?? e.part.capitalized).font(.fh_caption).foregroundStyle(Color.muted) }
                Spacer(); ExerciseHeart(e: e); HelpButton(exercise: e); BrandIcon( "chevron.right").foregroundStyle(Color.muted)
            }.padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
        }.foregroundStyle(Color.ink)
    }
}

struct LibraryView: View {
    @EnvironmentObject var store: Store
    @State private var q = ""
    @State private var part = "all"
    var parts: [String] { ["all"] + Array(Set(store.cat.exercises.map { $0.part })).sorted() }
    var list: [Exercise] { store.cat.exercises.filter { (part == "all" || $0.part == part) && (q.isEmpty || $0.name.localizedCaseInsensitiveContains(q)) } }
    var body: some View {
        VStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(parts, id: \.self) { p in Chip(label: partName(p), on: part == p) { part = p } } }.padding(.horizontal, 16) }
            List(list.prefix(200)) { e in
                NavigationLink { ExerciseDetail(e: e) } label: {
                    HStack { ExerciseIcon(exercise: e, size: 44); if let a = store.animBase(e) { AnimatedFrames(base: a).frame(width: 44, height: 44) }; VStack(alignment: .leading) { Text(e.name).font(.fh_subheadline_b); Text("\(e.partLabel ?? e.part) · \(equipName(e.equipment))").font(.fh_caption).foregroundStyle(Color.muted) }; Spacer(); ExerciseHeart(e: e) }
                }.listRowBackground(Color.surface)
            }.listStyle(.plain).scrollContentBackground(.hidden)
        }.searchable(text: $q, prompt: String(format: NSLocalizedString("Search %lld exercises", comment: ""), store.cat.exercises.count))
    }
}

struct ExerciseDetail: View {
    @EnvironmentObject var store: Store
    let e: Exercise
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ExerciseIcon(exercise: e, size: 84).frame(maxWidth: .infinity)
                if let a = store.animBase(e) { AnimatedFrames(base: a).frame(height: 260).frame(maxWidth: .infinity).background(Color.surface, in: RoundedRectangle(cornerRadius: 20)) }
                Flow { Chip(label: e.partLabel ?? e.part, on: false) {}; Chip(label: equipName(e.equipment), on: false) {}; Chip(label: levelName(e.level), on: false) {} }
                HStack { Spacer(); ExerciseHeart(e: e); HelpButton(exercise: e) }
                Card { SectionTitle(text: "How"); Text(e.cue) }
            }.padding(16)
        }.background(Color.cream).navigationTitle(e.name).navigationBarTitleDisplayMode(.inline)
    }
}

struct HistoryView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let list = store.s.workouts.sorted { $0.date > $1.date }
        if list.isEmpty { Spacer(); Text("Your workouts show up here.").foregroundStyle(Color.muted); Spacer() }
        else {
            List(list) { w in
                VStack(alignment: .leading, spacing: 4) {
                    Text(w.date.formatted(.dateTime.weekday(.wide).day().month())).font(.fh_headline)
                    ForEach(w.entries) { en in
                        Text("\(store.cat.exercise(en.exerciseId)?.name ?? en.exerciseId): " + en.sets.map { "\($0.reps)×\($0.kg.formatted())" }.joined(separator: ", ")).font(.fh_caption).foregroundStyle(Color.muted)
                    }
                }.listRowBackground(Color.surface)
            }.listStyle(.plain).scrollContentBackground(.hidden)
        }
    }
}
