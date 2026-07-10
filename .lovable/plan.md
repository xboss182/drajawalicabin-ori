# Booking Guide Page

Add a new route `/booking-guide` with a visual, 4-step walkthrough for booking (with emphasis on 20+ guest groups) and a "Download as PDF" action.

## Route & Navigation

- New file: `src/routes/booking-guide.tsx`
- Add "Booking Guide" link to the main nav in `src/routes/index.tsx` (and any shared header) next to "Gallery".
- Route `head()` metadata: title "How to Book — Rajawali D'Cabin Chalet", description mentioning step-by-step booking and large group instructions, matching og:title/og:description. No og:image required.

## Page Layout

Sections (top to bottom):

1. **Hero** — Title "How to Book", subtitle "A visual, step-by-step guide — perfect for groups of 20+ guests." Primary button: **Download Guide as PDF**.
2. **Steps** — 4 vertically stacked cards, each with:
   - Large numbered badge (01–04)
   - Screenshot/illustration on one side, text on the other (alternating left/right on desktop, stacked on mobile)
   - Step title, short description, bullet list of actions
3. **Large-group callout** — Highlighted tip box inside Step 2 (amber/primary tint) with the exact wording:
   > "Booking for a large group? If you have more than 20 guests, use the 'Add Room' feature to select multiple rooms until your total guest count is accommodated. Our cabins fit different capacities — combine Queen and Twin rooms to cover everyone."
4. **Footer CTA** — "Ready to book?" with two buttons: **Start Booking** (→ `/book`) and **Download Guide as PDF** (repeat).

### Step Content

- **Step 1 — Select Dates & Initial Guests**: pick check-in/check-out on the calendar, enter adults + children under 12.
- **Step 2 — Add Multiple Rooms**: choose a cabin, click **Add Room**, repeat with **Add Another Room** until capacity ≥ total guests. Includes the large-group callout.
- **Step 3 — Review & Guest Details**: verify cart (all rooms/dates/price), fill primary guest name, IC, phone, vehicle info; add remarks.
- **Step 4 — Secure Booking**: choose deposit or full payment, accept T&Cs (incl. late check-out RM10/hr), continue to Stripe checkout, receive confirmation email + manage-booking link.

## Illustrations

Reuse existing preview screenshots where possible; otherwise generate 4 lightweight illustrations (flat, brand-tone) via imagegen and save under `src/assets/booking-guide/`:
- `step-1-dates.jpg` — calendar + guests
- `step-2-add-room.jpg` — cart with multiple rooms + Add Room button highlighted
- `step-3-details.jpg` — guest details form
- `step-4-checkout.jpg` — payment/checkout screen

## PDF Export

- Library: **html2pdf.js** (bundles html2canvas + jsPDF, simplest DOM → PDF).
- Install: `bun add html2pdf.js`.
- Implementation: wrap the printable content in a `ref`ed `<div id="guide-printable">`. `downloadPdf()` dynamically imports html2pdf (client-only), calls it with A4 portrait, 10mm margins, filename `Rajawali-DCabin-Booking-Guide.pdf`.
- Hide the two "Download PDF" buttons and any nav during capture via a `.pdf-hide` class removed on the cloned node.
- Ensure fonts and images finish loading (use `await document.fonts.ready` and `img.decode()`) before invoking html2pdf so the export isn't blank.

## Constraints

- No changes to booking logic, admin, or DB.
- Follow design tokens in `src/styles.css` (no hardcoded colors).
- Fully responsive; steps stack on mobile.
