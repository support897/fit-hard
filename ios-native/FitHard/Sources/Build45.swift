import SwiftUI
import UIKit
import Vision
import AVFoundation

// MARK: Build 45. A smarter photo match, and a guide with a looping video and step by step help.
// Matching is on the phone only. The photo never leaves it. It is still a best guess: the person confirms the name.

/// Better matching in four ways: the photo is turned upright and shrunk first (camera photos carry a hidden turn that
/// Vision ignores), three views of it are compared (whole, centre square, mirrored), any words printed on the machine are read,
/// and every confirmed match teaches the app what that machine looks like in this gym.
enum MatchBrain {
    struct Result { var ranked: [(Catalog.Machine, Float)]; var confident: Bool }

    static let lock = NSLock()
    static var cache: [String: VNFeaturePrintObservation] = [:]
    static let stop: Set<String> = ["machine", "the", "and", "with", "for", "seated", "standing"]

    static func normalized(_ ui: UIImage, maxSide: CGFloat = 900) -> UIImage {
        let s = max(ui.size.width, ui.size.height)
        let k: CGFloat = s > maxSide ? maxSide / s : 1
        let size = CGSize(width: max(1, ui.size.width * k), height: max(1, ui.size.height * k))
        let f = UIGraphicsImageRendererFormat(); f.scale = 1
        return UIGraphicsImageRenderer(size: size, format: f).image { _ in ui.draw(in: CGRect(origin: .zero, size: size)) }
    }

    static func variants(_ ui: UIImage) -> [UIImage] {
        let n = normalized(ui)
        var out = [n]
        if let cg = n.cgImage {
            let w = cg.width, h = cg.height, s = min(w, h)
            if let c = cg.cropping(to: CGRect(x: (w - s) / 2, y: (h - s) / 2, width: s, height: s)) { out.append(UIImage(cgImage: c)) }
        }
        let f = UIGraphicsImageRendererFormat(); f.scale = 1
        out.append(UIGraphicsImageRenderer(size: n.size, format: f).image { ctx in
            ctx.cgContext.translateBy(x: n.size.width, y: 0); ctx.cgContext.scaleBy(x: -1, y: 1); n.draw(at: .zero)
        })
        return out
    }

    static func tokens(_ s: String) -> Set<String> {
        Set(s.lowercased().split(whereSeparator: { !$0.isLetter }).map { String($0) }.filter { $0.count >= 3 && !stop.contains($0) })
    }
    static func overlap(_ name: String, _ words: Set<String>) -> Double {
        let t = tokens(name)
        guard !t.isEmpty, !words.isEmpty else { return 0 }
        return Double(t.filter { words.contains($0) }.count) / Double(t.count)
    }

    /// Words printed on the machine, read on the phone.
    static func readWords(_ ui: UIImage) -> Set<String> {
        guard let cg = ui.cgImage else { return [] }
        let req = VNRecognizeTextRequest()
        req.recognitionLevel = .accurate
        req.usesLanguageCorrection = false
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        var out = Set<String>()
        for o in req.results ?? [] {
            if let s = o.topCandidates(1).first?.string { out.formUnion(tokens(s)) }
        }
        return out
    }

    static func cachedPrint(_ key: String, _ make: () -> UIImage?) -> VNFeaturePrintObservation? {
        lock.lock(); let hit = cache[key]; lock.unlock()
        if let hit { return hit }
        guard let ui = make(), let p = MachineMatcher.print(for: normalized(ui)) else { return nil }
        lock.lock(); cache[key] = p; lock.unlock()
        return p
    }
    static func forget(_ machineId: String) {
        lock.lock(); cache = cache.filter { !$0.key.hasPrefix("own-\(machineId)-") }; lock.unlock()
    }

    typealias Ref = (m: Catalog.Machine, key: String, load: () -> UIImage?)

    /// The person's own photos first, then the three poses of the machine's first exercise, then one pose of the second.
    static func references(store: Store) -> [Ref] {
        var out: [Ref] = []
        for m in store.cat.machines {
            if let f = store.s.machinePhotos[m.id] { out.append((m, "own-\(m.id)-\(f)", { MachinePhotoStore.image(f) })) }
            let exs = m.exerciseIds.compactMap { store.cat.exercise($0) }.filter { store.animBase($0) != nil }
            for (i, ex) in exs.prefix(2).enumerated() {
                guard let base = store.animBase(ex) else { continue }
                for p in (i == 0 ? [1, 2, 3] : [2]) { out.append((m, "cat-\(base)-\(p)", { bundleUIImage("anim-\(base)-\(p)") })) }
            }
        }
        return out
    }

    static func prewarm(_ refs: [Ref]) { for r in refs { _ = cachedPrint(r.key, r.load) } }

    static func run(photo: UIImage, refs: [Ref], machines: [Catalog.Machine], exNames: [String: [String]]) -> Result {
        let vars = variants(photo)
        let pps = vars.compactMap { MachineMatcher.print(for: $0) }
        guard !pps.isEmpty else { return Result(ranked: [], confident: false) }
        let words = readWords(vars[0])
        var best: [String: Float] = [:]
        for r in refs {
            guard let rp = cachedPrint(r.key, r.load) else { continue }
            var d = pps.map { MachineMatcher.distance($0, rp) }.min() ?? 1
            if r.key.hasPrefix("own-") { d *= 0.85 }
            if best[r.m.id] == nil || d < best[r.m.id]! { best[r.m.id] = d }
        }
        var scored: [(Catalog.Machine, Float)] = []
        var textHit = false
        for m in machines {
            let look = best[m.id] ?? 1.0
            let nameHit = overlap(m.name, words)
            let exHit = (exNames[m.id] ?? []).map { overlap($0, words) }.max() ?? 0
            if nameHit >= 1 { textHit = true }
            scored.append((m, look - Float(0.35 * nameHit + 0.15 * exHit)))
        }
        scored.sort { $0.1 < $1.1 }
        let ranked = Array(scored.prefix(5))
        guard let b = ranked.first else { return Result(ranked: [], confident: false) }
        let margin: Float = ranked.count > 1 ? ranked[1].1 - b.1 : 1
        let conf = (b.1 <= 0.5 && margin >= 0.08) || (textHit && margin >= 0.05)
        return Result(ranked: ranked, confident: conf)
    }
}

// MARK: Video

/// A short silent loop. It plays a real video when one is bundled for the exercise and the person's avatar, and falls back to the drawn motion.
struct LoopingVideo: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> PlayerUIView { PlayerUIView(url: url) }
    func updateUIView(_ v: PlayerUIView, context: Context) {}
}
final class PlayerUIView: UIView {
    private let queue = AVQueuePlayer()
    private var looper: AVPlayerLooper?
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    init(url: URL) {
        super.init(frame: .zero)
        looper = AVPlayerLooper(player: queue, templateItem: AVPlayerItem(url: url))
        if let layer = self.layer as? AVPlayerLayer { layer.player = queue; layer.videoGravity = .resizeAspect }
        queue.isMuted = true
        queue.play()
    }
    required init?(coder: NSCoder) { fatalError("not used") }
}

struct ExerciseVideo: View {
    @EnvironmentObject var store: Store
    let ex: Exercise
    /// Videos are named vid-<picture name>-<girl|boy|nb>.mp4, or vid-<picture name>.mp4 for every avatar, and live in the media folder.
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
        if let u = ExerciseVideo.url(for: ex, base: store.animBase(ex), character: store.s.profile.character) {
            LoopingVideo(url: u).aspectRatio(16.0 / 9.0, contentMode: .fit).frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: 16))
                .accessibilityLabel(Text("Video of \(ex.name)"))
        } else if let a = store.animBase(ex) {
            ExerciseMotion(ex: ex, base: a, coach: false).aspectRatio(4.0 / 3.0, contentMode: .fit).frame(maxWidth: .infinity, maxHeight: 260)
        } else {
            ExerciseIcon(exercise: ex, size: 96).frame(maxWidth: .infinity)
        }
    }
}

/// Video, then the steps one by one, then a favourite heart.
struct ExerciseGuide: View {
    @EnvironmentObject var store: Store
    let ex: Exercise
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(ex.name).font(.fh_title3_b).foregroundStyle(Color.ink)
            ExerciseVideo(ex: ex)
            if let h = HelpText.help(for: ex.id) {
                Text(h.i).font(.fh_subheadline).foregroundStyle(Color.ink)
                ForEach(Array(h.s.enumerated()), id: \.offset) { i, s in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(i + 1)").font(.fh_caption_b).foregroundStyle(Color.white).frame(width: 24, height: 24).background(Color.sage, in: Circle())
                        Text(s).font(.fh_body).foregroundStyle(Color.ink).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                Text(h.c).font(.fh_subheadline_b).foregroundStyle(Color.sage)
            } else {
                Text(ex.cue).font(.fh_subheadline).foregroundStyle(Color.ink)
            }
            HStack(spacing: 8) {
                ExerciseHeart(e: ex)
                Text(store.s.favExercises.contains(ex.id) ? "Kept as a favourite. Fit Hard picks it more often." : "Tap the heart to keep it as a favourite").font(.fh_caption).foregroundStyle(Color.muted)
                Spacer(minLength: 0)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
