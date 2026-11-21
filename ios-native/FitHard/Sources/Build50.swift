import SwiftUI
import UIKit

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
