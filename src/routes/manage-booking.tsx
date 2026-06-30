import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getBookingForGuest,
  attachBalanceProof,
  getBookingByEmailAndReference,
} from "@/lib/booking.functions";
import duitnowQrAsset from "@/assets/duitnow-qr.png.asset.json";

type Booking = Awaited<ReturnType<typeof getBookingForGuest>>;

export const Route = createFileRoute("/manage-booking")({
  validateSearch: (raw: Record<string, unknown>) => ({
    id: typeof raw.id === "string" ? raw.id : "",
    token: typeof raw.token === "string" ? raw.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Manage your booking — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "View your Rajawali D'Cabin reservation, upload your balance payment proof, and review your cabin and stay details." },
      { property: "og:title", content: "Manage your booking — Rajawali D'Cabin" },
      { property: "og:description", content: "View your reservation, upload balance proof, and manage your Rajawali D'Cabin stay." },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { id, token } = Route.useSearch();
  const navigate = useNavigate();
  const [b, setB] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupRef, setLookupRef] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  async function load() {
    if (!id || !token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getBookingForGuest({ data: { bookingId: id, guestToken: token } });
      setB(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load booking");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id, token]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLookingUp(true);
    try {
      const { bookingId, guestToken } = await getBookingByEmailAndReference({
        data: { email: lookupEmail.trim(), reference: lookupRef.trim() },
      });
      navigate({ to: "/manage-booking", search: { id: bookingId, token: guestToken } });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not find booking");
    } finally {
      setLookingUp(false);
    }
  }

  async function upload() {
    if (!file || !b) return;
    setUploading(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `bookings/${b.id}/balance-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      await attachBalanceProof({ data: { bookingId: b.id, guestToken: token, path } });
      setDone(true);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
          <div className="flex items-center gap-5">
            <Link to="/find-booking" className="text-xs uppercase tracking-widest text-stone hover:text-forest">Lost link?</Link>
            <Link to="/" className="text-xs uppercase tracking-widest text-stone hover:text-forest">Home</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        {loading && <p className="text-stone">Loading your booking…</p>}

        {!id || !token ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Manage booking</p>
            <h1 className="mt-2 font-display text-4xl text-forest">View your booking</h1>
            <p className="mt-3 text-foreground/75">
              Enter the email you booked with and your booking reference (e.g. RJW-1234).
            </p>
            <form onSubmit={lookup} className="mt-8 space-y-5 max-w-md">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.25em] text-stone">Email</span>
                <input
                  type="email"
                  required
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-forest focus:outline-none"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.25em] text-stone">Booking reference</span>
                <input
                  type="text"
                  required
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value.toUpperCase())}
                  className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 font-mono text-sm focus:border-forest focus:outline-none"
                  placeholder="RJW-1234"
                  maxLength={40}
                />
              </label>
              {err && (
                <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
              )}
              <button
                type="submit"
                disabled={lookingUp}
                className="w-full rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-coconut hover:bg-forest/90 disabled:opacity-60"
              >
                {lookingUp ? "Looking up…" : "View booking"}
              </button>
              <p className="text-xs text-stone">
                Prefer a secure link by email?{" "}
                <Link to="/find-booking" className="underline text-forest">Email me the manage link</Link>.
              </p>
            </form>
          </div>
        ) : null}

        {err && id && token && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
        )}
        {b && (
          <>
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Manage booking</p>
            <h1 className="mt-2 font-display text-4xl text-forest">Hi {b.guestName.split(" ")[0]},</h1>
            <p className="mt-3 text-foreground/75">
              Booking reference <span className="font-mono text-forest">{b.reference ?? b.id.slice(0,8)}</span>
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-stone">Cabin{(b.rooms?.length ?? 1) > 1 ? "s" : ""}</dt>
                <dd>
                  {b.rooms && b.rooms.length > 1 ? (
                    <ul className="flex flex-col gap-0.5">
                      {b.rooms.map((r) => (
                        <li key={r.id}>{r.name}</li>
                      ))}
                    </ul>
                  ) : (
                    b.roomType
                  )}
                </dd>
                <dt className="text-stone">Check-in</dt><dd>{b.checkIn} (3:00 PM)</dd>
                <dt className="text-stone">Check-out</dt><dd>{b.checkOut} (12:00 PM)</dd>
                <dt className="text-stone">Guests</dt><dd>{b.guests} · {b.nights ?? "—"} night(s)</dd>
                <dt className="text-stone">Total</dt><dd>RM {b.total.toFixed(2)}</dd>
                <dt className="text-stone">Deposit paid</dt><dd>RM {b.deposit.toFixed(2)} ✓</dd>
                <dt className="text-stone font-medium">Balance due</dt>
                <dd className="font-medium text-forest">RM {b.remaining.toFixed(2)}</dd>
              </dl>
            </div>

            {b.status === "fully_paid" ? (
              <div className="mt-8 rounded-2xl border border-forest/30 bg-coconut p-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-forest">Fully paid ✓</p>
                <h2 className="mt-2 font-display text-2xl text-forest">You're all set.</h2>
                <p className="mt-3 text-sm text-foreground/80">
                  Self check-in is via the key locker at the cabin.
                </p>
                {b.lockerCode ? (
                  <p className="mt-4 rounded-xl bg-card px-5 py-4 font-mono text-2xl text-forest">
                    Locker code: {b.lockerCode}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-stone">
                    Your key-locker code will be sent via WhatsApp / email on your check-in day.
                  </p>
                )}
              </div>
            ) : b.balancePaidAt && !done ? (
              <div className="mt-8 rounded-2xl border border-border bg-card p-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Balance proof received</p>
                <h2 className="mt-2 font-display text-xl text-forest">Awaiting owner confirmation</h2>
                <p className="mt-3 text-sm text-foreground/75">
                  We'll verify your transfer and send your key-locker code shortly.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-8 rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs uppercase tracking-widest text-stone">Pay the balance</p>
                  <p className="mt-2 text-2xl font-display text-forest">RM {b.remaining.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-stone">Reference: <strong>{b.reference}</strong></p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-border p-4 text-sm">
                      <p className="text-stone uppercase text-[10px] tracking-widest">Bank transfer</p>
                      <p className="mt-1 font-display text-base text-forest">CIMB Bank</p>
                      <p className="mt-2 font-mono">8600095810</p>
                      <p className="text-stone">Mohd Fauzi Awang</p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-stone uppercase text-[10px] tracking-widest">DuitNow QR</p>
                      <img src={duitnowQrAsset.url} alt="DuitNow QR" className="mt-2 aspect-square w-full rounded-md object-contain" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs uppercase tracking-widest text-stone">Upload proof of payment</p>
                  <input
                    type="file" accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-4 block w-full text-sm"
                  />
                  <button
                    onClick={upload} disabled={!file || uploading}
                    className="mt-5 rounded-full bg-forest px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60"
                  >
                    {uploading ? "Uploading…" : "Submit balance proof"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}