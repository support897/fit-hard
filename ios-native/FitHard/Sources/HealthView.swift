import SwiftUI

/// Records only what the user types in from their clinician. Never suggests products, doses or changes.
struct HealthView: View {
    @EnvironmentObject var store: Store
    @State private var name = ""
    @State private var amount = ""
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
                            Button(role: .destructive) { store.s.meds.removeAll { $0.id == m.id }; Notifier.rebuild(store) } label: { Text("Remove \(m.name)").font(.caption) }
                        }
                    }
                    Card {
                        SectionTitle(text: "Add what your clinician gave you")
                        TextField("Name (as given)", text: $name)
                        TextField("Amount (as given)", text: $amount)
                        DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                        Toggle("This was provided by my clinician", isOn: $confirm).tint(Color.sage)
                        BigButton(title: "Add", icon: "plus") {
                            let n = name.trimmingCharacters(in: .whitespaces)
                            guard confirm, !n.isEmpty else { store.say("Add a name and tick the box"); return }
                            store.s.meds.append(Med(name: n, amount: amount, time: timeString(time))); name = ""; amount = ""; confirm = false
                            Notifier.rebuild(store); store.say("Added")
                        }
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
