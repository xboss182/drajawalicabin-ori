import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  confirmBooking,
  rejectBooking,
  markFullyPaid,
  deleteBooking,
  cancelAndRefundBooking,
  updateBookingRoomPrices,
  saveLateCheckout,
  markDepositRefunded,
} from "@/lib/booking.functions";
import { computeLateCheckout, LATE_CHECKOUT_HOURLY_FEE } from "@/lib/late-checkout";
import { getStripeEnvironment } from "@/lib/stripe";

export type AdminBooking = {
  id: string;
  guest_name: string;
  email: string;
  phone: string;
  check_in: string;
  check_out: string;
  guests: number;
  room_type: string;
  nights: number | null;
  total_amount: number | null;
  comforter: boolean;
  notes: string | null;
  status: string;
  payment_reference: string | null;
  proofUrl: string | null;
  created_at: string;
  hold_expires_at: string | null;
  balance_paid_at?: string | null;
  locker_code?: string | null;
  deposit_amount?: number | null;
  num_rooms?: number;
  payment_method?: string | null;
  actual_check_out_at?: string | null;
  late_checkout_hours?: number | null;
  late_checkout_fee?: number | null;
  deposit_refunded_amount?: number | null;
  deposit_refund_note?: string | null;
  deposit_refunded_at?: string | null;
  rooms?: Array<{ id: string; cabinId: string | null; name: string; nights: number | null; total: number }>;
};

export function BookingCard({
  b, onRefresh,
}: {
  b: AdminBooking;
  onRefresh?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [savingPrice, setSavingPrice] = useState(false);

  async function onConfirm(id: string) {
    if (!confirm("Confirm payment received and block these dates?")) return;
    try { await confirmBooking({ data: { bookingId: id } }); onRefresh?.(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }
  async function onReject(id: string) {
    if (!confirm("Reject this booking and free the dates?")) return;
    try { await rejectBooking({ data: { bookingId: id } }); onRefresh?.(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }
  async function onMarkPaid() {
    const code = prompt(
      `Enter key-locker code for ${b.guest_name} (${b.payment_reference}).\nThis will mark the booking Fully Paid and email the guest.`,
      "",
    );
    if (!code || code.trim().length < 3) return;
    try { await markFullyPaid({ data: { bookingId: b.id, lockerCode: code.trim() } }); onRefresh?.(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }
  async function onDelete() {
    if (!confirm("Permanently delete this booking? This cannot be undone.")) return;
    try { await deleteBooking({ data: { bookingId: b.id } }); onRefresh?.(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed to delete"); }
  }
  async function onCancelRefund() {
    if (!confirm(`Cancel booking ${b.payment_reference ?? ""} and refund the card payment via Stripe? This cannot be undone.`)) return;
    try {
      const res = await cancelAndRefundBooking({ data: { bookingId: b.id, environment: getStripeEnvironment() } });
      const lines = res.refunds.map((r) => `${r.kind}: RM ${r.amount.toFixed(2)}`);
      const msg = lines.length ? `Refunded:\n${lines.join("\n")}` : "Booking cancelled (no Stripe payment to refund).";
      const errMsg = res.errors.length ? `\n\nErrors:\n${res.errors.join("\n")}` : "";
      alert(msg + errMsg);
      onRefresh?.();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to cancel/refund"); }
  }

  function openEdit() {
    const d: Record<string, number> = {};
    for (const r of b.rooms ?? []) d[r.id] = Number(r.total ?? 0);
    setDraft(d); setEditing(true);
  }
  async function savePrices() {
    setSavingPrice(true);
    try {
      const rows = Object.entries(draft).map(([id, amount]) => ({ id, amount: Number(amount) || 0 }));
      await updateBookingRoomPrices({ data: { bookingId: b.id, rows } });
      setEditing(false);
      onRefresh?.();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to update prices"); }
    finally { setSavingPrice(false); }
  }

  return (
    <article id={`b-${b.id}`} className="scroll-mt-24 rounded-xl border border-border bg-card p-5 target:ring-2 target:ring-forest">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone">
            {b.payment_reference ?? "—"} · {(b.rooms?.length ?? 1) > 1 ? `${b.rooms?.length} rooms` : b.room_type}
          </p>
          <h3 className="mt-1 font-display text-xl text-forest">{b.guest_name}</h3>
          <p className="text-sm text-foreground/70">{b.email} · {b.phone}</p>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${b.payment_method === "stripe" ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>
            {b.payment_method === "stripe" ? "Card · auto-confirmed" : "Bank transfer"}
          </span>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-forest">RM {Number(b.total_amount ?? 0).toFixed(2)}</p>
          <p className="text-xs text-stone">{b.nights ?? "?"} night{(b.nights ?? 0) > 1 ? "s" : ""} · {b.guests} guests</p>
          <Link to="/admin/invoice/$id" params={{ id: b.id }} className="mt-2 inline-block text-[11px] uppercase tracking-widest text-forest underline hover:no-underline">View invoice</Link>
          {onRefresh && (
            <button onClick={openEdit} className="mt-1 ml-3 inline-block text-[11px] uppercase tracking-widest text-forest underline hover:no-underline">Edit prices</button>
          )}
        </div>
      </div>
      {b.rooms && b.rooms.length > 1 && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-coconut/60 px-3 py-2 text-xs text-stone">
          {b.rooms.map((r) => (
            <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="text-foreground">RM {r.total.toFixed(2)}</span></li>
          ))}
        </ul>
      )}
      {editing && b.rooms && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-800">Edit room prices</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {b.rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="flex-1">{r.name}</span>
                <span className="flex items-center gap-1 text-xs">RM
                  <input type="number" min={0} step="0.01" value={draft[r.id] ?? 0}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [r.id]: Number(e.target.value) }))}
                    className="w-24 rounded border border-border bg-white px-2 py-1 text-sm" />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-stone">New total: RM {Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0).toFixed(2)}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={savePrices} disabled={savingPrice} className="rounded-full bg-forest px-4 py-1.5 text-[11px] uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60">{savingPrice ? "Saving…" : "Save prices"}</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-border px-4 py-1.5 text-[11px] uppercase tracking-widest text-stone hover:text-forest">Cancel</button>
          </div>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Row label="Check-in" value={b.check_in} />
        <Row label="Check-out" value={b.check_out} />
        <Row label="Comforter" value={b.comforter ? "Yes (+RM20/night)" : "No"} />
        <Row label="Submitted" value={new Date(b.created_at).toLocaleString()} />
      </dl>
      {b.notes && <p className="mt-3 text-sm text-foreground/75">Notes: {b.notes}</p>}
      {b.payment_method === "stripe" ? (
        <p className="mt-4 text-xs text-emerald-700">Paid by card — auto-confirmed. No proof required.</p>
      ) : b.proofUrl ? (
        <a href={b.proofUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-md border border-border px-4 py-2 text-xs uppercase tracking-widest text-forest hover:bg-coconut">View payment proof</a>
      ) : (
        <p className="mt-4 text-xs text-stone">No proof uploaded yet.</p>
      )}
      {(b.status === "awaiting_review" || b.status === "pending_payment") && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => onConfirm(b.id)} className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90">Confirm payment</button>
          <button onClick={() => onReject(b.id)} className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone hover:text-forest">Reject</button>
          <a href={`https://wa.me/${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${b.guest_name}, regarding your Rajawali D'Cabin booking ${b.payment_reference}…`)}`} target="_blank" rel="noreferrer" className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone hover:text-forest">WhatsApp guest</a>
        </div>
      )}
      {b.status === "confirmed" && (
        <div className="mt-5 flex flex-wrap gap-2">
          {b.balance_paid_at && (
            <span className="rounded-full bg-coconut px-4 py-2 text-[11px] uppercase tracking-widest text-forest">Room rate balance proof uploaded {new Date(b.balance_paid_at).toLocaleDateString()}</span>
          )}
          <button onClick={onMarkPaid} className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90">Mark fully paid + set locker code</button>
        </div>
      )}
      {b.status === "fully_paid" && b.locker_code && (
        <p className="mt-4 text-xs text-forest">Locker code: <span className="font-mono">{b.locker_code}</span></p>
      )}
      {(b.status === "confirmed" || b.status === "fully_paid") && (
        <LateCheckoutSection b={b} onRefresh={onRefresh} />
      )}
      <div className="mt-4 border-t border-border/60 pt-3">
        {b.payment_method === "stripe" && b.status !== "cancelled" && b.status !== "expired" && (
          <button onClick={onCancelRefund} className="mr-4 text-[11px] uppercase tracking-widest text-amber-700 underline hover:no-underline">Cancel + refund card</button>
        )}
        <button onClick={onDelete} className="text-[11px] uppercase tracking-widest text-red-700 underline hover:no-underline">Delete reservation</button>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-stone">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function LateCheckoutSection({ b, onRefresh }: { b: AdminBooking; onRefresh?: () => void }) {
  const totalDeposit = (b.rooms?.length ?? b.num_rooms ?? 1) * 50;
  const alreadyRefunded = !!b.deposit_refunded_at;
  const nowLocalInput = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const initialActual = b.actual_check_out_at ? new Date(b.actual_check_out_at).toISOString().slice(0, 16) : nowLocalInput();
  const [actual, setActual] = useState(initialActual);
  const [note, setNote] = useState(b.deposit_refund_note ?? "");
  const [override, setOverride] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const actualIso = actual ? new Date(actual).toISOString() : null;
  const { hoursLate, feeRM } = computeLateCheckout(b.check_out, actualIso);
  const suggested = Math.max(0, totalDeposit - feeRM);
  const refundValue = override !== "" ? Number(override) || 0 : suggested;

  async function save() {
    setSaving(true);
    try {
      await saveLateCheckout({ data: { bookingId: b.id, actualCheckOutAt: actualIso!, refundNote: note || undefined, refundOverrideRM: override !== "" ? Number(override) || 0 : undefined } });
      onRefresh?.();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }
  async function markRefunded() {
    if (!confirm(`Mark RM ${(b.deposit_refunded_amount ?? refundValue).toFixed(2)} as refunded to the guest?`)) return;
    setRefunding(true);
    try { await markDepositRefunded({ data: { bookingId: b.id } }); onRefresh?.(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setRefunding(false); }
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-coconut/40 p-4">
      <p className="text-[10px] uppercase tracking-widest text-forest">Check-out &amp; deposit</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="text-xs text-stone">Actual check-out (local time)
          <input type="datetime-local" value={actual} onChange={(e) => setActual(e.target.value)} disabled={alreadyRefunded} className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground disabled:opacity-60" />
        </label>
        <div className="text-xs text-stone sm:text-right">Scheduled: <span className="text-foreground">12:00 PM, {b.check_out}</span></div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <dt className="text-stone">Late check-out</dt>
        <dd className="text-right text-foreground">{hoursLate > 0 ? `${hoursLate} hr × RM${LATE_CHECKOUT_HOURLY_FEE} = RM ${feeRM.toFixed(2)}` : "On time — no fee"}</dd>
        <dt className="text-stone">Security deposit held</dt>
        <dd className="text-right text-foreground">RM {totalDeposit.toFixed(2)}</dd>
        <dt className="text-stone">Suggested refund</dt>
        <dd className="text-right text-foreground">RM {suggested.toFixed(2)}</dd>
      </dl>
      <label className="mt-3 block text-xs text-stone">Damages / adjustment (RM, leave blank to use suggested)
        <input type="number" min={0} step="0.01" placeholder={suggested.toFixed(2)} value={override} onChange={(e) => setOverride(e.target.value)} disabled={alreadyRefunded} className="mt-1 block w-40 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground disabled:opacity-60" />
      </label>
      <label className="mt-2 block text-xs text-stone">Notes (visible in admin only)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={alreadyRefunded} rows={2} className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground disabled:opacity-60" />
      </label>
      <p className="mt-3 text-sm font-medium text-forest">Refund to guest: RM {refundValue.toFixed(2)}</p>
      {!alreadyRefunded ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={saving || !actualIso} className="rounded-full bg-forest px-4 py-1.5 text-[11px] uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60">{saving ? "Saving…" : b.actual_check_out_at ? "Update check-out" : "Save & mark checked out"}</button>
          {b.actual_check_out_at != null && (
            <button type="button" onClick={markRefunded} disabled={refunding} className="rounded-full border border-forest px-4 py-1.5 text-[11px] uppercase tracking-widest text-forest hover:bg-forest hover:text-coconut disabled:opacity-60">{refunding ? "…" : "Mark deposit refunded"}</button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-700">Deposit refunded RM {Number(b.deposit_refunded_amount ?? 0).toFixed(2)} on {new Date(b.deposit_refunded_at!).toLocaleString()}</p>
      )}
    </div>
  );
}