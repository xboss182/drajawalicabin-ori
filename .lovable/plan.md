# Add Stripe payment option (manual transfer stays as-is)

## Goals
- Keep current manual bank transfer / DuitNow QR flow exactly as it is — owner reviews proof and approves.
- Add **"Pay by card (Stripe)"** as a second option on the booking page and on the manage-booking balance page.
- Stripe success → booking is **auto-confirmed** (no proof review). Deposit-only payment moves status to `confirmed`; full payment moves to `fully_paid` and triggers the same locker-code/email flow you already have.
- Malaysia seller, so Stripe is set up with **tax calculation and collection only** (+0.5% per txn on top of base Stripe fees). You handle SST registration/filing.

## User-facing flow

### On `/book` (deposit step)
- New choice block: **Pay deposit by card** (Stripe) or **Pay by bank transfer / DuitNow** (current).
- Card path: redirects to Stripe Checkout, returns to a success page, booking auto-set to `confirmed`.
- Bank path: unchanged — upload proof, owner approves.

### On `/manage-booking` (balance step)
- Same two options for the remaining balance.
- Card path: auto-marks `fully_paid` and sends locker code if your existing rules say so.
- Bank path: unchanged.

### Admin
- Bookings list shows payment method per booking ("Card" vs "Transfer") and which payments were Stripe vs manual.
- Stripe-paid bookings skip the "Approve proof" buttons (already approved).

## Technical details

### Setup
1. Enable Lovable's built-in Stripe (test env created instantly, no API key from you).
2. Create two Stripe products: `Cabin Deposit` and `Cabin Balance` with dynamic amounts, plus tax codes appropriate for short-term accommodation.
3. Set Stripe to **tax calculation only** (`automatic_tax: { enabled: true }`).

### Schema (new columns on `booking_requests`)
- `payment_method text` — `'manual' | 'stripe'`, default `'manual'`.
- `stripe_session_id text`, `stripe_payment_intent_id text` (for deposit).
- `stripe_balance_session_id text`, `stripe_balance_payment_intent_id text`.
- Migration + RLS GRANTs preserved.

### Server functions / routes
- `createDepositCheckout` (server fn) — creates Checkout Session for deposit, stores session id on booking, returns redirect URL.
- `createBalanceCheckout` (server fn) — same for balance.
- `/api/public/stripe/webhook` (server route) — verifies signature, handles `checkout.session.completed`:
  - If it's a deposit session → set booking `status = 'confirmed'`, record IDs, send the same confirmation email you send today on manual approval.
  - If it's a balance session → set `status = 'fully_paid'`, set `balance_paid_at`, run your existing locker-code/email path.

### UI changes
- `src/routes/book.tsx`: payment method selector + Stripe redirect.
- `src/routes/manage-booking.tsx`: same selector on the balance section.
- `src/routes/_authenticated/admin.index.tsx`: badge for Card/Transfer; hide "Approve proof" actions on Stripe-paid rows.

### Out of scope (ask if you want them)
- Refunds from the admin UI.
- Stripe Customer portal for guests.
- Switching the manual flow itself — it stays exactly as today.

## Settlement reminder
First Stripe payout: ~T+7 business days. Subsequent payouts: ~2 business days. You'll claim the Stripe account when ready to go live; test mode works immediately.

Approve and I'll enable Stripe, then implement.
