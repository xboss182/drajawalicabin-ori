## Late check-out fee — RM10/hour after 12:00 PM

### Rules (agreed)
- Standard check-out: **12:00 PM** local time (Asia/Kuala_Lumpur).
- Any minute past 12:00 is charged; **round up per hour** (e.g. 12:05 = 1h = RM10; 1:30 PM = 2h = RM20).
- **Admin manually logs** the actual check-out date/time in the dashboard.
- Refund handling: **display only** — dashboard shows the deduction breakdown; admin refunds the remainder manually via bank/DuitNow.

### 1. Database (migration)
Add to `booking_requests`:
- `actual_check_out_at timestamptz` — admin-entered actual departure.
- `late_checkout_hours integer` — rounded-up hours past noon (0 if on time).
- `late_checkout_fee numeric(10,2)` — hours × RM10.
- `deposit_refunded_amount numeric(10,2)` — auto-computed suggestion (deposit − fee); admin can override.
- `deposit_refund_note text` — free-text note (e.g. damages).
- `deposit_refunded_at timestamptz` — set when admin marks refund as sent.

Plus `app_settings` keys (defaults, editable in Admin → Settings):
- `late_checkout_hourly_fee` = 10
- `late_checkout_grace_minutes` = 0
- `standard_checkout_hour` = 12 (24h)

### 2. Fee calculation (shared helper)
`src/lib/late-checkout.ts` — pure function:
```
computeLateCheckout(checkOutDate, actualCheckOutAt, { hour=12, grace=0, hourly=10 })
  → { hoursLate, feeRM }
```
Rounds up per hour past noon MYT, ignores anything ≤ standard time.

### 3. Admin dashboard UI
In the booking detail drawer (`admin.index.tsx`), add a **Check-out & Deposit** section shown once booking is `confirmed`/`fully_paid` and check-in has passed:
- Date+time picker: "Actual check-out time" (defaults to now).
- Live-computed breakdown card:
  - `Scheduled check-out: 12:00 PM, 15 Jul 2026`
  - `Actual check-out: 2:20 PM, 15 Jul 2026`
  - `Late check-out fee: 3 hrs × RM10 = RM30`
  - `Security deposit: RM50`
  - `Refund due: RM20`
  - Optional damages/notes textarea (further deducts from refund).
- "Save & mark checked out" button → persists fields.
- After save: shows "Refund pending — pay RM X manually" with a "Mark refunded" button.

### 4. Guest-facing terms updates
Update visible terms/notices with the late-checkout clause:
- `src/routes/book.tsx` — terms list on booking form (both deposit and pay-in-full variants).
- `src/routes/manage-booking.tsx` — description + a small "Check-out policy" note near the check-out row.
- `src/routes/checkout.tsx` — subtitle where deposit is explained.
- `src/lib/i18n.tsx` — new EN + MS strings for the clause (used across pages).

Clause wording (EN):
> **Check-out is by 12:00 PM.** Late check-out is charged at **RM10 per hour** (rounded up per hour) and will be deducted from your refundable security deposit.

MS:
> **Daftar keluar sebelum 12:00 tengah hari.** Lewat daftar keluar dikenakan caj **RM10 sejam** (dibundarkan ke atas) dan akan ditolak daripada deposit keselamatan anda.

### 5. Email (optional, small)
Append the same clause line to the booking-summary email template (`src/lib/email-templates/booking-summary.tsx`) under the existing policy list so guests see it in their confirmation.

### 6. Admin Settings
Add fields under Admin → Settings for hourly fee, grace minutes, standard check-out hour (writes to `app_settings`). Defaults RM10 / 0 min / 12:00.

### Out of scope (explicit)
- No automated Stripe refund — admin refunds manually.
- No auto check-out detection — admin logs the time.
- CSV export can gain the two new columns (`Late fee`, `Deposit refunded`) in a follow-up if you want.

### Files touched
- new: migration; `src/lib/late-checkout.ts`
- edit: `src/routes/_authenticated/admin.index.tsx`, `src/routes/_authenticated/admin.settings.tsx`
- edit: `src/routes/book.tsx`, `src/routes/manage-booking.tsx`, `src/routes/checkout.tsx`
- edit: `src/lib/i18n.tsx`, `src/lib/email-templates/booking-summary.tsx`
- edit: `src/lib/booking.functions.ts` (server fn to save actual check-out + fee)
