import SwiftUI

/// Training mode (build 32, reshaped in 35). Total time is pinned on top and counts up. The exercise opens on a whole screen
/// with its real picture and a countdown, a "?" how-to, and an optional weight and reps tracker. The workout opens at once:
/// doses are never asked here (her ruling, 13 Nov) — they live in My doses, and after the workout one small line shows only
/// when a dose is still unconfirmed (that line rides Item 6, after her word on the My doses design).
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
    @State private var workEnd: Date? = nil
    @State private var workLen = 40
    @State private var summary = false
    @State private var loaded = false
    @State private var tracking = false
    @State private var confirmQuit = false
    @State private var focus: FocusKind = .none
    enum FocusKind { case none, picture, timer }

    var ids: [String] { routine.exIds }
    var exercise: Exercise? { idx < ids.count ? store.cat.exercise(ids[idx]) : nil }
    var resting: Bool { restEnd != nil || pausedLeft != nil }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                if summary { summaryView } else { workout }
            }
            if focus != .none, !summary { focusOverlay }
        }.background(Color.cream.ignoresSafeArea())
        .onAppear(perform: load)
        .onChange(of: entries) { v in if loaded && !summary { store.s.draft = v } }
        .confirmationDialog("Leave this workout?", isPresented: $confirmQuit, titleVisibility: .visible) {
            Button("Keep it and come back later") { dismiss() }
            Button("Discard this workout", role: .destructive) { discardAndClose() }
        }
        .sheet(isPresented: $tracking) { trackSheet }
        // Swipe law: sliding from the left edge goes back one page.
        .gesture(DragGesture(minimumDistance: 24).onEnded { v in if v.startLocation.x < 40 && v.translation.width > 70 { swipeBack() } })
    }

    func swipeBack() {
        if focus != .none { focus = .none }
        else if summary { summary = false }
        else if idx > 0 { idx -= 1; workEnd = nil }
        else { confirmQuit = true }
    }
    func discardAndClose() { store.s.draft = []; store.s.draftStart = nil; store.s.draftRoutine = nil; dismiss() }

    func load() {
        guard !loaded else { return }
        if !store.s.draft.isEmpty, store.s.draftRoutine == routine.id.uuidString, store.s.draft.count == ids.count {
            entries = store.s.draft; start = store.s.draftStart ?? Date()
            idx = entries.firstIndex(where: { $0.sets.contains { $0.done != true } }) ?? 0
        } else {
            entries = ids.map { id in
                let ex = store.cat.exercise(id)
                let t = ex.map { ProgressionEngine.next(ex: $0, history: store.history(for: id), goal: store.s.profile.primaryGoal) }
                var n = WorkoutGenerator.setCount(for: ex, profile: store.s.profile)
                if store.s.lightDays.contains(store.today) { n = min(n, 2) }
                return Entry(exerciseId: id, sets: Array(repeating: SetLog(reps: t?.lo ?? 10, kg: t?.kg ?? 0, done: false), count: n))
            }
            start = Date(); store.s.draft = entries; store.s.draftStart = start; store.s.draftRoutine = routine.id.uuidString
        }
        loaded = true
    }

    // MARK: Focus views (Item 8): the timer alone, big and clean, or the exercise picture alone,
    // full screen. One tap anywhere returns to the full player. The timer here is display only;
    // the ring in the workout keeps the one ticking path, so nothing can finish twice.
    @ViewBuilder var focusOverlay: some View {
        ZStack {
            Color.cream.ignoresSafeArea()
            if focus == .timer {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let isRest = restEnd != nil || pausedLeft != nil
                    let left: Int = isRest ? (pausedLeft ?? max(0, Int((restEnd ?? ctx.date).timeIntervalSince(ctx.date).rounded(.up))))
                                           : (workEnd != nil ? max(0, Int((workEnd ?? ctx.date).timeIntervalSince(ctx.date).rounded(.up))) : workLen)
                    VStack(spacing: 16) {
                        Text(String(format: "%d:%02d", left / 60, left % 60)).font(.fh_largeTitle_b).monospacedDigit().foregroundStyle(Color.ink).scaleEffect(2.1)
                        Text(LocalizedStringKey(isRest ? "Rest" : "Work")).font(.fh_headline).foregroundStyle(Color.muted)
                        Text("Tap anywhere to go back").font(.fh_caption).foregroundStyle(Color.muted)
                    }
                }
            } else if focus == .picture, let ex = exercise, let a = store.animBase(ex) {
                VStack(spacing: 14) {
                    AnimatedFrames(base: a).frame(maxWidth: .infinity, maxHeight: .infinity)
                    Text(ex.name).font(.fh_title3_b).foregroundStyle(Color.ink)
                    Text("Tap anywhere to go back").font(.fh_caption).foregroundStyle(Color.muted)
                }.padding(20)
            }
        }.contentShape(Rectangle()).onTapGesture { focus = .none }
        .accessibilityLabel("Back to the workout").accessibilityIdentifier(focus == .timer ? "focus-timer" : "focus-picture")
    }

    // MARK: The workout
    var workout: some View {
        VStack(spacing: 0) {
            HStack {
                Button { confirmQuit = true } label: { BrandIcon("xmark").font(.fh_title3_b).frame(width: 44, height: 44) }.accessibilityLabel("Leave workout").accessibilityIdentifier("train-close")
                Spacer()
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let e = max(0, Int(ctx.date.timeIntervalSince(start)))
                    Text(e >= 3600 ? String(format: "%d:%02d:%02d", e / 3600, (e % 3600) / 60, e % 60) : String(format: "%d:%02d", e / 60, e % 60))
                        .font(.fh_title_b).monospacedDigit().foregroundStyle(Color.ink).accessibilityIdentifier("train-total-time")
                }
                Spacer()
                Text("\(idx + 1)/\(ids.count)").font(.fh_subheadline_b).foregroundStyle(Color.muted).frame(width: 44).accessibilityIdentifier("train-progress")
            }.padding(.horizontal, 12).padding(.top, 8)
            if let ex = exercise, idx < entries.count { exerciseScreen(ex) }
        }
    }

    @ViewBuilder func exerciseScreen(_ ex: Exercise) -> some View {
        VStack(spacing: 14) {
            Spacer(minLength: 0)
            if let a = store.animBase(ex) {
                AnimatedFrames(base: a).frame(height: 240).frame(maxWidth: .infinity)
                    .background(Color.surface, in: RoundedRectangle(cornerRadius: 20))
                    .onTapGesture { focus = .picture }
                    .accessibilityLabel("See the picture full screen").accessibilityIdentifier("train-picture")
            } else { ExerciseIcon(exercise: ex, size: 124) }
            Text(ex.name).font(.fh_title_b).multilineTextAlignment(.center).foregroundStyle(Color.ink).accessibilityIdentifier("train-exercise")
            ring.onTapGesture { focus = .timer }.accessibilityLabel("See the timer full screen").accessibilityIdentifier("train-timer")
            HStack(spacing: 8) {
                ForEach(entries[idx].sets.indices, id: \.self) { i in
                    Circle().fill(entries[idx].sets[i].done == true ? Color.sage : Color.tint).frame(width: 12, height: 12).overlay(Circle().stroke(Color.sage, lineWidth: 1))
                }
            }.accessibilityElement(children: .ignore)
            .accessibilityLabel(String(format: NSLocalizedString("%lld of %lld sets done", comment: ""), entries[idx].sets.filter { $0.done == true }.count, entries[idx].sets.count))
            Spacer(minLength: 0)
            controls(ex)
        }.padding(.horizontal, 16)
    }

    var ring: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let isRest = restEnd != nil || pausedLeft != nil
            let left: Int = isRest ? (pausedLeft ?? max(0, Int((restEnd ?? ctx.date).timeIntervalSince(ctx.date).rounded(.up))))
                                   : (workEnd != nil ? max(0, Int((workEnd ?? ctx.date).timeIntervalSince(ctx.date).rounded(.up))) : workLen)
            let total = isRest ? restLen : workLen
            ZStack {
                Circle().stroke(Color.tint, lineWidth: 14)
                Circle().trim(from: 0, to: total > 0 ? min(1, CGFloat(left) / CGFloat(total)) : 0)
                    .stroke(isRest ? Color.mist : Color.sage, style: StrokeStyle(lineWidth: 14, lineCap: .round)).rotationEffect(.degrees(-90))
                VStack(spacing: 2) {
                    Text(String(format: "%d:%02d", left / 60, left % 60)).font(.fh_largeTitle_b).monospacedDigit().foregroundStyle(Color.ink)
                        .accessibilityIdentifier(isRest ? "rest-left" : "work-left")
                    BrandIcon(isRest ? "moon" : "flame").foregroundStyle(Color.sage)
                }
            }.frame(width: 190, height: 190)
            .onChange(of: left) { v in tick(v, isRest) }
        }
    }
    func tick(_ v: Int, _ isRest: Bool) {
        guard v == 0 else { return }
        if isRest && restEnd != nil { restEnd = nil; haptic(.heavy) }
        else if !isRest && workEnd != nil { finishWork() }
    }
    func finishWork() {
        if let i = entries[idx].sets.firstIndex(where: { $0.done != true }) { entries[idx].sets[i].done = true }
        workEnd = nil; startRest(); haptic(.heavy)
    }
    func startRest() { restEnd = Date().addingTimeInterval(Double(restLen)); pausedLeft = nil }
    func adjust(_ d: Int) {
        let left = pausedLeft ?? max(0, Int((restEnd ?? Date()).timeIntervalSinceNow.rounded(.up)))
        let n = max(5, left + d); restLen = max(15, restLen + d)
        if pausedLeft != nil { pausedLeft = n } else { restEnd = Date().addingTimeInterval(Double(n)) }
    }

    func controls(_ ex: Exercise) -> some View {
        VStack(spacing: 10) {
            if resting {
                HStack(spacing: 18) {
                    Button(LocalizedStringKey(pausedLeft == nil ? "Pause" : "Resume")) {
                        if let p = pausedLeft { restEnd = Date().addingTimeInterval(Double(p)); pausedLeft = nil }
                        else { pausedLeft = max(0, Int((restEnd ?? Date()).timeIntervalSinceNow.rounded(.up))); restEnd = nil }
                    }.accessibilityIdentifier("rest-pause")
                    Button("Minus 15 s") { adjust(-15) }
                    Button("Plus 15 s") { adjust(15) }
                }.font(.fh_subheadline_b).foregroundStyle(Color.sage)
            }
            HStack(spacing: 16) {
                HelpButton(exercise: ex)
                BigButton(title: resting ? "Skip rest" : (workEnd == nil ? "START SET" : "FINISH SET"), icon: resting ? "chevron.right" : (workEnd == nil ? "play.fill" : "checkmark")) {
                    if resting { restEnd = nil; pausedLeft = nil }
                    else if workEnd == nil { workEnd = Date().addingTimeInterval(Double(workLen)) }
                    else { finishWork() }
                }.accessibilityIdentifier(resting ? "skip-rest" : "start-set")
                Button { tracking = true; haptic(.soft) } label: {
                    BrandIcon("tracker").frame(width: 44, height: 44).background(Color.tint, in: Circle()).foregroundStyle(Color.ink)
                }.buttonStyle(.plain).accessibilityLabel("Track weight and reps").accessibilityIdentifier("track-button")
            }
            HStack(spacing: 10) {
                if idx > 0 { BigButton(title: "Previous", filled: false) { idx -= 1; workEnd = nil }.accessibilityIdentifier("train-prev") }
                BigButton(title: idx == ids.count - 1 ? "Finish workout" : "Next exercise", icon: idx == ids.count - 1 ? "flag.checkered" : nil, filled: idx == ids.count - 1) {
                    if idx == ids.count - 1 { restEnd = nil; workEnd = nil; summary = true } else { idx += 1; workEnd = nil }
                }.accessibilityIdentifier("train-next")
            }
        }.padding(.bottom, 10)
    }

    // MARK: Optional tracking: weight and reps for each set
    @ViewBuilder var trackSheet: some View {
        if let ex = exercise, idx < entries.count {
            let t = ProgressionEngine.next(ex: ex, history: store.history(for: ex.id), goal: store.s.profile.primaryGoal)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack { Text(ex.name).font(.fh_title2_b).foregroundStyle(Color.ink); Spacer()
                        Button { tracking = false } label: { BrandIcon("xmark.circle.fill").font(.fh_title).foregroundStyle(Color.muted) }.accessibilityLabel("Close").accessibilityIdentifier("track-done") }
                    Card {
                        Text(String(format: NSLocalizedString("%lld sets · %lld to %lld reps · rest %lld s", comment: ""), entries[idx].sets.count, t.lo, t.hi, restLen)).font(.fh_subheadline_b)
                        Text(t.kg > 0 ? String(format: NSLocalizedString("Target: %@ kg. %@", comment: ""), RecipeService.fmt(t.kg), t.note) : t.note).font(.fh_caption).foregroundStyle(Color.muted)
                        if let l = store.history(for: ex.id).first?.sets.first { Text(String(format: NSLocalizedString("Last time: %lld reps at %@ kg", comment: ""), l.reps, RecipeService.fmt(l.kg))).font(.fh_caption).foregroundStyle(Color.muted) }
                    }
                    Card {
                        ForEach(entries[idx].sets.indices, id: \.self) { i in
                            HStack(spacing: 8) {
                                Button { entries[idx].sets[i].done = !(entries[idx].sets[i].done ?? false); if entries[idx].sets[i].done == true { workEnd = nil; startRest() }; haptic() } label: {
                                    BrandIcon(entries[idx].sets[i].done == true ? "checkmark.square.fill" : "square").font(.fh_title2).foregroundStyle(Color.sage).frame(width: 44, height: 44)
                                }.accessibilityLabel(String(format: NSLocalizedString("Set %lld done", comment: ""), i + 1)).accessibilityIdentifier("set-done-\(i)")
                                VStack(alignment: .leading, spacing: 2) {
                                    Stepper("\(RecipeService.fmt(entries[idx].sets[i].kg)) kg", value: $entries[idx].sets[i].kg, in: 0...500, step: 2.5)
                                    Stepper("\(entries[idx].sets[i].reps) reps", value: $entries[idx].sets[i].reps, in: 0...60)
                                }.font(.fh_subheadline)
                            }
                        }
                        HStack {
                            BigButton(title: "Add set", icon: "plus", filled: false) { entries[idx].sets.append(entries[idx].sets.last ?? SetLog(reps: t.lo, kg: t.kg, done: false)) }
                            if entries[idx].sets.count > 1 { Button { entries[idx].sets.removeLast() } label: { BrandIcon("minus.circle").font(.fh_title2).frame(width: 44, height: 44) }.accessibilityLabel("Remove a set") }
                        }
                    }
                    Card {
                        Text("How hard was it?").font(.fh_subheadline_b)
                        Flow { ForEach([(1, "Easy"), (2, "Fine"), (3, "Good work"), (4, "Hard"), (5, "Max")], id: \.0) { d in
                            Chip(label: d.1, on: entries[idx].difficulty == d.0) { entries[idx].difficulty = d.0 } } }
                        Toggle("I felt pain", isOn: Binding(get: { entries[idx].painFlag ?? false }, set: { entries[idx].painFlag = $0 })).tint(Color.sage)
                        TextField("Notes (optional)", text: Binding(get: { entries[idx].sets.first?.note ?? "" }, set: { v in if !entries[idx].sets.isEmpty { entries[idx].sets[0].note = v } })).padding(10).background(Color.cream, in: RoundedRectangle(cornerRadius: 10))
                    }
                }.padding(16)
            }.background(Color.cream.ignoresSafeArea()).presentationDetents([.large])
        }
    }

    var summaryView: some View {
        let secs = Int(Date().timeIntervalSince(start))
        let done = entries.flatMap { $0.sets }.filter { $0.done == true }
        let vol = done.reduce(0.0) { $0 + Double($1.reps) * $1.kg }
        return ScrollView { VStack(spacing: 14) {
            BundleImage(name: "wally-celebrate").frame(height: 120)
            Text("Workout done").font(.fh_largeTitle_b).accessibilityIdentifier("train-summary")
            Card {
                row("Time", String(format: "%d:%02d", secs / 60, secs % 60)); row("Sets done", "\(done.count)"); row("Volume", "\(RecipeService.fmt(vol)) kg")
                row("Exercises", "\(entries.filter { $0.sets.contains { $0.done == true } }.count) of \(entries.count)")
            }
            Card {
                SectionTitle(text: "Next time")
                ForEach(entries.filter { $0.sets.contains { $0.done == true } }) { en in
                    if let ex = store.cat.exercise(en.exerciseId) {
                        let sim = ProgressionEngine.next(ex: ex, history: [en] + store.history(for: en.exerciseId), goal: store.s.profile.primaryGoal)
                        VStack(alignment: .leading) { Text(ex.name).font(.fh_subheadline_b); Text(sim.note).font(.fh_caption).foregroundStyle(Color.muted) }
                    }
                }
            }
            BigButton(title: "Save and close", icon: "checkmark") {
                store.finishWorkout(entries: entries, routine: routine, seconds: secs); haptic(.heavy); store.say("Workout saved. Nice work."); dismiss()
            }.accessibilityIdentifier("train-save")
        }.padding(16) }
    }
    func row(_ a: String, _ b: String) -> some View { HStack { Text(LocalizedStringKey(a)).foregroundStyle(Color.muted); Spacer(); Text(b).font(.fh_headline) } }
}
