## Findings

Inventory: 8 active cabins — Queen 1, Queen 3, Twin 2, Twin 4, Triple 5, Family 6, Family 7, Family 8.

### Night of Jul 31 → Aug 1
All 8 rooms are covered by confirmed bookings → **fully booked**. But two rooms are double-assigned:

| Cabin | Guest A | Guest B |
|---|---|---|
| Queen room 1 | Noor Tuah Jaafar (Jul 8 → Aug 13) | Elin Norezatie (Jul 31 → Aug 2) |
| Twin room 2 | Asmir Abu Bakar (Jul 31 → Aug 2) | Noor Faridah Abdullah (Jul 31 → Aug 2) |

### Night of Aug 1 → Aug 2
7 rooms confirmed. **Queen room 3 is available** — azliyana's Jul 31 → Aug 1 hold is `pending_payment` and expired on 2026-07-18 10:32, and it was only 1 night so it never covered Aug 1 anyway. Public site should still allow a Queen booking for that night.

## Proposed actions (need owner decision per item)

1. **Queen room 1 conflict** — owner confirms which guest keeps Queen 1; reassign the other to a free room *of the same type* on those dates, or contact them to reschedule/refund. Currently no other Queen is free on Jul 31.
2. **Twin room 2 conflict** — same call for Asmir vs Noor Faridah. Twin 4 is taken by Asmir already; no Twin free on Jul 31.
3. **Aug 1 status** — confirm whether the owner intended to block Aug 1 entirely (e.g. owner-hold) or leave Queen 3 bookable. If it should be blocked, we add an admin-side manual block for Queen 3 on the Aug 1 night.
4. **Prevent recurrence** — the current `cabin_taken_dates` RPC and price/availability check don't hard-reject a second confirmed booking on the same cabin/date. Add a server-side guard before insert/confirm that rejects if an overlapping booking already exists on that cabin_id (excluding the same booking_group_id), and add a matching Postgres exclusion constraint or unique index to make double-booking impossible at the DB level.

## What I need from you before implementing

- For each double-booking above: which guest keeps the room?
- For Aug 1 night: block Queen 3 or leave it open?
- Approve step 4 (DB-level double-booking guard).
