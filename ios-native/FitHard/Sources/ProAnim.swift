import SwiftUI
import WebKit

/// The studio exercise animation. The drawing code is the web app's own (anim-pro.js, anim-data*.js),
/// bundled as text and run inside a transparent WKWebView. No network. If an exercise has no motion track
/// the web view stays empty and the still pictures underneath show, as before.
enum ProAnimJS {
    static let source: String? = {
        func read(_ n: String) -> String? {
            for dir in [Optional<String>.none, "media", "Resources"] {
                if let p = Bundle.main.path(forResource: n, ofType: "js", inDirectory: dir),
                   let s = try? String(contentsOfFile: p, encoding: .utf8) { return s }
            }
            return nil
        }
        guard let a = read("anim-data"), let b = read("anim-data-expansion"), let c = read("anim-pro") else { return nil }
        return [a, b, c].joined(separator: "\n;\n")
    }()
    /// The look follows the person's pick: boy, girl or non binary.
    static func skin(_ character: String) -> String {
        character == "boy" ? "boy" : (character == "nonbinary" ? "nb" : "girl")
    }
    static func page(id: String, name: String, equipment: String, skin: String, still: Bool) -> String? {
        guard let js = source else { return nil }
        let opts: [String: Any] = ["id": id, "name": name, "eq": equipment, "skin": skin, "still": still]
        guard let d = try? JSONSerialization.data(withJSONObject: opts), let o = String(data: d, encoding: .utf8) else { return nil }
        return """
        <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#c{position:absolute;left:0;top:0;right:0;bottom:0}</style></head>
        <body><div id="c"></div><script>\(js)</script>
        <script>var o=\(o);var m=window.FitAnimPro&&FitAnimPro.mount(document.getElementById('c'),o.id,{skin:o.skin,name:o.name,equipment:o.eq,startAt:o.still?2.0:0,
        onPhase:function(p,r){try{window.webkit.messageHandlers.phase.postMessage({p:p,r:r})}catch(e){}}});if(m&&o.still){m.freeze(true)}</script></body></html>
        """
    }
}

final class PhaseSink: NSObject, WKScriptMessageHandler {
    var onPhase: (String, Int) -> Void
    init(_ f: @escaping (String, Int) -> Void) { onPhase = f }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        if let d = m.body as? [String: Any], let p = d["p"] as? String, let r = d["r"] as? Int { onPhase(p, r) }
    }
}

struct ProMotionWeb: UIViewRepresentable {
    let exId: String, name: String, equipment: String, skin: String, still: Bool
    var onPhase: (String, Int) -> Void
    final class Coord { var key = ""; var sink: PhaseSink? }
    func makeCoordinator() -> Coord { Coord() }
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        let sink = PhaseSink(onPhase)
        context.coordinator.sink = sink
        cfg.userContentController.add(sink, name: "phase")
        let w = WKWebView(frame: .zero, configuration: cfg)
        w.isOpaque = false; w.backgroundColor = .clear; w.scrollView.backgroundColor = .clear
        w.scrollView.isScrollEnabled = false; w.isUserInteractionEnabled = false
        w.isAccessibilityElement = false
        return w
    }
    func updateUIView(_ w: WKWebView, context: Context) {
        context.coordinator.sink?.onPhase = onPhase
        let key = "\(exId)|\(skin)|\(still)"
        guard context.coordinator.key != key else { return }
        context.coordinator.key = key
        if let h = ProAnimJS.page(id: exId, name: name, equipment: equipment, skin: skin, still: still) { w.loadHTMLString(h, baseURL: nil) }
    }
    static func dismantleUIView(_ w: WKWebView, coordinator: Coord) {
        w.configuration.userContentController.removeAllScriptMessageHandlers()
        w.stopLoading()
    }
}

/// Studio animation with Wally coaching, a rep counter and a step caption. Falls back to the still pictures.
struct ExerciseMotion: View {
    @EnvironmentObject var store: Store
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    let ex: Exercise
    let base: String
    var coach = true
    @State private var phase = ""
    @State private var rep = 0

    private var line: String {
        switch phase.lowercased() {
        case let p where p.contains("push") || p.contains("up") || p.contains("drive"): return "Push. You have this."
        case let p where p.contains("hold") || p.contains("top"): return "Hold it. Nice."
        case let p where p.contains("low") || p.contains("down") || p.contains("return"): return "Slow on the way back."
        default: return "Easy and steady. Wally is here."
        }
    }
    var body: some View {
        ZStack {
            AnimatedFrames(base: base)
            ProMotionWeb(exId: ex.id, name: ex.name, equipment: ex.equipment,
                         skin: ProAnimJS.skin(store.s.profile.character), still: reduceMotion) { p, r in
                DispatchQueue.main.async { phase = p; rep = r }
            }
        }
        .overlay(alignment: .bottom) {
            if coach && rep > 0 && !reduceMotion {
                HStack(spacing: 8) {
                    BundleImage(name: "wally-hello").frame(width: 34, height: 34)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(line).font(.fh_caption_b).foregroundStyle(Color.ink)
                        Text("Rep \(rep) of 2 · \(phase)").font(.fh_caption).foregroundStyle(Color.muted)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Color.cream.opacity(0.92), in: Capsule())
                .padding(8)
                .accessibilityElement(children: .combine)
            }
        }
        .overlay(alignment: .topTrailing) {
            if rep > 0 {
                Text(equipName(ex.equipment)).font(.fh_caption_b).foregroundStyle(Color.sage)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color.tint, in: Capsule()).padding(8)
            }
        }
        .accessibilityElement(children: .contain)
    }
}
