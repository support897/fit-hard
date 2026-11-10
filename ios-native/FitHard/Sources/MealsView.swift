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
                VStack(alignment: .leading, spacing: 2) { Text(r.name).font(.fh_subheadline_b); MealLine(r: r) }
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
            List(list) { r in NavigationLink { RecipeDetail(recipe: r) } label: { VStack(alignment: .leading) { Text(r.name).font(.fh_subheadline_b); MealLine(r: r) } }.listRowBackground(Color.surface) }
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
