## Goal

Let guests pay the owner directly (Maybank/CIMB transfer, DuitNow QR, TnG eWallet QR) and have the calendar auto-block only after the owner confirms the payment landed in their account. You (the builder) never touch the money.

## How the booking lifecycle works

```
guest submits form  →  status: pending_payment   (calendar shows "on hold" for 30 min)
guest uploads proof →  status: awaiting_review   (calendar still on hold)
owner confirms      →  status: confirmed         (calendar BLOCKED — dates unavailable)
owner rejects /     →  status: cancelled / expired (hold released, dates free again)
hold expires
```

The calendar is blocked by the database, not by Stripe/Paddle. So a manual processor works exactly the same — we just need a row marked `confirmed` for those dates.

## What the guest sees

1. Fills out the existing booking form at `/book` (name, email, phone, dates, cabin).
2. Confirmation screen shows:
   - Total: `nights × nightly_rate` (we'll need the per-cabin prices from you)
   - **Payment options panel** with three tabs:
     - **Bank transfer** — owner's bank, account name, account number, copy-to-clipboard button, reference code (e.g. `RJW-4821`)
     - **DuitNow QR** — QR image
     - **TnG eWallet** — QR image
   - "Upload payment proof" button (image/PDF, stored in Lovable Cloud storage)
   - "Hold expires in 29:58" countdown
3. After upload: thank-you screen — "We'll confirm within a few hours via WhatsApp."

## What the owner sees

A simple password-protected `/admin` page (single shared passcode you give the owner, no full auth system) listing:
- Pending bookings with guest details, dates, amount, reference code, and the uploaded proof image
- **Confirm payment** button → status becomes `confirmed`, calendar is now blocked, guest gets a WhatsApp deep-link / email confirmation
- **Reject** button → status becomes `cancelled`, hold released

## Calendar blocking

- The booking form's date picker queries `booking_requests` for any row where `status IN ('pending_payment','awaiting_review','confirmed')` AND the requested dates overlap AND (for pending rows) the hold hasn't expired.
- Overlapping dates for the same cabin are disabled in the picker, and the server re-checks on submit to prevent race conditions.
- A small homepage "Availability" widget can show the next 60 days per cabin using the same query.

## Data model changes

Extend `booking_requests`:
- `cabin_id` (or keep `room_type`) — needed so two different cabins can be booked the same night
- `nightly_rate`, `nights`, `total_amount` (snapshot at booking time)
- `payment_reference` (e.g. `RJW-4821`, shown to guest, used by owner to match transfers)
- `payment_proof_url` (storage path)
- `hold_expires_at` (timestamp, default `now() + 30 min`)
- `confirmed_at`, `confirmed_by`

New table `cabins` (id, name, nightly_rate, capacity, image) so prices/inventory live in the DB instead of being hardcoded. 8 rows seeded.

Status enum: `pending_payment | awaiting_review | confirmed | cancelled | expired`.

New storage bucket `payment-proofs` (private, signed URLs for the admin).

## Admin auth

Lightest option: a single `ADMIN_PASSCODE` secret. `/admin` asks for it once, stores a signed cookie. Good enough for one owner. If you'd rather, we can do real email/password auth on the owner's account — slightly more setup.

## What I need from you before building

1. **Per-cabin nightly rates** (Queen / Twin / Family / Triple — RM amounts).
2. **Owner's payment details** — bank name, account name, account number, plus the QR images (DuitNow + TnG) to upload. If you don't have them yet, I'll use placeholders and you can swap them in.
3. **Hold duration** — default 30 minutes from submission, OK?
4. **Admin access** — shared passcode (simplest) or proper login for the owner?

Once you answer those, I'll build it.
