import SwiftUI
import UserNotifications

struct MoreView: View {
    @EnvironmentObject var store: Store
    @State private var notif: UNAuthorizationStatus = .notDetermined
    @State private var reset = false

    func on(_ id: String) -> Binding<Bool> {
        Binding(get: { store.s.settings.on.contains(id) }, set: { v in
            if v { if !store.s.settings.on.contains(id) { store.s.settings.on.append(id) } } else { store.s.settings.on.removeAll { $0 == id } }
            if v && notif == .notDetermined { Notifier.ask { _ in refresh() } }
            Notifier.rebuild(store)
        })
    }
    func timeBinding(_ kp: WritableKeyPath<Settings, String>) -> Binding<Date> {
        Binding(get: { timeDate(store.s.settings[keyPath: kp]) }, set: { store.s.settings[keyPath: kp] = timeString($0); Notifier.rebuild(store) })
    }
    func refresh() { Notifier.status { notif = $0 } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Explore") {
                    NavigationLink { ProgressScreen() } label: { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
                    NavigationLink { CalendarScreen() } label: { Label("Calendar, habits, to do", systemImage: "calendar") }
                    NavigationLink { TreatsScreen() } label: { Label("Treats", systemImage: "heart") }
                    NavigationLink { RoutinesScreen() } label: { Label("My routines", systemImage: "list.bullet.rectangle") }
                }
                Section("Reminders") {
                    if notif == .denied {
                        Button { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } } label: { Label("Notifications are off. Tap to allow in Settings", systemImage: "bell.slash") }
                    }
                    Toggle("Workout days", isOn: on("workout"))
                    if on("workout").wrappedValue {
                        DatePicker("Workout time", selection: Binding(get: { timeDate(store.s.profile.workoutTime) }, set: { store.s.profile.workoutTime = timeString($0); Notifier.rebuild(store) }), displayedComponents: .hourAndMinute)
                    }
                    Toggle("Water", isOn: on("water"))
                    if on("water").wrappedValue { DatePicker("Water time", selection: timeBinding(\.waterTime), displayedComponents: .hourAndMinute) }
                    Toggle("Meal times", isOn: on("meals"))
                    if on("meals").wrappedValue {
                        DatePicker("Breakfast", selection: timeBinding(\.breakfast), displayedComponents: .hourAndMinute)
                        DatePicker("Lunch", selection: timeBinding(\.lunch), displayedComponents: .hourAndMinute)
                        DatePicker("Dinner", selection: timeBinding(\.dinner), displayedComponents: .hourAndMinute)
                    }
                    Toggle("To do items", isOn: on("tasks"))
                    Toggle("Doses and appointments", isOn: on("health"))
                    Toggle("Show health details on lock screen", isOn: Binding(get: { store.s.settings.detailsOnLock }, set: { store.s.settings.detailsOnLock = $0; Notifier.rebuild(store) }))
                }
                Section("My plan") {
                    Picker("Training where", selection: Binding(get: { store.s.profile.equipment }, set: { store.s.profile.equipment = $0; store.generateRoutine(); Notifier.rebuild(store) })) {
                        Text("Gym").tag("gym"); Text("Home").tag("home"); Text("No kit").tag("body") }
                    Picker("Session length", selection: Binding(get: { store.s.profile.minutes }, set: { store.s.profile.minutes = $0; store.generateRoutine() })) {
                        ForEach([20, 30, 45, 60], id: \.self) { Text("\($0) min").tag($0) } }
                    Stepper("Water goal: \(store.s.profile.waterGoal) ml", value: $store.s.profile.waterGoal, in: 1000...4000, step: 250)
                    NavigationLink("Food and allergies") { FoodPrefs() }
                    NavigationLink("Training days") { DaysPicker() }
                    Button("Rebuild meals and workouts") { store.s.plan = [:]; store.generatePlan(); store.generateRoutine(); Notifier.rebuild(store); store.say("Plan rebuilt") }
                }
                Section("Look") {
                    Picker("Appearance", selection: $store.s.settings.appearance) { Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark") }
                    TextField("Your name", text: $store.s.profile.name)
                }
                AccountSection()
                Section("Your data") {
                    if let d = try? JSONEncoder().encode(store.s), let s = String(data: d, encoding: .utf8) { ShareLink("Export my data", item: s) }
                    Button("Erase everything and start again", role: .destructive) { reset = true }
                }
                Section { Text("Fit Hard 2.0").font(.footnote).foregroundStyle(Color.muted) }
            }
            .scrollContentBackground(.hidden).background(Color.cream).navigationTitle("More")
            .onAppear(perform: refresh)
            .confirmationDialog("Erase all your data on this phone?", isPresented: $reset, titleVisibility: .visible) {
                Button("Erase everything", role: .destructive) { store.storeSession(nil); store.resetAll() }
            }
        }
    }
}

struct FoodPrefs: View {
    @EnvironmentObject var store: Store
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 14) {
            SectionTitle(text: "Cuisines you like")
            Flow { ForEach(Lists.cuisines, id: \.self) { c in Chip(label: c, on: store.s.profile.cuisines.contains(c)) {
                if let i = store.s.profile.cuisines.firstIndex(of: c) { store.s.profile.cuisines.remove(at: i) } else { store.s.profile.cuisines.append(c) } } } }
            Toggle("Vegetarian", isOn: $store.s.profile.vegetarian).tint(Color.sage)
            SectionTitle(text: "Avoid")
            Flow { ForEach(Lists.allergens, id: \.id) { a in Chip(label: a.label, on: store.s.profile.allergens.contains(a.id)) {
                if let i = store.s.profile.allergens.firstIndex(of: a.id) { store.s.profile.allergens.remove(at: i) } else { store.s.profile.allergens.append(a.id) } } } }
            BigButton(title: "Update my meal plan", icon: "sparkles") { store.s.plan = [:]; store.generatePlan(); store.say("Meal plan updated") }
        }.padding(16) }.background(Color.cream).navigationTitle("Food")
    }
}

struct DaysPicker: View {
    @EnvironmentObject var store: Store
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 14) {
            Flow { ForEach(Lists.weekdays, id: \.0) { d in Chip(label: d.1, on: store.s.profile.trainDays.contains(d.0)) {
                if let i = store.s.profile.trainDays.firstIndex(of: d.0) { store.s.profile.trainDays.remove(at: i) } else { store.s.profile.trainDays.append(d.0) } } } }
            BigButton(title: "Update my workouts", icon: "sparkles") { store.generateRoutine(); Notifier.rebuild(store); store.say("Workouts updated") }
        }.padding(16) }.background(Color.cream).navigationTitle("Training days")
    }
}
