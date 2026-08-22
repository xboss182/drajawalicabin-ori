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
| `/opt/waha/.env` | `WAHA_API_KEY`, `WAHA_WEBHOOK_HMAC_KEY` (mode 600, never committed) |
| `/opt/waha/.env.example` | env var names only — copy to `.env`, fill, chmod 600 |
| `/opt/waha/backup.sh` | nightly cron: sessions + media tarball |
| `/opt/waha/restore.sh` | interactive restore, wipes volumes |
| `/opt/waha/healthcheck.sh` | exit 0/1/2/3 = ok / bridge down / waha down / QR-required |
| `/opt/waha/bridge.Dockerfile` | build context for the bridge service (node:22-alpine, zero deps) |

Copies of the executable scripts (not the filled `.env`) live in this directory
for review.

## Secrets policy (post Stage-1 review)

- The `WAHA_API_KEY` was **rotated on 2026-08-22** after the Stage-1 review
  treated it as compromised. The old value is destroyed (no backup retained).
- No WAHA credential exists anywhere in Git. Compose/healthcheck read the key
  from `/opt/waha/.env` via `$$WAHA_API_KEY` / `grep` — never a literal.
- `.env` is mode `600 root:root` and listed in `.gitignore` (`.env*`).
- Webhook integrity: WAHA signs outbound webhooks with `WAHA_WEBHOOK_HMAC_KEY`;
  the bridge verifies the `x-webhook-hmac` header. Configure the WAHA session
  webhook with `hmac.key = WAHA_WEBHOOK_HMAC_KEY` (see below).

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

## Bridge integration & webhook HMAC

The compose file already defines the `bridge` service: it builds from the
repo's `wa-bridge/` tree (via `deploy/waha/bridge.Dockerfile`), joins
`waha-net`, binds loopback `8180`, and `depends_on` a healthy `waha`. Deploy it
once the Backend Developer's **corrected** `wa-bridge/` lands on this branch:

```bash
cd /opt/waha
docker compose up -d --build bridge
```

Then point the WAHA session webhook at the bridge with HMAC signing, so WAHA
signs each event and the bridge verifies `x-webhook-hmac`:

```bash
KEY=$(grep ^WAHA_API_KEY /opt/waha/.env | cut -d= -f2-)
HMAC=$(grep ^WAHA_WEBHOOK_HMAC_KEY /opt/waha/.env | cut -d= -f2-)
curl -X POST -H "X-Api-Key: $KEY" -H 'Content-Type: application/json' \
  http://127.0.0.1:3100/api/sessions/default \
  -d "$(cat <<EOF
{"name":"default","config":{"webhooks":[{"url":"http://wa-bridge:8080/webhook/waha","events":["message","session.status"],"hmac":{"key":"$HMAC"}}]}}
EOF
)"
```

`healthcheck.sh` exit codes (dependency-aware — WAHA checked before bridge):

| Exit | Meaning |
|---|---|
| 0 | WAHA `WORKING` and bridge `/health` ok (or bridge not yet deployed) |
| 1 | bridge container down or `/health` unreachable (WAHA is fine) |
| 2 | WAHA container unhealthy or API not responding |
| 3 | QR/session required (`SCAN_QR_CODE`/`STARTING`/`STOPPED`/`FAILED`) or unknown |

No second conversation engine is introduced here; the bridge owns the state
machine.
