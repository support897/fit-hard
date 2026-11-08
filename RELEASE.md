# Fit Hard: release notes and runbook

## Install and run (web / dev)
- App is static: serve `app/` over HTTPS (any static host) or `python3 -m http.server -d . 8000` and open `/app/index.html`.
- Accounts use the Firebase project in `app/accounts-config.js` (public web identifiers by design; security is `app/firestore.rules`).

## Tests
- Unit + browser: `./tests/run_all.sh` (Node 18+, Python 3 + Playwright Chromium; see `tests/README-TESTING.md`). `tests/e2e/final_sweep.py` covers every screen x 2 themes x 320/390/1024 px.
- Rules: `./tests/rules/run.sh` (Java 11+, `npm install` in `tests/rules`). Runs a two-user Firestore emulator battery against `app/firestore.rules`.

## Build and deploy (iOS)
1. Web: publish `app/` (and the hosted `privacy.html`, updated 7 Nov 2026 for photos, measurements, reminders, health records). Bump `CACHE` in `app/service-worker.js` on every change (now `fitapp-v103`).
2. iOS: GitHub Actions `ios-ipa.yml` (artifact) / `ios-ipa-upload.yml` (TestFlight). They stage `app/` into `store-build/www`, `cap sync ios`, sign and export. Needs repo secrets: BUILD_CERTIFICATE_BASE64, P12_PASSWORD, PROVISIONING_PROFILE_BASE64, ASC_API_KEY_ID, ASC_API_ISSUER_ID, ASC_API_KEY_P8_B64. **Raise the marketing version / build number before each upload** (workflow text still names 1.1 build 3).
3. Firestore: deploy `app/firestore.rules` with `firebase deploy --only firestore:rules`. `app/firestore-twohat.rules` is a variant: confirm which one is live before deploying.

## Migration and rollback
- All state changes are additive. `repairState` fills defaults for new fields (appointments, instructions, audit, status, body, restDays, reflections, progressPrefs, planServings, eaten, groceryChecked, mealPrefs); old data loads unchanged; legacy dose logs count as "taken".
- Rollback: `git checkout baseline-v96` (or any `phaseN-done` tag) and redeploy with a higher cache name. Older builds ignore unknown fields. Backup of the original: `BACKUP_fit-hard-main_baseline.zip`.

## Recommended hardening (not applied)
Add a Content-Security-Policy response header at the host, tested against real Google/Apple sign-in first, because a wrong policy breaks sign-in. A meta tag was deliberately not added.

## Device matrix
| Target | Status |
|---|---|
| Chromium headless 320, 360, 390, 1024 px, brand + black themes | Tested (automated) |
| Safari / iOS WKWebView / real iPhone | NOT tested here |
| Native local notifications | Tested with a mock plugin only |
| Google / Apple sign-in, live Firebase | NOT verifiable here |

## Known issues and items for the release owner
- Optional "Hard challenge strict restart" (user opt-in) restarts a streak after a missed day (days stay on record). Review against the no-coercive-streak rule.
- No ingredient price data exists, so the budget filter is a "short shopping list (8 ingredients or fewer)" filter.
- Spanish is held back (`SPANISH_LIVE=false`); much new copy has English fallbacks only.
- App Store privacy labels must match the manifest (email, user id, name, health and fitness, user content). Photos stay on device.
