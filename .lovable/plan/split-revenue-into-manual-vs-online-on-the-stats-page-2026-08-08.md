# Split revenue into Manual vs Online on the Stats page

Your two comments on `/admin/stats` ask for the Revenue column in the "Cabin type" table and in the Monthly/Yearly reports to be broken down by manual booking vs online purchase.

## What changes

Each of the three report tables (Cabin type, Monthly reports, Yearly reports) keeps its Revenue total and gains two extra columns next to it:

- **Manual** — revenue from bookings the admin added by hand in the admin dashboard
- **Online** — revenue from bookings guests made themselves on the website

The top summary boxes also get two new cards: Manual revenue and Online revenue, so the split is visible at a glance for the selected date range.

## How manual vs online is decided

Manual bookings created from the admin "Add manual booking" form are saved with the placeholder email `manual@admin.local`. Any booking row with that email counts as Manual; everything else counts as Online. Same rule everywhere, so the two columns always add up to the Revenue total.

## Technical notes

- `getBookingStats` in `src/lib/booking.functions.ts`: add `email` to both the filtered and unfiltered selects, then accumulate `revenueManual` / `revenueOnline` alongside `revenue` in the `byType`, `byMonth`, and `byYear` accumulators, plus top-level `manualRevenue` / `onlineRevenue`.
- `src/routes/_authenticated/admin.stats.tsx`: add the two headers/cells (right-aligned, `RM x.xx`) to all three tables, bump the empty-state `colSpan` values, and add the two summary cards.
- Both comment threads get resolved once the columns land.