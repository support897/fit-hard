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

/// Kept for older callers: the rainbow is now GlowRainbow.
struct RainbowArcs: View { var body: some View { GlowRainbow() } }

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
    @Environment(\.scenePhase) var scenePhase
    @State private var awaiting = false
    @State private var showAsk = false
    @State private var celebrate = false
    private var cleanName: String { anonymous ? "" : donorName.trimmingCharacters(in: .whitespaces) }
    private var left: Int { max(0, KindnessStats.nextMilestone - KindnessStats.joined) }
    var body: some View {
        ScrollView { VStack(spacing: 16) {
            // The hero: brand gradient, the rainbow, the number of humans.
            VStack(spacing: 10) {
                Text("JOIN THE AI KINDNESS REVOLUTION").font(.fh_caption_b).tracking(1.6).foregroundStyle(Color(hex: 0xDCE7D8)).multilineTextAlignment(.center)
                NavigationLink { KindnessWallView() } label: { GlowRainbow(progress: Double(KindnessStats.joined) / Double(KindnessStats.nextMilestone)).padding(.horizontal, 6).contentShape(Rectangle()) }
                    .buttonStyle(.plain).accessibilityLabel("Touch the rainbow to see every name").accessibilityIdentifier("kindness-rainbow")
                CountUpText(target: KindnessStats.joined).font(.fh_largeTitle_b).foregroundStyle(Color(hex: 0xFFFDF7)).accessibilityIdentifier("kindness-counter")
                Text("humans have joined the AI kindness revolution").font(.fh_subheadline_b).foregroundStyle(Color(hex: 0xFFFDF7)).multilineTextAlignment(.center)
                VStack(spacing: 4) {
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.25))
                            Capsule().fill(LinearGradient(colors: GlowRainbow.colours.map { Color(hex: $0) }, startPoint: .leading, endPoint: .trailing))
                                .frame(width: g.size.width * CGFloat(Double(KindnessStats.joined) / Double(KindnessStats.nextMilestone)))
                        }
                    }.frame(height: 10)
                    Text("\(left.formatted()) more humans to reach \(KindnessStats.nextMilestone.formatted())").font(.fh_caption).foregroundStyle(Color(hex: 0xDCE7D8))
                }.padding(.horizontal, 8)
                Text("Touch the rainbow to see every name.").font(.fh_caption).foregroundStyle(Color(hex: 0xDCE7D8))
            }
            .padding(18).frame(maxWidth: .infinity)
            .background(LinearGradient(colors: [Color(hex: 0x52695A), Color(hex: 0x7C9A83)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 28))
            .overlay(alignment: .topTrailing) { BundleImage(name: "wally-celebrate").frame(height: 62).padding(10) }

            // What we believe.
            Card {
                SectionTitle(text: "What we believe")
                ForEach(KindnessStats.ideals, id: \.title) { it in
                    HStack(alignment: .top, spacing: 12) {
                        BrandIcon(it.icon).font(.fh_headline).foregroundStyle(Color.sage).frame(width: 40, height: 40).background(Color.tint, in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(LocalizedStringKey(it.title)).font(.fh_headline).foregroundStyle(Color.ink)
                            Text(LocalizedStringKey(it.text)).font(.fh_subheadline).foregroundStyle(Color.muted)
                        }
                    }
                }
            }
            if store.s.kindnessGivenCents > 0 {
                Card { VStack(spacing: 4) {
                    Text(String(format: NSLocalizedString("You have given %@ in total", comment: ""), String(format: "$%.2f", Double(store.s.kindnessGivenCents) / 100))).font(.fh_headline).foregroundStyle(Color.sage)
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
                    TextField("Your name for the rainbow (optional)", text: $donorName).padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                }
                TextField("A message (optional)", text: $donorMessage).padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                if let a = amountCents {
                    Text(String(format: NSLocalizedString("Your pick: $%@ · %@", comment: ""), String(format: "%.2f", Double(a) / 100), anonymous ? NSLocalizedString("anonymous", comment: "") : (donorName.isEmpty ? NSLocalizedString("no name", comment: "") : donorName))).font(.fh_subheadline_b).foregroundStyle(Color.sage)
                }
            }
            BigButton(title: amountCents == nil ? "Give in one tap" : "Give with your pick", icon: "heart.fill") { awaiting = true; openURL(giveURL) }.accessibilityIdentifier("kindness-give")
            Text("Apple Pay, Google Pay, PayPal and cards. The page opens with your gift already filled in.").font(.fh_footnote).foregroundStyle(Color.muted).multilineTextAlignment(.center)
            Text("Give only if you want. Fit Hard stays free for all.").font(.fh_footnote).foregroundStyle(Color.muted)
        }.padding(16) }
        .background(Color.cream).navigationTitle("Kindness").navigationBarTitleDisplayMode(.inline)
        .onChange(of: scenePhase) { ph in if ph == .active && awaiting { showAsk = true } }
        .alert("Did your gift go through?", isPresented: $showAsk) {
            Button("Yes, I gave") {
                awaiting = false
                if let a = amountCents { store.s.kindnessGivenCents += a }
                KindnessWall.addMine(WallEntry(name: cleanName.isEmpty ? "A kind human" : cleanName, message: donorMessage.trimmingCharacters(in: .whitespaces)))
                celebrate = true
            }
            Button("Not yet", role: .cancel) { awaiting = false }
        } message: { Text("Tell us and your rainbow will light up.") }
        .fullScreenCover(isPresented: $celebrate) { RainbowCelebration(name: cleanName) { celebrate = false } }
    }
}

/// The wall inside the app is a viewing screen only: it takes no money and shows no pay
/// buttons. Names stay for good, in the order people joined. Until the shared wall record
/// reaches the app, the wall says so plainly and shows no invented names.
struct KindnessWallView: View {
    @State private var entries: [WallEntry] = []
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            GlowRainbow(progress: Double(KindnessStats.joined) / Double(KindnessStats.nextMilestone), dots: 63)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(KindnessStats.joined.formatted()).font(.fh_title_b).monospacedDigit().foregroundStyle(Color.sage)
                Text("humans, and every name stays here for good").font(.fh_subheadline).foregroundStyle(Color.muted)
            }
            if entries.isEmpty {
                Card { VStack(spacing: 6) {
                    Text("Your name could be next.").font(.fh_headline).foregroundStyle(Color.ink).accessibilityIdentifier("kindness-wall-empty")
                    Text("People who choose to share their name and a kind word appear here, in the order they joined.").multilineTextAlignment(.center).foregroundStyle(Color.muted)
                }.frame(maxWidth: .infinity) }
            } else {
                ForEach(Array(entries.enumerated()), id: \.element.id) { i, e in
                    HStack(alignment: .top, spacing: 12) {
                        Circle().fill(Color(hex: GlowRainbow.colours[i % 7])).frame(width: 14, height: 14).padding(.top, 5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.name).font(.fh_headline).foregroundStyle(Color.ink)
                            if !e.message.isEmpty { Text(e.message).font(.fh_subheadline).foregroundStyle(Color.muted) }
                        }
                        Spacer(minLength: 0)
                    }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Color.surface, in: RoundedRectangle(cornerRadius: 18))
                }
            }
        }.padding(16) }
        .background(Color.cream).navigationTitle("The wall").navigationBarTitleDisplayMode(.inline)
        .task { entries = KindnessWall.mine() + (await KindnessWall.remote()) }
    }
}
