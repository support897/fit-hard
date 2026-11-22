import SwiftUI
import AVFoundation

// MARK: Exercise clips (build 53). Real video demos, matched by name, no mapping table.
// The clip for an exercise is <slug>.mp4, where slug = exercise id lowercased with underscores turned into hyphens
// (Leg_Press -> leg-press). 805 clips are about 820 MB, too big to bundle, so each one downloads the first time it is
// opened, is kept in the Caches folder, and plays from there after that. No clip (404), no network, or still loading:
// the existing animation or still shows, never a blank. Clips are 1152x768 (3:2), silent, 10 s seamless loops.
// Playing: only while a set runs (training) or while the screen is visible (detail, help). It stops on the first frame.

enum Clips {
    static let base = URL(string: "https://pub-daa5a9147205405a9e7570408c0f95fa.r2.dev")!
    static func slug(_ id: String) -> String { id.lowercased().replacingOccurrences(of: "_", with: "-") }
    static let dir: URL = {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fh-clips", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    static func cached(_ slug: String) -> URL? {
        let u = dir.appendingPathComponent(slug + ".mp4")
        return FileManager.default.fileExists(atPath: u.path) ? u : nil
    }
    static func thumb(_ id: String) -> URL { base.appendingPathComponent(slug(id) + ".jpg") }
    // A 404 is remembered for 3 days so an exercise without a clip is not asked for again and again.
    private static let missKey = "fh.clip.miss"
    static func isMiss(_ slug: String) -> Bool {
        let m = UserDefaults.standard.dictionary(forKey: missKey) as? [String: Double] ?? [:]
        return (m[slug]).map { Date().timeIntervalSince1970 - $0 < 3 * 86400 } ?? false
    }
    static func markMiss(_ slug: String) {
        var m = UserDefaults.standard.dictionary(forKey: missKey) as? [String: Double] ?? [:]
        m[slug] = Date().timeIntervalSince1970
        UserDefaults.standard.set(m, forKey: missKey)
    }
}

@MainActor final class ClipLoader: ObservableObject {
    @Published var url: URL?
    private let slug: String
    init(id: String) {
        slug = Clips.slug(id)
        url = Clips.cached(slug)
    }
    func load() async {
        guard url == nil, !Clips.isMiss(slug) else { return }
        var req = URLRequest(url: Clips.base.appendingPathComponent(slug + ".mp4"))
        req.timeoutInterval = 30
        do {
            let (tmp, resp) = try await URLSession.shared.download(for: req)
            guard let h = resp as? HTTPURLResponse else { return }
            if h.statusCode == 200 {
                let dest = Clips.dir.appendingPathComponent(slug + ".mp4")
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: tmp, to: dest)
                url = dest
            } else if h.statusCode == 404 { Clips.markMiss(slug) }
        } catch {}
    }
}

/// A silent looping player. playing true: restart from the first frame and loop. playing false: stop on the first frame.
struct ClipPlayer: UIViewRepresentable {
    let url: URL
    let playing: Bool
    func makeUIView(context: Context) -> ClipUIView { ClipUIView(url: url) }
    func updateUIView(_ v: ClipUIView, context: Context) { v.set(playing: playing) }
}
final class ClipUIView: UIView {
    private let player = AVQueuePlayer()
    private var looper: AVPlayerLooper?
    private var on = false
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    init(url: URL) {
        super.init(frame: .zero)
        backgroundColor = .clear
        looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
        if let l = layer as? AVPlayerLayer { l.player = player; l.videoGravity = .resizeAspect }
        player.isMuted = true
        player.pause()
    }
    required init?(coder: NSCoder) { fatalError("not used") }
    func set(playing: Bool) {
        guard playing != on else { return }
        on = playing
        player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
        if playing { player.play() } else { player.pause() }
    }
}

/// The exercise picture: the real clip when there is one, else the drawn motion, else the icon. Always aspect fit, never cropped.
struct ExerciseVideo: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    let ex: Exercise
    var playing = true
    var fullScreen = false
    var iconFallback = true
    @StateObject private var loader: ClipLoader
    @State private var visible = false
    @State private var full = false

    init(ex: Exercise, playing: Bool = true, fullScreen: Bool = false, iconFallback: Bool = true) {
        self.ex = ex; self.playing = playing; self.fullScreen = fullScreen; self.iconFallback = iconFallback
        _loader = StateObject(wrappedValue: ClipLoader(id: ex.id))
    }

    /// Bundled videos named vid-<picture name>-<girl|boy|nb>.mp4 or vid-<picture name>.mp4 still win when present.
    static func url(for ex: Exercise, base: String?, character: String) -> URL? {
        let who = character == "nonbinary" ? "nb" : (character.isEmpty ? "girl" : character)
        for n in [base, ex.id].compactMap({ $0 }) {
            for name in ["vid-\(n)-\(who)", "vid-\(n)"] {
                if let u = Bundle.main.url(forResource: name, withExtension: "mp4", subdirectory: "media") ?? Bundle.main.url(forResource: name, withExtension: "mp4") { return u }
            }
        }
        return nil
    }

    var body: some View {
        Group {
            if let u = ExerciseVideo.url(for: ex, base: store.animBase(ex), character: store.s.profile.character) ?? loader.url { clip(u) }
            else if let a = store.animBase(ex) { ExerciseMotion(ex: ex, base: a, coach: false).aspectRatio(4.0 / 3.0, contentMode: .fit).frame(maxWidth: .infinity, maxHeight: 300) }
            else if iconFallback { ExerciseIcon(exercise: ex, size: 96).frame(maxWidth: .infinity) }
        }.task { await loader.load() }
    }

    func clip(_ u: URL) -> some View {
        ClipPlayer(url: u, playing: playing && visible && !full && !reduceMotion)
            .aspectRatio(3.0 / 2.0, contentMode: .fit).frame(maxWidth: .infinity)
            .background(Color.cream)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .onAppear { visible = true }.onDisappear { visible = false }
            .overlay(alignment: .bottomTrailing) {
                if fullScreen { BrandIcon("arrow.expand").font(.fh_subheadline_b).foregroundStyle(Color.sage).frame(width: 44, height: 44).background(Color.tint, in: Circle()).padding(6) }
            }
            .onTapGesture { if fullScreen { full = true } }
            .fullScreenCover(isPresented: $full) { FullClip(url: u, name: ex.name) }
            .accessibilityLabel(Text("Video of \(ex.name)"))
    }
}

struct FullClip: View {
    @Environment(\.dismiss) var dismiss
    let url: URL
    let name: String
    var body: some View {
        ZStack {
            Color.cream.ignoresSafeArea()
            VStack(spacing: 14) {
                HStack { Spacer(); Button { dismiss() } label: { BrandIcon("xmark").font(.fh_title3_b).foregroundStyle(Color.ink).frame(width: 44, height: 44).background(Color.tint, in: Circle()) }.accessibilityLabel("Close full screen") }
                Spacer(minLength: 0)
                ClipPlayer(url: url, playing: true).aspectRatio(3.0 / 2.0, contentMode: .fit).frame(maxWidth: .infinity)
                Text(name).font(.fh_title3_b).foregroundStyle(Color.ink).multilineTextAlignment(.center)
                Spacer(minLength: 0)
            }.padding(16)
        }
    }
}

/// List thumbnail: the first frame of the clip (a small jpg beside it), else the existing picture.
struct ExerciseThumb: View {
    let ex: Exercise
    let base: String?
    var body: some View {
        AsyncImage(url: Clips.thumb(ex.id)) { p in
            if let i = p.image { i.resizable().scaledToFit() }
            else if let b = base { AnimatedFrames(base: b) }
            else { BrandIcon("figure.strengthtraining.traditional") }
        }.frame(width: 64, height: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 12)).clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
