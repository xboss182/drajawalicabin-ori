Clarify the RM50 deposit as a separate booking/security deposit and update the booking page terms, payment options, and price breakdown accordingly.

## Background
The current booking page presents the RM50 as a partial payment that goes toward the room total. The user wants it reframed as a **refundable booking/security deposit** that is separate from the room rate.

## Changes

### 1. Text content updates (src/lib/i18n.tsx)

**English**
- Update `book.terms.summary` to explain the RM50 is a booking/security deposit to secure the dates, not part of the room rate, and is refundable after check-out subject to room inspection.
- Update `book.terms.agree` checkbox text to reflect the same.
- Update `book.houseRules.items` to clarify the security deposit refund and cancellation policy.
- Update `book.info.bookingNumNote` to reference the security deposit.
- Update `book.pay.holdSuffix` to mention that the security deposit is separate from the room rate.
- Add new translation keys if needed for the payment option cards and price breakdown.

**Malay**
- Mirror the same changes in the Malay translations to keep the bilingual experience consistent.

### 2. Booking page payment options (src/routes/book.tsx)

- **Deposit option card**: re-label from "Reserve with RM 50 deposit" to "Reserve with RM50 booking/security deposit" and explain that the RM50 is a refundable security deposit (not part of the room rate) and the full room rate is due before check-in.
- **Full payment option card**: re-label to clarify that "Pay in full now" means room rate + refundable RM50 security deposit per room.
- **Terms list**: update both the deposit and full-payment bullet lists to include:
  - RM50 per room is a refundable security deposit, not part of the room rate.
  - Security deposit is refunded after check-out following a room inspection.
  - Full room rate (+ security deposit for full payment) must be settled before check-in.
  - Cancellations within 7 days of check-in are non-refundable.
- **Checkbox agreement**: update the agreement text to match the new terms.

### 3. Price breakdown / summary

- Add a separate "Security deposit (RM50 per room, refundable)" line item in the stay summary sidebar.
- Keep the existing room subtotal and comforter lines.
- Update the total display to show the total payable amount (room rate + security deposit) for the full-payment option, or the security deposit amount for the deposit option.
- Update the payment-step "Amount due" display to show the security deposit clearly and, where applicable, the remaining room rate balance.

### 4. Backend / checkout terminology

- Update the booking creation logic so that the security deposit is tracked separately from the room rate (e.g., `deposit_amount` stays as the RM50/room security deposit, and the balance remains the full room rate).
- Adjust the checkout route (`/checkout`) labels from "Pay your deposit" / "Pay your balance" to "Pay your security deposit" / "Pay your room balance".
- Update email templates (booking-summary, balance-reminder, fully-paid, admin-booking-alert) to reflect the security-deposit wording and refund policy.

### 5. Verification

- Build the project and run typecheck.
- Walk through the booking flow: select a room, choose deposit option, confirm the security deposit is displayed separately and the balance reflects the full room rate.
- Repeat with full-payment option and confirm the total is room rate + security deposit.
- Verify the updated terms text appears in the booking summary, payment step, and emails.