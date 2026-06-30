import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listBookings,
  confirmBooking,
  rejectBooking,
  isCurrentUserAdmin,
  markFullyPaid,
} from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/admin")({
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
        <h1 className="mt-2 font-display text-4xl text-forest">Bookings</h1>
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
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} />
              ))}
              {filtered("awaiting_review").length === 0 && <Empty />}
            </Section>
            <Section title={`Holding for payment (${filtered("pending_payment").length})`}>
              {filtered("pending_payment").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} />
              ))}
              {filtered("pending_payment").length === 0 && <Empty />}
            </Section>
            <Section title={`Confirmed (${filtered("confirmed").length})`}>
              {filtered("confirmed").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} onMarkPaid={onMarkPaid} />
              ))}
              {filtered("confirmed").length === 0 && <Empty />}
            </Section>
            <Section title={`Fully paid (${filtered("fully_paid").length})`}>
              {filtered("fully_paid").map((b) => (
                <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} />
              ))}
              {filtered("fully_paid").length === 0 && <Empty />}
            </Section>
            <Section title={`Cancelled / expired`}>
              {bookings
                .filter((b) => b.status === "cancelled" || b.status === "expired")
                .map((b) => (
                  <Card key={b.id} b={b} onConfirm={onConfirm} onReject={onReject} />
                ))}
            </Section>
          </>
        )}
      </section>
    </main>
  );
}

export function AdminTabs({ current }: { current: string }) {
  const tabs: Array<{ id: string; label: string; to: string }> = [
    { id: "bookings", label: "Bookings", to: "/admin" },
    { id: "calendar", label: "Calendar", to: "/admin/calendar" },
    { id: "cabins", label: "Cabins", to: "/admin/cabins" },
    { id: "holidays", label: "Holidays", to: "/admin/holidays" },
    { id: "stats", label: "Stats", to: "/admin/stats" },
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
  b, onConfirm, onReject, onMarkPaid,
}: {
  b: Booking;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onMarkPaid?: (b: Booking) => void;
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