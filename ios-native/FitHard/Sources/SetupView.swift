import SwiftUI

struct NumField: View {
    let label: String; let unit: String; @Binding var value: Double; var whole = false
    @State private var text = ""
    var body: some View {
        HStack {
            TextField(label, text: $text).keyboardType(whole ? .numberPad : .decimalPad)
                .onChange(of: text) { t in value = Double(t.replacingOccurrences(of: ",", with: ".")) ?? 0 }
            Text(unit).foregroundStyle(Color.muted)
        }.padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
        .onAppear { if value > 0 { text = whole ? String(Int(value)) : RecipeService.fmt(value) } }
        .accessibilityIdentifier("num-\(label)")
    }
}

/// The ten setup screens after sign up, plus the character pick. Everything lands in the one shared profile.
struct SetupView: View {
    @EnvironmentObject var store: Store
    @State private var step = 0
    @State private var building = false
    @State private var dislikeText = ""
    @State private var showWhy = false
    static let total = 11
    static let parts: [(String, String)] = [("chest", "Chest"), ("lats", "Back"), ("shoulders", "Shoulders"), ("biceps", "Biceps"), ("triceps", "Triceps"),
        ("abdominals", "Core"), ("quadriceps", "Front legs"), ("hamstrings", "Back legs"), ("glutes", "Glutes"), ("calves", "Calves")]
    static let kitList: [(String, String)] = [("barbell", "Barbell"), ("dumbbell", "Dumbbells"), ("machine", "Machines"), ("cable", "Cables"), ("kettlebells", "Kettlebells"),
        ("bands", "Bands"), ("exercise ball", "Exercise ball"), ("medicine ball", "Medicine ball"), ("bench or box", "Bench or box"), ("foam roll", "Foam roller"), ("e-z curl bar", "Curl bar")]
    var p: Binding<Profile> { $store.s.profile }

    var bodyOk: Bool {
        let q = store.s.profile
        if q.age != 0 && (q.age < 13 || q.age > 100) { return false }
        if q.heightCm != 0 && (q.heightCm < 120 || q.heightCm > 230) { return false }
        if q.weightKg != 0 && (q.weightKg < 30 || q.weightKg > 250) { return false }
        return true
    }
    var canNext: Bool {
        switch step { case 0: return !store.s.profile.primaryGoal.isEmpty; case 1: return bodyOk; case 2: return !store.s.profile.character.isEmpty; default: return true }
    }

    var body: some View {
        VStack(spacing: 0) {
            if building { buildingView } else {
                VStack(alignment: .leading, spacing: 4) {
                    if store.s.onboarded {
                        Text("Welcome back. Answer again so your meals, training and calendar fit you. Everything you saved stays.").font(.fh_subheadline).foregroundStyle(Color.ink).padding(.bottom, 6).accessibilityIdentifier("setup-welcome-back")
                    }
                    ProgressView(value: Double(step + 1), total: Double(SetupView.total)).tint(Color.sage)
                    Text(String(format: NSLocalizedString("Step %lld of %lld", comment: ""), step + 1, SetupView.total)).font(.fh_caption).foregroundStyle(Color.muted).accessibilityIdentifier("setup-step")
                }.padding(.horizontal, 24).padding(.top, 12)
                ScrollView { VStack(alignment: .leading, spacing: 16) { page }.padding(24).frame(maxWidth: .infinity, alignment: .leading) }
                HStack(spacing: 12) {
                    if step > 0 { BigButton(title: "Back", filled: false) { go(step - 1) }.frame(width: 120).accessibilityIdentifier("setup-back") }
                    BigButton(title: step == SetupView.total - 1 ? "Generate my plan" : "Next", icon: step == SetupView.total - 1 ? "sparkles" : nil) { next() }
                        .disabled(!canNext).opacity(canNext ? 1 : 0.4).accessibilityIdentifier("setup-next")
                }.padding(.horizontal, 24).padding(.bottom, 16)
            }
        }.background(Color.cream.ignoresSafeArea())
    }

    func go(_ s: Int) {
        if s == 6 && store.s.profile.kit.isEmpty { presetKit() }
        withAnimation { step = s }
    }
    func presetKit() {
        let loc = store.s.profile.location
        store.s.profile.kit = loc == "home" ? ["dumbbell", "bands", "kettlebells", "bench or box"] : ["barbell", "dumbbell", "machine", "cable", "kettlebells", "bench or box", "e-z curl bar"]
    }

    @ViewBuilder var page: some View {
        switch step {
        case 0:
            BundleImage(name: "wally-hello").frame(height: 110).frame(maxWidth: .infinity)
            title(String(format: NSLocalizedString("Hi %@. What is your main goal?", comment: ""), store.s.profile.name))
            ForEach(Array(Lists.goals.enumerated()), id: \.offset) { i, g in
                Chip(label: g, icon: Lists.goalIcons[i], on: store.s.profile.primaryGoal == Lists.goalIds[i]) {
                    store.s.profile.primaryGoal = Lists.goalIds[i]
                    if !store.s.profile.goals.contains(g) { store.s.profile.goals.append(g) }
                }.accessibilityIdentifier("goal-\(Lists.goalIds[i])")
            }
            hint("Anything else? Pick any extra goals.")
            Flow { ForEach(Array(Lists.goals.enumerated()), id: \.offset) { i, g in
                if Lists.goalIds[i] != store.s.profile.primaryGoal {
                    Chip(label: g, on: store.s.profile.goals.contains(g)) { toggle(p.goals, g) } } } }
        case 1:
            title("About your body"); hint("This only shapes your calorie and protein numbers. You can skip any box.")
            Picker("Units", selection: p.imperial) { Text("kg and cm").tag(false); Text("lb and in").tag(true) }.pickerStyle(.segmented)
            let imp = store.s.profile.imperial
            Group {
                NumField(label: "Age", unit: "years", value: Binding(get: { Double(store.s.profile.age) }, set: { store.s.profile.age = Int($0); store.s.profile.minor = $0 > 0 && $0 < 18 }), whole: true)
                NumField(label: "Height", unit: imp ? "in" : "cm", value: Binding(get: { imp ? store.s.profile.heightCm / 2.54 : store.s.profile.heightCm }, set: { store.s.profile.heightCm = imp ? $0 * 2.54 : $0 }))
                NumField(label: "Weight", unit: imp ? "lb" : "kg", value: Binding(get: { imp ? store.s.profile.weightKg * 2.2046 : store.s.profile.weightKg }, set: { store.s.profile.weightKg = imp ? $0 / 2.2046 : $0 }))
                NumField(label: "Target weight (optional)", unit: imp ? "lb" : "kg", value: Binding(get: { imp ? store.s.profile.targetKg * 2.2046 : store.s.profile.targetKg }, set: { store.s.profile.targetKg = imp ? $0 / 2.2046 : $0 }))
            }.id(imp)
            if !bodyOk { Text("Please check those numbers. Age 13 to 100, height 120 to 230 cm, weight 30 to 250 kg.").font(.fh_footnote).foregroundStyle(Color.amber) }
            hint("For the resting energy estimate only, pick the closest formula. This is separate from your character.")
            Picker("Formula", selection: p.calcBasis) { Text("Female").tag("female"); Text("Male").tag("male"); Text("Average").tag("avg") }.pickerStyle(.segmented)
        case 2:
            title("Pick your character"); hint("This is how you look in the app. It never changes your plan or your numbers.")
            HStack(spacing: 10) {
                ForEach([("boy", "Boy"), ("girl", "Girl"), ("nonbinary", "Non-binary")], id: \.0) { c in
                    Button { store.s.profile.character = c.0; haptic() } label: {
                        VStack(spacing: 6) {
                            BundleImage(name: "avatar-\(c.0)").frame(height: 96).clipShape(RoundedRectangle(cornerRadius: 14))
                            Text(LocalizedStringKey(c.1)).font(.fh_subheadline_b)
                        }.padding(8).frame(maxWidth: .infinity)
                        .background(store.s.profile.character == c.0 ? Color.tint : Color.surface, in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(store.s.profile.character == c.0 ? Color.sage : Color.line, lineWidth: store.s.profile.character == c.0 ? 3 : 1))
                    }.buttonStyle(.plain).accessibilityIdentifier("char-\(c.0)").accessibilityLabel(c.1)
                    .accessibilityAddTraits(store.s.profile.character == c.0 ? .isSelected : [])
                }
            }
        case 3:
            title("Your training so far")
            Picker("Experience", selection: p.experience) { Text("New").tag("beginner"); Text("Some").tag("intermediate"); Text("Lots").tag("advanced") }.pickerStyle(.segmented)
            hint("How active is a normal week?")
            Flow { ForEach([("sedentary", "Mostly sitting"), ("light", "Light"), ("moderate", "Moderate"), ("active", "Very active")], id: \.0) { a in
                Chip(label: a.1, on: store.s.profile.activity == a.0) { store.s.profile.activity = a.0 } } }
            hint("What do you like to do?")
            Flow { ForEach([("strength", "Strength"), ("mixed", "Strength and cardio"), ("general", "General fitness")], id: \.0) { a in
                Chip(label: a.1, on: store.s.profile.trainType == a.0) { store.s.profile.trainType = a.0 } } }
        case 4:
            title("When do you train?")
            Flow { ForEach(Lists.weekdays, id: \.0) { d in
                Chip(label: d.1, on: store.s.profile.trainDays.contains(d.0)) { toggle(p.trainDays, d.0) }.accessibilityIdentifier("day-\(d.1)") } }
            hint("\(store.s.profile.trainDays.count) days a week")
            title("How long?")
            Picker("", selection: p.minutes) { ForEach([20, 30, 45, 60], id: \.self) { Text("\($0) min").tag($0) } }.pickerStyle(.segmented)
            title("Where?")
            Picker("", selection: p.location) { Text("Gym").tag("gym"); Text("Home").tag("home"); Text("Both").tag("both") }.pickerStyle(.segmented)
            DatePicker("Usual time", selection: Binding(get: { timeDate(store.s.profile.workoutTime) }, set: { store.s.profile.workoutTime = timeString($0) }), displayedComponents: .hourAndMinute)
        case 5:
            title("Which body parts?"); hint("Tap once to focus on it. Tap twice to train it less.")
            Flow { ForEach(SetupView.parts, id: \.0) { b in
                let st = store.s.profile.bodyFocus[b.0]
                Chip(label: b.1 + (st == "priority" ? "  focus" : st == "less" ? "  less" : ""), on: st != nil) {
                    let n: String? = st == nil ? "priority" : (st == "priority" ? "less" : nil)
                    store.s.profile.bodyFocus[b.0] = n
                }.accessibilityIdentifier("part-\(b.0)") } }
        case 6:
            title("What can you use?"); hint("Your workouts only use what you tick. Body weight exercises are always included.")
            Flow { ForEach(SetupView.kitList, id: \.0) { k in
                Chip(label: k.1, on: store.s.profile.kit.contains(k.0)) { toggle(p.kit, k.0) }.accessibilityIdentifier("kit-\(k.0)") } }
        case 7:
            title("How do you like to eat?")
            Picker("Diet", selection: p.diet) { Text("Anything").tag("any"); Text("Vegetarian").tag("vegetarian"); Text("Vegan").tag("vegan") }.pickerStyle(.segmented)
            hint("Favourite foods")
            Flow { ForEach(Lists.cuisines, id: \.self) { c in Chip(label: c, on: store.s.profile.cuisines.contains(c)) { toggle(p.cuisines, c) } } }
            hint("Anything to avoid? We hide those recipes.")
            Flow { ForEach(Lists.allergens, id: \.id) { a in Chip(label: a.label, on: store.s.profile.allergens.contains(a.id)) { toggle(p.allergens, a.id) } } }
            TextField("Foods you dislike, separated by commas", text: $dislikeText).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
                .onChange(of: dislikeText) { t in store.s.profile.dislikes = t.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }.filter { !$0.isEmpty } }
            hint("Meals a day")
            Picker("", selection: p.mealsPerDay) { Text("2").tag(2); Text("3").tag(3) }.pickerStyle(.segmented)
            hint("Time to cook")
            Picker("", selection: p.cookMinutes) { ForEach([15, 30, 45, 60], id: \.self) { Text("\($0) min").tag($0) } }.pickerStyle(.segmented)
            hint("Budget")
            Picker("", selection: p.budget) { Text("Low").tag("low"); Text("Medium").tag("medium"); Text("Flexible").tag("high") }.pickerStyle(.segmented)
        case 8:
            title("What is in your kitchen?"); hint("Tap what you have. Meals then only add what you still need to buy. Skip it if you like.")
            Flow { ForEach(store.cat.ingredients.common, id: \.self) { n in
                Chip(label: n.capitalized, on: store.s.inventory.contains { RecipeService.norm($0.name) == RecipeService.norm(n) }) { toggleInv(n) } } }
            ForEach($store.s.inventory) { $it in
                HStack {
                    Text(it.name.capitalized).font(.fh_subheadline_b)
                    Spacer()
                    Stepper("\(RecipeService.fmt(it.qty)) \(it.unit)", value: $it.qty, in: 0...5000, step: it.unit == "g" || it.unit == "ml" ? 100 : 1).fixedSize()
                }.padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
            }
        case 9:
            title("A quick safety check"); hint("Fit Hard never diagnoses anything. These answers only make your plan gentler.")
            toggleRow("I am under 18", p.minor)
            toggleRow("I am pregnant or breastfeeding", p.pregnant)
            toggleRow("Counting calories worries me, or I have had an eating disorder", p.edConcern)
            toggleRow("A clinician has limited my exercise", p.clinicianLimits)
            TextField("Any injury or sore spot? (optional)", text: p.injury).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
            if !NutritionService.targetsAllowed(store.s.profile) { Text("We will not set calorie targets for you. Please talk with a clinician about food. Meals and workouts still work.").font(.fh_footnote).foregroundStyle(Color.amber) }
        default:
            title(String(format: NSLocalizedString("Ready, %@?", comment: ""), store.s.profile.name))
            Card {
                summaryRow("Goal", Lists.goals[max(0, Lists.goalIds.firstIndex(of: store.s.profile.primaryGoal) ?? 0)])
                summaryRow("Training", "\(store.s.profile.trainDays.count) days, \(store.s.profile.minutes) min")
                summaryRow("Where", store.s.profile.location.capitalized)
                if let t = NutritionService.targets(store.s.profile) { summaryRow("Daily target", "\(t.kcal) kcal, \(t.protein) g protein") }
                else { summaryRow("Daily target", "Add age, height and weight in Profile any time") }
            }
            title("Reminders")
            reminderRow("workout", "Workout days", "dumbbell"); reminderRow("meals", "Meal times", "fork.knife")
            reminderRow("water", "Water, once a day", "drop"); reminderRow("health", "Doses and appointments", "cross.case")
        }
    }

    func summaryRow(_ a: String, _ b: String) -> some View { HStack { Text(a).foregroundStyle(Color.muted); Spacer(); Text(b).font(.fh_subheadline_b) } }
    func toggleRow(_ t: String, _ b: Binding<Bool>) -> some View { Toggle(t, isOn: b).tint(Color.sage).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)) }
    func reminderRow(_ id: String, _ label: String, _ icon: String) -> some View {
        Toggle(isOn: Binding(get: { store.s.settings.on.contains(id) }, set: { v in
            if v { if !store.s.settings.on.contains(id) { store.s.settings.on.append(id) } } else { store.s.settings.on.removeAll { $0 == id } } })) {
            BrandLabel(label, icon: icon).font(.fh_headline)
        }.tint(Color.sage).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
    }
    func title(_ t: String) -> some View { Text(LocalizedStringKey(t)).font(.fh_title_b).foregroundStyle(Color.ink) }
    func hint(_ t: String) -> some View { Text(LocalizedStringKey(t)).font(.fh_subheadline).foregroundStyle(Color.muted) }
    func toggle<T: Equatable>(_ arr: Binding<[T]>, _ v: T) {
        var a = arr.wrappedValue
        if let i = a.firstIndex(of: v) { a.remove(at: i) } else { a.append(v) }
        arr.wrappedValue = a
    }
    func toggleInv(_ n: String) {
        if let i = store.s.inventory.firstIndex(where: { RecipeService.norm($0.name) == RecipeService.norm(n) }) { store.s.inventory.remove(at: i); return }
        let u = RecipeService.cat.nutrition[RecipeService.norm(n)]?.u ?? [:]
        let unit = u["pcs"] != nil ? "pcs" : (u["tbsp"] != nil ? "tbsp" : "g")
        store.s.inventory.append(InvItem(name: n, qty: unit == "g" ? 500 : 4, unit: unit))
    }

    func next() {
        if step < SetupView.total - 1 { go(step + 1); return }
        building = true
        store.finishSetup()
        let finish = { store.s.onboarded = true; store.s.personalizationVersion = Store.personalizationRound; Notifier.rebuild(store) }
        if store.s.settings.on.isEmpty { DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: finish) }
        else { Notifier.ask { _ in DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: finish) } }
    }

    var buildingView: some View {
        VStack(spacing: 16) {
            Spacer()
            BundleImage(name: "wally-celebrate").frame(height: 160)
            ProgressView().tint(Color.sage)
            Text(String(format: NSLocalizedString("Building your plan, %@", comment: ""), store.s.profile.name)).font(.fh_title2_b).foregroundStyle(Color.ink)
            Text("Meals, workouts and reminders").foregroundStyle(Color.muted)
            Spacer()
        }.padding()
    }
}
