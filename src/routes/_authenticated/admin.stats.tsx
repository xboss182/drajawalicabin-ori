import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBookingStats, listEmailLog } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

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
          <div className="flex gap-2">
            <MonthInput label="From" value={monthFrom} onChange={setMonthFrom} />
            <MonthInput label="To" value={monthTo} onChange={setMonthTo} />
          </div>
        </div>

        {stats && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label="Reservations" value={String(stats.reservations)} />
              <Stat label="Confirmed revenue" value={`RM ${stats.confirmedRevenue.toFixed(2)}`} />
              <Stat label="Deposit revenue" value={`RM ${stats.depositRevenue.toFixed(2)}`} />
              <Stat label="Nights sold" value={String(stats.nightsSold)} />
              <Stat
                label="Occupancy"
                value={`${stats.nightsSold} / ${(stats as any).capacity ?? stats.activeCabins * stats.dayCount}`}
              />
              <Stat label="Adults (pax)" value={String((stats as any).adults ?? 0)} />
              <Stat label="Children <12" value={String((stats as any).kids ?? 0)} />
            </div>

            <h2 className="mt-8 font-display text-2xl text-forest">By month</h2>
            <div className="mt-3 overflow-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="p-2">Month</th>
                    <th className="p-2 text-right">Reservations</th>
                    <th className="p-2 text-right">Nights</th>
                    <th className="p-2 text-right">Adults</th>
                    <th className="p-2 text-right">Children</th>
                    <th className="p-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {((stats as any).byMonth ?? []).map((r: any) => (
                    <tr key={r.month} className="border-t border-border/40">
                      <td className="p-2">
                        {new Date(r.month + "-01").toLocaleString("en-MY", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2 text-right">{r.reservations}</td>
                      <td className="p-2 text-right">{r.nights}</td>
                      <td className="p-2 text-right">{r.adults}</td>
                      <td className="p-2 text-right">{r.kids}</td>
                      <td className="p-2 text-right">RM {Number(r.revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!((stats as any).byMonth) || (stats as any).byMonth.length === 0) && (
                    <tr><td colSpan={6} className="p-3 text-center text-stone">No data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="mt-8 font-display text-2xl text-forest">By cabin type</h2>
            <div className="mt-6 overflow-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-coconut/60 text-left text-[10px] uppercase tracking-widest text-stone">
                  <tr>
                    <th className="p-2">Cabin type</th>
                    <th className="p-2 text-right">Reservations</th>
                    <th className="p-2 text-right">Nights</th>
                    <th className="p-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byType.map((r) => (
                    <tr key={r.type} className="border-t border-border/40">
                      <td className="p-2">{r.type}</td>
                      <td className="p-2 text-right">{r.reservations}</td>
                      <td className="p-2 text-right">{r.nights}</td>
                      <td className="p-2 text-right">RM {r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                  {stats.byType.length === 0 && (
                    <tr><td colSpan={4} className="p-3 text-center text-stone">No data.</td></tr>
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
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs text-stone">
      <span className="mr-2 uppercase tracking-widest">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
    </label>
  );
}