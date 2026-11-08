# Fit Hard: QA and improvement report (7 Nov 2026)

## 1. What changed my answer
My earlier "done" rested on component tests with a fake sign-in and one user. I then built a real-auth, multi-user harness (separate "phones", Firebase Auth + Firestore emulators) and ran journeys against it.

## 2. Defects found by real-user testing (all fixed, with regression tests)
1. **Critical, Firestore rules:** every new account was refused its second save (null `profile` at sign-up crashed `anchorKept`). Fixed in `app/firestore.rules`. **You must redeploy:** `firebase deploy --only firestore:rules`. Accounts already stuck stay stuck until you do.
2. Sign-out left the user's data on the phone. It now syncs first, then wipes; if sync fails it keeps the copy and says so.
3. Sign out / Delete buttons stayed faded after sign-in on a second device.
4. Account box hid under the header.
5. Setup was one 16-field form; now 3 short steps, all skippable.
6. A failed cloud read could let an empty state overwrite real data. Writes are now blocked until a successful read, with retries.
7. Reminders had no category control. Added switches: workouts, water, tasks, health.

## 3. Research to feature (see docs/RESEARCH.md)
- Fewer taps: one-tap "+ Glass of water" on Today (undo on Food tab).
- Calm first run: challenge card hidden until there is activity.
- Short onboarding: 3 optional steps.
- Reminders: user-chosen times only, category switches, generic lock-screen text by default, health details never on the lock screen.

## 4. Test results
Unit 76, phases 1-6 e2e (35/47/48/42/63/51+2), regression 19, accessibility 0 serious, sweep 150/150, rules 12/12, real multi-user journeys 24/24. Tag `phase8-qa-done`.

## 5. Incident disclosure
One test run bypassed my test routing via the service worker and signed `dev@example.com` into the real Firebase project. I deleted that account through the app's own delete flow and added safeguards (service workers blocked, emulator-only assertion).

## 9. Shipped (7 Nov 2026)
- GitHub: `support897/fit-hard` main updated (app, tests, docs, RELEASE.md, privacy.html); app.js, auth.js, firestore.rules, service-worker.js and the iOS project verified byte-identical to local.
- TestFlight: iOS build **1.1 (22)** built by GitHub Actions run #8, uploaded to Apple, processed, and added to the "Device Route QA" internal group (tester: placenciailse@gmail.com). Not submitted for App Review.

## 10. NOT complete
- **Firestore rules are NOT deployed.** The fix is in the repo; run `firebase deploy --only firestore:rules` (needs your Firebase login). Until then production still has the null-profile bug.
- Not submitted to App Review or the App Store.
- I have not run build 22 on a real iPhone; install it from TestFlight and test sign-up, sign-out, reminders.
- Not yet automated on real auth: offline sync, health on real auth, keyboard-only and 200% text, tap-count test, tests for the setup stepper, reminder switches and load-failure gating.
- GitHub commits were made through the web uploader (one commit per folder), not as the original local commit history; local tags are not on GitHub.

---

# Addendum: Native SwiftUI app (v2.0, builds 24 and 25)

**Shipped:** build 2.0 (25) is in TestFlight group "Device Route QA" (Ready to Test). Build 24 was the first native cut and is already installed on the tester's iPhone 15.

**Ported from the web app to native Swift (verified by CI compile only):**
Onboarding that asks goals, food preferences, allergies, peptide/dose entries and training, then generates recipes (1,089), meal plan, routine and reminders; Today; Food (plan, recipes, Fridge, Treats); Train (routines editor, 871 exercises, 36 machines); Health log (taken / not taken / unsure, generic lock-screen text by default); Progress (overview, strength, body, weekly review); Calendar with habits and to-dos; Challenge; Account sign-in and backup to its own cloud slice `native_v2`.

**What is NOT complete (item 10, honest list):**
- The native app has never been run by me on a device or simulator. Only the GitHub macOS compile passed (runs #5, #6, #7, plus the shipped run #8). There are no native automated tests.
- Not ported: progress photos, barcode scan, voice input for treats, calendar import, owner page, EN/ES language switch, tour and coach marks (replaced by the onboarding), in-app tier/demo unlock.
- Fridge and machine "photo" features are manual search and confirm only (matches the spec: no claimed recognition).
- Native `native_v2` cloud data does not sync with the web app's data.
- The fixed `firestore.rules` is in the repo but NOT deployed (needs `firebase deploy --only firestore:rules`).
- The GitHub repo is PUBLIC.
- Passwords were shared in chat; please change the Apple and GitHub passwords.
- Nothing has been submitted for App Review.

---

# Addendum 2: Native build 2.0 (27), tested on a simulator in CI

**What was added:** rest timer (30/60/90 s) in workouts; workout autosave (survives closing the app, logged once on Finish); calendar task actions (Done, Tomorrow); animations stop when Reduce Motion is on; reminder logic split into a testable planner.

**Real tests now run on every push (GitHub macOS simulator, iPhone):**
- 15 unit tests: data counts (1,089 recipes, 871 exercises, 36 machines), every allergen excluded from candidates, plans and swaps, vegetarian never gets meat, 7-day plan, restart restores profile, old/empty saved data still loads, water never negative, workout draft survives restart and logs once, health reminders generic on lock screen by default, appointment reminders (day before and hour before only), editing a reminder never duplicates, nothing scheduled before onboarding or when off, task reminders only for future undone tasks, calendar task move, training only on chosen days.
- 4 UI tests on the simulator: five tabs present and Calendar reachable (Month, Habits, To do), every tab opens, theme can be switched White/Black/Brown, full onboarding builds the app.
- First runs failed and were fixed: wrong test host path; a test that matched "milk" inside "buttermilk" (test bug, not an app bug); theme buttons needed accessibility ids.
- Final CI run #21 (commit 84a63e6) passed compile, unit and UI tests; ship run #22 uploaded build 27 to TestFlight only. Nothing has been sent to App Review.

**Still NOT verified or complete:**
- No one has used build 27 on a real iPhone. Notifications actually firing on a device, the camera/photo-less flows, and visual contrast of the three themes were not tested by a person.
- Not tested: timezone/DST changes, multi-account security (native app uses the same owner-only Firestore path but rules are not deployed), offline sync conflicts, VoiceOver walkthrough.
- Not ported: progress photos, barcode scan, voice input, ICS calendar import, owner page, EN/ES switch, drag-to-reschedule, overlap detection, snooze.
- Native data does not sync with the web app. Firestore rules not deployed. Repo is public. Passwords were shared in chat; change them.

---

# Addendum 3: End-to-end test of build 27 with screenshots (no new build)

Method: simulator run on GitHub macOS (iPhone), seeded profile, screenshots of Today, Food, Train, Calendar and More in White, Black and Brown, plus real taps (add a task, add a habit). Images: `test-screens/`.

Found in build 27 (both missed by the earlier green tests):
1. After switching theme, some cards kept the old colours (Black: "How are you feeling?", "Food today", "Workout" titles nearly invisible; white "Rest day" and "Sign in" cards on dark). Cause: screens were not redrawn on theme change.
2. Calendar weekday header was wrong (duplicate letters dropped Thursday and the last Sunday).
3. To do list showed a raw date (2026-11-08).

Fixed in source (not shipped): screens now rebuild on theme change and you stay on the same tab; header shows M T W T F S S aligned with the dates; dates read "Sun, Nov 8". Re-run (CI run #27) is green: 16 unit tests including a contrast check of every text/background pair in all three themes, and 6 simulator UI tests. After-fix screenshots confirm the fixes in Black and the Calendar.

Still unverified: real iPhone behaviour, notifications firing, VoiceOver, timezone/DST, offline, other-account access, and the features listed as not built. Build 27 in TestFlight still has bugs 1 to 3. Nothing newer has been uploaded.
