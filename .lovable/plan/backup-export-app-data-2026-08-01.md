# Backup / Export app data

## Background

Your app already runs on Supabase through Lovable Cloud — that database *is* your data. A "backup" means exporting a snapshot you can save offline and restore later. You already have one CSV export (bookings only, for Excel sync). This plan adds a proper full-data backup you can trigger from the admin dashboard.

## Recommended path (no code needed)

Lovable Cloud has a built-in export: **Cloud → Advanced settings → Export data**. This downloads a full snapshot of the entire database. Use this for one-off or periodic manual backups — it's the official, supported backup mechanism and requires nothing from me.

## What I'll build (convenience, in-app)

A **"Backup" button** on the admin dashboard that downloads all your key business tables as a single CSV bundle (one file per table) so you can keep an offline copy without leaving the app:

Tables to export:
- booking_requests (all bookings + payment/deposit/late-checkout fields)
- cabins (rooms, rates, capacity)
- crm_guests (guest directory)
- crm_tasks
- discounts + discount_redemptions
- school_holidays (events/rate periods)
- admin_email_recipients
- user_roles
- app_settings

### How it works
- New server route `src/routes/api/public/exports/backup.ts` (token-protected like the existing bookings CSV) that queries each table via `supabaseAdmin` and returns a multi-section CSV file (or individual CSVs joined into one download).
- A **"Download backup"** button added to the admin dashboard (`src/routes/_authenticated/admin.index.tsx`) next to the existing Excel sync UI. Clicking it fetches the token-protected URL and downloads the file.
- Filename stamped with today's date, e.g. `rajawali-backup-2026-08-01.csv`.

### Notes
- This is a **data-only** snapshot (rows), not a schema dump. Restoring would be a manual import. For full schema + data restore, use the Cloud → Export data path above.
- Excludes auth.users and internal email-queue plumbing — those are managed by Lovable Cloud and not exportable via this route.
- Read-only; no risk to live data.

## Alternatives considered
- **Scheduled automated backups**: Possible (a nightly server route writing to storage), but adds complexity. Recommend starting with the manual button + Cloud export, and adding scheduling later if you want it.
- **Sync to a separate external Supabase project**: Not recommended — your data already lives in a managed Supabase; a second project just doubles maintenance. Cloud export covers backup needs.
