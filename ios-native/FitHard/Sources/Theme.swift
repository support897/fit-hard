import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
    static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(Color(hex: dark)) : UIColor(Color(hex: light)) })
    }
    static let cream = adaptive(0xFAEED6, 0x17120E)
    static let surface = adaptive(0xFFFDF7, 0x251D16)
    static let ink = adaptive(0x3E2F26, 0xF6EDDD)
    static let muted = adaptive(0x6E5D4B, 0xCBB99E)
    static let sage = adaptive(0x52695A, 0xA9BFA5)
    static let tint = adaptive(0xDCE7D8, 0x2E3A2A)
    static let line = adaptive(0xE4D3B8, 0x4A3A2A)
    static let amber = adaptive(0xC08552, 0xD9A05F)
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
        } else { Color.clear }
    }
}

struct AnimatedFrames: View {
    let base: String
    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.7)) { ctx in
            let i = Int(ctx.date.timeIntervalSinceReferenceDate / 0.7) % 3 + 1
            BundleImage(name: "anim-\(base)-\(i)")
        }
    }
}

struct SectionTitle: View {
    let text: String
    var body: some View { Text(text).font(.system(.title3, design: .serif).weight(.bold)).foregroundStyle(Color.ink) }
}
