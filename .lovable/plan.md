# Plan: Official Website Notice Banner

## Goal
Add a prominent but non-blocking notice that this is the sole official website of the property and that listings on OYO / Agoda / Booking.com / Expedia are unauthorized.

## Approach
Use a **dismissible top banner** placed just below the navbar on the homepage (and optionally on `/book`). It will show on every visit until dismissed, and its dismissed state will be stored in `localStorage` so repeat visitors aren't nagged.

## Copy (tightened)
**Important Notice**
This is the sole official website of this property.

We have no affiliation, partnership, or business relationship with OYO, Agoda, Booking.com, Expedia, or any other online travel agency. Any listing of this property on such platforms is not authorized by us and may contain inaccurate or outdated information.

For genuine reservations, current rates, and official enquiries, please book directly through this website or contact us using our official contact information.

## Malay translation
**Notis Penting**
Ini adalah laman web rasmi tunggal hartanah ini.

Kami tidak mempunyai sebarang perkaitan, perkongsian, atau hubungan perniagaan dengan OYO, Agoda, Booking.com, Expedia, atau mana-mana agensi pelancongan dalam talian lain. Sebarang senarai hartanah ini di platform sedemikian tidak dibenarkan oleh kami dan mungkin mengandungi maklumat yang tidak tepat atau lapuk.

Untuk tempahan sahih, kadar semasa, dan pertanyaan rasmi, sila tempah terus melalui laman web ini atau hubungi kami menggunakan maklumat rasmi kami.

## Technical changes
1. **Create component** `src/components/official-notice-banner.tsx` — small, full-width dismissible banner using the existing `Alert`, `Button`, or plain styled div (matching the forest/sand palette).
2. **Add translations** to `src/lib/i18n.tsx` under a new `notice` key for both `en` and `bm`.
3. **Wire to home page** `src/routes/index.tsx` — render the banner just below the header / nav area.
4. **Wire to booking page** `src/routes/book.tsx` — optionally render the same banner so the notice is visible at the booking entry point.
5. **Persistence** — use `localStorage` key `official-notice-dismissed` to keep the banner hidden after the user clicks “Got it” / “Faham”.
6. **SEO / accessibility** — include `role="banner"`, close button with clear label, and ensure it doesn't shift layout abruptly on close.

## Design notes
- Background: a warm sand / accent color (`bg-secondary`) with dark text (`text-foreground`) to stand out without looking like a warning.
- Left accent stripe in `primary` forest green to make it look official.
- Close button as a subtle text link with icon.
- Responsive padding and text size.

No backend changes required.