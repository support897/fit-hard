import Foundation

/// Build 36, item C — the day's training adaptation, from the person's own logs only.
/// Research shape of record (HQ's verdict, 14 Nov): core moves stay stable for one block
/// (4 weeks, 6 for beginners); inside the block the load steps up a little at a time
/// (ProgressionEngine is that step: top of the range on every set, effort in bounds, then
/// one small load rise); the block's last week is a deload at about half the sets and
/// about 60 percent load; and the day itself is autoregulated by what the person logged —
/// today's feeling, and last session's finish, effort and pain. Nothing here invents a
/// weight, a record or a medical claim: every number comes out of WorkoutLog entries.
enum AdaptKind { case light, asPlanned, push, deload }

struct Adaptation {
    let kind: AdaptKind
    /// Plain words for why today changed, shown on the Train screen. Nil when nothing changed.
    let reason: String?
    var label: String {
        switch kind {
        case .light: return NSLocalizedString("Lighter today", comment: "")
        case .asPlanned: return NSLocalizedString("As planned", comment: "")
        case .push: return NSLocalizedString("One small push", comment: "")
        case .deload: return NSLocalizedString("Deload week", comment: "")
        }
    }
    /// The day's minutes estimate follows the adaptation: lighter and deload days run shorter.
    func minutes(_ base: Int) -> Int {
        switch kind {
        case .light: return max(10, Int((Double(base) * 0.7 / 5).rounded()) * 5)
        case .deload: return max(10, Int((Double(base) * 0.6 / 5).rounded()) * 5)
        case .push: return base + 5
        case .asPlanned: return base
        }
    }
}

extension Store {
    /// Weeks in the current block: the person's own pick, or the research default
    /// (6 for beginners, 4 otherwise) when they never picked.
    var blockLength: Int { s.profile.blockWeeks > 0 ? s.profile.blockWeeks : (s.profile.experience == "beginner" ? 6 : 4) }
    /// The block's last week is the deload week; if the person has not started the next
    /// block yet, the lighter shape holds until they do.
    var isDeloadWeek: Bool { blockWeek >= blockLength }

    /// Total work in a set of logs: every logged set's reps times its load, in kg.
    /// Bodyweight sets (0 kg) add nothing, which is the truth of the record.
    func totalWork(in logs: [WorkoutLog]) -> Double {
        logs.reduce(0) { sum, w in sum + w.entries.reduce(0) { s2, e in s2 + e.sets.reduce(0) { s3, st in s3 + Double(st.reps) * st.kg } } }
    }
    var totalWorkAll: Double { totalWork(in: s.workouts) }

    /// The most recent logged session before today, if there is one.
    var lastSessionBeforeToday: WorkoutLog? {
        s.workouts.filter { dayKey($0.date) < today }.sorted { $0.date > $1.date }.first
    }

    /// Today's adaptation, decided in order: pain first (never push), then the deload
    /// week, then the feeling, with last session's finish and effort able to soften an
    /// Ok day or unlock the one small push on a Great day. A day the person tapped back
    /// to the full plan always reads as planned.
    func todaysAdaptation() -> Adaptation {
        if s.fullPlanDays.contains(today) { return Adaptation(kind: .asPlanned, reason: nil) }
        let feeling = s.checkins[today]
        let last = lastSessionBeforeToday
        if let last, last.entries.contains(where: { $0.painFlag == true }) {
            return Adaptation(kind: .light, reason: NSLocalizedString("You noted pain last time, so today stays light. Never push through pain.", comment: ""))
        }
        var finished = true
        var hardEffort = false
        if let last {
            if let rid = last.routineId, let r = s.routines.first(where: { $0.id.uuidString == rid }) {
                finished = last.entries.count >= r.exIds.count
            }
            let rpes = last.entries.flatMap { $0.sets }.compactMap { $0.rpe }
            if !rpes.isEmpty && Double(rpes.reduce(0, +)) / Double(rpes.count) >= 9.5 { hardEffort = true }
            if last.entries.contains(where: { ($0.difficulty ?? 0) >= 4 }) { hardEffort = true }
        }
        if isDeloadWeek && feeling != "bad" {
            return Adaptation(kind: .deload, reason: NSLocalizedString("Deload week: about half the sets at a lighter load, so the next block starts strong.", comment: ""))
        }
        if feeling == "bad" {
            return Adaptation(kind: .light, reason: NSLocalizedString("You logged Bad today, so today is shorter and lighter.", comment: ""))
        }
        if feeling == "ok", let last, !finished || hardEffort {
            return Adaptation(kind: .light, reason: !finished
                ? NSLocalizedString("Last session was left unfinished, so today is a little lighter.", comment: "")
                : NSLocalizedString("Last session took a lot out of you, so today is a little lighter.", comment: ""))
        }
        if feeling == "great", let last, finished, !hardEffort {
            return Adaptation(kind: .push, reason: NSLocalizedString("You logged Great and finished last time, so today adds one small push: one extra set on the first exercise.", comment: ""))
        }
        return Adaptation(kind: .asPlanned, reason: nil)
    }

    /// Snapshot the block that is ending, from the logs inside its dates alone, before
    /// nextBlock replaces the routines. A block is snapshotted once.
    func snapshotBlock() {
        guard let first = s.routines.first else { return }
        let b = first.block
        guard !s.blockHistory.contains(where: { $0.block == b }) else { return }
        let start = dateFromKey(s.blockStart) ?? Date.distantPast
        let logs = s.workouts.filter { $0.date >= start }
        var best: [String: [Double]] = [:]
        for w in logs { for e in w.entries { for st in e.sets {
            let cur = best[e.exerciseId]
            if cur == nil || st.kg > cur![0] || (st.kg == cur![0] && Double(st.reps) > cur![1]) { best[e.exerciseId] = [st.kg, Double(st.reps)] }
        } } }
        s.blockHistory.append(BlockSummary(block: b, ended: today, sessions: logs.count, totalWork: totalWork(in: logs), best: best))
    }
}
