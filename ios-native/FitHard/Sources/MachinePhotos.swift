import SwiftUI
import PhotosUI
import UIKit
import Vision

/// Saves a photo the user picks against a machine in the catalogue, and (build 35, item 1)
/// matches a photo of a machine against the catalogue on device. Matching is picture
/// similarity, never a promise: the person always confirms the name before anything is added.
enum MachinePhotoStore {
    static var dir: URL {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("machine-photos", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }
    static func safe(_ id: String) -> String { id.filter { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" } }
    static func save(_ data: Data, machineId: String) -> String? {
        guard let ui = UIImage(data: data), let jpg = ui.jpegData(compressionQuality: 0.8) else { return nil }
        let name = "\(safe(machineId)).jpg"
        do { try jpg.write(to: dir.appendingPathComponent(name), options: .atomic); return name } catch { return nil }
    }
    static func image(_ name: String) -> UIImage? { UIImage(contentsOfFile: dir.appendingPathComponent(name).path) }
    static func remove(_ name: String) { try? FileManager.default.removeItem(at: dir.appendingPathComponent(name)) }
}

struct MachineDetail: View {
    @EnvironmentObject var store: Store
    let m: Catalog.Machine
    @State private var item: PhotosPickerItem? = nil
    var body: some View {
        List {
            Section("Machine photos") {
                if let f = store.s.machinePhotos[m.id], let ui = MachinePhotoStore.image(f) {
                    Image(uiImage: ui).resizable().scaledToFit().frame(maxHeight: 220).frame(maxWidth: .infinity).accessibilityLabel("Your photo")
                    Button("Remove photo", role: .destructive) { MachinePhotoStore.remove(f); store.s.machinePhotos[m.id] = nil }
                }
                PhotosPicker(selection: $item, matching: .images) { BrandLabel("Add a photo", icon: "plus") }.accessibilityIdentifier("machine-photo-add")
                Text("Your photo of this machine helps Fit Hard match it next time you photograph it.").font(.fh_footnote).foregroundStyle(Color.muted)
            }.listRowBackground(Color.surface)
            Section {
                ForEach(m.exerciseIds.compactMap { store.cat.exercise($0) }) { e in ExerciseRow(e: e).listRowBackground(Color.clear) }
            }
        }.scrollContentBackground(.hidden).background(Color.cream).navigationTitle(m.name)
        .onChange(of: item) { new in
            guard let new = new else { return }
            Task {
                if let d = try? await new.loadTransferable(type: Data.self), let name = MachinePhotoStore.save(d, machineId: m.id) {
                    await MainActor.run { store.s.machinePhotos[m.id] = name; store.say("Photo saved") }
                }
                await MainActor.run { item = nil }
            }
        }
    }
}

// MARK: Photo a machine (build 35, item 1)

/// The same bundle lookup BundleImage draws with, as a plain image for matching.
func bundleUIImage(_ name: String) -> UIImage? {
    if let p = Bundle.main.path(forResource: name, ofType: "webp", inDirectory: "media"), let ui = UIImage(contentsOfFile: p) { return ui }
    if let p = Bundle.main.path(forResource: name, ofType: "webp"), let ui = UIImage(contentsOfFile: p) { return ui }
    if let p = Bundle.main.path(forResource: name, ofType: "png"), let ui = UIImage(contentsOfFile: p) { return ui }
    return nil
}

/// On-device picture similarity with Vision feature prints. A small distance means the
/// pictures look alike; it is not recognition, and the view never presents it as fact.
enum MachineMatcher {
    static func print(for ui: UIImage) -> VNFeaturePrintObservation? {
        guard let cg = ui.cgImage else { return nil }
        let req = VNGenerateImageFeaturePrintRequest()
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        return req.results?.first as? VNFeaturePrintObservation
    }
    static func distance(_ a: VNFeaturePrintObservation, _ b: VNFeaturePrintObservation) -> Float {
        var d: Float = 1
        try? a.computeDistance(&d, to: b)
        return d
    }
    /// Rank catalogue machines against the photo: each machine scores its closest reference.
    static func rank(photo: UIImage, references: [(Catalog.Machine, UIImage)]) -> [(Catalog.Machine, Float)] {
        guard let pp = print(for: photo) else { return [] }
        var best: [String: (Catalog.Machine, Float)] = [:]
        for (m, ui) in references {
            guard let rp = print(for: ui) else { continue }
            let d = distance(pp, rp)
            if best[m.id] == nil || d < best[m.id]!.1 { best[m.id] = (m, d) }
        }
        return best.values.sorted { $0.1 < $1.1 }
    }
    /// A match is only called confident when it is close AND clearly ahead of the next machine.
    static func isConfident(_ ranked: [(Catalog.Machine, Float)]) -> Bool {
        guard let b = ranked.first, b.1 <= 0.55 else { return false }
        return ranked.count < 2 || ranked[1].1 - b.1 >= 0.08
    }
}

struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) var dismiss
    func makeCoordinator() -> Coord { Coord(self) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        c.delegate = context.coordinator
        return c
    }
    func updateUIViewController(_ c: UIImagePickerController, context: Context) {}
    final class Coord: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let ui = info[.originalImage] as? UIImage { parent.onImage(ui) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

struct MachinePhotoMatchView: View {
    @EnvironmentObject var store: Store
    @State private var pickerItem: PhotosPickerItem? = nil
    @State private var showCamera = false
    @State private var working = false
    @State private var ranked: [(Catalog.Machine, Float)] = []
    @State private var candidate: Catalog.Machine? = nil
    @State private var confident = false
    @State private var thumb: UIImage? = nil
    @State private var chooseRoutine = false
    @State private var addedTo: String? = nil

    /// Reference pictures: the person's own saved photo of a machine first, then the first
    /// catalogue picture of a linked exercise. Machines with neither stay name search only,
    /// and are named in the build note; no picture is ever invented for them.
    func referenceImages() -> [(Catalog.Machine, UIImage)] {
        var out: [(Catalog.Machine, UIImage)] = []
        for m in store.cat.machines {
            if let f = store.s.machinePhotos[m.id], let ui = MachinePhotoStore.image(f) { out.append((m, ui)) }
            if let ex = m.exerciseIds.compactMap({ store.cat.exercise($0) }).first(where: { store.animBase($0) != nil }),
               let base = store.animBase(ex), let ui = bundleUIImage("anim-\(base)-1") { out.append((m, ui)) }
        }
        return out
    }

    func match(_ ui: UIImage) {
        thumb = ui; working = true; ranked = []; candidate = nil; addedTo = nil
        let refs = referenceImages()
        Task.detached {
            let r = MachineMatcher.rank(photo: ui, references: refs)
            await MainActor.run {
                ranked = r; working = false
                confident = MachineMatcher.isConfident(r)
                if confident { candidate = r.first?.0 }
            }
        }
    }

    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 14) {
            Text("Take a photo of the machine in front of you. Fit Hard compares it with the pictures it knows and shows you the closest match.").foregroundStyle(Color.muted)
            HStack(spacing: 10) {
                BigButton(title: "Take a photo", icon: "camera") { showCamera = true }.accessibilityIdentifier("machine-photo-take")
                PhotosPicker(selection: $pickerItem, matching: .images) { BrandLabel("Pick a photo", icon: "plus") }.accessibilityIdentifier("machine-photo-pick")
            }
            if let t = thumb { Image(uiImage: t).resizable().scaledToFit().frame(maxHeight: 200).frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: 14)) }
            if working { HStack { ProgressView(); Text("Comparing with the catalogue...") }.foregroundStyle(Color.muted) }
            if let m = candidate {
                MachineMatchCard(m: m, confident: confident, addedTo: addedTo,
                    onAdd: { chooseRoutine = true },
                    onNo: { candidate = nil; confident = false })
            } else if !working && !ranked.isEmpty {
                Text("Not sure. Could it be one of these?").font(.fh_headline).foregroundStyle(Color.ink)
                ForEach(Array(ranked.prefix(3)), id: \.0.id) { r in
                    Button { candidate = r.0; confident = false } label: {
                        HStack { if let e = r.0.exerciseIds.compactMap({ store.cat.exercise($0) }).first { ExerciseIcon(exercise: e, size: 40) }
                            Text(r.0.name).font(.fh_subheadline_b).foregroundStyle(Color.ink); Spacer(); BrandIcon("chevron.right").foregroundStyle(Color.muted) }
                            .padding(12).background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain).accessibilityIdentifier("match-candidate-\(r.0.id)")
                }
                Text("Or find it by name in the Machines list.").foregroundStyle(Color.muted)
            }
            Text("Fit Hard compares pictures. It can be wrong, so check the name before you add anything. Nothing is added until you tap.").font(.fh_footnote).foregroundStyle(Color.muted)
        }.padding(16) }
        .background(Color.cream).navigationTitle("Photo a machine").navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCamera) { CameraPicker { ui in match(ui) } }
        .sheet(isPresented: $chooseRoutine) {
            NavigationStack {
                List {
                    if store.s.routines.isEmpty {
                        Text("You have no routines yet.")
                        Button("Build my routines") { store.generateRoutine() }
                    }
                    ForEach(store.s.routines) { r in
                        Button(r.name) { if let m = candidate { add(m, to: r) } }
                    }
                }.navigationTitle("Add to which routine?").navigationBarTitleDisplayMode(.inline)
            }
        }
        .onChange(of: pickerItem) { new in
            guard let new = new else { return }
            Task {
                if let d = try? await new.loadTransferable(type: Data.self), let ui = UIImage(data: d) { await MainActor.run { match(ui) } }
                await MainActor.run { pickerItem = nil }
            }
        }
    }

    func add(_ m: Catalog.Machine, to r: Routine) {
        guard let j = store.s.routines.firstIndex(where: { $0.id == r.id }) else { return }
        for eid in m.exerciseIds where !store.s.routines[j].exIds.contains(eid) { store.s.routines[j].exIds.append(eid) }
        store.s.routines[j].customized = true
        store.syncRoutineDays()
        addedTo = r.name; chooseRoutine = false
        store.say("Added to \(r.name)")
    }
}

/// One matched machine: its name, its designed icon and the simple how to, with the
/// confirm step. Nothing here adds anything on its own.
struct MachineMatchCard: View {
    @EnvironmentObject var store: Store
    let m: Catalog.Machine
    let confident: Bool
    let addedTo: String?
    let onAdd: () -> Void
    let onNo: () -> Void
    var body: some View {
        Card {
            Text(confident ? "This looks like" : "Could this be").font(.fh_caption_b).foregroundStyle(Color.muted)
            HStack(spacing: 12) {
                if let e = m.exerciseIds.compactMap({ store.cat.exercise($0) }).first { ExerciseIcon(exercise: e, size: 64) }
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.name).font(.fh_title3_b).foregroundStyle(Color.ink)
                    if let e = m.exerciseIds.compactMap({ store.cat.exercise($0) }).first { Text(e.cue).font(.fh_caption).foregroundStyle(Color.muted) }
                }
            }
            if let a = addedTo {
                Text("Added to \(a).").font(.fh_subheadline_b).foregroundStyle(Color.sage)
            } else {
                HStack(spacing: 10) {
                    BigButton(title: "Add to my routine", icon: "plus") { onAdd() }.accessibilityIdentifier("match-add")
                    BigButton(title: "Not this one", filled: false) { onNo() }.accessibilityIdentifier("match-no")
                }
            }
            NavigationLink { MachineDetail(m: m) } label: { BrandLabel("See how to use it", icon: "chevron.right") }.accessibilityIdentifier("match-see")
        }
    }
}
