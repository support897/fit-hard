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
                                BrandIcon("cross.case").foregroundStyle(next.med.tone).font(.fh_title2)
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
                                    Circle().fill(m.tone).frame(width: 12, height: 12)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(m.name).font(.fh_subheadline_b)
                                        Text("\(freqLine(m)) · \(m.allTimes.joined(separator: ", "))").font(.fh_caption).foregroundStyle(Color.muted)
                                        DatePicker("Last taken", selection: Binding(get: { m.lastTaken ?? Date() }, set: { store.setLastTaken(m, min($0, Date())) }), in: ...Date(), displayedComponents: [.date, .hourAndMinute])
                                            .font(.fh_caption).labelsHidden().datePickerStyle(.compact).accessibilityLabel("Last taken")
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
        case "Weekly": return m.lastTaken.map { $0.formatted(.dateTime.weekday(.wide)) + "s" } ?? "Mondays"
        case "Every few days": return "Every \(m.everyDays ?? 3) days"
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
        store.s.meds.contains { m in
            guard !m.isPaused else { return false }
            if m.frequency == "Weekly" { return weekdayIdx == (m.lastTaken.map { (Calendar.current.component(.weekday, from: $0) + 5) % 7 } ?? 0) }
            return m.frequency == "Every few days" ? true : true
        }
    }
}

/// One dose card: colour, name, amount as given, last time, next due, then the taken line or the three kind buttons.
/// Only the person taps these. A dose is never marked taken on its own.
struct DoseCard: View {
    @EnvironmentObject var store: Store
    let med: Med
    var amountLine: String {
        let bits = [med.amount, med.unit ?? ""].filter { !$0.isEmpty }
        return bits.isEmpty ? "As given" : bits.joined(separator: " ") + ", as given"
    }
    var body: some View {
        let st = store.medStatus(med)
        let tone = med.tone
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                ZStack { Circle().fill(tone.opacity(0.18)); BrandIcon("cross.case").foregroundStyle(tone) }.frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(med.name).font(.fh_subheadline_b)
                    Text(amountLine).font(.fh_caption).foregroundStyle(Color.muted)
                    if let last = med.lastTaken { Text(String(format: NSLocalizedString("Last taken %@", comment: ""), last.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).hour().minute()))).font(.fh_caption).foregroundStyle(Color.muted) }
                    if let due = store.nextDue(med) { Text(String(format: NSLocalizedString("Next due %@", comment: ""), store.dueText(due))).font(.fh_caption_b).foregroundStyle(tone) }
                }
                Spacer()
            }
            if st == "taken", let at = store.medTakenAt(med) {
                Text("Taken today at \(timeString(at))").font(.fh_caption_b).foregroundStyle(Color.sage)
            } else {
                HStack(spacing: 8) {
                    Button("Taken") { store.logMed(med, "taken") }.font(.fh_subheadline_b)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(tone, in: Capsule()).foregroundStyle(Color.white)
                    Button("Skipped") { store.logMed(med, "not_taken") }.font(.fh_subheadline_b)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(Color.surface, in: Capsule())
                    Button("Remind me later") {
                        Notifier.snooze("med-\(med.id.uuidString)", title: NSLocalizedString("Your check-in", comment: ""), body: String(format: NSLocalizedString("Time to check in on %@.", comment: ""), med.name))
                        store.say("I will remind you again in 10 minutes")
                    }.font(.fh_subheadline_b)
                        .padding(.horizontal, 12).padding(.vertical, 8).background(Color.surface, in: Capsule())
                }
            }
        }.padding(12).background(tone.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
        .overlay(alignment: .leading) { RoundedRectangle(cornerRadius: 3).fill(tone).frame(width: 4).padding(.vertical, 12) }
        .accessibilityElement(children: .contain).accessibilityIdentifier("dose-\(med.id.uuidString)")
    }
}

/// Add a dose in four small steps, each one a single easy thing. Pick one or add your own, make it yours
/// (a name is optional, pick a colour), how often, and when the last one was. No questions about who gave it to you.
/// Fit Hard never tells anyone what to take, how much, or to change anything.
struct AddDoseSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var step = 1
    @State private var openGroup: String? = nil
    @State private var name = ""
    @State private var amount = ""
    @State private var unit = ""
    @State private var colorKey = DosePalette.all[0].key
    @State private var freq = "Once a day"
    @State private var everyDays = 3
    @State private var times: [Date] = [timeDate("08:00")]
    @State private var lastMode = 2          // 0 just now, 1 pick a time, 2 not yet
    @State private var lastDate = Date()
    @State private var query = ""
    let total = 4

    func pick(_ item: DoseCatalogItem) {
        name = item.name
        freq = item.frequency
        times = item.times.map { timeDate($0) }
        withAnimation(.easeInOut(duration: 0.2)) { step = 2 }
    }
    func header(_ n: Int, _ title: String, _ icon: String) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                BundleImage(name: "wally-hello").frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(LocalizedStringKey("Step \(n) of \(total)")).font(.fh_caption_b).foregroundStyle(DosePalette.color(colorKey)).accessibilityIdentifier("med-step")
                    Text(LocalizedStringKey(title)).font(.fh_title2).foregroundStyle(Color.ink)
                }
                Spacer(minLength: 0)
                BrandIcon(icon).font(.fh_title2).foregroundStyle(DosePalette.color(colorKey))
            }
            RedoBar(frac: Double(n) / Double(total), track: DosePalette.color(colorKey).opacity(0.18), fill: DosePalette.color(colorKey)).frame(height: 8)
        }
    }
    func field(_ title: String, _ text: Binding<String>, id: String, big: Bool = false) -> some View {
        TextField(LocalizedStringKey(title), text: text).font(big ? .fh_title2 : .fh_body).padding(14)
            .background(DosePalette.color(colorKey).opacity(0.10), in: RoundedRectangle(cornerRadius: 14)).accessibilityIdentifier(id)
    }
    func nav(next: (() -> Void)?) -> some View {
        HStack(spacing: 12) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { step -= 1 } } label: {
                Text("Back").font(.fh_subheadline_b).foregroundStyle(Color.sage).frame(maxWidth: .infinity, minHeight: 48)
                    .background(Color.sage.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
            }.buttonStyle(.plain).accessibilityIdentifier("med-back")
            if let next {
                Button { next() } label: {
                    Text("Next").font(.fh_subheadline_b).foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 48)
                        .background(DosePalette.color(colorKey), in: RoundedRectangle(cornerRadius: 14))
                }.buttonStyle(.plain).accessibilityIdentifier("med-next")
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
        }.background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
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
            header(1, "What are you adding?", "cross.case")
            TextField("Search the list", text: $query).padding(12).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 14)).accessibilityIdentifier("med-search")
            if q.isEmpty {
                ForEach(DoseCatalog.groups) { g in groupCard(g) }
                Button { name = ""; withAnimation(.easeInOut(duration: 0.2)) { step = 2 } } label: {
                    HStack {
                        BrandIcon("plus").foregroundStyle(Color.sage)
                        Text("Add your own").font(.fh_headline).foregroundStyle(Color.sage)
                        Spacer()
                    }.padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 56).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 16)).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityIdentifier("pick-own")
            } else {
                let hits = DoseCatalog.groups.flatMap { $0.items }.filter { $0.name.lowercased().contains(q) }
                VStack(spacing: 0) {
                    ForEach(hits) { item in Button { pick(item) } label: { pickRow(item) }.buttonStyle(.plain).accessibilityIdentifier("pick-\(item.name)") }
                }.padding(.horizontal, 16).background(Color.sage.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }
    var step2: some View {
        VStack(spacing: 12) {
            header(2, "Make it yours", "sparkles")
            Text("Pick a colour").font(.fh_caption_b).foregroundStyle(Color.muted).frame(maxWidth: .infinity, alignment: .leading)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(DosePalette.all, id: \.key) { c in
                        Button { colorKey = c.key; haptic(.soft) } label: {
                            Circle().fill(DosePalette.color(c.key)).frame(width: 40, height: 40)
                                .overlay(Circle().stroke(Color.ink, lineWidth: colorKey == c.key ? 3 : 0).padding(-4))
                        }.buttonStyle(.plain).accessibilityLabel(c.name).accessibilityIdentifier("dose-color-\(c.key)")
                    }
                }.padding(6)
            }
            field("Name (optional)", $name, id: "med-name")
            field("Amount (optional)", $amount, id: "med-dose", big: true)
            field("Unit (optional: ml, drops, scoops)", $unit, id: "med-unit")
            nav(next: { withAnimation(.easeInOut(duration: 0.2)) { step = 3 } })
        }
    }
    var step3: some View {
        VStack(spacing: 12) {
            header(3, "How often?", "clock")
            Picker("How often", selection: $freq) { ForEach(["Once a day", "Twice a day", "Weekly", "Every few days", "As directed"], id: \.self) { Text(LocalizedStringKey($0)).tag($0) } }
                .pickerStyle(.menu).tint(DosePalette.color(colorKey)).frame(maxWidth: .infinity, alignment: .leading)
                .onChange(of: freq) { v in if v == "Twice a day", times.count < 2 { times.append(timeDate("20:00")) } }
            if freq == "Every few days" { Stepper("Every \(everyDays) days", value: $everyDays, in: 2...30).font(.fh_subheadline_b) }
            if freq != "As directed" {
                ForEach(times.indices, id: \.self) { i in DatePicker("Time \(i + 1)", selection: $times[i], displayedComponents: .hourAndMinute) }
                Button("Add another time") { times.append(timeDate("20:00")) }.font(.fh_subheadline_b).foregroundStyle(DosePalette.color(colorKey))
                Text("Your reminder rings at these times.").font(.fh_caption).foregroundStyle(Color.muted)
            } else { Text("No reminder times. You mark it when you take it.").font(.fh_caption).foregroundStyle(Color.muted) }
            nav(next: { withAnimation(.easeInOut(duration: 0.2)) { step = 4 } })
        }
    }
    func lastChoice(_ n: Int, _ title: String, _ icon: String) -> some View {
        Button { lastMode = n; haptic(.soft) } label: {
            HStack(spacing: 10) {
                BrandIcon(icon).foregroundStyle(DosePalette.color(colorKey))
                Text(LocalizedStringKey(title)).font(.fh_headline).foregroundStyle(Color.ink)
                Spacer()
                if lastMode == n { BrandIcon("checkmark.circle.fill").foregroundStyle(DosePalette.color(colorKey)) }
            }.padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 56)
            .background(DosePalette.color(colorKey).opacity(lastMode == n ? 0.18 : 0.08), in: RoundedRectangle(cornerRadius: 16)).contentShape(Rectangle())
        }.buttonStyle(.plain).accessibilityIdentifier("last-\(n)")
    }
    var step4: some View {
        VStack(spacing: 12) {
            header(4, "When was the last one?", "calendar")
            lastChoice(0, "Just now", "sparkles")
            lastChoice(1, "I will pick the time", "clock")
            if lastMode == 1 { DatePicker("Last taken", selection: $lastDate, in: ...Date(), displayedComponents: [.date, .hourAndMinute]).datePickerStyle(.compact) }
            lastChoice(2, "Not yet", "moon")
            Text("Fit Hard sets your next reminder from this.").font(.fh_caption).foregroundStyle(Color.muted)
            BigButton(title: "Add this one", icon: "plus") { add() }.accessibilityIdentifier("med-add")
            nav(next: nil)
        }
    }
    func add() {
        let n = name.trimmingCharacters(in: .whitespaces)
        let ts = freq == "As directed" ? [] : times.map { timeString($0) }
        var last: Date? = nil
        if lastMode == 0 { last = Date() } else if lastMode == 1 { last = min(lastDate, Date()) }
        let med = Med(name: n.isEmpty ? NSLocalizedString("My dose", comment: "") : n, amount: amount, time: ts.first ?? "08:00", unit: unit.isEmpty ? nil : unit, frequency: freq,
                      instructions: nil, paused: false, times: ts.isEmpty ? nil : ts, color: colorKey, lastTaken: last, everyDays: freq == "Every few days" ? everyDays : nil)
        store.s.meds.append(med)
        if let l = last { store.s.medLogs.append(MedLog(medId: med.id, day: dayKey(l), status: "taken", at: l)) }
        Notifier.rebuild(store); store.say("Added. Wally will remind you"); haptic(.medium); dismiss()
    }
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("You type what you take, exactly as you know it. Fit Hard never tells you what to take, how much, or to change anything.").font(.fh_caption).foregroundStyle(Color.muted)
                switch step { case 1: step1; case 2: step2; case 3: step3; default: step4 }
            }.padding(16)
        }.background(Color.cream).navigationTitle("Add to My Doses")
    }
}
