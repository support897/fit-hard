import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
    /// Four themes: White (default), Dark (Ink based), Beige (Cream), Brand (Sage lead). Contrast kept for body text and buttons.
    /// Brand colours (Burrow board v2): Cream FAEED6, Ink 3E2F26, Sage 52695A, Mist A9BFA5, Tint DCE7D8, Wally Taupe AC9278 (tiny accents only).
    static var pal: UInt = 0      // 0 white, 1 dark, 2 beige, 3 brand
    static func pick(_ w: UInt32, _ k: UInt32, _ b: UInt32, _ r: UInt32) -> Color { Color(hex: pal == 1 ? k : pal == 2 ? b : pal == 3 ? r : w) }
    static var isDark: Bool { pal == 1 }
    static var cream: Color { pick(0xFFFFFF, 0x241A14, 0xFAEED6, 0xEAF1E7) }
    static var surface: Color { pick(0xF3F5F3, 0x3E2F26, 0xFFFDF7, 0xF8FBF6) }
    static var ink: Color { pick(0x3E2F26, 0xFAEED6, 0x3E2F26, 0x2F3A33) }
    static var muted: Color { pick(0x5B4C41, 0xD8C7AE, 0x6E5D4B, 0x55645A) }
    static var sage: Color { pick(0x52695A, 0xA9BFA5, 0x52695A, 0x52695A) }
    static var tint: Color { pick(0xDCE7D8, 0x52695A, 0xDCE7D8, 0xCADBC6) }
    static var line: Color { pick(0xD9DDD6, 0x5A483B, 0xE4D3B8, 0xB5C9B1) }
    static var amber: Color { pick(0x8F5A2E, 0xE0A56B, 0xA86A38, 0x8F5A2E) }
    /// Mist and Wally Taupe. Taupe is for tiny accents only, never a big fill.
    static var mist: Color { Color(hex: 0xA9BFA5) }
    static var taupe: Color { Color(hex: 0xAC9278) }
}

extension View {
    /// Card-coloured rows for Form/List so every theme stays readable.
    func themedRows() -> some View { self.listRowBackground(Color.surface) }
}

struct Card<Content: View>: View {
    var content: () -> Content
    init(@ViewBuilder _ content: @escaping () -> Content) { self.content = content }
    var body: some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.line, lineWidth: 1))
    }
}

struct BigButton: View {
    let title: String; var icon: String? = nil; var filled = true; let action: () -> Void
    var body: some View {
        Button(action: { haptic(); action() }) {
            HStack { if let i = icon { BrandIcon( i) }; Text(LocalizedStringKey(title)).fontWeight(.bold) }
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(filled ? Color.sage : Color.tint, in: Capsule())
                .foregroundStyle(filled ? Color.surface : Color.ink)
        }.buttonStyle(.plain)
    }
}

struct Chip: View {
    let label: String; var icon: String? = nil; let on: Bool; let tap: () -> Void
    var body: some View {
        Button(action: { haptic(.soft); tap() }) {
            HStack(spacing: 6) { if let i = icon { BrandIcon( i) }; Text(LocalizedStringKey(label)) }
                .font(.fh_subheadline_b)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(on ? Color.sage : Color.surface, in: Capsule())
                .overlay(Capsule().stroke(on ? Color.sage : Color.line, lineWidth: 1))
                .foregroundStyle(on ? Color.surface : Color.ink)
        }.buttonStyle(.plain).animation(.easeOut(duration: 0.15), value: on)
    }
}

/// Simple wrapping layout for chips.
struct Flow<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder var content: () -> Content
    var body: some View { FlowLayout(spacing: spacing) { content() } }
}
struct FlowLayout: Layout {
    var spacing: CGFloat
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > w { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: w, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}

/// Loads a bundled image file (WebP is decoded natively on iOS 14+).
struct BundleImage: View {
    let name: String
    /// Mascot and animation art is drawn on white. On light themes it blends into the page; on dark themes it sits on a soft white card.
    private var onWhite: Bool { name.hasPrefix("wally-") || name.hasPrefix("anim-") }
    private func art(_ ui: UIImage) -> some View {
        let img = Image(uiImage: ui).resizable().scaledToFit()
        return Group {
            if !onWhite { img }
            else if Color.isDark { img.padding(4).background(Color.white, in: RoundedRectangle(cornerRadius: 14)) }
            else { img.blendMode(.multiply) }
        }
    }
    var body: some View {
        if let p = Bundle.main.path(forResource: name, ofType: "webp", inDirectory: "media"), let ui = UIImage(contentsOfFile: p) {
            art(ui)
        } else if let p = Bundle.main.path(forResource: name, ofType: "webp"), let ui = UIImage(contentsOfFile: p) {
            art(ui)
        } else if let p = Bundle.main.path(forResource: name, ofType: "png"), let ui = UIImage(contentsOfFile: p) {
            art(ui)
        } else { Color.clear }
    }
}

struct AnimatedFrames: View {
    let base: String
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    var body: some View {
        if reduceMotion { BundleImage(name: "anim-\(base)-1") } else
        { TimelineView(.periodic(from: .now, by: 0.7)) { ctx in
            let i = Int(ctx.date.timeIntervalSinceReferenceDate / 0.7) % 3 + 1
            BundleImage(name: "anim-\(base)-\(i)")
        } }
    }
}

struct SectionTitle: View {
    let text: String
    var body: some View { Text(LocalizedStringKey(text)).font(.fh_title3_b).foregroundStyle(Color.ink) }
}

struct ThemePicker: View {
    @EnvironmentObject var store: Store
    /// id, label, background, text, accent
    let opts: [(String, String, UInt32, UInt32, UInt32)] = [("white", "White", 0xFFFFFF, 0x3E2F26, 0x52695A), ("dark", "Dark", 0x241A14, 0xFAEED6, 0xA9BFA5), ("beige", "Beige", 0xFAEED6, 0x3E2F26, 0x52695A), ("brand", "Brand", 0x52695A, 0xFAEED6, 0xA9BFA5)]
    var body: some View {
        HStack(spacing: 12) {
            ForEach(opts, id: \.0) { th in
                let on = store.s.settings.theme == th.0
                Button { store.s.settings.theme = th.0; haptic() } label: {
                    VStack(spacing: 6) {
                        ZStack {
                            Circle().fill(Color(hex: th.2)).frame(width: 48, height: 48)
                                .overlay(Circle().stroke(on ? Color.sage : Color.line, lineWidth: on ? 3 : 1))
                            Text("Aa").font(.fh_subheadline_b).foregroundStyle(Color(hex: th.3))
                            Circle().fill(Color(hex: th.4)).frame(width: 8, height: 8).offset(x: 14, y: 14)
                        }
                        Text(LocalizedStringKey(th.1)).font(.fh_caption_b).foregroundStyle(Color.ink)
                    }.frame(maxWidth: .infinity)
                }.buttonStyle(.plain)
                .accessibilityLabel("\(th.1) theme").accessibilityIdentifier("theme-\(th.0)")
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}
