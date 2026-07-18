Build an in-app CRM at `/admin/crm` that aggregates every past guest from `booking_requests`, lets admins edit bookings, add notes/tags, follow-up tasks, and send bulk email broadcasts.

## New database tables

1. **`crm_guests`** — one row per unique guest identity (matched by normalized email, fallback phone). Columns: `id`, `email`, `phone`, `full_name`, `total_bookings` (int, denormalized), `total_nights` (int), `total_spent` (numeric), `last_stay_at`, `first_seen_at`, `tags` (text[]), `notes` (text), `marketing_opt_in` (bool default true), `created_at`, `updated_at`.
2. **`crm_tasks`** — follow-up reminders. Columns: `id`, `guest_id` (fk crm_guests), `title`, `due_at`, `done` (bool), `created_by`, `created_at`.
3. **`crm_broadcasts`** — bulk email history. Columns: `id`, `subject`, `body_html`, `audience` (jsonb filter snapshot), `recipient_count`, `sent_at`, `sent_by`.

All tables: GRANTs to `authenticated` + `service_role`; RLS enabled; policies use `public.has_role(auth.uid(), 'admin')` (existing pattern via `isAdminRecipient` — reuse `admin_email_recipients` check inside a SECURITY DEFINER function `public.is_admin_email(uid)` for policies).

## Guest aggregation

Server function `rebuildCrmGuests()` iterates `booking_requests` grouped by `lower(guest_email)`, upserting into `crm_guests` with counts/sums. Runs on demand (button in CRM page) and after each new booking (add call inside existing booking submission flow in `src/lib/booking.functions.ts`).

## Server functions (`src/lib/crm.functions.ts`)

- `listGuests({ search, tag, sort, limit, offset })` — paginated, joins latest booking preview.
- `getGuest({ id })` — guest + full booking history + tasks.
- `updateGuest({ id, tags, notes, marketing_opt_in, full_name, phone })`.
- `editBooking({ id, check_in, check_out, cabin_id, num_rooms, adults, children })` — validates availability via existing `cabin_taken_dates`, updates `booking_requests`.
- `createTask` / `toggleTask` / `deleteTask`.
- `sendBroadcast({ subject, body, filter })` — resolves audience from `crm_guests` where `marketing_opt_in`, enqueues via existing `enqueue_email` per recipient using the transactional email pipeline; records in `crm_broadcasts`. Batched (max 200/run).
- `rebuildCrmGuests()` — full resync.

All wrapped with `requireSupabaseAuth` + admin check.

## New email template

`src/lib/email-templates/marketing-broadcast.tsx` — clean layout with unsubscribe link (reuses `email_unsubscribe_tokens`). Registered in `registry.ts`.

## UI

New route `src/routes/_authenticated/admin.crm.tsx`:

```text
┌ CRM ────────────────────────────────────────────┐
│ [Search email/name/phone]  [Tag ▾] [Sync]      │
│ ┌ Guests table ───────────────────────────────┐ │
│ │ Name │ Email │ Phone │ Stays │ Spent │ Last │ │
│ │ …    │       │       │ 3     │ 1,240 │ Aug… │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Selected → Broadcast (N)]                     │
└─────────────────────────────────────────────────┘
```

Guest drawer (click row) with tabs: **Profile** (tags/notes), **Bookings** (list + inline edit modal for date/room), **Tasks** (add/complete), **Timeline**.

Broadcast composer: subject + body (textarea, with `{{name}}` placeholder), audience filter (all opted-in / tag / selected), preview count, send.

Add "CRM" tab in `AdminTabs` (`src/routes/_authenticated/admin.tsx`) between Bookings and Calendar.

## Guardrails

- Editing a booking runs the same overlap check used by `cabin_taken_dates`; blocks conflicts.
- Broadcast respects `marketing_opt_in` + `suppressed_emails` (existing).
- Rate limit broadcast: max 1 per admin per 60s; per-recipient dedupe within 24h.

## Out of scope (later)

- WhatsApp broadcasts (needs Twilio/Meta connector — ask if wanted).
- Automated birthday/anniversary triggers.
- Import/export CSV of guests (already covered by existing bookings CSV).

## Rollout order

1. Migration for 3 tables + policies + `is_admin_email` helper.
2. `crm.functions.ts` + hook into booking submit for incremental upsert.
3. Route + tab.
4. Broadcast template + composer.
5. First `rebuildCrmGuests()` run to backfill from existing bookings.