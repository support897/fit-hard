import SwiftUI
import UserNotifications

struct TodayView: View {
    @EnvironmentObject var store: Store
    let go: (Int) -> Void
    @State private var newTask = ""
    @State private var showTask = false
    @State private var denied = false

    var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
        return store.s.profile.name.isEmpty ? g : "\(g), \(store.s.profile.name)"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    WallyBubble()
                    if denied { inAppReminders }
                    nextCard
                    waterCard
                    if store.s.checkins[store.today] == nil { checkinCard } else { checkedInRow }
                    if let missed = store.missedSession { missedCard(missed) }
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
            .onAppear { Notifier.status { denied = ($0 == .denied) } }
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { AvatarView(size: 34) } }
        }
    }

    var inAppReminders: some View {
        let rows = Notifier.dueToday(store.s)
        return Card {
            SectionTitle(text: "Reminders for today")
            Text("Notifications are off, so they show here.").font(.fh_caption).foregroundStyle(Color.muted)
            if rows.isEmpty { Text("Nothing more today.").foregroundStyle(Color.muted) }
            ForEach(Array(rows.prefix(6).enumerated()), id: \.offset) { _, r in Text("\(r.time) · \(r.title)").font(.fh_subheadline) }
        }.accessibilityIdentifier("inapp-reminders")
    }
    var nextCard: some View {
        let st = store.nextStep
        return Button { haptic(); go(st.tab) } label: {
            HStack(spacing: 14) {
                BrandIcon( st.icon).font(.fh_title2).frame(width: 48, height: 48).background(Color.surface, in: Circle())
                VStack(alignment: .leading) { Text("Your next step").font(.fh_caption).foregroundStyle(Color.muted); Text(st.title).font(.fh_headline) }
                Spacer(); BrandIcon( "chevron.right")
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
                    BrandIcon( "drop.fill").foregroundStyle(Color.sage)
                }.frame(width: 64, height: 64).animation(.easeOut, value: have)
                VStack(alignment: .leading) { Text("\(have) / \(goal) ml").font(.fh_headline); Text("Water").font(.fh_caption).foregroundStyle(Color.muted) }
                Spacer()
                if have > 0 { Button { store.undoWater() } label: { BrandIcon( "arrow.uturn.backward") }.foregroundStyle(Color.muted).padding(8) }
                Button { store.addWater() } label: { BrandIcon( "plus").font(.fh_title2_b).frame(width: 52, height: 52).background(Color.sage, in: Circle()).foregroundStyle(Color.surface) }
            }
        }
    }

    var checkinCard: some View {
        Card {
            SectionTitle(text: "How are you feeling?")
            HStack(spacing: 10) {
                ForEach(Lists.checkins, id: \.0) { c in
                    Button { store.setCheckin(c.0); haptic(); store.say(c.2) } label: {
                        VStack(spacing: 4) { BrandIcon( Lists.checkinIcons[c.0] ?? "circle").font(.fh_title2); Text(LocalizedStringKey(c.1)).font(.fh_headline) }
                            .frame(maxWidth: .infinity, minHeight: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain).foregroundStyle(Color.ink).accessibilityIdentifier("feel-\(c.0)")
                }
            }
        }
    }

    func missedCard(_ r: Routine) -> some View {
        Card {
            SectionTitle(text: "Yesterday's session")
            Text("\(r.name) did not happen. That is fine, plans change. Do it today, or let it go.").font(.fh_subheadline).foregroundStyle(Color.ink)
            HStack(spacing: 10) {
                BigButton(title: "Do it today", filled: true) { store.doMissedSessionToday(r) }.accessibilityIdentifier("missed-today")
                BigButton(title: "Let it go", filled: false) { store.letMissedSessionGo(r) }.accessibilityIdentifier("missed-skip")
            }
        }
    }

    var checkedInRow: some View {
        HStack(spacing: 10) {
            BrandIcon(Lists.checkinIcons[store.s.checkins[store.today] ?? "ok"] ?? "circle").foregroundStyle(Color.sage)
            Text(store.isLightToday ? "Lighter day is on: easier meals and workout." : "Check-in done.").font(.fh_subheadline).foregroundStyle(Color.ink)
            Spacer()
            Button("Change") { store.setCheckin(nil) }.font(.fh_subheadline_b).foregroundStyle(Color.sage).accessibilityIdentifier("checkin-change")
        }.padding(.horizontal, 4)
    }

    var mealsCard: some View {
        Card {
            HStack { SectionTitle(text: "Food today"); Spacer(); if store.kcalToday > 0 { Text("\(store.kcalToday) kcal").font(.fh_caption).foregroundStyle(Color.muted) } }
            ForEach(Lists.meals, id: \.self) { m in
                if let r = store.s.plan[store.today]?[m].flatMap({ store.cat.recipe($0) }) {
                    let done = (store.s.eaten[store.today] ?? []).contains(m)
                    HStack {
                        Button { store.toggleEaten(m) } label: { BrandIcon( done ? "checkmark.circle.fill" : "circle").font(.fh_title2).foregroundStyle(Color.sage) }
                        NavigationLink { RecipeDetail(recipe: r) } label: {
                            VStack(alignment: .leading) { HStack(spacing: 4) { BrandIcon("m-" + m).foregroundStyle(Color.tone("meal." + m)); Text(m.capitalized).font(.fh_caption).foregroundStyle(Color.muted) }; Text(r.name).font(.fh_subheadline_b).strikethrough(done).multilineTextAlignment(.leading); Text(store.line(r)).font(.fh_caption).foregroundStyle(Color.muted); Text("Why: " + (store.whyThisMeal(r, meal: m).first ?? "")).font(.fh_caption).foregroundStyle(Color.muted).multilineTextAlignment(.leading) }
                        }.foregroundStyle(Color.ink)
                        Spacer()
                    }
                }
            }
        }
    }

    var workoutCard: some View {
        let ex = store.todaysExercises
        return Card {
            HStack { SectionTitle(text: "Workout"); Spacer(); TypeBadge(type: (ex.isEmpty || store.isRestToday) ? .rest : (store.routine(on: store.today)?.trainType ?? .full)) }
            if ex.isEmpty || store.isRestToday { Text("Planned rest day. Recovery is part of the plan.").foregroundStyle(Color.muted) }
            else if store.workedOutToday { BrandLabel("Done today", icon: "checkmark.seal.fill").foregroundStyle(Color.sage) }
            else {
                Text(ex.prefix(3).map { $0.name }.joined(separator: " · ") + (ex.count > 3 ? " +\(ex.count - 3)" : "")).font(.fh_subheadline).foregroundStyle(Color.muted)
                BigButton(title: "Start", icon: "play.fill") { if let r = store.routine(on: store.today) { store.training = r } else { go(2) } }.accessibilityIdentifier("today-start")
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
            ForEach(store.s.habits) { h in HStack { Button { store.toggleHabit(h) } label: { BrandIcon( store.habitDone(h) ? "checkmark.circle.fill" : "circle").font(.fh_title3).foregroundStyle(Color.sage) }; Text(h.name) } }
        } } }
    }
    var tasksCard: some View {
        Card {
            SectionTitle(text: "To do")
            ForEach(store.s.tasks.filter { !$0.done }.prefix(5)) { t in
                HStack { Button { complete(t) } label: { BrandIcon( "circle").font(.fh_title3) }.foregroundStyle(Color.sage); Text(t.title) }
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
            Text("\(med.name) \(med.amount) \(med.unit ?? "")").font(.fh_subheadline_b)
            HStack(spacing: 8) {
                ForEach([("taken", "Taken"), ("not_taken", "Skip"), ("unsure", "Not sure")], id: \.0) { o in
                    Chip(label: o.1, on: st == o.0) { store.logMed(med, o.0) }
                }
            }
        }
    }
}
