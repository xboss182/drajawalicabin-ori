# WhatsApp Store — cart-to-WhatsApp enquiry

A new public page `/whatsapp-store` where guests pick dates on a calendar (with unavailable
dates blocked out), add cabins/items to a cart, then send one neatly formatted order message
to WhatsApp **+60 10-332 8747**. No online payment — the owner replies and confirms in chat.

## What the guest sees

1. **Pick dates** — a check-in/check-out range calendar. Dates where the whole property is
   sold out are shown in red and cannot be selected; past dates disabled.
2. **Browse the store** — cards for each cabin type (name, photo, capacity, live rate for the
   selected dates) plus add-on items. Each card has − / + quantity buttons.
3. **Cart panel** — running list of chosen items, nights, and an estimated total in RM.
4. **Order on WhatsApp** — one button that opens WhatsApp with a pre-filled message:

```text
Hi Rajawali D'Cabin, I'd like to book:
Check-in: 12 Aug 2026 (3:00 PM)
Check-out: 14 Aug 2026 (12:00 PM) — 2 nights
Guests: 4 adults, 2 children

- Twin room x 2 — RM 360
- Queen room x 1 — RM 200
- BBQ pit set x 1

Estimated total: RM 560
Name: (guest fills in)
```

Message is generated in English or Malay to match the site language toggle.

## Availability / blocked dates

- Reuses the existing public availability endpoint (`/api/public/availability/taken-dates`)
  the booking page already uses, so blocked dates stay consistent with real bookings.
- Per-cabin-type availability: if a type is sold out for the chosen range, its card shows
  "Fully booked" and cannot be added.
- Whole-property sold-out dates are marked red in the calendar with a "No vacancy" note,
  same behaviour as `/book`.

## Pricing

- Rates come from the existing price preview (weekday / weekend / holiday, respecting the
  Current vs Legacy rate-set toggle), so the store never shows a stale price.
- The multi-night 10% discount line is shown as "estimated" only — final total is confirmed
  by the owner in WhatsApp.
- Add-ons are flat-priced items managed in admin (see below).

## Admin

New **Store** tab in `/admin`:
- Add / edit / disable store items (name EN + BM, price, optional image, in-stock toggle).
- Set the destination WhatsApp number (defaults to +60 10-332 8747).
- Toggle the whole store on/off and its link in the site nav.

Requires one new database table for store items (name, price, sort order, active flag,
image path) with public read access and admin-only writes.

## Entry points

- Nav link "WhatsApp Store" in the header and mobile menu.
- A card on the homepage next to the gallery preview.
- Sitemap + page metadata (title, description, og tags) for search visibility.

## Technical notes

- New route `src/routes/whatsapp-store.tsx`; cart state is local (no DB writes, no account
  needed). Nothing is reserved until the owner confirms — the page says this clearly so it
  never conflicts with real `/book` reservations.
- Deep link format `https://wa.me/60103328747?text=<encoded>` — works on mobile and web,
  no Twilio, no API cost.
- Reuses `previewPrice` and the taken-dates API route rather than new server functions.
- Migration adds `public.store_items` with GRANTs, RLS (anon read active rows, admin write).
