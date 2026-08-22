#!/usr/bin/env bash
# WAHA session + media volume backup.
# Nightly cron: 0 3 * * * /opt/waha/backup.sh >> /var/log/waha/backup.log 2>&1
# Keeps 30 daily snapshots in /opt/waha/backups/.
# Offsite copy is the operator's job (rclone, rsync, etc.) — not configured here.
set -euo pipefail

BACKUP_DIR=/opt/waha/backups
TS=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$BACKUP_DIR/$TS"
mkdir -p "$DEST"

echo "[$(date -Is)] backup start $TS"

# Snapshot volumes read-only via a sidecar; no need to stop WAHA — session files
# are sqlite and tolerate a live read well enough for disaster-recovery purposes.
# For a stronger guarantee, pair this with a pre-backup `docker pause waha` and a
# post-backup `docker unpause waha` (skipping here to avoid downtime; ponytail:
# pause/unpause if a restore ever fails because of a torn file).
docker run --rm \
  -v waha-sessions:/data/sessions:ro \
  -v waha-media:/data/media:ro \
  -v "$DEST":/out \
  alpine:3 \
  sh -c "tar czf /out/sessions.tar.gz -C /data/sessions . && tar czf /out/media.tar.gz -C /data/media ."

# Manifest for restore auditing
{
  echo "ts=$TS"
  echo "image=$(docker inspect waha --format '{{.Image}}')"
  echo "sessions_size=$(stat -c%s "$DEST/sessions.tar.gz")"
  echo "media_size=$(stat -c%s "$DEST/media.tar.gz")"
} > "$DEST/manifest"

# Retention: 30 days
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +

echo "[$(date -Is)] backup done $TS"
