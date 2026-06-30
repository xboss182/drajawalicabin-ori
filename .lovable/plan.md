## Plan: Publish site and verify Google sign-in → /admin

### 1. Preflight checks
- Confirm site metadata (title, meta description, OG/Twitter tags, favicon) on `/` and key routes is real and not placeholder. Update root `__root.tsx` head if anything is stale.
- Run a security scan (`security--run_security_scan`) and confirm no unresolved critical findings before publishing.

### 2. Publish
- Call `preview_ui--publish` with the website-info preflight summary.
- Site will deploy to the Lovable URL and to the connected custom domains: `https://drajawalicabin.com` and `https://www.drajawalicabin.com` (already connected per project URLs).
- Tell the user publishing is scheduled and live in ~1 minute (longer for custom domain).

### 3. Verify Google sign-in on the live domain
After the deploy goes live, drive Playwright against `https://drajawalicabin.com/auth`:
- Click "Continue with Google".
- Because Google OAuth requires a real user consent and the sandbox cannot complete the Google account picker for `xboss182@gmail.com` without that user's credentials, **automated end-to-end Google login is not possible from my side**. I can only verify:
  - the `/auth` page loads on the live domain,
  - the Google button initiates the OAuth redirect to `accounts.google.com` correctly (no `postMessage` / origin / redirect_uri errors),
  - and that the admin gate logic (`isAdminRecipient`) returns true for `xboss182@gmail.com` (already validated in DB: row exists, `is_active=true`).

The actual `/admin` load after Google consent must be confirmed by you signing in on `https://drajawalicabin.com/auth` in your own browser. If it fails, paste the console/network error and I'll diagnose.

### 4. Reporting
- Share the live URL and a screenshot of `/auth` on the published domain.
- Confirm the DB state for the admin recipient.
- Ask you to complete the Google sign-in and report back whether `/admin` loads.

### Why I can't fully automate step 3
Google's OAuth consent screen blocks headless/automated logins on accounts with 2FA or unusual-device protection, and I don't have (and won't ask for) your Google password. The previous `postMessage` warning you saw is a preview-iframe artifact and will not appear on the live domain — that's the main reason to test there.
