import SwiftUI

struct FoodView: View {
    @EnvironmentObject var store: Store
    @State private var mode = 0
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $mode) { Text("Plan").tag(0); Text("Recipes").tag(1); Text("Groceries").tag(2) }
                    .pickerStyle(.segmented).padding(16)
                switch mode { case 0: PlanView(); case 1: RecipesView(); default: GroceriesView() }
            }.background(Color.cream).navigationTitle("Food")
        }
    }
}

struct PlanView: View {
    @EnvironmentObject var store: Store
    var days: [Date] { (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: Date()) } }
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ForEach(days, id: \.self) { d in
                    let k = dayKey(d)
                    Card {
                        Text(d.formatted(.dateTime.weekday(.wide).day().month())).font(.headline)
                        ForEach(Lists.meals, id: \.self) { m in
                            if let r = store.s.plan[k]?[m].flatMap({ store.cat.recipe($0) }) {
                                HStack {
                                    NavigationLink { RecipeDetail(recipe: r) } label: {
                                        VStack(alignment: .leading) { Text(m.capitalized).font(.caption).foregroundStyle(Color.muted); Text(r.name).font(.subheadline.weight(.semibold)).multilineTextAlignment(.leading) }
                                    }.foregroundStyle(Color.ink)
                                    Spacer()
                                    Button { store.swap(day: k, meal: m) } label: { Image(systemName: "arrow.triangle.2.circlepath") }.foregroundStyle(Color.sage).padding(8)
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

struct RecipesView: View {
    @EnvironmentObject var store: Store
    @State private var q = ""
    @State private var meal = "all"
    @State private var quick = false
    var list: [Recipe] {
        let base = meal == "all" ? store.cat.recipes.filter { r in
            !r.allergens.contains(where: { store.s.profile.allergens.contains($0) }) && !(store.s.profile.vegetarian && r.meat)
        } : store.recipes(for: meal)
        return base.filter { (q.isEmpty || $0.name.localizedCaseInsensitiveContains(q) || $0.cuisines.joined(separator: " ").localizedCaseInsensitiveContains(q)) && (!quick || $0.minutes <= 20) }
    }
    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                ForEach(["all", "breakfast", "lunch", "dinner"], id: \.self) { m in Chip(label: m.capitalized, on: meal == m) { meal = m } }
                Chip(label: "20 min", icon: "bolt", on: quick) { quick.toggle() }
            }.padding(.horizontal, 16)
            List(list.prefix(300)) { r in
                NavigationLink { RecipeDetail(recipe: r) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).font(.subheadline.weight(.semibold))
                        Text("\(r.meal.capitalized) · \(r.minutes) min · \(r.kcal) kcal").font(.caption).foregroundStyle(Color.muted)
                    }
                }.listRowBackground(Color.surface)
            }.listStyle(.plain).scrollContentBackground(.hidden)
        }.searchable(text: $q, prompt: "Search \(store.cat.recipes.count) recipes")
    }
}

struct RecipeDetail: View {
    @EnvironmentObject var store: Store
    let recipe: Recipe
    @State private var picked = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Label("\(recipe.minutes) min", systemImage: "clock"); Label("\(recipe.kcal) kcal", systemImage: "flame"); Label("\(recipe.servings)", systemImage: "person.2")
                }.font(.subheadline).foregroundStyle(Color.muted)
                if !recipe.allergens.isEmpty { Text("Contains: " + recipe.allergens.joined(separator: ", ")).font(.caption).foregroundStyle(Color.amber) }
                Card { SectionTitle(text: "Ingredients"); ForEach(Array(recipe.ingredients.enumerated()), id: \.offset) { _, i in
                    Text("• \(i.name.capitalized), \(i.qty.formatted()) \(i.unit)") } }
                Card { SectionTitle(text: "Steps"); ForEach(Array(recipe.steps.enumerated()), id: \.offset) { n, s in
                    HStack(alignment: .top) { Text("\(n + 1)").bold().frame(width: 26, height: 26).background(Color.tint, in: Circle()); Text(s) } } }
                BigButton(title: picked ? "Added to today" : "Use for today's \(recipe.meal)", icon: picked ? "checkmark" : "plus") {
                    store.setMeal(day: store.today, meal: recipe.meal, recipe: recipe); picked = true; store.say("Added to today")
                }
            }.padding(16)
        }.background(Color.cream).navigationTitle(recipe.name).navigationBarTitleDisplayMode(.inline)
    }
}

struct GroceriesView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let g = store.groceries()
        List {
            ForEach(g, id: \.category) { sec in
                Section(sec.category) {
                    ForEach(sec.items, id: \.key) { it in
                        let on = store.s.groceryChecked.contains(it.key)
                        Button {
                            if on { store.s.groceryChecked.removeAll { $0 == it.key } } else { store.s.groceryChecked.append(it.key); haptic(.soft) }
                        } label: { HStack { Image(systemName: on ? "checkmark.circle.fill" : "circle").foregroundStyle(Color.sage); Text(it.label).strikethrough(on).foregroundStyle(Color.ink) } }
                    }
                }
            }
        }.scrollContentBackground(.hidden)
    }
}
