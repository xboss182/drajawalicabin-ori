# Make "My booking" more visible and understandable

## Problem
The current header "My booking" button (see uploaded screenshot) blends into the transparent navigation bar. It looks like a plain text link with a faint border, so guests may not notice it or understand that it is where they return to upload receipts, check status, or update their stay.

## Goal
Make the entry point impossible to miss and self-explanatory, especially for less tech-savvy guests who need to upload payment receipts after booking.

## Proposed changes

### 1. Header button — desktop & mobile
- Add a clear icon (calendar/ticket) next to the label so the purpose is instantly recognizable.
- Switch from the current outline/frosted style to a solid, high-contrast pill that uses the primary action color, while keeping it on-brand.
- Keep the same position in the nav but increase visual weight so it competes with the "Book" / "WhatsApp" CTAs rather than disappearing.

### 2. Label copy
- Change "My booking" to an action phrase: "View / manage booking" (EN) / "Lihat / urus tempahan" (BM).
- This tells guests they can both check and edit their reservation, which directly addresses the receipt-upload problem.

### 3. Mobile header
- The mobile "My booking" text link is even smaller. Replace it with the same solid icon-button treatment so it is thumb-tappable and visible against the hero background.

### 4. Optional secondary entry point
- Add a subtle, non-intrusive "Already booked? Manage your reservation" link near the main booking CTA on the homepage. This catches guests who land on the site to upload a receipt rather than to make a new booking.

## Files to edit
- `src/routes/index.tsx` — header nav button styling, icon, copy, and mobile variant.
- `src/lib/i18n.tsx` — add localized labels for "View / manage booking".

## Out of scope
- No changes to the manage-booking page logic.
- No new routes or backend work.

## Verification
- Build passes.
- Preview shows the header button standing out on both desktop and mobile.
- Both English and Malay labels render correctly.
