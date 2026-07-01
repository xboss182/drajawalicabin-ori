## Sync remaining "deposit ≠ room rate" wording

A few spots still describe the RM50 as a plain "deposit" or roll it into "Total cost". Bring them in line with the new refundable **security deposit** wording (separate from room rate, refunded after check-out inspection).

### 1. `src/lib/email.server.ts` (plaintext email fallback)
- `renderBookingSummaryEmail` (deposit case): rename `Total cost` → `Room rate`, `Deposit paid` → `Security deposit paid (refundable after check-out)`, `Remaining balance` → `Room rate balance (due 7 days before check-in)`. Update intro line to "…your booking and RM50 refundable security deposit proof. The security deposit is not part of the room rate and is refunded after check-out, subject to room inspection."
- `renderBookingSummaryEmail` (full case): change `Total paid` to show `Room rate + refundable RM50/room security deposit`, keep "Balance: RM 0.00".
- `renderBalanceReminderEmail`: `Total cost` → `Room rate`, `Deposit paid` → `Security deposit paid ✓ (refundable)`, `Balance due now` → `Room rate balance due now`. Update intro line to mention the security deposit is separate.
- `renderFullyPaidEmail`: replace "The RM50 deposit is refunded after check-out if no damage/loss is recorded." → "The refundable RM50/room security deposit is refunded after check-out, subject to a room inspection ensuring no damage or loss."

### 2. `public/llms.txt`
Line 5: "…online booking with a flexible RM50 deposit per room…" → "…online booking secured by a refundable RM50 security deposit per room (separate from the room rate, refunded after check-out inspection)…"

### 3. `src/routes/index.tsx` (FAQ JSON-LD)
Line 119 answer: "Bookings are secured with a flexible RM50 deposit per room…" → "Bookings are secured with a refundable RM50 security deposit per room (not part of the room rate, refunded after check-out subject to room inspection); the full room rate must be settled at least 7 days before check-in."
Also review any nearby FAQ questions ("cancellation policy", "what's included") and ensure cancellation answer states cancellations within 7 days of check-in are strictly non-refundable.

### 4. `src/routes/_authenticated/admin.index.tsx` (admin dashboard list)
Line 359: "Balance proof uploaded…" → "Room rate balance proof uploaded…" for consistency (small wording tweak, no logic change).

### Out of scope
No logic/schema changes. `booking.functions.ts`, `payments.functions.ts`, `book.tsx`, `manage-booking.tsx`, `checkout.tsx`, `admin.invoice.$id.tsx`, all React Email templates, and i18n strings are already synced from the previous pass — leaving untouched.
