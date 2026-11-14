import SwiftUI
import UserNotifications

struct TodayView: View {
    @EnvironmentObject var store: Store
    let go: (Int) -> Void
    @State private var newTask = ""
    @State private var showTask = false
    @State private var denied = false
    @State private var finishing = false
    @State private var tracking: Store.Tracker? = nil

    var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
        let gl = NSLocalizedString(g, comment: "")
        return store.hasName ? "\(gl), \(store.s.profile.name.trimmingCharacters(in: .whitespaces))" : gl
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    heroCard
                    if !store.s.profile.setupDone { finishProfileLink }
                    trackerCard
                    WallyBubble()
                    if denied { inAppReminders }
                    nextCard
                    waterCard
                    if store.s.checkins[store.today] == nil { checkinCard } else { checkedInRow }
                    if let missed = store.missedSession { missedCard(missed) }
                    mealsCard
                    workoutCard
                    photoCard
                    medsCard
                    habitsCard
                    tasksCard
                    ChallengeCard()
                }.padding(16)
            }
            .background(Color.cream)
            .navigationTitle(greeting)
            .onAppear { Notifier.status { denied = ($0 == .denied) } }
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { AvatarView(size: 34) } }
            .sheet(item: $tracking) { t in TrackerEntry(tracker: t).environmentObject(store) }
            .fullScreenCover(isPresented: $finishing) { SetupView(onClose: { finishing = false }).environmentObject(store).tint(Color.sage).foregroundStyle(Color.ink) }
            .onChange(of: store.s.profile.setupDone) { done in if done { finishing = false } }
        }
    }

    /// Streak, the week goal and consistency. The goal count, bar and message follow the saved days pick on every theme.
    var heroCard: some View {
        let goal = store.weekGoalCount, done = store.workoutsThisWeek
        let frac = min(1, Double(done) / Double(max(1, goal)))
        let c = store.consistency
        return Card {
            HStack(spacing: 18) {
                ZStack {
                    Circle().stroke(Color.tint, lineWidth: 12)
                    Circle().trim(from: 0, to: frac).stroke(Color.sage, style: StrokeStyle(lineWidth: 12, lineCap: .round)).rotationEffect(.degrees(-90))
                    VStack(spacing: 2) { Text("\(done)/\(goal)").font(.fh_title2_b).foregroundStyle(Color.ink); BrandIcon("dumbbell").foregroundStyle(Color.sage) }
                }.frame(width: 108, height: 108).animation(.easeOut, value: done).accessibilityElement(children: .ignore)
                .accessibilityLabel(String(format: NSLocalizedString("%lld of %lld workouts this week", comment: ""), done, goal)).accessibilityIdentifier("week-goal")
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        BrandIcon("flame").foregroundStyle(Color.sage)
                        Text("\(store.streak)").font(.fh_title_b).foregroundStyle(Color.ink)
                        Text(LocalizedStringKey(store.streak == 1 ? "day streak" : "days streak")).font(.fh_caption).foregroundStyle(Color.muted)
                    }.accessibilityIdentifier("streak")
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text("Consistency").font(.fh_caption).foregroundStyle(Color.muted); Spacer(); Text("\(c)%").font(.fh_caption_b).foregroundStyle(Color.ink) }
                        ProgressView(value: Double(c), total: 100).tint(Color.sage)
                    }
                }
            }
            Text(done >= goal ? NSLocalizedString("Week goal reached. Rest is part of the plan.", comment: "") : String(format: NSLocalizedString("%lld more to reach your goal of %lld this week.", comment: ""), goal - done, goal))
                .font(.fh_subheadline_b).foregroundStyle(Color.ink).accessibilityIdentifier("week-message")
        }
    }

    var finishProfileLink: some View {
        Button { haptic(); finishing = true } label: {
            HStack(spacing: 10) { BrandIcon("sparkles").foregroundStyle(Color.sage); Text("Finish your profile").font(.fh_subheadline_b); Spacer(); BrandIcon("chevron.right") }
                .padding(14).frame(maxWidth: .infinity).background(Color.tint, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(Color.ink)
        }.buttonStyle(.plain).accessibilityIdentifier("finish-profile")
    }

    /// Weight, water, sleep and steps, this week and last week. Tap a row to type today's number.
    var trackerCard: some View {
        Card {
            HStack {
                Spacer()
                Text("This week").font(.fh_caption_b).foregroundStyle(Color.muted).frame(width: 78, alignment: .trailing)
                Text("Last week").font(.fh_caption_b).foregroundStyle(Color.muted).frame(width: 78, alignment: .trailing)
            }
            ForEach(Store.Tracker.allCases) { t in
                Button { haptic(.soft); tracking = t } label: {
                    HStack(spacing: 10) {
                        BrandIcon(t.icon).foregroundStyle(Color.sage)
                        Text(LocalizedStringKey(t.title)).font(.fh_subheadline_b).foregroundStyle(Color.ink)
                        Spacer()
                        Text(store.trackerText(t, offset: 0)).font(.fh_subheadline_b).foregroundStyle(Color.ink).frame(width: 78, alignment: .trailing)
                        Text(store.trackerText(t, offset: -1)).font(.fh_subheadline).foregroundStyle(Color.muted).frame(width: 78, alignment: .trailing)
                    }.padding(.vertical, 4)
                }.buttonStyle(.plain).accessibilityIdentifier("tracker-\(t.rawValue)")
            }
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
            Text(String(format: NSLocalizedString("%@ did not happen. That is fine, plans change. Do it today, or let it go.", comment: ""), r.name)).font(.fh_subheadline).foregroundStyle(Color.ink)
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
                            VStack(alignment: .leading) { HStack(spacing: 4) { BrandIcon("m-" + m).foregroundStyle(Color.tone("meal." + m)); Text(MealKind(rawValue: m)?.label ?? m.capitalized).font(.fh_caption).foregroundStyle(Color.muted) }; Text(r.name).font(.fh_subheadline_b).strikethrough(done).multilineTextAlignment(.leading); Text(store.line(r)).font(.fh_caption).foregroundStyle(Color.muted); Text(NSLocalizedString("Why: ", comment: "") + (store.whyThisMeal(r, meal: m).first ?? "")).font(.fh_caption).foregroundStyle(Color.muted).multilineTextAlignment(.leading) }
                        }.foregroundStyle(Color.ink)
                        Spacer()
                        WatchReelButton(recipe: r)
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
                HStack(spacing: -8) { ForEach(Array(ex.prefix(4).enumerated()), id: \.offset) { _, e in ExerciseIcon(exercise: e, size: 44) } }
                Text(ex.prefix(3).map { $0.name }.joined(separator: " · ") + (ex.count > 3 ? " +\(ex.count - 3)" : "")).font(.fh_subheadline).foregroundStyle(Color.muted)
                BigButton(title: "Start", icon: "play.fill") { if let r = store.routine(on: store.today) { store.training = r } else { go(2) } }.accessibilityIdentifier("today-start")
            }
        }
    }

    /// Build 36, item D: the supplements card stands on Today only when something is due
    /// today and not yet marked. It never marks anything itself; the rows are the person's taps.
    /// Build 36, item B: Photo a machine stands on Today as its own card, one tap to the matcher.
    var photoCard: some View {
        NavigationLink { MachinePhotoMatchView() } label: {
            HStack(spacing: 14) {
                BrandIcon("camera").font(.fh_title2).frame(width: 52, height: 52).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(Color.sage)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Photo a machine").font(.fh_headline)
                    Text("Point your camera at a gym machine and Fit Hard will try to name it.").font(.fh_caption).foregroundStyle(Color.muted)
                }
                Spacer(); BrandIcon("chevron.right")
            }.padding(16).frame(maxWidth: .infinity).background(Color.tint, in: RoundedRectangle(cornerRadius: 20)).foregroundStyle(Color.ink)
        }.buttonStyle(.plain).accessibilityIdentifier("photo-a-machine-today")
    }

    var medsCard: some View {
        let due = store.unconfirmedDosesToday()
        return Group {
            if !due.isEmpty {
                Card {
                    SectionTitle(text: "Supplements and peptides")
                    ForEach(due) { m in MedRow(med: m) }
                    NavigationLink { HealthView(embedded: true) } label: {
                        HStack { Text("See all").font(.fh_subheadline_b).foregroundStyle(Color.sage); Spacer(); BrandIcon("chevron.right").foregroundStyle(Color.muted) }
                    }.accessibilityIdentifier("today-supplements")
                }
            }
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

/// One number typed in by the user for today. Nothing is suggested.
struct TrackerEntry: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    let tracker: Store.Tracker
    @State private var text = ""
    var body: some View {
        VStack(spacing: 18) {
            HStack(spacing: 10) { BrandIcon(tracker.icon).foregroundStyle(Color.sage); Text(LocalizedStringKey(tracker.title)).font(.fh_title2_b).foregroundStyle(Color.ink); Spacer() }
            HStack {
                TextField("0", text: $text).keyboardType(.decimalPad).font(.fh_title_b).accessibilityIdentifier("tracker-field")
                Text(tracker.unit).foregroundStyle(Color.muted)
            }.padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
            BigButton(title: "Save", icon: "checkmark") {
                if let v = Double(text.replacingOccurrences(of: ",", with: ".")) { store.logTracker(tracker, value: v) }
                dismiss()
            }.accessibilityIdentifier("tracker-save")
            Spacer()
        }.padding(24).background(Color.cream.ignoresSafeArea()).presentationDetents([.height(300)])
    }
}
