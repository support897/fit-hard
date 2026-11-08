import SwiftUI

/// Asks everything once, with taps instead of typing, then builds the whole app:
/// meal plan, recipes, routine and reminders.
struct OnboardingView: View {
    @EnvironmentObject var store: Store
    @State private var step = 0
    @State private var building = false
    @State private var medName = ""
    @State private var medAmount = ""
    @State private var medTime = timeDate("08:00")
    @State private var askedNotif = false
    @State private var showAuth = false
    private let total = 7

    var body: some View {
        VStack(spacing: 0) {
            if building { buildingView } else {
                ProgressView(value: Double(step + 1), total: Double(total)).tint(Color.sage).padding(.horizontal, 24).padding(.top, 12)
                ScrollView { VStack(alignment: .leading, spacing: 18) { page }.padding(24).frame(maxWidth: .infinity, alignment: .leading) }
                HStack(spacing: 12) {
                    if step > 0 { BigButton(title: "Back", filled: false) { withAnimation { step -= 1 } }.frame(width: 120) }
                    BigButton(title: step == total - 1 ? "Build my app" : "Next", icon: step == total - 1 ? "sparkles" : nil) { next() }
                        .disabled(step == 0 && store.s.profile.name.trimmingCharacters(in: .whitespaces).isEmpty)
                        .opacity(step == 0 && store.s.profile.name.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
                }.padding(.horizontal, 24).padding(.bottom, 16)
            }
        }
        .sheet(isPresented: $showAuth) { AuthSheet() }
    }

    @ViewBuilder var page: some View {
        switch step {
        case 0:
            BundleImage(name: "wally-welcome").frame(height: 150).frame(maxWidth: .infinity)
            title("Hi. What should I call you?")
            TextField("Your name", text: $store.s.profile.name)
                .textContentType(.givenName).font(.title3).padding(16)
                .background(Color.surface, in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.line))
            Button("I already have an account") { showAuth = true }.font(.subheadline.weight(.semibold))
        case 1:
            title("What are your goals?"); hint("Pick any.")
            Flow { ForEach(Array(Lists.goals.enumerated()), id: \.offset) { i, g in
                Chip(label: g, icon: Lists.goalIcons[i], on: store.s.profile.goals.contains(g)) { toggle(&store.s.profile.goals, g) } } }
        case 2:
            title("What do you want in your app?"); hint("You can change this any time.")
            Flow { ForEach(Lists.needs) { n in
                Chip(label: n.label, icon: n.icon, on: store.s.profile.needs.contains(n.id)) { toggle(&store.s.profile.needs, n.id) } } }
        case 3:
            title("What do you like to eat?")
            Flow { ForEach(Lists.cuisines, id: \.self) { c in
                Chip(label: c, on: store.s.profile.cuisines.contains(c)) { toggle(&store.s.profile.cuisines, c) } } }
            Toggle("Vegetarian", isOn: $store.s.profile.vegetarian).font(.headline).tint(Color.sage)
            title("Anything to avoid?")
            Flow { ForEach(Lists.allergens, id: \.id) { a in
                Chip(label: a.label, on: store.s.profile.allergens.contains(a.id)) { toggle(&store.s.profile.allergens, a.id) } } }
            hint("We hide every recipe with these ingredients.")
        case 4:
            title("When do you train?")
            Flow { ForEach(Lists.weekdays, id: \.0) { d in
                Chip(label: d.1, on: store.s.profile.trainDays.contains(d.0)) { toggle(&store.s.profile.trainDays, d.0) } } }
            title("Where?")
            Picker("", selection: $store.s.profile.equipment) {
                Text("Gym").tag("gym"); Text("Home").tag("home"); Text("No kit").tag("body") }.pickerStyle(.segmented)
            title("How long?")
            Picker("", selection: $store.s.profile.minutes) {
                ForEach([20, 30, 45, 60], id: \.self) { Text("\($0) min").tag($0) } }.pickerStyle(.segmented)
            DatePicker("Usual time", selection: Binding(get: { timeDate(store.s.profile.workoutTime) }, set: { store.s.profile.workoutTime = timeString($0) }), displayedComponents: .hourAndMinute)
        case 5:
            title("Doses from your clinician?"); hint("Optional. You enter what your clinician gave you. Fit Hard never suggests products, doses or changes.")
            ForEach(store.s.meds) { m in
                Card { HStack { VStack(alignment: .leading) { Text(m.name).bold(); Text("\(m.amount)  \(m.time)").font(.caption).foregroundStyle(Color.muted) }
                    Spacer(); Button { store.s.meds.removeAll { $0.id == m.id } } label: { Image(systemName: "xmark.circle.fill") }.foregroundStyle(Color.muted) } } }
            Card {
                TextField("Name (as given)", text: $medName)
                TextField("Amount (as given)", text: $medAmount)
                DatePicker("Time", selection: $medTime, displayedComponents: .hourAndMinute)
                BigButton(title: "Add", icon: "plus", filled: false) {
                    let n = medName.trimmingCharacters(in: .whitespaces); guard !n.isEmpty else { return }
                    store.s.meds.append(Med(name: n, amount: medAmount, time: timeString(medTime)))
                    if !store.s.profile.needs.contains("peptides") { store.s.profile.needs.append("peptides") }
                    medName = ""; medAmount = ""
                }
            }
        default:
            title("Which reminders?"); hint("Only at times you pick. Health reminders stay generic on your lock screen.")
            reminderRow("workout", "Workout days", "dumbbell")
            reminderRow("water", "Water, once a day", "drop")
            reminderRow("meals", "Meal times", "fork.knife")
            reminderRow("tasks", "To do items", "checklist")
            reminderRow("health", "Doses and appointments", "cross.case")
        }
    }

    func reminderRowPlaceholder() {}
    func reminderRow(_ id: String, _ label: String, _ icon: String) -> some View {
        Toggle(isOn: Binding(get: { store.s.settings.on.contains(id) }, set: { v in
            if v { if !store.s.settings.on.contains(id) { store.s.settings.on.append(id) } } else { store.s.settings.on.removeAll { $0 == id } } })) {
            Label(label, systemImage: icon).font(.headline)
        }.tint(Color.sage).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
    }
    func title(_ t: String) -> some View { Text(t).font(.system(.title, design: .serif).weight(.bold)).foregroundStyle(Color.ink) }
    func hint(_ t: String) -> some View { Text(t).font(.subheadline).foregroundStyle(Color.muted) }
    func toggle<T: Equatable>(_ arr: inout [T], _ v: T) { if let i = arr.firstIndex(of: v) { arr.remove(at: i) } else { arr.append(v) } }

    func next() {
        if step < total - 1 { withAnimation { step += 1 }; return }
        building = true
        store.generatePlan(); store.generateRoutine()
        let finish = {
            store.s.onboarded = true
            Notifier.rebuild(store)
        }
        if store.s.settings.on.isEmpty { DispatchQueue.main.asyncAfter(deadline: .now() + 1.6, execute: finish) }
        else { Notifier.ask { _ in DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: finish) } }
    }

    var buildingView: some View {
        VStack(spacing: 16) {
            Spacer()
            BundleImage(name: "wally-celebrate").frame(height: 160)
            ProgressView().tint(Color.sage)
            Text("Building your plan, \(store.s.profile.name)").font(.system(.title2, design: .serif).bold()).foregroundStyle(Color.ink)
            Text("Meals, workouts and reminders").foregroundStyle(Color.muted)
            Spacer()
        }.padding()
    }
}
