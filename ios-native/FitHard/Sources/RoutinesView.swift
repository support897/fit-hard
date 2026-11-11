import SwiftUI

let partNames: [String: String] = ["chest": "Chest", "lats": "Back", "middle back": "Upper back", "shoulders": "Shoulders", "biceps": "Biceps", "triceps": "Triceps", "abdominals": "Core",
    "quadriceps": "Front legs", "hamstrings": "Back legs", "glutes": "Glutes", "calves": "Calves", "traps": "Traps", "lower back": "Lower back", "forearms": "Forearms", "adductors": "Inner thigh", "abductors": "Outer thigh", "neck": "Neck"]

struct RoutinesList: View {
    @EnvironmentObject var store: Store
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            WallyBubble()
            if store.s.routines.isEmpty {
                Card { BundleImage(name: "wally-rest").frame(height: 100).frame(maxWidth: .infinity)
                    Text("No routines yet. Pick your training days and I will build them.").foregroundStyle(Color.muted)
                    BigButton(title: "Build my routines", icon: "sparkles") { store.generateRoutine(); Notifier.rebuild(store) } }
            } else {
                Text(String(format: NSLocalizedString("Block %lld, week %lld of 4", comment: ""), store.s.routines.first?.block ?? 1, min(4, store.blockWeek))).font(.fh_caption).foregroundStyle(Color.muted).frame(maxWidth: .infinity, alignment: .leading)
                ForEach(Array(store.s.routines.enumerated()), id: \.element.id) { i, r in RoutineCard(r: r, index: i) }
                if store.blockWeek > 4 { BigButton(title: "Start the next 4 week block", icon: "arrow.right.circle") { store.nextBlock(); store.say("New block. Only some exercises change.") } }
            }
            BigButton(title: "Quick workout, no equipment", icon: "bolt", filled: false) {
                let ids = store.cat.exercises.filter { $0.equipment == "body only" && ($0.category ?? "strength") == "strength" && $0.level == "beginner" }.sorted { ($0.anim != nil ? 0 : 1, $0.name) < ($1.anim != nil ? 0 : 1, $1.name) }.prefix(5).map { $0.id }
                store.s.draft = []; store.training = Routine(name: NSLocalizedString("Quick workout", comment: ""), weekday: 0, focus: [], exIds: Array(ids))
            }.accessibilityIdentifier("quick-workout")
        }.padding(16) }
    }
}

struct RoutineCard: View {
    @EnvironmentObject var store: Store
    let r: Routine
    let index: Int
    @State private var view = false
    var body: some View {
        let kcal = WorkoutGenerator.kcalEstimate(minutes: store.s.profile.minutes, weightKg: store.s.profile.weightKg)
        Card {
            HStack { Text(r.name).font(.fh_title3_b); TypeBadge(type: r.trainType); if r.customized { Text("Customized").font(.fh_caption2_b).padding(.horizontal, 8).padding(.vertical, 3).background(Color.tint, in: Capsule()) }; Spacer() }
            Text(r.focus.map { focusName($0) }.joined(separator: ", ")).font(.fh_subheadline).foregroundStyle(Color.muted)
            Text(String(format: NSLocalizedString("%lld exercises · %lld min", comment: ""), r.exIds.count, store.s.profile.minutes) + (kcal.map { String(format: NSLocalizedString(" · about %lld kcal (estimate)", comment: ""), $0) } ?? "")).font(.fh_caption)
            Text(String(format: NSLocalizedString("Last: %@ · Next: %@", comment: ""), store.lastCompleted(r)?.formatted(.dateTime.weekday(.abbreviated).day().month()) ?? NSLocalizedString("not yet", comment: ""), store.nextSession(r)?.formatted(.dateTime.weekday(.abbreviated).day().month()) ?? NSLocalizedString("none", comment: ""))).font(.fh_caption).foregroundStyle(Color.muted)
            HStack(spacing: 10) {
                BigButton(title: "START", icon: "play.fill") { store.training = r }.accessibilityIdentifier("start-routine-\(index)")
                BigButton(title: "VIEW", filled: false) { view = true }.accessibilityIdentifier("view-routine-\(index)")
            }
        }.sheet(isPresented: $view) { NavigationStack { RoutineDetail(id: r.id) } }
    }
}

struct RoutineDetail: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    let id: UUID
    @State private var adding = false
    var idx: Int? { store.s.routines.firstIndex { $0.id == id } }
    var body: some View {
        if let i = idx {
            List {
                Section { Text(store.s.routines[i].focus.map { focusName($0) }.joined(separator: ", ")).foregroundStyle(Color.muted) }
                Section("Exercises") {
                    ForEach(store.s.routines[i].exIds, id: \.self) { eid in
                        if let e = store.cat.exercise(eid) {
                            HStack { ExerciseIcon(exercise: e, size: 40); VStack(alignment: .leading) { Text(e.name).font(.fh_subheadline_b); Text("\(focusName(e.part)) · \(equipName(e.equipment))").font(.fh_caption).foregroundStyle(Color.muted) }
                                Spacer(); HelpButton(exercise: e)
                                Button { remove(eid, i) } label: { BrandIcon( "minus.circle").frame(width: 36, height: 36) }.foregroundStyle(Color.muted).buttonStyle(.plain) }
                        }
                    }.listRowBackground(Color.surface)
                    Button("Add an exercise") { adding = true }
                }
                Section { BigButton(title: "START", icon: "play.fill") { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { store.training = store.s.routines.first { $0.id == id } } } }.listRowBackground(Color.clear)
            }.scrollContentBackground(.hidden).background(Color.cream).navigationTitle(store.s.routines[i].name).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $adding) { NavigationStack { LibraryPicker { eid in
                if let j = idx, !store.s.routines[j].exIds.contains(eid) { store.s.routines[j].exIds.append(eid); store.s.routines[j].customized = true; store.syncRoutineDays() }
                adding = false
            }.navigationTitle("Pick an exercise").navigationBarTitleDisplayMode(.inline) } }
        }
    }
    func remove(_ eid: String, _ i: Int) {
        store.s.routines[i].exIds.removeAll { $0 == eid }; store.s.routines[i].customized = true; store.syncRoutineDays()
    }
}
