#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/java}"

PORT="${PORT:-10000}"
CANTON_JSON_PORT="${CANTON_JSON_PORT:-7575}"
DAR_PATH="${DAR_PATH:-contracts/.daml/dist/collateralops-0.1.0.dar}"

CANTON_HOME="${CANTON_HOME:-/app/canton}"
CANTON_CMD="${CANTON_HOME}/bin/canton"

if [ ! -x "$CANTON_CMD" ]; then
  echo "canton binary not found at ${CANTON_CMD}" >&2
  exit 1
fi

node render/canton-proxy.mjs &
proxy_pid="$!"

cleanup() {
  kill "$proxy_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Proxy on 0.0.0.0:${PORT}; Canton sandbox on 127.0.0.1:${CANTON_JSON_PORT}"
exec "$CANTON_CMD" sandbox \
  --json-api-port "$CANTON_JSON_PORT" \
  --dar "$DAR_PATH"
