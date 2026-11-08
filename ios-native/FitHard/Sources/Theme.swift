import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
    /// Fixed palettes: white (default), black, brown. Contrast checked for body text >= 7:1, buttons >= 4.5:1.
    static var pal: UInt = 0
    static func pick(_ w: UInt32, _ k: UInt32, _ b: UInt32, _ r: UInt32) -> Color { Color(hex: pal == 1 ? k : pal == 2 ? b : pal == 3 ? r : w) }
    static var cream: Color { pick(0xFFFFFF, 0x000000, 0x3A281D) }
    static var surface: Color { pick(0xF3F5F3, 0x1B1B1B, 0x4B362A) }
    static var ink: Color { pick(0x161616, 0xFFFFFF, 0xFFF6E8) }
    static var muted: Color { pick(0x4F4F4F, 0xC4C4C4, 0xE6D3B8) }
    static var sage: Color { pick(0x1F6B47, 0x8EDDAE, 0xC4E0B2) }
    static var tint: Color { pick(0xDDEEE3, 0x1E3B2B, 0x5E4838) }
    static var line: Color { pick(0xC9D0CB, 0x3D3D3D, 0x735845) }
    static var amber: Color { pick(0x9A4F12, 0xFFB26B, 0xFFC084) }
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
            HStack { if let i = icon { Image(systemName: i) }; Text(title).fontWeight(.bold) }
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
            HStack(spacing: 6) { if let i = icon { Image(systemName: i) }; Text(label) }
                .font(.subheadline.weight(.semibold))
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
    var body: some View {
        if let p = Bundle.main.path(forResource: name, ofType: "webp", inDirectory: "media"), let ui = UIImage(contentsOfFile: p) {
            Image(uiImage: ui).resizable().scaledToFit()
        } else if let p = Bundle.main.path(forResource: name, ofType: "webp"), let ui = UIImage(contentsOfFile: p) {
            Image(uiImage: ui).resizable().scaledToFit()
        } else if let p = Bundle.main.path(forResource: name, ofType: "png"), let ui = UIImage(contentsOfFile: p) {
            Image(uiImage: ui).resizable().scaledToFit()
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
    var body: some View { Text(text).font(.system(.title3, design: .serif).weight(.bold)).foregroundStyle(Color.ink) }
}

struct ThemePicker: View {
    @EnvironmentObject var store: Store
    let opts: [(String, String, UInt32, UInt32)] = [("burrow", "Burrow", 0xFAEED6, 0x3E2F26), ("white", "White", 0xFFFFFF, 0x161616), ("black", "Black", 0x000000, 0xFFFFFF), ("brown", "Brown", 0x3A281D, 0xFFF6E8)]
    var body: some View {
        HStack(spacing: 12) {
            ForEach(opts, id: \.0) { th in
                let on = store.s.settings.theme == th.0
                Button { store.s.settings.theme = th.0; haptic() } label: {
                    VStack(spacing: 6) {
                        ZStack {
                            Circle().fill(Color(hex: th.2)).frame(width: 48, height: 48)
                                .overlay(Circle().stroke(on ? Color.sage : Color.line, lineWidth: on ? 3 : 1))
                            Text("Aa").font(.subheadline.bold()).foregroundStyle(Color(hex: th.3))
                        }
                        Text(th.1).font(.caption.weight(.semibold)).foregroundStyle(Color.ink)
                    }.frame(maxWidth: .infinity)
                }.buttonStyle(.plain)
                .accessibilityLabel("\(th.1) theme").accessibilityIdentifier("theme-\(th.0)")
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}
