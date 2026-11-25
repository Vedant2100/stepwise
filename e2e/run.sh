#!/usr/bin/env bash
# Runs every browser test against $BASE (default http://localhost:5179). Stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")"
for t in test_*.py; do
  echo "== $t"
  python3 "$t"
done
echo "All browser tests passed."
