import SwiftUI
import UIKit

// MARK: Build 50. Kindness page redo, bug report, feedback.

enum KindnessStats {
    /// The humans count the owner gave for the Revolution. One place to change it.
    static let joined = 20467
    static let nextMilestone = 25000
    struct Ideal { let icon: String; let title: String; let text: String }
    static let ideals: [Ideal] = [
        Ideal(icon: "heart.fill", title: "Kindness first", text: "Technology should leave people feeling cared for, not counted."),
        Ideal(icon: "sparkles", title: "Free for the next person", text: "Every gift keeps Fit Hard free for someone just starting out."),
        Ideal(icon: "person", title: "People, not points", text: "Each spot in the rainbow is a real human. No scores, no pressure.")
    ]
    static let wallURL = URL(string: "https://fipingffwixtwrlcgffi.supabase.co/functions/v1/kind-wall")!
    static let wallKey = "sb_publishable_VT3CZgUUnHePy-ms2-K9KQ_gUsdVm92"
}

struct WallEntry: Codable, Identifiable, Hashable {
    var name: String
    var message: String = ""
    var id: String { name + "|" + message }
}

enum KindnessWall {
    private static let key = "fh.kindness.mine"
    static func mine() -> [WallEntry] {
        guard let d = UserDefaults.standard.data(forKey: key), let a = try? JSONDecoder().decode([WallEntry].self, from: d) else { return [] }
        return a
    }
    static func addMine(_ e: WallEntry) {
        var a = mine(); a.insert(e, at: 0)
        if let d = try? JSONEncoder().encode(a) { UserDefaults.standard.set(d, forKey: key) }
    }
    static func remote() async -> [WallEntry] {
        if Cloud.offline { return [] }
        var r = URLRequest(url: KindnessStats.wallURL); r.httpMethod = "POST"; r.timeoutInterval = 15
        r.setValue(KindnessStats.wallKey, forHTTPHeaderField: "apikey")
        guard let (d, _) = try? await URLSession.shared.data(for: r),
              let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let people = j["people"] as? [[String: Any]] else { return [] }
        return people.compactMap { p in
            let n = (p["name"] as? String) ?? ""
            let m = (p["message"] as? String) ?? ""
            return n.isEmpty ? nil : WallEntry(name: n, message: m)
        }
    }
}

// MARK: The rainbow

struct GlowRainbow: View {
    var progress: Double = 0.82
    var dots: Int = 56
    var delay: Double = 0
    @State private var p: Double = 0
    static let colours: [UInt32] = [0xFF6B6B, 0xFF9F43, 0xFFD93D, 0x6BCB77, 0x4D96FF, 0x9B5DE5, 0xFF6BAE]
    var body: some View {
        GeometryReader { g in
            let w = g.size.width
            let band = w * 0.056
            let r0 = (w - band) / 2
            let cy = r0 + band / 2
            ZStack {
                ForEach(0..<7, id: \.self) { i in
                    let r = r0 - CGFloat(i) * band * 1.04
                    let c = Color(hex: Self.colours[i])
                    Circle().trim(from: 0.5, to: 1.0).stroke(c.opacity(0.16), style: StrokeStyle(lineWidth: band, lineCap: .round))
                        .frame(width: r * 2, height: r * 2).position(x: w / 2, y: cy)
                    Circle().trim(from: 0.5, to: 0.5 + 0.5 * p * progress).stroke(c, style: StrokeStyle(lineWidth: band, lineCap: .round))
                        .shadow(color: c.opacity(0.35), radius: 5, y: 1)
                        .frame(width: r * 2, height: r * 2).position(x: w / 2, y: cy)
                }
                // People on the bands: one small bright dot each, in the order they came.
                ForEach(0..<dots, id: \.self) { k in
                    let i = k % 7
                    let r = r0 - CGFloat(i) * band * 1.04
                    let frac = (Double(k / 7) + 0.5) / Double(max(1, dots / 7))
                    let shown = frac * progress <= p * progress
                    let th = Double.pi - frac * progress * Double.pi
                    Circle().fill(Color.white).frame(width: band * 0.46, height: band * 0.46)
                        .overlay(Circle().stroke(Color(hex: Self.colours[i]), lineWidth: 2))
                        .opacity(shown ? 1 : 0)
                        .position(x: w / 2 + r * CGFloat(cos(th)), y: cy - r * CGFloat(sin(th)))
                }
                // Soft clouds at both feet.
                ForEach(0..<2, id: \.self) { side in
                    let x = side == 0 ? band * 0.9 : w - band * 0.9
                    ZStack {
                        Circle().fill(Color.white).frame(width: band * 1.5, height: band * 1.5).offset(x: -band * 0.7)
                        Circle().fill(Color.white).frame(width: band * 2.0, height: band * 2.0)
                        Circle().fill(Color.white).frame(width: band * 1.5, height: band * 1.5).offset(x: band * 0.7)
                    }.shadow(color: Color.black.opacity(0.06), radius: 4).position(x: x, y: cy + band * 0.15)
                }
            }
            .frame(width: w, height: cy + band * 1.2, alignment: .topLeading)
        }
        .aspectRatio(1.0 / 0.58, contentMode: .fit)
        .onAppear {
            p = 0
            DispatchQueue.main.asyncAfter(deadline: .now() + delay + 0.15) { withAnimation(.easeOut(duration: 2.0)) { p = 1 } }
        }
        .accessibilityHidden(true)
    }
}

struct CountUpText: View {
    let target: Int
    @State private var shown = 0
    var body: some View {
        Text(shown.formatted()).monospacedDigit()
            .task {
                shown = 0
                let steps = 70
                for s in 1...steps {
                    try? await Task.sleep(nanoseconds: 22_000_000)
                    let t = Double(s) / Double(steps)
                    shown = Int(Double(target) * (1 - pow(1 - t, 3)))
                }
                shown = target
            }
    }
}

/// Burst of colour after a gift. Plays on top of everything, then the person taps Done.
struct RainbowCelebration: View {
    let name: String
    let onDone: () -> Void
    @State private var fall = false
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0xFAEED6), Color(hex: 0xDCE7D8)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            GeometryReader { g in
                ForEach(0..<36, id: \.self) { i in
                    Circle().fill(Color(hex: GlowRainbow.colours[i % 7])).frame(width: CGFloat(6 + (i % 4) * 3), height: CGFloat(6 + (i % 4) * 3))
                        .position(x: CGFloat((i * 53) % Int(max(g.size.width, 1))), y: fall ? g.size.height + 20 : -20)
                        .animation(.easeIn(duration: 2.2 + Double(i % 5) * 0.35).delay(Double(i % 9) * 0.12), value: fall)
                }
            }.allowsHitTesting(false)
            VStack(spacing: 18) {
                Spacer()
                GlowRainbow(progress: 1.0, dots: 63).padding(.horizontal, 20)
                BundleImage(name: "wally-celebrate").frame(height: 120)
                Text(name.isEmpty ? "Thank you, kind human" : "Thank you, \(name)").font(.fh_title_b).foregroundStyle(Color(hex: 0x3E2F26)).multilineTextAlignment(.center)
                Text(name.isEmpty ? "You joined the rainbow." : "Your name is in the rainbow now.").foregroundStyle(Color(hex: 0x5B4C41))
                Spacer()
                BigButton(title: "Done", icon: "checkmark.circle.fill") { onDone() }.padding(.horizontal, 24).accessibilityIdentifier("kindness-celebrate-done")
            }.padding(.bottom, 24)
        }.onAppear { fall = true }
    }
}

// MARK: Bug reports and feedback

enum FeedbackKind: String { case bug, feedback }

enum FeedbackService {
    /// The webhook that mails the owner and the sender. Set once the webhook is live.
    static var endpoint = ""
    private static let qKey = "fh.feedback.queue"

    static func queue() -> [[String: String]] { (UserDefaults.standard.array(forKey: qKey) as? [[String: String]]) ?? [] }
    private static func save(_ q: [[String: String]]) { UserDefaults.standard.set(q, forKey: qKey) }

    static func payload(kind: FeedbackKind, message: String, email: String, name: String, anonymous: Bool, uid: String, topic: String) -> [String: String] {
        let info = Bundle.main.infoDictionary ?? [:]
        return [
            "kind": kind.rawValue, "topic": topic, "message": message,
            "email": anonymous ? "" : email, "name": anonymous ? "" : name, "anonymous": anonymous ? "yes" : "no",
            "uid": anonymous ? "" : uid,
            "app": "Fit Hard", "version": (info["CFBundleShortVersionString"] as? String) ?? "", "build": (info["CFBundleVersion"] as? String) ?? "",
            "device": UIDevice.current.model, "ios": UIDevice.current.systemVersion, "locale": Locale.current.identifier,
            "sent": ISO8601DateFormatter().string(from: Date())
        ]
    }

    /// Returns true when the webhook took it. When it cannot, the note waits on the phone and goes out later.
    @discardableResult static func send(_ p: [String: String]) async -> Bool {
        if Cloud.offline { Cloud.log.append("feedback"); return true }
        guard !endpoint.isEmpty, let url = URL(string: endpoint) else { save(queue() + [p]); return false }
        var r = URLRequest(url: url); r.httpMethod = "POST"; r.timeoutInterval = 20
        r.setValue("text/plain;charset=utf-8", forHTTPHeaderField: "Content-Type")
        r.httpBody = try? JSONSerialization.data(withJSONObject: p)
        if let (_, resp) = try? await URLSession.shared.data(for: r), let h = resp as? HTTPURLResponse, h.statusCode < 400 { return true }
        save(queue() + [p]); return false
    }

    static func flush() async {
        let q = queue(); guard !q.isEmpty, !endpoint.isEmpty, !Cloud.offline else { return }
        save([])
        for p in q { await send(p) }
    }
}

struct ReachOutView: View {
    let kind: FeedbackKind
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var topic = ""
    @State private var message = ""
    @State private var email = ""
    @State private var anonymous = false
    @State private var sending = false
    @State private var done = false
    @State private var queued = false

    private var isBug: Bool { kind == .bug }
    private var topics: [String] { isBug ? ["Something broke", "Looks wrong", "Slow or stuck", "Other"] : ["I love this", "Idea", "Something confusing", "Other"] }
    private var fromEmail: String { store.session?.email ?? email.trimmingCharacters(in: .whitespaces) }
    private var canSend: Bool { !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending }

    var body: some View {
        ScrollView { VStack(spacing: 16) {
            if done {
                BundleImage(name: "wally-celebrate").frame(height: 130)
                Text(queued ? "Saved on your phone" : (isBug ? "Bug received" : "Thank you")).font(.fh_title_b).foregroundStyle(Color.ink)
                Text(queued ? "We will send it as soon as you are online." : (anonymous || fromEmail.isEmpty ? "We read every note. Thank you for helping." : "We sent a note to \(fromEmail). We will get back to you within 24 hours."))
                    .multilineTextAlignment(.center).foregroundStyle(Color.muted)
                BigButton(title: "Done", icon: "checkmark.circle.fill") { dismiss() }.accessibilityIdentifier("reach-done")
            } else {
                BundleImage(name: "wally-hello").frame(height: 96)
                Text(isBug ? "Tell us what went wrong" : "Tell us what you think").font(.fh_title_b).foregroundStyle(Color.ink).multilineTextAlignment(.center)
                Text(isBug ? "One quick note is enough. We add your phone and app details for you." : "Your words shape Fit Hard. Every note gets read.")
                    .multilineTextAlignment(.center).foregroundStyle(Color.muted)
                Card {
                    SectionTitle(text: isBug ? "1. What kind of problem" : "1. What kind of note")
                    ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(topics, id: \.self) { t in
                        Button { topic = t; haptic() } label: {
                            Text(LocalizedStringKey(t)).font(.fh_caption_b).padding(.horizontal, 10).frame(minHeight: 36)
                                .background(topic == t ? Color.sage.opacity(0.3) : Color.surface, in: Capsule())
                                .overlay(Capsule().stroke(topic == t ? Color.sage : Color.line))
                        }.buttonStyle(.plain).foregroundStyle(Color.ink)
                    } } }
                    SectionTitle(text: "2. Say it your way")
                    TextEditor(text: $message).frame(minHeight: 120).padding(8)
                        .background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                        .accessibilityIdentifier("reach-message")
                    SectionTitle(text: "3. Where to reply")
                    if !isBug || store.session == nil { Toggle(isBug ? "Do not attach my account" : "Send without my name", isOn: $anonymous).tint(Color.sage).accessibilityIdentifier("reach-anon") }
                    if !anonymous {
                        if let s = store.session { Text("Replies go to \(s.email)").foregroundStyle(Color.muted).font(.fh_subheadline) }
                        else { TextField("Your email, so we can reply", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                            .padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line)).accessibilityIdentifier("reach-email") }
                    }
                }
                BigButton(title: sending ? "Sending" : (isBug ? "Send the bug" : "Send feedback"), icon: "mail") { send() }
                    .opacity(canSend ? 1 : 0.5).disabled(!canSend).accessibilityIdentifier("reach-send")
                Text("We reply within 24 hours.").font(.fh_footnote).foregroundStyle(Color.muted)
            }
        }.padding(16) }
        .background(Color.cream).navigationTitle(isBug ? "Report a bug" : "Feedback").navigationBarTitleDisplayMode(.inline)
    }

    private func send() {
        sending = true
        let p = FeedbackService.payload(kind: kind, message: message.trimmingCharacters(in: .whitespacesAndNewlines), email: fromEmail,
                                        name: store.s.profile.name, anonymous: anonymous, uid: store.session?.uid ?? "", topic: topic)
        Task {
            let ok = await FeedbackService.send(p)
            await MainActor.run { queued = !ok; done = true; sending = false }
        }
    }
}
