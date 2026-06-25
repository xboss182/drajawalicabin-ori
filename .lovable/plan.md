Ship all the gaps identified, in 4 phased batches so each batch is reviewable and shippable on its own. Each batch ends with the site fully working — nothing half-built.

The very first thing needed before any email work is your sender email domain. I'll surface the setup dialog at the start of Batch 1; once DNS verifies, queued emails start sending automatically.

## Batch 1 — Notifications & guest self-service (highest impact)

Goal: replace the manual `email_outbox` queue with real, branded emails to guest + management, and give the guest a way back to their booking.

1. Set up Lovable Emails (domain + infrastructure + branded templates).
2. Templates (EN/BM, branded with Rajawali D'Cabin colors):
   - `booking-submitted` → to guest, CC management. Includes ref, dates, cabin, total, deposit due, payment instructions.
   - `booking-confirmed` → after admin confirms deposit. Includes manage-booking link.
   - `balance-reminder` → 7 days before check-in (replaces current queue stub).
   - `fully-paid` → key-locker code + arrival instructions.
   - `booking-cancelled` → on cancel.
   - `admin-new-booking` → to management only, on every new `awaiting_review` submission.
3. Replace `email_outbox` enqueues in `booking.functions.ts`, `admin.tsx`, and the cron route with calls to the new send route. Keep `email_outbox` table during transition for audit; stop writing to it.
4. **Guest booking lookup page** (`/find-booking`): enter email + reference → resends the manage-booking link via email. Rate-limited.
5. **Payment proof UX polish**: file size limit (5MB), accepted types (jpg/png/pdf), inline preview, clearer hold-expiry error state.

## Batch 2 — Admin operations

Goal: give the booking handler everything needed to run the day-to-day.

1. **Cancel booking action** (admin): releases cabin dates, sets status `cancelled`, sends `booking-cancelled` email, optional note.
2. **Manual cabin block**: new `cabin_blocks` table (cabin_id, from, to, reason) — also blocks availability via `cabin_taken_dates`. UI to add/remove blocks (maintenance, owner stay, etc.).
3. **Arrivals/departures view**: today + next 7 days, grouped by date, with guest name, phone, locker code, paid status, one-tap WhatsApp link pre-filled with guest name + ref.
4. **Calendar grid view**: month-by-month per cabin, color-coded by status (confirmed / awaiting / fully-paid / blocked).
5. **Payment proof viewer**: signed URL, zoom + rotate buttons, download.
6. **Audit log table** (`booking_audit`): who did what, when. Auto-written on status changes via trigger.

## Batch 3 — Owner dashboard & financials

Goal: owner-level visibility without asking the booking handler.

1. **Revenue dashboard** (`/admin/insights`, owner role only):
   - This month + last 12 months revenue chart
   - Occupancy % per cabin
   - Add-on attach rate (comforter)
   - Top-performing cabin
2. **Outstanding balance report**: confirmed bookings where balance not paid, sorted by check-in date, with "send reminder now" button.
3. **CSV export** of bookings for any date range (for accounting).
4. **Rate management UI**: edit weekday/weekend/school-holiday rates per cabin; manage school-holiday date ranges. No more DB edits.
5. **Roles**: add `owner` and `operator` to `app_role` enum. Owner sees dashboard + rates; operator handles bookings; admin (existing) keeps full access.

## Batch 4 — Polish & operational glue

1. Stronger date-conflict messaging on the booking form.
2. Receipt/invoice PDF generated server-side, downloadable from manage-booking page and attached link in `fully-paid` email.
3. Brief privacy/data-retention note in footer and at booking form.
4. CSV "guest list" export for owner.
5. Light QA pass: mobile (375px), tablet (768px), desktop. EN + BM. All flows: submit → upload proof → admin confirm → balance reminder → balance upload → mark paid → cancel.

## Technical notes (skip if not relevant)

- All new admin pages live under `src/routes/_authenticated/admin*` and are gated by `has_role(auth.uid(), 'admin' | 'owner' | 'operator')` inside server fns. Owner-only insights checked server-side.
- New tables: `cabin_blocks`, `booking_audit`. Both with `service_role` + scoped `authenticated` GRANTs and RLS.
- `cabin_taken_dates` SQL function extended to UNION in `cabin_blocks`.
- Cron `send-balance-reminders` route updated to call the new transactional email send route instead of writing to `email_outbox`.
- WhatsApp quick-reply links use existing `601155007204` number with pre-filled text including guest name + booking ref.
- Receipt PDF generated with `@react-pdf/renderer` inside a server fn (Worker-compatible).

## Sequencing & checkpoints

After each batch I'll stop, confirm everything works, and only move on once you've eyeballed it. Batch 1 is the longest because email infra is a one-time setup; Batches 2–4 are mostly UI on top of existing data.

**Batch 1 starts with the email-domain setup dialog**, which needs you to enter your domain and add the DNS records at your registrar (Lovable handles the rest). Once that's done I'll continue Batch 1 in the same session.