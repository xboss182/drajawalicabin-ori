# Mobile view slim-down plan

Goal: reduce the "bloated" feel on phones (≤640px) without touching desktop. Every change is gated with `sm:hidden` / `hidden sm:…` / responsive size utilities so nothing above `sm` is affected.

## Homepage — `src/routes/index.tsx`

1. **Hero promo pill** (`:268-275`) — the "Stay longer, save more" pill duplicates the "✦ auto discount" line under the search form. Hide the pill on mobile only (`hidden sm:inline-flex`). Desktop keeps it.
2. **Hero paddings** (`:238,248`) — reduce mobile vertical space: `pt-32 pb-28` → `pt-20 pb-14 sm:pt-32 sm:pb-28`; hero `min-h-[78svh]` → `min-h-[62svh] sm:min-h-[78svh]`.
3. **Duplicate helper lines under search** (`:477-486`) — three small paragraphs stack. On mobile keep only the primary `t.search.note`; hide `autoDiscount` + `childNote` (`hidden sm:block`). Desktop keeps all three.
4. **Cabin card grid** (`:633`) — force single column on phones: `grid-cols-1 sm:grid-cols-2`. Keep the inner 2-col feature list as-is on ≥sm; on mobile switch it to `grid-cols-1 sm:grid-cols-2` (`:644`).
5. **WhyStay gallery preview** (`:690-736`) — two large teaser images duplicate the `/gallery` page. Hide the second preview on mobile (`hidden sm:block` on the second `<Link>` block, `:714-735`).
6. **NearbySection** (`:764`) — three tall `aspect-[3/4]` images stack full width. On mobile use a horizontal scroll-snap row (`flex overflow-x-auto snap-x sm:grid sm:grid-cols-3`) and shorten aspect to `aspect-[4/3]` on mobile. Desktop grid unchanged.
7. **Footer** (`:794,834`) — mobile `py-20` → `py-10 sm:py-20`; hide the decorative italic slogan on mobile (`hidden sm:block`).

## `/book` page — `src/routes/book.tsx`

8. **DOM order on mobile** (`:1045`) — summary aside currently `order-1 lg:order-2` shows the big price card ABOVE the form on mobile. Flip to `order-2 lg:order-2` so mobile users hit the date/room form first. Desktop layout unchanged.
9. **2-month calendar overflow** (`:770`) — `numberOfMonths={2}` forces horizontal scroll on phones. Use a `useIsMobile()` hook (already in project) to render `numberOfMonths={isMobile ? 1 : 2}`. Desktop still shows two months.
10. **Recommended box** (`:682-735`) — cap to top 2 recommendations on mobile (`.slice(0, isMobile ? 2 : recs.length)`); desktop shows full list.
11. **Rate fine-print line** (`:851-853`) — `text-[9px]` triple-rate line is unreadable. Hide on mobile (`hidden sm:block`); keep on desktop.
12. **QR / payment code box** (`:1304`) — cap width on mobile: add `max-w-xs mx-auto sm:max-w-none sm:mx-0` to the QR wrapper.

## Out of scope
- No copy / i18n changes.
- No desktop CSS changes; every rule is mobile-only via `sm:` breakpoints or a mobile hook.
- No changes to booking logic, discounts, pricing, or server functions.

## Files touched
- `src/routes/index.tsx` (items 1-7)
- `src/routes/book.tsx` (items 8-12)
- Reuse existing `src/hooks/use-mobile.tsx` for items 9-10.

## Verification
- Preview at 375×812 (mobile), 768 (tablet), 1440 (desktop) — confirm mobile is shorter and desktop pixel-identical to now.
