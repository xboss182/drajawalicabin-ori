# Remove Store link + WhatsApp sales assistant

## 1. Remove the "Store" nav link
Delete the `Store` link from the desktop nav in `src/routes/index.tsx`. The `/whatsapp-store` page and the admin Store tab stay live and reachable by direct URL — only the nav entry goes.

## 2. WhatsApp sales assistant (guided flow, no WhatsApp API)
A chat assistant lives on the site. The guest talks to it, it checks real availability and prices from the database, builds their stay, then hands the whole thing to WhatsApp as a fully written-out message to +60103328747. No business verification, no per-message cost, works instantly on mobile and desktop.

### What the guest experiences
1. Every WhatsApp button on the site (floating button, nav, hero, footer) now opens the assistant instead of jumping straight to WhatsApp. A small "Chat on WhatsApp directly" link inside the assistant keeps the old behaviour for guests who just want to message you.
2. It opens with "When would you like to stay?" and a date-range calendar, greeting in the guest's language (EN/BM, follows the site language). Picking dates immediately lists the rooms still free for those nights with prices — no typing needed.
3. From there the guest can keep tapping cards or just type questions; the assistant handles both.
4. Fully booked dates are blocked out on the calendar; if the whole property is full it says so and offers the nearest free dates.
5. Room cards show live weekday / weekend / holiday pricing, including the 10% second-night discount and any active promo.
6. Guest picks rooms, pax and add-ons in inline cards; a running total updates.
7. It answers free-text questions along the way — facilities, directions, house rules, late check-out, BBQ pit and mattress add-ons, group bookings.
8. It collects name, phone, IC number and vehicle details using the same validation rules as the booking page.
9. Final step: a summary card with an "Open in WhatsApp" button. Tapping it opens WhatsApp with the entire booking written out — dates, rooms, pax, add-ons, total, guest details and a short reference code — ready to send.
10. Alternative button: "Book on the website instead", deep-linking into `/book` with everything pre-filled for guests who prefer to pay online.

### What you (admin) get
- Every assistant session that reaches the summary is saved as a lead: guest name, phone, dates, rooms, quoted total, timestamp, and whether they tapped through to WhatsApp.
- A "Chat leads" section inside the existing CRM page, so you can follow up on guests who asked but never sent.
- Chat transcript viewable per lead.

### Guardrails
- The assistant only quotes prices and availability that come from the database — it cannot invent a rate or offer a room that is taken.
- It never confirms a booking itself; the booking exists only once you reply in WhatsApp or the guest completes `/book`.
- Fully booked dates return "no vacancy" plus the nearest alternative dates.

## Technical notes
- Chat UI built from AI Elements primitives (`conversation`, `message`, `prompt-input`, `tool`, `shimmer`) in a new `src/components/chat/` set, mounted from `__root.tsx` as a floating widget.
- Streaming endpoint at `src/routes/api/chat.ts` using AI SDK `streamText` through the Lovable AI Gateway; system prompt carries property facts, policies and tone.
- Tools exposed to the model, all server-side, reusing existing logic:
  - `checkAvailability(from,to)` — reuses the logic behind `src/routes/api/public/availability/taken-dates.ts`
  - `quoteStay(from,to,cabinIds,adults,children)` — reuses `src/lib/booking-helpers.server.ts` pricing plus `src/lib/discounts.ts`
  - `listAddOns()` — reads `store_items`
  - `buildWhatsAppHandoff(payload)` — validates guest fields via `src/lib/guest-fields.ts`, saves the lead, returns the `wa.me` URL and a `/book` prefill URL
- Conversation shape: one conversation per visitor, persisted in localStorage; lead records persisted server-side in a new `chat_leads` table (server-side insert only, admin read, RLS + grants).
- Tool results render as custom cards (calendar, room picker, quote summary), not raw JSON.