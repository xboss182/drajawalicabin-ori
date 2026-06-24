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
import cabinQueenImg from "@/assets/cabin-queen.jpg";
import cabinTwinImg from "@/assets/cabin-twin.jpg";
import cabinFamilyImg from "@/assets/cabin-family.jpg";
import cabinTripleImg from "@/assets/cabin-triple.jpg";
import duitnowQrAsset from "@/assets/duitnow-qr.png.asset.json";
import { LanguageToggle, useLanguage } from "@/lib/i18n";

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const todayStr = today();
const tomorrowStr = tomorrow();

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
    checkin: typeof raw.checkin === "string" ? raw.checkin : todayStr,
    checkout: typeof raw.checkout === "string" ? raw.checkout : tomorrowStr,
    guests: typeof raw.guests === "string" ? raw.guests : "2",
    room: typeof raw.room === "string" ? raw.room : "",
  }),
  head: () => ({
    meta: [
      { title: "Room Booking — Rajawali D'Cabin Chalet" },
      { name: "description", content: "Book a cabin at Rajawali D'Cabin Chalet, Kuala Terengganu." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookPage,
});

type Step = "details" | "payment" | "done";

function BookPage() {
  const search = Route.useSearch();
  const { t } = useLanguage();
  const bt = t.book;

  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [cabinId, setCabinId] = useState<string>("");
  const [checkin, setCheckin] = useState(search.checkin);
  const [checkout, setCheckout] = useState(search.checkout);
  const [guests, setGuests] = useState(search.guests);
  const [numRooms, setNumRooms] = useState("1");
  const [comforter, setComforter] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [price, setPrice] = useState<{ nights: number; subtotal: number; comforter_total: number; total: number } | null>(null);
  const [taken, setTaken] = useState<string[]>([]);

  const [step, setStep] = useState<Step>("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState<{ bookingId: string; reference: string; total: number; holdExpiresAt: string } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [agreed, setAgreed] = useState(false);

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
        const from = todayStr;
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
    if (!cabinId) return setError(bt.errors.pickCabin);
    if (new Date(checkout) <= new Date(checkin)) return setError(bt.errors.dates);
    if (datesOverlapTaken()) return setError(bt.errors.overlap);
    if (name.trim().length < 2) return setError(bt.errors.name);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError(bt.errors.email);
    if (phone.trim().length < 5) return setError(bt.errors.phone);
    if (!agreed) return setError(bt.errors.terms);

    setSubmitting(true);
    try {
      const res = await createBooking({
        data: {
          cabinId,
          checkIn: checkin,
          checkOut: checkout,
          guests: Number(guests.replace("+", "")) || 1,
          numRooms: Number(numRooms) || 1,
          comforter,
          guestName: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          relationship: relationship.trim() || undefined,
          vehicleType: vehicleType.trim() || undefined,
          vehicleNumber: vehicleNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      setBooking(res);
      setStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : bt.errors.bookFailed);
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
      setError(e instanceof Error ? e.message : bt.errors.uploadFailed);
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
            guests, setGuests, numRooms, setNumRooms, comforter, setComforter,
            name, setName, email, setEmail, phone, setPhone,
            relationship, setRelationship, vehicleType, setVehicleType, vehicleNumber, setVehicleNumber,
            notes, setNotes,
            price, selectedCabin, taken,
            submit, submitting, error,
            agreed, setAgreed,
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
  numRooms: string; setNumRooms: (s: string) => void;
  comforter: boolean; setComforter: (b: boolean) => void;
  name: string; setName: (s: string) => void;
  email: string; setEmail: (s: string) => void;
  phone: string; setPhone: (s: string) => void;
  relationship: string; setRelationship: (s: string) => void;
  vehicleType: string; setVehicleType: (s: string) => void;
  vehicleNumber: string; setVehicleNumber: (s: string) => void;
  notes: string; setNotes: (s: string) => void;
  price: { nights: number; subtotal: number; comforter_total: number; total: number } | null;
  selectedCabin?: Cabin;
  taken: string[];
  submit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string | null;
  agreed: boolean;
  setAgreed: (b: boolean) => void;
}) {
  const { t } = useLanguage();
  const bt = t.book;
  const {
    cabins, cabinId, setCabinId, checkin, setCheckin, checkout, setCheckout,
    guests, setGuests, numRooms, setNumRooms, comforter, setComforter,
    name, setName, email, setEmail, phone, setPhone,
    relationship, setRelationship, vehicleType, setVehicleType, vehicleNumber, setVehicleNumber,
    notes, setNotes,
    price, selectedCabin, taken, submit, submitting, error, agreed, setAgreed,
  } = props;

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-10 lg:py-20">
      <form onSubmit={submit} className="order-2 lg:order-1">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{bt.step1Eyebrow}</p>
        <h1 className="mb-10 font-display text-4xl leading-tight sm:text-5xl">{bt.title}</h1>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <Field label={bt.f.checkin} type="date" value={checkin} min={todayStr} onChange={setCheckin} />
          <Field label={bt.f.checkout} type="date" value={checkout} min={checkin} onChange={setCheckout} />
          <Select label={bt.f.guests} value={guests} onChange={setGuests} options={["1","2","3","4","5","6+"]} />
          <Select label={bt.f.rooms} value={numRooms} onChange={setNumRooms} options={["1","2","3","4","5","6","7","8"]} />
          <SelectCabin label={bt.f.cabinType} value={cabinId} onChange={setCabinId} cabins={cabins} loadingLabel={bt.f.loading} optionTpl={bt.f.cabinOption} />
        </div>

        {taken.length > 0 && (
          <p className="mt-3 text-xs text-stone">
            {bt.takenPrefix} {selectedCabin?.name}:{" "}
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
            {bt.comforter} <span className="text-stone">{bt.comforterPrice}</span>
          </span>
        </label>

        <p className="mt-8 mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{bt.step2Eyebrow}</p>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <Field label={bt.g.fullName} type="text" value={name} onChange={setName} placeholder={bt.g.fullNamePh} required />
          <Field label={bt.g.email} type="email" value={email} onChange={setEmail} placeholder={bt.g.emailPh} required />
          <Field label={bt.g.phone} type="tel" value={phone} onChange={setPhone} placeholder={bt.g.phonePh} required full />
          <Field label={bt.g.relationship} type="text" value={relationship} onChange={setRelationship} placeholder={bt.g.relationshipPh} />
          <Field label={bt.g.vehicleType} type="text" value={vehicleType} onChange={setVehicleType} placeholder={bt.g.vehicleTypePh} />
          <Field label={bt.g.vehicleNumber} type="text" value={vehicleNumber} onChange={setVehicleNumber} placeholder={bt.g.vehicleNumberPh} />
          <TextArea label={bt.g.notes} value={notes} onChange={setNotes} placeholder={bt.g.notesPh} />
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-border bg-coconut px-5 py-4 text-sm text-stone">
          <p><strong>{bt.info.roomNum}</strong> {bt.info.roomNumNote}</p>
          <p className="mt-1"><strong>{bt.info.bookingNum}</strong> {bt.info.bookingNumNote}</p>
        </div>

        {error && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{bt.terms.eyebrow}</p>
          <h3 className="mt-2 font-display text-lg text-forest">{bt.terms.title}</h3>
          <p className="mt-2 text-sm text-foreground/75">{bt.terms.summary}</p>
          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 accent-forest"
            />
            <span className="text-sm leading-relaxed text-foreground/85">{bt.terms.agree}</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !agreed}
          className="mt-8 w-full rounded-full bg-forest px-7 py-4 text-sm font-medium uppercase tracking-widest text-coconut transition hover:bg-forest/90 disabled:opacity-60 sm:w-auto"
        >
          {submitting ? bt.submitting : bt.submit}
        </button>
        <p className="mt-4 text-xs text-stone">{bt.holdNote}</p>
      </form>

      <aside className="order-1 lg:order-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <img
            src={
              selectedCabin
                ? selectedCabin.cabin_type === "Queen"
                  ? cabinQueenImg
                  : selectedCabin.cabin_type === "Twin"
                    ? cabinTwinImg
                    : selectedCabin.cabin_type === "Family"
                      ? cabinFamilyImg
                      : selectedCabin.cabin_type === "Triple"
                        ? cabinTripleImg
                        : heroRiverside
                : heroRiverside
            }
            alt={selectedCabin?.name ?? "Rajawali D'Cabin cabin interior"}
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{bt.summary.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl text-forest">
              {selectedCabin?.name ?? bt.summary.pickCabin}
            </h2>
            {selectedCabin && (
              <p className="mt-1 text-sm text-stone">
                {bt.summary.capacityLine
                  .replace("{cap}", String(selectedCabin.capacity))
                  .replace("{min}", String(selectedCabin.weekday_rate))
                  .replace("{max}", String(selectedCabin.school_holiday_rate))}
              </p>
            )}
            <dl className="mt-6 divide-y divide-border text-sm">
              <Row label={bt.summary.checkin} value={fmt(checkin, bt.locale)} />
              <Row label={bt.summary.checkout} value={fmt(checkout, bt.locale)} />
              <Row label={bt.summary.nights} value={String(price?.nights ?? "—")} />
              <Row label={bt.summary.guests} value={guests} />
              <Row label={bt.summary.rooms} value={numRooms} />
              {price && (
                <>
                  <Row label={bt.summary.roomSubtotal} value={`RM ${price.subtotal.toFixed(2)}`} />
                  {price.comforter_total > 0 && (
                    <Row label={bt.summary.comforterLabel} value={`RM ${price.comforter_total.toFixed(2)}`} />
                  )}
                </>
              )}
            </dl>
            {price && (
              <div className="mt-4 flex items-baseline justify-between rounded-xl bg-coconut px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-stone">{bt.summary.total}</span>
                <span className="font-display text-2xl text-forest">RM {price.total.toFixed(2)}</span>
              </div>
            )}
            <p className="mt-4 text-xs text-stone">{bt.summary.priceNote}</p>
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
  const { t } = useLanguage();
  const bt = t.book;
  const [remaining, setRemaining] = useState(Math.max(0, new Date(booking.holdExpiresAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, new Date(booking.holdExpiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [booking.holdExpiresAt]);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  const acctNum = "8600095810";
  const acctName = "Mohd Fauzi Awang";

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{bt.pay.eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl text-forest">{bt.pay.title}</h1>
      <p className="mt-3 text-foreground/75">
        {bt.pay.holdPrefix}{" "}
        <span className={`font-medium ${remaining < 5 * 60000 ? "text-red-700" : "text-forest"}`}>
          {mm}:{ss}
        </span>
        {bt.pay.holdSuffix}
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone">{bt.pay.amountDue}</p>
            <p className="font-display text-4xl text-forest">RM {booking.total.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-stone">{bt.pay.reference}</p>
            <p className="font-mono text-lg text-forest">{booking.reference}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone">
          {bt.pay.refNote} <strong>{booking.reference}</strong> {bt.pay.refNoteSuffix}
        </p>

        <div className="mt-4 rounded-xl border border-dashed border-border bg-coconut px-5 py-4 text-sm text-stone">
          <p><strong>{bt.info.roomNum}</strong> {bt.info.roomNumNote}</p>
          <p className="mt-1"><strong>{bt.info.bookingNum}</strong> {bt.info.bookingNumNote}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-stone">{bt.pay.transfer}</p>
          <p className="mt-2 font-display text-xl text-forest">{bt.pay.bank}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-stone">{bt.pay.acctNum}</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono">{acctNum}</span>
                <button onClick={() => copy(acctNum)} className="text-[10px] uppercase tracking-widest text-forest hover:underline">{bt.pay.copy}</button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-stone">{bt.pay.acctName}</dt>
              <dd>{acctName}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-stone">{bt.pay.qrTitle}</p>
          <p className="mt-2 font-display text-xl text-forest">{bt.pay.qrSub}</p>
          <div className="mt-4 flex aspect-square w-full items-center justify-center rounded-xl border border-border bg-coconut overflow-hidden">
            <img
              src={duitnowQrAsset.url}
              alt="DuitNow QR Code - Mohd Fauzi Bin Awang, CIMB"
              className="h-full w-full object-contain"
            />
          </div>
          <p className="mt-3 text-center text-xs text-stone">{acctName}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-stone">{bt.pay.uploadEyebrow}</p>
        <h2 className="mt-2 font-display text-xl text-forest">{bt.pay.uploadTitle}</h2>
        <p className="mt-1 text-sm text-foreground/70">{bt.pay.uploadHint}</p>
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
          {uploading ? bt.pay.uploading : bt.pay.uploadCta}
        </button>
      </div>

      <p className="mt-6 text-xs text-stone">
        {bt.pay.summary} {name}, {cabinName}, {checkin} → {checkout}
      </p>
    </section>
  );
}

// ============ STEP 3: done ============
function DoneStep({ name, email, reference }: { name: string; email: string; reference: string }) {
  const { t } = useLanguage();
  const bt = t.book;
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center lg:px-10">
      <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-stone">{bt.done.eyebrow}</p>
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">
        {bt.done.thanks.replace("{name}", name.split(" ")[0])}
      </h1>
      <p className="mt-6 text-foreground/75">
        {bt.done.body1}{" "}
        <span className="font-mono text-forest">{reference}</span>{bt.done.body2}{" "}
        <span className="text-forest">{email}</span>{bt.done.bodyTail}
      </p>

      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-6 text-left">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone">{bt.houseRules.title}</p>
        <p className="mt-2 text-sm text-foreground/75">{bt.houseRules.intro}</p>
        <ul className="mt-4 space-y-2 text-sm text-foreground/85">
          {bt.houseRules.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-forest/60" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <a
          href={`https://wa.me/60115007204?text=${encodeURIComponent(
            bt.done.whatsappText.replace("{ref}", reference).replace("{name}", name) +
              "\n\n" + bt.houseRules.title + ":\n" +
              bt.houseRules.items.map((it) => "• " + it).join("\n"),
          )}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-coconut hover:bg-forest/90"
        >
          {bt.done.whatsappCta}
        </a>
        <Link to="/" className="rounded-full border border-border px-7 py-3.5 text-sm">{bt.done.backHome}</Link>
      </div>
    </section>
  );
}

// ============ shared ============
function BookHeader() {
  const { t } = useLanguage();
  return (
    <header className="border-b border-border bg-coconut">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link to="/" className="font-display text-lg text-forest">Rajawali D'Cabin</Link>
        <div className="flex items-center gap-4">
          <LanguageToggle variant="dark" />
          <Link to="/" className="text-xs uppercase tracking-widest text-stone hover:text-forest">{t.book.header.back}</Link>
        </div>
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

function SelectCabin({ label, value, onChange, cabins, loadingLabel, optionTpl }: { label: string; value: string; onChange: (v: string) => void; cabins: Cabin[]; loadingLabel: string; optionTpl: string }) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-base text-foreground outline-none">
        {cabins.length === 0 && <option>{loadingLabel}</option>}
        {cabins.map((c) => (
          <option key={c.id} value={c.id}>{optionTpl.replace("{name}", c.name).replace("{cap}", String(c.capacity))}</option>
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

function fmt(iso: string, locale: string = "en-MY") {
  try {
    return new Date(iso).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
