import SwiftUI

struct CalendarScreen: View {
    @EnvironmentObject var store: Store
    @State private var mode = 2
    @State private var pendingDay: String? = nil
    @State private var sel = dayKey()
    @State private var adding = false
    @State private var editing: CalEvent? = nil
    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $mode) { Text("Day").tag(0); Text("Week").tag(1); Text("Month").tag(2); Text("Next").tag(3); Text("Habits").tag(4); Text("To do").tag(5) }.pickerStyle(.segmented).padding(.horizontal, 12).padding(.top, 8)
            Legend().padding(.horizontal, 16).padding(.vertical, 6)
            switch mode {
            case 0: DayDetail(day: $sel, edit: { editing = $0 })
            case 1: WeekView(sel: $sel, open: { sel = $0; mode = 0 })
            case 2: MonthGrid(sel: $sel, open: { mode = 0 })
            case 3: UpcomingView(open: { sel = $0; mode = 0 })
            case 4: HabitsView()
            default: TasksView(startDay: pendingDay)
            }
        }.background(Color.cream).navigationTitle("Calendar").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) {
            Button { adding = true } label: { BrandIcon( "plus.circle.fill").font(.fh_title2).frame(width: 44, height: 44) }.accessibilityLabel("Add to calendar").accessibilityIdentifier("cal-add") } }
        .sheet(isPresented: $adding) { NavigationStack { EventEditor(event: nil, day: sel) } }
        .sheet(item: $editing) { e in NavigationStack { EventEditor(event: e, day: e.day) } }
    }
}

struct Legend: View {
    func pill(_ icon: String, _ label: String, _ tone: String) -> some View {
        HStack(spacing: 4) { BrandIcon(icon).foregroundStyle(Color.tone(tone)); Text(label).font(.fh_caption2_b) }
            .padding(.horizontal, 8).padding(.vertical, 4).background(Color.tone(tone).opacity(0.18), in: Capsule()).overlay(Capsule().stroke(Color.tone(tone), lineWidth: 1))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Training").font(.fh_caption_b).foregroundStyle(Color.muted)
            Flow(spacing: 6) { ForEach(TrainType.allCases, id: \.self) { t in pill(t.icon, t.label, t.tone) } }
            Text("Meals").font(.fh_caption_b).foregroundStyle(Color.muted)
            Flow(spacing: 6) { ForEach(MealKind.allCases, id: \.self) { m in pill(m.icon, m.label, m.tone) } }
            Text("Other").font(.fh_caption_b).foregroundStyle(Color.muted)
            Flow(spacing: 6) {
                pill("moon", "Recovery", "recovery"); pill("cross.case", "Medication", "medication"); pill("person", "Personal", "personal")
                HStack(spacing: 4) { BrandIcon("checkmark.circle.fill").font(.fh_caption2); Text("Done").font(.fh_caption2_b) }.padding(.horizontal, 8).padding(.vertical, 4).overlay(Capsule().stroke(Color.line, lineWidth: 1))
            }
        }.accessibilityIdentifier("cal-legend")
    }
}

struct ItemRow: View {
    let it: CalItem
    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 3).fill(Color.tone(it.colorKey)).frame(width: 5)
            BrandIcon( it.done ? "checkmark.circle.fill" : it.icon).foregroundStyle(Color.tone(it.colorKey)).frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(it.time) · \(it.title)").font(.fh_subheadline_b).strikethrough(it.done && it.cat != "medication").multilineTextAlignment(.leading)
                if !it.detail.isEmpty { Text(it.detail).font(.fh_caption).foregroundStyle(Color.muted) }
            }
            Spacer(minLength: 0)
        }.padding(10).background(Color.tone(it.colorKey).opacity(0.10), in: RoundedRectangle(cornerRadius: 12)).frame(minHeight: 44)
    }
}

struct DayDetail: View {
    @EnvironmentObject var store: Store
    @Binding var day: String
    let edit: (CalEvent) -> Void
    var body: some View {
        let items = store.calItems(on: day)
        let train = store.routine(on: day)
        ScrollView { VStack(spacing: 12) {
            HStack {
                Button { shift(-1) } label: { BrandIcon( "chevron.left").frame(width: 44, height: 44) }
                Spacer(); Text(dateFromKey(day)?.formatted(.dateTime.weekday(.wide).day().month()) ?? day).font(.fh_headline).accessibilityIdentifier("cal-day-title"); Spacer()
                Button { shift(1) } label: { BrandIcon( "chevron.right").frame(width: 44, height: 44) }
            }
            if train != nil, let lunch = store.s.plan[day]?["lunch"].flatMap({ store.cat.recipe($0) }) {
                HStack(spacing: 10) { BrandIcon("m-lunch").foregroundStyle(Color.tone("meal.lunch"))
                    VStack(alignment: .leading, spacing: 2) { Text("Training day lunch").font(.fh_caption).foregroundStyle(Color.muted)
                        Text("\(store.mealTime("lunch")) · Lunch: \(store.line(lunch))").font(.fh_subheadline_b).accessibilityIdentifier("lunch-card") }
                    Spacer() }.padding(12).background(Color.tone("meal.lunch").opacity(0.14), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.tone("meal.lunch"), lineWidth: 1))
            }
            if items.isEmpty { Card { Text("Nothing planned. Tap the plus to add something.").foregroundStyle(Color.muted) } }
            ForEach(items) { it in
                VStack(alignment: .leading, spacing: 6) {
                    ItemRow(it: it).onTapGesture { if let id = it.eventID, let e = store.s.events.first(where: { $0.id == id }) { edit(e) } }
                    if it.cat == "training", let r = store.routine(on: day), it.routineID == r.id, !it.done {
                        HStack {
                            Button("Start") { store.training = r }.accessibilityIdentifier("cal-start")
                            Button("Skip") { store.skipWorkout(day: day, routine: r) }
                            Button("Move to tomorrow") { store.moveWorkout(from: day, routine: r, to: dayKey(Calendar.current.date(byAdding: .day, value: 1, to: dateFromKey(day) ?? Date()) ?? Date())) }
                        }.font(.fh_caption_b).padding(.leading, 12)
                    }
                    if it.cat == "meals", it.id.hasPrefix("meal-") {
                        let meal = String(it.id.split(separator: "-").last ?? "")
                        Button("Swap this meal") { store.swap(day: day, meal: meal) }.font(.fh_caption_b).padding(.leading, 12).accessibilityIdentifier("cal-swap-\(meal)")
                    }
                }
            }
            Button("Regenerate this week") { store.regenerateWeek(); store.say("Week regenerated") }.font(.fh_footnote_b)
        }.padding(16) }
    }
    func shift(_ n: Int) { if let d = dateFromKey(day), let x = Calendar.current.date(byAdding: .day, value: n, to: d) { day = dayKey(x) } }
}

struct WeekView: View {
    @EnvironmentObject var store: Store
    @Binding var sel: String
    let open: (String) -> Void
    var days: [Date] {
        var c = Calendar.current; c.firstWeekday = 2
        let start = c.dateInterval(of: .weekOfYear, for: dateFromKey(sel) ?? Date())?.start ?? Date()
        return (0..<7).compactMap { c.date(byAdding: .day, value: $0, to: start) }
    }
    var body: some View {
        ScrollView { VStack(spacing: 10) {
            ForEach(days, id: \.self) { d in
                let k = dayKey(d)
                Button { open(k) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(d.formatted(.dateTime.weekday(.wide).day().month())).font(.fh_subheadline_b)
                        let items = store.calItems(on: k)
                        if items.isEmpty { Text("Free").font(.fh_caption).foregroundStyle(Color.muted) }
                        ForEach(items.prefix(4)) { ItemRow(it: $0) }
                        if items.count > 4 { Text("+\(items.count - 4) more").font(.fh_caption).foregroundStyle(Color.muted) }
                    }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Color.surface, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain).foregroundStyle(Color.ink)
            }
        }.padding(16) }
    }
}

struct UpcomingView: View {
    @EnvironmentObject var store: Store
    let open: (String) -> Void
    var body: some View {
        ScrollView { VStack(spacing: 10) {
            ForEach(0..<14, id: \.self) { i in
                if let d = Calendar.current.date(byAdding: .day, value: i, to: Date()) {
                    let k = dayKey(d); let items = store.calItems(on: k).filter { !$0.done }
                    if !items.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(i == 0 ? "Today" : d.formatted(.dateTime.weekday(.wide).day().month())).font(.fh_subheadline_b)
                            ForEach(items.prefix(5)) { ItemRow(it: $0).onTapGesture { open(k) } }
                        }
                    }
                }
            }
        }.padding(16) }
    }
}

struct MonthGrid: View {
    @EnvironmentObject var store: Store
    @Binding var sel: String
    let open: () -> Void
    @State private var month = Date()
    var cal: Calendar { var c = Calendar.current; c.firstWeekday = 2; return c }
    var days: [Date?] {
        guard let iv = cal.dateInterval(of: .month, for: month) else { return [] }
        let lead = (cal.component(.weekday, from: iv.start) - cal.firstWeekday + 7) % 7
        let n = cal.range(of: .day, in: .month, for: month)?.count ?? 30
        return Array(repeating: nil, count: lead) + (0..<n).compactMap { cal.date(byAdding: .day, value: $0, to: iv.start) }
    }
    var body: some View {
        ScrollView { VStack(spacing: 14) {
            Card {
                HStack { Button { month = cal.date(byAdding: .month, value: -1, to: month) ?? month } label: { BrandIcon( "chevron.left").frame(width: 44, height: 44) }; Spacer()
                    Button { month = Date(); sel = store.today; haptic(.soft) } label: { Text(month.formatted(.dateTime.month(.wide).year())).font(.fh_headline) }.buttonStyle(.plain); Spacer()
                    Button { month = cal.date(byAdding: .month, value: 1, to: month) ?? month } label: { BrandIcon( "chevron.right").frame(width: 44, height: 44) } }
                let cols = Array(repeating: GridItem(.flexible()), count: 7)
                let heads = Array(zip([0, 1, 2, 3, 4, 5, 6], ["M", "T", "W", "T", "F", "S", "S"]))
                LazyVGrid(columns: cols) {
                    ForEach(heads, id: \.0) { h in Text(LocalizedStringKey(h.1)).font(.fh_caption).foregroundStyle(Color.muted) }
                    ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                        if let d = d {
                            let k = dayKey(d); let cats = Array(Set(store.calItems(on: k).map { $0.colorKey })).sorted()
                            Button { sel = k; haptic(.soft) } label: {
                                VStack(spacing: 2) { Text("\(cal.component(.day, from: d))").font(.fh_subheadline.weight(k == store.today ? .bold : .regular))
                                    HStack(spacing: 2) { ForEach(cats, id: \.self) { c in Circle().fill(Color.tone(c)).frame(width: 5, height: 5) } }.frame(height: 6) }
                                .frame(maxWidth: .infinity, minHeight: 44).background(k == sel ? Color.tint : Color.clear, in: RoundedRectangle(cornerRadius: 10))
                            }.buttonStyle(.plain).foregroundStyle(Color.ink)
                        } else { Color.clear.frame(height: 44) }
                    }
                }
            }
            let items = store.calItems(on: sel)
            Card {
                HStack { Text(dateFromKey(sel)?.formatted(.dateTime.weekday(.wide).day().month()) ?? sel).font(.fh_headline); Spacer(); Button("Open day") { open() }.font(.fh_subheadline_b) }
                if items.isEmpty { Text("Nothing planned. That is fine.").foregroundStyle(Color.muted) }
                ForEach(items) { ItemRow(it: $0) }
                ForEach(store.s.habits) { h in BrandLabel(h.name, icon: h.done.contains(sel) ? "checkmark.circle.fill" : "circle").font(.fh_subheadline).foregroundStyle(h.done.contains(sel) ? Color.sage : Color.ink) }
            }
        }.padding(16) }
    }
}

struct EventEditor: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    let event: CalEvent?
    let day: String
    @State private var kind = "workout"; @State private var title = ""; @State private var date = Date(); @State private var time = Date()
    @State private var minutes = 30; @State private var notes = ""; @State private var remind = true; @State private var done = false
    static let kinds: [(String, String, String)] = [("workout", "Workout", "training"), ("meal", "Meal", "meals"), ("snack", "Snack", "meals"), ("cardio", "Cardio", "training"), ("rest", "Rest day", "recovery"), ("personal", "Personal", "personal"), ("custom", "Reminder", "personal"), ("medication", "Medication check in", "medication")]
    var body: some View {
        Form {
            Section("What") {
                Picker("Type", selection: $kind) { ForEach(EventEditor.kinds, id: \.0) { Text($0.1).tag($0.0) } }.accessibilityIdentifier("ev-kind")
                TextField("Name", text: $title).accessibilityIdentifier("ev-title")
            }.listRowBackground(Color.surface)
            Section("When") {
                DatePicker("Day", selection: $date, displayedComponents: .date)
                DatePicker("Start", selection: $time, displayedComponents: .hourAndMinute)
                Stepper("\(minutes) minutes", value: $minutes, in: 5...240, step: 5)
                Toggle("Remind me", isOn: $remind).tint(Color.sage)
            }.listRowBackground(Color.surface)
            Section("Notes") { TextField("Optional", text: $notes) }.listRowBackground(Color.surface)
            if event != nil {
                Section { Toggle("Done", isOn: $done).tint(Color.sage)
                    Button("Delete", role: .destructive) { if let e = event { store.s.events.removeAll { $0.id == e.id }; Notifier.rebuild(store) }; dismiss() } }.listRowBackground(Color.surface)
            }
        }.scrollContentBackground(.hidden).background(Color.cream).navigationTitle(event == nil ? "Add to calendar" : "Edit").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.accessibilityIdentifier("ev-save") }
        }
        .onAppear {
            if let e = event { kind = e.kind; title = e.title; date = dateFromKey(e.day) ?? Date(); time = timeDate(e.time); minutes = e.minutes; notes = e.notes; remind = e.remind; done = e.done }
            else { date = dateFromKey(day) ?? Date() }
        }
    }
    func save() {
        let cat = EventEditor.kinds.first { $0.0 == kind }?.2 ?? "personal"
        var t = title.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { t = EventEditor.kinds.first { $0.0 == kind }?.1 ?? "Event" }
        if kind == "rest" { let k = dayKey(date); if !store.s.restDays.contains(k) { store.s.restDays.append(k) } }
        if var e = event, let i = store.s.events.firstIndex(where: { $0.id == e.id }) {
            e.title = t; e.day = dayKey(date); e.time = timeString(time); e.minutes = minutes; e.notes = notes; e.remind = remind; e.done = done; e.cat = cat; e.kind = kind
            store.s.events[i] = e; Notifier.rebuild(store)
        } else {
            _ = store.addEvent(CalEvent(title: t, day: dayKey(date), time: timeString(time), minutes: minutes, cat: cat, kind: kind, notes: notes, remind: remind))
        }
        dismiss()
    }
}
