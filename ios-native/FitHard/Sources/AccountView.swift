import SwiftUI

struct AuthSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var email = ""; @State private var pass = ""; @State private var busy = false; @State private var err = ""; @State private var info = ""
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                BundleImage(name: "wally-hello").frame(height: 120).frame(maxWidth: .infinity)
                Text("Sign in or create your account").font(.system(.title2, design: .serif).bold()).foregroundStyle(Color.ink)
                Text("One button does both. Your plan is backed up and follows you.").font(.subheadline).foregroundStyle(Color.muted)
                TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
                SecureField("Password (6+ characters)", text: $pass).textContentType(.password).padding(14).background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
                if !err.isEmpty { Text(err).font(.footnote).foregroundStyle(Color.amber) }
                if !info.isEmpty { Text(info).font(.footnote).foregroundStyle(Color.sage) }
                BigButton(title: busy ? "One moment" : "Continue") { go() }.disabled(busy || email.isEmpty || pass.count < 6).opacity(email.isEmpty || pass.count < 6 ? 0.4 : 1)
                Button("Forgot password?") { forgot() }.font(.footnote)
                Spacer()
            }.padding(24).background(Color.cream)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } } }
        }
    }
    func go() {
        busy = true; err = ""
        Task {
            let e = email.trimmingCharacters(in: .whitespaces).lowercased()
            do {
                let x: Session
                do { x = try await Cloud.signIn(e, pass) }
                catch { x = try await Cloud.signUp(e, pass) }   // unknown email: create the account
                await store.connect(x); dismiss()
            } catch { err = (error as? AccountError)?.errorDescription ?? "Try again." }
            busy = false
        }
    }
    func forgot() {
        let e = email.trimmingCharacters(in: .whitespaces); guard e.contains("@") else { err = "Type your email first."; return }
        Task { do { try await Cloud.reset(e); info = "Check your email for a reset link."; err = "" } catch { err = "Could not send that. Check the email." } }
    }
}

struct AccountSection: View {
    @EnvironmentObject var store: Store
    @State private var show = false; @State private var del = false; @State private var delErr = ""
    var body: some View {
        Section("Account") {
            if let x = store.session {
                Text("Signed in as \(x.email)")
                if !store.syncNote.isEmpty { Text(store.syncNote).font(.footnote).foregroundStyle(Color.muted) }
                Button("Back up now") { Task { await store.backupNow() } }
                Button("Sign out") { Task { await store.signOutKeep() } }
                Button("Delete my account and cloud data", role: .destructive) { del = true }
                if !delErr.isEmpty { Text(delErr).font(.footnote).foregroundStyle(Color.amber) }
            } else {
                Text("Not signed in. Your data is only on this phone.").font(.footnote).foregroundStyle(Color.muted)
                Button("Sign in or create account") { show = true }
            }
        }
        .sheet(isPresented: $show) { AuthSheet() }
        .confirmationDialog("Delete your account and everything backed up? Your data on this phone is erased too.", isPresented: $del, titleVisibility: .visible) {
            Button("Delete everything", role: .destructive) { Task { do { try await store.deleteAccountEverywhere() } catch { delErr = "Could not delete. Sign out, sign in again, and retry." } } }
        }
    }
}
