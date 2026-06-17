import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createBooking,
  previewPrice,
  attachPaymentProof,
  getTakenDates,
} from "@/lib/booking.functions";
import heroRiverside from "@/assets/hero-riverside.jpg";

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

type Cabin = {
  id: string;
  name: string;
  cabin_type: string;
  capacity: number;
  weekday_rate: number;
  weekend_rate: number;
  school_holiday_rate: number;
};

export const Route = createFileRoute("/book")({
  validateSearch: (raw: Record<string, unknown>) => ({
    checkin: typeof raw.checkin === "string" ? raw.checkin : today(),
    checkout: typeof raw.checkout === "string" ? raw.checkout : tomorrow(),
    guests: typeof raw.guests === "string" ? raw.guests : "2",
    room: typeof raw.room === "string" ? raw.room : "",
  }),
  head: () => ({
    meta: [
      { title: "Book your stay — Rajawali D'Cabin Chalet" },
      { name: "description", content: "Reserve a cabin at Rajawali D'Cabin Chalet, Kuala Ibai. Only 8 cabins, personally hosted." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookPage,
});

type Step = "details" | "payment" | "done";

function BookPage() {
  const search = Route.useSearch();

  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [cabinId, setCabinId] = useState<string>("");
  const [checkin, setCheckin] = useState(search.checkin);
  const [checkout, setCheckout] = useState(search.checkout);
  const [guests, setGuests] = useState(search.guests);
  const [comforter, setComforter] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [price, setPrice] = useState<{ nights: number; subtotal: number; comforter_total: number; total: number } | null>(null);
  const [taken, setTaken] = useState<string[]>([]);

  const [step, setStep] = useState<Step>("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState<{ bookingId: string; reference: string; total: number; holdExpiresAt: string } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load cabins
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cabins")
        .select("id, name, cabin_type, capacity, weekday_rate, weekend_rate, school_holiday_rate")
        .eq("is_active", true)
        .order("display_order");
      const list = (data ?? []) as Cabin[];
      setCabins(list);
      // pre-select based on ?room=
      const match = list.find((c) => c.name === search.room || c.cabin_type === search.room);
      setCabinId(match?.id ?? list[0]?.id ?? "");
    })();
  }, []);

  const selectedCabin = useMemo(() => cabins.find((c) => c.id === cabinId), [cabins, cabinId]);

  // Price preview
  useEffect(() => {
    if (!cabinId || !checkin || !checkout) return;
    if (new Date(checkout) <= new Date(checkin)) {
      setPrice(null);
      return;
    }
    (async () => {
      try {
        const p = await previewPrice({ data: { cabinId, checkIn: checkin, checkOut: checkout, comforter } });
        setPrice(p);
      } catch {
        setPrice(null);
      }
    })();
  }, [cabinId, checkin, checkout, comforter]);

  // Availability for selected cabin (next 90 days)
  useEffect(() => {
    if (!cabinId) return;
    (async () => {
      try {
        const from = today();
        const to = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        const r = await getTakenDates({ data: { cabinId, from, to } });
        setTaken(r.dates);
      } catch {
        setTaken([]);
      }
    })();
  }, [cabinId]);

  function datesOverlapTaken() {
    if (!checkin || !checkout) return false;
    const start = new Date(checkin);
    const end = new Date(checkout);
    for (const d of taken) {
      const dd = new Date(d);
      if (dd >= start && dd < end) return true;
    }
    return false;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cabinId) return setError("Please select a cabin");
    if (new Date(checkout) <= new Date(checkin)) return setError("Check-out must be after check-in");
    if (datesOverlapTaken()) return setError("Some of those nights are already booked. Please pick different dates.");
    if (name.trim().length < 2) return setError("Please enter your full name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Please enter a valid email");
    if (phone.trim().length < 5) return setError("Please enter your phone/WhatsApp");

    setSubmitting(true);
    try {
      const res = await createBooking({
        data: {
          cabinId,
          checkIn: checkin,
          checkOut: checkout,
          guests: Number(guests.replace("+", "")) || 1,
          comforter,
          guestName: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
        },
      });
      setBooking(res);
      setStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create booking");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadProof() {
    if (!proofFile || !booking) return;
    setUploading(true);
    setError(null);
    try {
      const ext = proofFile.name.split(".").pop() ?? "jpg";
      const path = `proofs/${booking.bookingId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, proofFile, { upsert: false });
      if (upErr) throw upErr;
      await attachPaymentProof({
        data: { bookingId: booking.bookingId, reference: booking.reference, path },
      });
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ============ RENDERING ============

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <BookHeader />
      {step === "details" && (
        <DetailsStep
          {...{
            cabins, cabinId, setCabinId,
            checkin, setCheckin, checkout, setCheckout,
            guests, setGuests, comforter, setComforter,
            name, setName, email, setEmail, phone, setPhone, notes, setNotes,
            price, selectedCabin, taken,
            submit, submitting, error,
          }}
        />
      )}
      {step === "payment" && booking && (
        <PaymentStep
          booking={booking}
          proofFile={proofFile}
          setProofFile={setProofFile}
          uploadProof={uploadProof}
          uploading={uploading}
          error={error}
          name={name}
          cabinName={selectedCabin?.name ?? ""}
          checkin={checkin}
          checkout={checkout}
        />
      )}
      {step === "done" && booking && (
        <DoneStep name={name} email={email} reference={booking.reference} />
      )}
    </main>
  );
}

// ============ STEP 1: details ============
function DetailsStep(props: {
  cabins: Cabin[]; cabinId: string; setCabinId: (s: string) => void;
  checkin: string; setCheckin: (s: string) => void;
  checkout: string; setCheckout: (s: string) => void;
  guests: string; setGuests: (s: string) => void;
  comforter: boolean; setComforter: (b: boolean) => void;
  name: string; setName: (s: string) => void;
  email: string; setEmail: (s: string) => void;
  phone: string; setPhone: (s: string) => void;
  notes: string; setNotes: (s: string) => void;
  price: { nights: number; subtotal: number; comforter_total: number; total: number } | null;
  selectedCabin?: Cabin;
  taken: string[];
  submit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string | null;
}) {
  const {
    cabins, cabinId, setCabinId, checkin, setCheckin, checkout, setCheckout,
    guests, setGuests, comforter, setComforter,
    name, setName, email, setEmail, phone, setPhone, notes, setNotes,
    price, selectedCabin, taken, submit, submitting, error,
  } = props;
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-10 lg:py-20">
      <form onSubmit={submit} className="order-2 lg:order-1">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">Step 1 of 2 — Your stay</p>
        <h1 className="mb-10 font-display text-4xl leading-tight sm:text-5xl">Reserve your cabin.</h1>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <Field label="Check-in" type="date" value={checkin} min={today()} onChange={setCheckin} />
          <Field label="Check-out" type="date" value={checkout} min={checkin} onChange={setCheckout} />
          <Select label="Guests" value={guests} onChange={setGuests} options={["1","2","3","4","5","6+"]} />
          <SelectCabin label="Cabin" value={cabinId} onChange={setCabinId} cabins={cabins} />
        </div>

        {taken.length > 0 && (
          <p className="mt-3 text-xs text-stone">
            Already booked for {selectedCabin?.name}:{" "}
            <span className="text-foreground/70">
              {taken.slice(0, 8).join(", ")}{taken.length > 8 ? "…" : ""}
            </span>
          </p>
        )}

        <label className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
          <input
            type="checkbox"
            checked={comforter}
            onChange={(e) => setComforter(e.target.checked)}
            className="h-4 w-4 accent-forest"
          />
          <span className="text-sm">
            Add comforter set <span className="text-stone">(+RM20 / night)</span>
          </span>
        </label>

        <p className="mt-8 mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">Step 2 — Your details</p>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <Field label="Full name" type="text" value={name} onChange={setName} placeholder="Aisyah Rahman" required />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
          <Field label="Phone / WhatsApp" type="tel" value={phone} onChange={setPhone} placeholder="+60 11 5500 7204" required full />
          <TextArea label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Arrival time, special requests…" />
        </div>

        {error && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 w-full rounded-full bg-forest px-7 py-4 text-sm font-medium uppercase tracking-widest text-coconut transition hover:bg-forest/90 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Holding your dates…" : "Continue to payment"}
        </button>
        <p className="mt-4 text-xs text-stone">
          Your dates are held for 30 minutes while you complete payment.
        </p>
      </form>

      <aside className="order-1 lg:order-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <img src={heroRiverside} alt="Rajawali D'Cabin riverside" className="aspect-[4/3] w-full object-cover" />
          <div className="p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Your stay</p>
            <h2 className="mt-2 font-display text-2xl text-forest">
              {selectedCabin?.name ?? "Select a cabin"}
            </h2>
            {selectedCabin && (
              <p className="mt-1 text-sm text-stone">
                Sleeps up to {selectedCabin.capacity} · RM{selectedCabin.weekday_rate}–{selectedCabin.school_holiday_rate}/night
              </p>
            )}
            <dl className="mt-6 divide-y divide-border text-sm">
              <Row label="Check-in" value={fmt(checkin)} />
              <Row label="Check-out" value={fmt(checkout)} />
              <Row label="Nights" value={String(price?.nights ?? "—")} />
              <Row label="Guests" value={guests} />
              {price && (
                <>
                  <Row label="Room subtotal" value={`RM ${price.subtotal.toFixed(2)}`} />
                  {price.comforter_total > 0 && (
                    <Row label="Comforter" value={`RM ${price.comforter_total.toFixed(2)}`} />
                  )}
                </>
              )}
            </dl>
            {price && (
              <div className="mt-4 flex items-baseline justify-between rounded-xl bg-coconut px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-stone">Total</span>
                <span className="font-display text-2xl text-forest">RM {price.total.toFixed(2)}</span>
              </div>
            )}
            <p className="mt-4 text-xs text-stone">
              Pricing varies by weekday, weekend & school holiday.
            </p>
          </div>
        </div>
      </aside>
    </section>
  );
}

// ============ STEP 2: payment ============
function PaymentStep({
  booking, proofFile, setProofFile, uploadProof, uploading, error, name, cabinName, checkin, checkout,
}: {
  booking: { bookingId: string; reference: string; total: number; holdExpiresAt: string };
  proofFile: File | null;
  setProofFile: (f: File | null) => void;
  uploadProof: () => void;
  uploading: boolean;
  error: string | null;
  name: string;
  cabinName: string;
  checkin: string;
  checkout: string;
}) {
  const [remaining, setRemaining] = useState(Math.max(0, new Date(booking.holdExpiresAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, new Date(booking.holdExpiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [booking.holdExpiresAt]);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  const acctNum = "8600095810";
  const acctName = "Mohd Fauzi Awang";
  const bank = "CIMB Islamic (Current Account)";

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Step 2 of 2 — Payment</p>
      <h1 className="mt-2 font-display text-4xl text-forest">Pay directly to the owner.</h1>
      <p className="mt-3 text-foreground/75">
        Your booking is held for{" "}
        <span className={`font-medium ${remaining < 5 * 60000 ? "text-red-700" : "text-forest"}`}>
          {mm}:{ss}
        </span>
        . Transfer the full amount and upload your receipt below — we'll confirm on WhatsApp.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone">Total to pay</p>
            <p className="font-display text-4xl text-forest">RM {booking.total.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-stone">Reference</p>
            <p className="font-mono text-lg text-forest">{booking.reference}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone">
          Please include the reference <strong>{booking.reference}</strong> in your transfer remark so we can match it quickly.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-stone">Bank transfer / DuitNow</p>
          <p className="mt-2 font-display text-xl text-forest">{bank}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-stone">Account no.</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono">{acctNum}</span>
                <button onClick={() => copy(acctNum)} className="text-[10px] uppercase tracking-widest text-forest hover:underline">Copy</button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-stone">Account name</dt>
              <dd>{acctName}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-stone">E-wallet QR</p>
          <p className="mt-2 font-display text-xl text-forest">DuitNow / TnG QR</p>
          <div className="mt-4 flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border bg-coconut text-center text-xs text-stone">
            QR image placeholder<br/>(owner can upload via admin later)
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-stone">Step 3 — Upload payment proof</p>
        <h2 className="mt-2 font-display text-xl text-forest">Attach your receipt</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Screenshot of the transfer or e-wallet receipt. JPG / PNG / PDF, max ~5MB.
        </p>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
          className="mt-4 block w-full text-sm"
        />
        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}
        <button
          onClick={uploadProof}
          disabled={!proofFile || uploading}
          className="mt-5 rounded-full bg-forest px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Submit payment proof"}
        </button>
      </div>

      <p className="mt-6 text-xs text-stone">
        Booking summary: {name}, {cabinName}, {checkin} → {checkout}
      </p>
    </section>
  );
}

// ============ STEP 3: done ============
function DoneStep({ name, email, reference }: { name: string; email: string; reference: string }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center lg:px-10">
      <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-stone">Proof received</p>
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">
        Terima kasih, {name.split(" ")[0]}.
      </h1>
      <p className="mt-6 text-foreground/75">
        We've received your payment proof for reference{" "}
        <span className="font-mono text-forest">{reference}</span>. The owner will verify the transfer and confirm your booking by WhatsApp / email at{" "}
        <span className="text-forest">{email}</span> — usually within a few hours.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <a
          href={`https://wa.me/60115007204?text=${encodeURIComponent(
            `Hi! I just uploaded payment proof for booking ${reference} under ${name}.`,
          )}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-coconut hover:bg-forest/90"
        >
          Message us on WhatsApp
        </a>
        <Link to="/" className="rounded-full border border-border px-7 py-3.5 text-sm">Back to home</Link>
      </div>
    </section>
  );
}

// ============ shared ============
function BookHeader() {
  return (
    <header className="border-b border-border bg-coconut">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        <Link to="/" className="text-xs uppercase tracking-widest text-stone hover:text-forest">← Back</Link>
      </div>
    </header>
  );
}

function Field({ label, type, value, onChange, min, placeholder, required, full }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void;
  min?: string; placeholder?: string; required?: boolean; full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 bg-card px-5 py-4 text-left ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <input
        type={type} value={value} min={min} placeholder={placeholder} required={required}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-base text-foreground outline-none placeholder:text-stone/50"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left sm:col-span-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder}
        className="resize-none bg-transparent text-base text-foreground outline-none placeholder:text-stone/50" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-base text-foreground outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function SelectCabin({ label, value, onChange, cabins }: { label: string; value: string; onChange: (v: string) => void; cabins: Cabin[] }) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-base text-foreground outline-none">
        {cabins.length === 0 && <option>Loading…</option>}
        {cabins.map((c) => (
          <option key={c.id} value={c.id}>{c.name} · sleeps {c.capacity}</option>
        ))}
      </select>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-stone">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}