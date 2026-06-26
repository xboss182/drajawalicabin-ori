## Add `/find-booking` lookup page

Lets guests who lost their confirmation email recover their manage-booking link by entering email + booking reference.

### User flow

1. Guest visits `/find-booking` (linked from header + booking confirmation screen).
2. Enters email address + booking reference (e.g. `RDC-XXXX`).
3. Submits → server validates match in `booking_requests`.
4. On match: shows success state ("We've sent the link to your email") and emails the manage-booking link to the address on file.
5. On no match: generic "If a booking matches, we've sent the link" message (avoid leaking which field was wrong).
6. Rate-limited: max 5 attempts per IP per 15 min to prevent enumeration.

### Pieces to build

1. **Route** `src/routes/find-booking.tsx`
   - Form: email + reference inputs, submit button
   - EN/BM copy via existing `i18n.tsx`
   - Branded to match `manage-booking` styling (forest/coconut/stone)
   - `head()` with `noindex` meta

2. **Server function** `src/lib/booking.functions.ts` → add `requestManageLink`
   - Input: `{ email, reference }` (Zod validated)
   - Look up booking by `reference` + case-insensitive email match
   - Rate-limit by IP using a small in-memory + DB-backed check (simplest: insert into a `manage_link_requests` table with timestamp, count last 15 min)
   - If match: send email via existing email infrastructure with link `https://<site>/manage-booking?id=<bookingId>`
   - Always return the same generic success response (no enumeration)

3. **Email template** (deferred until Batch 1 email infra is live)
   - For now: the server fn can fall back to writing into `email_outbox` (existing pattern) so the link is queued. Once Batch 1 email infra ships, swap to the real send route.

4. **Header link** on `/` and `/manage-booking`: small "Lost your link?" → `/find-booking`.

5. **Booking confirmation screen** (`/book` done state): add a note "Bookmark this link or use Find Booking on our site if you lose your email."

### Rate-limiting table (minimal)

```sql
CREATE TABLE public.manage_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.manage_link_requests TO service_role;
ALTER TABLE public.manage_link_requests ENABLE ROW LEVEL SECURITY;
-- no client policies; only server fn (service role) writes/reads
CREATE INDEX ON public.manage_link_requests (ip, requested_at DESC);
```

Server fn checks `SELECT count(*) WHERE ip=$1 AND requested_at > now() - interval '15 minutes'` and rejects if ≥ 5.

### Out of scope (for this step)

- Full branded email template (depends on Batch 1 email-infra; for now reuse `email_outbox` queue).
- Phone-number lookup (email + reference is enough).
- Login/account system (intentionally guest-only).

### Verification

- Submit with valid email + ref → toast + queued email row in `email_outbox`.
- Submit with mismatched email/ref → same generic message; no email queued.
- Submit 6× in a row from same IP → 6th rejected with "Too many attempts, try again later."
- EN/BM toggle swaps all copy.
