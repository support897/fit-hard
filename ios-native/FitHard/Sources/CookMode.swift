import SwiftUI

/// Cook mode: one step at a time in big type, a timer when the step names a time, and a servings scaler.
struct CookMode: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    let recipe: Recipe
    @State private var step = -1            // -1 = ingredients
    @State private var servings = 1
    @State private var timerEnd: Date? = nil

    static func minutes(in text: String) -> Int? {
        guard let re = try? NSRegularExpression(pattern: "(\\d+)\\s*(?:to|-)?\\s*(\\d+)?\\s*(?:minutes|minute|mins|min)\\b", options: [.caseInsensitive]) else { return nil }
        let ns = text as NSString
        guard let m = re.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let a = Int(ns.substring(with: m.range(at: 1))) ?? 0
        var b = a
        if m.range(at: 2).location != NSNotFound { b = Int(ns.substring(with: m.range(at: 2))) ?? a }
        return max(a, b)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(recipe.name).font(.fh_headline).lineLimit(1)
                Spacer()
                Button { dismiss() } label: { BrandIcon("xmark").frame(width: 44, height: 44) }.accessibilityLabel("Close cook mode").accessibilityIdentifier("cook-close")
            }.padding(.horizontal, 16).padding(.top, 8)
            ScrollView { VStack(alignment: .leading, spacing: 18) { content }.padding(24).frame(maxWidth: .infinity, alignment: .leading) }
            HStack(spacing: 12) {
                if step >= 0 { BigButton(title: "Back", filled: false) { step -= 1; timerEnd = nil }.frame(width: 120) }
                if step < recipe.steps.count - 1 { BigButton(title: step < 0 ? "Start cooking" : "Next step") { step += 1; timerEnd = nil }.accessibilityIdentifier("cook-next") }
                else { BigButton(title: "Done", icon: "checkmark") { dismiss() }.accessibilityIdentifier("cook-done") }
            }.padding(.horizontal, 24).padding(.bottom, 16)
        }.background(Color.cream.ignoresSafeArea()).foregroundStyle(Color.ink)
    }

    @ViewBuilder var content: some View {
        if step < 0 {
            Text("Ingredients").font(.fh_title2)
            Stepper("Servings: \(servings)", value: $servings, in: 1...12).font(.fh_headline)
            let lines = RecipeService.perServing(recipe).map { Ingredient(name: $0.name, qty: $0.qty * Double(servings), unit: $0.unit, category: $0.category) }
            ForEach(Array(lines.enumerated()), id: \.offset) { _, l in
                Text("\(l.name.capitalized), \(RecipeService.fmt(l.qty)) \(l.unit)").font(.fh_title3)
            }
        } else {
            Text("Step \(step + 1) of \(recipe.steps.count)").font(.fh_subheadline_b).foregroundStyle(Color.muted)
            Text(recipe.steps[step]).font(.fh_title3).fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("cook-step")
            if let mins = CookMode.minutes(in: recipe.steps[step]) { timer(mins) }
        }
    }

    @ViewBuilder func timer(_ mins: Int) -> some View {
        if let end = timerEnd {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let left = max(0, Int(end.timeIntervalSince(ctx.date)))
                Text(left == 0 ? "Time is up" : String(format: "%d:%02d", left / 60, left % 60)).font(.zilla(44, bold: true)).foregroundStyle(Color.sage)
            }
            BigButton(title: "Stop timer", filled: false) { timerEnd = nil }
        } else {
            BigButton(title: "Start \(mins) min timer", icon: "clock", filled: false) { timerEnd = Date().addingTimeInterval(Double(mins) * 60) }.accessibilityIdentifier("cook-timer")
        }
    }
}

/// Portion buttons for logging a meal lightly: a quarter, half, three quarters or all of it.
struct PortionBar: View {
    @EnvironmentObject var store: Store
    let meal: String
    static let options: [(Double, String)] = [(0.25, "A little"), (0.5, "Half"), (0.75, "Most"), (1.0, "All")]
    var body: some View {
        let cur = store.portion(meal)
        HStack(spacing: 8) {
            ForEach(PortionBar.options, id: \.0) { o in
                Chip(label: o.1, on: cur == o.0) { store.logPortion(meal, o.0) }
            }
        }
    }
}
