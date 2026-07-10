## Plan: Replace notice banner with one-time toast

**Problem:** The green notice banner at the top overlaps the "Book" button and blocks interaction on smaller screens.

**Solution:** Show the "official website" disclaimer as a small sonner toast in the bottom-right on the first visit only. It won't block any content, auto-dismisses, and never shows again once dismissed.

### Changes

1. **`src/routes/__root.tsx`**
   - Remove the `OfficialNoticeFooter` (banner) render.

2. **New `src/components/official-notice-toast.tsx`**
   - Client component mounted once in `__root.tsx`.
   - On mount, check `localStorage.getItem("official-notice-dismissed")`.
   - If not set, call `toast(...)` from sonner with:
     - Title: "Official website"
     - Description: short version — "This is the only official site for Rajawali D'Cabin. We're not affiliated with OYO, Agoda, Booking.com or Expedia."
     - `duration: 10000`, action button "Got it" that sets the localStorage flag.
   - Also set the flag in `onDismiss` / `onAutoClose` so it never reappears.
   - Skip on admin routes (same rule as before).

3. **Optional cleanup**
   - Keep `official-notice-banner.tsx` file for now (unused) or delete it. Recommend delete to keep tree clean.

### Result
- Book button and hero fully visible on load.
- Guests still see the disclaimer once, then never again on that browser.
- No layout shift, no persistent bar.