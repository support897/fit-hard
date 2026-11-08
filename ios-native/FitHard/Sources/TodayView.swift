import SwiftUI

struct TodayView: View {
    @EnvironmentObject var store: Store
    let go: (Int) -> Void
    @State private var newTask = ""
    @State private var showTask = false

    var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
        return store.s.profile.name.isEmpty ? g : "\(g), \(store.s.profile.name)"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    nextCard
                    waterCard
                    if store.s.checkins[store.today] == nil { checkinCard }
                    mealsCard
                    workoutCard
                    if !store.s.meds.isEmpty { medsCard }
                    habitsCard
                    tasksCard
                    ChallengeCard()
                }.padding(16)
            }
            .background(Color.cream)
            .navigationTitle(greeting)
        }
    }

    var nextCard: some View {
        let st = store.nextStep
        return Button { haptic(); go(st.tab) } label: {
            HStack(spacing: 14) {
                Image(systemName: st.icon).font(.title2).frame(width: 48, height: 48).background(Color.surface, in: Circle())
                VStack(alignment: .leading) { Text("Your next step").font(.caption).foregroundStyle(Color.muted); Text(st.title).font(.headline) }
                Spacer(); Image(systemName: "chevron.right")
            }.padding(16).frame(maxWidth: .infinity).background(Color.tint, in: RoundedRectangle(cornerRadius: 20)).foregroundStyle(Color.ink)
        }.buttonStyle(.plain)
    }

    var waterCard: some View {
        let goal = max(500, store.s.profile.waterGoal)
        let have = store.waterToday
        return Card {
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(Color.tint, lineWidth: 10)
                    Circle().trim(from: 0, to: min(1, Double(have) / Double(goal))).stroke(Color.sage, style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90))
                    Image(systemName: "drop.fill").foregroundStyle(Color.sage)
                }.frame(width: 64, height: 64).animation(.easeOut, value: have)
                VStack(alignment: .leading) { Text("\(have) / \(goal) ml").font(.headline); Text("Water").font(.caption).foregroundStyle(Color.muted) }
                Spacer()
                if have > 0 { Button { store.undoWater() } label: { Image(systemName: "arrow.uturn.backward") }.foregroundStyle(Color.muted).padding(8) }
                Button { store.addWater() } label: { Image(systemName: "plus").font(.title2.bold()).frame(width: 52, height: 52).background(Color.sage, in: Circle()).foregroundStyle(Color.surface) }
            }
        }
    }

    var checkinCard: some View {
        Card {
            SectionTitle(text: "How are you feeling?")
            HStack(spacing: 10) {
                ForEach(Lists.checkins, id: \.0) { c in
                    Button { store.s.checkins[store.today] = c.0; haptic(); store.say(c.2) } label: {
                        Text(c.1).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 14).background(Color.tint, in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain).foregroundStyle(Color.ink)
                }
            }
        }
    }

    var mealsCard: some View {
        Card {
            HStack { SectionTitle(text: "Food today"); Spacer(); if store.kcalToday > 0 { Text("\(store.kcalToday) kcal").font(.caption).foregroundStyle(Color.muted) } }
            ForEach(Lists.meals, id: \.self) { m in
                if let r = store.s.plan[store.today]?[m].flatMap({ store.cat.recipe($0) }) {
                    let done = (store.s.eaten[store.today] ?? []).contains(m)
                    HStack {
                        Button { store.toggleEaten(m) } label: { Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.title2).foregroundStyle(Color.sage) }
                        NavigationLink { RecipeDetail(recipe: r) } label: {
                            VStack(alignment: .leading) { Text(m.capitalized).font(.caption).foregroundStyle(Color.muted); Text(r.name).font(.subheadline.weight(.semibold)).strikethrough(done).multilineTextAlignment(.leading) }
                        }.foregroundStyle(Color.ink)
                        Spacer(); Text("\(r.minutes) min").font(.caption).foregroundStyle(Color.muted)
                    }
                }
            }
        }
    }

    var workoutCard: some View {
        let ex = store.todaysExercises
        return Card {
            SectionTitle(text: "Workout")
            if ex.isEmpty || store.isRestToday { Text("Rest day. That counts.").foregroundStyle(Color.muted) }
            else if store.workedOutToday { Label("Done today", systemImage: "checkmark.seal.fill").foregroundStyle(Color.sage) }
            else {
                Text(ex.prefix(3).map { $0.name }.joined(separator: " · ") + (ex.count > 3 ? " +\(ex.count - 3)" : "")).font(.subheadline).foregroundStyle(Color.muted)
                BigButton(title: "Start", icon: "play.fill") { go(2) }
            }
        }
    }

    var medsCard: some View {
        Card {
            SectionTitle(text: "Check-in")
            ForEach(store.s.meds) { m in MedRow(med: m) }
        }
    }

    var habitsCard: some View {
        Group { if !store.s.habits.isEmpty { Card {
            SectionTitle(text: "Habits")
            ForEach(store.s.habits) { h in HStack { Button { store.toggleHabit(h) } label: { Image(systemName: store.habitDone(h) ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(Color.sage) }; Text(h.name) } }
        } } }
    }
    var tasksCard: some View {
        Card {
            SectionTitle(text: "To do")
            ForEach(store.s.tasks.filter { !$0.done }.prefix(5)) { t in
                HStack { Button { complete(t) } label: { Image(systemName: "circle").font(.title3) }.foregroundStyle(Color.sage); Text(t.title) }
            }
            HStack {
                TextField("Add a task", text: $newTask).submitLabel(.done).onSubmit(addTask)
                if !newTask.isEmpty { Button("Add", action: addTask).bold() }
            }
        }
    }
    func addTask() {
        let t = newTask.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
        store.s.tasks.append(TaskItem(title: t, day: store.today)); newTask = ""; haptic()
    }
    func complete(_ t: TaskItem) {
        if let i = store.s.tasks.firstIndex(where: { $0.id == t.id }) { store.s.tasks[i].done = true; haptic(); Notifier.rebuild(store) }
    }
}

struct MedRow: View {
    @EnvironmentObject var store: Store
    let med: Med
    var body: some View {
        let st = store.medStatus(med)
        VStack(alignment: .leading, spacing: 8) {
            Text("\(med.name) \(med.amount)").font(.subheadline.weight(.semibold))
            HStack(spacing: 8) {
                ForEach([("taken", "Taken"), ("not_taken", "Not taken"), ("unsure", "Not sure")], id: \.0) { o in
                    Chip(label: o.1, on: st == o.0) { store.logMed(med, o.0) }
                }
            }
        }
    }
}
