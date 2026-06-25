Update the booking hold copy so confirmation is communicated via email instead of WhatsApp.

## Changes

- In `src/lib/i18n.tsx`, update the booking hold notice string (EN + BM):
  - EN: "Your booking is held for {time}. Transfer the full amount and upload your receipt below — we'll confirm via email."
  - BM: equivalent Malay translation ending with "…kami akan sahkan melalui emel."

No other files affected. WhatsApp messaging elsewhere (post-booking summary share link) stays as-is since it's a separate optional channel.