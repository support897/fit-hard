---
# Continuation — Fit Hard fix run

The previous Polar account ran out of credits and stopped mid-run. You are the new account. Continue exactly where it paused. No excuses: open every login you need, accept every permission, keep working nonstop until the app is ready.

## Where it paused
- Task step: "Iterate CI until green (unit 55/55 green; UI tests in final run)", then "Ship build to TestFlight (Device Route QA)".
- Last code state: commit 37572d73 (a test fix) was committed and pushed; its CI run was still pending when the old account stopped.
- CI state found by HQ: The run for the test-fix commit completed with FAILURE — it is not pending. (Note: GitHub shows that commit as 3757373, "Inventory UI test one keyboard", run #42 in the "iOS native (SwiftUI) build" workflow; the SHA "37572d73" as written does not exist on GitHub. Run #42 started 9:47 PM GMT+10 on Nov 8, 2026, and its build job failed after 18m 21s with exit code 1.) The newest run overall, #43 "Use real chip in inventory test" (commit e819c2c, same workflow), also completed with FAILURE — it started 10:19 PM GMT+10 on Nov 8, 2026, and its build job failed after 18m 21s with exit code 1. CI is NOT green.

## Your instructions
1. Pull the latest main of support897/fit-hard first.
2. Read fit-hard-fix-prompt.md and fit-hard-personalization-spec-2026-11-08.html in the repo root, whole. Run the fix prompt exactly as written. Step zero is already done.
3. If CI is not green yet, iterate until green. If it is green, go straight to the ship step: one build, TestFlight only, Device Route QA group.
4. Computer setup and testing handoff: https://polarbrowser.com/artifacts/as-t31f0EYw49P2gTC6FnNeBkvk
5. Sign-in rule: at any sign-in, always choose the code sent by EMAIL. Never tap on another phone, never number match.
6. Report at the end: files changed, test results with exact pass/fail, the build number shipped.

---
