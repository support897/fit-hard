import SwiftUI
import AuthenticationServices
import CryptoKit
import GoogleSignIn

/// Real Apple and Google doors. Both end in Firebase signInWithIdp, so they land in the same account store as the email road.
enum Providers {
    /// iOS OAuth client of the Fit Hard Firebase project (a public identifier, not a secret).
    static let googleClientID = "391027322388-reldvu6krq2mdpqqjkhrvqmgjl01icqk.apps.googleusercontent.com"

    static func nonce(_ length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var out = ""
        while out.count < length {
            var bytes = [UInt8](repeating: 0, count: 16)
            if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess { bytes = (0..<16).map { _ in UInt8.random(in: 0...255) } }
            for b in bytes where out.count < length && b < UInt8(charset.count * (256 / charset.count)) { out.append(charset[Int(b) % charset.count]) }
        }
        return out
    }
    static func sha256(_ s: String) -> String { SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined() }

    @MainActor static func topController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive } ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController ?? scene?.windows.first?.rootViewController
        while let p = top?.presentedViewController { top = p }
        return top
    }

    struct GoogleResult { let idToken: String; let accessToken: String; let givenName: String }
    @MainActor static func google() async throws -> GoogleResult {
        guard let vc = topController() else { throw AccountError.msg("Could not open Google sign in. Try again.") }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: googleClientID)
        let r = try await GIDSignIn.sharedInstance.signIn(withPresenting: vc)
        guard let id = r.user.idToken?.tokenString else { throw AccountError.msg("Google did not send a sign in token. Try again.") }
        return GoogleResult(idToken: id, accessToken: r.user.accessToken.tokenString, givenName: r.user.profile?.givenName ?? "")
    }
}

extension Store {
    /// Same rule as the email road: Sign in never creates an account. If Firebase just made a brand new one, remove it and say so.
    func providerDoor(creating: Bool, provider: String, idToken: String, accessToken: String?, rawNonce: String?, name: String) async throws {
        let (x, isNew) = try await Cloud.signInWithIdp(provider: provider, idToken: idToken, accessToken: accessToken, rawNonce: rawNonce)
        if !creating && isNew {
            try? await Cloud.deleteAccount(x)
            throw AccountError.msg("There is no Fit Hard account for that ID yet. Tap Create a new account first.")
        }
        if isNew && !name.isEmpty { s.profile.name = name }
        await connect(x)
    }
}
