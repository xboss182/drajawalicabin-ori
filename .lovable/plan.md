# Email Notification Workflow

## Current architecture

```text
Guest action / Admin action
        │
        ▼
┌─────────────────────────────┐
│  Server function / API route  │
│  (booking.functions.ts,       │
│   crm.functions.ts, webhook)  │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  sendTransactionalEmail()   │
│  src/lib/email/send.server.ts │
│  - picks React Email template │
│  - checks suppression list    │
│  - creates unsubscribe token│
│  - renders HTML + plain text  │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  email_send_log (pending)   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  pgmq.enqueue_email()       │
│  queue: transactional_emails│
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  pg_cron → every 5 sec      │
│  POST /lovable/email/queue/process
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  process.ts                 │
│  - reads batch from pgmq      │
│  - sends via @lovable.dev/email-js
│  - updates email_send_log     │
│    (sent / failed / dlq)    │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Mailgun / Lovable Email API│
│  From: noreply@drajawalicabin.com
│  Sender domain: notify.drajawalicabin.com
└─────────────────────────────┘
```

## Triggers today

| Event | Template | Recipients |
|-------|----------|------------|
| New booking created | `booking-summary` | Guest + admin alert (`admin-booking-alert`) |
| Payment proof uploaded | `booking-summary` | Guest confirmation + admin alert |
| Booking fully paid | `fully-paid` | Guest with locker code |
| Balance due (7 days before check-in) | `balance-reminder` | Guest with payment link |
| Manage-link requested | `manage-link` | Guest |
| Marketing/broadcast (CRM) | `marketing-broadcast` | Selected guest list |

## Legacy path

`src/lib/email.server.ts` still writes to `email_outbox` for any code not yet migrated to `sendTransactionalEmail`. No active booking flow uses it today; it is a fallback only.

## Domain health

- Domain: `notify.drajawalicabin.com` ✅ Verified
- Queue: healthy, 28 emails sent in the last 7 days
- DNS delegated to Lovable nameservers

## Proposed next step: Admin Email Dashboard

Build a protected `/admin/emails` page so you can monitor delivery without asking me to query the database.

### Features

1. Time range filter: Last 24h / 7 days / 30 days / custom
2. Template filter: all distinct `template_name` values
3. Status filter: All / Sent / Failed (dlq) / Suppressed
4. Summary cards: total unique emails, sent, failed, suppressed (deduplicated by `message_id`)
5. Email log table: one row per unique email, sorted by latest timestamp, paginated
6. Error preview for failed emails

### Technical details

- Reuse `_authenticated/admin.tsx` layout; add an "Emails" tab in the admin nav.
- Create `src/lib/email.functions.ts` with `getEmailStats` and `getEmailLog` server functions.
- Use `DISTINCT ON (message_id) ... ORDER BY message_id, created_at DESC` for deduplication.
- Query `email_send_log` directly; no new tables needed.
- Route: `src/routes/_authenticated/admin.emails.tsx`.

## Open question

Do you want me to build the admin email dashboard now, or do you only need the workflow documentation above?