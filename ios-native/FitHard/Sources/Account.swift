import Foundation
import SwiftUI

/// Sign-in and backup using Firebase's public REST endpoints (no SDK, so nothing extra to ship).
/// The native app writes its own document (slice "native_v2") so it never touches the web app's data.
struct Session: Codable { var uid: String; var email: String; var idToken: String; var refreshToken: String }

enum AccountError: LocalizedError {
    case msg(String)
    var errorDescription: String? { if case .msg(let m) = self { return m }; return nil }
}

enum Cloud {
    static let key = "AIzaSyDZXZM0kamF2mZVHpKL2SK4JAHjsQIQI0g"   // public web identifier by design
    static let project = "fit-app-7f25f"

    private static func post(_ url: String, _ body: [String: Any]) async throws -> [String: Any] {
        var r = URLRequest(url: URL(string: url)!)
        r.httpMethod = "POST"; r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (d, _) = try await URLSession.shared.data(for: r)
        let j = (try JSONSerialization.jsonObject(with: d) as? [String: Any]) ?? [:]
        if let e = j["error"] as? [String: Any], let m = e["message"] as? String { throw AccountError.msg(friendly(m)) }
        return j
    }
    static func friendly(_ m: String) -> String {
        if m.contains("EMAIL_EXISTS") { return "That email already has an account. Try signing in." }
        if m.contains("INVALID_LOGIN") || m.contains("INVALID_PASSWORD") || m.contains("EMAIL_NOT_FOUND") { return "That email or password is not right." }
        if m.contains("WEAK_PASSWORD") { return "Use at least 6 characters." }
        if m.contains("INVALID_EMAIL") { return "That email does not look right." }
        if m.contains("TOO_MANY") { return "Too many tries. Wait a moment." }
        return "Something went wrong. Check your connection and try again."
    }
    private static func session(_ j: [String: Any], _ email: String) throws -> Session {
        guard let uid = j["localId"] as? String, let t = j["idToken"] as? String, let r = j["refreshToken"] as? String else { throw AccountError.msg("Sign-in failed.") }
        return Session(uid: uid, email: email, idToken: t, refreshToken: r)
    }
    static func signIn(_ email: String, _ pass: String) async throws -> Session {
        try session(await post("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=\(key)", ["email": email, "password": pass, "returnSecureToken": true]), email)
    }
    static func signUp(_ email: String, _ pass: String) async throws -> Session {
        try session(await post("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=\(key)", ["email": email, "password": pass, "returnSecureToken": true]), email)
    }
    static func reset(_ email: String) async throws {
        _ = try await post("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=\(key)", ["requestType": "PASSWORD_RESET", "email": email])
    }
    static func refresh(_ s: Session) async throws -> Session {
        var r = URLRequest(url: URL(string: "https://securetoken.googleapis.com/v1/token?key=\(key)")!)
        r.httpMethod = "POST"; r.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        r.httpBody = "grant_type=refresh_token&refresh_token=\(s.refreshToken)".data(using: .utf8)
        let (d, _) = try await URLSession.shared.data(for: r)
        let j = (try JSONSerialization.jsonObject(with: d) as? [String: Any]) ?? [:]
        guard let t = j["id_token"] as? String, let rt = j["refresh_token"] as? String else { throw AccountError.msg("Please sign in again.") }
        return Session(uid: s.uid, email: s.email, idToken: t, refreshToken: rt)
    }
    static func deleteAccount(_ s: Session) async throws {
        _ = try await post("https://identitytoolkit.googleapis.com/v1/accounts:delete?key=\(key)", ["idToken": s.idToken])
    }

    private static func docURL(_ uid: String) -> URL {
        URL(string: "https://firestore.googleapis.com/v1/projects/\(project)/databases/(default)/documents/users/\(uid)/slices/native_v2")!
    }
    static func save(_ s: Session, json: String) async throws {
        var r = URLRequest(url: docURL(s.uid)); r.httpMethod = "PATCH"
        r.setValue("Bearer \(s.idToken)", forHTTPHeaderField: "Authorization"); r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["fields": ["value": ["mapValue": ["fields": ["json": ["stringValue": json]]]]]]
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (d, resp) = try await URLSession.shared.data(for: r)
        if (resp as? HTTPURLResponse)?.statusCode ?? 500 >= 300 { _ = d; throw AccountError.msg("Could not back up right now.") }
    }
    /// nil means "nothing saved yet". A thrown error means "could not read": never overwrite on error.
    static func load(_ s: Session) async throws -> String? {
        var r = URLRequest(url: docURL(s.uid)); r.setValue("Bearer \(s.idToken)", forHTTPHeaderField: "Authorization")
        let (d, resp) = try await URLSession.shared.data(for: r)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 500
        if code == 404 { return nil }
        guard code < 300 else { throw AccountError.msg("Could not read your backup.") }
        let j = (try JSONSerialization.jsonObject(with: d) as? [String: Any]) ?? [:]
        let f = ((((j["fields"] as? [String: Any])?["value"] as? [String: Any])?["mapValue"] as? [String: Any])?["fields"] as? [String: Any])
        return (f?["json"] as? [String: Any])?["stringValue"] as? String
    }
    static func deleteData(_ s: Session) async {
        var r = URLRequest(url: docURL(s.uid)); r.httpMethod = "DELETE"; r.setValue("Bearer \(s.idToken)", forHTTPHeaderField: "Authorization")
        _ = try? await URLSession.shared.data(for: r)
    }
}

@MainActor
extension Store {
    private var sessionURL: URL { url.deletingLastPathComponent().appendingPathComponent("fithard-session.json") }
    func loadSession() {
        if let d = try? Data(contentsOf: sessionURL), let x = try? JSONDecoder().decode(Session.self, from: d) { session = x }
    }
    func storeSession(_ x: Session?) {
        session = x
        if let x = x, let d = try? JSONEncoder().encode(x) { try? d.write(to: sessionURL, options: .atomic) } else { try? FileManager.default.removeItem(at: sessionURL) }
    }
    /// Backs up after a short pause, and only after the cloud copy has been read successfully this session.
    func scheduleBackup() {
        guard session != nil, cloudReady else { return }
        backupTask?.cancel()
        backupTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled, let self = self else { return }
            await self.backupNow()
        }
    }
    func backupNow() async {
        guard var x = session, cloudReady, let d = try? JSONEncoder().encode(s), let js = String(data: d, encoding: .utf8) else { return }
        do { try await Cloud.save(x, json: js); syncNote = "Backed up just now" }
        catch {
            if let n = try? await Cloud.refresh(x) { x = n; storeSession(n); do { try await Cloud.save(n, json: js); syncNote = "Backed up just now"; return } catch {} }
            syncNote = "Will back up when you are online"
        }
    }
    /// After sign-in: read the cloud copy first. If it exists and this phone is brand new, adopt it; never overwrite on a failed read.
    func connect(_ x: Session) async {
        storeSession(x); cloudReady = false
        do {
            var cur = x
            var remote: String? = nil
            do { remote = try await Cloud.load(cur) } catch { cur = try await Cloud.refresh(cur); storeSession(cur); remote = try await Cloud.load(cur) }
            if let r = remote, let d = r.data(using: .utf8), let st = try? JSONDecoder().decode(AppState.self, from: d), st.onboarded, !s.onboarded {
                s = st; syncNote = "Welcome back. Your plan is restored."
                Notifier.rebuild(self)
            }
            cloudReady = true
            await backupNow()
        } catch { syncNote = "Could not reach your backup. Your changes stay safe on this phone." }
    }
    func signOutKeep() async {
        await backupNow()
        storeSession(nil); cloudReady = false; syncNote = ""
    }
    func deleteAccountEverywhere() async throws {
        guard let x = session else { return }
        let fresh = (try? await Cloud.refresh(x)) ?? x
        await Cloud.deleteData(fresh)
        try await Cloud.deleteAccount(fresh)
        storeSession(nil); cloudReady = false; resetAll()
    }
}
