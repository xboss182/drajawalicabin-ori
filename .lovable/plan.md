## Problem
On mobile (`/admin/crm` → By date), the wide 10-column table is squeezed into a 390px viewport. Even with `overflow-x-auto`, column widths use percentages of a narrow container, so text wraps into tall messy stacks (contact, cabin/room, status), and horizontal scrolling isn't obvious. The header filter row (Month + Search + Refresh) also wraps awkwardly.

## Fix (mobile only — desktop unchanged)

### 1. Replace the table with stacked cards on mobile
In `src/routes/_authenticated/admin.crm.tsx` inside `ByDatePanel` (the map at line ~575):
- Keep the current `<table>` but wrap it in `hidden sm:block`.
- Add a mobile-only `sm:hidden` list rendering each booking as a compact card:
  - **Row 1**: `RJW-xxxx` (mono, small) · status pill (right)
  - **Row 2**: Guest name (bold, links to CRM guest like current button)
  - **Row 3**: Cabin/room label (muted)
  - **Row 4**: `check_in → check_out · N nights` on left, `RM total` (bold) on right
  - **Row 5**: `X rooms · Y pax` · phone (tap-to-call) — small muted
- Whole card `onClick={() => setEditing(b)}` same as row.

### 2. Tighten the date header on mobile
- Stack the date title above the summary counts on mobile (`flex-col sm:flex-row`) so the count doesn't get squished.

### 3. Tighten the filter bar
- On mobile: Month input full-width, Search full-width, Refresh full-width (`w-full sm:w-auto`, `sm:flex-1` on search).

### Scope
- Presentation-only edit inside one file: `src/routes/_authenticated/admin.crm.tsx`.
- No data logic, server functions, or desktop layout changes.
