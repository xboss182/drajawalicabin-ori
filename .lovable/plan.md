## Goal

Apply the active "10% off 2nd night onwards (per room)" automatic discount to the guest-facing booking page, the checkout total, and the final booking record — with a clear "Discount applied" line so the customer sees exactly what they got off.

## What's already in place

- Discount engine (`src/lib/discounts.ts`) — computes `nth_night_onwards` per room, per night, room-rate only.
- `discounts` and `discount_redemptions` tables + admin toggle.
- Not yet wired: guest booking page, checkout total, booking record, confirmation screen.

## Changes

### 1. Per-night rate breakdown (server)

`compute_booking_price` only returns totals. The engine needs per-night rates so it knows which night is "2nd onwards" per room and its scope (weekday/weekend/holiday).

Add a new server function `previewPriceDetailed` in `src/lib/booking.functions.ts`:
- Input: `{ cabinId, checkIn, checkOut }`
- Loops dates in TS, reads `school_holidays` + cabin rates once, returns:
  `{ nights: [{ date, rate, scope }], subtotal, perNightAvg }`

Keep existing `previewPrice` untouched (used elsewhere).

### 2. Public "get active discounts" server fn

Add `listActiveDiscounts` (public, no auth) in `src/lib/discounts.functions.ts` — returns only automatic, currently-active rows (no `code`). Guests never see coupon list.

### 3. Guest booking page (`src/routes/book.tsx`)

In the pricing effect (around line 205-231):
- For each cart line, call `previewPriceDetailed` and expand to `qty` room entries.
- Build `PricingCart` and call `pickBestDiscount(cart, activeAutoDiscounts)`.
- Store `discountApplications` in state.

In the summary card (around line 970-990):
- Add a "Discount" row under Room subtotal: `10% off 2nd night onwards  −RM 80.00` (green text).
- Subtract from displayed total. Security deposit unchanged.

Pass `discountTotal` and `discountLabel` into `submitBooking` payload.

### 4. Booking submission (server)

`createBookingRequest` (or equivalent submit fn) already writes rows to `booking_requests`. Extend it to:
- Accept `discountId`, `discountAmount`, `discountLabel` from the client.
- Recompute discount server-side (never trust client math) using the same engine.
- Store on the lead row: `discount_id`, `discount_amount`, `discount_label` (columns already added per earlier phase).
- Reduce `total_amount` by the discount amount.
- Insert a `discount_redemptions` row after successful create.

### 5. Stripe checkout total (`src/lib/payments.functions.ts`)

`createBookingCheckout` reads `total_amount` from the booking row. Since step 4 already writes the discounted total, Stripe automatically charges the discounted amount — no line-item math change needed. Just add a `description` line "Includes 10% off 2nd night onwards (−RM X)" on the Stripe line item for the guest's receipt.

### 6. Confirmation + manage-booking UI

Show the discount line in:
- Post-submit success screen in `book.tsx` (near line 1050).
- `src/routes/manage-booking.tsx` price breakdown.
- Booking summary email template (`src/lib/email-templates/booking-summary.tsx`) — one row.

## Test case (8 rooms, 29–31 Aug 2026)

- 8 rooms × 2 nights × RM100 weekend = RM 1,600
- Discount: 8 × (RM100 × 10%) = **−RM 80**
- New total: **RM 1,520** + RM 400 security deposit = RM 1,920 payable

The summary card, Stripe checkout, DB row, confirmation screen, and email will all show the −RM 80 line.

## Out of scope for this turn

- Coupon code input field (guest-typed codes) — separate follow-up.
- Admin display of discount on existing booking cards — separate follow-up.
