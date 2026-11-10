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
                Section {
                    NavigationLink { ProfileScreen() } label: { HStack(spacing: 12) { AvatarView(size: 48); VStack(alignment: .leading) { Text(store.s.profile.name.isEmpty ? "My profile" : store.s.profile.name).font(.fh_headline); Text("Goals, body, training, food, character").font(.fh_caption).foregroundStyle(Color.muted) } } }.accessibilityIdentifier("my-profile")
                }.themedRows()
                Section("Explore") {
                    NavigationLink { ProgressScreen() } label: { BrandLabel("Progress", icon: "chart.line.uptrend.xyaxis") }
                    if store.s.profile.needs.contains("peptides") || store.s.profile.primaryGoal == "doses" || store.s.profile.goals.contains("Keep track of my doses") || !store.s.meds.isEmpty {
                        NavigationLink { HealthView(embedded: true) } label: { BrandLabel("Health log and appointments", icon: "cross.case") }
                    }
                    NavigationLink { TreatsScreen() } label: { BrandLabel("Treats", icon: "heart") }
                    
                }.themedRows()
                Section("Reminders") {
                    if notif == .denied {
                        Button { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } } label: { BrandLabel("Notifications are off. Tap to allow in Settings", icon: "bell.slash") }
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
                    Toggle("Shopping list, Sundays", isOn: on("shopping"))
                    Toggle("Recovery days", isOn: on("recovery"))
                    Toggle("Calendar events and to do items", isOn: on("calendar"))
                    Toggle("To do items", isOn: on("tasks"))
                    DatePicker("Quiet from", selection: timeBinding(\.quietFrom), displayedComponents: .hourAndMinute)
                    DatePicker("Quiet until", selection: timeBinding(\.quietTo), displayedComponents: .hourAndMinute)
                    Picker("Remind me before", selection: Binding(get: { store.s.settings.lead }, set: { store.s.settings.lead = $0; Notifier.rebuild(store) })) { ForEach([0, 10, 30, 60], id: \.self) { Text($0 == 0 ? "On time" : "\($0) min before").tag($0) } }
                    Toggle("Doses and appointments", isOn: on("health"))
                    Toggle("Show health details on lock screen", isOn: Binding(get: { store.s.settings.detailsOnLock }, set: { store.s.settings.detailsOnLock = $0; Notifier.rebuild(store) }))
                }.themedRows()
                Section("My plan") {
                    Picker("Training where", selection: Binding(get: { store.s.profile.location }, set: { store.s.profile.location = $0; store.s.profile.equipment = $0 == "home" ? "home" : "gym"; store.s.profile.kit = []; store.finishSetupKit(); store.generateRoutine(); Notifier.rebuild(store) })) {
                        Text("Gym").tag("gym"); Text("Home").tag("home"); Text("Both").tag("both") }
                    Picker("Session length", selection: Binding(get: { store.s.profile.minutes }, set: { store.s.profile.minutes = $0; store.generateRoutine() })) {
                        ForEach([20, 30, 45, 60], id: \.self) { Text("\($0) min").tag($0) } }
                    Stepper("Water goal: \(store.s.profile.waterGoal) ml", value: $store.s.profile.waterGoal, in: 1000...4000, step: 250)
                    NavigationLink("Food and allergies") { FoodPrefs() }
                    NavigationLink("Training days") { DaysPicker() }
                    Button("Rebuild meals and workouts") { store.s.plan = [:]; store.profileChanged(); store.say("Plan rebuilt") }
                }.themedRows()
                Section("Look") {
                    ThemePicker()
                    Picker("Language", selection: $store.s.language) { Text("English").tag("en"); Text("Spanish").tag("es") }.accessibilityIdentifier("language-picker")
                    TextField("Your name", text: $store.s.profile.name)
                }.themedRows()
                AccountSection()
                Section("Your data") {
                    if let d = try? JSONEncoder().encode(store.s), let s = String(data: d, encoding: .utf8) { ShareLink("Export my data", item: s) }
                    Button("Erase everything and start again", role: .destructive) { reset = true }
                }.themedRows()
                Section { Text("Fit Hard 2.0").font(.fh_footnote).foregroundStyle(Color.muted) }
            }
            .scrollContentBackground(.hidden).background(Color.cream).navigationTitle("More")
            .environment(\.defaultMinListRowHeight, 44)
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

/// Edit the one shared profile. Saving rebuilds meals, routines and reminders from it. Workout history is never touched.
struct ProfileScreen: View {
    @EnvironmentObject var store: Store
    var p: Binding<Profile> { $store.s.profile }
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 14) {
            SectionTitle(text: "Your character")
            HStack(spacing: 10) {
                ForEach([("boy", "Boy"), ("girl", "Girl"), ("nonbinary", "Non-binary")], id: \.0) { c in
                    Button { store.s.profile.character = c.0; haptic() } label: {
                        VStack(spacing: 4) { BundleImage(name: "avatar-\(c.0)").frame(height: 70).clipShape(RoundedRectangle(cornerRadius: 12)); Text(LocalizedStringKey(c.1)).font(.fh_caption_b) }
                            .padding(6).frame(maxWidth: .infinity).background(store.s.profile.character == c.0 ? Color.tint : Color.surface, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(store.s.profile.character == c.0 ? Color.sage : Color.line, lineWidth: store.s.profile.character == c.0 ? 3 : 1))
                    }.buttonStyle(.plain).accessibilityIdentifier("pchar-\(c.0)")
                }
            }
            Text("Only changes how you look. Your plan stays the same.").font(.fh_caption).foregroundStyle(Color.muted)
            SectionTitle(text: "Main goal")
            Flow { ForEach(Array(Lists.goals.enumerated()), id: \.offset) { i, g in Chip(label: g, on: store.s.profile.primaryGoal == Lists.goalIds[i]) { store.s.profile.primaryGoal = Lists.goalIds[i] } } }
            SectionTitle(text: "Body")
            Stepper("Age \(store.s.profile.age == 0 ? "not set" : String(store.s.profile.age))", value: p.age, in: 0...100).onChange(of: store.s.profile.age) { a in store.s.profile.minor = a > 0 && a < 18 }
            Stepper("Height \(store.s.profile.heightCm == 0 ? "not set" : String(Int(store.s.profile.heightCm)) + " cm")", value: p.heightCm, in: 0...230, step: 1)
            Stepper("Weight \(store.s.profile.weightKg == 0 ? "not set" : RecipeService.fmt(store.s.profile.weightKg) + " kg")", value: p.weightKg, in: 0...250, step: 0.5)
            SectionTitle(text: "Training")
            Flow { ForEach(Lists.weekdays, id: \.0) { d in Chip(label: d.1, on: store.s.profile.trainDays.contains(d.0)) {
                if let i = store.s.profile.trainDays.firstIndex(of: d.0) { store.s.profile.trainDays.remove(at: i) } else { store.s.profile.trainDays.append(d.0) } } } }
            Picker("Level", selection: p.experience) { Text("New").tag("beginner"); Text("Some").tag("intermediate"); Text("Lots").tag("advanced") }.pickerStyle(.segmented)
            Picker("Length", selection: p.minutes) { ForEach([20, 30, 45, 60], id: \.self) { Text("\($0) min").tag($0) } }.pickerStyle(.segmented)
            SectionTitle(text: "Food")
            Picker("Diet", selection: p.diet) { Text("Anything").tag("any"); Text("Vegetarian").tag("vegetarian"); Text("Vegan").tag("vegan") }.pickerStyle(.segmented)
            Picker("Meals", selection: p.mealsPerDay) { Text("2 a day").tag(2); Text("3 a day").tag(3) }.pickerStyle(.segmented)
            Flow { ForEach(Lists.allergens, id: \.id) { a in Chip(label: a.label, on: store.s.profile.allergens.contains(a.id)) {
                if let i = store.s.profile.allergens.firstIndex(of: a.id) { store.s.profile.allergens.remove(at: i) } else { store.s.profile.allergens.append(a.id) } } } }
            BigButton(title: "Save and update my plan", icon: "sparkles") { store.profileChanged(); store.say("Your plan is updated") }.accessibilityIdentifier("profile-save")
            Text("Your workout history stays exactly as it is.").font(.fh_caption).foregroundStyle(Color.muted)
        }.padding(16) }.background(Color.cream).navigationTitle("My profile").navigationBarTitleDisplayMode(.inline)
    }
}
