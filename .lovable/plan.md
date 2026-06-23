# Homepage Layout & Density Refinement

Scope: `src/routes/index.tsx` only (presentation). No copy or business logic changes.

## 1. Hero — reclaim screen space
- Drop hero from `min-h-[100svh]` to `min-h-[78svh] lg:min-h-[82svh]`.
- Reduce top/bottom padding (`pt-32 pb-32` → `pt-28 pb-40`) so the search panel overlap feels intentional.
- Shrink headline scale one step (`text-5xl sm:text-6xl lg:text-7xl` → `text-4xl sm:text-5xl lg:text-6xl`) and tighten body copy max-width.
- Add a compact inline "quick facts" row directly under the CTAs (8 cabins · Riverside · Kuala Ibai · WhatsApp booking) so key info lands above the fold.

## 2. Booking surfaced earlier
- Keep `AvailabilitySearch` overlapping the hero (`-mt-20`) but make it visually denser: smaller field padding (`py-3.5`), tighter label sizing, sticky submit on mobile.
- Move the "We'll take your details…" note into the form footer row (inline, muted) instead of a standalone paragraph block — removes a whole spacing band.
- Add a small "From RM xxx / night · 8 cabins available" hint strip above the form on desktop to set pricing expectations early.

## 3. Section rhythm — cut vertical bloat
Standardize section padding to `py-20 lg:py-24` (down from `py-28 lg:py-36`). Apply to About, Accommodation, WhyStay, Nearby.

## 4. About — better flow into cabins
- Compress to a tighter 2-col grid with `gap-12` (was `gap-16`).
- Move the floating "8 cabins" badge into the copy column as an inline stat block so mobile doesn't get a hidden element.
- Add a thin divider/CTA row at the bottom ("Explore the cabins ↓") to bridge into the Accommodation section.

## 5. Accommodation — stronger hierarchy & density
- Change card aspect from `4/5` to `4/3` so 4 cards fit more compactly.
- Each card gets a clear price line (`From RM xxx / night`) and sleeps badge at top — pricing visible without clicking.
- Replace bullet list with a 2-column micro-grid of amenities (denser, scannable).
- Per-card "Book this cabin" button (primary style) instead of a text link — CTA always visible.
- Section header collapses to a single row on desktop (eyebrow + title left, intro right) with reduced bottom margin (`mb-10`).

## 6. Why Stay — tighten
- Reduce title bottom margin (`mb-16` → `mb-10`).
- Switch to 3-col on `md:` (currently 2-col until `lg`) so the section is shorter on tablets.

## 7. Nearby — align with rest
- Card aspect `4/5` → `3/4`, gap `gap-6` → `gap-5`.
- Move the "also nearby" line into the header intro so the bottom isn't a stranded paragraph.

## 8. Sticky mobile CTA bar
Add a fixed bottom bar on `<md` screens with two actions: **Check Availability** (scrolls to `#book`) and **WhatsApp**. Hidden on desktop. Ensures booking CTAs are always reachable on mobile.

## 9. Consistent alignment & spacing tokens
- Standardize section container to `mx-auto max-w-7xl px-6 lg:px-10`.
- Standardize eyebrow → title → body gaps: `mb-3`, `mb-8`, `mt-5`.
- Standardize card radius to `rounded-lg` across cabins/nearby for cohesion.

## 10. Mobile polish
- Hero CTA row stacks cleanly with `gap-3`.
- Search form already responsive; ensure submit button spans full width on mobile (`md:w-auto w-full`).
- Apply `min-w-0` / `truncate` patterns to nav and card headings to prevent overflow.

## Out of scope
- Copy/i18n strings (no edits to `src/lib/i18n.tsx`).
- Color tokens / typography system (`src/styles.css` untouched).
- New routes, data, or backend changes.

## Files touched
- `src/routes/index.tsx` (single file)

After implementing, I'll verify visually via Playwright at desktop + mobile viewports and screenshot each section to confirm spacing/hierarchy improvements.
