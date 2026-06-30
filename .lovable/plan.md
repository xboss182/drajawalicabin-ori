## Admin dashboard backend expansion

All new surfaces live under `/admin/*` (TanStack `_authenticated/admin.*.tsx`), gated by existing `has_role('admin')`. Top tab bar on the existing admin page: **Bookings · Invoices · Calendar · Cabins · Holidays · Stats · Settings**.

### 1. Invoice viewer (per booking, 2‑step payment)

The current schema already models a 2‑step payment:
- `deposit_amount` (the RM 50 booking deposit) + first proof → status `awaiting_review` → admin **Confirm payment** → `confirmed`.
- Balance proof → `balance_paid_at` → admin **Mark fully paid + set locker code** → `fully_paid`.

New `/admin/invoice/$id` route renders a printable invoice for a booking group:
- Header: logo, reference, status badge, issue date.
- Guest block: name, email, phone.
- Stay block: check‑in/out, nights, guests, comforter.
- Rooms table: each row from the group (cabin name, nights, subtotal, comforter portion, line total).
- Payment schedule table:
  1. Booking deposit — RM 50 (or `deposit_amount`) — paid date from `created_at` of the deposit proof, status badge, link to deposit proof file.
  2. Balance — `total − deposit` — due date = check‑in − N days (admin‑editable, see Settings), paid date = `balance_paid_at`, status, link to balance proof file.
- Totals + "Locker code: …" once `fully_paid`.
- Buttons: **Print**, **Download PDF** (browser print‑to‑PDF, no new lib), **Open in new tab**, **Resend confirmation email**.

A "View invoice" link is added on every admin booking card.

New server fn `getInvoice({ bookingId })` (admin‑only) returns the aggregated group + both proof signed URLs + schedule fields. Re‑uses `listBookings` aggregation logic.

### 2. Balance due‑date scheduling

Add `balance_due_at TIMESTAMPTZ` column to `booking_requests` (migration). On `confirmBooking`, default it to `check_in − settings.balance_due_days_before`. Admin can edit it from the invoice view:

- New server fn `setBalanceDueAt({ bookingId, dueAt })` updates every row in the group.
- The existing `send-balance-reminders` cron route already exists at `src/routes/api/public/hooks/send-balance-reminders.ts` — it will switch from "computed offset" to reading `balance_due_at` directly.

### 3. Live calendar occupancy

New route `/admin/calendar`. Month view (prev/next month controls). Each day cell shows, per cabin type:
- `booked X / Y` (occupied / total active cabins of that type), where occupied = any active group with `check_in ≤ day < check_out`.
- Color: green (0%), amber (partial), red (full).
- Click a day → side panel lists each booking on that day (reference, guest, cabin, status, link to invoice).

New server fn `getOccupancy({ from, to })` (admin‑only): runs a single SQL aggregating `booking_requests` joined to `cabins`, returning `[{ date, byType: { typeName: { booked, total, bookings: [...] } } }]`. Uses statuses `confirmed`, `fully_paid`, `awaiting_review`, and live `pending_payment` (hold not expired) — matches `cabin_taken_dates` semantics so the UI matches what guests see blocked.

A small legend explains the colors and includes "Fully paid" markers (a filled dot) so the owner can scan which booked dates are already paid in full vs still awaiting balance.

### 4. Admin email recipients (multi‑recipient, editable)

Today `src/lib/config.server.ts` reads owner address from env. Replace with a DB‑backed list editable from admin.

New table `public.admin_email_recipients`:
- `email TEXT NOT NULL UNIQUE`
- `label TEXT` (e.g. "Owner", "Front desk")
- `notify_new_booking BOOLEAN DEFAULT true`
- `notify_payment_proof BOOLEAN DEFAULT true`
- `notify_fully_paid BOOLEAN DEFAULT true`
- `is_active BOOLEAN DEFAULT true`
- timestamps

RLS: only `has_role(auth.uid(),'admin')` can SELECT/INSERT/UPDATE/DELETE; service_role full access.

New `/admin/settings` route with two cards:
- **Notification recipients** — table with inline add/edit/delete, per‑event checkboxes.
- **Payment settings** — `deposit_amount_default` (RM 50), `balance_due_days_before` (default 7). Stored in a `public.app_settings` single‑row table or as rows in a key/value table.

Server fns: `listAdminRecipients`, `upsertAdminRecipient`, `deleteAdminRecipient`, `getAppSettings`, `updateAppSettings` — all admin‑gated.

`src/lib/email.server.ts` updated: when sending any admin notification (new booking, proof uploaded, fully paid), it queries active recipients filtered by the matching `notify_*` flag and enqueues one email per recipient (idempotency key includes recipient email).

### 5. Cabin & rate management

`/admin/cabins`. Editable: `name`, `cabin_type`, `capacity`, `weekday_rate`, `weekend_rate`, `school_holiday_rate`, `is_active`. Soft‑disable via `is_active` to preserve history. Server fns: `listCabinsAdmin`, `upsertCabin`, `setCabinActive`.

### 6. School holidays manager

`/admin/holidays`. CRUD over `school_holidays`. Server fns: `listHolidays`, `upsertHoliday`, `deleteHoliday`. Validates `ends_on ≥ starts_on`. `compute_booking_price` already reads this table.

### 7. Stats & email‑log dashboard

`/admin/stats`. Two sections.

**Bookings stats** (date range, default last 30 days):
- Cards: total reservations, confirmed revenue, deposit‑only revenue, nights sold, occupancy %.
- Per‑cabin‑type table.

**Email delivery** (rules from the email dashboard guide):
- Filters: time range (24h/7d/30d/custom), template name, status.
- Stat cards: unique emails, sent, failed, suppressed — counted with `DISTINCT ON (message_id)`.
- Paginated table (50/page).

Server fns: `getBookingStats`, `listEmailLog`.

### Migrations (single file)

```text
1. ALTER booking_requests ADD COLUMN balance_due_at timestamptz;
2. CREATE TABLE admin_email_recipients (...);
   GRANTs to authenticated + service_role; RLS + has_role('admin') policies.
3. CREATE TABLE app_settings (key text pk, value jsonb, updated_at);
   GRANTs + admin-only RLS. Seed { deposit_amount_default: 50, balance_due_days_before: 7 }.
4. Backfill balance_due_at on existing confirmed/fully_paid rows using check_in − 7 days.
```

No changes to `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

### Files touched

- `supabase/migrations/<new>.sql` — schema above.
- `src/lib/booking.functions.ts` — `getInvoice`, `setBalanceDueAt`, `getOccupancy`, `listAdminRecipients`, `upsertAdminRecipient`, `deleteAdminRecipient`, `getAppSettings`, `updateAppSettings`, `listCabinsAdmin`, `upsertCabin`, `setCabinActive`, `listHolidays`, `upsertHoliday`, `deleteHoliday`, `getBookingStats`, `listEmailLog`.
- `src/lib/email.server.ts` — admin notifications fan out to active recipients per event flag.
- `src/lib/config.server.ts` — owner email source becomes the new table (env kept as fallback seed).
- `src/routes/api/public/hooks/send-balance-reminders.ts` — read `balance_due_at`.
- `src/routes/_authenticated/admin.tsx` — top tab bar + "View invoice" link per card.
- New routes: `admin.invoice.$id.tsx`, `admin.calendar.tsx`, `admin.cabins.tsx`, `admin.holidays.tsx`, `admin.stats.tsx`, `admin.settings.tsx`.
