#!/usr/bin/env bash
set -euo pipefail

export PATH="/root/.dpm/bin:/root/.daml/bin:${PATH}"

PORT="${PORT:-10000}"
CANTON_JSON_PORT="${CANTON_JSON_PORT:-7575}"
DAR_PATH="${DAR_PATH:-contracts/.daml/dist/collateralops-0.1.0.dar}"

if command -v dpm >/dev/null 2>&1; then
  DAML_CLI="dpm"
elif command -v daml >/dev/null 2>&1; then
  DAML_CLI="daml"
else
  echo "Neither dpm nor daml is available in PATH." >&2
  exit 1
fi

if [ ! -f "$DAR_PATH" ]; then
  echo "DAR not found at $DAR_PATH; building contracts."
  (cd contracts && "$DAML_CLI" build)
fi

node render/canton-proxy.mjs &
proxy_pid="$!"

cleanup() {
  kill "$proxy_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Proxy listening on 0.0.0.0:${PORT}; Canton JSON API starting on 127.0.0.1:${CANTON_JSON_PORT}."
exec "$DAML_CLI" sandbox --json-api-port "$CANTON_JSON_PORT" --dar "$DAR_PATH"
