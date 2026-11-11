import SwiftUI

struct MealsView: View {
    @EnvironmentObject var store: Store
    @State private var section = "plan"
    @State private var menu = false
    static let sections: [(String, String, String)] = [("plan", "My Meal Plan", "calendar"), ("breakfast", "Breakfast", "sunrise"), ("lunch", "Lunch", "sun.max"), ("dinner", "Dinner", "moon.stars"),
        ("snacks", "Snacks", "carrot"), ("mine", "My Recipes", "heart"), ("have", "Ingredients I Have", "refrigerator"), ("shop", "Shopping List", "cart"), ("nutrition", "Nutrition Overview", "chart.pie")]
    var titleText: String { NSLocalizedString(MealsView.sections.first { $0.0 == section }?.1 ?? "Meals", comment: "") }
    var body: some View {
        NavigationStack {
            ZStack(alignment: .leading) {
                Group {
                    switch section {
                    case "plan": PlanSection()
                    case "breakfast", "lunch", "dinner": RecipeList(meal: section)
                    case "snacks": SnacksSection()
                    case "mine": MyRecipes()
                    case "have": HaveSection()
                    case "shop": ShopSection()
                    default: NutritionOverview()
                    }
                }.background(Color.cream)
                if menu {
                    Color.black.opacity(0.35).ignoresSafeArea().onTapGesture { withAnimation { menu = false } }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Meals").font(.fh_title2_b).padding(.bottom, 8)
                        ForEach(MealsView.sections, id: \.0) { s in
                            Button { section = s.0; withAnimation { menu = false } } label: {
                                BrandLabel(s.1, icon: s.2).font(.fh_headline).padding(12).frame(maxWidth: .infinity, alignment: .leading)
                                    .background(section == s.0 ? Color.tint : Color.clear, in: RoundedRectangle(cornerRadius: 12))
                            }.buttonStyle(.plain).accessibilityIdentifier("menu-\(s.0)")
                        }
                        Spacer()
                    }.padding(20).frame(width: 290).frame(maxHeight: .infinity).background(Color.surface.ignoresSafeArea()).foregroundStyle(Color.ink)
                    .transition(.move(edge: .leading))
                }
            }
            .navigationTitle(titleText).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarLeading) {
                Button { withAnimation { menu.toggle() } } label: { BrandIcon( "line.3.horizontal").frame(width: 44, height: 44) }
                    .accessibilityLabel("Meals menu").accessibilityIdentifier("meals-menu-button") } }
        }
    }
}

struct MealLine: View {
    @EnvironmentObject var store: Store
    let r: Recipe
    var body: some View { Text(store.line(r)).font(.fh_caption).foregroundStyle(Color.muted) }
}

struct PlanSection: View {
    @EnvironmentObject var store: Store
    var days: [Date] { (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: Date()) } }
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                WallyBubble()
                if let t = store.targets {
                    Card { HStack { VStack(alignment: .leading) { Text("Your daily target").font(.fh_caption).foregroundStyle(Color.muted)
                        Text(String(format: NSLocalizedString("%lld kcal · %lld g protein", comment: ""), t.kcal, t.protein)).font(.fh_headline).accessibilityIdentifier("target-line") }; Spacer() } }
                }
                ForEach(days, id: \.self) { d in
                    let k = dayKey(d)
                    Card {
                        Text(d.formatted(.dateTime.weekday(.wide).day().month())).font(.fh_headline)
                        ForEach(Lists.meals, id: \.self) { m in
                            if let r = store.s.plan[k]?[m].flatMap({ store.cat.recipe($0) }) {
                                HStack {
                                    NavigationLink { RecipeDetail(recipe: r) } label: {
                                        VStack(alignment: .leading, spacing: 2) { HStack(spacing: 4) { BrandIcon("m-" + m).foregroundStyle(Color.tone("meal." + m)); Text(NSLocalizedString(MealKind(rawValue: m)?.label ?? m.capitalized, comment: "")).font(.fh_caption).foregroundStyle(Color.muted) }; Text(r.name).font(.fh_subheadline_b).multilineTextAlignment(.leading); MealLine(r: r); Text(NSLocalizedString("Why: ", comment: "") + (store.whyThisMeal(r, meal: m, day: k).first ?? "")).font(.fh_caption).foregroundStyle(Color.muted).multilineTextAlignment(.leading) }
                                    }.foregroundStyle(Color.ink)
                                    Spacer()
                                    WatchReelButton(recipe: r)
                                    Button { store.swap(day: k, meal: m); store.say(String(format: NSLocalizedString("Swapped %@", comment: ""), NSLocalizedString(MealKind(rawValue: m)?.label ?? m, comment: ""))) } label: { BrandIcon( "arrow.triangle.2.circlepath").frame(width: 44, height: 44) }
                                        .foregroundStyle(Color.sage).accessibilityLabel("Swap \(m)").accessibilityIdentifier("swap-\(k)-\(m)")
                                }
                            }
                        }
                    }
                }
                BigButton(title: "Rebuild this week", icon: "sparkles", filled: false) { store.s.plan = [:]; store.generatePlan(); store.say("New plan ready") }
            }.padding(16)
        }
    }
}

struct RecipeList: View {
    @EnvironmentObject var store: Store
    let meal: String
    @State private var q = ""
    var list: [Recipe] {
        store.cat.recipes.filter { $0.meal == meal && RecipeService.allowed($0, store.s.profile) && (q.isEmpty || $0.name.localizedCaseInsensitiveContains(q)) }
    }
    var body: some View {
        List(list.prefix(300)) { r in
            NavigationLink { RecipeDetail(recipe: r) } label: {
                HStack { VStack(alignment: .leading, spacing: 2) { Text(r.name).font(.fh_subheadline_b); MealLine(r: r) }; Spacer(); WatchReelButton(recipe: r) }
            }.listRowBackground(Color.surface)
        }.listStyle(.plain).scrollContentBackground(.hidden).searchable(text: $q, prompt: "Search \(meal)")
    }
}

struct SnacksSection: View {
    @EnvironmentObject var store: Store
    @State private var name = ""; @State private var time = Date()
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                Text("There are no snack recipes in the library yet, so Fit Hard does not invent any. Add your own snack and it goes on your calendar.").font(.fh_subheadline).foregroundStyle(Color.muted)
                TextField("Snack name", text: $name).padding(12).background(Color.cream, in: RoundedRectangle(cornerRadius: 12))
                DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                BigButton(title: "Add to today", icon: "plus") {
                    let n = name.trimmingCharacters(in: .whitespaces); guard !n.isEmpty else { return }
                    if store.addEvent(CalEvent(title: n, day: store.today, time: timeString(time), minutes: 10, cat: "meals", kind: "snack")) { name = ""; store.say("Snack added") }
                }
            }
            let snacks = store.s.events.filter { $0.kind == "snack" }.sorted { $0.day > $1.day }
            ForEach(snacks) { e in Card { HStack { VStack(alignment: .leading) { Text(e.title).font(.fh_subheadline_b); Text("\(e.day) \(e.time)").font(.fh_caption).foregroundStyle(Color.muted) }
                Spacer(); Button { store.s.events.removeAll { $0.id == e.id } } label: { BrandIcon( "trash") }.foregroundStyle(Color.muted) } } }
        }.padding(16) }
    }
}

struct MyRecipes: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let list = store.s.favs.compactMap { store.cat.recipe($0) }
        if list.isEmpty {
            VStack(spacing: 10) { Spacer(); BundleImage(name: "wally-hello").frame(height: 100); Text("Tap the heart on any recipe to keep it here.").foregroundStyle(Color.muted).multilineTextAlignment(.center); Spacer() }.padding()
        } else {
            List(list) { r in NavigationLink { RecipeDetail(recipe: r) } label: { HStack { VStack(alignment: .leading) { Text(r.name).font(.fh_subheadline_b); MealLine(r: r) }; Spacer(); WatchReelButton(recipe: r) } }.listRowBackground(Color.surface) }
                .listStyle(.plain).scrollContentBackground(.hidden)
        }
    }
}

struct RecipeDetail: View {
    @EnvironmentObject var store: Store
    let recipe: Recipe
    @State private var picked = false
    @State private var cooking = false
    var body: some View {
        let lines = RecipeService.lines(for: RecipeService.perServing(recipe), inventory: store.s.inventory)
        let fav = store.s.favs.contains(recipe.id)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) { BrandLabel("\(recipe.minutes) min", icon: "clock"); BrandLabel("\(recipe.kcal) kcal", icon: "flame")
                    if let m = RecipeService.macros(recipe) { BrandLabel(String(format: NSLocalizedString("%lld g protein", comment: ""), m.p), icon: "bolt.heart") } }.font(.fh_subheadline).foregroundStyle(Color.muted)
                if let m = RecipeService.macros(recipe) { Text(String(format: NSLocalizedString("Per serving. Carbs %lld g, fat %lld g. Estimated from ingredient reference values.", comment: ""), m.c, m.f)).font(.fh_caption).foregroundStyle(Color.muted) }
                else { Text("Protein is not available for this recipe.").font(.fh_caption).foregroundStyle(Color.muted) }
                if !recipe.allergens.isEmpty { Text(NSLocalizedString("Contains: ", comment: "") + recipe.allergens.map { allergenName($0) }.joined(separator: ", ")).font(.fh_caption).foregroundStyle(Color.amber) }
                Card {
                    SectionTitle(text: "Why this meal")
                    ForEach(Array(store.whyThisMeal(recipe, meal: recipe.meal).enumerated()), id: \.offset) { _, line in
                        HStack(alignment: .top, spacing: 8) { BrandIcon("checkmark").foregroundStyle(Color.sage); Text(line).font(.fh_subheadline) }
                    }
                }.accessibilityIdentifier("why-this-meal")
                WatchReelButton(recipe: recipe, big: true)
                BigButton(title: "Cook mode", icon: "flame", filled: false) { cooking = true }.accessibilityIdentifier("cook-mode")
                if store.s.plan[store.today]?[recipe.meal] == recipe.id {
                    Card { SectionTitle(text: "Log it lightly"); PortionBar(meal: recipe.meal) }
                }
                Card {
                    SectionTitle(text: "Ingredients for one serving")
                    ForEach(lines) { l in
                        HStack { BrandIcon( l.buy <= 0.001 ? "checkmark.circle.fill" : "cart").foregroundStyle(l.buy <= 0.001 ? Color.sage : Color.amber)
                            Text("\(l.name.capitalized), \(RecipeService.fmt(l.need)) \(unitName(l.unit))").font(.fh_subheadline); Spacer()
                            Text(l.buy <= 0.001 ? NSLocalizedString("Have", comment: "") : String(format: NSLocalizedString("Buy %@ %@", comment: ""), RecipeService.fmt(l.buy), unitName(l.unit))).font(.fh_caption_b).foregroundStyle(l.buy <= 0.001 ? Color.sage : Color.amber) }
                    }
                }
                Card { SectionTitle(text: "Steps"); ForEach(Array(recipe.steps.enumerated()), id: \.offset) { n, s in
                    HStack(alignment: .top) { Text("\(n + 1)").bold().frame(width: 26, height: 26).background(Color.tint, in: Circle()); Text(s) } } }
                BigButton(title: picked ? NSLocalizedString("Added to today", comment: "") : String(format: NSLocalizedString("Use for today's %@", comment: ""), (MealKind(rawValue: recipe.meal)?.label ?? recipe.meal).lowercased()), icon: picked ? "checkmark" : "plus") {
                    store.setMeal(day: store.today, meal: recipe.meal, recipe: recipe); picked = true; store.say("Added to today")
                }
            }.padding(16)
        }.background(Color.cream).navigationTitle(recipe.name).navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $cooking) { CookMode(recipe: recipe).environmentObject(store) }
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) {
            Button { if fav { store.s.favs.removeAll { $0 == recipe.id } } else { store.s.favs.append(recipe.id) }; haptic() } label: { BrandIcon( fav ? "heart.fill" : "heart") }.accessibilityLabel("Keep recipe") } }
    }
}

struct HaveSection: View {
    @EnvironmentObject var store: Store
    @State private var name = ""; @State private var qty = ""; @State private var unit = "g"; @State private var hasExp = false; @State private var exp = Date()
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                SectionTitle(text: "Add what you have")
                Flow { ForEach(store.cat.ingredients.common, id: \.self) { n in
                    Chip(label: n.capitalized, on: store.s.inventory.contains { RecipeService.norm($0.name) == RecipeService.norm(n) }) { name = n } } }
                TextField("Ingredient", text: $name).textInputAutocapitalization(.never).padding(12).background(Color.cream, in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("inv-name")
                HStack { TextField("Amount", text: $qty).keyboardType(.decimalPad).padding(12).background(Color.cream, in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("inv-qty")
                    Picker("Unit", selection: $unit) { ForEach(["g", "ml", "pcs", "tbsp", "tsp", "cloves", "slices"], id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu) }
                Toggle("Has an expiry date", isOn: $hasExp).tint(Color.sage)
                if hasExp { DatePicker("Expires", selection: $exp, displayedComponents: .date) }
                BigButton(title: "Add", icon: "plus") {
                    let n = name.trimmingCharacters(in: .whitespaces).lowercased(); let q = Double(qty.replacingOccurrences(of: ",", with: ".")) ?? 0
                    guard !n.isEmpty, q > 0 else { store.say("Add a name and an amount"); return }
                    store.s.inventory.append(InvItem(name: n, qty: q, unit: unit, expiry: hasExp ? dayKey(exp) : nil)); name = ""; qty = ""; hasExp = false; store.say("Added")
                }.accessibilityIdentifier("inv-add")
            }
            Card {
                SectionTitle(text: "In your kitchen")
                if store.s.inventory.isEmpty { Text("Nothing yet. Add a few things and shopping gets shorter.").foregroundStyle(Color.muted) }
                ForEach($store.s.inventory) { $it in
                    HStack {
                        VStack(alignment: .leading) { Text(it.name.capitalized).font(.fh_subheadline_b); if let e = it.expiry { Text(String(format: NSLocalizedString("Use by %@", comment: ""), e)).font(.fh_caption).foregroundStyle(Color.muted) } }
                        Spacer()
                        Stepper("\(RecipeService.fmt(it.qty)) \(unitName(it.unit))", value: $it.qty, in: 0...5000, step: it.unit == "g" || it.unit == "ml" ? 50 : 1).fixedSize()
                        Button { store.s.inventory.removeAll { $0.id == it.id } } label: { BrandIcon( "trash").frame(width: 36, height: 36) }.foregroundStyle(Color.muted)
                    }
                }
            }
        }.padding(16) }
    }
}

struct ShopSection: View {
    @EnvironmentObject var store: Store
    @State private var name = ""; @State private var qty = "1"; @State private var unit = "pcs"
    var body: some View {
        let lines = store.shoppingLines().filter { !store.s.shopRemoved.contains($0.id) }
        let toBuy = lines.filter { $0.buy > 0.001 }
        let have = lines.filter { $0.buy <= 0.001 }
        let cats = Dictionary(grouping: toBuy, by: { $0.cat }).keys.sorted()
        List {
            Section { Text(String(format: NSLocalizedString("%lld to buy for the next 7 days. Items you already have are left out.", comment: ""), toBuy.count)).font(.fh_footnote).foregroundStyle(Color.muted) }.listRowBackground(Color.clear)
            ForEach(cats, id: \.self) { c in
                Section(c) {
                    ForEach(toBuy.filter { $0.cat == c }) { l in
                        let on = store.s.groceryChecked.contains(l.id)
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Button { if on { store.s.groceryChecked.removeAll { $0 == l.id } } else { store.s.groceryChecked.append(l.id); haptic(.soft) } } label: {
                                    BrandIcon( on ? "checkmark.circle.fill" : "circle").font(.fh_title3).foregroundStyle(Color.sage).frame(width: 44, height: 36) }
                                VStack(alignment: .leading) {
                                    Text(l.name.capitalized).font(.fh_subheadline_b).strikethrough(on)
                                    Text(String(format: NSLocalizedString("Need %@, have %@ %@", comment: ""), RecipeService.fmt(l.need), RecipeService.fmt(l.have), unitName(l.unit))).font(.fh_caption).foregroundStyle(Color.muted)
                                }
                                Spacer()
                                Text(String(format: NSLocalizedString("Buy %@ %@", comment: ""), RecipeService.fmt(store.buyQty(l)), unitName(l.unit))).font(.fh_caption_b)
                            }
                            HStack {
                                Stepper("Change amount", value: Binding(get: { store.buyQty(l) }, set: { store.s.shopQty[l.id] = $0 }), in: 0...5000, step: l.unit == "g" || l.unit == "ml" ? 50 : 1).labelsHidden()
                                Spacer()
                                Button("I have it") { store.markAvailable(l); haptic() }.font(.fh_caption_b).padding(.horizontal, 10).padding(.vertical, 6).background(Color.tint, in: Capsule())
                                Button { store.s.shopRemoved.append(l.id) } label: { BrandIcon( "trash").frame(width: 36, height: 30) }.foregroundStyle(Color.muted)
                            }
                        }.listRowBackground(Color.surface)
                    }
                }
            }
            if !store.s.shopExtra.isEmpty {
                Section("My own items") {
                    ForEach($store.s.shopExtra) { $it in
                        HStack { Button { it.done.toggle() } label: { BrandIcon( it.done ? "checkmark.circle.fill" : "circle").font(.fh_title3).foregroundStyle(Color.sage) }
                            Text("\(it.name.capitalized), \(RecipeService.fmt(it.qty)) \(unitName(it.unit))").strikethrough(it.done)
                            Spacer(); Button { store.s.shopExtra.removeAll { $0.id == it.id } } label: { BrandIcon( "trash") }.foregroundStyle(Color.muted) }
                    }.listRowBackground(Color.surface)
                }
            }
            Section("Add my own item") {
                TextField("Item", text: $name).accessibilityIdentifier("shop-name")
                HStack { TextField("Amount", text: $qty).keyboardType(.decimalPad)
                    Picker("Unit", selection: $unit) { ForEach(["pcs", "g", "ml", "tbsp"], id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu) }
                Button("Add to list") {
                    let n = name.trimmingCharacters(in: .whitespaces); guard !n.isEmpty else { return }
                    store.s.shopExtra.append(ShopItem(name: n, qty: Double(qty) ?? 1, unit: unit)); name = ""
                }.accessibilityIdentifier("shop-add")
            }.listRowBackground(Color.surface)
            if !have.isEmpty { Section("Already covered by your kitchen") { ForEach(have) { l in BrandLabel(l.name.capitalized, icon: "checkmark").font(.fh_subheadline).foregroundStyle(Color.muted) }.listRowBackground(Color.surface) } }
            if !store.s.shopRemoved.isEmpty { Section { Button("Bring back removed items") { store.s.shopRemoved = [] } }.listRowBackground(Color.surface) }
        }.scrollContentBackground(.hidden).accessibilityIdentifier("shop-list")
    }
}

struct NutritionOverview: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let t = store.targets; let e = store.eatenMacros
        ScrollView { VStack(spacing: 14) {
            WallyBubble()
            Card {
                SectionTitle(text: "Today")
                if let t = t {
                    bar("Calories", e.kcal, t.kcal, "kcal"); bar("Protein", e.p, t.protein, "g")
                    Text(String(format: NSLocalizedString("Carbs about %lld g and fat about %lld g make up the rest.", comment: ""), t.carbs, t.fat)).font(.fh_caption).foregroundStyle(Color.muted)
                } else if !NutritionService.targetsAllowed(store.s.profile) {
                    Text("Fit Hard does not set calorie targets for you. Please talk with a clinician about food. Your meals still work.").foregroundStyle(Color.muted)
                } else {
                    Text("Add your age, height and weight in your profile to see daily targets.").foregroundStyle(Color.muted)
                    Text(String(format: NSLocalizedString("Eaten so far: %lld kcal", comment: ""), e.kcal)).font(.fh_subheadline)
                }
            }
            Card { Text("Targets use the Mifflin St Jeor estimate with your activity level. Protein is kept between 1.4 and 2.0 g per kg. These are estimates, not medical advice. Recipe protein, carbs and fat are estimated from ingredient reference values, and a recipe is only shown with numbers when they agree with its calories.").font(.fh_caption).foregroundStyle(Color.muted) }
        }.padding(16) }
    }
    func bar(_ n: String, _ v: Int, _ g: Int, _ u: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(NSLocalizedString(n, comment: "")).font(.fh_subheadline_b); Spacer(); Text(String(format: NSLocalizedString("%lld of %lld %@", comment: ""), v, g, u)).font(.fh_caption).foregroundStyle(Color.muted) }
            ProgressView(value: min(1, Double(v) / Double(max(1, g)))).tint(Color.sage)
        }
    }
}

// MARK: Meal reels (build 33)

/// One step of a reel: the recipe's own words, and the library picture chosen for it.
struct ReelFrame: Equatable {
    let index: Int
    let text: String
    let picture: String
    let matched: Bool
    let verb: String
}

/// One library picture and the step verbs it stands for, in English and Spanish. A new picture later is one new entry here, nothing else changes.
struct ReelEntry {
    let kind: String
    let picture: String
    let verbs: [String]
}

enum ReelLibrary {
    static let entries: [ReelEntry] = [
        ReelEntry(kind: "washing", picture: "reel-wash", verbs: ["wash", "rinse", "lava", "enjuaga"]),
        ReelEntry(kind: "chopping", picture: "reel-chop", verbs: ["chop", "slice", "cut", "dice", "mince", "halve", "corta", "pica", "parte", "rebana", "trocea"]),
        ReelEntry(kind: "stirring", picture: "reel-stir", verbs: ["stir", "mix", "whisk", "fry", "scramble", "sear", "toss", "saute", "incorpora", "revuelve", "mezcla", "bate", "frie", "saltea", "sella"]),
        ReelEntry(kind: "serving", picture: "reel-serve", verbs: ["serve", "sirve"])
    ]
    static let stirPicture = "reel-stir"
    static let servePicture = "reel-serve"

    /// The leading verb of a step, lower case, accents removed.
    static func verb(_ step: String) -> String {
        let folded = step.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en"))
        let word = folded.lowercased().split(whereSeparator: { !$0.isLetter }).first.map(String.init)
        return word ?? ""
    }
    static func match(_ step: String) -> ReelEntry? {
        let v = verb(step)
        return entries.first { $0.verbs.contains(v) }
    }
    /// Every step of a recipe in order. No match: the serve picture for the last step, the stir picture for any other.
    static func frames(for steps: [String]) -> [ReelFrame] {
        steps.enumerated().map { i, s in
            if let e = match(s) { return ReelFrame(index: i, text: s, picture: e.picture, matched: true, verb: verb(s)) }
            return ReelFrame(index: i, text: s, picture: i == steps.count - 1 ? servePicture : stirPicture, matched: false, verb: verb(s))
        }
    }
    /// Verbs of steps that have no picture of their own yet.
    static func missingVerbs(in steps: [String]) -> [String] {
        frames(for: steps).filter { !$0.matched && !$0.verb.isEmpty }.map { $0.verb }
    }
    /// Seconds a step stays on screen, a little longer for longer words.
    static func duration(_ text: String) -> Double { min(7.0, max(3.5, 2.5 + Double(text.count) / 18.0)) }
}

/// Decoded once, so a moving picture never reloads from disk.
enum ReelImages {
    private static let cache = NSCache<NSString, UIImage>()
    static func image(_ name: String) -> UIImage? {
        if let c = cache.object(forKey: name as NSString) { return c }
        let p = Bundle.main.path(forResource: name, ofType: "webp", inDirectory: "media") ?? Bundle.main.path(forResource: name, ofType: "webp")
        guard let path = p, let ui = UIImage(contentsOfFile: path) else { return nil }
        cache.setObject(ui, forKey: name as NSString)
        return ui
    }
}

/// The Watch entry. Shows only when the recipe has steps.
struct WatchReelButton: View {
    let recipe: Recipe
    var big = false
    @State private var open = false
    @EnvironmentObject var store: Store
    var body: some View {
        if !recipe.steps.isEmpty {
            Group {
                if big {
                    BigButton(title: "Watch", icon: "play.fill", filled: true) { open = true }
                } else {
                    Button { open = true } label: {
                        HStack(spacing: 4) { BrandIcon("play.fill").frame(width: 14, height: 14); Text("Watch").font(.fh_caption_b) }
                            .padding(.horizontal, 12).frame(minHeight: 36)
                            .background(Color.sage, in: Capsule()).foregroundStyle(Color.surface)
                    }.buttonStyle(.borderless)
                }
            }
            .accessibilityIdentifier(big ? "watch-reel" : "watch-reel-\(recipe.id)")
            .fullScreenCover(isPresented: $open) { ReelPlayer(recipe: recipe) }
        }
    }
}

/// Full screen vertical reel. Every picture moves the whole time it is on screen: a slow zoom with a gentle drift, and a soft fade into the next one.
struct ReelPlayer: View {
    let recipe: Recipe
    @Environment(\.dismiss) var dismiss
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @State private var base: Double = 0
    @State private var anchor: Date? = Date()
    @State private var holding = false
    @State private var userPaused = false

    static let fade = 0.7
    static let cream = Color(red: 0.98, green: 0.93, blue: 0.84)
    static let ink = Color(red: 0.243, green: 0.184, blue: 0.149)

    var frames: [ReelFrame] { ReelLibrary.frames(for: recipe.steps) }
    var durations: [Double] { frames.map { ReelLibrary.duration($0.text) } }
    var total: Double { max(0.1, durations.reduce(0, +)) }
    func start(_ i: Int) -> Double { durations.prefix(i).reduce(0, +) }

    func position(_ now: Date) -> Double {
        let raw = anchor == nil ? base : base + now.timeIntervalSince(anchor!)
        return raw.truncatingRemainder(dividingBy: total)
    }
    func current(_ p: Double) -> (index: Int, local: Double) {
        let d = durations
        var acc = 0.0
        for i in 0..<d.count {
            if p < acc + d[i] { return (i, p - acc) }
            acc += d[i]
        }
        return (max(0, d.count - 1), d.last ?? 0)
    }
    var paused: Bool { userPaused || holding }
    func setPaused(_ on: Bool, now: Date = Date()) {
        if on, let a = anchor { base = (base + now.timeIntervalSince(a)).truncatingRemainder(dividingBy: total); anchor = nil }
        else if !on, anchor == nil { anchor = now }
    }
    func jump(to index: Int) {
        let n = frames.count
        let i = ((index % n) + n) % n
        base = start(i)
        anchor = paused ? nil : Date()
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ReelPlayer.cream.ignoresSafeArea()
                TimelineView(.animation(minimumInterval: nil, paused: anchor == nil)) { ctx in
                    stage(now: ctx.date, size: geo.size)
                }
                tapZones
                controls
            }
        }.background(ReelPlayer.cream.ignoresSafeArea()).statusBarHidden(true)
    }

    @ViewBuilder func stage(now: Date, size: CGSize) -> some View {
        let fr = frames
        if fr.isEmpty { Color.clear } else {
            let p = position(now)
            let cur = current(p)
            let d = durations[cur.index]
            let remaining = d - cur.local
            let f = remaining < ReelPlayer.fade ? 1 - remaining / ReelPlayer.fade : 0
            let nextIndex = (cur.index + 1) % fr.count
            ZStack {
                layer(fr[cur.index], local: cur.local, dur: d, size: size)
                if f > 0 { layer(fr[nextIndex], local: -remaining, dur: durations[nextIndex], size: size).opacity(f) }
                VStack(spacing: 0) {
                    HStack(spacing: 4) {
                        ForEach(0..<fr.count, id: \.self) { k in
                            let fill: Double = k < cur.index ? 1 : (k == cur.index ? min(1, max(0, cur.local / d)) : 0)
                            GeometryReader { g in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(ReelPlayer.ink.opacity(0.18))
                                    Capsule().fill(Color.sage).frame(width: g.size.width * fill)
                                }
                            }.frame(height: 4)
                        }
                    }.padding(.horizontal, 16).padding(.top, 10)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(String(format: NSLocalizedString("Step %lld of %lld", comment: ""), cur.index + 1, fr.count))
                        .accessibilityIdentifier("reel-progress")
                    Spacer()
                }
            }.frame(width: size.width, height: size.height)
        }
    }

    /// One step picture with its caption. `local` runs from -fade (fading in) up to the step length, and the zoom never stops over that whole span.
    func layer(_ fr: ReelFrame, local: Double, dur: Double, size: CGSize) -> some View {
        let prog = min(1, max(0, (local + ReelPlayer.fade) / (dur + ReelPlayer.fade)))
        let amp = reduceMotion ? 0.04 : 0.16
        let scale = 1.03 + amp * prog
        let drift = (reduceMotion ? 4.0 : 18.0) * (prog - 0.5) * (fr.index % 2 == 0 ? 1 : -1)
        return ZStack(alignment: .bottom) {
            if let ui = ReelImages.image(fr.picture) {
                Image(uiImage: ui).resizable().scaledToFill()
                    .frame(width: size.width, height: size.height).clipped()
                    .scaleEffect(scale).offset(x: drift, y: -drift / 2)
                    .frame(width: size.width, height: size.height).clipped()
            } else { ReelPlayer.cream }
            Text(verbatim: fr.text)
                .font(.fh_title3).multilineTextAlignment(.center).foregroundStyle(ReelPlayer.ink)
                .padding(.horizontal, 18).padding(.vertical, 14)
                .background(ReelPlayer.cream.opacity(0.88), in: RoundedRectangle(cornerRadius: 18))
                .padding(.horizontal, 20).padding(.bottom, 56)
                .accessibilityIdentifier("reel-caption")
        }.frame(width: size.width, height: size.height)
    }

    var tapZones: some View {
        HStack(spacing: 0) {
            zone(id: "reel-tap-back") { jump(to: current(position(Date())).index - 1) }
            zone(id: "reel-tap-next") { jump(to: current(position(Date())).index + 1) }
        }
    }
    func zone(id: String, tap: @escaping () -> Void) -> some View {
        Color.clear.contentShape(Rectangle())
            .onTapGesture(perform: tap)
            .onLongPressGesture(minimumDuration: 0.25, maximumDistance: 60, perform: {}, onPressingChanged: { down in holding = down; setPaused(userPaused || down) })
            .accessibilityLabel(LocalizedStringKey(id == "reel-tap-back" ? "Back" : "Next step"))
            .accessibilityIdentifier(id)
    }

    var controls: some View {
        VStack {
            Spacer()
            HStack {
                Button { userPaused.toggle(); setPaused(userPaused || holding) } label: {
                    BrandIcon(paused ? "play.fill" : "pause.fill").foregroundStyle(ReelPlayer.ink).frame(width: 26, height: 26)
                        .frame(width: 48, height: 48).background(ReelPlayer.cream.opacity(0.9), in: Circle())
                }.accessibilityLabel(LocalizedStringKey(paused ? "Resume" : "Pause")).accessibilityIdentifier("reel-pause")
                Spacer()
                Button { dismiss() } label: {
                    BrandIcon("xmark").foregroundStyle(ReelPlayer.ink).frame(width: 22, height: 22)
                        .frame(width: 48, height: 48).background(ReelPlayer.cream.opacity(0.9), in: Circle())
                }.accessibilityLabel("Close reel").accessibilityIdentifier("reel-close")
            }.padding(.horizontal, 16).padding(.bottom, 4)
        }
    }
}
