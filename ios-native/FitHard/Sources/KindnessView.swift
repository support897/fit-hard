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
    // Build 36, item E (her ask reshaped by Apple's own rules, HQ 14 Nov): everything is
    // PICKED here in the app — the amount card, the name, the message, the anonymous
    // choice — and Give carries those exact picks to the giving page already filled in.
    // Only the pay tap itself sits on the page, because Apple's guidelines allow in-app
    // fundraising collection only to approved nonprofits (3.2.1(vi)) and require everyone
    // else to collect outside the app (3.2.2(iv)). No wording here promises in-app payment.
    @State private var picked: Int? = nil        // cents, from the amount cards of record
    @State private var custom: String = ""       // dollars as typed; a typed amount always wins
    @State private var donorName: String = ""
    @State private var donorMessage: String = ""
    @State private var anonymous: Bool = false
    static let cards: [(Int, String)] = [(300, "$3"), (500, "$5"), (1000, "$10"), (2000, "$20")]
    /// The amount that will ride to the giving page: the typed one when there is one,
    /// else the picked card, else nothing (no amount is ever forced or pre picked).
    var amountCents: Int? {
        let t = custom.trimmingCharacters(in: .whitespaces)
        if let d = Double(t.replacingOccurrences(of: ",", with: ".")), d > 0 { return Int((d * 100).rounded()) }
        return picked
    }
    var giveURL: URL {
        var c = URLComponents(url: KindnessLinks.givingPage, resolvingAgainstBaseURL: false)
        var q: [URLQueryItem] = []
        if let a = amountCents { q.append(URLQueryItem(name: "amount", value: String(a))) }
        if anonymous { q.append(URLQueryItem(name: "anon", value: "1")) }
        else if !donorName.trimmingCharacters(in: .whitespaces).isEmpty { q.append(URLQueryItem(name: "name", value: donorName.trimmingCharacters(in: .whitespaces))) }
        if !donorMessage.trimmingCharacters(in: .whitespaces).isEmpty { q.append(URLQueryItem(name: "message", value: donorMessage.trimmingCharacters(in: .whitespaces))) }
        if !q.isEmpty { c?.queryItems = q }
        return c?.url ?? KindnessLinks.givingPage
    }
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
            Card {
                SectionTitle(text: "Pick your gift")
                HStack(spacing: 10) {
                    ForEach(Self.cards, id: \.0) { card in
                        Button { picked = card.0; custom = ""; haptic() } label: {
                            Text(card.1).font(.fh_headline)
                                .frame(maxWidth: .infinity, minHeight: 52)
                                .background(picked == card.0 && custom.isEmpty ? Color.sage.opacity(0.3) : Color.surface, in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(picked == card.0 && custom.isEmpty ? Color.sage : Color.line, lineWidth: picked == card.0 && custom.isEmpty ? 2 : 1))
                        }.buttonStyle(.plain).foregroundStyle(Color.ink).accessibilityIdentifier("kindness-amount-\(card.0)")
                    }
                }
                HStack {
                    Text("$").foregroundStyle(Color.muted)
                    TextField("Choose your own amount", text: $custom).keyboardType(.decimalPad).accessibilityIdentifier("kindness-custom")
                }.padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                Toggle("Stay anonymous", isOn: $anonymous).tint(Color.sage).accessibilityIdentifier("kindness-anon")
                if !anonymous {
                    TextField("Your name (optional)", text: $donorName).padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line)).accessibilityIdentifier("kindness-name")
                }
                TextField("A message (optional)", text: $donorMessage).padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line)).accessibilityIdentifier("kindness-message")
                if let a = amountCents {
                    Text(String(format: NSLocalizedString("Your pick: $%@ · %@", comment: ""), String(format: "%.2f", Double(a) / 100), anonymous ? NSLocalizedString("anonymous", comment: "") : (donorName.trimmingCharacters(in: .whitespaces).isEmpty ? NSLocalizedString("no name", comment: "") : donorName.trimmingCharacters(in: .whitespaces)))).font(.fh_caption).foregroundStyle(Color.muted)
                }
            }
            BigButton(title: "Give to keep it free", icon: "heart") { openURL(giveURL) }.accessibilityIdentifier("kindness-give")
            Text("You pick everything here. The giving page opens with it all filled in, and paying happens there.").font(.fh_footnote).foregroundStyle(Color.muted).multilineTextAlignment(.center)
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
