Remove both "Download guide as PDF" buttons from `/booking-guide` and clean up the now-unused PDF-related code in the route file.

**Scope:**
- `src/routes/booking-guide.tsx`

**Changes:**
1. Remove the top "Download guide as PDF" button in the hero CTA row.
2. Remove the bottom "Download guide as PDF" button in the bottom CTA section.
3. Remove the `downloadPdf` function, `printRef`, and `busy` state since they will no longer be used.
4. Remove unused `useRef` and `useState` imports.
5. Keep the printable `print:block` header and page-break styling intact; it has no negative effect and preserves future PDF-friendliness.

**Not in scope:**
- Uninstalling `html2pdf.js` from dependencies (leave it in case it's needed elsewhere or re-added later).