## Room rename + inventory change

### New lineup

| DB row (current name) | New name | Type | Capacity |
|---|---|---|---|
| Deluxe Queen 1 | Room 1 — Queen room | Queen | 2 |
| Deluxe Twin 1 | Room 2 — Twin room | Twin | 2 |
| Deluxe Queen 2 | Room 3 — Queen room | Queen | 2 |
| Deluxe Twin 2 | Room 4 — Twin room | Twin | 2 |
| Triple Suite 1 | Room 5 — Triple room | Triple | 3 |
| Family Suite 1 | Room 6 — Family room | Family | 4 |
| Family Suite 2 | Room 7 — Family room | Family | 4 |
| **Triple Suite 2** | **Room 8 — Family room** | **Family** (converted) | **4** |

Existing bookings on Triple Suite 2 stay attached to the same row, now labeled Room 8 Family.

### Open question — Room 8 rates

Triple Suite 2's current rates are RM132 / 143 / 165 (weekday / weekend / school holiday). The other Family rooms are RM165 / 176 / 198. Which rates should Room 8 use? I'll default to **matching Family Suite 1 & 2 (RM165 / 176 / 198)** unless you say otherwise.

### Changes

1. **Migration** — rename the 8 cabin rows and convert Triple Suite 2:
   - `UPDATE cabins SET name = 'Room 1 — Queen room' WHERE name = 'Deluxe Queen 1'` (and so on for all 8)
   - For the ex-Triple: also `cabin_type = 'Family'`, `capacity = 4`, and update rates as above

2. **`booking_requests.room_type`** — this text column stores the room type at booking time. Backfill Triple Suite 2's past bookings from `Triple` → `Family` so admin lists and invoices show the right label. (Historical totals stay untouched.)

3. **Frontend copy sync** — search for any hard-coded references to the old names and update:
   - `src/lib/i18n.tsx` — any room labels
   - `src/routes/book.tsx`, `manage-booking.tsx`, `checkout.tsx`, `admin.*.tsx`, `admin.invoice.$id.tsx`
   - Email templates in `src/lib/email-templates/*` and `src/lib/email.server.ts`
   - `public/llms.txt`, `src/routes/index.tsx` FAQ/JSON-LD
   - Anywhere the strings "Deluxe Queen", "Deluxe Twin", "Triple Suite", "Family Suite" appear

   Wherever a room name is rendered from the DB, no code change is needed — the new name flows through automatically.

4. **Type dropdown / capacity filters** — if any UI filters by `cabin_type = 'Triple'`, verify it still makes sense with only one Triple room, and that Family filter now includes Room 8.

Please confirm:
- **Rates for Room 8** (match other Family rooms at 165/176/198, or keep Triple rates 132/143/165, or custom?)
- **Label format** — "Room 1 — Queen room" (em dash) everywhere?
