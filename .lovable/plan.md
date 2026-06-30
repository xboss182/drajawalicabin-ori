Several related changes across the header menu, auth, manage-booking flow, and the book page.

## 1. Header "more" menu icon

- Replace the vertical 3-dot (`MoreHorizontal`) trigger in the homepage header with a 3-line hamburger (`Menu` from lucide-react), keeping the same Popover behavior, placement, and styling.
- Remove the "Admin" entry from this menu. Only keep public/customer-facing links (Find Booking, Manage Booking). Owners reach `/admin` directly by URL or via `/auth`.

## 2. Auth page — remove sign-up

- In `src/routes/auth.tsx`, remove the sign-in/sign-up mode toggle. Page only supports sign-in (email + password). Drop the "Need an account? Create one" link and all `signUp` code paths.
- Keep `claimAdminIfFirst` call after successful sign-in (harmless if no longer first).

## 3. Restrict admin access to allowlisted recipients

- Admin access is gated by whether the signed-in user's email is in `admin_email_recipients` (the same recipient list managed in Settings).
- Add a server function `isAdminRecipient` (in `src/lib/booking.functions.ts`) using `requireSupabaseAuth`: looks up the caller's email in `admin_email_recipients` and returns boolean. (Uses service-role client inside the handler to bypass RLS for the lookup; only returns boolean.)
- Update `src/routes/_authenticated/route.tsx` (or the admin layout `src/routes/_authenticated/admin.tsx`) to also call `isAdminRecipient` in `beforeLoad` and `throw redirect({ to: "/auth" })` if false. This means a signed-in user who isn't an allowlisted recipient cannot view admin pages.
- Google sign-in: enable managed Google OAuth (via `configure_social_auth`) and add a "Sign in with Google" button on `/auth`. Same allowlist gate applies — non-recipient Google users land on `/auth` with an "Access denied" message.
- Show an "Access denied — your email is not on the admin recipient list" message on `/auth` when redirected back from a failed admin check.

## 4. Manage booking by email + reference

- Today `/manage-booking` requires `id` + `token` from the email link. Add a fallback: when `id`/`token` are missing, render a form asking for email + booking reference (RJW-####).
- On submit, call a new server function `getBookingByEmailAndReference({ email, reference })` that looks up the booking in `booking_requests` and returns the same shape as `getBookingForGuest`. Apply the same rate-limiting pattern used by `requestManageLink` (reuse `manage_link_requests` table or a similar IP/email throttle) to prevent enumeration.
- On success, hydrate the page state directly (no need to email a link). Subsequent actions (balance proof upload) continue to use the existing guest token returned by the lookup, so server-side authorization is unchanged.
- Keep the existing `/find-booking` page as-is; link to it from the new inline form for users who'd rather receive the link by email.

## 5. Book page "Recommended for your party" layout

- In `src/routes/book.tsx`, change the "Recommended for your party" recommendations from a 3-column grid to a vertical stack of full-width row cards.
- Each row: image on the left (fixed aspect), details (name, capacity, price, CTA) on the right, stacked on mobile.
- No business-logic changes — only the recommendation card layout.

## Technical notes

- New files: none required; reuse existing components.
- Edited files:
  - `src/routes/index.tsx` — swap icon, drop Admin link.
  - `src/routes/auth.tsx` — remove signup mode, add Google sign-in button, show access-denied banner.
  - `src/routes/_authenticated/admin.tsx` (or `_authenticated/route.tsx`) — add recipient-allowlist gate.
  - `src/lib/booking.functions.ts` — add `isAdminRecipient`, `getBookingByEmailAndReference`.
  - `src/routes/manage-booking.tsx` — render lookup form when `id`/`token` missing, wire to new server function.
  - `src/routes/book.tsx` — row-style recommendation cards.
- Backend: `configure_social_auth` to enable Google. No schema changes (recipients already in `admin_email_recipients`).
