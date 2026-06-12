#!/usr/bin/env bash
# HMG CLASS DECK — pre-deploy validation (run: bash scripts/validate.sh)
set -e
cd "$(dirname "$0")/.."
echo "== JS syntax =="
for f in js/*.js sw.js; do node --check "$f"; done
echo "== JSON =="
for f in manifest.webmanifest version.json revoked.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))"; done
echo "== Local asset references =="
grep -hoE '(src|href)="[^"#]+"' *.html | sed -E 's/^(src|href)="//; s/"$//' \
 | grep -vE '^(https?:|mailto:|#)' | sort -u | while read f; do
  fn="${f%%\?*}"; [ -e "$fn" ] || { echo "MISSING: $fn"; exit 1; }
done
echo "ALL CHECKS PASSED ✔"
