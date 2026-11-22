import SwiftUI
import AVFoundation

// MARK: Exercise clips (build 53). Real video demos, matched by name, no mapping table.
// The clip for an exercise is <slug>.mp4, where slug = exercise id lowercased with underscores turned into hyphens
// (Leg_Press -> leg-press). 840 clips are about 220 MB (HEVC), too big to bundle, so each one downloads the first time it is
// opened, is kept in the Caches folder, and plays from there after that. No clip (404), no network, or still loading:
// the existing animation or still shows, never a blank. Clips are 1152x768 (3:2), silent, 10 s seamless loops.
// Playing: only while a set runs (training) or while the screen is visible (detail, help). It stops on the first frame.

@MainActor enum Clips {
    static let base = URL(string: "https://pub-daa5a9147205405a9e7570408c0f95fa.r2.dev")!
    static func slug(_ id: String) -> String { id.lowercased().replacingOccurrences(of: "_", with: "-") }
    static let dir: URL = {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fh-clips", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    /// slug -> byte size, from clips.json (bundled copy first, refreshed from the clip host each launch).
    /// A slug missing from it has no clip, so it is never asked for. A cached file of the wrong size is a replaced clip: fetched again.
    private(set) static var manifest: [String: Int] = {
        if let u = Bundle.main.url(forResource: "clips", withExtension: "json"), let d = try? Data(contentsOf: u),
           let m = try? JSONDecoder().decode([String: Int].self, from: d) { return m }
        return [:]
    }()
    static func has(_ slug: String) -> Bool { manifest.isEmpty || manifest[slug] != nil }
    private static var refreshed = false
    static func refreshManifest() async {
        guard !refreshed else { return }; refreshed = true
        guard let (d, r) = try? await URLSession.shared.data(from: base.appendingPathComponent("clips.json")),
              (r as? HTTPURLResponse)?.statusCode == 200, let m = try? JSONDecoder().decode([String: Int].self, from: d), m.count > 100 else { return }
        manifest = m
    }
    static func cached(_ slug: String) -> URL? {
        let u = dir.appendingPathComponent(slug + ".mp4")
        guard let n = (try? FileManager.default.attributesOfItem(atPath: u.path))?[.size] as? Int else { return nil }
        if let want = manifest[slug], want != n { return nil }
        return u
    }
    static func thumb(_ id: String) -> URL { base.appendingPathComponent(slug(id) + ".jpg") }
    /// Download one clip into the cache. Returns the file, or nil (no clip, offline).
    @discardableResult static func fetch(_ slug: String) async -> URL? {
        if let u = cached(slug) { return u }
        guard has(slug) else { return nil }
        var req = URLRequest(url: base.appendingPathComponent(slug + ".mp4")); req.timeoutInterval = 30
        guard let (tmp, resp) = try? await URLSession.shared.download(for: req), (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        let dest = dir.appendingPathComponent(slug + ".mp4")
        try? FileManager.default.removeItem(at: dest)
        do { try FileManager.default.moveItem(at: tmp, to: dest) } catch { return nil }
        return dest
    }
    /// Warm the cache for a routine so every clip is on the phone before the first set. Three at a time, in order.
    static func prefetch(_ ids: [String]) async {
        await refreshManifest()
        let slugs = ids.map(slug).filter { cached($0) == nil && has($0) }
        guard !slugs.isEmpty else { return }
        await withTaskGroup(of: Void.self) { g in
            var it = slugs.makeIterator()
            for _ in 0..<3 { if let s = it.next() { g.addTask { _ = await fetch(s) } } }
            while await g.next() != nil { if let s = it.next() { g.addTask { _ = await fetch(s) } } }
        }
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
        guard url == nil else { return }
        if let u = await Clips.fetch(slug) { url = u }
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
    @State private var aspect: CGFloat = 1.5

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
            .aspectRatio(aspect, contentMode: .fit).frame(maxWidth: .infinity)
            .task(id: u) { aspect = await ClipAspect.of(u) }
            .background(Color.cream)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .onAppear { visible = true }.onDisappear { visible = false }
            .overlay(alignment: .bottomTrailing) {
                if fullScreen { BrandIcon("arrow.expand").font(.fh_subheadline_b).foregroundStyle(Color.sage).frame(width: 44, height: 44).background(Color.tint, in: Circle()).padding(6) }
            }
            .onTapGesture { if fullScreen { full = true } }
            .fullScreenCover(isPresented: $full) { FullClip(url: u, name: ex.name, aspect: aspect) }
            .accessibilityLabel(Text("Video of \(ex.name)"))
    }
}

struct FullClip: View {
    @Environment(\.dismiss) var dismiss
    let url: URL
    let name: String
    var aspect: CGFloat = 1.5
    var body: some View {
        ZStack {
            Color.cream.ignoresSafeArea()
            VStack(spacing: 14) {
                HStack { Spacer(); Button { dismiss() } label: { BrandIcon("xmark").font(.fh_title3_b).foregroundStyle(Color.ink).frame(width: 44, height: 44).background(Color.tint, in: Circle()) }.accessibilityLabel("Close full screen") }
                Spacer(minLength: 0)
                ClipPlayer(url: url, playing: true).aspectRatio(aspect, contentMode: .fit).frame(maxWidth: .infinity)
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
        AsyncImage(url: Clips.has(Clips.slug(ex.id)) ? Clips.thumb(ex.id) : nil) { p in
            if let i = p.image { i.resizable().scaledToFit() }
            else { BrandIcon("figure.strengthtraining.traditional") }
        }.frame(width: 64, height: 64).background(Color.tint, in: RoundedRectangle(cornerRadius: 12)).clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

/// A clip's real shape (width / height). Almost all are 3:2; a few are portrait. Aspect fit on the real shape, never a crop.
enum ClipAspect {
    static func of(_ u: URL) async -> CGFloat {
        let a = AVURLAsset(url: u)
        if let t = try? await a.loadTracks(withMediaType: .video).first, let s = try? await t.load(.naturalSize), s.width > 0, s.height > 0 { return s.width / s.height }
        return 1.5
    }
}
