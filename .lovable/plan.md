# Mobile-first cleanup for phone users

Goal: every page should be instantly understandable on a phone — big taps, short words, key action visible without scrolling. Desktop stays as it is.

## What's wrong today (checked on a 390px phone screen)

- Home header: the logo, language toggle and the "View / manage booking" button collide — the button wraps onto three lines and overlaps the "Only 8 cabins" badge.
- Home page is very long on mobile (~8,600px of scrolling).
- Hero has four stacked things competing (headline, long paragraph, two CTAs, promo pill, "Already booked?" link) so the date picker sits below the fold.
- Long labels: "Already booked? Manage your reservation →", "Stay longer, save more — 10% off from your 2nd night onwards. Auto-applied.", "Check availability".
- Booking page: large empty top area, oversized "Room Booking." title, and two full months of calendar render before anything else — the guest scrolls a lot before choosing a room.
- Small 10–11px uppercase eyebrow labels used throughout; hard to read on a phone.

## Changes

### 1. Header (all pages)
- Mobile: compact logo, smaller language toggle, and a single icon + short-label pill "My booking".
- Fix the overlap: header becomes a proper two-column grid so nothing collides.
- Move the "Only 8 cabins" badge out of the header's overlap zone.

### 2. Home hero
- Trim the intro paragraph to one short line on mobile (full text stays on desktop).
- One primary button: "Check dates". Secondary links become small text.
- Promo pill shortened on mobile to "10% off 2nd night".
- Drop the separate "Already booked?" hero link on mobile (header button covers it); keep on desktop.
- Pull the date/guest search card higher so it's visible with minimal scrolling.

### 3. Home page length
- Tighter section padding on mobile, fewer cards per section with a "See all" link where trimmed, shorter section headings and body copy on mobile.

### 4. Booking flow
- Reduce top spacing and title size; show one month at a time on mobile with next/prev arrows.
- Larger date cells and tap targets.
- Compact step labels ("Dates", "Rooms", "Details") instead of "Step 1 — Stay details".
- Sticky bottom bar on mobile showing total plus one primary button for the current step.
- Form fields full-width single column, larger inputs, correct mobile keyboards.

### 5. Manage booking / find booking
- Bigger upload button, shorter next-step wording.
- Larger inputs and full-width primary buttons.

### 6. Gallery and booking guide
- Larger thumbnails in a simple grid, shorter captions, trimmed intro text.

### 7. Global mobile rules
- Minimum 44px tap height on every button and link-button.
- Base body text bumped up; eyebrow labels raised from 10px to a readable size.
- Consistent page padding and section spacing on mobile.
- Keep the bottom WhatsApp bar, add page bottom padding so it never covers content.

## Shorter labels (EN / BM)
- "View / manage booking" → "My booking" / "Tempahan saya"
- "Already booked? Manage your reservation" → "Manage booking" / "Urus tempahan"
- "Check availability" → "Check dates" / "Semak tarikh"
- "Stay longer, save more — 10% off from your 2nd night onwards. Auto-applied." → "10% off 2nd night" / "10% diskaun malam ke-2"
- "Step 1 — Stay details" → "Dates" / "Tarikh"

## Technical notes
- Presentation-only edits: `src/routes/index.tsx`, `src/routes/book.tsx`, `src/routes/manage-booking.tsx`, `src/routes/find-booking.tsx`, `src/routes/gallery.tsx`, `src/routes/booking-guide.tsx`, `src/routes/__root.tsx`, short-label strings in `src/lib/i18n.tsx`, spacing tokens in `src/styles.css`.
- Mobile-first classes with `sm:`/`md:` overrides restoring current desktop styling. No booking logic, pricing, or backend changes.
- Verification: 390px screenshots of every page before/after, plus a desktop pass to confirm nothing shifted.

## Out of scope
- Admin pages (already have a mobile card pass).
- Booking rules, pricing, emails.