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
