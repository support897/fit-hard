#!/usr/bin/env bash
# Runs the two-user Firestore rules battery against the local emulator (needs Java 11+ and `npm install` here).
set -e
cd "$(dirname "$0")"
cp ../../app/firestore.rules ./firestore.rules
npx firebase emulators:exec --only firestore --project demo-fit-hard "node --test rules.test.js"
