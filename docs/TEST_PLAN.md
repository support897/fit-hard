# Real-user test plan

Method: real Firebase client (the app's own auth.js and Firestore code) against the Firebase Auth + Firestore emulators with the real `firestore.rules`; two or more separate browser contexts (separate devices); real clicks only, no state seeding, except where a persona needs time travel.

Personas
- Maya: first-time user, wants to lose weight, no gym, phone only.
- Dev: lifter with gym access, second account.
- Sam: health tracker user (clinician-provided schedule), reminders on.
- Lena: older / low-vision user: large text, reduced motion, keyboard only.

Journeys (J = journey)
- J1 First run, signed out: door shown, nothing leaks, sign-up validation (empty, bad email, short password, existing email), then create account.
- J2 Setup wizard as Maya: skip paths, defaults, reaches Today in under 90 seconds and under ~10 taps, with one clear next step.
- J3 Daily loop: log water, plan and eat a meal, start and finish a workout, add a task with reminder, check progress.
- J4 Sign out and back in on a NEW device: everything restored; wrong password message is kind.
- J5 Two users: Dev signs up in another context; neither sees the other's data, in UI or in cloud documents; same device account switch shows no leakage.
- J6 Offline: use app offline, reconnect, data syncs once, no duplicates.
- J7 Health user: confirm gate, add medication, log statuses, edit, appointments, generic notifications, export, erase.
- J8 Reminders: every reminder type, categories, quiet hours, permission denied path, change/delete updates reminder.
- J9 Settings: every setting reachable in <=3 taps, each visibly takes effect, each reversible; theme, text size, language, reduced motion.
- J10 Accessibility: keyboard-only path through J2/J3, screen-reader names, contrast, 320 px, 200% text.
- J11 Account deletion: cloud data gone, cannot sign in again, device wiped.
- J12 Tap budget: log water <=2 taps, log a set <=3 taps, mark a task done 1 tap, start next workout <=2 taps from Today.
Pass rule: no console errors, no dead buttons, every state (loading, empty, error, offline, success) visible, defects logged and fixed, suite re-run.
