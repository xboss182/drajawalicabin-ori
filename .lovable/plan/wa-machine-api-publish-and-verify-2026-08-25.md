# WA machine API: publish and verify

## Pre-flight (done, read-only)

- Commit confirmed: `aa9d3d85a010f9c3cfc5a9f8464e3c8f55a1b67f` ("Fixed missing WA chat column").
- Both requested migrations are already live in the database (applied in the previous session from the same files, unchanged):
  - `20260825054450_...sql` — `booking_requests.source` + `wa_chat_id` present; all 8 `wa_*` tables present.
  - `20260825054540_...sql` — `wa_claim_hold`, `wa_expire_stale_holds`, `wa_outbox_claim` exist, execute restricted to the backend role.
  No new or replacement migration will be generated; re-running these files would be a no-op.
- `WA_MACHINE_SECRET` now exists in Cloud Secrets (server-only, value never read or displayed).

## Steps

1. Publish the current project as-is — no code edits, no migrations, no WhatsApp pairing, no phone-number change, no enabling of public WhatsApp booking.
2. Verify against the published site:
   - unsigned `POST /api/machine/wa/settings/get` → expect 401/403 (not 404, not 503)
   - normal web booking page loads
   - public WhatsApp booking remains disabled
3. Report deployed commit, migration status, HTTP status codes, and any blocker.

No production data is created or modified during verification.
