## 1. Password field in Members tab

Add a **Password** input to the add/edit member form in `/admin/members`. When the admin saves, the backend creates (or updates) the Supabase auth user with that password using the Auth Admin API, so the member can sign in immediately on the `/auth` page with email + password — no invite email needed.

### What changes

**`src/lib/booking.functions.ts`** — extend `upsertAdminRecipient`:
- Accept an optional `password` field (min 8 chars) in the input validator.
- After upserting the row in `admin_email_recipients`, if `password` is provided:
  - Look up an existing auth user by email via `supabaseAdmin.auth.admin.listUsers` (paginated lookup by email).
  - If none, call `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`.
  - If one exists, call `supabaseAdmin.auth.admin.updateUserById(id, { password })`.
- Guard: only an existing admin (verified by `requireSupabaseAuth` + `is_active` check against `admin_email_recipients`) can call this. Keeps it from becoming a public account-creation endpoint.
- Load `supabaseAdmin` with `await import("@/integrations/supabase/client.server")` inside the handler.

**`src/routes/_authenticated/admin.members.tsx`** — UI:
- Add a `password` field to the editor state (only sent on save, never read back from the server).
- For a NEW member, the password input is shown with the label *"Initial password (min 8 chars)"*, required.
- For an EXISTING member, show a collapsed *"Reset password"* control: leave blank to keep current password, or type a new one to overwrite it.
- Show a small success toast/inline note after save: "Password set — member can now sign in with email + password."
- No password is ever displayed back; it's a write-only field.

Existing Google sign-in flow keeps working unchanged for the same emails.

### Security notes
- Password is sent to the server function only and never stored in the `admin_email_recipients` row — Supabase Auth owns it.
- Server function rejects callers who aren't already an active admin, so this can't be used to bootstrap the first account (the existing `claimAdminIfFirst` flow handles that).

---

## 2. "Lovable" branding on the Google consent screen

The "to continue to lovable.app" line on the Google popup comes from the **managed Google OAuth client** that Lovable Cloud provides by default. It's Google's screen, not ours — Google shows whichever app name + domain are registered against the OAuth client ID.

To remove it, you need to register **your own Google OAuth client** in Google Cloud Console (named e.g. "Rajawali D'Cabin Admin") and paste its Client ID + Secret into Lovable Cloud's Google auth settings. After that, the consent screen says *"to continue to Rajawali D'Cabin"* with your domain.

No code changes are needed for this — it's configuration only. I'll give you step-by-step instructions after you approve this plan:

1. In Google Cloud Console → APIs & Services → OAuth consent screen, configure the app name, support email, and authorized domains (`drajawalicabin.com`, `lovable.app`).
2. Create an OAuth Client ID (Web application) and add the redirect URL shown in Lovable Cloud's Google provider settings.
3. Paste the Client ID + Secret into Cloud → Users → Authentication Settings → Sign-in methods → Google.

Once saved, the next Google sign-in shows your branding instead of Lovable's.

---

## Out of scope
- No schema changes.
- No change to Google OAuth code paths.
- No email-based "send invite link" flow (you chose admin-sets-password).
