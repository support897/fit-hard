import SwiftUI

/// Records only what the user types in from their clinician. Never suggests products, doses or changes.
struct HealthView: View {
    @EnvironmentObject var store: Store
    @State private var name = ""
    @State private var amount = ""
    @State private var unit = ""; @State private var route = ""; @State private var freq = "Once a day"; @State private var instr = ""; @State private var prescriber = ""
    @State private var times: [Date] = [timeDate("08:00")]
    @State private var time = timeDate("08:00")
    @State private var confirm = false
    @State private var apTitle = ""
    @State private var apDate = Date().addingTimeInterval(86400)
    @State private var erase = false

    var body: some View { NavigationStack { content } }
    var content: some View {
        Group {
            ScrollView {
                VStack(spacing: 14) {
                    Card {
                        SectionTitle(text: "Today")
                        if store.s.meds.isEmpty { Text("Nothing added yet.").foregroundStyle(Color.muted) }
                        ForEach(store.s.meds) { m in
                            MedRow(med: m)
                            HStack {
                                Toggle("Reminders paused", isOn: Binding(get: { m.isPaused }, set: { v in if let i = store.s.meds.firstIndex(where: { $0.id == m.id }) { store.s.meds[i].paused = v; Notifier.rebuild(store) } })).font(.caption).tint(Color.sage)
                                Button(role: .destructive) { store.s.meds.removeAll { $0.id == m.id }; Notifier.rebuild(store) } label: { Text("Stop and remove").font(.caption) }
                            }
                        }
                    }
                    Card {
                        SectionTitle(text: "Add what your clinician prescribed")
                        Text("You type everything. Fit Hard never suggests a name, a dose or a change.").font(.caption).foregroundStyle(Color.muted)
                        TextField("Name (as given)", text: $name).accessibilityIdentifier("med-name")
                        HStack { TextField("Dose (as given)", text: $amount).accessibilityIdentifier("med-dose"); TextField("Unit (as given)", text: $unit) }
                        TextField("How taken, as directed (optional)", text: $route)
                        Picker("How often", selection: $freq) { ForEach(["Once a day", "Twice a day", "Weekly", "As directed"], id: \.self) { Text($0).tag($0) } }
                        TextField("Instructions from your clinician (optional)", text: $instr)
                        TextField("Prescriber (optional)", text: $prescriber)
                        ForEach(times.indices, id: \.self) { i in DatePicker("Reminder \(i + 1)", selection: $times[i], displayedComponents: .hourAndMinute) }
                        Button("Add another reminder time") { times.append(timeDate("20:00")) }.font(.subheadline.weight(.semibold))
                        Toggle("This was provided by my clinician", isOn: $confirm).tint(Color.sage)
                        BigButton(title: "Add", icon: "plus") {
                            let n = name.trimmingCharacters(in: .whitespaces)
                            guard confirm, !n.isEmpty else { store.say("Add a name and tick the box"); return }
                            let ts = times.map { timeString($0) }
                            store.s.meds.append(Med(name: n, amount: amount, time: ts.first ?? "08:00", unit: unit.isEmpty ? nil : unit, route: route.isEmpty ? nil : route, frequency: freq,
                                                    instructions: instr.isEmpty ? nil : instr, prescriber: prescriber.isEmpty ? nil : prescriber, paused: false, times: ts))
                            name = ""; amount = ""; unit = ""; route = ""; instr = ""; prescriber = ""; confirm = false; times = [timeDate("08:00")]
                            Notifier.rebuild(store); store.say("Added")
                        }.accessibilityIdentifier("med-add")
                    }
                    Card {
                        SectionTitle(text: "Appointments")
                        ForEach(store.s.appts.sorted { $0.date < $1.date }) { a in
                            HStack { VStack(alignment: .leading) { Text(a.title).font(.subheadline.weight(.semibold)); Text(a.date.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(Color.muted) }
                                Spacer(); Button { store.s.appts.removeAll { $0.id == a.id }; Notifier.rebuild(store) } label: { Image(systemName: "trash") }.foregroundStyle(Color.muted) }
                        }
                        TextField("Appointment", text: $apTitle)
                        DatePicker("When", selection: $apDate)
                        BigButton(title: "Add appointment", icon: "calendar.badge.plus", filled: false) {
                            let t = apTitle.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
                            store.s.appts.append(Appt(title: t, date: apDate)); apTitle = ""; Notifier.rebuild(store); store.say("Reminders set for the day before and an hour before")
                        }
                    }
                    Text("Fit Hard records what you enter. It does not give medical advice, doses or product suggestions. Ask your clinician about any change.")
                        .font(.footnote).foregroundStyle(Color.muted).padding(.horizontal, 6)
                    Button("Erase all health data", role: .destructive) { erase = true }
                }.padding(16)
            }.background(Color.cream).navigationTitle("Health")
            .confirmationDialog("Erase all doses, history and appointments?", isPresented: $erase, titleVisibility: .visible) {
                Button("Erase", role: .destructive) { store.eraseHealth() }
            }
        }
    }
}
