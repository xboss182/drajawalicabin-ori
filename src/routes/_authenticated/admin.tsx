import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { isAdminRecipient } from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const { allowed } = await isAdminRecipient();
      if (!allowed) throw redirect({ to: "/auth", search: { denied: 1 } });
    } catch (e: unknown) {
      // re-throw redirects; otherwise treat as denied
      if (e && typeof e === "object" && "isRedirect" in (e as Record<string, unknown>)) throw e;
      throw redirect({ to: "/auth", search: { denied: 1 } });
    }
  },
  component: () => <Outlet />,
});

export function AdminTabs({ current }: { current: string }) {
  const tabs: Array<{ id: string; label: string; to: string }> = [
    { id: "bookings", label: "Bookings", to: "/admin" },
    { id: "calendar", label: "Calendar", to: "/admin/calendar" },
    { id: "cabins", label: "Cabins", to: "/admin/cabins" },
    { id: "holidays", label: "Holidays", to: "/admin/holidays" },
    { id: "stats", label: "Stats", to: "/admin/stats" },
    { id: "members", label: "Members", to: "/admin/members" },
    { id: "settings", label: "Settings", to: "/admin/settings" },
  ];
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 pb-3 lg:px-10">
      {tabs.map((t) => (
        <Link
          key={t.id}
          to={t.to}
          className={`rounded-full px-4 py-1.5 text-[11px] uppercase tracking-widest ${
            current === t.id
              ? "bg-forest text-coconut"
              : "text-stone hover:bg-coconut hover:text-forest"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}