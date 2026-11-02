# Fit Hard — READINESS PLAN (2 Nov 2026)

Her order (2 Nov, via HQ): understand the whole app as a user; write
the implementation plan FIRST — every step a customer would do and
everything that must be tested before Fit Hard is ready for
customers, thinking as the best QA tester ever — then test end to
end, fix what fails, re-upload to GitHub + TestFlight, re-test,
loop until fully ready. Fully autonomous. Finals to HQ only when
the loop closes.

## WHAT "READY" MEANS (the bar, all on the same shipping build)
1. No demo/try/preview way in. Door = sign up / sign in, always.
2. Sign in/up PROVEN for Apple, Google AND email (Firebase), each
   walked to completion with test accounts.
3. Saved login: signed in once = stays signed in across kill and
   reopen, until the user chooses log out. Proven.
4. Notifications: asked (with an honest refusal), on, and actually
   fire. The build-17 water-reminder leg closes or is honestly
   re-named with its exact limit.
5. Isolation: every user's info fully separate, nothing shared,
   nothing hardcoded. Proven with multiple accounts.
6. All info saved: everything entered is saved, returns after
   reopen, and stands on the server record.
7. Mascot guide: Wally shows users around ALL over the app; the
   app is intuitive and interactive; the guide itself is tested
   as a customer step. Built with the existing Wally art as-is
   (logo/icon/mascot never redesigned).
8. Delete closes on an owner-side read of the full footprint
   (Auth record + users/{uid} root + slices/* + _comp/{uid}, all
   at 404), per fleet law.
Plus: the full customer journey (below) walks clean end to end on
phone view with real taps, top-space and no-zoom legs included,
and the four checks (Quality · Efficiency · QA · Reality) pass on
the SAME bytes that ship. Built ≠ tested ≠ phone-tested: anything
only a real phone can prove is named as such, never passed silently.

## BASE TRUTH (read at this desk 2 Nov)
- Build 17 = candidate of record: repo support897/fit-hard branch
  qa-fixes-2026-10-26 @ 186ca1b · ASC 17 VALID (3c4cb348) ·
  IPA sha256 c8f58e5f · SW fitapp-v90 · suite re-run today: 488/0.
- Build 17 carries: demo removed whole · challenge modes · water
  in sips · food fast + free barcode · money-trust Plans list.
- Owed from Reality's FAIL: Google + Apple completions · device
  door pass · phone kill-and-reopen · owner-side delete read ·
  water reminder firing.
- Working tree ~/workspace/fit-b16/ == the committed tree (SU's
  pre-dispatch census: 1,086 files, zero differing).
- Records re-read for this plan: fit-b16 BUILD-LOG + GATE-PACKET ·
  fit-app CUSTOMER-JOURNEY (steps 1–2 corrected today: they still
  described the removed demo) · QA verdict b17 · Reality verdict.

## DOOR-LEG CLOSING ROUTE (HQ ruling, 2 Nov 2026, REQUIRED)

The on-bytes Google + Apple door legs (QA: Could not check on
b17 — their lane cannot serve packaged bytes to the session
browser) close on ROUTE 1: the build 18 upload MUST carry the
newest build to the web publish and verify the served bytes
equal the packaged bytes; QA then re-walks the doors on that
surface. Publish-and-verify is a REQUIRED step of the build 18
round, named in its filings, not an option. Route 2 (the device
door pass) remains the other closing path. A temporary check
path on the Pages origin was commissioned and stood down the
same hour under this ruling; nothing rides on it.

## SURFACES LAW (her correction, 2 Nov 2026, binds every leg)

ALL testing and proof runs on the NEWEST TestFlight build's own
bytes: for build 17, the certified tree (repo branch
qa-fixes-2026-10-26 @ 186ca1b — the bytes the IPA was built from).
The moment build 18 lands, testing moves to 18. The stale live
web publish is NOT a test surface; a result from any surface
whose bytes were not verified equal to the newest build does not
count. The 2 Nov Google + Apple completions stand as PROJECT
level proof only (the production doors work); both doors re-walk
on build 17's own bytes at QA before any "ready" word. The
upload step in each round also carries the newest build to the
web publish, with served bytes verified equal to the build, or
the publish stays named stale. NOTE for walkers: this desk's
working tree (~/workspace/fit-b16) now carries the UNSHIPPED
Round 1 fix batch — it is NOT build 17's surface. Build 17's
surface is the branch tree @ 186ca1b.

## AMENDMENT (her order 2 Nov, mid-loop — folds into every round)
1. ALL FREE FOR NOW. The shipped app has NO paywall, NO plan
   gates, every feature open and free for every user. The plans,
   prices (Fit Pro A$7.99/mo · A$59.99/yr · Forever A$149) and the
   billing code stay SAVED in the tree, switched OFF (one word:
   PLANS_LIVE = false in app.js), for later — never deleted.
   Proofs owed: (a) a fresh user reaches EVERY feature with no
   payment step anywhere (routine cap never bites — 4th, 5th
   routine save freely; no Plans screen reachable; no Pro moment;
   no plan lines on the account page); (b) the saved plans still
   exist in the tree, off (prices-data anchors stand · plan code
   present · the switch reads false).
2. SPANISH HELD BACK. The shipped app is English only: no Spanish
   version, no language switch shown. The translations stay SAVED
   in the tree, unshipped (SPANISH_LIVE = false): the Settings
   language row is hidden and the resolver forces English whatever
   the device or a saved setting says. The parity pins keep
   guarding the saved ES tables. New copy in this loop is written
   EN only; its Spanish is owed when the hold lifts.
Both fold into the Round 1 fix batch (build 18) BEFORE any upload.
Script steps §I and §K2 below are rewritten to this truth.

## EVERY CUSTOMER STEP — THE TEST SCRIPT
Walked in order, phone view first (390–402 px), every field really
tapped and typed in, then the wide view. A fail at any step is a
defect: fix, re-gate, re-ship, re-walk.

A. FIRST OPEN + DOOR
A1 Cold open: shell at once, door only (no app content leaks to a
   signed-out user), big mark, cream/sage, no hang on no-network.
A2 Door census: Google · Apple · email field + next arrow. NO
   demo, guest, preview, reviewer-code element anywhere in the
   app (DOM census + word census, both languages).
A3 Email sign UP (fresh plus-tag account): email step → password
   step → Continue → inside the app. Wrong-password and
   weak-password attempts speak plainly. Reset line sends a real
   reset email and the new password signs in.
A4 Email sign IN (same account, signed out): both directions land
   inside; the failure lines for wrong password / no account are
   honest words, never silence.
A5 Google door: walked to COMPLETION (chooser → account → inside
   the app), with a test Google identity (see routes below).
A6 Apple door: walked to COMPLETION (Apple sheet → inside), with
   a test Apple identity (see routes below).
A5u/A6u SIGN-UP TWINS (her order + clarification, 2 Nov): sign up
   and sign in are DIFFERENT TESTS in method, not just reporting.
   Sign up = an identity with NO account yet: the proof is the
   account CREATED (new user record on the server) + the first
   ever entry + the first-run welcome flow (tour + setup). A
   sign-in pass never counts as a sign-up pass; a walk that lands
   in an old account is not a sign-up test. Google sign-up uses
   projects.reports.ilse@gmail.com (no Fit account). APPLE
   SIGN-UP: NOT NOW by her word — skipped by her choice, stands
   Could not check, never a pass, no test Apple ID is created.
   The door legs never shrink the rest of this script: every
   other section continues in full.
A7 Sign-out: healthy → door + "Signed out."; the b12 wedged-account
   retest stands in the suite of record (F-FIT-SIGNOUT).
A8 Saved login: sign in → kill → reopen ×3 → still inside, no
   door. Sign out → door returns. (Browser-lane proof + the phone
   leg named separately in the matrix.)

B. TOUR + SETUP + GUIDE (the guide is a customer step)
B1 Tour fires once for a new account: Wally centred, step 1 asks
   the name (skippable; skipped name = one quiet re-offer next
   visit, then never again). ✕ closes any time. Replay from
   Settings never erases a saved name.
B2 Setup sheet: name, goal, weight, height, food likes, allergies,
   needs. Skippable whole and per part; areas not needed hide;
   every answer changeable later in Settings and the change shows.
B3 Guide (Round 2 build, tested here): see GUIDE SPEC. Checklist
   on Today ticks from real state; coach marks fire once per area,
   one at a time; empty states teach with the creating button;
   dismissal is forever; Settings can replay the whole guide.

C. TODAY + CHECK-IN
C1 Morning check-in Bad/Ok/Great each walked: Bad visibly softens
   the day (lighter session offered, gentler words); Great = full
   day. Check-in saves and survives reopen.
C2 Challenge card: start each mode (Hard 75 · Steady 75 · Custom
   with own tasks + days); a day completes from real signals; a
   missed day is a calm gap, progress NEVER erased; rest day
   mark/undo; Hard strict restart is opt-in and moves ONLY the
   count; ending archives, nothing deleted.

D. MEALS
D1 Plan day renders with a real calorie count on every meal that
   has one; ingredient-less shows none. Swap a meal; open a
   recipe (counts, steps); star a favourite (group heads the
   list); Recent meals from the plan's own history; Same as
   yesterday copies exactly the slots yesterday held.
D2 Water card: tap 250/500/750 and the user's own bottle; total
   exact; undo removes the last tap only; goal picker stores;
   reaching the goal completes the challenge day by itself.
D3 Fridge photo → ideas; own recipe add (photo + typed + voice
   notes) saves and appears; treats: log a treat (outside the
   diet, no blame words), usual-treats chip logs in one tap,
   barcode 3017620422003 live-fires (Nutella, 539, per-100 g note
   verbatim, nothing logged until the user's own Add tap);
   barcode no-match and offline both speak plainly.

E. GYM
E1 Build a routine for a goal + time; the free cap speaks at the
   4th routine (locked tap says so + opens Plans); routine lands
   on the calendar with its reminder entry.
E2 Session: start, big timer runs, rep counting taps, moving
   picture for the exercise, finish saves the session (feeds the
   challenge signal + history).
E3 Machine photo: tiles (36), search narrows, photo → the
   confidence-unavailable line → confirm → the right station with
   how-to + its routine road; no-photo tap browses straight.
E4 Library: open exercises, how-to reads true; the 5 held-by-name
   exercises stay library-true (no invented content).

F. PEPTIDES (records only — the fence is a test point)
F1 Disclaimer: shown once, must agree, agreement kept on the
   account; declining keeps the area closed.
F2 Add a peptide: own colour, own amounts, dose log, next-dose
   reminder in generic words. NO screen anywhere recommends a
   dose, a product, or a schedule (word census EN+ES).

G. CALENDAR
G1 Habits + to-dos: add by typing and by messy note/voice; a
   habit tick saves (feeds challenge); Meals + Gym plans show on
   the same calendar; edit + delete own items work.

H. SAVE FOREVER + ISOLATION (accounts A, B, C — plus-tags on BOTH
   her Gmails: placenciailse@gmail.com, projects.reports.ilse@
   gmail.com)
H1 Enter data as A in every area → sign out → sign in as B: B sees
   NONE of it (profile, treats, challenge, water, favourites,
   routines, doses) — B's app is a fresh, empty, own app. B enters
   its own → back to A: A's data intact, B's invisible.
H2 Server record: A's slices on Firestore hold exactly A's state
   (owner-console read); the client never writes another uid's
   path (rules of record stand: users/{uid} + slices only).
H3 Reopen persistence: every area's entries return after kill +
   reopen on the same account (rides A8's lane per area).
H4 Repairs never drop: a state with legacy/odd fields loads whole
   (suite pins stand guard).

I. ALL FREE (amended 2 Nov — replaces the free-month/Plans script)
I1 Fresh user: save a 4th and 5th routine — both save, no cap, no
   locked tap, no Pro moment, no payment step of any kind.
I2 No selling surface exists: the account page shows NO plan line,
   NO "see what Pro adds" button, NO Plans button; no Plans screen
   is reachable from anywhere; a DOM census for price/plan words
   on user surfaces reads zero (the saved code never renders).
I3 Saved-off proof: prices-data still anchors 7.99/59.99/149; the
   plan + billing code stands in the tree; PLANS_LIVE reads false;
   the suite's price pins pass against the SAVED files.
I4 No store intro offers anywhere (standing law census — clean
   2 Nov). The free-month machinery stays in auth.js, saved and
   invisible: no user ever sees a plan or a day count.

J. NOTIFICATIONS
J1 The ask: at the first reminder-setting moment the app asks
   with Wally, naming what will arrive; "Not now" is an equal,
   kept choice; Settings can change it later. (Pattern per Strava/
   Cal AI research: own moment, real refusal.)
J2 On: permission state reads granted (plugin read-back);
   reminders scheduled for real entries (session, dose, water)
   — pending-list read-back where the lane supports it.
J3 Firing: a reminder set 2 minutes out FIRES and is observed
   (lane named per attempt; the real-phone firing is device-only
   until the device lane exists — close it there or carry it
   named, never gloss it).

K. SHAPE IT YOURSELF
K1 Backgrounds: white · black · brand colours · own photo — words
   stay readable (contrast) over each; the uploaded photo is the
   user's data, isolated like everything else.
K2 Language (amended 2 Nov): the shipped app is English only —
   Settings shows NO language row; a Spanish device still gets
   English; a saved "es" setting from an older build still gets
   English. The saved ES tables stand in i18n.js (parity pins
   green) and the user's own words are never translated (moot
   while held, still pinned).
K3 Top-space + no-zoom on every screen, both widths; sidebar
   opens to most of the phone screen, closes to the sliver.

L. EXPORT + DELETE
L1 Export from Settings produces the user's data file.
L2 Delete: re-auth with password → confirm → the account and its
   cloud data go; the phone copy wipes ONLY after the server
   confirms; signing in again starts a fresh empty app.
L3 OWNER-SIDE READ (closes the leg): after L2, read the full
   footprint from the owner side — Firebase Auth record gone ·
   users/{uid} root 404 · slices/* 404 · _comp/{uid} 404. Access-
   death proofs close nothing; this read is the only closer.

M. GUIDE (built Round 2, tested as its own customer journey)
M1 New account: entry tour (slim) → setup → Today shows the
   Getting Started checklist; each row takes the user to the
   exact screen and ticks itself off from real state; finishing
   or dismissing removes it forever.
M2 First visit to each area shows ONE Wally coach mark at the
   point of use (Meals plan · Gym routines · Session · Machine
   photo · Calendar · Peptides · Treats · Plans); Got it =
   never again for that area; marks never stack, never block the
   screen's own first action.
M3 Empty states: no routines / no habits / no doses / empty plan
   day / no favourites — each shows Wally + one line + the button
   that makes the first one.
M4 Settings "Show the guide again" resets tour + marks +
   checklist for a fresh walk; a replay never erases user data.

## TEST ROUTES FOR THE HARD LEGS (named before anyone walks)
- Google completion: her Gmails ARE Google identities. Route: a
  browser task in the signed-in session opens the live app, taps
  the Google door, picks her account at the chooser — no desk ever
  types her password (the browser's own session does the work).
  If Google demands a fresh password or a device prompt, that is
  a genuine blocker: named to HQ in one plain sentence (fleet
  sign-in law: no tap-on-phone / number-match ever; email codes
  are HQ's to pull via the connected Gmails).
- Apple completion: route: the same browser session with the
  saved Apple login (Secure Vault apple.com). Apple 2FA to a
  trusted device is the known possible wall; if it stands, the
  blocker is named to HQ in one sentence: no test Apple ID exists
  (owed since the build-7 era; HQ's device-lane programme owns
  creating one) — the desk does not invent one.
- Owner-side delete read: route: Firebase console in a browser
  task on her Owner session (placenciailse@gmail.com owns
  fit-app-7f25f). Codes by email are HQ-pullable per this
  commission; a device-prompt wall is the named blocker.
- Real-phone legs (packaged door pass, phone kill-and-reopen,
  native firing observed on a phone): the fleet's device lane is
  HQ's rebuild programme. Everything provable off-phone is proven
  off-phone; the phone-only residue is named in the final, per
  the Reality Law — never passed silently.
- Lanes: desk probes (stub-auth DOM/journey walks, this VM) ·
  QA/Test chairs (real-network Firebase walks, real accounts) ·
  gates (Quality · Efficiency · QA · Reality) · SU conveyor.

## WAVES 2/3 — THE READINESS JUDGEMENT (written, as ordered)
Wave 2 = gym depth (last-time strip, PR moment, history search,
two rest timers, muscle heat-map) · the promised-but-unbuilt Pro
surfaces (progress charts, personal records, full plan library) ·
peptides depth (vial run-out, site map, reconstitution maths on
the user's own numbers, pause-with-return, side-effect note) ·
photo side-by-side + timelapse. Wave 3 = one accountability
partner · widget · Apple Health / Health Connect.

JUDGEMENT: NOT required for "fully ready for customers", and NOT
built in this loop. Reasons, checked 2 Nov:
- Nothing the app SHIPS promises them. The Plans tier bodies were
  re-read today: Free = logging + timer + library + 3 routines +
  export; Pro = Free + unlimited routines; Forever = Pro for
  good. All true in build 17. The money-trust free list's 10
  items were each verified present at build 17's gates. Charts /
  records / plan library live only in the desk's internal feature
  split — an internal note is not a customer promise.
- The app is complete and honest without them: every area works,
  every promise on every screen is kept by build 17's bytes.
- They are improvements and new selling surface; bolting them on
  inside a readiness loop would move the target mid-loop and
  delay the owed proofs. They stay future builds under their own
  commissions.
- THE EXCEPTION THAT BINDS THIS LOOP: if any test step finds a
  shipped surface (copy, button, lock, empty state) promising
  something unbuilt, that is a defect IN this loop — fixed by
  telling the truth in copy or by building the thing, desk's
  judgement per case, named in the round report.
- Wave 3's Health sync + widget are native work; the partner is a
  new sharing surface with its own isolation burden. None gates
  a single-user customer launch.

## THE GUIDE SPEC (research first — done 2 Nov; build Round 2)
Research spine (read live 2 Nov): NN/g usability findings —
front-loaded modal carousels and multi-step tooltip tours are
swiped through unread (working memory holds no abstract steps);
guidance works just-in-time, attached to the user's intent, ONE
callout at a time, never stacked; empty states are the most-
neglected help surface — make them action catalysts; progressive
onboarding dismisses permanently and replays on demand. Strava's
pattern (via the Fitnit onboarding board): a Getting Started
checklist pinned to Home with coach marks after entry —
"onboarding does not end at the paywall; it moves into the app".
Duolingo: the mascot asks, reacts, celebrates, and carries the
empty/error moments — personality feedback beats system text;
Fit's door is account-first by her law, so Wally guides AFTER
entry (Duolingo's pre-signup inversion does not apply). Adapty's
onboarding corpus: mini-checklist + guided first task lift early
activation; direct handoff to the primary action; highlight the
feature the user's own setup answers point to.
BUILD SHAPE (existing machinery only — Wally float + bubble +
the tour engine; existing art only, never redrawn):
1. Entry tour stays, slimmed: welcome + name + one line on the
   four areas. No geography lecture.
2. Getting Started checklist card on Today (Wally-headed): rows
   drawn from the user's setup needs (first check-in · plan
   today's meals · first routine or session · set a water goal —
   only rows for areas the user kept); each row deep-links to
   the exact screen; ticking reads real state; dismiss = forever;
   complete = a Wally celebration line, then gone.
3. First-visit coach marks: one Wally bubble per area at the
   point of use, one sentence + the one action that matters;
   per-area seen-flag in settings; never stacked; Settings gains
   "Show the guide again" (extends today's tour replay) resetting
   tour + marks + checklist.
4. Empty-state teaching pass: every empty view shows Wally + one
   line + the creating button (audit list from Round 1 testing).
5. Notification ask joins the guide: Wally asks at the first
   reminder moment (J1), so "asked" is part of being shown around.
Words EN only while the Spanish hold stands, no dashes, brand
voice. Suite pins for every rule
above (fires once · dismissal sticks · ticks from real state ·
replay resets · nothing user-entered is ever wiped by the guide).

## ROUNDS
- ROUND 1: walk the whole script (A–L) on build 17's bytes;
  close or honestly re-name every owed leg (A5, A6, J3, L3 first).
  Fix defects → four checks on the fixed bytes → commit with
  read-back → TestFlight via SU (build 18 if any byte changed) →
  packaged-bytes re-verification → re-walk the failed steps.
- ROUND 2: build the guide (spec above) → suite + probes → the
  M-script walked as a customer → four checks → commit →
  TestFlight → packaged re-verification.
- ROUND 3: the FULL script again on the shipping bytes, fresh
  accounts, no step skipped; closure report to HQ naming every
  proof and every honestly-carried limit (phone-only residue
  included). Loop repeats if anything is not proven.

## NAMED UP FRONT (so nothing surprises later)
- Payments: ASC products stay unsubmitted and Pro stays "not on
  sale in the store yet" — her money steps are hers; the D3
  receiver (RC/Stripe → _comp) is desk-owned, unbuilt, and OUT
  of this loop by HQ's sequencing; no copy may imply otherwise.
- The consent-name cure (door sheet title "Fit Hard") rides its
  parked sitting; if the Google walk shows the project-number
  title, the fact is reported, the cure stays parked.
- Peptide fence: records only, never a recommendation — a census
  leg of this loop (F2), not a feature decision.
