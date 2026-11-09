import SwiftUI
import PhotosUI

/// Saves a photo the user picks against a machine in the catalogue. The app never claims to recognise a machine from a photo.
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
                Text("Fit Hard never recognises machines from photos. Pick the machine from the list.").font(.fh_footnote).foregroundStyle(Color.muted)
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
