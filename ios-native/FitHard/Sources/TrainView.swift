import SwiftUI

struct TrainView: View {
    @EnvironmentObject var store: Store
    @State private var mode = 0
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $mode) { Text("Today").tag(0); Text("Library").tag(1); Text("History").tag(2); Text("Routines").tag(3); Text("Machines").tag(4) }.pickerStyle(.segmented).padding(16)
                switch mode { case 0: SessionView(); case 1: LibraryView(); case 2: HistoryView(); case 3: RoutinesScreen(); default: MachineScreen() }
            }.background(Color.cream).navigationTitle("Train")
        }
    }
}

struct SessionView: View {
    @EnvironmentObject var store: Store
    @State private var entries: [Entry] = []
    @State private var started = false
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                let ex = store.todaysExercises
                if started { RestTimer() }
                if ex.isEmpty {
                    Card { BundleImage(name: "wally-rest").frame(height: 120).frame(maxWidth: .infinity); Text("Rest day. Recovery is part of the plan.").foregroundStyle(Color.muted) }
                    BigButton(title: "Train anyway", icon: "bolt", filled: false) { startFree() }
                } else if !started {
                    ForEach(ex) { e in ExerciseRow(e: e) }
                    BigButton(title: "Start workout", icon: "play.fill") { start(ex) }
                } else {
                    ForEach($entries) { $en in
                        if let e = store.cat.exercise(en.exerciseId) { SetEditor(exercise: e, entry: $en, last: store.lastSets(for: e.id)) }
                    }
                    BigButton(title: "Finish", icon: "checkmark") { finish() }
                    Button("Discard this workout", role: .destructive) { started = false; entries = []; store.s.draft = [] }.font(.footnote)
                }
            }.padding(16)
        }
        .onAppear { if !started && !store.s.draft.isEmpty { entries = store.s.draft; started = true } }
        .onChange(of: entries) { v in if started { store.s.draft = v } }
    }
    func start(_ ex: [Exercise]) { entries = ex.map { Entry(exerciseId: $0.id, sets: [store.lastSets(for: $0.id)?.first ?? SetLog(reps: 10, kg: 0)]) }; started = true; haptic(.medium) }
    func startFree() {
        let any = store.cat.exercises.filter { $0.equipment == "body only" && $0.anim != nil }.prefix(4)
        start(Array(any))
    }
    func finish() {
        let done = entries.filter { !$0.sets.isEmpty }
        store.s.workouts.append(WorkoutLog(entries: done)); started = false; entries = []; store.s.draft = []; haptic(.heavy); store.say("Workout saved. Nice work.")
    }
}

struct RestTimer: View {
    @State private var end: Date? = nil
    var body: some View {
        Card {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let left = max(0, Int((end ?? ctx.date).timeIntervalSince(ctx.date).rounded(.up)))
                HStack {
                    Label(left > 0 ? "Rest \(left / 60):" + String(format: "%02d", left % 60) : "Rest timer", systemImage: "timer").font(.headline)
                        .accessibilityLabel(left > 0 ? "Rest, \(left) seconds left" : "Rest timer")
                    Spacer()
                    ForEach([30, 60, 90], id: \.self) { s in
                        Button("\(s)s") { end = Date().addingTimeInterval(Double(s)); haptic(.soft) }
                            .font(.subheadline.weight(.bold)).padding(.horizontal, 12).padding(.vertical, 8).background(Color.tint, in: Capsule())
                    }
                }
                .onChange(of: left) { v in if v == 0 && end != nil { end = nil; haptic(.heavy) } }
            }
        }
    }
}

struct ExerciseRow: View {
    let e: Exercise
    var body: some View {
        NavigationLink { ExerciseDetail(e: e) } label: {
            HStack(spacing: 12) {
                if let a = e.anim { AnimatedFrames(base: a).frame(width: 64, height: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 12)) }
                else { Image(systemName: "figure.strengthtraining.traditional").frame(width: 64, height: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 12)) }
                VStack(alignment: .leading) { Text(e.name).font(.subheadline.weight(.semibold)).multilineTextAlignment(.leading); Text(e.partLabel ?? e.part.capitalized).font(.caption).foregroundStyle(Color.muted) }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(Color.muted)
            }.padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
        }.foregroundStyle(Color.ink)
    }
}

struct SetEditor: View {
    let exercise: Exercise
    @Binding var entry: Entry
    let last: [SetLog]?
    var body: some View {
        Card {
            HStack(spacing: 12) {
                if let a = exercise.anim { AnimatedFrames(base: a).frame(width: 56, height: 56) }
                VStack(alignment: .leading) { Text(exercise.name).font(.headline); if let l = last?.first { Text("Last: \(l.reps) × \(l.kg.formatted()) kg").font(.caption).foregroundStyle(Color.muted) } }
            }
            ForEach(Array(entry.sets.enumerated()), id: \.offset) { i, _ in
                HStack {
                    Text("Set \(i + 1)").font(.subheadline).foregroundStyle(Color.muted).frame(width: 48, alignment: .leading)
                    Stepper("\(entry.sets[i].reps) reps", value: $entry.sets[i].reps, in: 1...50)
                    Stepper("\(entry.sets[i].kg.formatted()) kg", value: $entry.sets[i].kg, in: 0...500, step: 2.5)
                }.font(.subheadline)
            }
            HStack {
                BigButton(title: "Add set", icon: "plus", filled: false) { entry.sets.append(entry.sets.last ?? SetLog(reps: 10, kg: 0)) }
                if entry.sets.count > 1 { Button { entry.sets.removeLast() } label: { Image(systemName: "minus.circle") }.padding() }
            }
        }
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
            ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(parts, id: \.self) { p in Chip(label: p.capitalized, on: part == p) { part = p } } }.padding(.horizontal, 16) }
            List(list.prefix(200)) { e in
                NavigationLink { ExerciseDetail(e: e) } label: {
                    HStack { if let a = e.anim { AnimatedFrames(base: a).frame(width: 44, height: 44) }; VStack(alignment: .leading) { Text(e.name).font(.subheadline.weight(.semibold)); Text("\(e.partLabel ?? e.part) · \(e.equipment)").font(.caption).foregroundStyle(Color.muted) } }
                }.listRowBackground(Color.surface)
            }.listStyle(.plain).scrollContentBackground(.hidden)
        }.searchable(text: $q, prompt: "Search \(store.cat.exercises.count) exercises")
    }
}

struct ExerciseDetail: View {
    let e: Exercise
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let a = e.anim { AnimatedFrames(base: a).frame(height: 260).frame(maxWidth: .infinity).background(Color.surface, in: RoundedRectangle(cornerRadius: 20)) }
                Flow { Chip(label: e.partLabel ?? e.part, on: false) {}; Chip(label: e.equipment, on: false) {}; Chip(label: e.level, on: false) {} }
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
                    Text(w.date.formatted(.dateTime.weekday(.wide).day().month())).font(.headline)
                    ForEach(w.entries) { en in
                        Text("\(store.cat.exercise(en.exerciseId)?.name ?? en.exerciseId): " + en.sets.map { "\($0.reps)×\($0.kg.formatted())" }.joined(separator: ", ")).font(.caption).foregroundStyle(Color.muted)
                    }
                }.listRowBackground(Color.surface)
            }.listStyle(.plain).scrollContentBackground(.hidden)
        }
    }
}
