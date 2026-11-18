import SwiftUI

// MARK: Build 39 redo kit. Soft gradient cards, bars, rings, tiles and pills in the brand colours only.
// Rides on the dopamine research: a visible next win, small visible progress, mercy for the streak, Wally cheering real progress.

extension LinearGradient {
    /// Soft Sage to Mist, the big progress card.
    static var heroGrad: LinearGradient { LinearGradient(colors: [Color(hex: 0x52695A), Color(hex: 0xA9BFA5)], startPoint: .topLeading, endPoint: .bottomTrailing) }
    /// Soft Cream to Tint wash for finished rows.
    static var washGrad: LinearGradient { LinearGradient(colors: [Color(hex: 0xFAEED6), Color(hex: 0xDCE7D8)], startPoint: .leading, endPoint: .trailing) }
}
let heroCream = Color(hex: 0xFAEED6)

/// Wally stands on a cream disc so his real art is never recoloured.
struct WallyDisc: View {
    let name: String
    var size: CGFloat = 96
    var body: some View {
        ZStack {
            Circle().fill(heroCream)
            BundleImage(name: name).padding(size * 0.04).scaleEffect(1.25)
        }.frame(width: size, height: size).clipShape(Circle())
        .overlay(Circle().stroke(heroCream.opacity(0.55), lineWidth: 4))
        .accessibilityHidden(true)
    }
}

struct RedoBar: View {
    let frac: Double
    var track: Color = Color.tint
    var fill: Color = Color.sage
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule().fill(fill).frame(width: max(0, g.size.width * CGFloat(min(1, max(0, frac)))))
            }
        }.animation(.easeOut(duration: 0.6), value: frac)
    }
}

/// The big soft gradient card at the top of Today.
struct RedoHero: View {
    let title: String
    let big: String
    let sub: String
    let frac: Double
    let wally: String
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(LocalizedStringKey(title)).font(.fh_title2_b)
                Text(LocalizedStringKey(sub)).font(.fh_subheadline)
                Text(big).font(.fh_largeTitle_b)
                RedoBar(frac: frac, track: heroCream.opacity(0.35), fill: heroCream).frame(height: 10)
                Text(String(format: NSLocalizedString("%lld percent done", comment: ""), Int((frac * 100).rounded()))).font(.fh_caption_b)
            }.foregroundStyle(heroCream)
            Spacer(minLength: 0)
            WallyDisc(name: wally, size: 96)
        }.padding(18).frame(maxWidth: .infinity)
        .background(LinearGradient.heroGrad, in: RoundedRectangle(cornerRadius: 28))
        .shadow(color: Color.sage.opacity(0.28), radius: 14, y: 8)
        .accessibilityElement(children: .combine).accessibilityIdentifier("today-win")
    }
}

struct CountPill: View {
    let text: String
    var body: some View {
        Text(text).font(.fh_caption_b).padding(.horizontal, 10).padding(.vertical, 5)
            .background(Color.tint, in: Capsule()).foregroundStyle(Color.ink)
    }
}

struct SoftPill: View {
    let text: String
    var body: some View {
        Text(LocalizedStringKey(text)).font(.fh_caption_b).padding(.horizontal, 12).padding(.vertical, 7)
            .background(Color.surface, in: Capsule()).overlay(Capsule().stroke(Color.line, lineWidth: 1)).foregroundStyle(Color.ink)
    }
}

/// A colour tile on the left, a name, a thin bar and a small count pill at the end.
struct TileRow: View {
    let icon: String
    let name: String
    let frac: Double
    let count: String
    var tone: Color = Color.sage
    var done = false
    var body: some View {
        HStack(spacing: 12) {
            BrandIcon(icon).frame(width: 44, height: 44).background(tone.opacity(0.25), in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 7) {
                Text(LocalizedStringKey(name)).font(.fh_subheadline_b).foregroundStyle(Color.ink)
                RedoBar(frac: frac).frame(height: 6)
            }
            CountPill(text: count)
        }.padding(12).frame(maxWidth: .infinity)
        .background(done ? AnyShapeStyle(LinearGradient.washGrad) : AnyShapeStyle(Color.surface), in: RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.sage.opacity(0.10), radius: 8, y: 3)
    }
}

/// Two tone bars for the days of this week: Mist is the day, Sage is how much of it was done.
struct WeekBars: View {
    @EnvironmentObject var store: Store
    private let labels = ["M", "T", "W", "T", "F", "S", "S"]
    var body: some View {
        let keys = store.weekKeys(0)
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(Array(keys.enumerated()), id: \.offset) { i, k in
                let sc = store.dayScore(k)
                VStack(spacing: 4) {
                    ZStack(alignment: .bottom) {
                        RoundedRectangle(cornerRadius: 6).fill(Color.mist.opacity(0.55)).frame(height: 64)
                        RoundedRectangle(cornerRadius: 6).fill(Color.sage).frame(height: 64 * CGFloat(sc))
                    }
                    Text(labels[i]).font(.fh_caption2_b).foregroundStyle(k == store.today ? Color.ink : Color.muted)
                }
            }
        }.accessibilityElement(children: .ignore).accessibilityLabel("This week").accessibilityIdentifier("week-bars")
    }
}

/// Wally beside the work: a short kind line in a soft bubble. Quiet mode hides him.
struct CoachLine: View {
    @EnvironmentObject var store: Store
    let text: String
    let image: String
    var body: some View {
        if store.s.settings.wallyQuiet { EmptyView() } else {
            HStack(spacing: 10) {
                WallyDisc(name: image, size: 52)
                Text(text).font(.fh_subheadline_b).foregroundStyle(Color.ink).frame(maxWidth: .infinity, alignment: .leading)
            }.padding(10).background(Color.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.sage, lineWidth: 2)).accessibilityIdentifier("coach-line")
        }
    }
}

extension Store {
    /// How much of a day was done, 0 to 1, from what the person really logged. A rest day counts as done.
    func dayScore(_ k: String) -> Double {
        var n = 0.0
        if s.workouts.contains(where: { dayKey($0.date) == k }) || s.restDays.contains(k) { n += 1 }
        if !(s.eaten[k] ?? []).isEmpty { n += 1 }
        if (s.water[k] ?? 0) > 0 || s.checkins[k] != nil { n += 1 }
        return max(n / 3.0, isActiveDay(k) ? 0.15 : 0.06)
    }
    /// Today's small wins: workout (or planned rest), planned meals, doses marked taken, the feeling check in.
    var todayWin: (done: Int, total: Int) {
        var d = 0, t = 0
        if isRestToday { t += 1; d += 1 } else if !todaysExercises.isEmpty { t += 1; if workedOutToday { d += 1 } }
        let planned = Lists.meals.filter { s.plan[today]?[$0] != nil }
        t += planned.count
        d += planned.filter { (s.eaten[today] ?? []).contains($0) }.count
        let meds = s.meds.filter { !$0.isPaused }
        t += meds.count
        d += meds.filter { medStatus($0) == "taken" }.count
        t += 1
        if s.checkins[today] != nil { d += 1 }
        return (d, t)
    }
}

/// Width of the screen this app is on, so fixed looking sizes follow the phone (iOS 16 safe).
var fhScreenWidth: CGFloat { UIScreen.main.bounds.width }
