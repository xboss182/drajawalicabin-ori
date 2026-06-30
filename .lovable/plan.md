## 1. "Any cabin" → ranked shortlist

When guest selects **Any cabin** + dates + guests, show 2–3 best matches instead of the full grid.

**Ranking rule** (server fn `recommendCabins({ checkIn, checkOut, guests })`):
1. Filter active cabins where `capacity >= guests` AND no taken-date overlap (reuse `cabin_taken_dates`).
2. Score = `(capacity − guests) × 1000 + total_price`. Lowest score = best fit (capacity just-right, then cheapest).
3. Return top 3 with computed total via `compute_booking_price`.

**UI** on `/book` when `room=Any cabin`:
- Card list: "Recommended for your party" — each card shows cabin name, capacity, nights × rate breakdown, total, **Select** button.
- Below: "See all cabins" toggle to expand the existing full list.

## 2. Dual payment pipeline (RM50 deposit OR full payment)

**Schema:**
- Add `booking_requests.payment_type TEXT CHECK IN ('deposit','full') DEFAULT 'deposit'`
- Add `booking_requests.amount_paid_so_far NUMERIC` (helper; computed from proofs)

**Checkout flow** (`/book` payment step):
Radio group:
- ⚪ **Reserve with RM 50 deposit** — pay balance 7 days before check-in. (current behaviour)
- ⚪ **Pay in full now (RM {{total}})** — locker code issued on admin approval, no balance step.

**Server `submitBooking`** now accepts `paymentType`. When `full`:
- `deposit_amount = total_amount`, `balance_amount = 0`, `balance_due_at = null`.
- Status flow: `pending_payment` → upload proof → `awaiting_review` → admin **Confirm payment** → directly **`fully_paid`** (skip the balance step) and prompts admin for locker code.

**Server `submitBooking`** when `deposit`: unchanged (RM 50 → balance later).

**Admin invoice** shows 1-row schedule for full-payment bookings, 2-row schedule for deposit bookings.

**Email rendering:** `renderBookingSummaryEmail` branches:
- Deposit: "RM50 paid, balance RM X due {date}" (current text)
- Full: "Paid in full. Locker code on the way once we verify."

**Cron `send-balance-reminders`:** already skips rows where `balance_amount = 0`, but tighten to also skip `payment_type='full'`.

## 3. Lovable Emails on `notify.drajawalicabin.com`

The custom domain `drajawalicabin.com` is already connected. I will:

1. Open the email-setup dialog so you can confirm `notify.drajawalicabin.com` as the sender subdomain (Lovable provisions SPF/DKIM/MX automatically via NS delegation).
2. `setup_email_infra` → creates `email_send_log`, pgmq queues, send-queue cron, suppression list.
3. `scaffold_transactional_email` → creates React Email templates + `/lovable/email/transactional/send` route.
4. Migrate the 3 booking emails from `email_outbox` text bodies to branded React Email templates:
   - `booking-deposit-received.tsx`
   - `booking-paid-in-full.tsx`
   - `balance-reminder.tsx`
   - `admin-new-booking.tsx` (CC'd to active `admin_email_recipients`)
5. Replace `enqueueEmail()` calls in `booking.functions.ts` and `send-balance-reminders.ts` with `sendTransactionalEmail()` calls (one per recipient, idempotency keys derived from booking id + template).
6. Leave `email_outbox` table as a legacy log; admin Stats dashboard already reads `email_send_log` so no change there.

DNS verifies within ~minutes-to-hours after you complete the setup dialog. Sending starts automatically once verified — no further action.

## Files

**Migration:** add `payment_type` column, backfill existing rows to `'deposit'`.

**Edit:**
- `src/lib/booking.functions.ts` — add `recommendCabins`, accept `paymentType` in `submitBooking`, update `confirmBooking` so `payment_type='full'` jumps to `fully_paid`.
- `src/routes/book.tsx` — render shortlist when room=Any, payment-type radio at checkout step.
- `src/lib/email.server.ts` — replace `enqueueEmail` with `sendTransactionalEmail` helper; keep render helpers as React Email components.
- `src/routes/api/public/hooks/send-balance-reminders.ts` — skip `payment_type='full'`.
- `src/routes/_authenticated/admin.invoice.$id.tsx` — show 1-row vs 2-row schedule.

**New:** React Email templates under `src/lib/email-templates/`.

## Out of scope
- Refund flow for cancelled full-paid bookings (manual today).
- Partial payments beyond the 2 options.
