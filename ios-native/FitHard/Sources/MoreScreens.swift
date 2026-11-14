import SwiftUI
import Charts

// MARK: Progress
struct ProgressScreen: View {
    @EnvironmentObject var store: Store
    @State private var mode = 0
    @State private var pendingDay: String? = nil
    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $mode) { Text("Overview").tag(0); Text("Strength").tag(1); Text("Results").tag(2); Text("Body").tag(3); Text("Review").tag(4) }.pickerStyle(.segmented).padding(16)
            ScrollView { VStack(spacing: 14) {
                switch mode { case 0: overview; case 1: strength; case 2: ResultsView(); case 3: BodyScreen(); default: ReviewScreen() }
            }.padding(16) }
        }.background(Color.cream).navigationTitle("Progress").navigationBarTitleDisplayMode(.inline)
    }
    var overview: some View {
        let wk = store.weeks(8)
        let ms = store.milestones
        return VStack(spacing: 14) {
            Card {
                SectionTitle(text: "This week"); Text(store.weekSummary).font(.fh_headline)
                Chip(label: store.isRestToday ? "Today is a rest day" : "Make today a rest day", icon: "moon", on: store.isRestToday) { store.toggleRest() }
                Text("Rest counts. It keeps your weeks going.").font(.fh_caption).foregroundStyle(Color.muted)
            }
            Card {
                SectionTitle(text: "Your journey")
                Text("\(store.activeWeeks)").font(.zilla(44, bold: true)).foregroundStyle(Color.sage)
                Text("active weeks, ever. They never reset.").font(.fh_subheadline).foregroundStyle(Color.muted)
                if store.currentRun > 1 { Text(String(format: NSLocalizedString("%lld weeks in a row right now", comment: ""), store.currentRun)).font(.fh_caption).foregroundStyle(Color.muted) }
                Chart(wk) { BarMark(x: .value("Week", $0.start, unit: .weekOfYear), y: .value("Workouts", $0.sessions)).foregroundStyle(Color.sage).cornerRadius(4) }
                    .frame(height: 120).chartYAxis(.hidden)
                Text("Last 8 weeks, oldest on the left.").font(.fh_caption).foregroundStyle(Color.muted)
            }
            Card {
                SectionTitle(text: "Milestones")
                if ms.earned.isEmpty { Text("Your first one is waiting. No rush.").foregroundStyle(Color.muted) }
                ForEach(ms.earned, id: \.self) { BrandLabel($0, icon: "star.fill").foregroundStyle(Color.ink) }
                if let n = ms.next { Text(String(format: NSLocalizedString("Next, whenever you like: %@", comment: ""), n)).font(.fh_caption).foregroundStyle(Color.muted) }
            }
            Card {
                SectionTitle(text: "Personal bests"); Text("Compared only with your own earlier sets.").font(.fh_caption).foregroundStyle(Color.muted)
                let pbs = store.personalBests()
                if pbs.isEmpty { Text("They appear when you log sets.").foregroundStyle(Color.muted) }
                ForEach(pbs.prefix(8)) { Text("**\($0.name)**: \($0.text)") }
            }
            if let d = try? JSONEncoder().encode(store.s), let t = String(data: d, encoding: .utf8) { ShareLink("Export my data", item: t) }
        }
    }
    @State private var exId: String? = nil
    var strength: some View {
        let ex = store.loggedExercises
        return Group {
            if ex.isEmpty { Card { Text("When you log reps and weights, your own history shows here.").foregroundStyle(Color.muted) } }
            else {
                let pick = exId ?? ex[0].id
                let pts = store.strengthSeries(pick)
                Card {
                    Picker("Exercise", selection: Binding(get: { pick }, set: { exId = $0 })) { ForEach(ex) { Text($0.name).tag($0.id) } }
                    Chart(pts) { LineMark(x: .value("Date", $0.date), y: .value("Top set", $0.value)).foregroundStyle(Color.sage); PointMark(x: .value("Date", $0.date), y: .value("Top set", $0.value)).foregroundStyle(Color.sage) }.frame(height: 160)
                    ForEach(pts.reversed().prefix(10)) { Text(String(format: NSLocalizedString("%@: %lld reps, %@", comment: ""), $0.date.formatted(date: .abbreviated, time: .omitted), $0.reps, $0.value.formatted())) .font(.fh_caption) }
                }
            }
        }
    }
}

/// Results (build 36, item C): the numbers the block system makes possible, all read
/// from the person's own logged sessions and nothing else. Because the main moves stay
/// stable for a whole block, these compares are like with like. A number with no log
/// behind it is never shown: the empty states say what will fill them.
struct ResultsView: View {
    @EnvironmentObject var store: Store
    var mainIds: [String] {
        var ids: [String] = []
        for r in store.s.routines { for id in r.exIds where !ids.contains(id) { ids.append(id) } }
        return ids
    }
    func topLine(_ e: Entry) -> String {
        guard let top = e.sets.max(by: { ($0.kg, $0.reps) < ($1.kg, $1.reps) }) else { return "" }
        return top.kg > 0 ? String(format: NSLocalizedString("%lld reps at %@ kg", comment: ""), top.reps, RecipeService.fmt(top.kg)) : String(format: NSLocalizedString("%lld reps", comment: ""), top.reps)
    }
    var body: some View {
        VStack(spacing: 14) {
            WallyBubble()
            Card {
                SectionTitle(text: "Your results")
                if store.s.workouts.isEmpty { Text("They build from the workouts you log. Nothing here is guessed.").foregroundStyle(Color.muted) }
                else {
                    HStack(spacing: 18) {
                        VStack { Text("\(store.s.workouts.count)").font(.zilla(30, bold: true)).foregroundStyle(Color.sage); Text("workouts done").font(.fh_caption).foregroundStyle(Color.muted) }
                        VStack { Text("\(store.streak)").font(.zilla(30, bold: true)).foregroundStyle(Color.sage); Text(store.streak == 1 ? "day streak" : "days streak").font(.fh_caption).foregroundStyle(Color.muted) }
                        VStack { Text(Int(store.totalWorkAll.rounded()).formatted()).font(.zilla(30, bold: true)).foregroundStyle(Color.sage); Text("kg moved").font(.fh_caption).foregroundStyle(Color.muted) }
                    }
                }
            }
            if !store.s.workouts.isEmpty {
                Card {
                    SectionTitle(text: "Main exercises")
                    Text("First logged top set beside the latest, per main exercise.").font(.fh_caption).foregroundStyle(Color.muted)
                    ForEach(mainIds, id: \.self) { id in
                        let h = store.history(for: id)
                        if let latest = h.first, let earliest = h.last, let ex = store.cat.exercise(id) {
                            HStack { Text(ex.name).font(.fh_subheadline_b); Spacer()
                                Text(h.count > 1 ? "\(topLine(earliest)) → \(topLine(latest))" : topLine(latest)).font(.fh_caption).foregroundStyle(Color.muted) }
                        }
                    }
                }
                Card {
                    SectionTitle(text: "Best sets")
                    let pbs = store.personalBests().filter { mainIds.contains($0.id) }
                    if pbs.isEmpty { Text("They appear when you log sets.").foregroundStyle(Color.muted) }
                    ForEach(pbs) { Text("**\($0.name)**: \($0.text)") }
                }
            }
            Card {
                SectionTitle(text: "Block by block")
                let hist = store.s.blockHistory
                if hist.count >= 2, let a = hist.dropLast().last, let b = hist.last {
                    Text(String(format: NSLocalizedString("Block %lld: %lld sessions, %@ kg moved. Block %lld: %lld sessions, %@ kg moved.", comment: ""), a.block, a.sessions, Int(a.totalWork.rounded()).formatted(), b.block, b.sessions, Int(b.totalWork.rounded()).formatted())).font(.fh_subheadline)
                    ForEach(mainIds, id: \.self) { id in
                        if let x = a.best[id], let y = b.best[id], let ex = store.cat.exercise(id) {
                            Text("**\(ex.name)**: \(Int(x[1])) × \(RecipeService.fmt(x[0])) kg → \(Int(y[1])) × \(RecipeService.fmt(y[0])) kg").font(.fh_caption)
                        }
                    }
                } else if let a = hist.last {
                    Text(String(format: NSLocalizedString("Block %lld finished: %lld sessions, %@ kg moved. The next block end brings the first compare.", comment: ""), a.block, a.sessions, Int(a.totalWork.rounded()).formatted())).font(.fh_subheadline)
                } else {
                    Text("Your first block compare lands at the end of this block.").foregroundStyle(Color.muted)
                }
            }
        }
    }
}

struct BodyScreen: View {
    @EnvironmentObject var store: Store
    @State private var f: [String: String] = [:]
    @State private var date = Date()
    @State private var err = ""
    @State private var wipe = false
    let fields = [("weight", "Weight (kg)"), ("waist", "Waist (cm)"), ("hips", "Hips (cm)"), ("chest", "Chest (cm)"), ("arm", "Upper arm (cm)"), ("thigh", "Thigh (cm)")]
    var body: some View {
        if store.s.hideBody {
            Card { Text("Body tracking is hidden. Nothing is shown here."); BigButton(title: "Show it again", filled: false) { store.s.hideBody = false } }
        } else {
            Card {
                SectionTitle(text: "Add an entry"); Text("Optional and private. Only a record.").font(.fh_caption).foregroundStyle(Color.muted)
                DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                ForEach(fields, id: \.0) { k, l in TextField(l, text: Binding(get: { f[k] ?? "" }, set: { f[k] = $0 })).keyboardType(.decimalPad) }
                if !err.isEmpty { Text(err).font(.fh_caption).foregroundStyle(Color.amber) }
                BigButton(title: "Save entry") { save() }
            }
            Card {
                SectionTitle(text: "Your entries")
                if store.s.body.isEmpty { Text("Nothing saved yet. That is completely fine.").foregroundStyle(Color.muted) }
                ForEach(store.s.body.sorted { $0.day > $1.day }.prefix(30)) { e in
                    HStack { VStack(alignment: .leading) { Text(e.day).bold(); Text(summary(e)).font(.fh_caption).foregroundStyle(Color.muted) }
                        Spacer(); Button { store.s.body.removeAll { $0.id == e.id } } label: { BrandIcon( "trash") }.foregroundStyle(Color.muted) }
                }
                HStack { Button("Hide body tracking") { store.s.hideBody = true }; Spacer(); if !store.s.body.isEmpty { Button("Delete all", role: .destructive) { wipe = true } } }.font(.fh_footnote)
            }
            .confirmationDialog("Delete every body entry? This cannot be undone.", isPresented: $wipe, titleVisibility: .visible) { Button("Delete", role: .destructive) { store.s.body = [] } }
        }
    }
    func summary(_ e: BodyEntry) -> String {
        [("kg", e.weight), ("waist", e.waist), ("hips", e.hips), ("chest", e.chest), ("arm", e.arm), ("thigh", e.thigh)].compactMap { n, v in v.map { "\(n) \($0.formatted())" } }.joined(separator: " · ")
    }
    func save() {
        func num(_ k: String) -> Double? { let t = (f[k] ?? "").replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces); return t.isEmpty ? nil : Double(t) }
        for (k, l) in fields { let t = (f[k] ?? "").trimmingCharacters(in: .whitespaces); if !t.isEmpty && num(k) == nil { err = "Check \(l): use a plain number like 72.5."; return } }
        let e = BodyEntry(day: dayKey(date), weight: num("weight"), waist: num("waist"), hips: num("hips"), chest: num("chest"), arm: num("arm"), thigh: num("thigh"))
        guard [e.weight, e.waist, e.hips, e.chest, e.arm, e.thigh].contains(where: { $0 != nil }) else { err = "Add at least one number, or skip this for today."; return }
        store.s.body.append(e); f = [:]; err = ""; store.say("Saved")
    }
}

struct ReviewScreen: View {
    @EnvironmentObject var store: Store
    @State private var r = Reflection()
    var wk: String { dayKey(store.weekStart(Date())) }
    var body: some View {
        Card {
            SectionTitle(text: "Weekly review"); Text(store.weekSummary).font(.fh_headline)
            Text(store.s.workouts.isEmpty ? "One suggested next step: pick one small thing this week. A short walk counts." : "One suggested next step: your next planned workout, at whatever size feels right.").font(.fh_subheadline).foregroundStyle(Color.muted)
        }.onAppear { r = store.s.reflections[wk] ?? Reflection() }
        Card {
            SectionTitle(text: "A quick look back"); Text("Optional. Skip any of these. Private to you.").font(.fh_caption).foregroundStyle(Color.muted)
            TextField("What felt easier?", text: $r.easier, axis: .vertical)
            TextField("What would you change?", text: $r.change, axis: .vertical)
            TextField("Your own next step", text: $r.next, axis: .vertical)
            BigButton(title: "Save reflection") { store.s.reflections[wk] = r; store.say("Saved") }
        }
        let past = store.s.reflections.keys.sorted().reversed().filter { $0 != wk }.prefix(5)
        if !past.isEmpty { Card { SectionTitle(text: "Earlier reflections"); ForEach(Array(past), id: \.self) { k in Text("**\(k)** \(store.s.reflections[k]?.next ?? "")").font(.fh_caption) } } }
    }
}

// MARK: Treats
struct TreatsScreen: View {
    @EnvironmentObject var store: Store
    @State private var name = ""; @State private var kcal = ""; @State private var quick = ""
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                SectionTitle(text: "Treats"); Text("Log it, enjoy it. All food is fine here.").font(.fh_caption).foregroundStyle(Color.muted)
                TextField("What was it?", text: $name); TextField("Calories (optional)", text: $kcal).keyboardType(.numberPad)
                BigButton(title: "Add", icon: "plus") { store.addTreat(name, Int(kcal)); name = ""; kcal = "" }
                if !store.usualTreats.isEmpty {
                    Text("Your usual").font(.fh_caption).foregroundStyle(Color.muted)
                    Flow { ForEach(store.usualTreats) { t in Chip(label: t.name + (t.kcal.map { " · \($0)" } ?? ""), on: false) { store.addTreat(t.name, t.kcal) } } }
                }
                TextField("Several at once: one per line, e.g. Cake 320", text: $quick, axis: .vertical).lineLimit(2...4)
                BigButton(title: "Sort them", filled: false) { store.quickTreats(quick); quick = "" }
            }
            let days = Dictionary(grouping: store.s.treats, by: { $0.day }).keys.sorted().reversed()
            if days.isEmpty { Card { Text("No treats logged yet. Nothing to fix.").foregroundStyle(Color.muted) } }
            ForEach(Array(days), id: \.self) { d in
                Card {
                    Text(d).font(.fh_headline)
                    ForEach(store.s.treats.filter { $0.day == d }) { t in
                        HStack { Text(t.name); Spacer(); Text(t.kcal.map { "about \($0) kcal" } ?? "no count").font(.fh_caption).foregroundStyle(Color.muted)
                            Button { store.s.treats.removeAll { $0.id == t.id } } label: { BrandIcon( "xmark.circle") }.foregroundStyle(Color.muted) }
                    }
                    let known = store.s.treats.filter { $0.day == d }.compactMap { $0.kcal }.reduce(0, +)
                    Text(String(format: NSLocalizedString("About %lld kcal. All fine.", comment: ""), known)).font(.fh_caption).foregroundStyle(Color.muted)
                }
            }
        }.padding(16) }.background(Color.cream).navigationTitle("Treats").navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: Fridge
struct FridgeScreen: View {
    @EnvironmentObject var store: Store
    @State private var have = Set<String>(); @State private var q = ""
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 14) {
            Card {
                SectionTitle(text: "What's in your fridge?"); Text("Tap what you have. I'll find recipes you can make.").font(.fh_caption).foregroundStyle(Color.muted)
                Flow { ForEach(store.cat.ingredients.common, id: \.self) { i in Chip(label: i.capitalized, on: have.contains(i)) { toggle(i) } } }
                TextField("Search ingredients", text: $q).textInputAutocapitalization(.never)
                if !q.isEmpty { Flow { ForEach(store.cat.ingredients.all.filter { $0.contains(q.lowercased()) }.prefix(12), id: \.self) { i in Chip(label: i.capitalized, on: have.contains(i)) { toggle(i) } } } }
            }
            let m = store.fridgeMatches(have)
            if !have.isEmpty && m.isEmpty { Text("No match yet. Add one more thing.").foregroundStyle(Color.muted) }
            ForEach(Array(m.prefix(25).enumerated()), id: \.offset) { _, row in
                let (r, hit, total) = row
                NavigationLink { RecipeDetail(recipe: r) } label: {
                    HStack { VStack(alignment: .leading) { Text(r.name).font(.fh_subheadline_b); Text(String(format: NSLocalizedString("You have %lld of %lld ingredients", comment: ""), hit, total)).font(.fh_caption).foregroundStyle(Color.muted) }; Spacer(); WatchReelButton(recipe: r); BrandIcon( "chevron.right") }
                        .padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
                }.foregroundStyle(Color.ink)
            }
        }.padding(16) }.background(Color.cream).navigationTitle("Fridge").navigationBarTitleDisplayMode(.inline)
    }
    func toggle(_ i: String) { if have.contains(i) { have.remove(i) } else { have.insert(i); haptic(.soft) } }
}

// MARK: Machine finder (manual search and confirm; never claims to recognise a photo)
struct MachineScreen: View {
    @EnvironmentObject var store: Store
    @State private var q = ""
    var body: some View {
        List {
            Section {
                NavigationLink { MachinePhotoMatchView() } label: { BrandLabel("Photo a machine", icon: "camera") }.accessibilityIdentifier("photo-a-machine")
                Text("Take a photo and Fit Hard will try to match it, or find the machine by name. It compares pictures, so always check the name it shows you.").font(.fh_footnote).foregroundStyle(Color.muted)
            }
            ForEach(store.cat.machines.filter { q.isEmpty || $0.name.localizedCaseInsensitiveContains(q) }) { m in
                NavigationLink(m.name) { MachineDetail(m: m) }
            }
        }.scrollContentBackground(.hidden).background(Color.cream).searchable(text: $q, prompt: "Search machines").navigationTitle("Machines").navigationBarTitleDisplayMode(.inline)
    }
}

struct IntID: Identifiable { let v: Int; var id: Int { v } }
struct LibraryPicker: View {
    @EnvironmentObject var store: Store
    let pick: (String) -> Void
    @State private var q = ""
    var body: some View {
        List(store.cat.exercises.filter { q.isEmpty || $0.name.localizedCaseInsensitiveContains(q) }.prefix(150)) { e in
            Button { pick(e.id) } label: { HStack { ExerciseIcon(exercise: e, size: 40); VStack(alignment: .leading) { Text(e.name).foregroundStyle(Color.ink); Text("\(e.partLabel ?? e.part) · \(equipName(e.equipment))").font(.fh_caption).foregroundStyle(Color.muted) } } }
        }.searchable(text: $q, prompt: "Search exercises")
    }
}

// MARK: Calendar, habits, tasks
struct HabitsView: View {
    @EnvironmentObject var store: Store
    @State private var name = ""
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                SectionTitle(text: "Habits"); Text("Small and gentle. Missing a day never resets anything.").font(.fh_caption).foregroundStyle(Color.muted)
                if store.s.habits.isEmpty { Text("Add one small habit.").foregroundStyle(Color.muted) }
                ForEach(store.s.habits) { h in
                    HStack { Button { store.toggleHabit(h) } label: { BrandIcon( store.habitDone(h) ? "checkmark.circle.fill" : "circle").font(.fh_title2).foregroundStyle(Color.sage) }
                        VStack(alignment: .leading) { Text(h.name); Text(String(format: NSLocalizedString("%lld days done, ever", comment: ""), h.done.count)).font(.fh_caption).foregroundStyle(Color.muted) }
                        Spacer(); Button { store.s.habits.removeAll { $0.id == h.id } } label: { BrandIcon( "trash") }.foregroundStyle(Color.muted) }
                }
                HStack { TextField("New habit", text: $name).submitLabel(.done).onSubmit(add); if !name.isEmpty { Button("Add", action: add).bold() } }
            }
        }.padding(16) }
    }
    func add() { let n = name.trimmingCharacters(in: .whitespaces); guard !n.isEmpty else { return }; store.s.habits.append(Habit(name: n)); name = ""; haptic() }
}
struct TasksView: View {
    @EnvironmentObject var store: Store
    var startDay: String? = nil
    @State private var title = ""; @State private var day = Date(); @State private var hasTime = false; @State private var time = Date()
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                SectionTitle(text: "To do")
                ForEach(store.s.tasks.sorted { ($0.done ? 1 : 0, $0.day ?? "") < ($1.done ? 1 : 0, $1.day ?? "") }) { t in
                    HStack { Button { if let i = store.s.tasks.firstIndex(where: { $0.id == t.id }) { store.s.tasks[i].done.toggle(); haptic(); Notifier.rebuild(store) } } label: { BrandIcon( t.done ? "checkmark.circle.fill" : "circle").font(.fh_title3).foregroundStyle(Color.sage) }
                        VStack(alignment: .leading) { Text(t.title).strikethrough(t.done); Text(((t.day.flatMap { dateFromKey($0) })?.formatted(.dateTime.weekday(.abbreviated).day().month()) ?? "") + (t.time.map { " " + $0 } ?? "")).font(.fh_caption).foregroundStyle(Color.muted) }
                        Spacer(); Button { store.s.tasks.removeAll { $0.id == t.id }; Notifier.rebuild(store) } label: { BrandIcon( "trash") }.foregroundStyle(Color.muted) }
                }
                if store.s.tasks.isEmpty { Text("Nothing here. Lovely.").foregroundStyle(Color.muted) }
            }
            Card {
                TextField("New task", text: $title)
                DatePicker("Day", selection: $day, displayedComponents: .date)
                Toggle("Remind me", isOn: $hasTime).tint(Color.sage)
                if hasTime { DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute) }
                BigButton(title: "Add", icon: "plus") {
                    let t = title.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
                    store.s.tasks.append(TaskItem(title: t, day: dayKey(day), time: hasTime ? timeString(time) : nil)); title = ""; Notifier.rebuild(store); haptic()
                }
            }
        }.padding(16) }
        .onAppear { if let k = startDay, let d = dateFromKey(k) { day = d } }
    }
}

// MARK: Challenge
struct ChallengeCard: View {
    @EnvironmentObject var store: Store
    @State private var building = false
    @State private var picks: Set<String> = ["workout", "meals", "water", "checkin"]
    @State private var days = 7
    let labels = ["workout": "Workout", "meals": "Eat a planned meal", "water": "Reach water goal", "checkin": "Daily check-in"]
    var body: some View {
        Card {
            SectionTitle(text: "Your challenge")
            if let c = store.s.challenge {
                let n = min(store.challengeDayNumber, c.days)
                Text(String(format: NSLocalizedString("Day %lld of %lld. Tasks tick themselves from what you already log.", comment: ""), n, c.days)).font(.fh_caption).foregroundStyle(Color.muted)
                ForEach(c.tasks, id: \.self) { t in BrandLabel(labels[t] ?? t, icon: store.challengeDone(t, day: store.today) ? "checkmark.circle.fill" : "circle").foregroundStyle(store.challengeDone(t, day: store.today) ? Color.sage : Color.ink) }
                Text("Missing a day never ends it. Rest counts.").font(.fh_caption).foregroundStyle(Color.muted)
                Button("End challenge") { store.endChallenge() }.font(.fh_footnote).foregroundStyle(Color.muted)
            } else if building {
                Flow { ForEach(["workout", "meals", "water", "checkin"], id: \.self) { k in Chip(label: labels[k] ?? k, on: picks.contains(k)) { if picks.contains(k) { picks.remove(k) } else { picks.insert(k) } } } }
                Picker("", selection: $days) { Text("7 days").tag(7); Text("14 days").tag(14); Text("30 days").tag(30) }.pickerStyle(.segmented)
                BigButton(title: "Start") { store.startChallenge(days: days, tasks: ["workout", "meals", "water", "checkin"].filter { picks.contains($0) }); building = false }
            } else {
                Text("A small, friendly goal for the next days. Optional.").font(.fh_caption).foregroundStyle(Color.muted)
                BigButton(title: "Build a challenge", filled: false) { building = true }
            }
        }
    }
}
