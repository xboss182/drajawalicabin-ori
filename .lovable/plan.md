# Make post-booking management obvious and self-serve

## The two problems

1. **Guests can't find their booking again.** "Manage booking" is a small text link in the site nav, and the confirmation screen only offers WhatsApp + "Back to home" with a small "Find Booking" footnote.
2. **Guests who forgot the receipt re-book instead of updating.** The manage-booking page today only handles the *balance* receipt. A booking still in `pending_payment` (deposit receipt never uploaded) has no upload box and no payment QR on that page — so the only path a guest sees to "send the receipt" is starting a whole new booking.

## What changes

### 1. Manage booking becomes one page that always shows the next step

Rewritten as a status-driven page. Whatever state the booking is in, the top of the page shows one big card titled with the action needed:

```text
Awaiting deposit receipt  ->  [ Pay QR + bank details ] [ Upload receipt ]  (+ Pay by card)
Receipt received          ->  "We're checking your receipt" (with re-upload if wrong file)
Confirmed / balance due   ->  [ Pay QR + bank details ] [ Upload balance receipt ] (+ Pay by card)
Fully paid                ->  Locker code / check-in info
```

Key fix: the deposit-receipt upload + payment QR now exist here, so a guest who forgot the receipt updates the existing booking instead of re-booking. Uploading again replaces the previous file rather than creating anything new.

The page gets full English/Malay copy (it is currently English only), plainer wording, bigger tap targets, and a "Wrong file? Upload again" affordance.

### 2. One easy way in, repeated everywhere

- **Confirmation screen after booking**: the primary button becomes **"Open my booking / Upload receipt"** linking straight to the guest's manage link, with the reference shown large and a "save this link" hint. WhatsApp and Home become secondary.
- **WhatsApp hand-off message** after booking includes the manage link.
- **Remember on this device**: the manage link (id + token) is saved to localStorage on booking, so the site header shows a clear **"My booking"** button that opens it in one tap — no email, no reference.
- **Confirmation and balance-reminder emails** get a prominent "Open my booking" button (balance reminder already links; booking summary gets the same treatment).
- **Header link** renamed to **"My booking"** and made a visible pill (not plain text) on desktop and mobile.

### 3. Lookup made trivial

`/manage-booking` with no link and `/find-booking` currently overlap and one demands a reference number. Consolidate:
- `/manage-booking` without a link shows **email only** -> opens the latest active booking (this server path already exists).
- Reference number becomes an optional "more than one booking?" field, not a requirement.
- `/find-booking` stays as the "email me the link instead" fallback and is linked from the lookup form.

### 4. Booking form guard against duplicates

On the booking page, if this device already has an active booking saved, show a soft banner above the form: *"You already have booking RJW-XXXX. Need to send a receipt? Open your booking"* — with a link — so a repeat submission is a deliberate choice.

## Technical notes

- `src/routes/manage-booking.tsx`: rewritten into status-driven sections; add deposit-proof upload calling the existing `attachPaymentProof` server fn (needs `reference` rather than token, so `getBookingForGuest` returns the reference already — pass it through); reuse the DuitNow QR + bank block for both states; wire i18n via `useLanguage`.
- `src/lib/booking.functions.ts`: `getBookingForGuest` returns `status` and `paymentProofPath` so the UI can distinguish "no receipt yet" from "receipt received"; no schema changes.
- `src/routes/book.tsx`: save `{id, token, reference}` to localStorage on success; new primary CTA on the done screen; duplicate-booking banner.
- `src/routes/index.tsx`: header "My booking" pill reading localStorage (client-only, so no hydration mismatch).
- `src/lib/email-templates/booking-summary.tsx`: add the manage-booking CTA button.
- `src/lib/i18n.tsx`: new EN/BM strings for the manage page and CTAs.

No database or RLS changes; all flows use the existing guest-token server functions.
