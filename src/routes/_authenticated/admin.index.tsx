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
} from "@/lib/booking.functions";

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
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
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
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="rounded-full bg-forest px-5 py-2 text-xs font-medium uppercase tracking-widest text-coconut hover:bg-forest/90"
            >
              {showAdd ? "Close" : "+ Add manual booking"}
            </button>
          )}
        </div>
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
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} />
              ))}
              {filtered("awaiting_review").length === 0 && <Empty />}
            </Section>
            <Section title={`Holding for payment (${filtered("pending_payment").length})`}>
              {filtered("pending_payment").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} />
              ))}
              {filtered("pending_payment").length === 0 && <Empty />}
            </Section>
            <Section title={`Confirmed (${filtered("confirmed").length})`}>
              {filtered("confirmed").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onMarkPaid={onMarkPaid} onDelete={onDelete} />
              ))}
              {filtered("confirmed").length === 0 && <Empty />}
            </Section>
            <Section title={`Fully paid (${filtered("fully_paid").length})`}>
              {filtered("fully_paid").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onDelete={onDelete} />
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
  b, onConfirm, onReject, onMarkPaid, onDelete,
}: {
  b: Booking;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onMarkPaid?: (b: Booking) => void;
  onDelete?: (id: string) => void;
}) {
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
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Row label="Check-in" value={b.check_in} />
        <Row label="Check-out" value={b.check_out} />
        <Row label="Comforter" value={b.comforter ? "Yes (+RM20/night)" : "No"} />
        <Row label="Submitted" value={new Date(b.created_at).toLocaleString()} />
      </dl>
      {b.notes && <p className="mt-3 text-sm text-foreground/75">Notes: {b.notes}</p>}
      {b.proofUrl ? (
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
              Balance proof uploaded {new Date(b.balance_paid_at).toLocaleDateString()}
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
  const [cabinId, setCabinId] = useState(cabins[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState(2);
  const [totalAmount, setTotalAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"confirmed" | "fully_paid" | "pending_payment">("confirmed");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cabinId && cabins[0]) setCabinId(cabins[0].id);
  }, [cabins, cabinId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cabinId || !guestName.trim()) {
      alert("Please pick a cabin and enter a guest name.");
      return;
    }
    setSaving(true);
    try {
      await adminCreateBooking({
        data: { cabinId, checkIn, checkOut, guestName: guestName.trim(), phone, email, guests, totalAmount, notes, status },
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
        <Field label="Cabin">
          <select value={cabinId} onChange={(e) => setCabinId(e.target.value)} className="input">
            {cabins.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.cabin_type})
              </option>
            ))}
          </select>
        </Field>
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
          <input type="number" min={1} max={12} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="input" />
        </Field>
        <Field label="Total (RM)">
          <input type="number" min={0} step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} className="input" />
        </Field>
        <Field label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>
      </div>
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