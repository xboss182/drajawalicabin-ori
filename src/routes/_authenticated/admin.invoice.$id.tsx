import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getInvoice, setBalanceDueAt } from "@/lib/booking.functions";
import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/invoice/$id")({
  head: () => ({ meta: [{ title: "Invoice — Rajawali D'Cabin" }, { name: "robots", content: "noindex" }] }),
  component: InvoicePage,
});

type Inv = Awaited<ReturnType<typeof getInvoice>>;

function money(n: number | null | undefined) {
  return `RM ${Number(n ?? 0).toFixed(2)}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function InvoicePage() {
  const { id } = Route.useParams();
  const [inv, setInv] = useState<Inv | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editingDue, setEditingDue] = useState(false);
  const [dueInput, setDueInput] = useState("");

  async function load() {
    try {
      const r = await getInvoice({ data: { bookingId: id } });
      setInv(r);
      setDueInput(r.balance_due_at ? new Date(r.balance_due_at).toISOString().slice(0, 10) : "");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function saveDueDate() {
    if (!dueInput) return;
    try {
      await setBalanceDueAt({ data: { bookingId: id, dueAt: dueInput + "T00:00:00Z" } });
      setEditingDue(false);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    }
  }

  if (err)
    return (
      <main className="min-h-[100svh] p-10">
        <p className="text-red-700">{err}</p>
      </main>
    );
  if (!inv)
    return (
      <main className="min-h-[100svh] p-10">
        <p>Loading…</p>
      </main>
    );

  const depositPaid = inv.status !== "pending_payment";
  const balanceProofExists = !!inv.balanceProofUrl;
  const isFullPayment = Number(inv.balance ?? 0) <= 0;

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/admin" className="font-display text-lg text-forest">
            ← Back to bookings
          </Link>
          <div className="flex gap-3 text-xs uppercase tracking-widest">
            <button onClick={() => window.print()} className="rounded-full bg-forest px-4 py-1.5 text-coconut">
              Print / PDF
            </button>
          </div>
        </div>
        <AdminTabs current="bookings" />
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10 lg:px-10 print:py-6">
        <div className="rounded-xl border border-border bg-card p-8 print:border-0 print:p-0">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="font-display text-2xl text-forest">Rajawali D'Cabin Chalet</p>
              <p className="text-xs text-stone">Chendering, Terengganu</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-widest text-stone">Invoice</p>
              <p className="font-display text-xl text-forest">{inv.reference ?? inv.id.slice(0, 8)}</p>
              <p className="text-xs text-stone">Issued {fmtDate(inv.created_at)}</p>
              <span
                className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] uppercase tracking-widest ${
                  inv.status === "fully_paid"
                    ? "bg-green-100 text-green-800"
                    : inv.status === "confirmed"
                      ? "bg-amber-100 text-amber-800"
                      : inv.status === "awaiting_review"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-stone-100 text-stone-700"
                }`}
              >
                {inv.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Block label="Guest">
              <p className="text-foreground">{inv.guest_name}</p>
              <p className="text-stone">{inv.email}</p>
              <p className="text-stone">{inv.phone}</p>
            </Block>
            <Block label="Stay">
              <p>Check-in: {fmtDate(inv.check_in)}</p>
              <p>Check-out: {fmtDate(inv.check_out)}</p>
              <p>
                {inv.nights ?? "—"} night(s) · {inv.guests} guest(s){inv.comforter ? " · comforter" : ""}
              </p>
            </Block>
          </div>

          <div className="mt-8">
            <p className="text-[11px] uppercase tracking-widest text-stone">Rooms</p>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-stone">
                  <th className="py-2 font-medium">Room</th>
                  <th className="py-2 font-medium">Nights</th>
                  <th className="py-2 text-right font-medium">Subtotal</th>
                  <th className="py-2 text-right font-medium">Comforter</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.rooms.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2">{r.nights ?? "—"}</td>
                    <td className="py-2 text-right">{money(r.subtotal)}</td>
                    <td className="py-2 text-right">{money(r.comforterTotal)}</td>
                    <td className="py-2 text-right">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-xs uppercase tracking-widest text-stone">
                    Room rate
                  </td>
                  <td className="pt-3 text-right font-display text-xl text-forest">{money(inv.total)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="pt-1 text-right text-xs uppercase tracking-widest text-stone">
                    Refundable security deposit
                  </td>
                  <td className="pt-1 text-right font-display text-lg text-forest">{money(inv.securityDeposit)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="pt-1 text-right text-xs uppercase tracking-widest text-stone">
                    Total payable
                  </td>
                  <td className="pt-1 text-right font-display text-xl text-forest">{money(inv.total + inv.securityDeposit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8">
            <p className="text-[11px] uppercase tracking-widest text-stone">Payment schedule</p>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-stone">
                  <th className="py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                  <th className="py-2 font-medium">Proof</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="py-2">1</td>
                  <td className="py-2">{isFullPayment ? "Full payment" : "Booking deposit"}</td>
                  <td className="py-2">on booking</td>
                  <td className="py-2">{depositPaid ? fmtDate(inv.confirmed_at ?? inv.created_at) : "—"}</td>
                  <td className="py-2 text-right">{money(inv.deposit)}</td>
                  <td className="py-2">
                    {inv.depositProofUrl ? (
                      <a
                        href={inv.depositProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-forest underline"
                      >
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {!isFullPayment && (
                <tr>
                  <td className="py-2">2</td>
                  <td className="py-2">Balance</td>
                  <td className="py-2">
                    {editingDue ? (
                      <span className="flex items-center gap-1">
                        <input
                          type="date"
                          value={dueInput}
                          onChange={(e) => setDueInput(e.target.value)}
                          className="rounded border border-border bg-background px-2 py-0.5 text-xs"
                        />
                        <button onClick={saveDueDate} className="text-[10px] text-forest underline">
                          save
                        </button>
                        <button onClick={() => setEditingDue(false)} className="text-[10px] text-stone underline">
                          cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {fmtDate(inv.balance_due_at)}
                        <button onClick={() => setEditingDue(true)} className="text-[10px] uppercase tracking-widest text-forest underline">
                          edit
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="py-2">{fmtDate(inv.balance_paid_at)}</td>
                  <td className="py-2 text-right">{money(inv.balance)}</td>
                  <td className="py-2">
                    {inv.balanceProofUrl ? (
                      <a
                        href={inv.balanceProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-forest underline"
                      >
                        View
                      </a>
                    ) : balanceProofExists ? (
                      "—"
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                )}
              </tbody>
            </table>
          </div>

          {inv.locker_code && (
            <p className="mt-6 rounded-md bg-coconut px-4 py-3 text-sm">
              Key locker code: <span className="font-mono">{inv.locker_code}</span>
            </p>
          )}
          {inv.notes && <p className="mt-4 text-sm text-stone">Notes: {inv.notes}</p>}

          <p className="mt-8 text-[11px] text-stone">
            WhatsApp 011-5500 7204 · rajawalidcabin.com
          </p>
        </div>
      </section>
    </main>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-4 text-sm">
      <p className="text-[10px] uppercase tracking-widest text-stone">{label}</p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}