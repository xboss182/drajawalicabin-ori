#!/usr/bin/env bash
# WAHA + bridge dependency-aware readiness probe. Run every minute from cron.
# Exit code is the alert state:
#   0  ok (WAHA WORKING and, if the bridge container exists, bridge /health ok)
#   1  bridge down or unreachable
#   2  WAHA container/API down
#   3  QR/session required (session not WORKING) or unknown state
#
# Dependency order: WAHA is checked first. If WAHA is down we exit 2 without
# probing the bridge, because a bridge failure is then indistinguishable from a
# WAHA failure. The bridge is only probed once WAHA itself is healthy, so a
# non-zero exit always names the actual failing dependency.
set -euo pipefail

ENV_FILE=/opt/waha/.env
KEY=$(grep ^WAHA_API_KEY "$ENV_FILE" | cut -d= -f2-)
URL=http://127.0.0.1:3100
BRIDGE_URL=http://127.0.0.1:8180

# --- WAHA: container alive? ---
if ! docker inspect waha --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
  echo "WAHA container unhealthy or missing"
  exit 2
fi

# --- WAHA: API responsive? ---
if ! curl -fsS -m 5 -H "X-Api-Key: $KEY" "$URL/api/server/version" >/dev/null; then
  echo "WAHA API not responding"
  exit 2
fi

# --- WAHA: session state ---
status=$(curl -fsS -m 5 -H "X-Api-Key: $KEY" "$URL/api/sessions/default" | grep -oP '"status":"[^"]+"' | cut -d'"' -f4 || echo "")
case "$status" in
  WORKING) ;;
  SCAN_QR_CODE|STARTING|STOPPED|FAILED)
    echo "WAHA session status=$status (pairing or restart required)"
    exit 3
    ;;
  *)
    echo "WAHA session status unknown: '$status'"
    exit 3
    ;;
esac

# --- Bridge: only reached once WAHA is WORKING. If the bridge container is not
# deployed yet (MNC-961 artifact pending), skip gracefully and report WAHA-ok.
if docker inspect wa-bridge >/dev/null 2>&1; then
  if ! docker inspect wa-bridge --format '{{.State.Status}}' 2>/dev/null | grep -q running; then
    echo "bridge container not running"
    exit 1
  fi
  if ! curl -fsS -m 5 "$BRIDGE_URL/health" >/dev/null; then
    echo "bridge /health not responding"
    exit 1
  fi
fi

exit 0
