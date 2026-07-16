## Goal
On the `/book` page, reorder the mobile layout so the guest sees the **Stay summary** before the **Payment option**, **Property rules**, and **payment button**. Desktop layout stays exactly as it is.

## Current layout
The page uses a single-column stack on mobile (`< lg`):
1. Form (availability → rooms → guest details → payment option → property rules → submit button)
2. Stay summary card (aside)

This pushes the price summary below everything the guest must read/click, which is poor for conversion.

## Proposed change
1. **Extract** the stay summary card from the existing `<aside>` into a reusable `StaySummaryCard` component inside `src/routes/book.tsx`.
2. **Insert** a mobile-only instance of `StaySummaryCard` inside the booking form, positioned immediately before the "Payment option" section.
3. **Hide** the desktop `<aside>` below the `lg` breakpoint (`hidden lg:block`) so the summary is not duplicated on mobile.
4. **Keep** the desktop two-column layout untouched: form on the left, aside on the right.

## Resulting mobile order
- Availability / room selection / guest details
- **Stay summary**
- Payment option
- Property rules
- Submit button

## Resulting desktop order (unchanged)
- Left column: form
- Right column: stay summary card

## File to change
- `src/routes/book.tsx`

## Verification
- Open `/book` on a mobile viewport.
- Confirm the Stay summary card renders above the Payment option section.
- Confirm desktop still shows the summary in the right sidebar and the form in the left column.
- Confirm no duplicate summary on any viewport.