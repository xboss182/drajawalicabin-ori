# WAHA deployment for drajawalicabin (MNC-962)

Self-hosted WhatsApp HTTP API (WAHA) running on the local VPS `77.90.27.247`.
The booking bridge (MNC-961, pending Backend Developer artifact) will call this
API over loopback; browsers never reach it.

## Topology

```
Customer WA  ⇄  WhatsApp servers  ⇄  WAHA container (127.0.0.1:3100)
                                            ↑ X-Api-Key
                                       booking bridge (loopback only)
                                            ↓ HTTPS + HMAC
                                     Lovable Cloud Edge Functions
```

- No public port. WAHA binds to `127.0.0.1:3100` only. External port scans
  return `connection refused`.
- No Caddy entry. We deliberately do not terminate public TLS for WAHA. QR
  pairing requires an SSH tunnel (see below).
- Session state lives in Docker volume `waha-sessions`. Loss = re-pair.

## Files

| Path | Purpose |
|---|---|
| `/opt/waha/docker-compose.yml` | pinned image (`devlikeapro/waha@sha256:269a1ab2…`, tag `noweb`, 2026-08-14) |
| `/opt/waha/.env` | `WAHA_API_KEY` (mode 600, never committed) |
| `/opt/waha/backup.sh` | nightly cron: sessions + media tarball |
| `/opt/waha/restore.sh` | interactive restore, wipes volumes |
| `/opt/waha/healthcheck.sh` | exit 0/2/3 = ok / waha down / QR-required |

Copies of the executable scripts (not `.env`) live in this directory for review.

## Operations

### Start / stop / status

```bash
docker compose -f /opt/waha/docker-compose.yml up -d
docker compose -f /opt/waha/docker-compose.yml stop
docker inspect waha --format '{{.State.Health.Status}}'
/opt/waha/healthcheck.sh
```

### QR pairing (after owner supplies the dedicated number)

```bash
# on your workstation
ssh -L 3100:127.0.0.1:3100 root@77.90.27.247

# fetch QR (needs the API key from /opt/waha/.env)
KEY=$(grep ^WAHA_API_KEY /opt/waha/.env | cut -d= -f2)
curl -H "X-Api-Key: $KEY" \
  http://127.0.0.1:3100/api/sessions/default/auth/qr --output qr.png

# scan qr.png from the business WhatsApp: Settings → Linked devices → Link a device
# session transitions SCAN_QR_CODE → WORKING
```

`/opt/waha/healthcheck.sh` then exits 0.

### Re-auth (session dropped)

```bash
KEY=$(grep ^WAHA_API_KEY /opt/waha/.env | cut -d= -f2)
curl -X POST -H "X-Api-Key: $KEY" \
  http://127.0.0.1:3100/api/sessions/default/restart
# state returns to SCAN_QR_CODE; re-scan as above
```

### Backup / restore

```bash
/opt/waha/backup.sh                                       # manual run
crontab -l | grep waha                                    # nightly 03:00 UTC
/opt/waha/restore.sh /opt/waha/backups/<timestamp>        # interactive
```

30 days of snapshots in `/opt/waha/backups/`. Offsite replication is **not**
configured — operator responsibility (rclone / rsync / object storage).

### Upgrade / rollback

```bash
# upgrade: pin new digest in docker-compose.yml, then
docker compose -f /opt/waha/docker-compose.yml pull
docker compose -f /opt/waha/docker-compose.yml up -d

# rollback: restore previous digest and `up -d`. If session broke, restore
# the pre-upgrade backup: /opt/waha/restore.sh /opt/waha/backups/<ts>
```

## Known limitations (WAHA, cannot be eliminated)

- **Unofficial client.** Meta can suspend or ban the linked number at any
  time, without warning or appeal SLA. Mitigation: keep a warmed-up fallback
  number on a second session, rate-limit outbound, treat a ban as expected.
- **No interactive messages on NOWEB.** WhatsApp strips buttons/lists from
  unofficial clients. The bridge must use numbered-text replies as the
  guaranteed interface.
- **Single session per number.** One WAHA container; no HA. RTO = 5–15 min
  re-auth.
- **Session instability.** Multi-device sessions drop under memory pressure
  or after WA protocol changes. Mitigation: 1 GB RAM limit, restart policy,
  healthcheck alerting.
- **No Meta SLA.** Internal SLO only.

## Remaining integration dependency

The booking-bridge process (MNC-961) is **not deployed** — Backend Developer
artifact is not yet pushed. Once it lands:

1. Add bridge service to this compose file (loopback-only port, e.g. `3101`).
2. Point bridge at `http://waha:3000` (same docker network) with the API key
   from `/opt/waha/.env`.
3. Extend `healthcheck.sh` to probe bridge `/healthz` and return exit 1 on
   bridge failure (distinguishing bridge-down from WAHA-down).

No second conversation engine is introduced here; the bridge owns the state
machine.
