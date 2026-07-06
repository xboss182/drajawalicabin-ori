import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminTabs } from "./admin";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listBookings,
  confirmBooking,
  rejectBooking,
  isCurrentUserAdmin,
  markFullyPaid,
  deleteBooking,
  adminCreateBooking,
  listCabinsAdmin,
  cancelAndRefundBooking,
  quoteRoomPrices,
  updateBookingRoomPrices,
} from "@/lib/booking.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { syncBookingsToOneDrive } from "@/lib/excel-sync.functions";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysISO(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Booking = {
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
  rooms?: Array<{ id: string; cabinId: string | null; name: string; nights: number | null; total: number }>;
};

function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [cabins, setCabins] = useState<Array<{ id: string; name: string; cabin_type: string }>>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const adminRes = await isCurrentUserAdmin();
      setIsAdmin(adminRes.isAdmin);
      if (!adminRes.isAdmin) {
        setErr("Your account is not an admin yet. Ask the owner to grant access.");
        setBookings([]);
        return;
      }
      const res = await listBookings();
      setBookings(res.bookings as Booking[]);
      try {
        const cs = await listCabinsAdmin();
        setCabins(cs.cabins as Array<{ id: string; name: string; cabin_type: string }>);
      } catch {}
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onConfirm(id: string) {
    if (!confirm("Confirm payment received and block these dates?")) return;
    await confirmBooking({ data: { bookingId: id } });
    refresh();
  }
  async function onReject(id: string) {
    if (!confirm("Reject this booking and free the dates?")) return;
    await rejectBooking({ data: { bookingId: id } });
    refresh();
  }
  async function onMarkPaid(b: Booking) {
    const code = prompt(
      `Enter key-locker code for ${b.guest_name} (${b.payment_reference}).\nThis will mark the booking Fully Paid and email the guest.`,
      "",
    );
    if (!code || code.trim().length < 3) return;
    try {
      await markFullyPaid({ data: { bookingId: b.id, lockerCode: code.trim() } });
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }
  async function onDelete(id: string) {
    if (!confirm("Permanently delete this booking? This cannot be undone.")) return;
    try {
      await deleteBooking({ data: { bookingId: id } });
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  }
  async function onCancelRefund(b: Booking) {
    if (
      !confirm(
        `Cancel booking ${b.payment_reference ?? ""} and refund the card payment via Stripe? This cannot be undone.`,
      )
    )
      return;
    try {
      const res = await cancelAndRefundBooking({
        data: { bookingId: b.id, environment: getStripeEnvironment() },
      });
      const lines = res.refunds.map((r) => `${r.kind}: RM ${r.amount.toFixed(2)}`);
      const msg = lines.length
        ? `Refunded:\n${lines.join("\n")}`
        : "Booking cancelled (no Stripe payment to refund).";
      const errMsg = res.errors.length ? `\n\nErrors:\n${res.errors.join("\n")}` : "";
      alert(msg + errMsg);
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to cancel/refund");
    }
  }
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function onSyncExcel() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncBookingsToOneDrive();
      setSyncMsg(
        `Synced ${res.rowCount} row${res.rowCount === 1 ? "" : "s"} to OneDrive (${res.fileName}).`,
      );
      setShareUrl(res.shareUrl ?? null);
      setCopied(false);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const filtered = (status: string) => bookings.filter((b) => b.status === status);

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
          <div className="flex items-center gap-4 text-xs uppercase tracking-widest">
            <button onClick={refresh} className="text-stone hover:text-forest">Refresh</button>
            <button onClick={signOut} className="text-stone hover:text-forest">Sign out</button>
          </div>
        </div>
        <AdminTabs current="bookings" />
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Owner dashboard</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-4xl text-forest">Bookings</h1>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onSyncExcel}
                disabled={syncing}
                className="rounded-full border border-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-forest hover:bg-coconut disabled:opacity-60"
              >
                {syncing ? "Syncing…" : "Sync to Excel"}
              </button>
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90"
              >
                {showAdd ? "Close" : "+ Add manual booking"}
              </button>
            </div>
          )}
        </div>
        {syncMsg && (
          <p className="mt-3 rounded-md border border-border bg-coconut/60 px-4 py-2 text-xs text-forest">
            {syncMsg}
          </p>
        )}
        {shareUrl && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-coconut/60 px-4 py-2 text-xs text-forest">
            <span className="uppercase tracking-widest">Share link:</span>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate max-w-[420px] underline"
            >
              {shareUrl}
            </a>
            <button
              onClick={copyShareUrl}
              className="ml-auto rounded-full border border-forest px-3 py-1 text-[11px] uppercase tracking-widest text-forest hover:bg-coconut"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {showAdd && isAdmin && (
          <ManualBookingForm
            cabins={cabins}
            onDone={() => {
              setShowAdd(false);
              refresh();
            }}
          />
        )}
        {err && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </p>
        )}
        {loading && <p className="mt-8 text-stone">Loading…</p>}
        {!loading && isAdmin && (
          <>
            <Section title={`Awaiting your confirmation (${filtered("awaiting_review").length})`} highlight>
              {filtered("awaiting_review").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} onCancelRefund={onCancelRefund} onRefresh={refresh} />
              ))}
              {filtered("awaiting_review").length === 0 && <Empty />}
            </Section>
            <Section title={`Holding for payment (${filtered("pending_payment").length})`}>
              {filtered("pending_payment").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} onCancelRefund={onCancelRefund} onRefresh={refresh} />
              ))}
              {filtered("pending_payment").length === 0 && <Empty />}
            </Section>
            <Section title={`Confirmed (${filtered("confirmed").length})`}>
              {filtered("confirmed").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onMarkPaid={onMarkPaid} onDelete={onDelete} onCancelRefund={onCancelRefund} onRefresh={refresh} />
              ))}
              {filtered("confirmed").length === 0 && <Empty />}
            </Section>
            <Section title={`Fully paid (${filtered("fully_paid").length})`}>
              {filtered("fully_paid").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} onCancelRefund={onCancelRefund} onRefresh={refresh} />
              ))}
              {filtered("fully_paid").length === 0 && <Empty />}
            </Section>
            <Section title={`Cancelled / expired`}>
              {bookings
                .filter((b) => b.status === "cancelled" || b.status === "expired")
                .map((b) => (
                  <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} />
                ))}
            </Section>
          </>
        )}
      </section>
    </main>
  );
}

function Section({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="mt-10">
      <h2 className={`text-sm font-medium uppercase tracking-widest ${highlight ? "text-forest" : "text-stone"}`}>
        {title}
      </h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-stone">Nothing here.</p>;
}

function Card({
  b, onConfirm, onReject, onMarkPaid, onDelete, onCancelRefund, onRefresh,
}: {
  b: Booking;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onMarkPaid?: (b: Booking) => void;
  onDelete?: (id: string) => void;
  onCancelRefund?: (b: Booking) => void;
  onRefresh?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [savingPrice, setSavingPrice] = useState(false);

  function openEdit() {
    const d: Record<string, number> = {};
    for (const r of b.rooms ?? []) d[r.id] = Number(r.total ?? 0);
    setDraft(d);
    setEditing(true);
  }
  async function savePrices() {
    setSavingPrice(true);
    try {
      const rows = Object.entries(draft).map(([id, amount]) => ({ id, amount: Number(amount) || 0 }));
      await updateBookingRoomPrices({ data: { bookingId: b.id, rows } });
      setEditing(false);
      onRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update prices");
    } finally {
      setSavingPrice(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone">
            {b.payment_reference ?? "—"} · {(b.rooms?.length ?? 1) > 1
              ? `${b.rooms?.length} rooms`
              : b.room_type}
          </p>
          <h3 className="mt-1 font-display text-xl text-forest">{b.guest_name}</h3>
          <p className="text-sm text-foreground/70">
            {b.email} · {b.phone}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${
              b.payment_method === "stripe"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {b.payment_method === "stripe" ? "Card · auto-confirmed" : "Bank transfer"}
          </span>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-forest">
            RM {Number(b.total_amount ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-stone">
            {b.nights ?? "?"} night{(b.nights ?? 0) > 1 ? "s" : ""} · {b.guests} guests
          </p>
          <Link
            to="/admin/invoice/$id"
            params={{ id: b.id }}
            className="mt-2 inline-block text-[11px] uppercase tracking-widest text-forest underline hover:no-underline"
          >
            View invoice
          </Link>
          {onRefresh && (
            <button
              onClick={openEdit}
              className="mt-1 ml-3 inline-block text-[11px] uppercase tracking-widest text-forest underline hover:no-underline"
            >
              Edit prices
            </button>
          )}
        </div>
      </div>
      {b.rooms && b.rooms.length > 1 && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-coconut/60 px-3 py-2 text-xs text-stone">
          {b.rooms.map((r) => (
            <li key={r.id} className="flex justify-between">
              <span>{r.name}</span>
              <span className="text-foreground">RM {r.total.toFixed(2)}</span>
            </li>
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
                <span className="flex items-center gap-1 text-xs">
                  RM
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft[r.id] ?? 0}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [r.id]: Number(e.target.value) }))
                    }
                    className="w-24 rounded border border-border bg-white px-2 py-1 text-sm"
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-stone">
            New total: RM {Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0).toFixed(2)}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={savePrices}
              disabled={savingPrice}
              className="rounded-full bg-forest px-4 py-1.5 text-[11px] uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60"
            >
              {savingPrice ? "Saving…" : "Save prices"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-border px-4 py-1.5 text-[11px] uppercase tracking-widest text-stone hover:text-forest"
            >
              Cancel
            </button>
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
        <p className="mt-4 text-xs text-emerald-700">
          Paid by card — auto-confirmed. No proof required.
        </p>
      ) : b.proofUrl ? (
        <a
          href={b.proofUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md border border-border px-4 py-2 text-xs uppercase tracking-widest text-forest hover:bg-coconut"
        >
          View payment proof
        </a>
      ) : (
        <p className="mt-4 text-xs text-stone">No proof uploaded yet.</p>
      )}
      {(b.status === "awaiting_review" || b.status === "pending_payment") && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => onConfirm(b.id)}
            className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90"
          >
            Confirm payment
          </button>
          <button
            onClick={() => onReject(b.id)}
            className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone hover:text-forest"
          >
            Reject
          </button>
          <a
            href={`https://wa.me/${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
              `Hi ${b.guest_name}, regarding your Rajawali D'Cabin booking ${b.payment_reference}…`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-stone hover:text-forest"
          >
            WhatsApp guest
          </a>
        </div>
      )}
      {b.status === "confirmed" && onMarkPaid && (
        <div className="mt-5 flex flex-wrap gap-2">
          {b.balance_paid_at && (
            <span className="rounded-full bg-coconut px-4 py-2 text-[11px] uppercase tracking-widest text-forest">
              Room rate balance proof uploaded {new Date(b.balance_paid_at).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={() => onMarkPaid(b)}
            className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90"
          >
            Mark fully paid + set locker code
          </button>
        </div>
      )}
      {b.status === "fully_paid" && b.locker_code && (
        <p className="mt-4 text-xs text-forest">Locker code: <span className="font-mono">{b.locker_code}</span></p>
      )}
      {onDelete && (
        <div className="mt-4 border-t border-border/60 pt-3">
          {onCancelRefund &&
            b.payment_method === "stripe" &&
            b.status !== "cancelled" &&
            b.status !== "expired" && (
              <button
                onClick={() => onCancelRefund(b)}
                className="mr-4 text-[11px] uppercase tracking-widest text-amber-700 underline hover:no-underline"
              >
                Cancel + refund card
              </button>
            )}
          <button
            onClick={() => onDelete(b.id)}
            className="text-[11px] uppercase tracking-widest text-red-700 underline hover:no-underline"
          >
            Delete reservation
          </button>
        </div>
      )}
    </article>
  );
}

function ManualBookingForm({
  cabins,
  onDone,
}: {
  cabins: Array<{ id: string; name: string; cabin_type: string }>;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [cabinIds, setCabinIds] = useState<string[]>(cabins[0] ? [cabins[0].id] : []);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState(2);
  const [kids, setKids] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"confirmed" | "fully_paid" | "pending_payment">("confirmed");
  const [saving, setSaving] = useState(false);
  // Per-cabin price map. `overridden` tracks which rows the owner edited manually.
  const [perRoom, setPerRoom] = useState<Record<string, number>>({});
  const [overridden, setOverridden] = useState<Record<string, boolean>>({});
  const [quoting, setQuoting] = useState(false);

  // Auto-quote prices whenever selected cabins or dates change — but never
  // overwrite a value the owner has manually edited.
  useEffect(() => {
    if (cabinIds.length === 0) return;
    if (new Date(checkOut) <= new Date(checkIn)) return;
    const idsToQuote = cabinIds.filter((id) => !overridden[id]);
    if (idsToQuote.length === 0) return;
    let cancelled = false;
    setQuoting(true);
    quoteRoomPrices({ data: { cabinIds: idsToQuote, checkIn, checkOut } })
      .then((res) => {
        if (cancelled) return;
        setPerRoom((prev) => {
          const next = { ...prev };
          for (const q of res.quotes) next[q.cabinId] = q.total;
          return next;
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [cabinIds.join(","), checkIn, checkOut]);

  const totalAmount = cabinIds.reduce((s, id) => s + (Number(perRoom[id]) || 0), 0);

  useEffect(() => {
    if (cabinIds.length === 0 && cabins[0]) setCabinIds([cabins[0].id]);
  }, [cabins, cabinIds.length]);

  function toggleCabin(id: string) {
    setCabinIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // If unchecking, drop any override so re-adding later re-quotes cleanly.
    setOverridden((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function setRoomPrice(id: string, val: number) {
    setPerRoom((prev) => ({ ...prev, [id]: val }));
    setOverridden((prev) => ({ ...prev, [id]: true }));
  }

  function resetRoomPrice(id: string) {
    setOverridden((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Trigger re-quote for just this room.
    quoteRoomPrices({ data: { cabinIds: [id], checkIn, checkOut } })
      .then((res) => {
        const q = res.quotes[0];
        if (q) setPerRoom((prev) => ({ ...prev, [id]: q.total }));
      })
      .catch(() => {});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cabinIds.length === 0 || !guestName.trim()) {
      alert("Please pick at least one cabin and enter a guest name.");
      return;
    }
    setSaving(true);
    try {
      const perRoomAmounts = cabinIds.map((cid) => ({
        cabinId: cid,
        amount: Number(perRoom[cid]) || 0,
      }));
      const composedNotes = (() => {
        const parts: string[] = [];
        if (kids > 0) parts.push(`Children under 12: ${kids}`);
        if (notes.trim()) parts.push(notes.trim());
        return parts.join("\n");
      })();
      await adminCreateBooking({
        data: {
          cabinIds,
          checkIn,
          checkOut,
          guestName: guestName.trim(),
          phone,
          email,
          guests,
          totalAmount,
          notes: composedNotes,
          status,
          perRoomAmounts,
        },
      });
      onDone();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add booking");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-xl border border-border bg-coconut/40 p-5"
    >
      <h2 className="font-display text-lg text-forest">Add manual booking</h2>
      <p className="mt-1 text-xs text-stone">For reservations confirmed outside the website (WhatsApp, walk-in, etc.).</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="text-[10px] uppercase tracking-widest text-stone">
            Cabins ({cabinIds.length} selected)
          </span>
          <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-3">
            {cabins.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cabinIds.includes(c.id)}
                  onChange={() => toggleCabin(c.id)}
                />
                <span>
                  {c.name}{" "}
                  <span className="text-xs text-stone">({c.cabin_type})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input">
            <option value="confirmed">Confirmed</option>
            <option value="fully_paid">Fully paid</option>
            <option value="pending_payment">Pending payment</option>
          </select>
        </Field>
        <Field label="Check-in">
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input" />
        </Field>
        <Field label="Check-out">
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="input" />
        </Field>
        <Field label="Guest name">
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="input" required />
        </Field>
        <Field label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <Field label="Email (optional)">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Guests">
          <input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="input" />
        </Field>
        <Field label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>
      </div>
      {cabinIds.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-stone">
              Room prices {quoting && <span className="ml-2 normal-case text-stone/70">quoting…</span>}
            </p>
            <p className="text-xs text-stone">
              Total: <span className="font-display text-forest">RM {totalAmount.toFixed(2)}</span>
            </p>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {cabinIds.map((cid) => {
              const c = cabins.find((x) => x.id === cid);
              if (!c) return null;
              return (
                <li key={cid} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex-1">
                    {c.name}{" "}
                    <span className="text-xs text-stone">({c.cabin_type})</span>
                    {overridden[cid] && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-800">
                        custom
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    RM
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={perRoom[cid] ?? 0}
                      onChange={(e) => setRoomPrice(cid, Number(e.target.value))}
                      className="w-24 rounded border border-border bg-white px-2 py-1 text-sm"
                    />
                    {overridden[cid] && (
                      <button
                        type="button"
                        onClick={() => resetRoomPrice(cid)}
                        className="text-[10px] uppercase tracking-widest text-forest underline"
                      >
                        reset
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-stone">
            Prices are auto-fetched from the room's weekday / weekend / holiday rate for the selected dates. Edit any row to override.
          </p>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save booking"}
        </button>
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:#fff;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;}`}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-stone">{label}</span>
      {children}
    </label>
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