# Real annotated screenshots for the Booking Guide

Replace the 4 AI illustrations in `/booking-guide` with real screenshots of the live booking flow, each overlaid with a red arrow + label pointing to the exact element to click.

## Capture

Use Playwright (headless Chromium, 1280x1800) against `http://localhost:8080` to capture each step from the real app:

1. **Step 1 — Dates & guests**: navigate to `/book`, screenshot the date-picker + adults/children fields region.
2. **Step 2 — Add rooms**: pick dates, select a cabin, screenshot the cart panel showing an added room and the "Add Another Room" button.
3. **Step 3 — Guest details**: scroll to the guest info form, screenshot the primary guest fields (name, IC, phone, vehicle, remarks).
4. **Step 4 — Secure booking**: screenshot the payment option + T&C checkbox + "Continue to payment" button.

Each capture is an element-level screenshot (not full page) so text stays legible in the PDF.

## Annotation

After capture, overlay each PNG with a red arrow + short label (e.g. "Pick dates", "Click Add Another Room", "Fill guest info", "Click Continue") using Python + PIL in the same script. Arrow: solid red (#E11D48), thick stroke, slight drop shadow, label in bold sans-serif with white background pill for legibility.

Save the 4 annotated images to:
- `src/assets/booking-guide/step-1-dates.jpg`
- `src/assets/booking-guide/step-2-add-room.jpg`
- `src/assets/booking-guide/step-3-details.jpg`
- `src/assets/booking-guide/step-4-checkout.jpg`

(Same filenames → `booking-guide.tsx` picks them up automatically via the existing `.asset.json` imports, no code changes needed.)

## UI tweak

In `src/routes/booking-guide.tsx`, widen the image column slightly (`max-w-md` → `max-w-lg`) and switch `object-fit` to `contain` so the wider real screenshots aren't cropped. No other logic changes.

## Out of scope

- No changes to booking flow, PDF export logic, routes, or step text.
- No new dependencies (PIL is already available in the sandbox).
