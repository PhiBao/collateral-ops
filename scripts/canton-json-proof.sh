#!/usr/bin/env bash
set -euo pipefail

API_URL="${CANTON_JSON_API_URL:-http://localhost:7575}"
APP_URL="${APP_URL:-http://localhost:3000}"
DAR_PATH="${DAR_PATH:-contracts/.daml/dist/collateralops-0.1.0.dar}"
CLOSEOUT_ACTION="${CLOSEOUT_ACTION:-release}"

echo "CollateralOps Canton JSON API proof"
echo "API_URL=$API_URL"
echo "APP_URL=$APP_URL"
echo "DAR_PATH=$DAR_PATH"
echo "CLOSEOUT_ACTION=$CLOSEOUT_ACTION"
echo

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

echo "1. Health check"
curl -fsS "$API_URL/livez" >/dev/null
curl -fsS "$APP_URL/api/status"
echo
echo "ok"
echo

if [ ! -f "$DAR_PATH" ]; then
  echo "DAR not found. Run: cd contracts && dpm build" >&2
  exit 1
fi

echo "2. Drive Canton workflow through the app API"
for endpoint in bootstrap; do
  curl -fsS -X POST "$APP_URL/api/workflow/$endpoint" -H "Content-Type: application/json"
  echo
done

echo "2a. Investor-scoped collateral recommendation"
curl -fsS -X POST "$APP_URL/api/workflow/recommend" \
  -H "Content-Type: application/json" \
  -d '{"party":"investor"}'
echo

if [ "$CLOSEOUT_ACTION" != "release" ] && [ "$CLOSEOUT_ACTION" != "default" ]; then
  echo "CLOSEOUT_ACTION must be release or default" >&2
  exit 1
fi

for action in offer lock accept "$CLOSEOUT_ACTION"; do
  curl -fsS -X POST "$APP_URL/api/workflow/action" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"$action\"}"
  echo
done

echo
echo "3. Party-scoped snapshots"
for party in investor securedParty custodian auditor; do
  echo "--- $party ---"
  curl -fsS "$APP_URL/api/workflow/snapshot?party=$party"
  echo
done
