## Booking Guide tweaks

1. **Change "20+" → "12+"** everywhere in `src/routes/booking-guide.tsx`:
   - Hero subtitle
   - Step 2 callout title/body
   - Step 2 image annotation label

2. **Fix Step 2 image cropping** — the annotated screenshot cuts off below the room chips. Recapture `step-2-add-room.jpg` with a taller clip that includes the full "Your rooms" card (Queen room row + "Add another room" + Twin/Triple/Family chips + a bit of padding). Re-upload as an asset.

3. Since the callout label now says "12+", regenerate that annotation on the same screenshot.
