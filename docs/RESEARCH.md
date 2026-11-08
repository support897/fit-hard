# Market and psychology research -> product decisions

Sources (read 7 Nov 2026): Unstar.app "Health & Fitness App Reviews: What Users Want (2026)"; Enterpret "State of Fitness Apps Feedback" (7,768 Google Play reviews, Mar-Jun 2026); AppReviewLens "Market gaps in fitness apps"; Lifecycle Architect "Onboarding optimization for fitness apps"; UX strategies article (salivity.github.io); Propel "Push notification strategy 2026"; churntools push playbook; Sahha "Do health app push notifications work" (cites micro-randomised trials); Customer.io push psychology; Ogamic "How often should fitness apps message you"; Citehawk/Zapier app roundups (Strong, Hevy, Fitbod, Strava, MyFitnessPal, Nike Training Club).
Caveat: several are vendor blogs; numbers are directional, not guarantees.

## What people say they want (and hate)
| Finding | Source | Fit Hard today | Decision |
|---|---|---|---|
| Accuracy of tracking is #1 complaint (28% of negative reviews) | Unstar, Enterpret | Calories are labelled as estimates; no scanned data | Keep honest "estimate" wording; no invented precision |
| Pricing and paywalls (24-31% of negative reviews); paying and not getting the feature is worst | Unstar, AppReviewLens, Enterpret | Core is free | Keep core free, no dark patterns |
| Ads and interruptions mid-session | Unstar | None | Keep zero ads; never interrupt a session |
| Feature bloat and many taps (water should be 1 tap) | Unstar | Today is one calm page | Audit tap counts on core actions (see test plan J-taps) |
| Redesign backlash: changing what users know | Enterpret | n/a | Do not rearrange nav after launch |
| Offline-first; lost logs when sync fails | AppReviewLens | Local-first | Test offline journeys explicitly |
| Equipment-aware workouts | AppReviewLens, Fitbod, Hevy | Equipment filter exists | Keep; make it a setup question |
| Realistic progress: automatic PRs, no heavy logging | AppReviewLens | PRs auto-detected | Done in phase 5 |
| Minimal loggers win (Strong, Hevy): open, log set, close | Citehawk, Zapier | Session logging | Measure taps to log a set |
| Sync duplicates or silent failures | Unstar | Cloud sync | Multi-device and multi-user tests |
| Onboarding: 2-3 optional screens, value first, skip on every step, first workout within a day | Unstar, Lifecycle Architect | Setup wizard | Test it as a new user; add visible Skip and defaults |

## Psychology principles applied
- Hick's law / fewer choices: one recommended next step, defaults pre-selected, advanced options hidden.
- Default effect: sensible defaults for every setting (reminders off until asked, generic lock-screen text, quiet hours on).
- Progressive profiling and time to first value: ask only what is needed to show a plan; ask the rest after the first win.
- Autonomy and trust: every setting reversible, category controls, honest explanations.
- Loss-aversion without shame: streaks never wipe progress; rest counts; no guilt copy (spec rule).
- Peak-end and small wins: celebrate completions quietly, opt-out available.
- Cognitive load: plain words, one primary button per card, no jargon.

## Notifications (evidence)
- iOS opt-in ~44-51%; asking after first value with a specific promise roughly doubles it (Propel, churntools). Do not ask on first screen; ask once; if declined, explain how to enable later.
- Over ~6 pushes/week -> 3.4x uninstall risk; 2-5/week sweet spot; categories + quiet hours + easy off (Propel, churntools, Ogamic).
- Behaviour-triggered beats generic (14.4% vs 4.2% open); but a daily reminder alone did not improve retention in a trial (Sahha). So: user-chosen times, no marketing pushes, no "come back" nags.
- Health adherence (dose, appointment) is transactional and uncapped but kept generic on the lock screen (Propel; already done).
- Quiet hours 9pm-9am default for non-time-critical reminders; the user's own set time always wins.
Decisions: per-category switches (workouts, meals/water, tasks, health), a daily cap on app-generated reminders, quiet hours setting, a single plain "Reminders" home, and a pre-permission explainer after the first completed action.
