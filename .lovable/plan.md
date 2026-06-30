## Goal
Lock admin access to **xboss182@gmail.com only** for now, keep Google + email/password sign-in for the 3 allowlisted emails, and move admin-recipient management to a dedicated **/admin/members** page.

## 1. Database — activate only xboss182
Run an UPDATE on `admin_email_recipients`:
- `xboss182@gmail.com` → `is_active = true` (already)
- `salikin1305@gmail.com` → `is_active = false`
- `awang.mfauzi@gmail.com` → `is_active = false` (already)

Result: only xboss182 can pass the admin gate. The other two rows stay in the table so you can re-activate them with one click from /admin/members later.

## 2. Auth — confirmation, no code changes
Current behavior is already correct, just confirming:
- **Sign-in methods on `/auth`**: email+password and Google (both already wired).
- **Gate**: `isAdminRecipient` server fn checks `admin_email_recipients` where `email = auth.user.email AND is_active = true`. `/admin/*` `beforeLoad` redirects non-matches to `/auth?denied=1`.
- **Google**: any Google account can attempt sign-in, but only allowlisted+active emails reach `/admin`. Others get "Access denied" and are signed out.
- **Email/password**: the 3 emails can sign in once they have an account. First-time setup → use "Forgot password" on `/auth` (sends magic link/reset) **or** sign in with Google using the same Gmail address — Google creates the auth user automatically.

No edits to `auth.tsx` or the gate logic.

## 3. New page — `/admin/members`
Create `src/routes/_authenticated/admin.members.tsx` with full CRUD on `admin_email_recipients`:

- Table of all recipients: email, label, active toggle, notification flags (new_booking / payment_proof / fully_paid), edit, delete.
- "Add member" form (email + label + flags + active).
- Inline **Activate / Deactivate** toggle so flipping access is one click.
- Uses existing server fns `listAdminRecipients`, `upsertAdminRecipient`, `deleteAdminRecipient` (no new server code needed).
- Helper note at top: "Only **active** members can access the admin. Members sign in via Google or email/password on `/auth`."

Add **Members** tab to `AdminTabs` in `admin.tsx` (between Settings and the rest).

## 4. Clean up settings page
Remove the recipients section from `admin.settings.tsx` (now lives in `/admin/members`). Keep the app-settings form (deposit amount, balance due days).

## 5. Validation pass
After the migration, verify in DB:
- `SELECT email, is_active FROM admin_email_recipients` → only xboss182 active.
- `isAdminRecipient` returns `true` only for xboss182.
- `/admin` is reachable for xboss182, blocked for the other two until reactivated.

## Files
- migration: UPDATE `admin_email_recipients` (deactivate salikin1305)
- create: `src/routes/_authenticated/admin.members.tsx`
- edit: `src/routes/_authenticated/admin.tsx` (add Members tab)
- edit: `src/routes/_authenticated/admin.settings.tsx` (drop recipients section)
