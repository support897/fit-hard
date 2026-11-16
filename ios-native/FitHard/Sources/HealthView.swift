import SwiftUI

/// My doses — the doses home as drawn in the Item 6 design (14 Nov).
/// Records only what the user types in from their clinician. Never suggests products, doses or changes.
/// A dose is marked only by the person's own tap. Nothing is ever marked taken on its own.
struct HealthView: View {
    @EnvironmentObject var store: Store
    @State private var showAdd = false
    @State private var apTitle = ""
    @State private var apDate = Date().addingTimeInterval(86400)
    @State private var erase = false

    /// True when pushed from a screen that already has a navigation stack (More). The view must be built as a real View so its store comes from the environment.
    var embedded = false
    var body: some View { if embedded { content } else { NavigationStack { content } } }
    var content: some View {
        Group {
            ScrollView {
                VStack(spacing: 14) {
                    WallyBubble()
                    if let next = store.nextDoseToday() {
                        Card {
                            HStack(spacing: 12) {
                                BrandIcon("cross.case").foregroundStyle(Color.taupe).font(.fh_title2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Next due").font(.fh_caption_b).foregroundStyle(Color.muted)
                                    Text(next.med.name).font(.fh_headline)
                                    Text("Today at \(next.time)").font(.fh_subheadline).foregroundStyle(Color.muted)
                                }
                                Spacer()
                            }
                        }.accessibilityIdentifier("doses-next")
                    }
                    Card {
                        SectionTitle(text: "Today")
                        if store.s.meds.isEmpty { Text("Nothing added yet.").foregroundStyle(Color.muted) }
                        ForEach(store.s.meds) { m in DoseCard(med: m) }
                        BigButton(title: "Add a dose or supplement", icon: "plus", filled: false) { showAdd = true }
                            .accessibilityIdentifier("doses-add")
                    }
                    if !store.s.meds.isEmpty {
                        Card {
                            SectionTitle(text: "All my doses")
                            ForEach(store.s.meds) { m in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(m.name).font(.fh_subheadline_b)
                                        Text("\(freqLine(m)) · \(m.allTimes.joined(separator: ", "))").font(.fh_caption).foregroundStyle(Color.muted)
                                    }
                                    Spacer()
                                    Button(m.isPaused ? "Resume" : "Pause") {
                                        if let i = store.s.meds.firstIndex(where: { $0.id == m.id }) { store.s.meds[i].paused = !m.isPaused; Notifier.rebuild(store) }
                                    }.font(.fh_caption)
                                    Button { store.s.meds.removeAll { $0.id == m.id }; Notifier.rebuild(store) } label: { BrandIcon("trash") }.foregroundStyle(Color.muted)
                                }
                            }
                            weekStrip
                        }
                    }
                    Card {
                        SectionTitle(text: "Appointments")
                        ForEach(store.s.appts.sorted { $0.date < $1.date }) { a in
                            HStack { VStack(alignment: .leading) { Text(a.title).font(.fh_subheadline_b); Text(a.date.formatted(date: .abbreviated, time: .shortened)).font(.fh_caption).foregroundStyle(Color.muted) }
                                Spacer(); Button { store.s.appts.removeAll { $0.id == a.id }; Notifier.rebuild(store) } label: { BrandIcon( "trash") }.foregroundStyle(Color.muted) }
                        }
                        TextField("Appointment", text: $apTitle)
                        DatePicker("When", selection: $apDate)
                        BigButton(title: "Add appointment", icon: "calendar.badge.plus", filled: false) {
                            let t = apTitle.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
                            store.s.appts.append(Appt(title: t, date: apDate)); apTitle = ""; Notifier.rebuild(store); store.say("Reminders set for the day before and an hour before")
                        }
                    }
                    Text("Fit Hard records what you enter. It does not give medical advice, doses or product suggestions. Ask your clinician about any change.")
                        .font(.fh_footnote).foregroundStyle(Color.muted).padding(.horizontal, 6)
                    Button("Erase all health data", role: .destructive) { erase = true }
                }.padding(16)
            }.background(Color.cream).navigationTitle("My Doses")
            .sheet(isPresented: $showAdd) { NavigationStack { AddDoseSheet() }.environmentObject(store) }
            .confirmationDialog("Erase all doses, history and appointments?", isPresented: $erase, titleVisibility: .visible) {
                Button("Erase", role: .destructive) { store.eraseHealth() }
            }
        }
    }

    /// "Every day" for daily doses, "Mondays" for the weekly one — the words the design uses.
    func freqLine(_ m: Med) -> String {
        switch m.frequency {
        case "Weekly": return "Mondays"
        case "As directed": return "As directed"
        default: return "Every day"
        }
    }
    /// M T W T F S S. A dot stands under every day a dose is due.
    var weekStrip: some View {
        let letters = ["M", "T", "W", "T", "F", "S", "S"]
        let todayIdx = (Calendar.current.component(.weekday, from: Date()) + 5) % 7
        return VStack(alignment: .leading, spacing: 6) {
            Text("This week").font(.fh_caption_b).foregroundStyle(Color.muted)
            HStack(spacing: 0) {
                ForEach(letters.indices, id: \.self) { i in
                    VStack(spacing: 2) {
                        Text(letters[i]).font(.fh_subheadline_b).foregroundStyle(i == todayIdx ? Color.sage : Color.ink)
                        Circle().fill(hasDose(on: i) ? Color.taupe : Color.clear).frame(width: 6, height: 6)
                    }.frame(maxWidth: .infinity)
                }
            }
        }.accessibilityIdentifier("doses-week")
    }
    func hasDose(on weekdayIdx: Int) -> Bool {
        // weekdayIdx 0 = Monday. Weekly doses fall on Monday; every other kind is due every day.
        store.s.meds.contains { m in !m.isPaused && (m.frequency == "Weekly" ? weekdayIdx == 0 : true) }
    }
}

/// One dose card: name, amount as given, time, then the taken line or the three kind buttons.
/// Only the person taps these. A dose is never marked taken on its own.
struct DoseCard: View {
    @EnvironmentObject var store: Store
    let med: Med
    /// "One scoop, as given" — the amount as the person typed it, never suggested.
    var amountLine: String {
        let bits = [med.amount, med.unit ?? ""].filter { !$0.isEmpty }
        return bits.isEmpty ? "As given" : bits.joined(separator: " ") + ", as given"
    }
    var body: some View {
        let st = store.medStatus(med)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                BrandIcon("cross.case").foregroundStyle(Color.taupe)
                VStack(alignment: .leading, spacing: 2) {
                    Text(med.name).font(.fh_subheadline_b)
                    Text(amountLine).font(.fh_caption).foregroundStyle(Color.muted)
                    Text(med.allTimes.joined(separator: ", ")).font(.fh_caption).foregroundStyle(Color.muted)
                }
                Spacer()
            }
            if st == "taken", let at = store.medTakenAt(med) {
                Text("Taken today at \(timeString(at))").font(.fh_caption_b).foregroundStyle(Color.sage)
            } else {
                HStack(spacing: 8) {
                    Button("Taken") { store.logMed(med, "taken") }.font(.fh_subheadline_b)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(Color.sage, in: Capsule()).foregroundStyle(Color.white)
                    Button("Skipped") { store.logMed(med, "not_taken") }.font(.fh_subheadline_b)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(Color.surface, in: Capsule())
                    Button("Remind me later") {
                        Notifier.snooze("med-\(med.id.uuidString)", title: NSLocalizedString("Your check-in", comment: ""), body: String(format: NSLocalizedString("Time to check in on %@.", comment: ""), med.name))
                        store.say("I will remind you again in 10 minutes")
                    }.font(.fh_subheadline_b)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(Color.surface, in: Capsule())
                }
            }
        }.accessibilityElement(children: .contain).accessibilityIdentifier("dose-\(med.id.uuidString)")
    }
}

/// Add a dose in one simple step (build 37): pick a name from the ready list or
/// add your own, type your dose exactly as given, tap Add. The how-often comes
/// filled in from the common label pattern and can be changed right here.
/// Fit Hard never tells anyone what to take, how much, or to change anything.
struct AddDoseSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var step = 1
    @State private var openGroup: String? = nil
    @State private var name = ""
    @State private var amount = ""
    @State private var unit = ""
    @State private var freq = "Once a day"
    @State private var instr = ""
    @State private var times: [Date] = [timeDate("08:00")]
    @State private var confirm = false
    @State private var query = ""

    /// Tapping a name on the pick list fills the name, the how-often and the
    /// times in one go, then walks to step 2. The dose amount is never filled in: it is typed.
    func pick(_ item: DoseCatalogItem) {
        name = item.name
        freq = item.frequency
        times = item.times.map { timeDate($0) }
        withAnimation(.easeInOut(duration: 0.2)) { step = 2 }
    }
    func header(_ n: Int, _ title: String) -> some View {
        VStack(spacing: 2) {
            Text(LocalizedStringKey("Step \(n) of 3")).font(.fh_caption_b).foregroundStyle(Color.sage).accessibilityIdentifier("med-step")
            Text(LocalizedStringKey(title)).font(.fh_title2).foregroundStyle(Color.ink)
        }.frame(maxWidth: .infinity)
    }
    func nav(next: (() -> Void)?) -> some View {
        HStack(spacing: 12) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { step -= 1 } } label: {
                Text("Back").font(.fh_subheadline_b).foregroundStyle(Color.sage).frame(maxWidth: .infinity, minHeight: 48)
                    .background(Color.sage.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
            }.buttonStyle(.plain).accessibilityIdentifier("med-back")
            if let next {
                Button { next() } label: {
                    Text("Next").font(.fh_subheadline_b).foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 48)
                        .background(Color.sage.opacity(name.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1), in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).disabled(name.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityIdentifier("med-next")
            }
        }
    }
    func groupCard(_ g: DoseCatalogGroup) -> some View {
        let open = openGroup == g.title
        return VStack(spacing: 8) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { openGroup = open ? nil : g.title }; haptic(.soft) } label: {
                HStack {
                    Text(LocalizedStringKey(g.title)).font(.fh_headline).foregroundStyle(Color.ink)
                    Spacer()
                    BrandIcon(open ? "chevron.up" : "chevron.down").foregroundStyle(Color.sage)
                }.padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 56).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityIdentifier("group-\(g.title)")
            if open {
                VStack(spacing: 0) {
                    ForEach(g.items) { item in
                        Button { pick(item) } label: { pickRow(item) }.buttonStyle(.plain).accessibilityIdentifier("pick-\(item.name)")
                    }
                }.padding(.horizontal, 16).padding(.bottom, 8)
            }
        }.background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
    }
    func pickRow(_ item: DoseCatalogItem) -> some View {
        HStack {
            Text(item.name).font(.fh_subheadline_b).foregroundStyle(Color.ink)
            Spacer()
            Text(LocalizedStringKey(item.frequency)).font(.fh_caption).foregroundStyle(Color.muted)
        }.padding(.vertical, 10).contentShape(Rectangle())
    }
    var step1: some View {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return VStack(spacing: 12) {
            header(1, "Pick a name")
            TextField("Search the list", text: $query).padding(12).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("med-search")
            if q.isEmpty {
                ForEach(DoseCatalog.groups) { g in groupCard(g) }
                Button { name = ""; withAnimation(.easeInOut(duration: 0.2)) { step = 2 } } label: {
                    HStack {
                        BrandIcon("plus").foregroundStyle(Color.sage)
                        Text("Add your own").font(.fh_headline).foregroundStyle(Color.sage)
                        Spacer()
                    }.padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 56).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 14)).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityIdentifier("pick-own")
            } else {
                let hits = DoseCatalog.groups.flatMap { $0.items }.filter { $0.name.lowercased().contains(q) }
                VStack(spacing: 0) {
                    ForEach(hits) { item in Button { pick(item) } label: { pickRow(item) }.buttonStyle(.plain).accessibilityIdentifier("pick-\(item.name)") }
                }.padding(.horizontal, 16).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }
    var step2: some View {
        VStack(spacing: 12) {
            header(2, "Your dose")
            TextField("Name (as your clinician gave it)", text: $name).padding(14).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("med-name")
            TextField("Amount (exactly as given)", text: $amount).font(.fh_title2).padding(14).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("med-dose")
            TextField("Unit (ml, drops, scoops…)", text: $unit).padding(14).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 12)).accessibilityIdentifier("med-unit")
            nav(next: { withAnimation(.easeInOut(duration: 0.2)) { step = 3 } })
        }
    }
    var step3: some View {
        VStack(spacing: 12) {
            header(3, "How often")
            Picker("How often", selection: $freq) { ForEach(["Once a day", "Twice a day", "Weekly", "As directed"], id: \.self) { Text(LocalizedStringKey($0)).tag($0) } }
            ForEach(times.indices, id: \.self) { i in DatePicker("Time \(i + 1)", selection: $times[i], displayedComponents: .hourAndMinute) }
            Button("Add another time") { times.append(timeDate("20:00")) }.font(.fh_subheadline_b)
            Text("Your reminder rings at these times.").font(.fh_caption).foregroundStyle(Color.muted)
            TextField("Notes from your clinician (optional)", text: $instr).padding(14).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
            Toggle("This was provided by my clinician", isOn: $confirm).tint(Color.sage)
            BigButton(title: "Add this one", icon: "plus") {
                let n = name.trimmingCharacters(in: .whitespaces)
                guard confirm, !n.isEmpty else { store.say("Add a name and tick the box"); return }
                let ts = times.map { timeString($0) }
                store.s.meds.append(Med(name: n, amount: amount, time: ts.first ?? "08:00", unit: unit.isEmpty ? nil : unit, frequency: freq,
                                        instructions: instr.isEmpty ? nil : instr, paused: false, times: ts))
                Notifier.rebuild(store); store.say("Added"); dismiss()
            }.accessibilityIdentifier("med-add")
            nav(next: nil)
        }
    }
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Pick a name or add your own. You type your dose, exactly as given. Fit Hard never tells you what to take, how much, or to change anything.").font(.fh_caption).foregroundStyle(Color.muted)
                switch step { case 1: step1; case 2: step2; default: step3 }
            }.padding(16)
        }.background(Color.cream).navigationTitle("Add to My Doses")
    }
}
