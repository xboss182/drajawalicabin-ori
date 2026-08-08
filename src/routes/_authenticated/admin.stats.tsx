import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBookingStats, listEmailLog } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/admin/stats")({
  head: () => ({ meta: [{ title: "Stats — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: StatsPage,
});

function fmtMonthInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastDayOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function StatsPage() {
  const today = new Date();
  const [monthFrom, setMonthFrom] = useState(fmtMonthInput(today));
  const [monthTo, setMonthTo] = useState(fmtMonthInput(today));

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getBookingStats>> | null>(null);
  const [emails, setEmails] = useState<Awaited<ReturnType<typeof listEmailLog>> | null>(null);
  const [kind, setKind] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);

  async function refresh() {
    const from = `${monthFrom}-01`;
    const to = lastDayOfMonth(monthTo);
    const s = await getBookingStats({ data: { from, to } });
    setStats(s);
    const e = await listEmailLog({
      data: { from, to, kind: kind || null, status: status || null, offset },
    });
    setEmails(e);
  }
  useEffect(() => {
    refresh();
  }, [monthFrom, monthTo, kind, status, offset]);

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        </div>
        <AdminTabs current="stats" />
      </header>
      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl text-forest">Reports</h1>
          <MonthRangePicker
            from={monthFrom}
            to={monthTo}
            onFromChange={setMonthFrom}
            onToChange={setMonthTo}
          />
        </div>

        {stats && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              <Stat label="Rooms booked" value={String(stats.rooms)} />
              <Stat label="Confirmed revenue" value={`RM ${stats.confirmedRevenue.toFixed(2)}`} />
              <Stat label="Deposit revenue" value={`RM ${stats.depositRevenue.toFixed(2)}`} />
              <Stat label="Nights sold" value={String(stats.nightsSold)} />
              <Stat
                label="Occupancy"
                value={`${(stats as any).roomNightsSold ?? stats.nightsSold} / ${stats.capacity}`}
              />
            </div>

            <div className="mt-8 overflow-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="p-2">Cabin type</th>
                    <th className="p-2 text-right">Rooms</th>
                    <th className="p-2 text-right">Nights</th>
                    <th className="p-2 text-right">Adults</th>
                    <th className="p-2 text-right">Children</th>
                    <th className="p-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byType.map((r) => (
                    <tr key={r.type} className="border-t border-border/40">
                      <td className="p-2">{r.type}</td>
                      <td className="p-2 text-right">{r.reservations}</td>
                      <td className="p-2 text-right">{r.nights}</td>
                      <td className="p-2 text-right">{r.adults}</td>
                      <td className="p-2 text-right">{r.kids}</td>
                      <td className="p-2 text-right">RM {r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                  {stats.byType.length === 0 && (
                    <tr><td colSpan={6} className="p-3 text-center text-stone">No data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Separator className="mt-8" />

            <h2 className="mt-8 font-display text-2xl text-forest">Monthly reports</h2>
            <div className="mt-3 overflow-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="p-2">Month</th>
                    <th className="p-2 text-right">Rooms</th>
                    <th className="p-2 text-right">Nights</th>
                    <th className="p-2 text-right">Adults</th>
                    <th className="p-2 text-right">Children</th>
                    <th className="p-2 text-right">Occupancy</th>
                    <th className="p-2 text-right">Revenue</th>
                    <th className="p-2 text-right">Manual</th>
                    <th className="p-2 text-right">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {((stats as any).byMonth ?? [])
                    .filter((r: any) => Number(r.reservations) > 0 || Number(r.nights) > 0)
                    .map((r: any) => {
                      const [yy, mm] = String(r.month).split("-").map(Number);
                      const label = `${MONTH_NAMES[mm - 1]} ${yy}`;
                      return (
                        <tr key={r.month} className="border-t border-border/40">
                          <td className="p-2">{label}</td>
                          <td className="p-2 text-right">{r.reservations}</td>
                          <td className="p-2 text-right">{r.nights}</td>
                          <td className="p-2 text-right">{r.adults}</td>
                          <td className="p-2 text-right">{r.kids}</td>
                          <td className="p-2 text-right">{r.roomNights ?? r.nights} / {r.capacity}</td>
                          <td className="p-2 text-right">RM {Number(r.revenue).toFixed(2)}</td>
                          <td className="p-2 text-right">RM {Number(r.revenueManual ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-right">RM {Number(r.revenueOnline ?? 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  {(!(stats as any).byMonth ||
                    ((stats as any).byMonth ?? []).filter(
                      (r: any) => Number(r.reservations) > 0 || Number(r.nights) > 0,
                    ).length === 0) && (
                    <tr><td colSpan={9} className="p-3 text-center text-stone">No data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="mt-8 font-display text-2xl text-forest">Yearly reports</h2>
            <div className="mt-3 overflow-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="p-2">Year</th>
                    <th className="p-2 text-right">Rooms</th>
                    <th className="p-2 text-right">Nights</th>
                    <th className="p-2 text-right">Adults</th>
                    <th className="p-2 text-right">Children</th>
                    <th className="p-2 text-right">Occupancy</th>
                    <th className="p-2 text-right">Revenue</th>
                    <th className="p-2 text-right">Manual</th>
                    <th className="p-2 text-right">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.byYear ?? [])
                    .filter((r: any) => Number(r.reservations) > 0 || Number(r.nights) > 0)
                    .map((r: any) => (
                    <tr key={r.year} className="border-t border-border/40">
                      <td className="p-2">{r.year}</td>
                      <td className="p-2 text-right">{r.reservations}</td>
                      <td className="p-2 text-right">{r.nights}</td>
                      <td className="p-2 text-right">{r.adults}</td>
                      <td className="p-2 text-right">{r.kids}</td>
                      <td className="p-2 text-right">{(r as any).roomNights ?? r.nights} / {r.capacity}</td>
                      <td className="p-2 text-right">RM {Number(r.revenue).toFixed(2)}</td>
                      <td className="p-2 text-right">RM {Number((r as any).revenueManual ?? 0).toFixed(2)}</td>
                      <td className="p-2 text-right">RM {Number((r as any).revenueOnline ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!stats.byYear ||
                    (stats.byYear ?? []).filter(
                      (r: any) => Number(r.reservations) > 0 || Number(r.nights) > 0,
                    ).length === 0) && (
                    <tr><td colSpan={9} className="p-3 text-center text-stone">No data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="mt-10 font-display text-2xl text-forest">Email delivery</h2>
        {emails && (
          <>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <select value={kind} onChange={(e) => { setKind(e.target.value); setOffset(0); }} className="rounded-md border border-border bg-background px-2 py-1">
                <option value="">All templates</option>
                {emails.kinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className="rounded-md border border-border bg-background px-2 py-1">
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="dlq">DLQ</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={String(emails.summary.total)} />
              <Stat label="Sent" value={String(emails.summary.sent)} />
              <Stat label="Failed" value={String(emails.summary.failed)} />
              <Stat label="Pending" value={String(emails.summary.pending)} />
            </div>
            <div className="mt-4 overflow-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="p-2">Template</th>
                    <th className="p-2">Recipient</th>
                    <th className="p-2">Subject</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.rows.map((r: any) => (
                    <tr key={r.id} className="border-t border-border/40 align-top">
                      <td className="p-2 text-xs">{r.kind}</td>
                      <td className="p-2">{r.to_email}</td>
                      <td className="p-2 text-xs">{r.subject}</td>
                      <td className="p-2">
                        <span className={
                          r.status === "sent" ? "text-green-700"
                          : (r.status === "failed" || r.status === "dlq") ? "text-red-700"
                          : "text-stone"
                        }>{r.status}</span>
                        {r.error && <p className="text-[10px] text-red-700">{r.error}</p>}
                      </td>
                      <td className="p-2 text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                  {emails.rows.length === 0 && (
                    <tr><td colSpan={5} className="p-3 text-center text-stone">No emails.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between text-xs text-stone">
              <span>{emails.totalCount} total</span>
              <span className="flex gap-2">
                <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))} className="underline disabled:opacity-40">← prev</button>
                <button disabled={offset + 50 >= emails.totalCount} onClick={() => setOffset(offset + 50)} className="underline disabled:opacity-40">next →</button>
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-stone">{label}</p>
      <p className="mt-1 font-display text-xl text-forest">{value}</p>
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function MonthRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const now = new Date();
  const years: number[] = [];
  for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 2; y++) years.push(y);

  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  function setPart(which: "from" | "to", part: "y" | "m", value: number) {
    const [y, m] = (which === "from" ? from : to).split("-").map(Number);
    const ny = part === "y" ? value : y;
    const nm = part === "m" ? value : m;
    const iso = `${ny}-${String(nm).padStart(2, "0")}`;
    (which === "from" ? onFromChange : onToChange)(iso);
  }

  function quickRange(months: number) {
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
    onFromChange(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`);
    onToChange(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`);
  }

  const selectCls =
    "rounded-md border border-border bg-background px-2 py-1.5 text-sm text-forest focus:outline-none focus:ring-2 focus:ring-forest/30";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
        <span className="pl-1 text-[10px] uppercase tracking-widest text-stone">From</span>
        <select
          aria-label="From month"
          value={fm}
          onChange={(e) => setPart("from", "m", Number(e.target.value))}
          className={selectCls}
        >
          {MONTH_NAMES.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
        <select
          aria-label="From year"
          value={fy}
          onChange={(e) => setPart("from", "y", Number(e.target.value))}
          className={selectCls}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="px-1 text-xs uppercase tracking-widest text-stone">to</span>
        <select
          aria-label="To month"
          value={tm}
          onChange={(e) => setPart("to", "m", Number(e.target.value))}
          className={selectCls}
        >
          {MONTH_NAMES.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
        <select
          aria-label="To year"
          value={ty}
          onChange={(e) => setPart("to", "y", Number(e.target.value))}
          className={selectCls}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => quickRange(1)}
          className="rounded-full border border-border bg-background px-3 py-1.5 hover:bg-coconut"
        >
          This month
        </button>
        <button
          type="button"
          onClick={() => quickRange(3)}
          className="rounded-full border border-border bg-background px-3 py-1.5 hover:bg-coconut"
        >
          3M
        </button>
        <button
          type="button"
          onClick={() => quickRange(12)}
          className="rounded-full border border-border bg-background px-3 py-1.5 hover:bg-coconut"
        >
          12M
        </button>
        <button
          type="button"
          onClick={() => {
            onFromChange(`${now.getFullYear()}-01`);
            onToChange(`${now.getFullYear()}-12`);
          }}
          className="rounded-full border border-border bg-background px-3 py-1.5 hover:bg-coconut"
        >
          YTD
        </button>
      </div>
    </div>
  );
}