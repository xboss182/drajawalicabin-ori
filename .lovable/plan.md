## Goal
Clean up the promo code input in the booking page summary card so the label and placeholder don't duplicate each other.

## Changes
1. In `src/routes/book.tsx` (summary card section):
   - Remove the "Promo code" label that sits above the input box.
   - Change the input placeholder from `"Enter code"` to `"Promo code"`.
2. Keep the Apply button, coupon validation, discount rows, and all existing logic unchanged.

## Out of scope
- No changes to discount calculation, coupon validation, or automatic discount display.
- No changes to other pages or components.