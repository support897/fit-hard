#!/bin/bash
# Runs every automated test. Needs node 18+, python3 + playwright (see ../README-TESTING.md).
set -e; cd "$(dirname "$0")/.."
node --test tests/unit
cd tests/e2e
for t in test_*.py; do echo "== $t"; python3 $t; done
# Firestore rules battery (needs Java + npm install in tests/rules): ./tests/rules/run.sh
