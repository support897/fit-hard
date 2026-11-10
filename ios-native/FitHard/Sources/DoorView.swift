import SwiftUI
import AuthenticationServices
import GoogleSignIn

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
                Text(LocalizedStringKey(creating ? "Create your account" : "Welcome back")).font(.fh_largeTitle_b).foregroundStyle(Color.ink)
                    .accessibilityIdentifier("door-title")
                Text(LocalizedStringKey(creating ? "One account keeps your plan safe and on every phone." : "Sign in to pick up where you left off.")).font(.fh_subheadline).foregroundStyle(Color.muted)
                VStack(spacing: 10) {
                    appleButton()
                    googleButton()
                }
                HStack { Rectangle().fill(Color.line).frame(height: 1); Text("or use email").font(.fh_caption).foregroundStyle(Color.muted); Rectangle().fill(Color.line).frame(height: 1) }
                if creating {
                    field("Your name", text: $name).textContentType(.givenName)
                }
                field("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField(creating ? "Choose a password (8+ characters)" : "Password", text: $pass).textContentType(creating ? .newPassword : .password)
                    .padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
                if !err.isEmpty { Text(LocalizedStringKey(err)).font(.fh_footnote_b).foregroundStyle(Color.amber).accessibilityIdentifier("door-error") }
                if !info.isEmpty { Text(LocalizedStringKey(info)).font(.fh_footnote).foregroundStyle(Color.sage) }
                BigButton(title: busy ? "One moment" : (creating ? "Create account" : "Sign in")) { go() }
                    .disabled(busy || !valid).opacity(valid ? 1 : 0.4).accessibilityIdentifier("door-go")
                HStack {
                    Button(creating ? "I already have an account" : "Create a new account") { creating.toggle(); err = ""; info = "" }.font(.fh_subheadline_b)
                        .accessibilityIdentifier("door-toggle")
                    Spacer()
                    if !creating { Button("Forgot password?") { forgot() }.font(.fh_footnote) }
                }
            }.padding(24)
        }.background(Color.cream.ignoresSafeArea())
    }

    func field(_ t: String, text: Binding<String>) -> some View {
        TextField(t, text: text).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
    }
    @State private var rawNonce = ""
    func appleButton() -> some View {
        SignInWithAppleButton(creating ? .signUp : .signIn, onRequest: { req in
            rawNonce = Providers.nonce(); req.requestedScopes = [.fullName, .email]; req.nonce = Providers.sha256(rawNonce)
        }, onCompletion: { result in
            switch result {
            case .failure(let e):
                if (e as? ASAuthorizationError)?.code != .canceled { err = "Apple sign in did not finish. Try again, or use email." }
            case .success(let auth):
                guard let c = auth.credential as? ASAuthorizationAppleIDCredential, let t = c.identityToken, let tok = String(data: t, encoding: .utf8) else { err = "Apple did not send a sign in token. Try again."; return }
                let given = c.fullName?.givenName ?? ""
                let n = rawNonce, makeNew = creating
                busy = true; err = ""
                Task {
                    do { try await store.providerDoor(creating: makeNew, provider: "apple.com", idToken: tok, accessToken: nil, rawNonce: n, name: given) }
                    catch { err = (error as? AccountError)?.errorDescription ?? "Try again." }
                    busy = false
                }
            }
        }).signInWithAppleButtonStyle(Color.pal == 1 || Color.pal == 2 ? .white : .black)
        .frame(height: 48).clipShape(Capsule()).disabled(busy).accessibilityIdentifier("door-apple")
    }
    func googleButton() -> some View {
        Button {
            haptic(); err = ""
            if Cloud.offline { err = "Google sign in needs a connection. Use email, or try again online."; return }
            let makeNew = creating
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
            HStack { BrandIcon("g.circle"); Text(LocalizedStringKey(creating ? "Sign up with Google" : "Sign in with Google")).fontWeight(.semibold) }.frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Color.surface, in: Capsule()).overlay(Capsule().stroke(Color.line, lineWidth: 1)).foregroundStyle(Color.ink)
        }.buttonStyle(.plain).disabled(busy).accessibilityIdentifier("door-google")
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
