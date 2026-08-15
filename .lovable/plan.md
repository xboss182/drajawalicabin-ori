# Owner Guide (chat + PDF)

Produce a plain-language guide to running the website, delivered two ways: written out in chat, and as a downloadable PDF. No website code or pages change.

## What the guide covers

1. Getting in — signing in at /auth, who can access admin, adding staff in Members.
2. Bookings tab — reading the list, statuses (pending payment, awaiting receipt, confirmed, cancelled), approving receipts, editing a booking, changing room, adding a manual booking.
3. Calendar — seeing occupancy, spotting full dates, blocking rooms.
4. CRM — by-date timeline, guests tab, editing guest info, opening a guest's bookings.
5. Stats — monthly and yearly reports, occupancy, pax, cabin-type table.
6. Discounts — automatic 2nd-night 10% rule, coupon codes, limits.
7. Promo CTA — turning the homepage promo line on/off, AI-generated wording.
8. Cabins & rates — weekday / weekend / school-holiday rates, current vs legacy rate toggle.
9. Holidays — importing dates with the approve-first review table, why school-break rate wins on overlaps.
10. Settings & invoices — property details, printing/sending an invoice, backup download.
11. Guest side, so you can help callers — booking flow, "My booking" page, uploading a receipt by email lookup.
12. Everyday routines — daily/weekly checklist, common problems and fixes (guest can't find booking, receipt missing, double booking, wrong price shown).

Tone: short sentences, no jargon, step-by-step with "click this, then this".

## Technical notes

- PDF built with a throwaway Python/ReportLab script in /tmp, output written to /mnt/documents (e.g. `Rajawali-DCabin-Owner-Guide.pdf`), then rendered to images and visually checked page by page before delivery.
- Uses a Unicode TTF so Malay accents render correctly; simple branded cover and section headings.
- No files under src/ are touched.
