import SwiftUI
import UIKit
import Vision
import ImageIO
import Charts

// MARK: Diet (build 53). Daily calories from the person's own numbers, a food photo to calories, a one glance chart.
// Formulas and sources (see NutritionService.plan in Services.swift):
//  - Resting energy: Mifflin St Jeor 1990 (Am J Clin Nutr 51:241), the equation the Academy of Nutrition and Dietetics names for adults.
//  - Daily need: resting energy times an activity factor 1.2, 1.375, 1.55, 1.725.
//  - Lose: 500 kcal a day under (about 0.45 kg a week, inside the 0.5 to 1 kg a week of AHA/ACC/TOS 2013 and NHLBI), never above 20 percent under.
//  - Gain: 300 kcal a day over (about 0.27 kg a week). Maintain: the daily need.
//  - Floor: 1,200 kcal for women, 1,500 kcal for men (NHLBI 1998, AHA/ACC/TOS 2013). Unsure uses 1,500. A target is never set under it.
//  - Food calories per 100 g come from USDA FoodData Central SR Legacy (foods.json). Portions are typical sizes: always an estimate.
//  - Photo: Apple Vision names the food on the phone (the photo never leaves it). The person confirms the food and the size.

struct FoodItem: Codable, Identifiable, Hashable {
    let n: String      // name
    let k: Int         // kcal per 100 g (USDA)
    let g: Int         // typical serving in grams
    let v: [String]    // words Apple Vision may use for it
    var id: String { n }
}

enum FoodDB {
    static let all: [FoodItem] = {
        guard let u = Bundle.main.url(forResource: "foods", withExtension: "json"), let d = try? Data(contentsOf: u),
              let a = try? JSONDecoder().decode([FoodItem].self, from: d) else { return [] }
        return a
    }()
    static func search(_ q: String) -> [FoodItem] {
        let t = q.lowercased().trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return all }
        return all.filter { $0.n.lowercased().contains(t) || $0.v.contains { $0.contains(t) } }
    }
    static func kcal(_ f: FoodItem, grams: Int) -> Int { Int((Double(f.k) * Double(grams) / 100).rounded()) }
}

enum FoodClassifier {
    /// Best guesses from the photo, most likely first. Empty when nothing matched: the person then searches.
    static func guess(_ image: UIImage) async -> [FoodItem] {
        guard let cg = image.cgImage else { return [] }
        let orient = CGImagePropertyOrientation(image.imageOrientation)
        return await Task.detached(priority: .userInitiated) { () -> [FoodItem] in
            let req = VNClassifyImageRequest()
            let h = VNImageRequestHandler(cgImage: cg, orientation: orient, options: [:])
            try? h.perform([req])
            let obs = (req.results ?? []).filter { $0.confidence > 0.03 }.sorted { $0.confidence > $1.confidence }
            var out: [FoodItem] = []
            for o in obs {
                let id = o.identifier.lowercased().replacingOccurrences(of: " ", with: "_")
                let parts = id.split(separator: "_").map(String.init)
                for f in FoodDB.all where !out.contains(f) && f.v.contains(where: { $0 == id || parts.contains($0) }) { out.append(f) }
                if out.count >= 4 { break }
            }
            return out
        }.value
    }
}

struct DayTotal: Identifiable { let day: String; let label: String; let kcal: Int; var id: String { day } }

extension Store {
    func foodEntries(_ day: String) -> [FoodEntry] { s.foodLog.filter { $0.day == day } }
    func foodKcal(_ day: String) -> Int { foodEntries(day).reduce(0) { $0 + $1.kcal } }
    func addFood(_ name: String, kcal: Int, grams: Int?, meal: String, photo: Bool) {
        s.foodLog.append(FoodEntry(day: today, meal: meal, name: name, kcal: kcal, grams: grams, photo: photo))
        haptic()
    }
    func last7() -> [DayTotal] {
        let f = DateFormatter(); f.dateFormat = "EEE"
        return (0..<7).reversed().compactMap { i in
            guard let d = Calendar.current.date(byAdding: .day, value: -i, to: Date()) else { return nil }
            let k = dayKey(d)
            return DayTotal(day: k, label: f.string(from: d), kcal: foodKcal(k))
        }
    }
}

enum DietMeals {
    static let all = ["breakfast", "lunch", "dinner", "snack"]
    static func label(_ m: String) -> String { m.capitalized }
    static var now: String { let h = Calendar.current.component(.hour, from: Date()); return h < 11 ? "breakfast" : (h < 15 ? "lunch" : (h < 21 ? "dinner" : "snack")) }
}

// MARK: Camera
struct CameraPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onImage: (UIImage) -> Void
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        p.delegate = context.coordinator
        return p
    }
    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coord { Coord(self) }
    final class Coord: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let i = info[.originalImage] as? UIImage { parent.onImage(i) }
            parent.isPresented = false
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.isPresented = false }
    }
}

// MARK: Photo to calories
struct FoodSnapView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var image: UIImage?
    @State private var showCamera = false
    @State private var working = false
    @State private var guesses: [FoodItem] = []
    @State private var food: FoodItem?
    @State private var grams = 100
    @State private var meal = DietMeals.now
    @State private var query = ""
    @State private var asked = false

    var kcal: Int { food.map { FoodDB.kcal($0, grams: grams) } ?? 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if let img = image {
                        Image(uiImage: img).resizable().scaledToFit().frame(maxHeight: 240).clipShape(RoundedRectangle(cornerRadius: 20))
                        if working { ProgressView("Looking at your food") }
                        else { result }
                        Button("Take another photo") { showCamera = true }.font(.fh_subheadline_b).foregroundStyle(Color.sage)
                    } else {
                        Card {
                            SectionTitle(text: "Snap your food")
                            Text("Take a photo and Fit Hard guesses the food and its calories. It is an estimate, and you can change it before it is saved.").font(.fh_subheadline).foregroundStyle(Color.muted)
                            BigButton(title: "Take a photo", icon: "camera") { showCamera = true }
                            BigButton(title: "Pick food from a list", icon: "fork.knife", filled: false) { image = UIImage(); guesses = []; food = nil }
                        }
                    }
                }.padding(16)
            }
            .background(Color.cream)
            .navigationTitle("Food photo").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarLeading) { Button("Close") { dismiss() } } }
            .fullScreenCover(isPresented: $showCamera) { CameraPicker(isPresented: $showCamera) { img in analyse(img) }.ignoresSafeArea() }
            .onAppear { if !asked { asked = true; showCamera = true } }
        }
    }

    @ViewBuilder var result: some View {
        Card {
            HStack { SectionTitle(text: "Looks like"); Spacer(); Text("Estimate").font(.fh_caption_b).foregroundStyle(Color.amber) }
            if guesses.isEmpty { Text("Fit Hard could not tell what this is. Search for it below.").font(.fh_subheadline).foregroundStyle(Color.muted) }
            Flow { ForEach(guesses) { g in Chip(label: g.n, on: food == g) { pick(g) } } }
            TextField("Search another food", text: $query).textFieldStyle(.roundedBorder)
            if !query.isEmpty { Flow { ForEach(FoodDB.search(query).prefix(8)) { g in Chip(label: g.n, on: food == g) { pick(g); query = "" } } } }
        }
        if let f = food {
            Card {
                Text(f.n).font(.fh_title3_b)
                Text("\(kcal) kcal").font(.fh_largeTitle_b).foregroundStyle(Color.sage)
                Text("About, not exact. Based on a typical portion. Change the size if yours is different.").font(.fh_caption).foregroundStyle(Color.muted)
                HStack(spacing: 8) {
                    ForEach([("Small", 0.7), ("Medium", 1.0), ("Large", 1.4)], id: \.0) { s in
                        Chip(label: s.0, on: grams == Int((Double(f.g) * s.1).rounded())) { grams = Int((Double(f.g) * s.1).rounded()) }
                    }
                }
                Stepper("\(grams) g", value: $grams, in: 10...1500, step: 10)
                Flow { ForEach(DietMeals.all, id: \.self) { m in Chip(label: DietMeals.label(m), on: meal == m) { meal = m } } }
                BigButton(title: "Save to today", icon: "checkmark") {
                    store.addFood(f.n, kcal: kcal, grams: grams, meal: meal, photo: image?.cgImage != nil)
                    dismiss()
                }
            }
        }
    }

    func pick(_ f: FoodItem) { food = f; grams = f.g }
    func analyse(_ img: UIImage) {
        image = img; working = true; food = nil; guesses = []
        Task {
            let g = await FoodClassifier.guess(img)
            guesses = g; if let first = g.first { pick(first) }
            working = false
        }
    }
}

// MARK: Setup and numbers
struct DietSetup: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var weight = ""
    @State private var height = ""
    @State private var age = ""
    @State private var sex = "female"
    @State private var activity = "light"
    @State private var goal = "lose"

    var body: some View {
        NavigationStack {
            Form {
                Section("Your numbers") {
                    TextField("Weight in kg", text: $weight).keyboardType(.decimalPad)
                    TextField("Height in cm", text: $height).keyboardType(.decimalPad)
                    TextField("Age", text: $age).keyboardType(.numberPad)
                    Picker("Sex", selection: $sex) { Text("Female").tag("female"); Text("Male").tag("male") }.pickerStyle(.segmented)
                }
                Section("How active are you") {
                    Picker("Activity", selection: $activity) {
                        Text("Mostly sitting").tag("sedentary"); Text("Light, 1 to 3 days").tag("light")
                        Text("Moderate, 3 to 5 days").tag("moderate"); Text("Very active, 6 to 7 days").tag("active")
                    }.pickerStyle(.menu)
                }
                Section("Your goal") {
                    Picker("Goal", selection: $goal) { Text("Lose weight").tag("lose"); Text("Maintain").tag("fitter"); Text("Gain weight").tag("muscle") }.pickerStyle(.segmented)
                }
                Section { Text("This is an estimate to start from, not medical advice.").font(.fh_caption).foregroundStyle(Color.muted) }
            }
            .navigationTitle("Daily calories").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .navigationBarTrailing) { Button("Save") { save() }.disabled(!valid) }
            }
            .onAppear(perform: load)
        }
    }
    var valid: Bool { num(weight) > 0 && num(height) > 0 && (Int(age) ?? 0) > 0 }
    func num(_ s: String) -> Double { Double(s.replacingOccurrences(of: ",", with: ".")) ?? 0 }
    func load() {
        let p = store.s.profile
        if p.weightKg > 0 { weight = String(format: "%g", p.weightKg) }
        if p.heightCm > 0 { height = String(format: "%g", p.heightCm) }
        if p.age > 0 { age = String(p.age) }
        sex = p.calcBasis == "male" ? "male" : "female"
        activity = p.activity
        goal = p.primaryGoal == "lose" ? "lose" : (p.primaryGoal == "muscle" ? "muscle" : "fitter")
    }
    func save() {
        store.s.profile.weightKg = num(weight); store.s.profile.heightCm = num(height); store.s.profile.age = Int(age) ?? 0
        store.s.profile.calcBasis = sex; store.s.profile.activity = activity; store.s.profile.primaryGoal = goal
        dismiss()
    }
}

// MARK: Dashboard
struct DietView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var snap = false
    @State private var setup = false
    @State private var adding = false
    @State private var addQuery = ""

    var plan: CaloriePlan? { NutritionService.plan(store.s.profile) }
    var eaten: Int { store.foodKcal(store.today) }
    var goalText: String {
        switch NutritionService.goal(store.s.profile) { case "lose": return "to lose weight"; case "gain": return "to gain weight"; default: return "to maintain" }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    header
                    BigButton(title: "Snap your food", icon: "camera") { snap = true }.accessibilityIdentifier("diet-snap")
                    mealsCard
                    quickRow
                    chartCard
                    Text("Calories are estimates. Targets use the Mifflin St Jeor equation, the lowest safe level is 1,200 kcal for women and 1,500 kcal for men, and this is not medical advice. Food values come from USDA FoodData Central.").font(.fh_caption).foregroundStyle(Color.muted)
                }.padding(16).padding(.bottom, 20)
            }
            .background(Color.cream)
            .navigationTitle("Food").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarLeading) { Button("Close") { dismiss() } } }
            .fullScreenCover(isPresented: $snap) { FoodSnapView().environmentObject(store).tint(Color.sage) }
            .sheet(isPresented: $setup) { DietSetup().environmentObject(store).tint(Color.sage) }
        }
    }

    @ViewBuilder var header: some View {
        Card {
            if !NutritionService.targetsAllowed(store.s.profile) {
                Text("Fit Hard will not set a calorie target for you. Please talk with a clinician about food. You can still log meals.").font(.fh_subheadline).foregroundStyle(Color.amber)
                Text("Eaten today: \(eaten) kcal").font(.fh_title3_b)
            } else if let p = plan {
                let target = Int((p.kcal / 10).rounded()) * 10
                HStack(spacing: 18) {
                    ring(target)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(target.formatted()) kcal/day").font(.fh_title2_b).foregroundStyle(Color.ink)
                        Text(goalText).font(.fh_subheadline).foregroundStyle(Color.muted)
                        Text("Eaten \(eaten.formatted())  Left \(max(0, target - eaten).formatted())").font(.fh_caption_b).foregroundStyle(Color.sage)
                    }
                }
                if p.raised { Text("Your target is held at the lowest safe level for you. Going lower needs a clinician.").font(.fh_caption).foregroundStyle(Color.amber) }
                else if abs(p.weeklyKg) > 0.01 { Text(String(format: "About %.2f kg a week, a healthy pace.", abs(p.weeklyKg))).font(.fh_caption).foregroundStyle(Color.muted) }
                Button("Change my numbers") { setup = true }.font(.fh_subheadline_b).foregroundStyle(Color.sage)
            } else {
                Text("Get your daily calories").font(.fh_title3_b)
                Text("Add your weight, height, age and goal once. Fit Hard works out your own daily number.").font(.fh_subheadline).foregroundStyle(Color.muted)
                BigButton(title: "Set my daily target", icon: "flame") { setup = true }.accessibilityIdentifier("diet-setup")
                Text("Eaten today: \(eaten) kcal").font(.fh_caption_b).foregroundStyle(Color.sage)
            }
        }
    }

    func ring(_ target: Int) -> some View {
        let f = target > 0 ? min(1, Double(eaten) / Double(target)) : 0
        return ZStack {
            Circle().stroke(Color.tint, lineWidth: 14)
            Circle().trim(from: 0, to: f).stroke(eaten > target ? Color.amber : Color.sage, style: StrokeStyle(lineWidth: 14, lineCap: .round)).rotationEffect(.degrees(-90))
            VStack(spacing: 0) { Text("\(Int((f * 100).rounded()))%").font(.fh_title3_b).foregroundStyle(Color.ink); Text("today").font(.fh_caption).foregroundStyle(Color.muted) }
        }.frame(width: 96, height: 96)
    }

    var mealsCard: some View {
        Card {
            SectionTitle(text: "Today")
            let all = store.foodEntries(store.today)
            if all.isEmpty { Text("Nothing logged yet. Snap your first meal.").font(.fh_subheadline).foregroundStyle(Color.muted) }
            ForEach(DietMeals.all, id: \.self) { m in
                let rows = all.filter { $0.meal == m }
                if !rows.isEmpty {
                    HStack { Text(DietMeals.label(m)).font(.fh_subheadline_b); Spacer(); Text("\(rows.reduce(0) { $0 + $1.kcal }) kcal").font(.fh_caption_b).foregroundStyle(Color.sage) }
                    ForEach(rows) { r in
                        HStack {
                            Text(r.name + (r.photo ? ", estimate" : "")).font(.fh_subheadline)
                            Spacer()
                            Text("\(r.kcal)").font(.fh_subheadline).foregroundStyle(Color.muted)
                            Button { store.s.foodLog.removeAll { $0.id == r.id } } label: { BrandIcon("xmark").foregroundStyle(Color.muted) }.accessibilityLabel("Remove")
                        }
                    }
                }
            }
            if !all.isEmpty { HStack { Text("Total").font(.fh_headline); Spacer(); Text("\(eaten.formatted()) kcal").font(.fh_headline) } }
        }
    }

    var quickRow: some View {
        Card {
            HStack(spacing: 8) {
                Chip(label: "Water 250 ml", icon: "drop", on: false) { store.s.water[store.today, default: 0] += 250 }
                Chip(label: adding ? "Close list" : "Quick snack", icon: "plus", on: adding) { adding.toggle() }
            }
            Text("Water today: \(store.s.water[store.today] ?? 0) ml").font(.fh_caption).foregroundStyle(Color.muted)
            if adding {
                TextField("Search a food", text: $addQuery).textFieldStyle(.roundedBorder)
                Flow { ForEach(FoodDB.search(addQuery).prefix(12)) { f in Chip(label: "\(f.n) \(FoodDB.kcal(f, grams: f.g))", on: false) { store.addFood(f.n, kcal: FoodDB.kcal(f, grams: f.g), grams: f.g, meal: "snack", photo: false) } } }
            }
        }
    }

    var chartCard: some View {
        let days = store.last7()
        let logged = days.filter { $0.kcal > 0 }
        let avg = logged.isEmpty ? 0 : logged.reduce(0) { $0 + $1.kcal } / logged.count
        let target = plan.map { Int(($0.kcal / 10).rounded()) * 10 }
        return Card {
            HStack { SectionTitle(text: "Last 7 days"); Spacer(); Text("Average \(avg.formatted()) kcal").font(.fh_caption_b).foregroundStyle(Color.sage) }
            Chart {
                ForEach(days) { d in
                    BarMark(x: .value("Day", d.label), y: .value("kcal", d.kcal)).foregroundStyle(d.day == store.today ? Color.sage : Color.mist).cornerRadius(6)
                }
                if let t = target { RuleMark(y: .value("Target", t)).lineStyle(StrokeStyle(lineWidth: 1, dash: [4])).foregroundStyle(Color.ink) }
            }.frame(height: 180)
            if target != nil { Text("The dashed line is your daily target. Today is the dark bar.").font(.fh_caption).foregroundStyle(Color.muted) }
        }
    }
}

// MARK: Home screen entry: one tap to the camera
struct DietEntryCard: View {
    @EnvironmentObject var store: Store
    @State private var snap = false
    @State private var open = false
    var body: some View {
        Card {
            HStack {
                SectionTitle(text: "Food and calories")
                Spacer()
                if let p = NutritionService.plan(store.s.profile), NutritionService.targetsAllowed(store.s.profile) {
                    Text("\(store.foodKcal(store.today)) of \((Int((p.kcal / 10).rounded()) * 10).formatted()) kcal").font(.fh_caption_b).foregroundStyle(Color.sage)
                }
            }
            HStack(spacing: 10) {
                Button { snap = true } label: {
                    HStack { BrandIcon("camera"); Text("Snap food").fontWeight(.bold) }.frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.sage, in: Capsule()).foregroundStyle(Color.white)
                }.accessibilityIdentifier("home-snap-food")
                Button { open = true } label: {
                    HStack { BrandIcon("flame"); Text("My day").fontWeight(.bold) }.frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.tint, in: Capsule()).foregroundStyle(Color.ink)
                }.accessibilityIdentifier("home-diet")
            }
        }
        .fullScreenCover(isPresented: $snap) { FoodSnapView().environmentObject(store).tint(Color.sage) }
        .fullScreenCover(isPresented: $open) { DietView().environmentObject(store).tint(Color.sage) }
    }
}
