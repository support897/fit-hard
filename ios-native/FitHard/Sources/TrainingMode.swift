import SwiftUI

/// Training mode: one exercise at a time, real sets, date based rest timer, help on every exercise.
struct TrainingMode: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    let routine: Routine
    @State private var idx = 0
    @State private var entries: [Entry] = []
    @State private var start = Date()
    @State private var restEnd: Date? = nil
    @State private var restLen = 90
    @State private var pausedLeft: Int? = nil
    @State private var setStart: Date? = nil
    @State private var summary = false
    @State private var loaded = false
    @State private var confirmQuit = false

    var ids: [String] { routine.exIds }
    var exercise: Exercise? { idx < ids.count ? store.cat.exercise(ids[idx]) : nil }

    var body: some View {
        VStack(spacing: 0) {
            if summary { summaryView } else { workout }
        }.background(Color.cream.ignoresSafeArea())
        .onAppear(perform: load)
        .onChange(of: entries) { v in if loaded && !summary { store.s.draft = v } }
        .confirmationDialog("Leave this workout?", isPresented: $confirmQuit, titleVisibility: .visible) {
            Button("Keep it and come back later") { dismiss() }
            Button("Discard this workout", role: .destructive) { store.s.draft = []; store.s.draftStart = nil; store.s.draftRoutine = nil; dismiss() }
        }
    }

    func load() {
        guard !loaded else { return }
        if !store.s.draft.isEmpty, store.s.draftRoutine == routine.id.uuidString, store.s.draft.count == ids.count {
            entries = store.s.draft; start = store.s.draftStart ?? Date()
            idx = entries.firstIndex(where: { $0.sets.contains { $0.done != true } }) ?? 0
        } else {
            entries = ids.map { id in
                let ex = store.cat.exercise(id)
                let t = ex.map { ProgressionEngine.next(ex: $0, history: store.history(for: id), goal: store.s.profile.primaryGoal) }
                return Entry(exerciseId: id, sets: Array(repeating: SetLog(reps: t?.lo ?? 10, kg: t?.kg ?? 0, done: false), count: 3))
            }
            start = Date(); store.s.draft = entries; store.s.draftStart = start; store.s.draftRoutine = routine.id.uuidString
        }
        loaded = true
    }

    var workout: some View {
        VStack(spacing: 0) {
            HStack {
                Button { confirmQuit = true } label: { Image(systemName: "xmark").font(.title3.bold()).frame(width: 44, height: 44) }.accessibilityLabel("Leave workout").accessibilityIdentifier("train-close")
                Spacer()
                VStack(spacing: 0) {
                    Text("Exercise \(idx + 1) of \(ids.count)").font(.subheadline.weight(.semibold)).accessibilityIdentifier("train-progress")
                    TimelineView(.periodic(from: .now, by: 1)) { ctx in
                        let e = Int(ctx.date.timeIntervalSince(start)); Text(String(format: "%d:%02d elapsed", e / 60, e % 60)).font(.caption).foregroundStyle(Color.muted)
                    }
                }
                Spacer()
                if let ex = exercise { HelpButton(exercise: ex) } else { Color.clear.frame(width: 44, height: 44) }
            }.padding(.horizontal, 12).padding(.top, 8)
            if let ex = exercise, idx < entries.count {
                ScrollView { VStack(alignment: .leading, spacing: 14) { page(ex) }.padding(16) }
                bottomBar
            }
        }
    }

    @ViewBuilder func page(_ ex: Exercise) -> some View {
        let t = ProgressionEngine.next(ex: ex, history: store.history(for: ex.id), goal: store.s.profile.primaryGoal)
        Text(ex.name).font(.system(.title, design: .serif).bold()).accessibilityIdentifier("train-exercise")
        Picker("Mode", selection: $store.s.profile.trainMode) { Text("Timer only").tag("timer"); Text("Guided").tag("guided"); Text("Hybrid").tag("hybrid") }.pickerStyle(.segmented).accessibilityIdentifier("train-mode")
        Card {
            Text("\(entries[idx].sets.count) sets · \(t.lo) to \(t.hi) reps · rest \(restLen) s").font(.subheadline.weight(.semibold))
            Text(t.kg > 0 ? "Target: \(RecipeService.fmt(t.kg)) kg. \(t.note)" : t.note).font(.caption).foregroundStyle(Color.muted)
            if let l = store.history(for: ex.id).first?.sets.first { Text("Last time: \(l.reps) reps at \(RecipeService.fmt(l.kg)) kg").font(.caption).foregroundStyle(Color.muted) }
        }
        let mode = store.s.profile.trainMode
        if mode != "timer" {
            Card {
                SectionTitle(text: "How to do it")
                if let h = HelpText.help(for: ex.id) { ForEach(Array(h.s.enumerated()), id: \.offset) { n, s in Text("\(n + 1). \(s)").font(.subheadline) } }
                else { Text(ex.cue).font(.subheadline) }
                if ex.anim != nil {
                    Toggle("Show preview animation (not yet quality approved)", isOn: $store.s.previewAnims).font(.caption).tint(Color.sage)
                    if store.s.previewAnims, let a = ex.anim { AnimatedFrames(base: a).frame(height: mode == "hybrid" ? 130 : 220).frame(maxWidth: .infinity) }
                }
            }
        }
        // Rest timer
        if restEnd != nil || pausedLeft != nil { restCard }
        // Sets
        Card {
            HStack { Text("Sets").font(.headline); Spacer()
                if let s = setStart { TimelineView(.periodic(from: .now, by: 1)) { ctx in Text("Set running \(Int(ctx.date.timeIntervalSince(s))) s").font(.caption).foregroundStyle(Color.sage) } } }
            ForEach(entries[idx].sets.indices, id: \.self) { i in
                HStack(spacing: 8) {
                    Button { entries[idx].sets[i].done = !(entries[idx].sets[i].done ?? false); if entries[idx].sets[i].done == true { startRest() }; haptic() } label: {
                        Image(systemName: entries[idx].sets[i].done == true ? "checkmark.square.fill" : "square").font(.title2).foregroundStyle(Color.sage).frame(width: 44, height: 44)
                    }.accessibilityLabel("Set \(i + 1) done").accessibilityIdentifier("set-done-\(i)")
                    VStack(alignment: .leading, spacing: 2) {
                        Stepper("\(RecipeService.fmt(entries[idx].sets[i].kg)) kg", value: $entries[idx].sets[i].kg, in: 0...500, step: 2.5)
                        Stepper("\(entries[idx].sets[i].reps) reps", value: $entries[idx].sets[i].reps, in: 0...60)
                    }.font(.subheadline)
                }
            }
            HStack {
                BigButton(title: "Add set", icon: "plus", filled: false) { entries[idx].sets.append(entries[idx].sets.last ?? SetLog(reps: t.lo, kg: t.kg, done: false)) }
                if entries[idx].sets.count > 1 { Button { entries[idx].sets.removeLast() } label: { Image(systemName: "minus.circle").font(.title2).frame(width: 44, height: 44) }.accessibilityLabel("Remove a set") }
            }
        }
        Card {
            Text("How hard was it?").font(.subheadline.weight(.semibold))
            Flow { ForEach([(1, "Easy"), (2, "Fine"), (3, "Good work"), (4, "Hard"), (5, "Max")], id: \.0) { d in
                Chip(label: d.1, on: entries[idx].difficulty == d.0) { entries[idx].difficulty = d.0 } } }
            Toggle("I felt pain", isOn: Binding(get: { entries[idx].painFlag ?? false }, set: { entries[idx].painFlag = $0 })).tint(Color.sage)
            TextField("Notes (optional)", text: Binding(get: { entries[idx].sets.first?.note ?? "" }, set: { v in if !entries[idx].sets.isEmpty { entries[idx].sets[0].note = v } })).padding(10).background(Color.cream, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    var restCard: some View {
        Card {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let left = pausedLeft ?? max(0, Int((restEnd ?? ctx.date).timeIntervalSince(ctx.date).rounded(.up)))
                VStack(alignment: .leading, spacing: 8) {
                    Text(left > 0 ? "Rest \(left / 60):" + String(format: "%02d", left % 60) : "Rest is over. Ready when you are.").font(.title2.bold()).accessibilityIdentifier("rest-left")
                    HStack {
                        Button(pausedLeft == nil ? "Pause" : "Resume") {
                            if let p = pausedLeft { restEnd = Date().addingTimeInterval(Double(p)); pausedLeft = nil } else { pausedLeft = left; restEnd = nil }
                        }.accessibilityIdentifier("rest-pause")
                        Button("Minus 15 s") { adjust(-15, left) }
                        Button("Plus 15 s") { adjust(15, left) }
                        Spacer()
                        Button("Skip rest") { restEnd = nil; pausedLeft = nil }.accessibilityIdentifier("skip-rest")
                    }.font(.subheadline.weight(.bold))
                }.onChange(of: left) { v in if v == 0 && restEnd != nil { restEnd = nil; haptic(.heavy) } }
            }
        }
    }
    func adjust(_ d: Int, _ left: Int) {
        let n = max(5, left + d); restLen = max(15, restLen + d)
        if pausedLeft != nil { pausedLeft = n } else { restEnd = Date().addingTimeInterval(Double(n)) }
    }
    func startRest() { restEnd = Date().addingTimeInterval(Double(restLen)); pausedLeft = nil; setStart = nil }

    var bottomBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                BigButton(title: setStart == nil ? "START SET" : "FINISH SET", icon: setStart == nil ? "play.fill" : "checkmark") {
                    if setStart == nil { setStart = Date() }
                    else if let i = entries[idx].sets.firstIndex(where: { $0.done != true }) { entries[idx].sets[i].done = true; startRest() } else { setStart = nil }
                }.accessibilityIdentifier("start-set")
            }
            HStack(spacing: 10) {
                if idx > 0 { BigButton(title: "Previous", filled: false) { idx -= 1; setStart = nil }.accessibilityIdentifier("train-prev") }
                BigButton(title: idx == ids.count - 1 ? "Finish workout" : "Next exercise", icon: idx == ids.count - 1 ? "flag.checkered" : nil, filled: idx == ids.count - 1) {
                    if idx == ids.count - 1 { restEnd = nil; summary = true } else { idx += 1; setStart = nil }
                }.accessibilityIdentifier("train-next")
            }
        }.padding(.horizontal, 16).padding(.bottom, 10).padding(.top, 6)
    }

    var summaryView: some View {
        let secs = Int(Date().timeIntervalSince(start))
        let done = entries.flatMap { $0.sets }.filter { $0.done == true }
        let vol = done.reduce(0.0) { $0 + Double($1.reps) * $1.kg }
        return ScrollView { VStack(spacing: 14) {
            BundleImage(name: "wally-celebrate").frame(height: 120)
            Text("Workout done").font(.system(.largeTitle, design: .serif).bold()).accessibilityIdentifier("train-summary")
            Card {
                row("Time", String(format: "%d:%02d", secs / 60, secs % 60)); row("Sets done", "\(done.count)"); row("Volume", "\(RecipeService.fmt(vol)) kg")
                row("Exercises", "\(entries.filter { $0.sets.contains { $0.done == true } }.count) of \(entries.count)")
            }
            Card {
                SectionTitle(text: "Next time")
                ForEach(entries.filter { $0.sets.contains { $0.done == true } }) { en in
                    if let ex = store.cat.exercise(en.exerciseId) {
                        let sim = ProgressionEngine.next(ex: ex, history: [en] + store.history(for: en.exerciseId), goal: store.s.profile.primaryGoal)
                        VStack(alignment: .leading) { Text(ex.name).font(.subheadline.weight(.semibold)); Text(sim.note).font(.caption).foregroundStyle(Color.muted) }
                    }
                }
            }
            BigButton(title: "Save and close", icon: "checkmark") {
                store.finishWorkout(entries: entries, routine: routine, seconds: secs); haptic(.heavy); store.say("Workout saved. Nice work."); dismiss()
            }.accessibilityIdentifier("train-save")
        }.padding(16) }
    }
    func row(_ a: String, _ b: String) -> some View { HStack { Text(a).foregroundStyle(Color.muted); Spacer(); Text(b).font(.headline) } }
}
