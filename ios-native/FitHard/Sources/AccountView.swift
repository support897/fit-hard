import SwiftUI

/// The account is mandatory, so this only ever shows a signed-in account.
struct AccountSection: View {
    @EnvironmentObject var store: Store
    @State private var del = false; @State private var delErr = ""
    var body: some View {
        Section("Account") {
            if let x = store.session {
                Text(String(format: NSLocalizedString("Signed in as %@", comment: ""), x.email))
            } else {
                Text("Test mode. No account on this launch.").font(.fh_footnote).foregroundStyle(Color.muted)
            }
            if !store.syncNote.isEmpty { Text(store.syncNote).font(.fh_footnote).foregroundStyle(Color.muted) }
            if store.session != nil {
                Button("Back up now") { Task { await store.backupNow() } }
                Button("Sign out") { Task { await store.signOutKeep() } }.accessibilityIdentifier("sign-out")
                Button("Delete my account and cloud data", role: .destructive) { del = true }
            }
            if !delErr.isEmpty { Text(delErr).font(.fh_footnote).foregroundStyle(Color.amber) }
        }.themedRows()
        .confirmationDialog("Delete your account and everything backed up? Your data on this phone is erased too.", isPresented: $del, titleVisibility: .visible) {
            Button("Delete everything", role: .destructive) { Task { do { try await store.deleteAccountEverywhere() } catch { delErr = "Could not delete. Sign out, sign in again, and retry." } } }
        }
    }
}
