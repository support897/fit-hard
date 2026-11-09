# Build 29 notes

Code changes are in ios-native. Nothing here was compiled or run on this machine (no Xcode). CI is the first compile and test run.

## Done in code
1. Apple and Google doors: Sign in with Apple (AuthenticationServices, nonce) and GoogleSignIn (SPM), both finish at Firebase signInWithIdp. Sign in never creates an account. Stub text removed. Entitlements file and Info plist added in ios-native/Config.
2. Bad day: a Bad check-in swaps uneaten meals for lighter, quicker ones (about 12 percent fewer kcal, protein kept), makes today's workout three exercises and two sets, and restores everything if the answer is changed. Doses untouched.
3. Animations follow the character pick. Leg Press now has frames for boy, girl and non-binary.
4. Zilla Slab (display) and Karla (body) are bundled as ttf and registered at launch.
5. Icon law: all emoji removed; every icon is drawn in Brand.swift (BrandIcon).
7. Training types (Cardio, Legs, Upper body, Full body, Push, Pull, Core, Mobility, Rest) with icon and label on Train, Today and Calendar. Two colour families, one table (Color.toneTable). Legend names both. RESEARCH.md written.
8. Spanish (es.lproj plus a language setting), cook mode, log lightly, why this meal, machine photo save.
10. Existing users see the personalisation setup again on first open; data is kept.

## Not done, or only partly done
- Girl frames exist for Leg Press only. The other 24 exercises that have boy and non-binary sets, and the other ~250 exercises, have no per-character frames yet. They keep the generic set behind the preview switch.
- Spanish covers fixed screen text. Recipes, exercise help, machine names and text built from values stay English.
- Item 9 retest legs (17 to 20) need a device. Not run.
