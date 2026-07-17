
## Goal
Give admin control over the "Stay longer, save more" hero promo pill on the homepage:
1. Toggle it on/off
2. Edit the CTA sentence (EN + BM)
3. Auto-generate a new catchy sentence via Lovable AI

## Changes

### 1. Storage (app_settings)
Reuse the existing `app_settings` key/value table. Add one row:
- key: `hero_promo_cta`
- value (JSON): `{ enabled: boolean, text_en: string, text_bm: string }`

Seed with current defaults ("Stay longer, save more — 10% off from the 2nd night onwards" / BM equivalent). No schema migration needed.

### 2. New admin page: `src/routes/_authenticated/admin.promo.tsx`
- Add "Promo" tab to `AdminTabs` in `admin.tsx`
- Fields:
  - Toggle: Enable hero promo CTA
  - Textarea: English sentence
  - Textarea: Malay sentence
  - Button: "✨ Generate with AI" (opens small prompt input, calls server fn, fills both text fields with returned EN + BM)
  - Save button

### 3. Server functions: `src/lib/promo-cta.functions.ts`
- `getHeroPromoCta()` — public, reads row from `app_settings` (server publishable client). Returns `{ enabled, text_en, text_bm }` with defaults if missing.
- `updateHeroPromoCta({ enabled, text_en, text_bm })` — auth + admin role check, upserts row.
- `generatePromoCtaAi({ hint? })` — auth + admin role check, calls Lovable AI Gateway (`google/gemini-3.5-flash`) with a prompt that returns catchy EN + BM sentences about the 10% 2nd-night discount. Returns `{ text_en, text_bm }`.

### 4. Frontend consumption: `src/routes/index.tsx`
- Fetch `getHeroPromoCta` via TanStack Query (public, cacheable)
- If `enabled === false`, hide the promo pill
- Else render `lang === 'bm' ? text_bm : text_en` inside the existing pill styling
- Keep current fallback text if fetch fails

### 5. Grants / RLS
`app_settings` already exists with a public read policy (used elsewhere). Ensure:
- SELECT allowed to `anon` for this key (read-only public config)
- Writes only via authenticated admin server fn using `supabaseAdmin` after role check

## Out of scope
- No changes to the discount engine logic
- No changes to the /book page pricing
- Pill styling and placement unchanged
