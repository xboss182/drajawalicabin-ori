import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { previewPrice } from "@/lib/booking.functions";
import { LanguageToggle, useLanguage } from "@/lib/i18n";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Minus, Plus, MessageCircle } from "lucide-react";

const PROPERTY_TZ = "Asia/Kuala_Lumpur";
const FALLBACK_PHONE = "60103328747";

function formatPropertyDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PROPERTY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}
function prettyDate(iso: string) {
  return parseLocalDate(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}
function nightsBetween(a: string, b: string) {
  return Math.max(0, Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000));
}

async function fetchTakenDates(cabinId: string, from: string, to: string): Promise<string[]> {
  const params = new URLSearchParams({ cabinId, from, to });
  const res = await fetch(`/api/public/availability/taken-dates?${params}`, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { dates?: unknown };
  return Array.isArray(json.dates) ? json.dates.filter((d): d is string => typeof d === "string") : [];
}

const todayStr = formatPropertyDate(new Date());
const tomorrowStr = addDaysISO(todayStr, 1);

type Cabin = {
  id: string;
  name: string;
  cabin_type: string;
  capacity: number;
  weekday_rate: number;
  weekend_rate: number;
  school_holiday_rate: number;
};
type StoreItem = {
  id: string;
  name_en: string;
  name_bm: string;
  description_en: string | null;
  description_bm: string | null;
  price: number;
  unit: string;
  image_url: string | null;
};

function typeLabel(c: Cabin) {
  return c.name.replace(/\s*\d+\s*$/, "").trim();
}

export const Route = createFileRoute("/whatsapp-store")({
  head: () => ({
    meta: [
      { title: "WhatsApp Store — Rajawali D'Cabin Chalet, Kuala Terengganu" },
      {
        name: "description",
        content:
          "Pick your dates, add cabins and add-ons to your cart, and send your order straight to Rajawali D'Cabin on WhatsApp. Live availability, no online payment needed.",
      },
      { property: "og:title", content: "WhatsApp Store — Rajawali D'Cabin Chalet" },
      {
        property: "og:description",
        content: "Build your stay — cabins, BBQ set and add-ons — then order in one WhatsApp message.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://drajawalicabin.com/whatsapp-store" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://drajawalicabin.com/whatsapp-store" }],
  }),
  component: WhatsAppStorePage,
});

function WhatsAppStorePage() {
  const { lang } = useLanguage();
  const isMobile = useIsMobile();
  const bm = lang === "bm";

  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [phone, setPhone] = useState(FALLBACK_PHONE);
  const [storeOpen, setStoreOpen] = useState(true);
  const [checkin, setCheckin] = useState(todayStr);
  const [checkout, setCheckout] = useState(tomorrowStr);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [note, setNote] = useState("");
  const [roomQty, setRoomQty] = useState<Record<string, number>>({});
  const [itemQty, setItemQty] = useState<Record<string, number>>({});
  const [takenByCabin, setTakenByCabin] = useState<Record<string, string[]>>({});
  const [rateByType, setRateByType] = useState<Record<string, { nights: number; total: number }>>({});

  const nights = nightsBetween(checkin, checkout);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cabins")
        .select(
          "id, name, cabin_type, capacity, weekday_rate, weekend_rate, school_holiday_rate, legacy_weekday_rate, legacy_weekend_rate, legacy_school_holiday_rate",
        )
        .eq("is_active", true)
        .order("display_order");
      let rateSet: "current" | "legacy" = "current";
      try {
        const res = await fetch("/api/public/rates/active-set");
        if (res.ok) rateSet = (await res.json()).rateSet ?? "current";
      } catch {
        /* keep current */
      }
      const legacy = rateSet === "legacy";
      setCabins(
        ((data ?? []) as any[]).map((c) => ({
          id: c.id,
          name: c.name,
          cabin_type: c.cabin_type,
          capacity: c.capacity,
          weekday_rate: Number(legacy ? (c.legacy_weekday_rate ?? c.weekday_rate) : c.weekday_rate),
          weekend_rate: Number(legacy ? (c.legacy_weekend_rate ?? c.weekend_rate) : c.weekend_rate),
          school_holiday_rate: Number(
            legacy ? (c.legacy_school_holiday_rate ?? c.school_holiday_rate) : c.school_holiday_rate,
          ),
        })),
      );
    })();

    (async () => {
      const { data } = await supabase
        .from("store_items")
        .select("id, name_en, name_bm, description_en, description_bm, price, unit, image_url")
        .eq("is_active", true)
        .order("display_order");
      setItems(((data ?? []) as any[]).map((r) => ({ ...r, price: Number(r.price) })));
    })();

    (async () => {
      try {
        const res = await fetch("/api/public/store/config");
        if (res.ok) {
          const cfg = await res.json();
          if (typeof cfg.phone === "string") setPhone(cfg.phone);
          if (typeof cfg.enabled === "boolean") setStoreOpen(cfg.enabled);
        }
      } catch {
        /* fallback */
      }
    })();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, { type: string; label: string; rooms: Cabin[] }>();
    for (const c of cabins) {
      const g = map.get(c.cabin_type);
      if (g) g.rooms.push(c);
      else map.set(c.cabin_type, { type: c.cabin_type, label: typeLabel(c), rooms: [c] });
    }
    return Array.from(map.values());
  }, [cabins]);

  const refreshAvailability = useCallback(async () => {
    if (cabins.length === 0) return;
    const from = todayStr;
    const to = addDaysISO(todayStr, 120);
    const entries = await Promise.all(
      cabins.map(async (c) => [c.id, await fetchTakenDates(c.id, from, to).catch(() => [])] as const),
    );
    setTakenByCabin(Object.fromEntries(entries));
  }, [cabins]);
  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  // Live rate per cabin type for the chosen range
  useEffect(() => {
    if (groups.length === 0 || nights < 1) {
      setRateByType({});
      return;
    }
    let cancelled = false;
    (async () => {
      const out: Record<string, { nights: number; total: number }> = {};
      for (const g of groups) {
        const sample = g.rooms[0];
        if (!sample) continue;
        try {
          const p = await previewPrice({
            data: { cabinId: sample.id, checkIn: checkin, checkOut: checkout, comforter: false },
          });
          out[g.type] = { nights: p.nights, total: p.total };
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setRateByType(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [groups, checkin, checkout, nights]);

  // Property-wide sold out nights
  const fullyBooked = useMemo(() => {
    if (cabins.length === 0) return new Set<string>();
    const counts = new Map<string, number>();
    for (const c of cabins) for (const d of takenByCabin[c.id] ?? []) counts.set(d, (counts.get(d) ?? 0) + 1);
    const out = new Set<string>();
    for (const [d, n] of counts) if (n >= cabins.length) out.add(d);
    return out;
  }, [cabins, takenByCabin]);

  const blockedDates = useMemo(() => Array.from(fullyBooked), [fullyBooked]);

  function freeRoomsForType(type: string) {
    const g = groups.find((x) => x.type === type);
    if (!g || nights < 1) return g?.rooms.length ?? 0;
    return g.rooms.filter((c) => !(takenByCabin[c.id] ?? []).some((d) => d >= checkin && d < checkout)).length;
  }

  function setQty(map: Record<string, number>, set: (v: Record<string, number>) => void, key: string, delta: number, max: number) {
    const next = Math.min(max, Math.max(0, (map[key] ?? 0) + delta));
    set({ ...map, [key]: next });
  }

  const roomLines = groups
    .map((g) => ({ g, qty: roomQty[g.type] ?? 0 }))
    .filter((l) => l.qty > 0)
    .map((l) => ({
      label: l.g.label,
      qty: l.qty,
      total: (rateByType[l.g.type]?.total ?? 0) * l.qty,
    }));

  const itemLines = items
    .map((it) => ({ it, qty: itemQty[it.id] ?? 0 }))
    .filter((l) => l.qty > 0)
    .map((l) => ({
      label: bm ? l.it.name_bm : l.it.name_en,
      qty: l.qty,
      total: l.it.price * l.qty * (l.it.unit === "per night" ? Math.max(1, nights) : 1),
    }));

  const estimatedTotal = [...roomLines, ...itemLines].reduce((s, l) => s + l.total, 0);
  const totalRooms = roomLines.reduce((s, l) => s + l.qty, 0);
  const hasSelection = roomLines.length + itemLines.length > 0;
  const rangeBlocked = blockedDates.some((d) => d >= checkin && d < checkout);

  const message = useMemo(() => {
    const L = bm
      ? {
          intro: "Salam Rajawali D'Cabin, saya ingin menempah:",
          ci: "Daftar masuk",
          co: "Daftar keluar",
          nights: "malam",
          guests: "Tetamu",
          adults: "dewasa",
          kids: "kanak-kanak",
          est: "Anggaran jumlah",
          name: "Nama",
          note: "Nota",
        }
      : {
          intro: "Hi Rajawali D'Cabin, I'd like to book:",
          ci: "Check-in",
          co: "Check-out",
          nights: "nights",
          guests: "Guests",
          adults: "adults",
          kids: "children",
          est: "Estimated total",
          name: "Name",
          note: "Note",
        };
    const lines = [
      L.intro,
      `${L.ci}: ${prettyDate(checkin)} (3:00 PM)`,
      `${L.co}: ${prettyDate(checkout)} (12:00 PM) — ${nights} ${L.nights}`,
      `${L.guests}: ${adults} ${L.adults}${kids > 0 ? `, ${kids} ${L.kids}` : ""}`,
      "",
      ...roomLines.map((l) => `- ${l.label} x ${l.qty} — RM ${l.total.toFixed(2)}`),
      ...itemLines.map((l) => `- ${l.label} x ${l.qty} — RM ${l.total.toFixed(2)}`),
      "",
      `${L.est}: RM ${estimatedTotal.toFixed(2)}`,
      `${L.name}: ${guestName.trim() || "-"}`,
    ];
    if (note.trim()) lines.push(`${L.note}: ${note.trim()}`);
    return lines.join("\n");
  }, [bm, checkin, checkout, nights, adults, kids, roomLines, itemLines, estimatedTotal, guestName, note]);

  const waHref = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">
            Rajawali D'Cabin
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/book" className="text-xs uppercase tracking-widest text-stone hover:text-forest">
              {bm ? "Tempah dalam talian" : "Book online"}
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone">WhatsApp store</p>
        <h1 className="mt-2 font-display text-3xl text-forest sm:text-4xl">
          {bm ? "Bina percutian anda, hantar melalui WhatsApp" : "Build your stay, send it on WhatsApp"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/75">
          {bm
            ? "Pilih tarikh, tambah kabin dan barangan tambahan ke troli, kemudian hantar satu mesej kemas kepada kami. Tiada bayaran dalam talian — tarikh hanya disahkan selepas kami membalas di WhatsApp."
            : "Pick your dates, add cabins and add-ons to the cart, then send us one tidy message. No online payment — nothing is reserved until we confirm in the chat."}
        </p>

        {!storeOpen && (
          <div className="mt-6 rounded-xl border border-border bg-coconut px-4 py-3 text-sm text-forest">
            {bm
              ? "Kedai WhatsApp ditutup buat sementara waktu. Sila tempah dalam talian atau hubungi kami terus."
              : "The WhatsApp store is temporarily closed. Please book online or message us directly."}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            {/* Dates */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-stone">{bm ? "Tarikh" : "Dates"}</p>
                  <h2 className="mt-0.5 font-display text-base text-forest">
                    {nights > 0
                      ? `${prettyDate(checkin)} → ${prettyDate(checkout)} · ${nights} ${bm ? "malam" : "night" + (nights === 1 ? "" : "s")}`
                      : bm
                        ? "Pilih malam anda"
                        : "Pick your nights"}
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-stone">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-forest" /> {bm ? "Pilihan" : "Your stay"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-200" /> {bm ? "Penuh" : "Sold out"}
                  </span>
                </div>
              </div>

              {rangeBlocked && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {bm
                    ? "Tiada kekosongan pada salah satu malam yang dipilih. Sila pilih tarikh lain."
                    : "No vacancy on one of the selected nights — please choose different dates."}
                </div>
              )}

              <div className="mt-3 overflow-x-auto">
                <Calendar
                  mode="range"
                  numberOfMonths={isMobile ? 1 : 2}
                  showOutsideDays={false}
                  selected={nights > 0 ? { from: parseLocalDate(checkin), to: parseLocalDate(checkout) } : undefined}
                  onSelect={(r) => {
                    if (!r?.from) return;
                    const from = formatLocalDate(r.from);
                    setCheckin(from);
                    setCheckout(
                      r.to && r.to.getTime() !== r.from.getTime() ? formatLocalDate(r.to) : addDaysISO(from, 1),
                    );
                  }}
                  disabled={[{ before: parseLocalDate(todayStr) }, ...blockedDates.map(parseLocalDate)]}
                  modifiers={{ booked: blockedDates.map(parseLocalDate) }}
                  modifiersClassNames={{
                    booked:
                      "relative !bg-red-100 !text-red-700 cursor-not-allowed [&>*]:line-through aria-disabled:!opacity-100 after:absolute after:inset-x-1 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-red-400",
                  }}
                  components={{
                    DayButton: (btnProps) => {
                      const ds = formatLocalDate(btnProps.day.date);
                      const title = fullyBooked.has(ds) ? "Fully booked — no vacancy" : undefined;
                      return <CalendarDayButton {...btnProps} title={title} aria-label={title ?? undefined} />;
                    },
                  }}
                  className="pointer-events-auto p-0 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
                  classNames={{ today: "font-semibold text-forest underline underline-offset-4" }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    {bm ? "Dewasa" : "Adults"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-stone">
                    {bm ? "Kanak-kanak (bawah 12)" : "Children (under 12)"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={kids}
                    onChange={(e) => setKids(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            {/* Cabins */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.3em] text-stone">{bm ? "Kabin" : "Cabins"}</p>
              <h2 className="mt-0.5 font-display text-base text-forest">
                {bm ? "Pilih bilik untuk tarikh ini" : "Choose rooms for these dates"}
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {groups.map((g) => {
                  const free = freeRoomsForType(g.type);
                  const rate = rateByType[g.type];
                  const qty = roomQty[g.type] ?? 0;
                  return (
                    <li key={g.type} className="rounded-lg border border-border bg-background px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-sm text-forest">{g.label}</p>
                          <p className="text-[11px] text-stone">
                            {bm ? "Muat" : "Sleeps"} {g.rooms[0]?.capacity ?? 2} ·{" "}
                            {free === 0
                              ? bm
                                ? "Penuh"
                                : "Fully booked"
                              : `${free}/${g.rooms.length} ${bm ? "kosong" : "free"}`}
                          </p>
                          <p className="mt-1 text-sm text-forest">
                            {rate ? `RM ${rate.total.toFixed(2)} / ${bm ? "bilik" : "room"}` : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Remove one ${g.label}`}
                            onClick={() => setQty(roomQty, setRoomQty, g.type, -1, free)}
                            className="rounded-full border border-border p-1.5 text-stone hover:text-forest disabled:opacity-40"
                            disabled={qty === 0}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm">{qty}</span>
                          <button
                            type="button"
                            aria-label={`Add one ${g.label}`}
                            onClick={() => setQty(roomQty, setRoomQty, g.type, 1, free)}
                            className="rounded-full border border-border p-1.5 text-stone hover:text-forest disabled:opacity-40"
                            disabled={qty >= free}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Add-ons */}
            {items.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.3em] text-stone">{bm ? "Tambahan" : "Add-ons"}</p>
                <h2 className="mt-0.5 font-display text-base text-forest">
                  {bm ? "Lengkapkan percutian anda" : "Complete your stay"}
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {items.map((it) => {
                    const qty = itemQty[it.id] ?? 0;
                    const desc = bm ? it.description_bm : it.description_en;
                    return (
                      <li key={it.id} className="rounded-lg border border-border bg-background px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {it.image_url && (
                              <img
                                src={it.image_url}
                                alt={bm ? it.name_bm : it.name_en}
                                loading="lazy"
                                className="h-12 w-12 rounded-md object-cover"
                              />
                            )}
                            <div>
                              <p className="font-display text-sm text-forest">{bm ? it.name_bm : it.name_en}</p>
                              {desc && <p className="text-[11px] text-stone">{desc}</p>}
                              <p className="mt-1 text-sm text-forest">
                                RM {it.price.toFixed(2)} <span className="text-[11px] text-stone">{it.unit}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Remove one ${it.name_en}`}
                              onClick={() => setQty(itemQty, setItemQty, it.id, -1, 20)}
                              className="rounded-full border border-border p-1.5 text-stone hover:text-forest disabled:opacity-40"
                              disabled={qty === 0}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm">{qty}</span>
                            <button
                              type="button"
                              aria-label={`Add one ${it.name_en}`}
                              onClick={() => setQty(itemQty, setItemQty, it.id, 1, 20)}
                              className="rounded-full border border-border p-1.5 text-stone hover:text-forest"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Cart */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-forest/30 bg-coconut p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.3em] text-forest">{bm ? "Troli anda" : "Your cart"}</p>
              <h2 className="mt-0.5 font-display text-lg text-forest">
                {nights > 0
                  ? `${nights} ${bm ? "malam" : "night" + (nights === 1 ? "" : "s")} · ${totalRooms} ${bm ? "bilik" : "room" + (totalRooms === 1 ? "" : "s")}`
                  : bm
                    ? "Pilih tarikh dahulu"
                    : "Pick dates first"}
              </h2>

              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {!hasSelection && (
                  <li className="rounded-lg border border-dashed border-forest/30 px-3 py-3 text-xs text-stone">
                    {bm ? "Troli masih kosong." : "Nothing in the cart yet."}
                  </li>
                )}
                {[...roomLines, ...itemLines].map((l) => (
                  <li key={l.label} className="flex justify-between gap-2">
                    <span className="text-foreground/80">
                      {l.label} × {l.qty}
                    </span>
                    <span className="text-forest">RM {l.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex justify-between border-t border-forest/20 pt-3 text-sm font-medium">
                <span className="text-stone">{bm ? "Anggaran jumlah" : "Estimated total"}</span>
                <span className="text-forest">RM {estimatedTotal.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-[11px] text-stone">
                {bm
                  ? "Anggaran sahaja — diskaun dan jumlah akhir disahkan oleh pemilik di WhatsApp."
                  : "Estimate only — discounts and the final total are confirmed by the owner on WhatsApp."}
              </p>

              <div className="mt-4 grid gap-2">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={bm ? "Nama anda" : "Your name"}
                  aria-label={bm ? "Nama anda" : "Your name"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={bm ? "Nota (pilihan)" : "Note (optional)"}
                  aria-label={bm ? "Nota" : "Note"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!hasSelection || nights < 1 || rangeBlocked}
                onClick={(e) => {
                  if (!hasSelection || nights < 1 || rangeBlocked) e.preventDefault();
                }}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-xs font-medium uppercase tracking-widest ${
                  hasSelection && nights >= 1 && !rangeBlocked
                    ? "bg-forest text-coconut hover:bg-forest/90"
                    : "pointer-events-none bg-forest/40 text-coconut"
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                {bm ? "Hantar pesanan di WhatsApp" : "Order on WhatsApp"}
              </a>

              <p className="mt-3 text-[11px] text-stone">
                {bm ? (
                  <>
                    Mahu bayar dalam talian dan tempah serta-merta?{" "}
                    <Link to="/book" className="underline text-forest">
                      Tempah dalam talian
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Prefer to reserve instantly with a deposit?{" "}
                    <Link to="/book" className="underline text-forest">
                      Book online
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
