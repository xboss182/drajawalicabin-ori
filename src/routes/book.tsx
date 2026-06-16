import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import heroRiverside from "@/assets/hero-riverside.jpg";

const ROOMS = ["Any cabin", "Deluxe Queen", "Deluxe Twin", "Family Suite", "Triple Suite"] as const;

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const searchSchema = z.object({
  checkin: fallback(z.string(), today()).default(today()),
  checkout: fallback(z.string(), tomorrow()).default(tomorrow()),
  guests: fallback(z.string(), "2").default("2"),
  room: fallback(z.enum(ROOMS), "Any cabin").default("Any cabin"),
});

export const Route = createFileRoute("/book")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Book your stay — Rajawali D'Cabin Chalet" },
      { name: "description", content: "Reserve your cabin at Rajawali D'Cabin Chalet, Kuala Ibai. Only 8 cabins — your dates are confirmed personally." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/book" });

  const [checkin, setCheckin] = useState(search.checkin);
  const [checkout, setCheckout] = useState(search.checkout);
  const [guests, setGuests] = useState(search.guests);
  const [room, setRoom] = useState<string>(search.room);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nights = Math.max(
    1,
    Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000) || 1,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const schema = z.object({
      name: z.string().trim().min(2, "Please enter your full name").max(100),
      email: z.string().trim().email("Please enter a valid email").max(255),
      phone: z.string().trim().min(5, "Please enter your phone or WhatsApp number").max(30),
      notes: z.string().trim().max(1000).optional(),
    });
    const parsed = schema.safeParse({ name, email, phone, notes });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    if (new Date(checkout) <= new Date(checkin)) {
      setError("Check-out must be after check-in");
      return;
    }

    setSubmitting(true);
    const { error: insertErr } = await supabase.from("booking_requests").insert({
      guest_name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      check_in: checkin,
      check_out: checkout,
      guests: Number(guests.replace("+", "")) || 1,
      room_type: room,
      notes: parsed.data.notes || null,
    });
    setSubmitting(false);

    if (insertErr) {
      setError("We couldn't submit your request. Please try again or message us on WhatsApp.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="min-h-[100svh] bg-background text-foreground">
        <BookHeader />
        <section className="mx-auto max-w-2xl px-6 py-24 text-center lg:px-10">
          <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-stone">Request received</p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            Thank you, {name.split(" ")[0]}.
          </h1>
          <p className="mt-6 text-foreground/75">
            We've received your booking request for{" "}
            <span className="text-forest">{room}</span> from{" "}
            <span className="text-forest">{checkin}</span> to{" "}
            <span className="text-forest">{checkout}</span> ({nights} night{nights > 1 ? "s" : ""}).
          </p>
          <p className="mt-4 text-foreground/75">
            Our team will personally confirm availability and send next steps to{" "}
            <span className="text-forest">{email}</span> — usually within a few hours.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href={`https://wa.me/60115007204?text=${encodeURIComponent(
                `Hi! I just submitted a booking request under ${name} for ${room}, ${checkin} → ${checkout}.`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-coconut hover:bg-forest/90"
            >
              Message us on WhatsApp
            </a>
            <Link to="/" className="rounded-full border border-border px-7 py-3.5 text-sm">
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <BookHeader />
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-10 lg:py-20">
        <form onSubmit={submit} className="order-2 lg:order-1">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">Step 1 — Your stay</p>
          <h1 className="mb-10 font-display text-4xl leading-tight sm:text-5xl">
            Reserve your cabin.
          </h1>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            <Field label="Check-in" type="date" value={checkin} min={today()} onChange={(v) => { setCheckin(v); navigate({ search: (p) => ({ ...p, checkin: v }), replace: true }); }} />
            <Field label="Check-out" type="date" value={checkout} min={checkin} onChange={(v) => { setCheckout(v); navigate({ search: (p) => ({ ...p, checkout: v }), replace: true }); }} />
            <Select label="Guests" value={guests} onChange={(v) => { setGuests(v); navigate({ search: (p) => ({ ...p, guests: v }), replace: true }); }} options={["1","2","3","4","5","6+"]} />
            <Select label="Cabin" value={room} onChange={(v) => { setRoom(v); navigate({ search: (p) => ({ ...p, room: v as typeof ROOMS[number] }), replace: true }); }} options={[...ROOMS]} />
          </div>

          <p className="mt-8 mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">Step 2 — Your details</p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            <Field label="Full name" type="text" value={name} onChange={setName} placeholder="Aisyah Rahman" required />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
            <Field label="Phone / WhatsApp" type="tel" value={phone} onChange={setPhone} placeholder="+60 11 5500 7204" required full />
            <TextArea label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Arrival time, dietary needs, fishing plans…" />
          </div>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-full bg-forest px-7 py-4 text-sm font-medium uppercase tracking-widest text-coconut transition hover:bg-forest/90 disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Sending…" : "Send booking request"}
          </button>

          <p className="mt-4 text-xs text-stone">
            No payment required now. Our team will personally confirm availability and share payment instructions.
          </p>
        </form>

        <aside className="order-1 lg:order-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <img
              src={heroRiverside}
              alt="Riverside view at Rajawali D'Cabin"
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Your stay</p>
              <h2 className="mt-2 font-display text-2xl text-forest">{room}</h2>
              <dl className="mt-6 divide-y divide-border text-sm">
                <Row label="Check-in" value={fmt(checkin)} />
                <Row label="Check-out" value={fmt(checkout)} />
                <Row label="Nights" value={String(nights)} />
                <Row label="Guests" value={guests} />
              </dl>
              <p className="mt-6 text-xs text-stone">
                Only 8 cabins · Quiet, private, and personally hosted.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function BookHeader() {
  return (
    <header className="border-b border-border bg-coconut">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link to="/" className="font-display text-lg text-forest">
          Rajawali D'Cabin
        </Link>
        <Link to="/" className="text-xs uppercase tracking-widest text-stone hover:text-forest">
          ← Back
        </Link>
      </div>
    </header>
  );
}

function Field({
  label, type, value, onChange, min, placeholder, required, full,
}: {
  label: string; type: string; value: string;
  onChange: (v: string) => void;
  min?: string; placeholder?: string; required?: boolean; full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 bg-card px-5 py-4 text-left ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        required={required}
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
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="resize-none bg-transparent text-base text-foreground outline-none placeholder:text-stone/50"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-base text-foreground outline-none"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
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