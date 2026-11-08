CONSOLIDATED FIX PROMPT — Fit Hard. One run. Finish the app.

BASE: your current working tree already holds the three visible-bug fixes you made in code during the master run. FIRST STEP: commit that tree as-is to support897/fit-hard, so those fixes are the base of this build. Do not rewrite or redo them — ship them.

GOVERNING SPECS: the master build V2 HTML, and the personalization spec at fit-hard-personalization-spec-2026-11-08.html (in VMShare and Apps beside you — read it whole before building). Where the two clash, the personalization spec wins; it is the owner's latest word. Where they agree, the spec deepens the same phases.

Then, in this order:

1. THE DOOR — first, before everything. Sign-up is the FIRST screen: Google, Apple, or email with the user's own chosen password. No name question, no setup step, no app content before the door. The account is mandatory — the app does not work with no account. Two door faults to cure: a failed sign-in must NEVER quietly create an account (a failed sign-in shows an error and stays a sign-in), and signing out must bring the door back. Sign-up asks the user's name at account creation. The setup comes AFTER sign-up: the spec's ten screens (goals, body, experience, training days, body parts, equipment, nutrition, kitchen inventory, safety, generate my plan).

2. ONE SHARED PROFILE: everything reads the one Personal Fitness Profile from the spec (Section 2) — the setup fills it once, every engine below reads it, and editing it anywhere updates the whole app.

3. MEALS ENGINE (spec Section 4): meals generated from the user's goals and meal type; calories and protein shown; ingredients split have-vs-buy WITH quantities; shopping list built from the buy side; meals live in the side menu with full recipes; swapping ONE meal updates the shopping list AND the calendar; the lunch card shows calories, protein and cook time.

4. ROUTINES + PROGRESSION (spec Sections 5, 6, 8): routines generated from the profile — splits follow the days the user chose, built in 4-week blocks, double progression so routines grow as the user improves; the library's routine cards show name, calories and muscles worked.

5. TRAINING MODE (spec Section 7): Start begins the session — timers, breaks, set tracking — and the user chooses guided (exercise demonstrations) or timer-only.

6. CALENDAR (spec): colour-organized, a + button adds items, and a training day shows that day's lunch card (calories, protein, cook time).

7. THE LOOK: match the master build V2 HTML — the warm Burrow design. The current build's look is not it. Where the personalization spec's own design points differ, the spec wins.

8. DAILY FEELING: the choices read exactly Bad · Ok · Great, in that order — cure the words-only "Bad" day fault.

9. WALLY: Wally guides from the user's REAL data — recommendations follow their goals and progress (the spec's mascot rules). Wally is currently two onboarding pictures; build the guide through the app, not only at the door.

10. DOSES (spec Section 10 — TRACKER SHAPE): a private tracker for what the user's own clinician prescribed — user-entered name and dose, reminders fire from it. NO preset doses, NO catalogue, nothing suggested. Preset doses are an open question with the owner and are NOT built in this run.

11. NOTIFICATIONS: per the spec — reminders fire from the profile, the plan and the tracker, at the times the user picked.

12. TESTS: beyond smoke level — run the spec's per-phase end-to-end journeys and report exact results before shipping.

13. SHIP: one new build, version bumped, to TestFlight only — never App Review. The three in-code fixes ride inside it. Report file by file what changed, the test results, and the build number uploaded.

Hygiene, from the gate reads: keep the archive command line clean of signing overrides — the profile specifier lives in the App target or nowhere.

14. MACHINE ANIMATIONS AND HELP: every exercise animation must show the character really using the machine — correct form, no overlaps, no glitches. Every exercise carries a "?" button: tapping it, Wally explains that machine in very simple short steps, plain words, little text — and NO dash characters anywhere in that help text. (Folds into items 5 and 9.)

15. YOUR CHARACTER: at account setup the user picks how their character looks — Boy, Girl, or Non-binary. The choice is saved in the profile, shown as their icon through the app, and the exercise animations use the character matching that choice. (Folds into items 1 and 2.)
