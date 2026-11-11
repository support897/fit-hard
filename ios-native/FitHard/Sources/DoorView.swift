import SwiftUI
import AuthenticationServices
import GoogleSignIn

/// Door law (build 32). Page one shows ONLY the Google button, the Apple button and one small email button.
/// Email is its own page. Apple and Google continue: an existing account signs in, a new ID makes the account.
struct DoorView: View {
    @EnvironmentObject var store: Store
    @State private var showEmail = false
    @State private var busy = false; @State private var err = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                Spacer()
                BundleImage(name: "wally-welcome").frame(height: 150).frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore).accessibilityIdentifier("door-title")
                Spacer()
                appleButton()
                googleButton()
                Button { err = ""; showEmail = true } label: {
                    HStack(spacing: 6) { BrandIcon("mail"); Text("Use email").font(.fh_subheadline_b) }.foregroundStyle(Color.sage).padding(.vertical, 10).padding(.horizontal, 18)
                }.accessibilityIdentifier("door-email")
                if !err.isEmpty { Text(LocalizedStringKey(err)).font(.fh_footnote_b).foregroundStyle(Color.amber).multilineTextAlignment(.center).accessibilityIdentifier("door-error") }
                Spacer().frame(height: 8)
            }.padding(24)
            .background(Color.cream.ignoresSafeArea())
            .navigationDestination(isPresented: $showEmail) { EmailDoor() }
        }
    }

    @State private var rawNonce = ""
    func appleButton() -> some View {
        SignInWithAppleButton(.continue, onRequest: { req in
            rawNonce = Providers.nonce(); req.requestedScopes = [.fullName, .email]; req.nonce = Providers.sha256(rawNonce)
        }, onCompletion: { result in
            switch result {
            case .failure(let e):
                if (e as? ASAuthorizationError)?.code != .canceled { err = "Apple sign in did not finish. Try again, or use email." }
            case .success(let auth):
                guard let c = auth.credential as? ASAuthorizationAppleIDCredential, let t = c.identityToken, let tok = String(data: t, encoding: .utf8) else { err = "Apple did not send a sign in token. Try again."; return }
                let given = c.fullName?.givenName ?? ""
                let n = rawNonce, makeNew = true
                busy = true; err = ""
                Task {
                    do { try await store.providerDoor(creating: makeNew, provider: "apple.com", idToken: tok, accessToken: nil, rawNonce: n, name: given) }
                    catch { err = (error as? AccountError)?.errorDescription ?? "Try again." }
                    busy = false
                }
            }
        }).signInWithAppleButtonStyle(Color.isDark ? .white : .black)
        .frame(height: 48).clipShape(Capsule()).disabled(busy).accessibilityIdentifier("door-apple")
    }
    func googleButton() -> some View {
        Button {
            haptic(); err = ""
            if Cloud.offline { err = "Google sign in needs a connection. Use email, or try again online."; return }
            let makeNew = true
            busy = true
            Task {
                do {
                    let g = try await Providers.google()
                    try await store.providerDoor(creating: makeNew, provider: "google.com", idToken: g.idToken, accessToken: g.accessToken, rawNonce: nil, name: g.givenName)
                } catch {
                    if (error as NSError).code != GIDSignInError.canceled.rawValue { err = (error as? AccountError)?.errorDescription ?? "Google sign in did not finish. Try again, or use email." }
                }
                busy = false
            }
        } label: {
            HStack { BrandIcon("g.circle"); Text("Continue with Google").fontWeight(.semibold) }.frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Color.surface, in: Capsule()).overlay(Capsule().stroke(Color.line, lineWidth: 1)).foregroundStyle(Color.ink)
        }.buttonStyle(.plain).disabled(busy).accessibilityIdentifier("door-google")
    }

}

/// The email page: the email, the user's own password, sign up and sign in. The sign up name ask lives here.
/// Sign in only ever signs in. A wrong password shows an error and never creates an account.
struct EmailDoor: View {
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
            VStack(spacing: 14) {
                Picker("Account", selection: $creating) { Text("Create account").tag(true); Text("Sign in").tag(false) }
                    .pickerStyle(.segmented).labelsHidden().accessibilityIdentifier("door-toggle")
                if creating { field("Your name", text: $name).textContentType(.givenName) }
                field("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField(NSLocalizedString(creating ? "Choose a password (8+ characters)" : "Password", comment: ""), text: $pass).textContentType(creating ? .newPassword : .password)
                    .padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                if !err.isEmpty { Text(LocalizedStringKey(err)).font(.fh_footnote_b).foregroundStyle(Color.amber).accessibilityIdentifier("door-error") }
                if !info.isEmpty { Text(LocalizedStringKey(info)).font(.fh_footnote).foregroundStyle(Color.sage) }
                BigButton(title: busy ? "One moment" : (creating ? "Create account" : "Sign in")) { go() }
                    .disabled(busy || !valid).opacity(valid ? 1 : 0.4).accessibilityIdentifier("door-go")
                if !creating { Button("Forgot password?") { forgot() }.font(.fh_footnote) }
            }.padding(24)
        }.background(Color.cream.ignoresSafeArea()).navigationBarTitleDisplayMode(.inline)
        .onChange(of: creating) { _ in err = ""; info = "" }
    }

    func field(_ t: String, text: Binding<String>) -> some View {
        TextField(NSLocalizedString(t, comment: ""), text: text).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
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
