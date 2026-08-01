# Two rate sets: current (+RM10) and legacy, toggleable

Keep the existing prices as a "Legacy" set, add a "Current" set that is RM10 higher per room per night, and let you switch between them from the admin Cabins page at any time. Switching affects all new price calculations immediately; existing bookings keep the prices they were confirmed at.

## What you get

- Each cabin stores two sets of rates: legacy (today's RM 80/90/100 etc.) and current (+RM10 on each of weekday, weekend, holiday).
- A single switch at the top of Cabins & rates: "Rate set: Current / Legacy".
- The rates table shows both sets side by side, with the active one highlighted, and both are editable.
- Booking page, price preview, admin manual booking, and invoices all read the active set.
- Existing bookings are untouched — they already store their own amounts.

## Layout of the Cabins table

```text
Name            Type    Cap.  | CURRENT (active)          | LEGACY
                              | Wkday  Wkend  Holiday     | Wkday  Wkend  Holiday
Queen room 1    Queen   2     | 90     100    110         | 80     90     100
Family room 6   Family  4     | 160    170    190         | 150    160    180
```

## Technical notes

- Migration: add `legacy_weekday_rate`, `legacy_weekend_rate`, `legacy_school_holiday_rate` to `public.cabins`; backfill them from the current columns (so today's prices become the legacy set), then set the live columns to +10 each. Grants/RLS on `cabins` are unchanged.
- Active set stored in `app_settings` under key `active_rate_set` with value `"current"` or `"legacy"` (default `current`). Extend `getAppSettings` / `updateAppSettings` to carry it.
- `buildNightBreakdown` in `src/lib/booking-helpers.server.ts` selects the column trio based on `active_rate_set`, so all server-side pricing (preview, create booking, invoice, admin manual booking) follows the switch with no other call-site changes.
- `upsertCabin` and `listCabinsAdmin` in `src/lib/booking.functions.ts` extended for the three legacy fields; `src/routes/_authenticated/admin.cabins.tsx` gets the toggle plus legacy inputs in the edit form.
