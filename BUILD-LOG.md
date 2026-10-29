# BUILD LOG — Fit Hard, build 17 wave (base: branch qa-fixes-2026-10-26 @ 5de1ebd)

## BASE OF RECORD (verified 29 Oct 2026, two hands)
- support897/fit-hard branch qa-fixes-2026-10-26 @ 5de1ebd = Polar's build-16 source.
  SU sweep read the markers from the branch tree; SU downloaded the archive via the
  signed-in web session (ZIP 39,851,477 B) and unpacked to ~/workspace/fit-b16/;
  this desk re-read the markers from the unpacked files: pbxproj
  CURRENT_PROJECT_VERSION = 16 (lines 314 + 337) · app/service-worker.js
  `var CACHE = "fitapp-v89";` · 1,091 files.
- Polar's three commits over main's build-13 head: account save isolation fix ·
  verified machine choice and search · bad-days planning.
- Desk deltas vs the build-13 tree: auth.js / styles.css / logic.js IDENTICAL
  (the build-13 sign-out cure is inside the branch) · app.js / i18n.js /
  index.html / service-worker.js differ (Polar's folds; signOutFlow present ×3).

## SUITE BASELINE on the untouched branch tree: 467 PASS / 16 FAIL
(run on a throwaway copy with desk-record stand-ins for reads-only files)
Classification of the 16:
- REAL GAP (1 root, 5 pins): app/owner.html loads owner.js; the branch carries
  NO owner.js. Pins: FIT-L4-1 · owner door · owner surface _owner-only · owner
  dashboard sections · ND vendored SDK (reads owner.js). CURE: owner.js restored
  from the desk record (fit-app/owner.js, the shipped file) — see re-homing below.
- STUB ARTIFACTS of the baseline copy (2 pins): PAYMENTS §3 + two-hat rules —
  both read rules files the baseline stubbed empty. The deployed rules of record
  stand untouched in fit-app/ (sha 0fc517a5…); the branch carries no rules files.
- VERSION RE-CUT (2 pins): SW pins name v87; the branch is v89. Mechanical.
- LAYOUT ARTIFACT (1 pin): LOGO — its no-icon.svg clause reads ../../icon.svg,
  which in the repo layout is the PROMO root's icon.svg, byte-identical to the
  approved stretch master (md5 bf56b907). App icon-512 == brand master
  (md5 07c57dd1) verified. No §6 issue.
- OPEN READS assigned to the build (6 pins): TB prices-ride-the-bundle (read
  with the money-trust slice) · machine photo v2 ×5 (Polar rewrote the feature;
  judge its shape against the accuracy law before re-pinning or restoring).

## RE-HOMED INTO THE WORKING TREE (from the desk record, 29 Oct)
The branch archive never carried the desk-side source set. Placed into
fit-b16/app/ as the build's working copies of record: owner.js (REAL gap cure) ·
firestore.rules · firestore-twohat.rules · privacy.html · brand/ (the §6
masters) · the suite (tests/, paths adjusted to the repo layout) · the three
*-node.js harness shims. App source files otherwise remain branch-pure.

## THE BUILD (her GO 29 Oct 20:52 + the 20:57 fleet rule)
Build 17 = proposal Wave 1 + the 20:57 rule, in slices:
1. Demo removed whole (door = sign up / sign in only).
2. Challenge modes Hard / Steady / Custom + no-erase progress.
3. Water in sips.
4. Food fast-and-free (recents · same-as-yesterday · free barcode).
5. Money-trust list in Plans.
Final carries: three doors walked with test accounts · kill-and-reopen
saved-login proof · two-account isolation proof (incl. peptides + photos).
Four checks on the same build (Quality · Efficiency · QA · Reality Check),
commit to support897/fit-hard, TestFlight via SU — TestFlight only, never
App Review.

## SLICE 1 — DEMO REMOVED WHOLE (29 Oct, desk-proven)
- app.js: door demo row + reviewer code row out · enterDemo/demoPicks/
  startDemo/park-restore functions out · every demoMode branch resolved to
  its real arm · boot fence is now a rescue-only migration (a parked real
  state is restored once, legacy keys cleared, no demo can start) ·
  a stale anonymous session is signed out at the watcher, never let in ·
  sha256Hex (reviewer-code machinery) out · demoBanner render hook out.
- auth.js: enterDemoSession + ensureDoor + signInAnonymously import out ·
  no unlockHash is ever written (a pre-17 root field is not carried forward).
- index.html: #demoBanner + demo-seed.js script out · demo-seed.js deleted ·
  service-worker.js: seed out of the precache list · styles.css: demo rules
  out · i18n.js: 16 demo keys out in EN + ES.
- Suite: demo pins rewritten as NO DEMO absence pins → 470 PASS / 7 FAIL
  (the 7 = SW v87→re-cut ×2 at the fold + machine-photo ×5 open read).
- Probes on the tree (port 8953): door DOM = Google ✓ Apple ✓ email ✓
  next ✓ · demoBtn/reviewerBtn/codeInput ALL ABSENT · body signedOut ✓ ·
  zero page errors. Sign-out probe: healthy → door 250 ms + the signed-out
  line · reject → door 250 ms + the failure line verbatim · zero errors.

## SLICE 2 — CHALLENGE MODES + NO-ERASE PROGRESS (29 Oct, desk-proven)
- logic.js engine: state.challenge (repairChallenge: modes hard/steady/
  custom · length clamped 7–365 · tasks filtered to real kinds, deduped,
  max 8 · restDays + ticks day-maps · strict + countFrom + endedISO) ·
  challengeDay (satisfaction from real signals: finished session · habit
  tick · water goal · check-in · doses logged; user ticks for meals/custom)
  · challengeProgress (done/rest/missed/today/future per day; daysDone
  counts from countFrom only under Hard+strict) · merge (later start wins;
  an ended challenge stays ended) · state.water per-day ml + waterGoalMl.
- app.js: #challengeCard on Today (moved out of the budget card after the
  first probe caught it hidden inside) — picker with the three modes ·
  custom builder (task checkboxes incl. habits + own task + days) · day
  strip (last 14 days) · task rows (auto state or tick buttons) · rest-day
  mark/undo · Steady weekly-rest line · Hard strict-restart (count only,
  by the user's own tap, only after a real miss) · end archives into
  challengePast, nothing deleted · bad-day softer line. i18n ch.* EN+ES.
- Suite 475/7 (+5 challenge/water pins; one pin typo of mine found +
  fixed — the engine was right). Live probe: 3 modes render · Steady
  starts (Day 1 of 75 · 4 tasks · 1 dot) · meals tick stores
  challenge.ticks under the ACCOUNT key · rest day marks · zero errors.
  Probe lesson banked: add_init_script seeds must be IIFEs (a bare arrow
  function never runs); per-account key = fit-app-v1-account-<uid>.

## SLICE 3 — WATER IN SIPS (29 Oct, desk-proven)
- logic.js: state.waterTaps {iso: [ml]} (repair filters 25–5000, max 40;
  the day total recomputes as max(stored, sum of taps)) · merge takes the
  fuller day's taps · planReminders gains a water entry (settings.
  waterReminder "HH:MM", 7 days ahead, today only while the goal is open);
  the scheduler titles it from the word layer (water.remindTitle).
- app.js: water card at the head of the Meals plan screen — today's total
  of the goal · 250/500/750 buttons + the user's own bottle once set ·
  undo takes back the last tap · goal picker (1500–3000, rides
  settings.waterGoalMl) · reminder time + off. Every change saves and
  re-renders the challenge card (water is a challenge signal).
- i18n water.* EN+ES (one insert landed in the wrong object — caught by
  the Spanish-parity pin and moved; anchor inserts on distant keys).
- Suite 478/7 (+3 water pins). Live probe: taps store 750 with taps
  [250, 500] under the account key · line "750 of 500 ml today" · undo
  pops back to 250 · at the goal the challenge day completes itself
  ("1 days done" grammar wart found by the same probe; ch.oneDayDone
  added EN+ES) · zero page errors.

## SLICE 4 — FOOD FAST AND FREE (29 Oct, desk-proven)
- Favourites: state.favRecipes (repair keeps the user's list, merge
  unions) · star toggle in the recipe modal · "Your favourites" group
  heads the recipe list, "Recent meals" under it (logic.recentRecipeIds:
  the plan's own last 14 days, newest first, max 8), then All recipes.
- Same as yesterday: one tap on the plan screen copies yesterday's set
  slots onto today (slots yesterday lacked stay untouched).
- Usual treats: the treats screen grows frequency chips from the user's
  own history (latest count rides along); one tap logs it for today.
- Barcode, free forever: a code typed on the treats screen looks up
  Open Food Facts (no key, no paywall — the anti-MyFitnessPal point);
  a hit prefills name + count for the user's own Add tap (serving count
  when the product gives one, else the per-100 g count WITH the note
  saying so); no match and no internet both speak plainly.
- Suite 480/7 (+2 pins). Live probe: yesterday copied onto today in the
  account store · Recent meals head renders · favourite stores ·
  usual-treat chip logs for today · zero errors. Barcode: the success
  path is verified against OFF's real response for 3017620422003
  (status 1 · "Nutella" · 539/100 g, no serving count) — this VM's
  browser cannot reach the internet (the known wall; the offline line
  spoke), so the live-fire check rides QA's packet.

## SLICE 5 — MONEY-TRUST LIST ON PLANS (29 Oct, desk-proven)
- Prices verified first: prices-data anchors 7.99/59.99/149 == the ASC
  products of record == the app fallback line; cancel-anytime already
  stands in the renewal words (EN+ES). The one live entitlement gate
  in the app today is the routine cap (free 3, Pro unlimited) — the
  lists say exactly that, nothing more.
- Plans gains a "Free stays free" card: the promise line + the 10-item
  free list (all verified present in this build) + "Pro adds:
  Unlimited saved routines. That is the whole list today. When more
  Pro extras are built, they will be named here before they are sold."
- Yearly maths line under the yearly price, computed from the shown
  price in its own currency format (AU "About A$5 a month" · US $3.25
  · DE €2.58 · IN ₹99.92 — the thousands-comma case caught in node
  verification and fixed; European decimal commas handled).
- Suite 481/7 (+1 pin). Live probe: free title + 10 items + Pro line
  + all three prices + cancel line render; maths verified in node
  against the real price table for four countries.

## THE FOLD (29 Oct)
SW fitapp-v89 → v90 (demo-seed out of the list + the file deleted);
both SW pins re-cut. FULL SUITE: 488 PASS / 0 FAIL.
Proofs run at this desk on the folded tree: door DOM probe (no demo
elements; three doors present) · sign-out probe (healthy + reject,
door 250 ms, lines verbatim) · two-account isolation probe (B sees
none of A's data; A intact on return; separate keys; zero errors) ·
slice probes for challenge/water/food/machine/Plans (BUILD-LOG
entries per slice). Gate packet: ~/workspace/fit-b16/GATE-PACKET.md.
Next: Quality + Efficiency reads → QA (device door pass lane) →
Reality → SU conveyor (CPV 17, web-session commit, TestFlight only).
Gate state 29 Oct evening: Quality PASS + Efficiency PASS both at
their own hands on these exact bytes (suite re-run 488/0 at both
chairs; Quality's asset check: icon byte-identical to the approved
master's export, Wally art byte-identical to the pack master). QA
commissioned with the device-door lane + live-fire barcode named.
REALITY CHECK 🔴 FAIL — NOT FINISHED (29 Oct 23:11), judged from
this desk's whole conversation + packet + QA's verdict + the tree
at Reality's own hand. Bad news, theirs: (1) Google + Apple door
completions unproven — wiring proven, completion not; the 20:57
rule orders each door walked to completion. (2) Nothing is
device-proven — no packaged build exists; the DEVICE DOOR PASS is
still the fleet's open lane; ~20 browser relaunches ≠ a phone.
(3) Delete not proven for this build — no delete leg in the packet
or QA's verdict; owner-side footprint read absent (the audit is
parked console-gated). (4) Water reminder native firing never
observed. (5) Build 17 is Wave 1 only; her GO was the proposal
whole — Wave 1 cannot be reported as the whole proposal finished.
CREDITED in full: suite 488/0 at four chairs · demo-seed absent
verified at Reality's hand · icon the strongest asset proof of the
night (byte-identical, md5-matched at their hand) · F-FIT-SIGNOUT
closed · isolation real · barcode live-fire · Plans honesty.
TERMS: SU fires as a CANDIDATE for TestFlight only, never App
Review, never to Ilse as finished; owed on the packaged bytes:
device door pass · Google + Apple completions (test Google
identity + test Apple ID must exist first) · phone kill-and-reopen
· owner-side delete read · water reminder firing observed ·
custody re-verification of the packaged bytes (bridge jumps
13→17: SW fitapp-v90, icon, chunk pins). SU dispatched on these
terms 29 Oct 23:1x. Wave 2/3 remain desk work for the next builds.

QA PASS (29 Oct 23:09): full verdict ~/workspace/qa-tester/
verdict-fithard-b17-2026-10-29.md · evidence ~/workspace/qa-tester/
fit17-evidence/ (23 frames) · suite reproduced 488/0 at QA's hand.
Real accounts throughout. Door purity census clean · email door
both directions on two accounts · saved login across ~20 relaunches ·
healthy sign-out 511 ms · F-FIT-SIGNOUT RETEST: the b12 wedged
account signs in clean under b17 and signs out in 516 ms — the b12
silence does not reproduce · isolation real (B holds none of A;
A intact) · all three challenge modes driven (no-erase proven,
strict moved ONLY countFrom, end archives) · water exact (taps,
own bottle 600, undo, goal completes the day) · food (favourites,
recents, same-as-yesterday, Nutella chip) · BARCODE LIVE-FIRE:
3017620422003 → "Nutella", 539, per-100 g note verbatim, nothing
logged until QA's own Add tap · machine photo honesty lines stand ·
Plans list true, maths right, "Pro is not on sale in the store yet"
said in the open · icon byte-identical, both widths clean.
COULD NOT VERIFY (QA, named): Google completion (identifier page
rendered; no Google-account password for a test identity at QA's
chair) · Apple completion (service ID proven; no test Apple ID) ·
water reminder's native firing · the packaged DEVICE DOOR PASS
(the fleet's named open lane). Reality Check commissioned last,
carrying every one of these by name.
SU PREP CONFIRMED at SU's hand: packet read, tree verified (SW v90,
demo-seed absent + zero SW mentions, owner.js present 15,291 B,
app/ 1,086 files). SU bridge note for dispatch: the fit-hard-build
bridge still stands at the build-13 carry (pbxproj 13) because
Polar's 14–16 never rode it; SU's carry sets it straight to 17 and
replaces the bridge's app/ with build 17's — "nothing between is
skipped that the build consumes" (SU's judgement, their chair).
This note rides the Reality Check commission by name.

## MACHINE-PHOTO OPEN READ — CLOSED (29 Oct)
Polar's rewrite judged COMPLIANT with the accuracy law — better than
the desk's v2: the header comment and the hint line say the app cannot
reliably name machines from photos, nothing is auto-selected, and a
photo triggers a user-verified confirm step ("Photo match confidence:
not available") before the station opens. The 5 pins failed on stale
anchors/wording, not substance; all five re-pinned to the flow as
built with their protections kept (claim scan now excludes the denial
key's own name + the header comment). Live probe: 36 tiles · search
narrows to leg-press · photo speaks the confidence line · confirm
card gates the station · station opens with its routine road · zero
errors. Suite after re-pin: 486/2 — only the SW version pins remain,
re-cut at the fold.
