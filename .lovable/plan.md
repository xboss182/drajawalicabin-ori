# Mixed cabin-type booking

Let a guest book several rooms of *different* cabin types (e.g. 1 Deluxe Queen + 1 Family Suite) in a single reservation, with one payment, one reference, and one confirmation email.

## UX on `/book`

Replace the single "Cabin type" + "Rooms (1–2)" controls with a **room cart**:

```text
┌─ Your rooms ────────────────────────────────────┐
│ • Deluxe Queen   [-] 1 [+]    RM 280/night  ✕   │
│ • Family Suite   [-] 1 [+]    RM 480/night  ✕   │
│ [+ Add another cabin type]                      │
└─────────────────────────────────────────────────┘
```

- Each line = a cabin type with a qty 1..(rooms available in that type).
- "Add another cabin type" shows a dropdown of remaining types not yet in the cart.
- Calendar shows blocked dates = any date where the cart can't be satisfied (free rooms in any selected type < requested qty for that type).
- Price preview sums across all cart lines (nights × type rate × qty + comforter × total rooms × nights).
- Guest/contact fields, comforter toggle, payment step are unchanged — comforter applies to all rooms.

Single-type bookings still work — the cart just has one line.

## Server changes (`src/lib/booking.functions.ts`)

`createBooking` input becomes:

```ts
items: Array<{ cabinType: string; numRooms: number }>  // replaces cabinId + numRooms
```

Handler logic:
1. For each item, resolve available cabins of that type for the date range (reusing `cabin_taken_dates`); if `available < numRooms` → throw "those dates were just taken".
2. Compute price per item via `compute_booking_price` against one cabin of that type × qty, sum totals.
3. Generate one `payment_reference` + one `booking_group_id` (uuid).
4. Insert **one `booking_requests` row per assigned cabin** (qty rows per item), all sharing `booking_group_id`, `payment_reference`, `guest_token`, contact fields, dates, hold expiry. Each row keeps its own `cabin_id`, its own room's `subtotal` / `comforter_total` / `total_amount`. `num_rooms` stays 1 on each row.
5. Return `{ bookingId: <first row id>, reference, total: <sum>, holdExpiresAt, guestToken, groupId }`.

`attachPaymentProof` / `attachBalanceProof`: look up by `payment_reference` and update **all rows in the group** in one statement (path + status). Confirmation email is sent once, summarising every room in the group.

`getBookingForGuest`: load all rows where `guest_token` matches; return an aggregate `{ reference, status, total, rooms: [{ roomType, cabinName, nights, subtotal, comforterTotal }] }`. Admin `listBookings` groups rows by `booking_group_id` so the dashboard shows one card per reservation with N rooms inside; confirm/reject act on the whole group.

## DB migration

```sql
ALTER TABLE public.booking_requests
  ADD COLUMN booking_group_id uuid;
CREATE INDEX ON public.booking_requests (booking_group_id);
-- backfill existing rows so each old booking is its own group
UPDATE public.booking_requests SET booking_group_id = id WHERE booking_group_id IS NULL;
ALTER TABLE public.booking_requests
  ALTER COLUMN booking_group_id SET NOT NULL,
  ALTER COLUMN booking_group_id SET DEFAULT gen_random_uuid();
```

`cabin_taken_dates` already handles per-cabin and per-type contention correctly — no SQL function change needed, because each room is now its own row with `num_rooms = 1`.

## Email

`renderBookingSummaryEmail` (in `src/lib/email.server.ts`) is updated to accept a `rooms[]` array and render a per-room breakdown plus the aggregate total. The pipeline (single enqueue per reservation via `email_outbox`) is unchanged.

## Out of scope

- Home page search bar — stays as today (date + guests + single cabin type / "Any cabin"); the cart only lives on `/book`. The home-page "room" param still pre-selects the first cart line.
- Admin per-room edits — admin still acts on the whole group.
- Raising the per-type cap above current inventory.

## Files touched

- `supabase/migrations/<new>.sql` — add `booking_group_id` + backfill.
- `src/lib/booking.functions.ts` — new `items[]` input, group-aware create/attach/get/list.
- `src/lib/email.server.ts` — multi-room summary template.
- `src/routes/book.tsx` — room cart UI, multi-type availability, aggregated price.
- `src/routes/manage-booking.tsx` + `src/routes/_authenticated/admin.tsx` — render the room list per reservation.
