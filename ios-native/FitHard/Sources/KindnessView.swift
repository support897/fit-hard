import SwiftUI

/// Join the AI kindness revolution (build 35, item 10, from the donations pack of record).
/// One design in every app; only the skin changes. Fit Hard's skin: Wally, Burrow Cream,
/// Sage, Zilla Slab titles. Giving is always collected on the giving page in Safari, never
/// inside the app, and nothing ever unlocks for giving.
enum KindnessLinks {
    /// The giving page address lives in exactly one place. It points at the kindness home
    /// on Ilse's own domain; the live Stripe giving page swaps in on this one line.
    static let givingPage = URL(string: "https://ilseplacencia.shop/kindness")!
}

/// The rainbow wears the Revolution colours in every app alike. It fills with people,
/// never with money, and carries no target and no finish line. Spots and names arrive
/// from the shared wall record; at launch the rainbow stands ready and empty, and no
/// name, message or count is ever invented for it.
struct RainbowArcs: View {
    static let colours: [UInt32] = [0xFF6B6B, 0xFF9F43, 0xFFD93D, 0x6BCB77, 0x4D96FF, 0x9B5DE5, 0xFF6BAE]
    var body: some View {
        ZStack {
            ForEach(0..<Self.colours.count, id: \.self) { i in
                Circle().stroke(Color(hex: Self.colours[i]), lineWidth: 13)
                    .frame(width: CGFloat(264 - i * 28), height: CGFloat(264 - i * 28))
                    .position(x: 140, y: 140)
            }
        }.frame(width: 280, height: 140).clipped()
    }
}

struct KindnessView: View {
    @EnvironmentObject var store: Store
    @Environment(\.openURL) var openURL
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            BundleImage(name: "wally-celebrate").frame(height: 130)
            Text("Join the AI kindness revolution").font(.fh_title_b).multilineTextAlignment(.center).foregroundStyle(Color.ink)
            Text("Your gift keeps the training plans free for the next person starting out.").multilineTextAlignment(.center).foregroundStyle(Color.muted)
            NavigationLink { KindnessWallView() } label: { RainbowArcs() }
                .buttonStyle(.plain).accessibilityLabel("Touch the rainbow to see every name").accessibilityIdentifier("kindness-rainbow")
            Text("Touch the rainbow to see every name.").font(.fh_caption).foregroundStyle(Color.muted)
            // The counter counts humans, never money, and only ever shows a real number from
            // the giving record. Under 20 humans it carries the pack's first humans wording.
            Text("Be one of the first kind humans").font(.fh_headline).foregroundStyle(Color.ink).accessibilityIdentifier("kindness-counter")
            if store.s.kindnessGivenCents > 0 {
                Card { VStack(spacing: 4) {
                    Text(String(format: NSLocalizedString("You have given %@ in total", comment: ""), String(format: "$%.2f", Double(store.s.kindnessGivenCents) / 100))).font(.fh_headline).foregroundStyle(Color.ink)
                    Text("Just for your eyes.").font(.fh_caption).foregroundStyle(Color.muted)
                } }
            }
            BigButton(title: "Give to keep it free", icon: "heart") { openURL(KindnessLinks.givingPage) }.accessibilityIdentifier("kindness-give")
            Text("Give only if you want. Fit Hard stays free for all.").font(.fh_footnote).foregroundStyle(Color.muted)
        }.padding(16) }
        .background(Color.cream).navigationTitle("Kindness").navigationBarTitleDisplayMode(.inline)
    }
}

/// The wall inside the app is a viewing screen only: it takes no money and shows no pay
/// buttons. Names stay for good, in the order people joined. Until the shared wall record
/// reaches the app, the wall says so plainly and shows no invented names.
struct KindnessWallView: View {
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            RainbowArcs()
            Text("The wall is just starting.").font(.fh_headline).foregroundStyle(Color.ink)
            Text("Every person who joins gets a spot in the rainbow. Their name stays here for good, if they choose to put it here.").multilineTextAlignment(.center).foregroundStyle(Color.muted)
            Text("Be one of the first kind humans").foregroundStyle(Color.muted)
        }.padding(16) }
        .background(Color.cream).navigationTitle("The wall").navigationBarTitleDisplayMode(.inline)
    }
}
