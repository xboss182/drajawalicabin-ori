## Goal
Remove the need to click "Sync from bookings" — guest directory syncs automatically.

## Changes

1. **Auto-sync on CRM page load** (`src/routes/_authenticated/admin.crm.tsx`)
   - In the existing mount effect, call `syncGuestsFromBookings()` once before `load()`, so every visit to `/admin/crm` refreshes the directory silently.
   - Show a subtle "Syncing…" indicator instead of a button-driven toast.

2. **Auto-sync after new bookings** (`src/lib/booking.functions.ts`)
   - After a successful `createBooking` insert (both guest and admin manual paths), upsert the guest row into `crm_guests` inline (same logic as `syncGuestsFromBookings` but scoped to the one booking). This guarantees new guests appear immediately without waiting for an admin visit.

3. **Replace the manual button with a small "Refresh" icon** (optional safety net)
   - Keep the ability to force a resync, but demote it from a primary CTA to a discreet refresh icon next to the status text. Remove the "click Sync from bookings" empty-state hints.

## Technical notes
- The auto-sync on mount is idempotent (upsert on email), so repeated loads are safe.
- Inline upsert in `createBooking` avoids a second round-trip and keeps CRM live even if the admin never opens the CRM tab.
