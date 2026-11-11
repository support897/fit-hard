import SwiftUI

struct TrainView: View {
    @EnvironmentObject var store: Store
    @State private var mode = 0
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $mode) { Text("Routines").tag(0); Text("Library").tag(1); Text("History").tag(2); Text("Machines").tag(3) }.pickerStyle(.segmented).padding(16)
                switch mode { case 0: RoutinesList(); case 1: LibraryView(); case 2: HistoryView(); default: MachineScreen() }
            }.background(Color.cream).navigationTitle("Train")
        }
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
                Spacer(); HelpButton(exercise: e); BrandIcon( "chevron.right").foregroundStyle(Color.muted)
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
                    HStack { ExerciseIcon(exercise: e, size: 44); if let a = store.animBase(e) { AnimatedFrames(base: a).frame(width: 44, height: 44) }; VStack(alignment: .leading) { Text(e.name).font(.fh_subheadline_b); Text("\(e.partLabel ?? e.part) · \(equipName(e.equipment))").font(.fh_caption).foregroundStyle(Color.muted) } }
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
                if e.anim != nil || store.hasCharacterAnim(e) {
                    if !store.hasCharacterAnim(e) { Toggle("Show preview animation (not yet quality approved)", isOn: $store.s.previewAnims).font(.fh_caption).tint(Color.sage) }
                    if let a = store.animBase(e) { AnimatedFrames(base: a).frame(height: 260).frame(maxWidth: .infinity).background(Color.surface, in: RoundedRectangle(cornerRadius: 20)) }
                }
                Flow { Chip(label: e.partLabel ?? e.part, on: false) {}; Chip(label: equipName(e.equipment), on: false) {}; Chip(label: levelName(e.level), on: false) {} }
                HStack { Spacer(); HelpButton(exercise: e) }
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
