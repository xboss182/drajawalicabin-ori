#!/usr/bin/env bash
# WAHA session + media volume restore.
# Usage: /opt/waha/restore.sh /opt/waha/backups/<timestamp>
# Destructive: replaces the current waha-sessions and waha-media volumes.
set -euo pipefail

SRC="${1:?usage: restore.sh /opt/waha/backups/<timestamp>}"
[[ -f "$SRC/sessions.tar.gz" && -f "$SRC/media.tar.gz" ]] || { echo "missing tarballs in $SRC"; exit 1; }

echo "=== DANGER: about to overwrite waha-sessions and waha-media ==="
echo "source: $SRC"
cat "$SRC/manifest" 2>/dev/null || true
read -r -p "type 'yes' to continue: " ack
[[ "$ack" == "yes" ]] || { echo "aborted"; exit 1; }

echo "stopping waha"
docker compose -f /opt/waha/docker-compose.yml stop waha

echo "wiping volumes"
docker volume rm waha-sessions waha-media || true
docker volume create waha-sessions >/dev/null
docker volume create waha-media >/dev/null

echo "restoring from $SRC"
docker run --rm \
  -v waha-sessions:/data/sessions \
  -v waha-media:/data/media \
  -v "$SRC":/in:ro \
  alpine:3 \
  sh -c "tar xzf /in/sessions.tar.gz -C /data/sessions && tar xzf /in/media.tar.gz -C /data/media"

echo "starting waha"
docker compose -f /opt/waha/docker-compose.yml up -d waha

echo "waiting for healthy"
for i in {1..30}; do
  s=$(docker inspect waha --format '{{.State.Health.Status}}' 2>/dev/null || echo unknown)
  [[ "$s" == "healthy" ]] && { echo "healthy after ${i}0s"; break; }
  sleep 10
done

echo "session state:"
KEY=$(grep ^WAHA_API_KEY /opt/waha/.env | cut -d= -f2)
curl -s -H "X-Api-Key: $KEY" http://127.0.0.1:3100/api/sessions
echo

cat <<'NEXT'
If status is SCAN_QR_CODE, the snapshot was too old or the session was logged
out — re-pair via SSH tunnel:
  ssh -L 3100:127.0.0.1:3100 root@77.90.27.247
  # then in a browser: http://127.0.0.1:3100/api/sessions/default/auth/qr
  # supply header X-Api-Key via a browser extension, or use curl:
  curl -H "X-Api-Key: $WAHA_API_KEY" http://127.0.0.1:3100/api/sessions/default/auth/qr --output qr.png
NEXT
