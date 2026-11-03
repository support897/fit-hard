# Fit Hard — BUILD 17 GATE PACKET (29 Oct 2026)

Base of record: support897/fit-hard branch qa-fixes-2026-10-26 @ 5de1ebd
(Polar's build 16, TestFlight 16 VALID). Working tree: ~/workspace/fit-b16/
(app code in app/). Build log: ~/workspace/fit-b16/BUILD-LOG.md.
Her GO (29 Oct 20:52): build the proposal whole, TestFlight + GitHub repo.
Her 20:57 fleet rule is inside this build (below). TestFlight ONLY,
never App Review.

## What build 17 is (Wave 1 of the desk proposal + the 20:57 rule)
1. DEMO REMOVED WHOLE: no demo/guest/preview anywhere (door, code,
   session, seed file, words — all gone, proven by absence pins + a
   live door probe). A stale anonymous session is signed out at the
   watcher, never let in. A parked REAL state from the demo era is
   rescued once into the main key (data never deleted).
2. Challenge modes: Hard 75 / Steady 75 / Your own (tasks + 7–365
   days). Daily tasks read real signals (finished session, habit
   tick, water goal, check-in, doses logged) or the user's own tick
   (meals, custom). A missed day is a calm gap — it NEVER erases
   progress. Hard offers a strict-restart CHOICE that moves only the
   count, only by the user's tap, only after a real miss. Ending a
   challenge archives it; nothing is deleted.
3. Water in sips: 250/500/750 + the user's own bottle size, undo of
   the last tap, goal picker, one reminder at a chosen time (rides
   the existing device-reminder engine). Per-day totals + tap stack,
   merged by the fuller day.
4. Food fast and free: recipe favourites (star in the recipe view),
   Recent meals (the plan's own last 14 days), Same as yesterday,
   usual-treats chips from the user's own history, and a FREE
   barcode lookup (Open Food Facts, no paywall) that prefills a
   treat for the user's own Add tap — serving count when given,
   else per-100 g WITH the note saying so.
5. Money-trust list on Plans: "Free stays free" promise + the
   10-item free list + "Pro adds: Unlimited saved routines. That is
   the whole list today..." (the routine cap is the ONLY live
   entitlement gate in the app — verified by grep of every
   entitlement call site) + yearly per-month maths computed from
   the shown price in its own currency format.
6. Machine photo (Polar's rewrite, judged at this desk): compliant
   with the accuracy law — search or pick, a photo earns a
   user-verified confirm step, "Photo match confidence: not
   available" spoken plainly. Five suite pins re-cut to the built
   flow with their protections kept; live-walked.

## Suite + proofs (this tree, this desk)
- Full suite: 488 PASS / 0 FAIL (tests/run-tests.mjs in app/tests/).
- Service worker fitapp-v90; demo-seed.js out of the precache list
  AND deleted from the tree.
- Door probe (live DOM): Google ✓ Apple ✓ email ✓ next ✓ ·
  demo/reviewer/code elements ALL ABSENT · signedOut body ✓ ·
  zero page errors.
- Sign-out probe: healthy → door at 250 ms + signed-out line ·
  stuck sync → door at 250 ms + the failure line verbatim ·
  zero page errors.
- Isolation probe (two stub accounts): B sees NONE of A's data
  (0 treats, no setup, own name), A's data intact on return,
  separate per-account keys · zero page errors.
- Slice probes: challenge (picker, Steady start, tick stored under
  the account key, rest day) · water (750 stored with tap stack,
  undo to 250, goal completes the challenge day by itself) · food
  (yesterday copied, recents head, favourite stored, usual-treat
  chip logs, barcode parse verified against OFF's real response —
  this VM's browser cannot reach the internet, so the live-fire
  barcode check rides QA's packet) · machine flow (36 tiles,
  search, photo confirm, station) · Plans (list + prices render;
  maths verified in node for AU/US/DE/IN price formats).

## The 20:57 rule — state per item
1. No demo: DONE in code + pins + probe (above).
2. Three doors: code stands (fleet cure, build 12 lineage);
   THE LIVE WALK of Google/Apple/email on the packaged build is
   the DEVICE DOOR PASS — QA's lane, still owed, per the fleet
   holding (no seat on packaged verdicts alone).
3. Saved login: browserLocalPersistence stands in auth.js
   (suite-pinned); the kill-and-reopen proof rides the same
   device pass.
4. Isolation: per-uid by construction (Firestore rules of record
   + per-account device keys) + the two-account probe above;
   the two-account CLOUD proof rides the device pass with real
   accounts (her 21 Oct real-account testing order).

## Named limits (nothing hidden)
- Wave 2/3 of the proposal are NOT in this build (gym depth,
  the promised-but-unbuilt Pro surfaces — progress charts,
  personal records, plan library — peptides depth, photo
  progress, partner, widget, Health sync). The Plans copy in
  this build says exactly that.
- The GitHub token is dead (401): the repo commit rides SU's
  signed-in web-session route, as the VPS landings did.
- SU conveyor notes: CPV 16 → 17 is SU's bump. demo-seed.js is
  GONE — the bundle list must not expect it. SW is fitapp-v90.
  owner.js is RESTORED in app/ (the branch's owner.html loads
  it; the branch never carried the file — suite FIT-L4-1).

---

# Fit Hard — BUILD 18 GATE PACKET (Readiness Round 1, 2 Nov 2026)

## What build 18 is
Build 17 + the Round 1 fix batch, nothing else: (1) ALL FREE —
PLANS_LIVE=false (cap open, Pro moment fenced, no plan lines or
buttons on the account page; plans/prices/billing saved in tree,
off) · (2) SPANISH HELD — SPANISH_LIVE=false (language row
hidden, English forced; ES tables saved, unshipped) · (3) J1 FIX —
the one-time Wally reminder ask at the first reminder-bearing
save (Yes = the Settings grant flow; No kept forever). SW
fitapp-v91. Suite 492 PASS / 0 FAIL.

## Gates on these bytes
- Quality PASS (2 Nov): suite re-run 492/0, switches read in
  source, §6 byte-identical (icon master bf56b907 · icon-512
  07c57dd1 · Wally welcome 5d3829c0).
- Efficiency PASS (2 Nov): delta ~2.8 KB across five files, no
  new files, nothing deleted; one micro-note (inert plansOff
  class) deferred to Round 2 bytes.
- QA candidate check (2 Nov): §I all-free PASS · §K2 English-only
  PASS · J1 driven walk + saved-login/isolation spot re-check
  COULD NOT CHECK (their browser lane died mid-check; re-runs
  owed on the shipping bytes; J1 stands meanwhile on the desk
  probe + Quality's read).
- Reality Check (2 Nov): FIRE THE CONVEYOR, conditions below.

## Closed this round (build 17 bytes)
QA delta on the packaged b17 bytes: G1 PASS · kill×3 PASS ·
delete PASS + owner-side console read — DELETE LEG CLOSED
(Auth + root + slices + _comp all gone, verbatim on file) ·
email sign-up/sign-in PASS (29 Oct) · notifications bounded
(pending/firing could not check from any browser lane).

## Open legs carried into build 18 (named, not waived)
- Google sign-in · Google sign-up · Apple sign-in ON THE NEWEST
  BYTES: close on Route 1 — this build's REQUIRED publish-and-
  verify step, then QA's re-walk on the published surface.
- QA's J1 driven walk + spot re-check: owed on shipping bytes
  when their lane heals.
- Notification firing + all phone legs: device-lane residue.
- Apple sign-up: Could not check, skipped by her choice (not
  now) — named in every readiness claim, never absorbed.

## Conveyor conditions (Reality, none waived)
Publish-and-verify filed with proof · custody re-verification
of the packaged bytes (SW v91 + pins read from the IPA; icon
byte-identical read from the package) · candidate discipline:
TestFlight only, never App Review, never "finished" to Ilse ·
the loop closes at Round 3 or not at all.

## AMENDMENT, 2 Nov evening: build 18 VOID, build 19 shipped instead
Build 18's packaged bundle was build 17's bytes (bridge carried
its own app/ copy; the source commit never reached it). Build 18
was removed from both TestFlight groups, never re-attached,
never published. The corrected content shipped as BUILD 19 under
this packet's bytes and gates: bridge census post-carry ZERO
(1,086 files) · run 41406614462 SUCCESS · packaged verification
ALL PASS before attach (SW v91, five pins, icon 07c57dd1) ·
ASC build 19 VALID eb498c68, in her group […, 17, 19] + QA
[12, 16, 17, 19] · ROUTE 1 publish-and-verify COMPLETE (served
four-file MATCH, demo-seed.js deleted, promo + privacy
untouched). QA door verdict on the b19 publish
(verdict-fithard-b19-route1-doors-2026-11-02.md): Google
sign-in Pass · Google sign-up Could not check (approval
latency) · Apple sign-in Could not check (outcome uncertain) ·
Apple sign-up Could not check, skipped by her choice. Full
record: BUILD-LOG.md, Round 1 entries.

# BUILD 20 GATE PACKET — Round 2 guide round (staged 2 Nov, HQ's deploy word)

## Stage 0: delta pins, desk tree fit-b16/app (SW fitapp-v92)
Shipped files changed vs build 19's verified bundle (the same
five as Round 1's delta; everything else in app/ stands at
b19's pins, auth.js named as the control):
- app.js md5-8 b61f94b0 (196,930 B) — was dd8b739a
- index.html 94f46d77 — was 3498343e
- styles.css aba6f359 — was 35408678
- i18n.js 07da590f — was 021acb47
- service-worker.js 324b29f5 (fitapp-v92) — was 30c8a420
- tests/run-tests.mjs a037e988 (not shipped)
- auth.js 5d8f1d62 (unchanged, control)

## Contents
Round 2 guide per READINESS-PLAN's guide spec: tour slimmed
to 3 steps · Getting Started checklist on Today (ticks read
real state, dismissal forever) · coach marks at eight points
of use (seen-flag map) · "Show the guide again" reset (wipes
no user data) · empty-state Wally pass · J1 joins the guide
(from Round 1). Fixes in the same bytes: sign-out clears the
strip greeting at once · nav arrival re-renders Today and
Settings fresh · the inert plansOff class dropped.

## Desk evidence
Suite 501 PASS / 0 FAIL (nine new pins: eight READINESS R2 +
the nav freshness pin; SW pins re-cut to v92) · desk M-walk
probe 27 steps all pass, 0 page errors (tour, checklist
ticking from real actions, coach marks once-only, reset
keeping data, sign-out strip proof with no reload).

## Gates
- Quality PASS (2 Nov): pins exact · suite 501/0 re-run ·
  §6 byte-identical (bf56b907 · 07c57dd1 · 5d3829c0) · guide
  read in code · strip cure read · plansOff zero. Limit: the
  desk probe is desk evidence at their chair.
- Efficiency PASS (2 Nov): pins exact · suite 501/0 re-run ·
  delta ≈ +10.8 KB upper bound judged fair · costs early-out ·
  waste scan clean.
- QA candidate check: VERDICT LANDED during the conveyor
  (verdict-fithard-r2-guide-2026-11-02.md): M1 Pass · M2 Pass
  with plans mark Could not check (surface off by design,
  desk ruling: out of scope while plans are off) · M3 Pass ·
  M4 Pass · strip leg Pass · saved-login/isolation spot
  re-check Pass. Two observations judged at the desk: drawer
  staying open after a navigation choice = Round 3's first
  fix; reopen landing view = Round 3 A-script item.
- Reality Check: FIRE THE CONVEYOR NOW (2 Nov), QA's §M walk
  owed onto the shipping bytes as a hard Round 3 gate.

## Conveyor conditions (carried, none waived)
Bridge carry FIRST, then the post-carry census of the WHOLE
bridge app/ vs the desk tree at ZERO differing (the b18
lesson) · CPV 19 → 20 · packaged verification on 20 BEFORE
any group attach (SW v92 + pins + icon 07c57dd1 + 1.1 (20)) ·
attach her group + QA lane, read back · Route 1 publish
updated to the verified 20 bundle with the served comparison
filed · candidate discipline: TestFlight only, NEVER App
Review, never "finished" to Ilse.

## BUILD 20 CONVEYOR — CLOSED RECORD (2 Nov)
Branch qa-fixes @ d26a27a · bridge @ c132cd2 · post-carry
census ZERO (1,086 files) · run 41441741538 SUCCESS ·
packaged verification ALL PASS before attach (zip 692e160a…
· IPA 9569bd66… · SW fitapp-v92 · every pin exact) · ASC
build 20 VALID c734ac23 · groups her […, 19, 20] + QA
[12, 16, 17, 19, 20] · Route 1 publish 59a085a, served
comparison all MATCH. QA's Round 3 full-script walk runs on
this surface.

---
# BUILD 21 GATE PACKET — Round 3 fixes (BATCH FINAL v3, 3 Nov, night order)

## Stage 0: delta pins vs build 20's verified bundle (SW fitapp-v96)
- app.js b61f94b0 → f748f82c
- logic.js (unchanged in 20) → d1413f20
- service-worker.js 324b29f5 → f241c85a (fitapp-v96)
- tests/run-tests.mjs a037e988 → 805fd503 (not shipped)
- UNCHANGED controls: index.html 94f46d77 · styles.css
  aba6f359 · i18n.js 07da590f · auth.js 5d8f1d62
- SUPERSEDES the v94 filing (app.js 70468014 · SW 37d5e5f0
  · tests b81b5b20) and the v95 filing (app.js f748f82c ·
  logic.js 02923236 · SW de60f27f · tests 764e2af5):
  Quality + Efficiency PASSed v94, then v95 (fix 4, the
  tour-skip cure); QA's candidate check then named a
  sync-window edge in fix 2, cured as fix 5, so both
  deltas re-run on v96. No conveyor moved at any step;
  SU's staged set is updated at each step.

## Contents
1. Drawer close (app.js): closeSbOnPhone() — at the
   stylesheet's phone breakpoint (700px), choosing a
   destination (openArea incl. guide deep-links, [data-view]
   nav, openPlans) closes the open drawer so the screen
   lands full width. Desktop + her sidebar law untouched.
2. Setup quiet (app.js + logic.js): the skip writes
   profile.setupSkipped; afterTour's auto-offer requires
   !setupDone && !setupSkipped; repairState's whitelist
   carries the flag. Checklist row + Settings roads still
   open the sheet by hand.
3. Entry lands on Today (app.js): onSignedIn shows Today
   before the follow-up — QA's landing observation (the
   sign-out/sign-in cycle never left Settings) cured at its
   root. Desk ruling under the night order: home is Today;
   the line is one call, customer-correct on every entry.
4. Tour-skip birth (app.js, added 3 Nov after QA's addendum
   on 20): endTour now births the profile WHOLE,
   unconditionally, at the top of every tour exit (Done,
   Skip, X, import road) — the birth used to ride inside
   the step-1 name branch, so an exit that never passed
   that branch could leave the account unborn: no profile,
   setup never offered, the checklist's setup row dead
   (QA's walked finding on the shipped 20 publish). The
   name save keeps its conditions; the birth is the
   F-B11-1 doctrine applied to the tour's exits. Desk
   disclosure: the desk's stub repro (probe_tourskip.py,
   email-door shape, no provider name) passed all skip
   shapes 18/18 even BEFORE this cure — the failing
   construction on the real surface is not reproduced at
   this desk; the cure closes the named seam structurally,
   and QA's retest walks THEIR exact shape on 21.

5. Setup-skip merge carry (logic.js, added 3 Nov after
   QA's candidate check on v94): mergeStates' profile pick
   takes the cloud profile whole whenever the local one
   has not completed setup, so a "Not now" whose cloud
   mirror had not landed was dropped by the next sign-in
   merge and the sheet re-offered once (QA's edge, walked:
   one re-offer on the fast cycle, quiet on every settled
   return). Cure at the same seam as the F1 firstSeenAt
   carry, mirror-imaged: if either side's profile carries
   setupSkipped, the merged profile carries it; a
   completed profile is never re-flagged.

## Desk evidence
- Suite 507 PASS / 0 FAIL (6 R3 pins: repair carries the
  flag · helper + 3 call sites + 700px · offer condition +
  flag write · the landing line standing before the
  follow-up · endTour births before its step branch · the
  skip survives the sign-in merge from either side; SW
  pins at v96).
- Desk probe hidden_files/probe_r3_fixes.py: 17 steps ALL
  PASS, 0 page errors (offer/skip/quiet/road-back ·
  pre-flagged quiet · drawer closes on area + top view at
  390px · desktop control stays open · sign-out from
  Settings then re-entry lands on Today).
- Desk probe hidden_files/probe_tourskip.py: 21 steps ALL
  PASS, 0 page errors (fresh email-door accounts: Skip at
  step 1 · X at step 1 · blank Next then Skip at step 2 ·
  completed-tour control · cross-entry reload legs: the
  birth persists and the setup road stands).
- Desk probe hidden_files/probe_merge_carry.py: 5 steps
  ALL PASS, 0 page errors (the merge driven end to end
  against a cloud record without the answer: the stored
  profile keeps it, the sheet stays quiet; the control
  with no answer anywhere still offers).

## Gates (HQ's loop order)
Quality delta · Efficiency delta · QA retest on the NEW
build (packaged proof first) · Reality LAST. Then conveyor
under the same carried conditions: bridge carry + post-carry
census ZERO · CPV 20 → 21 · packaged verification BEFORE
attach · groups read back · Route 1 publish to the verified
21 bundle · TestFlight only, NEVER App Review.
