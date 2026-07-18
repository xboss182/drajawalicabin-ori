# Why no email when a guest books

**Root cause (confirmed):** The email sender is wired to the *upload-payment-proof* step, not to booking creation.

- `src/lib/booking.functions.ts` — `booking-summary` + `admin-booking-alert` are sent inside `uploadPaymentProof` (around lines 366–417). If the guest never uploads a receipt, no email is sent to anyone.
- The most recent guest booking (`azliyana`, `yanahadif@gmail.com`, 2026-07-18 10:02) is `pending_payment` with `payment_proof_path = null` and `confirmation_email_sent_at = null` — matching exactly this gap.
- `email_send_log` shows only `fully-paid` sends ever. No `booking-summary` / `admin-booking-alert` row has ever been recorded, confirming the trigger path never fires for these guests.
- Admin recipients are correctly configured (3 active addresses, all opted in to `notify_new_booking`) — the toggle exists but nothing calls it.

Additional observation: manual bookings from the admin dashboard use placeholder email `manual@admin.local`, which is suppressed by design — so those correctly get no guest email. This plan does not change that.

## Fix

1. In `src/lib/booking.functions.ts`, inside the booking-creation server function (the one that inserts the `booking_requests` row(s) and sets status `pending_payment`), after the insert:
   - Load the group rows (same shape as the existing proof-upload path).
   - Build the same `templateData` shape already used for `booking-summary`.
   - Send `booking-summary` to the guest with idempotency key `booking-created-${leadId}-guest`.
   - Send `admin-booking-alert` to each recipient opted-in to `notify_new_booking` (not `notify_payment_proof`) with key `admin-new-booking-${leadId}-${adminEmail}`.
   - Skip sending if `email === 'manual@admin.local'` (manual admin bookings).
   - Wrap in try/catch and log — an email failure must not roll back the booking.
2. Keep the existing proof-upload send as-is, but change its guest template to a "payment proof received" variant (or keep as second reminder). Simpler option: leave proof-upload send unchanged — the `confirmation_email_sent_at` guard already prevents a duplicate guest summary. Admin will get both a "new booking" alert and (later) a "payment proof uploaded" alert, which is the desired behavior.
3. No schema changes. No new templates required (reuse `booking-summary` and `admin-booking-alert`).

## Verification

- Create a test booking from the live site; confirm one row appears in `email_send_log` for the guest and one per admin recipient.
- Re-check the azliyana booking manually (optional): resend by calling the new path, or leave it — new bookings from now on will trigger correctly.

Want me to also send a **retro** email for the azliyana booking now, or only fix it forward?
