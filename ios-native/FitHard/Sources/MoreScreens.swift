import SwiftUI
import Charts

// MARK: Progress
struct ProgressScreen: View {
    @EnvironmentObject var store: Store
    @State private var mode = 0
    @State private var pendingDay: String? = nil
    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $mode) { Text("Overview").tag(0); Text("Strength").tag(1); Text("Body").tag(2); Text("Review").tag(3) }.pickerStyle(.segmented).padding(16)
            ScrollView { VStack(spacing: 14) {
                switch mode { case 0: overview; case 1: strength; case 2: BodyScreen(); default: ReviewScreen() }
            }.padding(16) }
        }.background(Color.cream).navigationTitle("Progress").navigationBarTitleDisplayMode(.inline)
    }
    var overview: some View {
        let wk = store.weeks(8)
        let ms = store.milestones
        return VStack(spacing: 14) {
            Card {
                SectionTitle(text: "This week"); Text(store.weekSummary).font(.headline)
                Chip(label: store.isRestToday ? "Today is a rest day ✓" : "Make today a rest day", icon: "moon", on: store.isRestToday) { store.toggleRest() }
                Text("Rest counts. It keeps your weeks going.").font(.caption).foregroundStyle(Color.muted)
            }
            Card {
                SectionTitle(text: "Your journey")
                Text("\(store.activeWeeks)").font(.system(size: 44, weight: .bold, design: .serif)).foregroundStyle(Color.sage)
                Text("active weeks, ever. They never reset.").font(.subheadline).foregroundStyle(Color.muted)
                if store.currentRun > 1 { Text("\(store.currentRun) weeks in a row right now").font(.caption).foregroundStyle(Color.muted) }
                Chart(wk) { BarMark(x: .value("Week", $0.start, unit: .weekOfYear), y: .value("Workouts", $0.sessions)).foregroundStyle(Color.sage).cornerRadius(4) }
                    .frame(height: 120).chartYAxis(.hidden)
                Text("Last 8 weeks, oldest on the left.").font(.caption).foregroundStyle(Color.muted)
            }
            Card {
                SectionTitle(text: "Milestones")
                if ms.earned.isEmpty { Text("Your first one is waiting. No rush.").foregroundStyle(Color.muted) }
                ForEach(ms.earned, id: \.self) { Label($0, systemImage: "star.fill").foregroundStyle(Color.ink) }
                if let n = ms.next { Text("Next, whenever you like: \(n)").font(.caption).foregroundStyle(Color.muted) }
            }
            Card {
                SectionTitle(text: "Personal bests"); Text("Compared only with your own earlier sets.").font(.caption).foregroundStyle(Color.muted)
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
                    ForEach(pts.reversed().prefix(10)) { Text("\($0.date.formatted(date: .abbreviated, time: .omitted)): \($0.reps) reps, \($0.value.formatted())") .font(.caption) }
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
                SectionTitle(text: "Add an entry"); Text("Optional and private. Only a record.").font(.caption).foregroundStyle(Color.muted)
                DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                ForEach(fields, id: \.0) { k, l in TextField(l, text: Binding(get: { f[k] ?? "" }, set: { f[k] = $0 })).keyboardType(.decimalPad) }
                if !err.isEmpty { Text(err).font(.caption).foregroundStyle(Color.amber) }
                BigButton(title: "Save entry") { save() }
            }
            Card {
                SectionTitle(text: "Your entries")
                if store.s.body.isEmpty { Text("Nothing saved yet. That is completely fine.").foregroundStyle(Color.muted) }
                ForEach(store.s.body.sorted { $0.day > $1.day }.prefix(30)) { e in
                    HStack { VStack(alignment: .leading) { Text(e.day).bold(); Text(summary(e)).font(.caption).foregroundStyle(Color.muted) }
                        Spacer(); Button { store.s.body.removeAll { $0.id == e.id } } label: { Image(systemName: "trash") }.foregroundStyle(Color.muted) }
                }
                HStack { Button("Hide body tracking") { store.s.hideBody = true }; Spacer(); if !store.s.body.isEmpty { Button("Delete all", role: .destructive) { wipe = true } } }.font(.footnote)
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
            SectionTitle(text: "Weekly review"); Text(store.weekSummary).font(.headline)
            Text(store.s.workouts.isEmpty ? "One suggested next step: pick one small thing this week. A short walk counts." : "One suggested next step: your next planned workout, at whatever size feels right.").font(.subheadline).foregroundStyle(Color.muted)
        }.onAppear { r = store.s.reflections[wk] ?? Reflection() }
        Card {
            SectionTitle(text: "A quick look back"); Text("Optional. Skip any of these. Private to you.").font(.caption).foregroundStyle(Color.muted)
            TextField("What felt easier?", text: $r.easier, axis: .vertical)
            TextField("What would you change?", text: $r.change, axis: .vertical)
            TextField("Your own next step", text: $r.next, axis: .vertical)
            BigButton(title: "Save reflection") { store.s.reflections[wk] = r; store.say("Saved") }
        }
        let past = store.s.reflections.keys.sorted().reversed().filter { $0 != wk }.prefix(5)
        if !past.isEmpty { Card { SectionTitle(text: "Earlier reflections"); ForEach(Array(past), id: \.self) { k in Text("**\(k)** \(store.s.reflections[k]?.next ?? "")").font(.caption) } } }
    }
}

// MARK: Treats
struct TreatsScreen: View {
    @EnvironmentObject var store: Store
    @State private var name = ""; @State private var kcal = ""; @State private var quick = ""
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                SectionTitle(text: "Treats"); Text("Log it, enjoy it. All food is fine here.").font(.caption).foregroundStyle(Color.muted)
                TextField("What was it?", text: $name); TextField("Calories (optional)", text: $kcal).keyboardType(.numberPad)
                BigButton(title: "Add", icon: "plus") { store.addTreat(name, Int(kcal)); name = ""; kcal = "" }
                if !store.usualTreats.isEmpty {
                    Text("Your usual").font(.caption).foregroundStyle(Color.muted)
                    Flow { ForEach(store.usualTreats) { t in Chip(label: t.name + (t.kcal.map { " · \($0)" } ?? ""), on: false) { store.addTreat(t.name, t.kcal) } } }
                }
                TextField("Several at once: one per line, e.g. Cake 320", text: $quick, axis: .vertical).lineLimit(2...4)
                BigButton(title: "Sort them", filled: false) { store.quickTreats(quick); quick = "" }
            }
            let days = Dictionary(grouping: store.s.treats, by: { $0.day }).keys.sorted().reversed()
            if days.isEmpty { Card { Text("No treats logged yet. Nothing to fix.").foregroundStyle(Color.muted) } }
            ForEach(Array(days), id: \.self) { d in
                Card {
                    Text(d).font(.headline)
                    ForEach(store.s.treats.filter { $0.day == d }) { t in
                        HStack { Text(t.name); Spacer(); Text(t.kcal.map { "about \($0) kcal" } ?? "no count").font(.caption).foregroundStyle(Color.muted)
                            Button { store.s.treats.removeAll { $0.id == t.id } } label: { Image(systemName: "xmark.circle") }.foregroundStyle(Color.muted) }
                    }
                    let known = store.s.treats.filter { $0.day == d }.compactMap { $0.kcal }.reduce(0, +)
                    Text("About \(known) kcal. All fine.").font(.caption).foregroundStyle(Color.muted)
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
                SectionTitle(text: "What's in your fridge?"); Text("Tap what you have. I'll find recipes you can make.").font(.caption).foregroundStyle(Color.muted)
                Flow { ForEach(store.cat.ingredients.common, id: \.self) { i in Chip(label: i.capitalized, on: have.contains(i)) { toggle(i) } } }
                TextField("Search ingredients", text: $q).textInputAutocapitalization(.never)
                if !q.isEmpty { Flow { ForEach(store.cat.ingredients.all.filter { $0.contains(q.lowercased()) }.prefix(12), id: \.self) { i in Chip(label: i.capitalized, on: have.contains(i)) { toggle(i) } } } }
            }
            let m = store.fridgeMatches(have)
            if !have.isEmpty && m.isEmpty { Text("No match yet. Add one more thing.").foregroundStyle(Color.muted) }
            ForEach(Array(m.prefix(25).enumerated()), id: \.offset) { _, row in
                let (r, hit, total) = row
                NavigationLink { RecipeDetail(recipe: r) } label: {
                    HStack { VStack(alignment: .leading) { Text(r.name).font(.subheadline.weight(.semibold)); Text("You have \(hit) of \(total) ingredients").font(.caption).foregroundStyle(Color.muted) }; Spacer(); Image(systemName: "chevron.right") }
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
            Section { Text("Find the machine by name, then confirm it's the one in front of you. Fit Hard never guesses from a photo.").font(.footnote).foregroundStyle(Color.muted) }
            ForEach(store.cat.machines.filter { q.isEmpty || $0.name.localizedCaseInsensitiveContains(q) }) { m in
                NavigationLink(m.name) {
                    List(m.exerciseIds.compactMap { store.cat.exercise($0) }) { e in ExerciseRow(e: e).listRowBackground(Color.clear) }.listStyle(.plain).navigationTitle(m.name)
                }
            }
        }.scrollContentBackground(.hidden).background(Color.cream).searchable(text: $q, prompt: "Search machines").navigationTitle("Machines").navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: Routines
struct RoutinesScreen: View {
    @EnvironmentObject var store: Store
    @State private var addDay: Int? = nil
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            ForEach(Lists.weekdays, id: \.0) { wd, label in
                let ids = store.s.routine[String(wd)] ?? []
                Card {
                    HStack { Text(label).font(.headline); Spacer()
                        Button { addDay = wd } label: { Label("Add", systemImage: "plus") }.font(.subheadline) }
                    if ids.isEmpty { Text("Rest").foregroundStyle(Color.muted) }
                    ForEach(ids, id: \.self) { id in
                        if let e = store.cat.exercise(id) { HStack { Text(e.name).font(.subheadline); Spacer()
                            Button { store.s.routine[String(wd)]?.removeAll { $0 == id }; Notifier.rebuild(store) } label: { Image(systemName: "minus.circle") }.foregroundStyle(Color.muted) } }
                    }
                }
            }
            BigButton(title: "Rebuild from my settings", icon: "sparkles", filled: false) { store.generateRoutine(); Notifier.rebuild(store); store.say("Routine rebuilt") }
        }.padding(16) }.background(Color.cream).navigationTitle("Routines").navigationBarTitleDisplayMode(.inline)
        .sheet(item: Binding(get: { addDay.map { IntID(v: $0) } }, set: { addDay = $0?.v })) { d in
            NavigationStack { LibraryPicker { id in
                if !(store.s.routine[String(d.v)] ?? []).contains(id) { store.s.routine[String(d.v), default: []].append(id) }
                if !store.s.profile.trainDays.contains(d.v) { store.s.profile.trainDays.append(d.v) }
                Notifier.rebuild(store); addDay = nil; store.say("Added")
            }.navigationTitle("Pick an exercise").navigationBarTitleDisplayMode(.inline) }
        }
    }
}
struct IntID: Identifiable { let v: Int; var id: Int { v } }
struct LibraryPicker: View {
    @EnvironmentObject var store: Store
    let pick: (String) -> Void
    @State private var q = ""
    var body: some View {
        List(store.cat.exercises.filter { q.isEmpty || $0.name.localizedCaseInsensitiveContains(q) }.prefix(150)) { e in
            Button { pick(e.id) } label: { VStack(alignment: .leading) { Text(e.name).foregroundStyle(Color.ink); Text("\(e.partLabel ?? e.part) · \(e.equipment)").font(.caption).foregroundStyle(Color.muted) } }
        }.searchable(text: $q, prompt: "Search exercises")
    }
}

// MARK: Calendar, habits, tasks
struct CalendarScreen: View {
    @EnvironmentObject var store: Store
    @State private var mode = 0
    @State private var pendingDay: String? = nil
    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $mode) { Text("Month").tag(0); Text("Habits").tag(1); Text("To do").tag(2) }.pickerStyle(.segmented).padding(16)
            switch mode { case 0: MonthView(onAddTask: { d in pendingDay = d; mode = 2 }); case 1: HabitsView(); default: TasksView(startDay: pendingDay) }
        }.background(Color.cream).navigationTitle("Calendar").navigationBarTitleDisplayMode(.inline)
    }
}
struct MonthView: View {
    @EnvironmentObject var store: Store
    var onAddTask: (String) -> Void = { _ in }
    @State private var month = Date(); @State private var sel = dayKey()
    var cal: Calendar { var c = Calendar.current; c.firstWeekday = 2; return c }
    var days: [Date?] {
        guard let iv = cal.dateInterval(of: .month, for: month) else { return [] }
        let lead = (cal.component(.weekday, from: iv.start) - cal.firstWeekday + 7) % 7
        let n = cal.range(of: .day, in: .month, for: month)?.count ?? 30
        return Array(repeating: nil, count: lead) + (0..<n).compactMap { cal.date(byAdding: .day, value: $0, to: iv.start) }
    }
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                HStack { Button { month = cal.date(byAdding: .month, value: -1, to: month) ?? month } label: { Image(systemName: "chevron.left") }; Spacer()
                    Button { month = Date(); sel = store.today; haptic(.soft) } label: { Text(month.formatted(.dateTime.month(.wide).year())).font(.headline) }.buttonStyle(.plain); Spacer()
                    Button { month = cal.date(byAdding: .month, value: 1, to: month) ?? month } label: { Image(systemName: "chevron.right") } }
                let cols = Array(repeating: GridItem(.flexible()), count: 7)
                LazyVGrid(columns: cols) {
                    ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { Text($0).font(.caption).foregroundStyle(Color.muted) }
                    ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                        if let d = d {
                            let k = dayKey(d); let it = store.items(on: k)
                            Button { sel = k; haptic(.soft) } label: {
                                VStack(spacing: 2) { Text("\(cal.component(.day, from: d))").font(.subheadline.weight(k == store.today ? .bold : .regular))
                                    HStack(spacing: 2) { if it.workout { Circle().fill(Color.sage).frame(width: 5) } else if it.plannedWorkout { Circle().stroke(Color.sage, lineWidth: 1).frame(width: 5) }
                                        if !it.tasks.isEmpty || !it.appts.isEmpty { Circle().fill(Color.amber).frame(width: 5) } }.frame(height: 6) }
                                .frame(maxWidth: .infinity, minHeight: 40).background(k == sel ? Color.tint : Color.clear, in: RoundedRectangle(cornerRadius: 10))
                            }.buttonStyle(.plain).foregroundStyle(Color.ink)
                        } else { Color.clear.frame(height: 40) }
                    }
                }
            }
            let it = store.items(on: sel)
            let isToday = sel == store.today
            Card {
                HStack { Text(dateFromKey(sel)?.formatted(.dateTime.weekday(.wide).day().month()) ?? sel).font(.headline); Spacer()
                    if !isToday { Button("Today") { month = Date(); sel = store.today; haptic(.soft) }.font(.subheadline.weight(.semibold)) } }
                if it.meals.isEmpty && !it.workout && !it.plannedWorkout && it.tasks.isEmpty && it.appts.isEmpty && store.s.meds.isEmpty { Text("Nothing planned. That is fine.").foregroundStyle(Color.muted) }
                ForEach(it.meals) { Label($0.name, systemImage: "fork.knife").font(.subheadline) }
                if it.workout { Label("Workout done", systemImage: "checkmark.seal.fill").foregroundStyle(Color.sage) } else if it.plannedWorkout { Label("Workout planned", systemImage: "dumbbell") }
                ForEach(it.tasks) { t in
                    HStack { Label(t.title, systemImage: t.done ? "checkmark.circle.fill" : "circle").font(.subheadline).strikethrough(t.done); Spacer()
                        if !t.done {
                            Button("Done") { store.updateTask(t.id) { $0.done = true }; haptic() }.font(.caption.weight(.bold))
                            Button("Tomorrow") { store.updateTask(t.id) { $0.day = dayKey(Calendar.current.date(byAdding: .day, value: 1, to: dateFromKey(sel) ?? Date()) ?? Date()) }; haptic(.soft) }.font(.caption.weight(.bold))
                        } } }
                ForEach(it.appts) { Label("\($0.title) \($0.date.formatted(date: .omitted, time: .shortened))", systemImage: "calendar") }
                ForEach(store.s.meds) { md in
                    let st = store.s.medLogs.last(where: { $0.medId == md.id && $0.day == sel })?.status
                    Label("\(md.name) at \(md.time)" + (st.map { " (\($0))" } ?? ""), systemImage: "cross.case").font(.subheadline)
                }
                ForEach(store.s.habits) { h in
                    Label(h.name, systemImage: h.done.contains(sel) ? "checkmark.circle.fill" : "circle").font(.subheadline).foregroundStyle(h.done.contains(sel) ? Color.sage : Color.ink)
                }
                Button { onAddTask(sel) } label: { Label("Add a task for this day", systemImage: "plus.circle.fill").font(.subheadline.weight(.semibold)) }
            }
        }.padding(16) }
    }
}
struct HabitsView: View {
    @EnvironmentObject var store: Store
    @State private var name = ""
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                SectionTitle(text: "Habits"); Text("Small and gentle. Missing a day never resets anything.").font(.caption).foregroundStyle(Color.muted)
                if store.s.habits.isEmpty { Text("Add one small habit.").foregroundStyle(Color.muted) }
                ForEach(store.s.habits) { h in
                    HStack { Button { store.toggleHabit(h) } label: { Image(systemName: store.habitDone(h) ? "checkmark.circle.fill" : "circle").font(.title2).foregroundStyle(Color.sage) }
                        VStack(alignment: .leading) { Text(h.name); Text("\(h.done.count) days done, ever").font(.caption).foregroundStyle(Color.muted) }
                        Spacer(); Button { store.s.habits.removeAll { $0.id == h.id } } label: { Image(systemName: "trash") }.foregroundStyle(Color.muted) }
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
                    HStack { Button { if let i = store.s.tasks.firstIndex(where: { $0.id == t.id }) { store.s.tasks[i].done.toggle(); haptic(); Notifier.rebuild(store) } } label: { Image(systemName: t.done ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(Color.sage) }
                        VStack(alignment: .leading) { Text(t.title).strikethrough(t.done); Text((t.day ?? "") + (t.time.map { " " + $0 } ?? "")).font(.caption).foregroundStyle(Color.muted) }
                        Spacer(); Button { store.s.tasks.removeAll { $0.id == t.id }; Notifier.rebuild(store) } label: { Image(systemName: "trash") }.foregroundStyle(Color.muted) }
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
                Text("Day \(n) of \(c.days). Tasks tick themselves from what you already log.").font(.caption).foregroundStyle(Color.muted)
                ForEach(c.tasks, id: \.self) { t in Label(labels[t] ?? t, systemImage: store.challengeDone(t, day: store.today) ? "checkmark.circle.fill" : "circle").foregroundStyle(store.challengeDone(t, day: store.today) ? Color.sage : Color.ink) }
                Text("Missing a day never ends it. Rest counts.").font(.caption).foregroundStyle(Color.muted)
                Button("End challenge") { store.endChallenge() }.font(.footnote).foregroundStyle(Color.muted)
            } else if building {
                Flow { ForEach(["workout", "meals", "water", "checkin"], id: \.self) { k in Chip(label: labels[k] ?? k, on: picks.contains(k)) { if picks.contains(k) { picks.remove(k) } else { picks.insert(k) } } } }
                Picker("", selection: $days) { Text("7 days").tag(7); Text("14 days").tag(14); Text("30 days").tag(30) }.pickerStyle(.segmented)
                BigButton(title: "Start") { store.startChallenge(days: days, tasks: ["workout", "meals", "water", "checkin"].filter { picks.contains($0) }); building = false }
            } else {
                Text("A small, friendly goal for the next days. Optional.").font(.caption).foregroundStyle(Color.muted)
                BigButton(title: "Build a challenge", filled: false) { building = true }
            }
        }
    }
}
