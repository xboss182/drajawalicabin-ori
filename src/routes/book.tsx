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
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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

type CabinGroup = {
  type: string;
  label: string;
  rooms: Cabin[];
};

function typeLabel(c: Cabin) {
  // "Deluxe Queen 1" -> "Deluxe Queen", "Family Suite 2" -> "Family Suite"
  return c.name.replace(/\s*\d+\s*$/, "").trim();
}

export const Route = createFileRoute("/book")({
  validateSearch: (raw: Record<string, unknown>) => ({
    checkin: typeof raw.checkin === "string" ? raw.checkin : todayStr,
    checkout: typeof raw.checkout === "string" ? raw.checkout : tomorrowStr,
    guests: typeof raw.guests === "string" ? raw.guests : "2",
    room: typeof raw.room === "string" ? raw.room : "",
  }),
  head: () => ({
    meta: [
      { title: "Book a Cabin | Rajawali D'Cabin Chalet, Kuala Terengganu" },
      { name: "description", content: "Reserve a private cabin at Rajawali D'Cabin Chalet in Chendering, Kuala Terengganu. Easy online booking with flexible RM50 deposit per room." },
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
  const [cabinType, setCabinType] = useState<string>("");
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
  const [takenByCabin, setTakenByCabin] = useState<Record<string, string[]>>({});

  const [step, setStep] = useState<Step>("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState<{ bookingId: string; reference: string; total: number; holdExpiresAt: string; guestToken: string } | null>(null);
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
      setCabinType(match?.cabin_type ?? list[0]?.cabin_type ?? "");
    })();
  }, []);

  // Group cabins by type (each type has 2 rooms)
  const cabinGroups = useMemo<CabinGroup[]>(() => {
    const map = new Map<string, CabinGroup>();
    for (const c of cabins) {
      const existing = map.get(c.cabin_type);
      if (existing) {
        existing.rooms.push(c);
      } else {
        map.set(c.cabin_type, { type: c.cabin_type, label: typeLabel(c), rooms: [c] });
      }
    }
    return Array.from(map.values());
  }, [cabins]);

  const selectedGroup = useMemo(
    () => cabinGroups.find((g) => g.type === cabinType),
    [cabinGroups, cabinType],
  );
  const selectedCabin = selectedGroup?.rooms[0];
  const numRoomsN = Math.max(1, Math.min(2, Number(numRooms) || 1));
  const maxRoomsForType = selectedGroup?.rooms.length ?? 2;

  // Price preview
  useEffect(() => {
    if (!selectedCabin || !checkin || !checkout) return;
    if (new Date(checkout) <= new Date(checkin)) {
      setPrice(null);
      return;
    }
    (async () => {
      try {
        const p = await previewPrice({ data: { cabinId: selectedCabin.id, checkIn: checkin, checkOut: checkout, comforter } });
        // Multiply by number of rooms (each room of the type is priced identically)
        setPrice({
          nights: p.nights,
          subtotal: p.subtotal * numRoomsN,
          comforter_total: p.comforter_total * numRoomsN,
          total: p.total * numRoomsN,
        });
      } catch {
        setPrice(null);
      }
    })();
  }, [selectedCabin?.id, checkin, checkout, comforter, numRoomsN]);

  // Availability for every room in the selected type (next 90 days)
  useEffect(() => {
    if (!selectedGroup) return;
    (async () => {
      try {
        const from = todayStr;
        const to = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        const entries = await Promise.all(
          selectedGroup.rooms.map(async (c) => {
            try {
              const r = await getTakenDates({ data: { cabinId: c.id, from, to } });
              return [c.id, r.dates] as const;
            } catch {
              return [c.id, [] as string[]] as const;
            }
          }),
        );
        setTakenByCabin(Object.fromEntries(entries));
      } catch {
        setTakenByCabin({});
      }
    })();
  }, [selectedGroup?.type]);

  // Date is blocked for the type when free rooms in that type < requested rooms
  const blockedDates = useMemo<string[]>(() => {
    if (!selectedGroup) return [];
    const counts = new Map<string, number>();
    for (const c of selectedGroup.rooms) {
      for (const d of takenByCabin[c.id] ?? []) {
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
    }
    const total = selectedGroup.rooms.length;
    const out: string[] = [];
    for (const [d, n] of counts) {
      if (total - n < numRoomsN) out.push(d);
    }
    return out;
  }, [selectedGroup, takenByCabin, numRoomsN]);

  function freeCabinsInRange(): Cabin[] {
    if (!selectedGroup || !checkin || !checkout) return [];
    const start = new Date(checkin);
    const end = new Date(checkout);
    return selectedGroup.rooms.filter((c) => {
      const tk = takenByCabin[c.id] ?? [];
      return !tk.some((d) => {
        const dd = new Date(d);
        return dd >= start && dd < end;
      });
    });
  }

  function datesOverlapTaken() {
    if (!checkin || !checkout) return false;
    return freeCabinsInRange().length < numRoomsN;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGroup) return setError(bt.errors.pickCabin);
    if (new Date(checkout) <= new Date(checkin)) return setError(bt.errors.dates);
    if (datesOverlapTaken()) return setError(bt.errors.overlap);
    if (name.trim().length < 2) return setError(bt.errors.name);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError(bt.errors.email);
    if (phone.trim().length < 5) return setError(bt.errors.phone);
    if (!agreed) return setError(bt.errors.terms);

    setSubmitting(true);
    try {
      const free = freeCabinsInRange();
      if (free.length < numRoomsN) {
        throw new Error(bt.errors.overlap);
      }
      const assignedCabin = free[0];
      const res = await createBooking({
        data: {
          cabinId: assignedCabin.id,
          checkIn: checkin,
          checkOut: checkout,
          guests: Number(guests.replace("+", "")) || 1,
          numRooms: numRoomsN,
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
      const path = `bookings/${booking.bookingId}/proof-${Date.now()}.${ext}`;
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
            cabinGroups, cabinType, setCabinType, maxRoomsForType,
            checkin, setCheckin, checkout, setCheckout,
            guests, setGuests, numRooms, setNumRooms, comforter, setComforter,
            name, setName, email, setEmail, phone, setPhone,
            relationship, setRelationship, vehicleType, setVehicleType, vehicleNumber, setVehicleNumber,
            notes, setNotes,
            price, selectedCabin, selectedGroup, blockedDates,
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
  cabinGroups: CabinGroup[]; cabinType: string; setCabinType: (s: string) => void;
  maxRoomsForType: number;
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
  selectedGroup?: CabinGroup;
  blockedDates: string[];
  submit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string | null;
  agreed: boolean;
  setAgreed: (b: boolean) => void;
}) {
  const { t } = useLanguage();
  const bt = t.book;
  const {
    cabinGroups, cabinType, setCabinType, maxRoomsForType,
    checkin, setCheckin, checkout, setCheckout,
    guests, setGuests, numRooms, setNumRooms, comforter, setComforter,
    name, setName, email, setEmail, phone, setPhone,
    relationship, setRelationship, vehicleType, setVehicleType, vehicleNumber, setVehicleNumber,
    notes, setNotes,
    price, selectedCabin, selectedGroup, blockedDates, submit, submitting, error, agreed, setAgreed,
  } = props;

  const roomOptions = Array.from({ length: maxRoomsForType }, (_, i) => String(i + 1));

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-10 lg:py-20">
      <form onSubmit={submit} className="order-2 lg:order-1">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{bt.step1Eyebrow}</p>
        <h1 className="mb-10 font-display text-4xl leading-tight sm:text-5xl">{bt.title}</h1>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Availability</p>
              <h3 className="mt-1 font-display text-lg text-forest">
                Blocked dates {selectedCabin ? `· ${selectedCabin.name}` : ""}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-stone">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-500/80" />
                Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border border-border bg-background" />
                Available
              </span>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <Calendar
              mode="single"
              numberOfMonths={2}
              disabled={{ before: new Date() }}
              modifiers={{ booked: blockedDates.map((d) => new Date(d)) }}
              modifiersClassNames={{
                booked:
                  "bg-red-500/80 text-white line-through hover:bg-red-500/80 focus:bg-red-500/80",
              }}
              className="pointer-events-auto p-0"
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Accommodation</p>
          <h3 className="mt-1 font-display text-lg text-forest">Cabin type</h3>
          <div className="mt-3">
            <SelectCabinType
              value={cabinType}
              onChange={setCabinType}
              groups={cabinGroups}
              loadingLabel={bt.f.loading}
              className="bg-transparent px-0 py-0"
            />
            {selectedGroup && (
              <p className="mt-2 text-xs text-stone">
                {selectedGroup.rooms.length} rooms available in this type · sleeps {selectedCabin?.capacity ?? 0} per room
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <Field label={bt.f.checkin} type="date" value={checkin} min={todayStr} onChange={setCheckin} />
          <Field label={bt.f.checkout} type="date" value={checkout} min={checkin} onChange={setCheckout} />
          <Select label={bt.f.guests} value={guests} onChange={setGuests} options={["1","2","3","4","5","6+"]} />
          <Select label={bt.f.rooms} value={numRooms} onChange={setNumRooms} options={roomOptions} />
        </div>

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
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm text-forest hover:bg-coconut">
          <span className="rounded-full bg-forest px-4 py-1.5 text-xs uppercase tracking-widest text-coconut">
            Choose file
          </span>
          <span className="truncate text-foreground/75">
            {proofFile ? proofFile.name : "No file chosen"}
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}
        <button
          onClick={uploadProof}
          disabled={!proofFile || uploading}
          className="mt-5 rounded-full bg-forest px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-coconut hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? bt.pay.uploading : proofFile ? bt.pay.uploadCta : "Choose a file first"}
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
          href={`https://wa.me/601155007204?text=${encodeURIComponent(
            bt.done.whatsappText.replace("{ref}", reference).replace("{name}", name),
          )}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-coconut hover:bg-forest/90"
        >
          {bt.done.whatsappCta}
        </a>
        <Link to="/" className="rounded-full border border-border px-7 py-3.5 text-sm">{bt.done.backHome}</Link>
      </div>
      <p className="mt-6 text-xs text-stone">
        Bookmark your confirmation email — or use{" "}
        <Link to="/find-booking" className="underline hover:text-forest">Find Booking</Link>{" "}
        if you lose the link.
      </p>
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

function SelectCabin({
  label,
  value,
  onChange,
  cabins,
  loadingLabel,
  optionTpl,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  cabins: Cabin[];
  loadingLabel: string;
  optionTpl: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 bg-card px-5 py-4 text-left", className)}>
      {label && <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>}
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

function SelectCabinType({
  value,
  onChange,
  groups,
  loadingLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: CabinGroup[];
  loadingLabel: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 bg-card px-5 py-4 text-left", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-base text-foreground outline-none"
      >
        {groups.length === 0 && <option>{loadingLabel}</option>}
        {groups.map((g) => (
          <option key={g.type} value={g.type}>
            {g.label} · sleeps {g.rooms[0]?.capacity ?? 0} · {g.rooms.length} rooms available
          </option>
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
