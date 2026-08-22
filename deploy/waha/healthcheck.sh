#!/usr/bin/env bash
# WAHA + bridge readiness probe. Run every minute from cron.
# Exit code is the alert state: 0 ok, 1 bridge down, 2 waha down, 3 QR/session required.
# The bridge binary doesn't exist yet (MNC-961 pending); for now this only reports
# WAHA-side state. Once the bridge artifact lands, extend this to poll the bridge
# /healthz and distinguish codes 1 vs 2.
set -euo pipefail

ENV_FILE=/opt/waha/.env
KEY=$(grep ^WAHA_API_KEY "$ENV_FILE" | cut -d= -f2)
URL=http://127.0.0.1:3100

# Container alive?
if ! docker inspect waha --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
  echo "WAHA container unhealthy or missing"
  exit 2
fi

# API responsive?
if ! curl -fsS -m 5 -H "X-Api-Key: $KEY" "$URL/api/server/version" >/dev/null; then
  echo "WAHA API not responding"
  exit 2
fi

# Session state
status=$(curl -fsS -m 5 -H "X-Api-Key: $KEY" "$URL/api/sessions/default" | grep -oP '"status":"[^"]+"' | cut -d'"' -f4 || echo "")
case "$status" in
  WORKING) exit 0 ;;
  SCAN_QR_CODE|STARTING|STOPPED|FAILED)
    echo "WAHA session status=$status (pairing or restart required)"
    exit 3
    ;;
  *)
    echo "WAHA session status unknown: '$status'"
    exit 3
    ;;
esac
