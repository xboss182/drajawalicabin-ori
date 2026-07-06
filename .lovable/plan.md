# Sync bookings to local Excel via Power Query

Goal: give you a single URL that Excel's Power Query can refresh on demand to pull all bookings, mapped exactly to your column list.

## How it will work

1. Add a new secure public endpoint that returns booking data as **CSV** (Power Query's most reliable format).
2. Endpoint is protected by a **secret token** in the URL query string — only someone with the token can read the data.
3. In Excel: **Data → Get Data → From Web** → paste the URL. Power Query loads it as a refreshable table. Click **Refresh All** anytime to re-pull the latest data.

## Endpoint

- URL: `https://drajawalicabin.com/api/public/exports/bookings.csv?token=<SECRET>`
- Method: GET, returns `text/csv`
- Rows: one row **per cabin/room** within a booking group (so "Room No" and "Occupancy" make sense when a guest books multiple rooms)
- Optional filters: `?from=YYYY-MM-DD&to=YYYY-MM-DD` on check-in date

## Columns (in this exact order)

| Excel column          | Source                                                          |
|-----------------------|-----------------------------------------------------------------|
| Booking Ref           | `payment_reference` (e.g. RJW-1234)                             |
| Date Booking          | `created_at` (date only)                                        |
| Name                  | `guest_name`                                                    |
| IC                    | ⚠️ **not currently collected** — see below                      |
| Contact / Tel         | `phone`                                                         |
| Vehicle Model         | `vehicle_type`                                                  |
| Veh Reg No            | `vehicle_number`                                                |
| No of Pax             | `guests`                                                        |
| Deposit Status        | Paid / Unpaid (derived from status + `deposit_amount`)          |
| Total Payment Status  | Deposit only / Fully paid / Awaiting review / Pending           |
| No of Nite Stay       | `nights`                                                        |
| No of Rooms           | `num_rooms`                                                     |
| Room No               | Cabin name/number for that row (e.g. "1", "2")                  |
| Comforter No          | `comforter_total` ÷ (20 × nights) — count of comforters         |
| Occupancy (room×stay) | `num_rooms × nights`                                            |
| Date Check In         | `check_in`                                                      |
| Date Check Out        | `check_out`                                                     |
| Security Deposit      | `deposit_amount`                                                |
| Room Payment Amount   | `total_amount`                                                  |
| Remarks               | `notes`                                                         |
| Relation              | `relationship`                                                  |

## One decision needed from you

**IC (NRIC) is not captured anywhere today** — the booking form only collects name, email, phone, vehicle, etc. Two options:

- **A. Leave the IC column blank in the export** (ship now, no form changes).
- **B. Add an IC field to the booking form + admin edit screen** first, then include it in the export (bigger change, needs a DB migration + form UI update).

Tell me A or B and I'll build it.

## Excel side (once endpoint exists)

1. Excel → **Data → From Web** → paste the URL with token.
2. In the Power Query preview, click **Load**.
3. To refresh: **Data → Refresh All** (or right-click table → Refresh). Set auto-refresh interval under Query Properties if you want.

## Technical details

- New route: `src/routes/api/public/exports/bookings.csv.ts` (server route, public path so no auth wall).
- Auth: compare `?token=` against a new secret `BOOKINGS_EXPORT_TOKEN` (stored in Cloud). No token = 401.
- Uses `supabaseAdmin` (service role) inside the handler to read `booking_requests` joined with `cabins` for the room name.
- CSV built manually (no dep) with proper quoting so commas in `notes` don't break columns.
- One booking row expands to N rows when `num_rooms > 1`, so "Room No" column is meaningful.
