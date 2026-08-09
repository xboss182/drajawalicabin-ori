import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarIcon, Users, BedDouble, Search, MessageCircle, CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import heroRiverside from "@/assets/hero-riverside.jpg";
import cabinsExterior from "@/assets/cabins-exterior.jpg";
import cabinQueen from "@/assets/cabin-queen.jpg";
import cabinTwin from "@/assets/cabin-twin.jpg";
import cabinFamily from "@/assets/cabin-family.jpg";
import cabinTriple from "@/assets/cabin-triple.jpg";
import nearbyMosqueAsset from "@/assets/nearby-mosque.jpg.asset.json";
import nearbyBeachAsset from "@/assets/nearby-beach.jpg.asset.json";
import nearbyCraftAsset from "@/assets/nearby-craft.jpg.asset.json";
import toilet2paxAsset from "@/assets/toilet-2pax.png.asset.json";
import toilet3paxAsset from "@/assets/toilet-3pax.png.asset.json";
import toilet4paxAsset from "@/assets/toilet-4pax.png.asset.json";
import galleryPool from "@/assets/gallery/pool-01.jpg.asset.json";
import galleryBbq from "@/assets/gallery/bbq-pavilion-01.jpg.asset.json";
import { LanguageToggle, useLanguage } from "@/lib/i18n";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getHeroPromoCta } from "@/lib/promo-cta.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rajawali D'Cabin Chalet | Roomstay & Chalet Chendering, KT" },
      { name: "description", content: "Rajawali D'Cabin Chalet — Muslim-friendly riverside chalet & roomstay in Chendering, Kuala Terengganu. 8 private cabins for family staycations near the city." },
      { name: "keywords", content: "Rajawali D'Cabin Chalet, Chalet Chendering, Roomstay Chendering, Chalet Kuala Terengganu, Roomstay Kuala Terengganu, Accommodation Kuala Terengganu, Staycation Kuala Terengganu, Family Chalet Terengganu, Muslim-friendly Chalet Kuala Terengganu" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Rajawali D'Cabin Chalet — Chalet & Roomstay in Chendering, KT" },
      { property: "og:description", content: "Muslim-friendly riverside chalet in Chendering, Kuala Terengganu. 8 private family-friendly cabins for a peaceful Terengganu staycation." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://drajawalicabin.com/" },
      { property: "og:site_name", content: "Rajawali D'Cabin Chalet" },
      { property: "og:locale", content: "en_MY" },
      { property: "og:image", content: heroRiverside },
      { property: "og:image:alt", content: "Riverside cabins at Rajawali D'Cabin Chalet, Chendering" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Rajawali D'Cabin Chalet — Chalet Chendering, Kuala Terengganu" },
      { name: "twitter:description", content: "Muslim-friendly riverside chalet & roomstay in Chendering, KT. 8 private cabins for a quiet family staycation." },
      { name: "twitter:image", content: heroRiverside },
      { name: "geo.region", content: "MY-11" },
      { name: "geo.placename", content: "Chendering, Kuala Terengganu" },
    ],
    links: [
      { rel: "canonical", href: "https://drajawalicabin.com/" },
      { rel: "preload", as: "image", href: heroRiverside, fetchpriority: "high" } as unknown as Record<string, string>,
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LodgingBusiness",
          name: "Rajawali D'Cabin Chalet",
          alternateName: [
            "Rajawali DCabin Chalet",
            "Rajawali D Cabin Chalet",
            "D'Cabin Chalet",
            "Chalet Rajawali Chendering",
          ],
          description: "Muslim-friendly riverside chalet and roomstay in Chendering, Kuala Terengganu, Terengganu, Malaysia. 8 private cabins for family staycations.",
          url: "https://drajawalicabin.com/",
          image: `https://drajawalicabin.com${heroRiverside}`,
          telephone: "+60 11-5500 7204",
          priceRange: "RM",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Chendering",
            addressRegion: "Terengganu",
            addressCountry: "MY",
            postalCode: "21080",
            streetAddress: "Chendering, Kuala Terengganu",
          },
          checkinTime: "15:00",
          checkoutTime: "12:00",
          numberOfRooms: 8,
          amenityFeature: [
            { "@type": "LocationFeatureSpecification", name: "Free WiFi", value: true },
            { "@type": "LocationFeatureSpecification", name: "Air conditioning", value: true },
            { "@type": "LocationFeatureSpecification", name: "Private bathroom", value: true },
            { "@type": "LocationFeatureSpecification", name: "TV", value: true },
            { "@type": "LocationFeatureSpecification", name: "Free parking", value: true },
            { "@type": "LocationFeatureSpecification", name: "Family friendly", value: true },
            { "@type": "LocationFeatureSpecification", name: "Muslim friendly", value: true },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://drajawalicabin.com/" },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Where is Rajawali D'Cabin Chalet located?",
              acceptedAnswer: { "@type": "Answer", text: "Rajawali D'Cabin Chalet is a riverside chalet in Chendering, Kuala Terengganu, Terengganu — a short drive from the Kuala Terengganu city centre." },
            },
            {
              "@type": "Question",
              name: "How do I book a cabin?",
              acceptedAnswer: { "@type": "Answer", text: "Check available dates on our website and complete the booking online. Bookings are secured with a refundable RM50 security deposit per room (not part of the room rate, refunded after check-out subject to room inspection). The full room rate must be settled at least 7 days before check-in. Cancellations within 7 days of check-in are strictly non-refundable." },
            },
            {
              "@type": "Question",
              name: "Do children stay free?",
              acceptedAnswer: { "@type": "Answer", text: "Yes. Up to 2 children under 12 years old stay free per room, sharing the existing bedding." },
            },
            {
              "@type": "Question",
              name: "Is Rajawali D'Cabin Chalet family and Muslim friendly?",
              acceptedAnswer: { "@type": "Answer", text: "Yes. The chalet is family-friendly and Muslim-friendly, with private cabins suitable for families and groups visiting Kuala Terengganu." },
            },
            {
              "@type": "Question",
              name: "What are the check-in and check-out times?",
              acceptedAnswer: { "@type": "Answer", text: "Check-in is from 3:00 PM and check-out is by 12:00 PM." },
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

const WHATSAPP_NUMBER = "601155007204"; // +60 11-5500 7204
function waHref(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

const cabinImages = [cabinQueen, cabinTwin, cabinFamily, cabinTriple];
const nearbyImages = [nearbyMosqueAsset.url, nearbyBeachAsset.url, nearbyCraftAsset.url];

function Index() {
  return (
    <main className="relative bg-background text-foreground">
      <Nav />
      <Hero />
      <AvailabilitySearch />
      <About />
      <Accommodation />
      <WhyStay />
      <NearbySection />
      <GoodToKnow />
      <Footer />
      <MobileCtaBar />
    </main>
  );
}

/* ---------------- Nav ---------------- */
function Nav() {
  const { t } = useLanguage();
  return (
    <header className="absolute left-0 right-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="#top" className="flex items-center gap-2 text-coconut">
          <Leaf />
          <span className="font-display text-lg leading-none">
            Rajawali D'Cabin
            <span className="block text-[10px] uppercase tracking-[0.25em] opacity-80">
              Chalet · Chendering
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-coconut/90 md:flex">
          <a href="#stay" className="hover:text-coconut">{t.nav.cabins}</a>
          <a href="#about" className="hover:text-coconut">{t.nav.about}</a>
          <a href="#nearby" className="hover:text-coconut">{t.nav.nearby}</a>
          <Link to="/gallery" className="hover:text-coconut">Gallery</Link>
          <Link to="/booking-guide" className="hover:text-coconut">Guide</Link>
          <a href="#book" className="hover:text-coconut">{t.nav.book}</a>
          <Link
            to="/manage-booking"
            search={{ id: "", token: "" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-coconut px-3 py-1.5 text-xs font-medium text-forest shadow-lg shadow-forest/20 transition hover:bg-sand hover:text-forest"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {t.nav.manageBooking}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            to="/manage-booking"
            search={{ id: "", token: "" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-coconut px-2.5 py-1.5 text-[11px] font-medium text-forest shadow-lg shadow-forest/20 transition hover:bg-sand md:hidden"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {t.nav.manageBooking}
          </Link>
          <a
            href={waHref(t.whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex rounded-full border border-coconut/40 bg-coconut/10 px-4 py-2 text-xs uppercase tracking-widest text-coconut backdrop-blur transition hover:bg-coconut hover:text-forest"
          >
            {t.nav.whatsapp}
          </a>
        </div>
      </div>
    </header>
  );
}

function Leaf() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16Z" />
      <path d="M4 20c4-4 7-7 16-9" />
    </svg>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  const { t, lang } = useLanguage();
  const { data: promo } = useQuery({
    queryKey: ["hero-promo-cta"],
    queryFn: () => getHeroPromoCta(),
    staleTime: 60_000,
  });
  const activePromo = promo?.items.find((i) => i.enabled) ?? null;
  const promoText = activePromo
    ? lang === "bm"
      ? activePromo.text_bm
      : activePromo.text_en
    : `${t.promo.title} — ${t.promo.body}`;
  const promoEnabled = promo ? activePromo !== null : true;
  return (
    <section id="top" className="relative min-h-[62svh] w-full overflow-hidden sm:min-h-[78svh] lg:min-h-[82svh]">
      <img
        src={heroRiverside}
        alt="Riverside cabins at Rajawali D'Cabin Chalet at twilight, Chendering, Kuala Terengganu"
        width={1920}
        height={1080}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-forest/40 via-forest/30 to-forest/85" />
      <div className="relative mx-auto flex min-h-[62svh] max-w-7xl flex-col justify-end px-6 pb-14 pt-20 text-coconut sm:min-h-[78svh] sm:pb-28 sm:pt-32 lg:min-h-[82svh] lg:px-10 lg:pb-32 lg:pt-36">
        <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-coconut/30 bg-coconut/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.3em] backdrop-blur">
          <span className="size-1.5 rounded-full bg-coconut" /> {t.hero.badge}
        </span>
        <h1 className="max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
          <span className="sr-only">
            Rajawali D'Cabin Chalet — Riverside Cabin Accommodations in Chendering, Kuala Terengganu
          </span>
          <span aria-hidden="true">
            {t.hero.title1}<br />{t.hero.title2}
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-coconut/85 sm:text-lg">
          {t.hero.body}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#book"
            className="rounded-full bg-coconut px-7 py-3.5 text-sm font-medium text-forest transition hover:bg-sand"
          >
            {t.hero.cta}
          </a>
          <a href="#stay" className="text-sm text-coconut/85 underline-offset-4 hover:underline">
            {t.hero.view}
          </a>
          {promoEnabled && (
            <div className="sm:ml-auto inline-flex items-center gap-3 rounded-3xl border border-sand/50 bg-forest/40 px-6 py-3.5 text-lg leading-snug text-coconut shadow-lg backdrop-blur-md sm:text-xl sm:leading-relaxed">
              <Sparkles className="h-6 w-6 shrink-0 text-sand" aria-hidden />
              <span className="leading-snug text-sand sm:leading-relaxed">
                {promoText}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Link
            to="/manage-booking"
            search={{ id: "", token: "" }}
            className="inline-flex items-center gap-2 rounded-full border border-coconut/40 bg-coconut/10 px-4 py-2 text-sm text-coconut backdrop-blur transition hover:bg-coconut hover:text-forest"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            {t.hero.alreadyBooked}
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.25em] text-coconut/70">
          <span>8 private cabins</span>
          <span className="hidden sm:inline opacity-50">·</span>
          <span>Riverside · Chendering</span>
          <span className="hidden sm:inline opacity-50">·</span>
          <a href={waHref(t.whatsappMessage)} target="_blank" rel="noreferrer" className="hover:text-coconut">WhatsApp booking</a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Availability ---------------- */
function AvailabilitySearch() {
  const { t, lang } = useLanguage();
  const { data: promo } = useQuery({
    queryKey: ["hero-promo-cta"],
    queryFn: () => getHeroPromoCta(),
    staleTime: 60_000,
  });
  const activePromo = promo?.items.find((i) => i.enabled) ?? null;
  const promoText = activePromo
    ? lang === "bm"
      ? activePromo.text_bm
      : activePromo.text_en
    : null;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const [range, setRange] = useState<DateRange | undefined>({
    from: todayDate,
    to: tomorrowDate,
  });
  const [guests, setGuests] = useState("2");
  const [room, setRoom] = useState(t.search.anyCabin);
  const [openCal, setOpenCal] = useState(false);
  const navigate = useNavigate();

  const fmtISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const nights =
    range?.from && range?.to
      ? Math.max(
          1,
          Math.round((range.to.getTime() - range.from.getTime()) / 86400000),
        )
      : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!range?.from || !range?.to) return;
    navigate({
      to: "/book",
      search: {
        checkin: fmtISO(range.from),
        checkout: fmtISO(range.to),
        guests,
        room,
      },
    });
  }

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleRangeSelect = (newRange: DateRange | undefined) => {
    if (!newRange?.from) {
      setRange(newRange);
      return;
    }

    // Determine which date the user actually clicked by comparing with the current range.
    const clickedDate = (() => {
      if (!range?.from) return newRange.from;
      const oldDates = [range.from];
      if (range.to) oldDates.push(range.to);
      const newDates = [newRange.from];
      if (newRange.to) newDates.push(newRange.to);
      for (const d of newDates) {
        if (!oldDates.some((od) => isSameDate(od, d))) return d;
      }
      return newRange.from;
    })();

    // No existing range or a complete range: start a new selection from the clicked date.
    if (!range?.from || (range.from && range.to)) {
      setRange({ from: clickedDate, to: undefined });
      return;
    }

    // Partial range (from set, to unset)
    if (isSameDate(clickedDate, range.from) || clickedDate < range.from) {
      setRange({ from: clickedDate, to: undefined });
      return;
    }

    setRange({ from: range.from, to: clickedDate });
    setOpenCal(false);
  };

  return (
    <section id="book" className="relative z-20 -mt-24 px-4 sm:px-6 lg:px-10">
      <form
        onSubmit={submit}
        className="mx-auto flex max-w-6xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl shadow-forest/25 lg:flex-row lg:items-stretch"
      >
        {/* Dates - wider */}
        <Popover open={openCal} onOpenChange={setOpenCal}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group flex flex-[1.6] min-w-0 items-center gap-4 px-5 py-3 text-left transition hover:bg-muted/40 lg:px-7 lg:py-4"
            >
              <CalendarIcon className="h-5 w-5 shrink-0 text-forest" />
              <DateCell label={t.search.checkin} date={range?.from} />
              <div className="hidden flex-col items-center px-2 text-stone sm:flex">
                <span className="text-[10px] uppercase tracking-[0.2em]">
                  {nights} {nights === 1 ? "night" : "nights"}
                </span>
                <div className="mt-1 h-px w-8 bg-border" />
              </div>
              <DateCell label={t.search.checkout} date={range?.to} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="pointer-events-auto w-auto p-0">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              disabled={{ before: todayDate }}
              defaultMonth={range?.from ?? todayDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <div className="h-px w-full bg-border lg:h-auto lg:w-px" />

        {/* Guests - narrower */}
        <div className="flex flex-[0.6] min-w-0 items-center gap-4 px-5 py-3 lg:px-6 lg:py-4">
          <Users className="h-5 w-5 shrink-0 text-forest" />
          <div className="flex flex-1 min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">
              {t.search.guests}
            </span>
            <Select value={guests} onValueChange={setGuests}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-base font-semibold text-foreground shadow-none hover:bg-transparent focus:ring-0 [&>span]:truncate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5", "6+"].map((o) => (
                  <SelectItem key={o} value={o}>
                    {o} {t.search.guests.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-px w-full bg-border lg:h-auto lg:w-px" />

        {/* Room type - narrower */}
        <div className="flex flex-[0.8] min-w-0 items-center gap-4 px-5 py-3 lg:px-6 lg:py-4">
          <BedDouble className="h-5 w-5 shrink-0 text-forest" />
          <div className="flex flex-1 min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">
              {t.search.room}
            </span>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-base font-semibold text-foreground shadow-none hover:bg-transparent focus:ring-0 [&>span]:truncate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: t.search.anyCabin, label: t.search.anyCabin },
                  { value: "Deluxe Queen", label: "Queen Room" },
                  { value: "Deluxe Twin", label: "Twin Room" },
                  { value: "Family Suite", label: "Family Room" },
                  { value: "Triple Suite", label: "Triple Room" },
                ].map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={cn(
            "flex items-center justify-center gap-2 bg-forest px-8 py-4 text-base font-semibold text-coconut transition hover:bg-forest/90",
            "lg:m-2 lg:rounded-2xl lg:px-10",
          )}
        >
          <Search className="h-5 w-5" />
          {t.search.submit}
        </button>
      </form>
      <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-foreground/70 sm:text-sm">
        {t.search.note}
      </p>
      {promoText && (
        <p className="mx-auto mt-2 hidden max-w-3xl items-center justify-center gap-1.5 text-center text-[11px] font-medium text-forest sm:flex sm:text-xs">
          <span aria-hidden>✦</span>
          {promoText}
        </p>
      )}
      <p className="mx-auto mt-1.5 hidden max-w-3xl text-center text-[11px] text-foreground/60 sm:block sm:text-xs">
        {t.search.childNote}
      </p>
    </section>
  );
}

function DateCell({ label, date }: { label: string; date?: Date }) {
  return (
    <div className="flex flex-1 min-w-0 flex-col gap-0">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">
        {label}
      </span>
      {date ? (
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold leading-none text-foreground">
            {date.getDate()}
          </span>
          <span className="text-sm text-foreground/80">
            {date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </span>
        </div>
      ) : (
        <span className="text-base text-stone">Select date</span>
      )}
      {date && (
        <span className="text-xs text-stone">
          {date.toLocaleDateString("en-US", { weekday: "long" })}
        </span>
      )}
    </div>
  );
}

/* ---------------- About ---------------- */
function About() {
  const { t } = useLanguage();
  return (
    <section id="about" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{t.about.eyebrow}</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t.about.title1}<br />{t.about.title2}
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/80">
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
            <p className="text-forest">{t.about.p3}</p>
          </div>
          <div className="mt-8 flex items-center gap-5 border-t border-border pt-6">
            <div>
              <p className="font-display text-3xl text-forest leading-none">{t.about.badgeNum}</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-stone">{t.about.badgeLabel}</p>
            </div>
            <a href="#stay" className="ml-auto inline-flex items-center gap-2 text-sm text-forest hover:gap-3 transition-all">
              Explore the cabins →
            </a>
          </div>
        </div>
        <div className="relative">
          <img
            src={cabinsExterior}
            alt="Chalet cabins among coconut palms at dusk"
            width={1600}
            height={1067}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Accommodation ---------------- */
const cabinToilets = [
  toilet2paxAsset.url, // Queen
  toilet2paxAsset.url, // Twin
  toilet4paxAsset.url, // Family (sleeps 4)
  toilet3paxAsset.url, // Triple (sleeps 3)
];

function CabinCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  return (
    <div className="relative aspect-[4/3] overflow-hidden">
      <div
        className="flex h-full w-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={i === 0 ? alt : `${alt} — private bathroom`}
            width={1280}
            height={960}
            loading="lazy"
            className="h-full w-full shrink-0 object-cover"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={prev}
        aria-label="Previous image"
        className="absolute left-2 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-coconut/85 text-forest shadow-sm backdrop-blur transition hover:bg-coconut"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next image"
        className="absolute right-2 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-coconut/85 text-forest shadow-sm backdrop-blur transition hover:bg-coconut"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {images.map((_, i) => (
          <span
            key={i}
            className={`block h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-coconut" : "w-1.5 bg-coconut/60"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Accommodation() {
  const { t } = useLanguage();
  return (
    <section id="stay" className="bg-secondary/40 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{t.stay.eyebrow}</p>
            <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
              {t.stay.title1}<br />{t.stay.title2}
            </h2>
          </div>
          <p className="max-w-sm text-sm text-foreground/70">
            {t.stay.intro}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.stay.cabins.map((c, idx) => (
            <article key={c.name} className="group flex flex-col overflow-hidden rounded-lg bg-card shadow-sm">
              <div className="relative">
                <CabinCarousel images={[cabinImages[idx], cabinToilets[idx]]} alt={`${c.name} interior`} />
                <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-coconut/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-forest backdrop-blur">
                  {c.sleeps}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <h3 className="font-display text-xl leading-tight">{c.name}</h3>
                <ul className="grid grid-cols-1 gap-x-3 gap-y-1.5 text-[13px] text-foreground/75 sm:grid-cols-2">
                  {c.features.map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-forest/60" />
                      <span className="min-w-0">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#book"
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-forest px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-coconut transition hover:bg-forest/90"
                >
                  {t.stay.cta}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Why stay ---------------- */
function WhyStay() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* Left: reasons */}
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{t.why.eyebrow}</p>
          <h2 className="mb-10 font-display text-4xl leading-tight sm:text-5xl">
            {t.why.title1}<br />{t.why.title2}
          </h2>
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {t.why.reasons.map((r, i) => (
              <div key={r.title} className="border-t border-border pt-5">
                <p className="text-xs text-stone">0{i + 1}</p>
                <h3 className="mt-2 font-display text-lg text-forest">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{r.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: two stacked gallery boxes */}
        <aside className="flex flex-col gap-4 lg:pl-4">
          <Link
            to="/gallery"
            className="group relative overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label="View pool in gallery"
          >
            <div className="aspect-[4/2.55]">
              <img
                src={galleryPool.url}
                alt="Splash pool at Rajawali D'Cabin Chalet"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            </div>
            <span className="absolute bottom-3 left-3 rounded-full bg-coconut/90 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-forest backdrop-blur">
              Pool
            </span>
            <span className="absolute inset-0 flex items-center justify-center bg-forest/0 text-coconut opacity-0 transition duration-300 group-hover:bg-forest/30 group-hover:opacity-100">
              <span className="rounded-full bg-coconut px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-forest">
                View gallery →
              </span>
            </span>
          </Link>
          <Link
            to="/gallery"
            className="group relative hidden overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest sm:block"
            aria-label="View BBQ area in gallery"
          >
            <div className="aspect-[4/2.55]">
              <img
                src={galleryBbq.url}
                alt="BBQ pavilion at Rajawali D'Cabin Chalet"
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            </div>
            <span className="absolute bottom-3 left-3 rounded-full bg-coconut/90 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-forest backdrop-blur">
              BBQ area
            </span>
            <span className="absolute inset-0 flex items-center justify-center bg-forest/0 text-coconut opacity-0 transition duration-300 group-hover:bg-forest/30 group-hover:opacity-100">
              <span className="rounded-full bg-coconut px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-forest">
                View gallery →
              </span>
            </span>
          </Link>
          <Link
            to="/whatsapp-store"
            className="group rounded-2xl border border-forest/20 bg-coconut px-5 py-4 transition hover:bg-forest hover:text-coconut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label="Open the WhatsApp store"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-forest group-hover:text-coconut/80">
              WhatsApp store
            </p>
            <p className="mt-1 font-display text-lg text-forest group-hover:text-coconut">
              Build your stay, order in one message →
            </p>
            <p className="mt-1 text-xs text-stone group-hover:text-coconut/80">
              Cabins, BBQ set and add-ons — sent straight to our WhatsApp.
            </p>
          </Link>
        </aside>
      </div>

    </section>
  );
}




/* ---------------- Nearby ---------------- */
function NearbySection() {
  const { t } = useLanguage();
  return (
    <section id="nearby" className="bg-forest text-coconut py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-coconut/60">{t.nearby.eyebrow}</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t.nearby.title}
          </h2>
          <p className="mt-4 text-coconut/75">
            {t.nearby.body}
          </p>
          <p className="mt-4 text-sm text-coconut/65">
            <span className="text-coconut">{t.nearby.alsoLabel}</span> {t.nearby.also}
          </p>
        </div>
        <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
          {t.nearby.items.map((n, idx) => (
            <figure key={n.name} className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-lg md:w-auto md:shrink">
              <div className="aspect-[4/3] overflow-hidden md:aspect-[3/4]">
                <img
                  src={nearbyImages[idx]}
                  alt={`${n.name} — nearby attraction from Rajawali D'Cabin Chalet, Kuala Terengganu`}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <figcaption className="pt-4">
                <p className="font-display text-xl">{n.name}</p>
                <p className="text-sm text-coconut/65">{n.note}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-coconut text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:gap-12 sm:py-20 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <p className="font-display text-3xl text-forest">Rajawali D'Cabin Chalet</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-foreground/70">
            {t.footer.tagline}
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone">{t.footer.visit}</p>
          <p className="text-foreground/80">
            {t.footer.address1}<br />{t.footer.address2}<br />{t.footer.address3}
          </p>
          <a
            href="https://maps.google.com/?q=Rajawali+D'Cabin+Chalet+Kuala+Terengganu"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-forest underline-offset-4 hover:underline"
          >
            {t.footer.maps}
          </a>
        </div>
        <div className="text-sm">
          <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-stone">{t.footer.reach}</p>
          <ul className="space-y-2 text-foreground/80">
            <li>
              <a href={waHref(t.whatsappMessage)} target="_blank" rel="noreferrer" className="hover:text-forest">
                {t.footer.whatsapp}
              </a>
            </li>
            <li>
              <a href="https://www.facebook.com/p/Rajawali-DCabin-Chalet-100068093830245/" target="_blank" rel="noreferrer" className="hover:text-forest">
                Facebook
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-stone sm:flex-row sm:items-center lg:px-10">
          <p>{t.footer.copyright.replace("{year}", String(new Date().getFullYear()))}</p>
          <p className="hidden italic sm:block">{t.footer.slogan}</p>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Good to know ---------------- */
function GoodToKnow() {
  const { t } = useLanguage();
  return (
    <section className="bg-secondary/40 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-stone">{t.goodToKnow.eyebrow}</p>
        <h2 className="mb-10 max-w-2xl font-display text-3xl leading-tight sm:text-4xl">
          {t.goodToKnow.title}
        </h2>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 md:grid-cols-3">
          {t.goodToKnow.items.map((it, i) => (
            <div key={it.title} className="border-t border-border pt-5">
              <p className="text-xs text-stone">0{i + 1}</p>
              <h3 className="mt-2 font-display text-lg text-forest">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Mobile sticky CTA bar ---------------- */
function MobileCtaBar() {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden">
      <a
        href={waHref(t.whatsappMessage)}
        target="_blank"
        rel="noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-forest px-4 py-2.5 text-center text-sm font-semibold uppercase tracking-wider text-coconut"
      >
        <MessageCircle className="h-4 w-4" />
        {t.nav.whatsapp}
      </a>
    </div>
  );
}
