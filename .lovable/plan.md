# WA machine API: migrations, secret, publish, verify

## Pre-flight (done, read-only)

- Commit confirmed: `aa9d3d85a010f9c3cfc5a9f8464e3c8f55a1b67f` ("Fixed missing WA chat column") — matches the requested version.
- Both requested migrations are present in the repo and their effects are **already live in the database** (applied in the previous session, same SQL, unchanged):
  - `20260825054450_...sql` — `booking_requests.source` + `wa_chat_id` present; all 8 `wa_*` tables present.
  - `20260825054540_...sql` — `wa_claim_hold`, `wa_expire_stale_holds`, `wa_outbox_claim` exist with execute restricted to the backend role.
- Blocker found: the server-only secret `WA_MACHINE_SECRET` does **not** exist in Cloud Secrets (current secrets: `BOOKINGS_EXPORT_TOKEN`, `GOOGLE_SEARCH_CONSOLE_API_KEY`, `LOVABLE_API_KEY`, `MICROSOFT_EXCEL_API_KEY`).

## What this means

No new migration is needed and none will be generated. Re-running the two files would be a no-op (they are idempotent), so the migration step is reported as already satisfied rather than re-applied.

`WA_MACHINE_SECRET` is required by `src/lib/wa/machine-auth.server.ts`. Without it, `/api/machine/wa/*` responds `503` instead of `401`. The route will still not be `404` once published, but the requested "401 or 403" outcome needs the secret in place.

## Steps after you add the secret

1. You add `WA_MACHINE_SECRET` yourself in Lovable Cloud → Secrets. I will not ask for, display, generate, or rotate its value, and it stays server-only (no `VITE_` prefix).
2. Publish the current project (no code changes in this turn).
3. Verify on the published site:
   - unsigned `POST /api/machine/wa/settings/get` returns 401/403 (not 404)
   - the normal web booking page loads
   - public WhatsApp booking stays disabled (no pairing, no phone number change, no bookings created)
4. Report deployed commit, migration status, route status codes, and any blocker.

If you prefer to publish now without the secret, I can do that too — the route will then answer `503` until the secret is added.
