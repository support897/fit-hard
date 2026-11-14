import SwiftUI
import UIKit
import CoreText

// MARK: Typefaces (spec: Zilla Slab for display, Karla for body)
enum FHFonts {
    static func register() {
        for n in ["Karla-Regular", "Karla-Bold", "ZillaSlab-SemiBold", "ZillaSlab-Bold"] {
            if let u = Bundle.main.url(forResource: n, withExtension: "ttf") { CTFontManagerRegisterFontsForURL(u as CFURL, .process, nil) }
        }
    }
}
extension Font {
    static func karla(_ size: CGFloat, bold: Bool = false, relativeTo s: Font.TextStyle = .body) -> Font {
        .custom(bold ? "Karla-Bold" : "Karla-Regular", size: size, relativeTo: s)
    }
    static func zilla(_ size: CGFloat, bold: Bool = false, relativeTo s: Font.TextStyle = .title) -> Font {
        .custom(bold ? "ZillaSlab-Bold" : "ZillaSlab-SemiBold", size: size, relativeTo: s)
    }
    static var fh_largeTitle: Font { zilla(34, bold: true, relativeTo: .largeTitle) }
    static var fh_largeTitle_b: Font { zilla(34, bold: true, relativeTo: .largeTitle) }
    static var fh_title: Font { zilla(28, bold: true, relativeTo: .title) }
    static var fh_title2: Font { zilla(22, bold: true, relativeTo: .title2) }
    static var fh_title3: Font { zilla(20, relativeTo: .title3) }
    static var fh_headline: Font { karla(17, bold: true, relativeTo: .headline) }
    static var fh_body: Font { karla(17, relativeTo: .body) }
    static var fh_callout: Font { karla(16, relativeTo: .callout) }
    static var fh_subheadline: Font { karla(15, relativeTo: .subheadline) }
    static var fh_footnote: Font { karla(13, relativeTo: .footnote) }
    static var fh_caption: Font { karla(12, relativeTo: .caption) }
    static var fh_caption2: Font { karla(11, relativeTo: .caption2) }
    static var fh_title_b: Font { zilla(28, bold: true, relativeTo: .title) }
    static var fh_title3_b: Font { zilla(20, bold: true, relativeTo: .title3) }
    static var fh_title2_b: Font { zilla(22, bold: true, relativeTo: .title2) }
    static var fh_subheadline_b: Font { karla(15, bold: true, relativeTo: .subheadline) }
    static var fh_footnote_b: Font { karla(13, bold: true, relativeTo: .footnote) }
    static var fh_caption_b: Font { karla(12, bold: true, relativeTo: .caption) }
    static var fh_caption2_b: Font { karla(11, bold: true, relativeTo: .caption2) }
}

// MARK: Training types and the two colour families (one source of truth)
enum TrainType: String, CaseIterable {
    case cardio, legs, upper, full, push, pull, core, mobility, rest
    var label: String { NSLocalizedString(english, comment: "") }
    private var english: String {
        switch self {
        case .cardio: return "Cardio"; case .legs: return "Legs"; case .upper: return "Upper body"; case .full: return "Full body"
        case .push: return "Push"; case .pull: return "Pull"; case .core: return "Core"; case .mobility: return "Mobility"; case .rest: return "Rest"
        }
    }
    var icon: String { "t-" + rawValue }
    var tone: String { "train." + rawValue }
    static func infer(name: String, kind: String? = nil) -> TrainType {
        if let k = kind, let t = TrainType(rawValue: k) { return t }
        let n = name.lowercased()
        if n.contains("cardio") { return .cardio }
        if n.contains("mobility") || n.contains("stretch") { return .mobility }
        if n.contains("rest") { return .rest }
        if n.contains("leg") || n.contains("lower") { return .legs }
        if n.contains("upper") { return .upper }
        if n.contains("push") { return .push }
        if n.contains("pull") { return .pull }
        if n.contains("core") { return .core }
        return .full
    }
}
enum MealKind: String, CaseIterable {
    case breakfast, lunch, dinner, snacks
    var label: String { NSLocalizedString(rawValue.capitalized, comment: "") }
    var icon: String { "m-" + rawValue }
    var tone: String { "meal." + rawValue }
}
extension Color {
    /// Light, dark hex pairs. Training colours and meal colours are separate families and never share a value.
    static let toneTable: [String: (UInt32, UInt32)] = [
        "train.legs": (0x2F7A44, 0x7BD389), "train.upper": (0x2A5FA8, 0x8DB8EE), "train.full": (0x0E7C86, 0x6FD3DB),
        "train.push": (0x4C46A8, 0xA9A4F0), "train.pull": (0x8A6A12, 0xE3C468), "train.core": (0x5A6B75, 0xB4C3CC),
        "train.cardio": (0xD4562A, 0xFF9A72), "train.mobility": (0x7B8F2A, 0xC6DB6B), "train.rest": (0x6A8FB0, 0xA9C6E0),
        "meal.breakfast": (0xC98A00, 0xFFC84D), "meal.lunch": (0xB8467A, 0xF28DB2), "meal.dinner": (0x9A3B2B, 0xE58A78), "meal.snacks": (0xC06DAB, 0xE9A6DA)
    ]
    static func tone(_ key: String) -> Color {
        let dark = Color.isDark
        if let t = toneTable[key] { return Color(hex: dark ? t.1 : t.0) }
        return Color.cat(key)
    }
}

// MARK: Brand icon set (drawn for Fit Hard, 24 unit grid, round strokes, one filled dot as the family mark)
struct IconShape: Shape {
    let d: String
    func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height), s = side / 24
        let ox = rect.midX - side / 2, oy = rect.midY - side / 2
        func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: ox + CGFloat(x) * s, y: oy + CGFloat(y) * s) }
        var spaced = ""
        for ch in d { if ch.isLetter { spaced += " \(ch) " } else { spaced.append(ch) } }
        let toks = spaced.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
        var p = Path(); var i = 0; var cmd = "M"; var cur = (0.0, 0.0)
        func num() -> Double { defer { i += 1 }; return i < toks.count ? (Double(toks[i]) ?? 0) : 0 }
        while i < toks.count {
            if let f = toks[i].first, f.isLetter { cmd = String(f); i += 1; if cmd == "Z" { p.closeSubpath(); continue } }
            switch cmd {
            case "M": let x = num(), y = num(); p.move(to: pt(x, y)); cur = (x, y); cmd = "L"
            case "L": let x = num(), y = num(); p.addLine(to: pt(x, y)); cur = (x, y)
            case "H": let x = num(); p.addLine(to: pt(x, cur.1)); cur.0 = x
            case "V": let y = num(); p.addLine(to: pt(cur.0, y)); cur.1 = y
            case "C": let a = num(), b = num(), c = num(), e = num(), x = num(), y = num()
                p.addCurve(to: pt(x, y), control1: pt(a, b), control2: pt(c, e)); cur = (x, y)
            case "O": let cx = num(), cy = num(), r = num()
                p.addEllipse(in: CGRect(x: ox + CGFloat(cx - r) * s, y: oy + CGFloat(cy - r) * s, width: CGFloat(2 * r) * s, height: CGFloat(2 * r) * s))
            default: i += 1
            }
        }
        return p
    }
}

enum Glyphs {
    struct G { let d: String; var dots = ""; var fill = false; var hi = "" }
    static let heart = "M12 20 C 5 15 3.5 11.5 3.5 8.8 C 3.5 6.5 5.3 5 7.4 5 C 9.4 5 11 6.2 12 8 C 13 6.2 14.6 5 16.6 5 C 18.7 5 20.5 6.5 20.5 8.8 C 20.5 11.5 19 15 12 20 Z"
    static let moon = "M18.5 14.5 C 17 15.4 15.5 15.8 14 15.8 C 9.8 15.8 6.7 12.6 6.7 8.6 C 6.7 7 7.2 5.5 8 4.3 C 5 5.5 3.5 8.2 3.5 11.3 C 3.5 16 7.2 19.7 11.8 19.7 C 15 19.7 17.6 17.7 18.5 14.5 Z"
    static let sun = "O 12 12 4 M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M18.7 5.3 L17 7 M7 17 L5.3 18.7"
    static let flame = "M12 3 C 13 7 18 9 18 14.5 C 18 18 15.3 20.5 12 20.5 C 8.7 20.5 6 18 6 14.5 C 6 12 7.3 10.5 8.5 9 C 9 10.5 9.7 11.2 10.5 11.5 C 10.5 8 11 5.5 12 3 Z"
    static let drop = "M12 3.5 C 12 3.5 5.5 11 5.5 15 C 5.5 18.6 8.4 21 12 21 C 15.6 21 18.5 18.6 18.5 15 C 18.5 11 12 3.5 12 3.5 Z"
    /// Plain figure outline used by every muscle zone mark (head is the one filled dot).
    static let front = "M7.5 6.8 H16.5 L15.5 14 H8.5 Z M7.5 6.8 L5.2 13.8 M16.5 6.8 L18.8 13.8 M8.6 14 L8.2 21.6 H10.6 L11.8 14 M15.4 14 L15.8 21.6 H13.4 L12.2 14"
    static let head = "O 12 3.4 1.9"
    static let star = "M12 3.5 L14.6 9 L20.5 9.7 L16.1 13.7 L17.3 19.5 L12 16.6 L6.7 19.5 L7.9 13.7 L3.5 9.7 L9.4 9 Z"
    static let table: [String: G] = [
        "circle": G(d: "O 12 12 9"),
        "plus": G(d: "M5 12 H19 M12 5 V19"),
        "minus.circle": G(d: "O 12 12 9 M8 12 H16"),
        "plus.circle.fill": G(d: "O 12 12 9 M12 8 V16 M8 12 H16", fill: true),
        "checkmark": G(d: "M5 12.5 L10 17.5 L19 7"),
        "checkmark.circle.fill": G(d: "O 12 12 9 M8 12.5 L11 15.5 L16.5 9", fill: true),
        "checkmark.seal.fill": G(d: "O 12 12 9 M8 12.5 L11 15.5 L16.5 9", dots: "O 12 3 0.01", fill: true),
        "checkmark.square.fill": G(d: "M5 5 H19 V19 H5 Z M8 12.5 L11 15.5 L16.5 9", fill: true),
        "square": G(d: "M5 5 H19 V19 H5 Z"),
        "xmark": G(d: "M6 6 L18 18 M18 6 L6 18"),
        "xmark.circle": G(d: "O 12 12 9 M9 9 L15 15 M15 9 L9 15"),
        "xmark.circle.fill": G(d: "O 12 12 9 M9 9 L15 15 M15 9 L9 15", fill: true),
        "chevron.right": G(d: "M9 5 L16 12 L9 19"), "chevron.left": G(d: "M15 5 L8 12 L15 19"),
        "play.fill": G(d: "M8 5 L19 12 L8 19 Z", fill: true),
        "pause.fill": G(d: "M7 5 H10.5 V19 H7 Z M13.5 5 H17 V19 H13.5 Z", fill: true),
        "trash": G(d: "M5 7 H19 M9 7 V4.5 H15 V7 M7 7 L8 20 H16 L17 7", dots: "O 12 13.5 1.3"),
        "calendar": G(d: "M4 6 H20 V20 H4 Z M4 10 H20 M8 3.5 V7.5 M16 3.5 V7.5", dots: "O 12 15 1.4"),
        "calendar.badge.plus": G(d: "M4 6 H20 V20 H4 Z M4 10 H20 M8 3.5 V7.5 M16 3.5 V7.5 M12 12.5 V17.5 M9.5 15 H14.5"),
        "sun.max": G(d: sun), "sun.max.fill": G(d: sun, fill: true),
        "moon": G(d: moon), "moon.stars": G(d: moon, dots: "O 18 6 1.1 O 20 10 0.8"),
        "heart": G(d: heart), "heart.fill": G(d: heart, fill: true),
        "star.fill": G(d: star, fill: true),
        "flame": G(d: flame, dots: "O 12 16.5 1.3"), "calories": G(d: flame, dots: "O 12 16.5 1.3"),
        "drop": G(d: drop), "drop.fill": G(d: drop, fill: true),
        "fork.knife": G(d: "M7 3.5 V9 C 7 10.5 8 11.5 9.5 11.5 M12 3.5 V9 C 12 10.5 11 11.5 9.5 11.5 M9.5 3.5 V20.5 M17 20.5 V3.5 C 14.8 5 14 8 14 11 H17"),
        "dumbbell": G(d: "M3.5 9.5 V14.5 M6.5 7.5 V16.5 M17.5 7.5 V16.5 M20.5 9.5 V14.5 M6.5 12 H17.5"),
        "figure.strengthtraining.traditional": G(d: "M12 8 V14 M12 14 L9 20 M12 14 L15 20 M5 9 H19 M5 7.5 V10.5 M19 7.5 V10.5", dots: "O 12 4.6 1.8"),
        "figure.run": G(d: "M13 8.5 L10 11 L7 10.5 M13 8.5 L15 12 L18 13 M12.5 10.5 L12 14.5 L9 19.5 M12 14.5 L15.5 17 L16 20.5", dots: "O 15 4.5 1.8"),
        "pills": G(d: "M9.5 18.5 C 7 21 3.5 17.5 6 15 L15 6 C 17.5 3.5 21 7 18.5 9.5 Z M10.5 8.5 L15.5 13.5"),
        "cross.case": G(d: "M4 8 H20 V20 H4 Z M9 8 V5 H15 V8 M12 11.5 V16.5 M9.5 14 H14.5"),
        "chart.pie": G(d: "O 12 12 8.5 M12 3.5 V12 H20.5"),
        "chart.line.uptrend.xyaxis": G(d: "M3.5 18 L9 12 L13 15 L20.5 6.5 M15.5 6.5 H20.5 V11.5", dots: "O 9 12 1.1"),
        "bolt": G(d: "M13 3 L6 13.5 H11.5 L10.5 21 L18 10 H12.5 Z"),
        "bolt.heart": G(d: heart + " M12.5 8.5 L10.5 12 H13.5 L11.5 15.5"),
        "bell.slash": G(d: "M6.5 16.5 V11 C 6.5 8 8.7 5.5 12 5.5 C 15.3 5.5 17.5 8 17.5 11 V16.5 L19 18 H5 Z M10.5 20.5 H13.5 M4 4 L20 20"),
        "clock": G(d: "O 12 12 9 M12 7 V12 L15.5 14"),
        "cloud.rain": G(d: "M7 15 C 4.8 15 3.5 13.5 3.5 11.8 C 3.5 10 5 8.6 6.8 8.6 C 7.5 6 9.5 4.5 12 4.5 C 15 4.5 17 6.7 17.2 9.2 C 19.2 9.4 20.5 10.8 20.5 12.6 C 20.5 14.2 19.2 15 17.5 15 Z M8 18 L7 20.5 M12 18 L11 20.5 M16 18 L15 20.5"),
        "ellipsis": G(d: "", dots: "O 6 12 1.6 O 12 12 1.6 O 18 12 1.6"),
        "ellipsis.circle": G(d: "O 12 12 9", dots: "O 8 12 1.1 O 12 12 1.1 O 16 12 1.1"),
        "line.3.horizontal": G(d: "M4 7 H20 M4 12 H20 M4 17 H20"),
        "face.smiling": G(d: "O 12 12 9 M8.5 14 C 9.5 16.5 14.5 16.5 15.5 14", dots: "O 9 10 1 O 15 10 1"),
        "flag.checkered": G(d: "M6 3.5 V21 M6 5 H19 L16.5 9 L19 13 H6", dots: "O 11 9 1.2"),
        "person": G(d: "O 12 8 4 M4.5 20 C 5.5 14.5 18.5 14.5 19.5 20"),
        "person.crop.circle": G(d: "O 12 12 9 O 12 10 3 M6.5 18 C 8 15 16 15 17.5 18"),
        "arrow.uturn.backward": G(d: "M8.5 8 H15 C 17.8 8 19.5 10 19.5 12.5 C 19.5 15 17.8 17 15 17 H8 M11.5 4.5 L8 8 L11.5 11.5"),
        "arrow.triangle.2.circlepath": G(d: "M4.5 11 C 5 7 8 4.5 12 4.5 C 14.5 4.5 16.5 5.5 18 7.5 M18.5 3.5 V7.5 H14.5 M19.5 13 C 19 17 16 19.5 12 19.5 C 9.5 19.5 7.5 18.5 6 16.5 M5.5 20.5 V16.5 H9.5"),
        "arrow.right.circle": G(d: "O 12 12 9 M8 12 H16 M13 9 L16 12 L13 15"),
        "checklist": G(d: "M4 6.5 L5.5 8 L8 5 M10.5 6.5 H20 M4 12.5 L5.5 14 L8 11 M10.5 12.5 H20 M4 18.5 L5.5 20 L8 17 M10.5 18.5 H20"),
        "sparkles": G(d: "M11 4 L13 10 L19 12 L13 14 L11 20 L9 14 L3 12 L9 10 Z", dots: "O 19 5 1.2 O 19 19 1"),
        "g.circle": G(d: "O 12 12 9 M15.6 10 C 14.9 8.8 13.6 8.2 12.3 8.2 C 9.9 8.2 8.2 9.8 8.2 12 C 8.2 14.2 9.9 15.8 12.3 15.8 C 14.3 15.8 15.6 14.6 15.8 12.6 H12.4"),
        "scalemass": G(d: "M4.5 6.5 H19.5 V19.5 H4.5 Z M7.5 10.5 C 9 8.8 15 8.8 16.5 10.5", dots: "O 12 13.5 1.2"),
        "cart": G(d: "M3.5 5 H6 L8 15 H18 L20 8 H7", dots: "O 10 19 1.4 O 17 19 1.4"),
        // Build 32 additions: UI marks
        "mail": G(d: "M3.5 6 H20.5 V18 H3.5 Z M3.5 7.5 L12 13.5 L20.5 7.5", dots: "O 12 13.5 0.9"),
        "tracker": G(d: "M6.5 4.5 H17.5 V20.5 H6.5 Z M9.5 4.5 V3 H14.5 V4.5 M9.5 10 H14.5 M9.5 13.5 H14.5", dots: "O 11.8 17.3 1.1"),
        "footsteps": G(d: "M7 4 C 9 4 9.6 7 9 9.2 C 8.6 10.7 6.8 11 6 10 C 4.8 8.5 5.4 4 7 4 Z M7 12.5 H8.8 V14 H7 Z M15 9.5 C 17 9.5 17.6 12.5 17 14.7 C 16.6 16.2 14.8 16.5 14 15.5 C 12.8 14 13.4 9.5 15 9.5 Z M15 18 H16.8 V19.5 H15 Z"),
        "streak": G(d: flame, dots: "O 12 16.5 1.3"),
        "pencil": G(d: "M5 19 L6 15 L16 5 L19 8 L9 18 Z M14 7 L17 10"),
        // Muscle zones: a figure with the worked zone filled. Front figure for chest, shoulders, abs, arms, quads, neck. Back figure for the rest.
        "p-chest": G(d: Glyphs.front, dots: Glyphs.head, hi: "M8.6 7.6 H15.4 L15 10.6 H9 Z"),
        "p-shoulders": G(d: Glyphs.front, dots: Glyphs.head, hi: "M6.4 6.4 H9 V8.9 H6.2 Z M15 6.4 H17.6 L17.8 8.9 H15 Z"),
        "p-abdominals": G(d: Glyphs.front, dots: Glyphs.head, hi: "M9.4 11 H14.6 L14.2 14 H9.8 Z"),
        "p-biceps": G(d: Glyphs.front, dots: Glyphs.head, hi: "M5.4 8.8 L7.4 8.8 L6.9 11.8 L5 11.4 Z M18.6 8.8 L16.6 8.8 L17.1 11.8 L19 11.4 Z"),
        "p-forearms": G(d: Glyphs.front, dots: Glyphs.head, hi: "M4.8 12 L6.6 12.3 L5.8 15.2 L4.2 14.6 Z M19.2 12 L17.4 12.3 L18.2 15.2 L19.8 14.6 Z"),
        "p-quadriceps": G(d: Glyphs.front, dots: Glyphs.head, hi: "M8.7 14.6 L11.5 14.6 L11 19 L8.5 19 Z M15.3 14.6 L12.5 14.6 L13 19 L15.5 19 Z"),
        "p-adductors": G(d: Glyphs.front, dots: Glyphs.head, hi: "M11 14.6 H13 L12.6 18.2 H11.4 Z"),
        "p-abductors": G(d: Glyphs.front, dots: Glyphs.head, hi: "M7.4 13.4 L8.8 13.4 L8.6 17.4 L7.3 17.4 Z M16.6 13.4 L15.2 13.4 L15.4 17.4 L16.7 17.4 Z"),
        "p-neck": G(d: Glyphs.front, dots: Glyphs.head, hi: "M10.6 5 H13.4 V6.8 H10.6 Z"),
        "p-traps": G(d: Glyphs.front, dots: Glyphs.head, hi: "M9.6 5.4 H14.4 L16.4 7.6 H7.6 Z"),
        "p-lats": G(d: Glyphs.front, dots: Glyphs.head, hi: "M8.2 8.2 L10.8 9.2 L10.4 12.8 L8.8 12.6 Z M15.8 8.2 L13.2 9.2 L13.6 12.8 L15.2 12.6 Z"),
        "p-middleback": G(d: Glyphs.front, dots: Glyphs.head, hi: "M10.2 7.8 H13.8 V11.6 H10.2 Z"),
        "p-lowerback": G(d: Glyphs.front, dots: Glyphs.head, hi: "M9.4 11.8 H14.6 L14.2 14.2 H9.8 Z"),
        "p-triceps": G(d: Glyphs.front, dots: Glyphs.head, hi: "M5.2 8.8 L7.2 8.8 L7 12 L4.9 11.6 Z M18.8 8.8 L16.8 8.8 L17 12 L19.1 11.6 Z"),
        "p-glutes": G(d: Glyphs.front, dots: Glyphs.head, hi: "M8.6 14.2 H15.4 L14.8 17 H9.2 Z"),
        "p-hamstrings": G(d: Glyphs.front, dots: Glyphs.head, hi: "M8.7 17.2 H11.5 L11.3 20.2 H8.6 Z M15.3 17.2 H12.5 L12.7 20.2 H15.4 Z"),
        "p-calves": G(d: Glyphs.front, dots: Glyphs.head, hi: "M8.4 19.4 H10.9 L10.7 21.6 H8.2 Z M15.6 19.4 H13.1 L13.3 21.6 H15.8 Z"),
        // Tools
        "e-barbell": G(d: "M2.5 12 H21.5 M5 7.5 V16.5 M8 9 V15 M19 7.5 V16.5 M16 9 V15"),
        "e-ez": G(d: "M3 12 H8 L10 9.5 L14 14.5 L16 12 H21 M4.5 9 V15 M19.5 9 V15"),
        "e-dumbbell": G(d: "M3.5 9.5 V14.5 M6.5 7.5 V16.5 M17.5 7.5 V16.5 M20.5 9.5 V14.5 M6.5 12 H17.5"),
        "e-cable": G(d: "M4 3.5 H13 M13 3.5 V15 M7 3.5 V8 M5.5 8 H8.5 V12 H5.5 Z M13 15 H17 M17 12.5 V17.5"),
        "e-machine": G(d: "M4.5 3.5 V20.5 M4.5 6 H10.5 M4.5 10 H10.5 M4.5 14 H10.5 M4.5 18 H10.5 M13.5 8 H19.5 V20.5 H13.5 Z"),
        "e-body": G(d: "M3.5 17 L8.5 12.5 L14 13.5 L20.5 17 M8.5 12.5 L7.5 9.5", dots: "O 6.8 7.6 1.5"),
        "e-kettlebell": G(d: "M8.5 10.5 C 8.5 5.5 15.5 5.5 15.5 10.5 M6 14.5 C 6 11 18 11 18 14.5 C 18 18.5 15 20.5 12 20.5 C 9 20.5 6 18.5 6 14.5 Z"),
        "e-band": G(d: "M4 8 C 9 3 15 3 20 8 M4 16 C 9 21 15 21 20 16 M4 8 V16 M20 8 V16"),
        "e-ball": G(d: "O 12 12 8.5 M4 10 C 9 12 15 12 20 10 M4 14 C 9 12 15 12 20 14"),
        "e-roller": G(d: "M6 7 H18 C 19.5 7 20.5 9 20.5 12 C 20.5 15 19.5 17 18 17 H6 C 4.5 17 3.5 15 3.5 12 C 3.5 9 4.5 7 6 7 Z M18 7 C 16.5 7 15.5 9 15.5 12 C 15.5 15 16.5 17 18 17"),
        "e-bench": G(d: "M3.5 11 H20.5 V14 H3.5 Z M6 14 V19 M18 14 V19"),
        // Training types
        "t-cardio": G(d: heart + " M7 12 H10 L11.5 9 L13.5 15 L15 12 H17"),
        "t-legs": G(d: "M9 3.5 C 8 8 8.5 11 10.5 13.5 L9 20.5 H14 M15 3.5 C 16 8 15.5 11 14 13.5 L14.5 17", dots: "O 14.5 19.5 1.1"),
        "t-upper": G(d: "M3.5 8 C 7 6 9 5.5 12 5.5 C 15 5.5 17 6 20.5 8 L19 15 H16 L15 20.5 H9 L8 15 H5 Z", dots: "O 12 3.5 1.3"),
        "t-full": G(d: "M12 7 V13 M6 9.5 L12 8.5 L18 9.5 M12 13 L8.5 20 M12 13 L15.5 20", dots: "O 12 4.5 2"),
        "t-push": G(d: "M4 5 V19 M8 12 H19 M15 8 L19 12 L15 16", dots: "O 4 12 1.1"),
        "t-pull": G(d: "M20 5 V19 M16 12 H5 M9 8 L5 12 L9 16", dots: "O 20 12 1.1"),
        "t-core": G(d: "O 12 12 8 M9 9.5 H15 M9 14.5 H15", dots: "O 12 12 1.2"),
        "t-mobility": G(d: "M5 18 C 5 12 9 9 12 9 C 15 9 19 12 19 18 M3.5 20.5 H20.5", dots: "O 12 5 2"),
        "t-rest": G(d: "M3.5 17.5 V8 M3.5 14 H20.5 V17.5 H3.5", dots: "O 8 11 1.8"),
        // Meals
        "m-breakfast": G(d: "M5 9 H16 V15 C 16 17.5 14 19 11 19 H10 C 7 19 5 17.5 5 15 Z M16 10.5 H18 C 19.5 10.5 19.5 14 18 14 H16", dots: "O 9 5 0.9 O 12 5 0.9"),
        "m-lunch": G(d: "M3.5 11 H20.5 C 20.5 16 17 19.5 12 19.5 C 7 19.5 3.5 16 3.5 11 Z M8 7.5 C 9.5 5 14.5 5 16 7.5", dots: "O 12 14.5 1"),
        "m-dinner": G(d: "O 12 12 8 O 12 12 4", dots: "O 12 12 1"),
        "m-snacks": G(d: "M12 8 C 9 6 4.5 8 5.5 13.5 C 6.3 17.5 9 20.5 11 20.5 C 11.7 20.5 11.8 20 12 20 C 12.2 20 12.3 20.5 13 20.5 C 15 20.5 17.7 17.5 18.5 13.5 C 19.5 8 15 6 12 8 Z M12 8 C 12 5.5 13 4 15 3.5", dots: "O 9 12 0.9")
    ]
    static func resolve(_ name: String) -> G {
        switch name {
        case "gym", "training": return table["figure.strengthtraining.traditional"]!
        case "meals": return table["fork.knife"]!
        case "recovery", "rest": return table["moon"]!
        case "medication", "peptides": return table["pills"]!
        case "personal": return table["person"]!
        case "bad": return table["cloud.rain"]!
        case "ok": return table["face.smiling"]!
        case "great": return table["sun.max.fill"]!
        case "taken": return table["checkmark.circle.fill"]!
        case "ellipsis.circle": return table[name]!
        default: return table[name] ?? G(d: "O 12 12 8", dots: "O 12 12 1.5")
        }
    }
}

struct BrandIcon: View {
    let name: String
    var fixed: CGFloat? = 22
    init(_ name: String) { self.name = name }
    func resizable() -> BrandIcon { var c = self; c.fixed = nil; return c }
    var body: some View {
        let g = Glyphs.resolve(name)
        // Luxe: a soft Mist body behind closed shapes, a fine round stroke, the worked zone in Sage, and the family dot in Wally Taupe (tiny accent only).
        let closed = (g.d.contains("Z") || g.d.hasPrefix("O")) && name != "circle" && name != "square" && !name.hasPrefix("p-")
        ZStack {
            if g.fill || name.hasSuffix(".fill") { IconShape(d: g.d).opacity(0.2) }
            else if closed { IconShape(d: g.d).fill(Color.mist.opacity(0.4)) }
            if !g.hi.isEmpty { IconShape(d: g.hi).fill(Color.sage) }
            IconShape(d: g.d).stroke(style: StrokeStyle(lineWidth: name.hasPrefix("p-") ? 1.2 : 1.7, lineCap: .round, lineJoin: .round))
            if !g.dots.isEmpty { IconShape(d: g.dots).fill(Color.taupe) }
        }
        .aspectRatio(1, contentMode: .fit)
        .modifier(IconSize(side: fixed))
        .accessibilityHidden(true)
    }
    static func tabImage(_ name: String) -> Image {
        let g = Glyphs.resolve(name); let side: CGFloat = 26
        let rect = CGRect(x: 0, y: 0, width: side, height: side)
        let img = UIGraphicsImageRenderer(size: rect.size).image { ctx in
            let c = ctx.cgContext
            UIColor.black.setStroke(); UIColor.black.setFill()
            c.setLineWidth(1.9 * side / 24); c.setLineCap(.round); c.setLineJoin(.round)
            c.addPath(IconShape(d: g.d).path(in: rect).cgPath); c.strokePath()
            if !g.dots.isEmpty { c.addPath(IconShape(d: g.dots).path(in: rect).cgPath); c.fillPath() }
        }
        return Image(uiImage: img.withRenderingMode(.alwaysTemplate))
    }
}
private struct IconSize: ViewModifier {
    let side: CGFloat?
    func body(content: Content) -> some View { if let s = side { content.frame(width: s, height: s) } else { content } }
}
struct BrandLabel: View {
    let title: String; let icon: String
    init(_ title: String, icon: String) { self.title = title; self.icon = icon }
    var body: some View { HStack(spacing: 6) { BrandIcon(icon); Text(LocalizedStringKey(title)) } }
}
struct TabLabel: View {
    let title: String; let icon: String
    init(_ title: String, _ icon: String) { self.title = title; self.icon = icon }
    var body: some View { Label { Text(LocalizedStringKey(title)) } icon: { BrandIcon.tabImage(icon) } }
}

/// Designed icon plus a plain text label, so colour is never the only cue.
struct TypeBadge: View {
    let type: TrainType
    var body: some View {
        HStack(spacing: 5) { BrandIcon(type.icon).foregroundStyle(Color.tone(type.tone)); Text(LocalizedStringKey(type.label)).font(.fh_caption_b).foregroundStyle(Color.ink) }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Color.tone(type.tone).opacity(0.18), in: Capsule()).overlay(Capsule().stroke(Color.tone(type.tone), lineWidth: 1))
            .accessibilityElement(children: .combine).accessibilityLabel(type.label)
    }
}

// MARK: Animations follow the saved character pick (boy, girl, non-binary)
enum CharacterAnim {
    static func prefix(_ character: String) -> String? {
        switch character { case "boy": return "boy"; case "girl": return "girl"; case "nonbinary": return "nb"; default: return nil }
    }
    static func exists(_ name: String) -> Bool {
        Bundle.main.path(forResource: name, ofType: "webp", inDirectory: "media") != nil || Bundle.main.path(forResource: name, ofType: "webp") != nil
    }
    static func key(_ ex: Exercise) -> String { ex.anim ?? ex.id.lowercased() }
    /// Frame base for the user's own character, or nil when no set has been drawn for that character and exercise.
    static func base(for ex: Exercise, character: String) -> String? {
        guard let p = prefix(character) else { return nil }
        let b = "\(p)-\(key(ex))"
        return exists("anim-\(b)-1") && exists("anim-\(b)-2") && exists("anim-\(b)-3") ? b : nil
    }
}
extension Store {
    /// The character's own set first. Until a figure's set exists for an exercise, the plain set
    /// shows: it is the girl look, her approved default (her fallback rule, 17 Oct). Never a redraw.
    func animBase(_ ex: Exercise) -> String? {
        if let b = CharacterAnim.base(for: ex, character: s.profile.character) { return b }
        let k = CharacterAnim.key(ex)
        return CharacterAnim.exists("anim-\(k)-1") ? k : nil
    }
    func hasCharacterAnim(_ ex: Exercise) -> Bool { CharacterAnim.base(for: ex, character: s.profile.character) != nil }
}

// Display names for data keys (equipment, level, unit), from Labels.strings.
func equipName(_ k: String) -> String { let v = NSLocalizedString("equip." + k, tableName: "Labels", comment: ""); return v.hasPrefix("equip.") ? k : v }
func levelName(_ k: String) -> String { let v = NSLocalizedString("level." + k, tableName: "Labels", comment: ""); return v.hasPrefix("level.") ? k : v }
/// Allergen display name from the data key (never a raw key with underscores).
func allergenName(_ k: String) -> String { let v = NSLocalizedString("allergen." + k, tableName: "Labels", comment: ""); return v.hasPrefix("allergen.") ? k.replacingOccurrences(of: "_", with: " ") : v }
func unitName(_ k: String) -> String { let v = NSLocalizedString("unit." + k, tableName: "Labels", comment: ""); return v.hasPrefix("unit.") ? k : v }

func partName(_ k: String) -> String { if k == "all" { return NSLocalizedString("All", comment: "") }; let v = NSLocalizedString("part." + k, tableName: "Labels", comment: ""); return v.hasPrefix("part.") ? k.capitalized : v }
func cuisineName(_ k: String) -> String { let v = NSLocalizedString("cuisine." + k, tableName: "Labels", comment: ""); return v.hasPrefix("cuisine.") ? k : v }

func focusName(_ k: String) -> String { let v = NSLocalizedString("focus." + k, tableName: "Labels", comment: ""); return v.hasPrefix("focus.") ? (partNames[k] ?? k) : v }

// MARK: Per exercise icons. 17 muscle zones and 11 tools combine, so every exercise carries its own designed mark.
enum ExerciseGlyph {
    static func part(_ p: String) -> String {
        switch p {
        case "chest": return "p-chest"; case "shoulders": return "p-shoulders"; case "abdominals": return "p-abdominals"; case "biceps": return "p-biceps"
        case "triceps": return "p-triceps"; case "forearms": return "p-forearms"; case "quadriceps": return "p-quadriceps"; case "hamstrings": return "p-hamstrings"
        case "glutes": return "p-glutes"; case "calves": return "p-calves"; case "lats": return "p-lats"; case "middle back": return "p-middleback"
        case "lower back": return "p-lowerback"; case "traps": return "p-traps"; case "adductors": return "p-adductors"; case "abductors": return "p-abductors"
        case "neck": return "p-neck"; default: return "t-full"
        }
    }
    static func tool(_ e: String) -> String {
        switch e {
        case "barbell": return "e-barbell"; case "e-z curl bar", "bar": return "e-ez"; case "dumbbell": return "e-dumbbell"; case "cable": return "e-cable"
        case "machine": return "e-machine"; case "body only": return "e-body"; case "kettlebells": return "e-kettlebell"; case "bands", "belt or band": return "e-band"
        case "medicine ball", "exercise ball": return "e-ball"; case "foam roll": return "e-roller"; default: return "e-bench"
        }
    }
}
struct ExerciseIcon: View {
    let exercise: Exercise
    var size: CGFloat = 56
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Color.tint)
                Circle().stroke(Color.sage.opacity(0.55), lineWidth: max(1, size / 56))
                Circle().inset(by: size * 0.07).stroke(Color.mist.opacity(0.8), lineWidth: 0.7)
                BrandIcon(ExerciseGlyph.part(exercise.part)).resizable().foregroundStyle(Color.ink).padding(size * 0.2)
            }.frame(width: size, height: size)
            BrandIcon(ExerciseGlyph.tool(exercise.equipment)).resizable().foregroundStyle(Color.ink).padding(size * 0.08)
                .frame(width: size * 0.4, height: size * 0.4).background(Color.surface, in: Circle()).overlay(Circle().stroke(Color.sage, lineWidth: 1))
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
}
