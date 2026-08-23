import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  getWaAdminDashboard,
  retryWaOutbox,
  waAdminBookingAction,
  waAdminConversationAction,
} from "@/lib/wa-admin.functions";
import { bookingStatus, handoffActions, holdStatus, runtimeStatus } from "@/lib/whatsapp-ui";

import { AdminTabs } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp operations — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WhatsAppOperationsPage,
});

type WaDashboard = Awaited<ReturnType<typeof getWaAdminDashboard>>;
type WaBooking = WaDashboard["bookings"][number];
type WaConversation = WaDashboard["conversations"][number];
type WaOutbox = WaDashboard["outbox"][number];
type WaActivity = WaDashboard["activity"][number];
type BookingAction =
  "approve" | "reject" | "request-proof" | "extend-hold" | "expire-hold" | "cancel" | "message";

const actionButton =
  "rounded-full border border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-foreground transition hover:border-forest hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-50";

function WhatsAppOperationsPage() {
  const [dashboard, setDashboard] = useState<WaDashboard | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<WaBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const next = await getWaAdminDashboard();
      setDashboard(next);
      setSelected((current) =>
        current
          ? (next.bookings.find((booking) => booking.groupId === current.groupId) ?? null)
          : null,
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load WhatsApp operations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const channel = supabase
      .channel("wa-admin-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_requests",
          filter: "source=eq.wa",
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);

  const bookings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (dashboard?.bookings ?? []).filter((booking) => {
      const matchesStatus = filter === "all" || booking.status === filter;
      const matchesQuery =
        !needle ||
        [booking.guestName, booking.reference, booking.phone, booking.roomType]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [dashboard?.bookings, filter, query]);

  const counts = useMemo(() => {
    const rows = dashboard?.bookings ?? [];
    return {
      review: rows.filter((booking) => booking.status === "awaiting_review").length,
      holds: rows.filter((booking) => booking.status === "pending_payment").length,
      expired: rows.filter((booking) => booking.status === "expired").length,
      failed: (dashboard?.outbox ?? []).filter((row) => row.status === "failed").length,
      handoffs: (dashboard?.conversations ?? []).filter((conversation) => conversation.paused)
        .length,
    };
  }, [dashboard]);

  return (
    <main id="top" className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5 lg:px-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone">Owner dashboard</p>
            <h1 className="font-display text-2xl text-forest">WhatsApp operations</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/settings"
              className="text-xs uppercase tracking-widest text-forest underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              WhatsApp settings
            </Link>
            <button type="button" onClick={() => void refresh()} className={actionButton}>
              Refresh
            </button>
          </div>
        </div>
        <AdminTabs current="whatsapp" />
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Proofs to review" value={counts.review} />
          <Metric label="Payment holds" value={counts.holds} />
          <Metric label="Expired holds" value={counts.expired} />
          <Metric label="Failed sends" value={counts.failed} />
          <Metric label="Staff handoffs" value={counts.handoffs} />
        </div>

        <section
          className="mt-6 rounded-xl border border-border bg-card p-5"
          aria-labelledby="waha-status-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-stone">Runtime health</p>
              <h2 id="waha-status-title" className="mt-1 font-display text-2xl text-forest">
                WAHA session
              </h2>
            </div>
            <StatusPill {...runtimeStatus(dashboard?.runtime.state)} />
          </div>
          <p className="mt-3 text-sm text-stone">
            {dashboard?.runtime.observedAt
              ? `Last report ${new Date(dashboard.runtime.observedAt).toLocaleString()}${
                  dashboard.runtime.session ? ` · ${dashboard.runtime.session}` : ""
                }`
              : "No runtime report has reached Lovable Cloud yet."}
          </p>
          {dashboard?.runtime.lastError && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
              Bridge report: {dashboard.runtime.lastError}
            </p>
          )}
        </section>

        <section
          className="mt-6 rounded-xl border border-border bg-card p-5"
          aria-labelledby="booking-queue-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-stone">
                Booking and proof queue
              </p>
              <h2 id="booking-queue-title" className="mt-1 font-display text-2xl text-forest">
                WhatsApp bookings
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="grid gap-1 text-xs text-stone">
                Booking state
                <select
                  name="whatsapp-booking-state"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <option value="all">All states</option>
                  <option value="awaiting_review">Proof awaiting review</option>
                  <option value="pending_payment">Payment hold</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-stone">
                Search WhatsApp bookings
                <input
                  name="whatsapp-booking-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Guest, reference or phone…"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
              </label>
            </div>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-stone">Loading…</p>
          ) : bookings.length ? (
            <div className="mt-5 grid gap-3">
              {bookings.map((booking) => (
                <BookingRow
                  key={booking.groupId}
                  booking={booking}
                  onOpen={() => setSelected(booking)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-stone">No WhatsApp bookings match this filter.</p>
          )}
        </section>

        {dashboard && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ConversationQueue dashboard={dashboard} onDone={refresh} />
            <DeliveryQueue dashboard={dashboard} onDone={refresh} />
          </div>
        )}

        {selected && dashboard && (
          <BookingDetail
            booking={selected}
            activity={dashboard.activity.filter(
              (item) => item.bookingGroupId === selected.groupId || item.chatId === selected.chatId,
            )}
            onClose={() => setSelected(null)}
            onDone={refresh}
          />
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-stone">{label}</p>
      <p className="mt-2 font-display text-3xl text-forest">{value}</p>
    </div>
  );
}

function BookingRow({ booking, onOpen }: { booking: WaBooking; onOpen: () => void }) {
  const status = bookingStatus(booking.status);
  const hold = holdStatus(booking.holdExpiresAt);

  return (
    <article className="rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-stone">
            {booking.reference ?? "No reference"} · {booking.roomType}
          </p>
          <h3 className="mt-1 font-display text-xl text-forest">{booking.guestName}</h3>
          <p className="mt-1 text-sm text-stone">
            {booking.checkIn} – {booking.checkOut} · {booking.guests} guests
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusPill {...status} />
          {booking.status === "pending_payment" && (
            <StatusPill label={hold.label} tone={hold.expired ? "expired" : "payment"} />
          )}
          {booking.proof?.status === "rejected" && (
            <StatusPill label="Proof resubmission requested" tone="review" />
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <p className="text-sm text-stone">RM {booking.totalAmount.toFixed(2)}</p>
        <button type="button" onClick={onOpen} className={actionButton}>
          Open detail
        </button>
      </div>
    </article>
  );
}

function ConversationQueue({
  dashboard,
  onDone,
}: {
  dashboard: WaDashboard;
  onDone: () => Promise<void>;
}) {
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = dashboard.conversations
    .filter((row) => row.paused || row.failureCount > 0)
    .slice(0, 8);

  async function run(chatId: string, action: "pause" | "takeover" | "resume") {
    setWorking(`${chatId}-${action}`);
    setError(null);
    try {
      await waAdminConversationAction({ data: { chatId, action } });
      await onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the handoff");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section
      className="rounded-xl border border-border bg-card p-5"
      aria-labelledby="handoff-queue-title"
    >
      <p className="text-[10px] uppercase tracking-[0.25em] text-stone">Conversation queue</p>
      <h2 id="handoff-queue-title" className="mt-1 font-display text-2xl text-forest">
        Handoffs and recovery
      </h2>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <ConversationRow key={row.chatId} row={row} working={working} onRun={run} />
        ))}
        {!rows.length && (
          <p className="text-sm text-stone">No active handoffs or recovery states.</p>
        )}
      </div>
    </section>
  );
}

function ConversationRow({
  row,
  working,
  onRun,
}: {
  row: WaConversation;
  working: string | null;
  onRun: (chatId: string, action: "pause" | "takeover" | "resume") => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="break-all text-xs text-stone">{row.chatId}</p>
      <p className="mt-1 text-sm">
        State: <strong>{row.state}</strong>
        {row.failureCount > 0
          ? ` · ${row.failureCount} input error${row.failureCount === 1 ? "" : "s"}`
          : ""}
      </p>
      <p className="mt-1 text-xs text-stone">Updated {new Date(row.updatedAt).toLocaleString()}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {handoffActions(row.paused).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => void onRun(row.chatId, action)}
            disabled={working !== null}
            className={actionButton}
          >
            {working === `${row.chatId}-${action}`
              ? action === "resume"
                ? "Resuming…"
                : action === "takeover"
                  ? "Starting…"
                  : "Pausing…"
              : action === "resume"
                ? "Resume bot"
                : action === "takeover"
                  ? "Staff takeover"
                  : "Pause bot"}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeliveryQueue({
  dashboard,
  onDone,
}: {
  dashboard: WaDashboard;
  onDone: () => Promise<void>;
}) {
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = dashboard.outbox.filter((row) => row.status === "failed").slice(0, 8);

  async function retry(id: string) {
    setWorking(id);
    setError(null);
    try {
      await retryWaOutbox({ data: { id } });
      await onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retry the message");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section
      className="rounded-xl border border-border bg-card p-5"
      aria-labelledby="delivery-queue-title"
    >
      <p className="text-[10px] uppercase tracking-[0.25em] text-stone">Outbound delivery</p>
      <h2 id="delivery-queue-title" className="mt-1 font-display text-2xl text-forest">
        Retry and error states
      </h2>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <DeliveryRow key={row.id} row={row} working={working} onRetry={retry} />
        ))}
        {!rows.length && <p className="text-sm text-stone">No failed outbound messages.</p>}
      </div>
    </section>
  );
}

function DeliveryRow({
  row,
  working,
  onRetry,
}: {
  row: WaOutbox;
  working: string | null;
  onRetry: (id: string) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
      <p className="text-sm font-medium">{row.kind.replace(/-/g, " ")}</p>
      <p className="mt-1 break-all text-xs text-stone">{row.chatId}</p>
      <p className="mt-1 text-xs text-red-800">
        Send failed after {row.attempts} attempt{row.attempts === 1 ? "" : "s"}:{" "}
        {row.lastError ?? "No error returned"}
      </p>
      <button
        type="button"
        onClick={() => void onRetry(row.id)}
        disabled={working !== null}
        className={`mt-3 ${actionButton}`}
      >
        {working === row.id ? "Queuing retry…" : "Retry message"}
      </button>
    </div>
  );
}

function BookingDetail({
  booking,
  activity,
  onClose,
  onDone,
}: {
  booking: WaBooking;
  activity: WaActivity[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const status = bookingStatus(booking.status);
  const hold = holdStatus(booking.holdExpiresAt);

  async function run(action: BookingAction) {
    if (["reject", "request-proof", "cancel"].includes(action) && reason.trim().length < 3) {
      setError("Enter a reason of at least 3 characters before sending this action.");
      return;
    }
    if (action === "message" && !message.trim()) {
      setError("Enter a message before sending it.");
      return;
    }
    if (
      ["expire-hold", "cancel", "reject"].includes(action) &&
      !window.confirm(
        `Confirm ${action.replace(/-/g, " ")} for ${
          booking.reference ?? "this booking"
        }? This changes the live booking state.`,
      )
    ) {
      return;
    }

    setWorking(action);
    setError(null);
    try {
      if (action === "reject" || action === "request-proof" || action === "cancel") {
        await waAdminBookingAction({
          data: { action, bookingId: booking.id, reason: reason.trim() },
        });
      } else if (action === "extend-hold") {
        await waAdminBookingAction({
          data: { action, bookingId: booking.id, minutes: 30 },
        });
      } else if (action === "message") {
        await waAdminBookingAction({
          data: { action, bookingId: booking.id, message: message.trim() },
        });
      } else {
        await waAdminBookingAction({ data: { action, bookingId: booking.id } });
      }
      await onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the action");
    } finally {
      setWorking(null);
    }
  }

  async function runConversation(action: "pause" | "takeover" | "resume") {
    if (
      action !== "resume" &&
      !window.confirm(
        `${
          action === "takeover" ? "Start staff takeover" : "Pause the bot"
        } for ${booking.reference ?? "this booking"}?`,
      )
    ) {
      return;
    }

    setWorking(`conversation-${action}`);
    setError(null);
    try {
      await waAdminConversationAction({
        data: {
          chatId: booking.chatId,
          bookingGroupId: booking.groupId,
          action,
        },
      });
      await onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the staff handoff");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section
      className="mt-6 rounded-xl border border-border bg-card"
      aria-labelledby="whatsapp-booking-detail-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:p-7">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-stone">
            WhatsApp booking detail
          </p>
          <h2 id="whatsapp-booking-detail-title" className="mt-1 font-display text-3xl text-forest">
            {booking.reference ?? "No reference"}
          </h2>
          <p className="mt-1 text-sm text-stone">
            {booking.guestName} · {booking.phone}
          </p>
        </div>
        <button type="button" onClick={onClose} className={actionButton}>
          Close detail
        </button>
      </header>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill {...status} />
              {booking.status === "pending_payment" && (
                <StatusPill label={hold.label} tone={hold.expired ? "expired" : "payment"} />
              )}
              {booking.proof?.status === "rejected" && (
                <StatusPill label="Proof resubmission requested" tone="review" />
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
              <Detail label="Stay" value={`${booking.checkIn} – ${booking.checkOut}`} />
              <Detail label="Guests" value={String(booking.guests)} />
              <Detail label="Package" value={booking.roomType} />
              <Detail label="Add-ons" value={booking.comforter ? "Comforter" : "None"} />
              <Detail label="Total" value={`RM ${booking.totalAmount.toFixed(2)}`} />
              <Detail label="Deposit" value={`RM ${booking.depositAmount.toFixed(2)}`} />
              <Detail
                label="Conversation"
                value={`${booking.conversationState ?? "Not started"}${
                  booking.staffPaused ? " · staff takeover active" : ""
                }`}
              />
              <Detail label="Chat ID" value={booking.chatId} />
              <Detail label="Created" value={new Date(booking.createdAt).toLocaleString()} />
            </dl>
            {booking.rooms.length > 1 && (
              <p className="mt-4 text-sm text-stone">
                Rooms: {booking.rooms.map((room) => room.name).join(", ")}
              </p>
            )}
            {booking.notes && (
              <p className="mt-4 rounded-md bg-coconut/60 p-3 text-sm">
                Staff notes: {booking.notes}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-display text-xl text-forest">Private payment proof</h3>
            {booking.proof?.url ? (
              <>
                <p className="mt-2 text-sm text-stone">
                  Signed preview link expires shortly. It is created only for this authorized staff
                  view.
                </p>
                {booking.proof.mime?.startsWith("image/") ? (
                  <img
                    src={booking.proof.url}
                    alt={`Payment proof for ${booking.reference ?? "booking"}`}
                    className="mt-4 max-h-96 w-full rounded-lg border border-border object-contain"
                  />
                ) : (
                  <a
                    href={booking.proof.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-4 inline-flex ${actionButton}`}
                  >
                    Open private proof
                  </a>
                )}
                <p className="mt-3 text-xs text-stone">
                  Proof state: {booking.proof.status} · received{" "}
                  {new Date(booking.proof.createdAt).toLocaleString()}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone">
                No private proof is available for this booking.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-display text-xl text-forest">Audit history</h3>
            <ol className="mt-3 space-y-3 border-l border-border pl-4">
              {activity.map((item) => (
                <li key={item.id}>
                  <p className="text-sm">{item.summary}</p>
                  <p className="text-xs text-stone">{new Date(item.at).toLocaleString()}</p>
                </li>
              ))}
              {!activity.length && (
                <li className="text-sm text-stone">No audit activity recorded yet.</li>
              )}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-display text-xl text-forest">Authorized actions</h3>
            <p className="mt-2 text-sm text-stone">
              Each action is server-authorized and delivered through the private outbox. WAHA
              credentials never enter this panel.
            </p>
            {error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {booking.status === "awaiting_review" && (
                <button
                  type="button"
                  onClick={() => void run("approve")}
                  disabled={working !== null}
                  className={actionButton}
                >
                  {working === "approve" ? "Approving…" : "Approve proof"}
                </button>
              )}
              {booking.status === "awaiting_review" && (
                <button
                  type="button"
                  onClick={() => void run("reject")}
                  disabled={working !== null}
                  className={actionButton}
                >
                  Reject with reason
                </button>
              )}
              {booking.status === "awaiting_review" && (
                <button
                  type="button"
                  onClick={() => void run("request-proof")}
                  disabled={working !== null}
                  className={actionButton}
                >
                  Request new proof
                </button>
              )}
              {booking.status === "pending_payment" && (
                <button
                  type="button"
                  onClick={() => void run("extend-hold")}
                  disabled={working !== null}
                  className={actionButton}
                >
                  Extend hold 30 min
                </button>
              )}
              {booking.status === "pending_payment" && (
                <button
                  type="button"
                  onClick={() => void run("expire-hold")}
                  disabled={working !== null}
                  className={actionButton}
                >
                  Expire hold
                </button>
              )}
              {!["cancelled", "expired"].includes(booking.status) && (
                <button
                  type="button"
                  onClick={() => void run("cancel")}
                  disabled={working !== null}
                  className={actionButton}
                >
                  Cancel booking
                </button>
              )}
            </div>
            <label className="mt-4 block text-xs text-stone">
              Reason for rejection, new-proof request or cancellation
              <textarea
                name="booking-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Explain the next step clearly to the guest…"
                className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>
            <label className="mt-4 block text-xs text-stone">
              Message customer
              <textarea
                name="customer-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="Write the WhatsApp message…"
                className="mt-1 w-full rounded-md border border-border bg-card p-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>
            <button
              type="button"
              onClick={() => void run("message")}
              disabled={working !== null || !message.trim()}
              className={`mt-2 ${actionButton}`}
            >
              {working === "message" ? "Queuing message…" : "Message customer"}
            </button>
          </section>

          <section className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-display text-xl text-forest">Bot and staff handoff</h3>
            <p className="mt-2 text-sm text-stone">
              These controls apply directly to this booking&apos;s chat. A paused bot ignores new
              customer commands until resumed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {handoffActions(booking.staffPaused).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void runConversation(action)}
                  disabled={working !== null}
                  className={actionButton}
                >
                  {working === `conversation-${action}`
                    ? action === "resume"
                      ? "Resuming…"
                      : action === "takeover"
                        ? "Starting…"
                        : "Pausing…"
                    : action === "resume"
                      ? "Resume bot"
                      : action === "takeover"
                        ? "Staff takeover"
                        : "Pause bot"}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-stone">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  const tones: Record<string, string> = {
    review: "border-amber-300 bg-amber-50 text-amber-900",
    payment: "border-sky-300 bg-sky-50 text-sky-900",
    confirmed: "border-emerald-300 bg-emerald-50 text-emerald-900",
    expired: "border-red-300 bg-red-50 text-red-900",
    cancelled: "border-stone-300 bg-stone-100 text-stone-800",
    default: "border-border bg-coconut text-foreground",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${
        tones[tone] ?? tones.default
      }`}
    >
      {label}
    </span>
  );
}
