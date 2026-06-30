import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getOccupancy } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  head: () => ({ meta: [{ title: "Occupancy — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: CalendarPage,
});

type Day = Awaited<ReturnType<typeof getOccupancy>>["days"][number];

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function CalendarPage() {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [days, setDays] = useState<Day[]>([]);
  const [selected, setSelected] = useState<Day | null>(null);
  const [loading, setLoading] = useState(false);

  const { from, to } = useMemo(() => {
    const f = cursor;
    const t = addMonths(cursor, 1);
    return { from: iso(f), to: iso(t) };
  }, [cursor]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getOccupancy({ data: { from, to } })
      .then((r) => {
        if (!cancel) setDays(r.days);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [from, to]);

  const monthLabel = cursor.toLocaleDateString("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });
  const firstWeekday = new Date(cursor).getUTCDay();
  const blanks = Array.from({ length: firstWeekday }, (_, i) => i);

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">
            Rajawali D'Cabin
          </Link>
        </div>
        <AdminTabs current="calendar" />
      </header>
      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-stone">Occupancy</p>
            <h1 className="font-display text-3xl text-forest">{monthLabel}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-widest"
            >
              ← Prev
            </button>
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-widest"
            >
              Today
            </button>
            <button
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-widest"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-3 text-[11px] text-stone">
          <Legend color="bg-green-100" label="Available" />
          <Legend color="bg-amber-200" label="Partially booked" />
          <Legend color="bg-red-200" label="Full" />
          <span className="ml-2">● = fully paid</span>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-coconut/60 text-center text-[10px] uppercase tracking-widest text-stone">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {blanks.map((b) => (
              <div key={`b${b}`} className="h-24 border-b border-r border-border/50 bg-coconut/30" />
            ))}
            {days.map((d) => {
              const totals = Object.values(d.byType).reduce(
                (a, t) => ({ booked: a.booked + t.booked, total: a.total + t.total }),
                { booked: 0, total: 0 },
              );
              const ratio = totals.total > 0 ? totals.booked / totals.total : 0;
              const bg =
                ratio === 0 ? "bg-green-50" : ratio >= 1 ? "bg-red-100" : "bg-amber-50";
              const allBookings = Object.values(d.byType).flatMap((t) => t.bookings);
              const fullyPaid = allBookings.some((b) => b.status === "fully_paid");
              return (
                <button
                  key={d.date}
                  onClick={() => setSelected(d)}
                  className={`h-24 border-b border-r border-border/50 px-2 py-1 text-left transition hover:brightness-95 ${bg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {Number(d.date.slice(8, 10))}
                    </span>
                    {fullyPaid && <span className="text-forest">●</span>}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px] text-stone">
                    {Object.entries(d.byType).map(([type, slot]) => (
                      <div key={type} className="flex justify-between">
                        <span className="truncate">{type}</span>
                        <span className={slot.booked >= slot.total ? "text-red-700" : ""}>
                          {slot.booked}/{slot.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {loading && <p className="mt-3 text-xs text-stone">Loading…</p>}

        {selected && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-forest">{selected.date}</h2>
              <button onClick={() => setSelected(null)} className="text-xs text-stone underline">
                close
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {Object.entries(selected.byType).map(([type, slot]) => (
                <div key={type}>
                  <p className="text-[11px] uppercase tracking-widest text-stone">
                    {type} — {slot.booked}/{slot.total}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {slot.bookings.length === 0 && <li className="text-xs text-stone">—</li>}
                    {slot.bookings.map((b, i) => (
                      <li key={`${b.id}-${i}`} className="flex items-center justify-between text-sm">
                        <span>
                          <Link
                            to="/admin/invoice/$id"
                            params={{ id: b.id }}
                            className="text-forest underline"
                          >
                            {b.reference ?? b.id.slice(0, 8)}
                          </Link>{" "}
                          · {b.guest} · {b.cabin}
                        </span>
                        <span className="text-[11px] uppercase text-stone">{b.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}