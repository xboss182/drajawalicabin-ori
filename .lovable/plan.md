## Plan

1. **Fix the booking insert payload**
   - In the customer booking creation logic, always include `discount_amount: 0` and empty discount fields when no discount applies.
   - Keep the existing behavior where the lead row gets the actual discount amount/code when a discount is applied.

2. **Fix manual admin bookings too**
   - Add the same safe default to manual booking rows, so admin-created bookings cannot hit the same database error.

3. **Verify checkout flow**
   - Test a normal mobile-style booking with no coupon/discount.
   - Confirm it reaches the payment option step without showing the red `discount_amount` database error.

## Technical details

The database requires `booking_requests.discount_amount` to be non-null. The current insert rows only set `discount_amount` when a discount exists, so when no discount is applied the insert can send a missing/null value and fail on mobile checkout. The fix is to make every inserted booking row explicitly include `discount_amount: 0` by default, then override it only for the discounted lead row.