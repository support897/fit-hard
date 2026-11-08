import SwiftUI

/// The first screen. No app content shows until there is an account.
/// Create account asks for a name, an email and the user's own password. Sign in never creates an account.
struct DoorView: View {
    @EnvironmentObject var store: Store
    @State private var creating = true
    @State private var name = ""; @State private var email = ""; @State private var pass = ""
    @State private var busy = false; @State private var err = ""; @State private var info = ""

    var valid: Bool {
        let e = email.trimmingCharacters(in: .whitespaces)
        if creating { return !name.trimmingCharacters(in: .whitespaces).isEmpty && e.contains("@") && pass.count >= 8 }
        return e.contains("@") && pass.count >= 6
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                BundleImage(name: "wally-welcome").frame(height: 130).frame(maxWidth: .infinity)
                Text(creating ? "Create your account" : "Welcome back").font(.system(.largeTitle, design: .serif).bold()).foregroundStyle(Color.ink)
                    .accessibilityIdentifier("door-title")
                Text(creating ? "One account keeps your plan safe and on every phone." : "Sign in to pick up where you left off.").font(.subheadline).foregroundStyle(Color.muted)
                VStack(spacing: 10) {
                    providerButton("Continue with Apple", "apple.logo", "apple")
                    providerButton("Continue with Google", "g.circle", "google")
                }
                HStack { Rectangle().fill(Color.line).frame(height: 1); Text("or use email").font(.caption).foregroundStyle(Color.muted); Rectangle().fill(Color.line).frame(height: 1) }
                if creating {
                    field("Your name", text: $name).textContentType(.givenName)
                }
                field("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField(creating ? "Choose a password (8+ characters)" : "Password", text: $pass).textContentType(creating ? .newPassword : .password)
                    .padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                if !err.isEmpty { Text(err).font(.footnote.weight(.semibold)).foregroundStyle(Color.amber).accessibilityIdentifier("door-error") }
                if !info.isEmpty { Text(info).font(.footnote).foregroundStyle(Color.sage) }
                BigButton(title: busy ? "One moment" : (creating ? "Create account" : "Sign in")) { go() }
                    .disabled(busy || !valid).opacity(valid ? 1 : 0.4).accessibilityIdentifier("door-go")
                HStack {
                    Button(creating ? "I already have an account" : "Create a new account") { creating.toggle(); err = ""; info = "" }.font(.subheadline.weight(.semibold))
                        .accessibilityIdentifier("door-toggle")
                    Spacer()
                    if !creating { Button("Forgot password?") { forgot() }.font(.footnote) }
                }
            }.padding(24)
        }.background(Color.cream.ignoresSafeArea())
    }

    func field(_ t: String, text: Binding<String>) -> some View {
        TextField(t, text: text).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
    }
    func providerButton(_ title: String, _ icon: String, _ id: String) -> some View {
        Button {
            haptic()
            err = "\(id == "apple" ? "Apple" : "Google") sign in is not switched on yet. Please use email for now."
        } label: {
            HStack { Image(systemName: icon); Text(title).fontWeight(.semibold) }.frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Color.surface, in: Capsule()).overlay(Capsule().stroke(Color.line, lineWidth: 1)).foregroundStyle(Color.ink)
        }.buttonStyle(.plain).accessibilityIdentifier("door-\(id)")
    }

    func go() {
        busy = true; err = ""; info = ""
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        let n = name.trimmingCharacters(in: .whitespaces)
        let makeNew = creating
        Task {
            do {
                // Sign in only ever signs in. A wrong password shows an error and stays here.
                try await store.door(creating: makeNew, name: n, email: e, pass: pass)
            } catch { err = (error as? AccountError)?.errorDescription ?? "Try again." }
            busy = false
        }
    }
    func forgot() {
        let e = email.trimmingCharacters(in: .whitespaces); guard e.contains("@") else { err = "Type your email first."; return }
        Task { do { try await Cloud.reset(e); info = "Check your email for a reset link."; err = "" } catch { err = "Could not send that. Check the email." } }
    }
}
