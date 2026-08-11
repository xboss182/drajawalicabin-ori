# Simplify "Open your booking" to email only

## What changes for guests

- The lookup form on the My booking page asks for **email only**. The optional "reference" box is removed.
- If the email has **one** active booking, it opens straight away (same as today).
- If the email has **several** bookings, the page shows a short **clickable list** below the form — one line per booking (reference, cabin, check-in date, status). Tapping a line opens that booking.
- The **"Lost link?"** link is removed from the page header.

## Technical notes

- `src/routes/manage-booking.tsx`: drop the reference input, `lookupRef` state and its copy strings; drop the header `Link to="/find-booking"`. Add state for a returned list of bookings and render it as tappable rows that navigate to `/manage-booking?id=…&token=…`.
- `src/lib/booking.functions.ts` — `getBookingByEmailAndReference`: drop the `reference` branch; return either a single match or, when more than one non-cancelled group exists, a list of `{ bookingId, guestToken, reference, roomType, checkIn, status }`. Keep the existing IP rate limiting untouched.
- Copy added for both English and Malay ("Which booking?" / "Tempahan yang mana?").
- `/find-booking` route itself stays in place (still linked from emails); only the header link and the reference field go away.
