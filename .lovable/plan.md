Add a "More pages" menu to the homepage header navigation after the existing Book link.

- Insert a 3-dot (vertical-ellipsis style) icon button at the end of the desktop nav links, right after the Book anchor.
- Use a client-side popover/dropdown that opens on click and lists pages that are not already shown in the header: Find Booking, Manage Booking, and Admin.
- Use TanStack Router `<Link>` for all navigation so it stays client-side and preserves preloading.
- Keep the Admin link always visible; unauthenticated users will hit the existing auth gate when they follow it.
- Match the existing header styling: coconut text on the hero, hover states, uppercase tracking labels, and the existing color tokens (forest, coconut, sand).
- Ensure the menu works on both desktop and mobile. On mobile, place the trigger inside the existing header layout or collapse the extra links into the same area as the WhatsApp button so it remains reachable.
- Use the project's existing Popover component from `src/components/ui/popover.tsx` to keep behavior consistent with the rest of the site.