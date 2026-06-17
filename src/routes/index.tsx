import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import heroRiverside from "@/assets/hero-riverside.jpg";
import cabinsExterior from "@/assets/cabins-exterior.jpg";
import cabinQueen from "@/assets/cabin-queen.jpg";
import cabinTwin from "@/assets/cabin-twin.jpg";
import cabinFamily from "@/assets/cabin-family.jpg";
import cabinTriple from "@/assets/cabin-triple.jpg";
import nearbyMosque from "@/assets/nearby-mosque.jpg";
import nearbyBeach from "@/assets/nearby-beach.jpg";
import nearbyCraft from "@/assets/nearby-craft.jpg";
import { LanguageToggle, useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rajawali D'Cabin Chalet — Hidden Riverside Cabins in Kuala Ibai" },
      { name: "description", content: "A peaceful chalet stay surrounded by nature in Kuala Ibai, Terengganu. Only 8 private cabins — every stay feels personal." },
      { property: "og:title", content: "Rajawali D'Cabin Chalet — Hidden Riverside Cabins" },
      { property: "og:description", content: "Only 8 private cabins in Kuala Ibai, Terengganu. Boutique chalet retreat for families, couples, and weekend escapes." },
      { property: "og:image", content: heroRiverside },
      { name: "twitter:image", content: heroRiverside },
    ],
  }),
  component: Index,
});

const WHATSAPP = "60115500204"; // 011-5500 7204 -> intl format approx; will be updated below
const WHATSAPP_NUMBER = "60115007204"; // 011-5500 7204

const cabinImages = [cabinQueen, cabinTwin, cabinFamily, cabinTriple];
const nearbyImages = [nearbyMosque, nearbyBeach, nearbyCraft];

function Index() {
  return (
    <main className="bg-background text-foreground">
      <Nav />
      <Hero />
      <AvailabilitySearch />
      <About />
      <Accommodation />
      <WhyStay />
      <NearbySection />
      <Footer />
    </main>
  );
}

/* ---------------- Nav ---------------- */
function Nav() {
  const { t } = useLanguage();
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="#top" className="flex items-center gap-2 text-coconut">
          <Leaf />
          <span className="font-display text-lg leading-none">
            Rajawali D'Cabin
            <span className="block text-[10px] uppercase tracking-[0.25em] opacity-80">
              Chalet · Kuala Ibai
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-coconut/90 md:flex">
          <a href="#stay" className="hover:text-coconut">{t.nav.cabins}</a>
          <a href="#about" className="hover:text-coconut">{t.nav.about}</a>
          <a href="#nearby" className="hover:text-coconut">{t.nav.nearby}</a>
          <a href="#book" className="hover:text-coconut">{t.nav.book}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
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
  const { t } = useLanguage();
  return (
    <section id="top" className="relative min-h-[100svh] w-full overflow-hidden">
      <img
        src={heroRiverside}
        alt="Twilight over the river at Kuala Ibai"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-forest/40 via-forest/30 to-forest/85" />
      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-6 pb-24 pt-40 text-coconut lg:px-10">
        <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-coconut/30 bg-coconut/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.3em] backdrop-blur">
          <span className="size-1.5 rounded-full bg-coconut" /> {t.hero.badge}
        </span>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
          {t.hero.title1}<br />{t.hero.title2}
        </h1>
        <p className="mt-6 max-w-xl text-base text-coconut/85 sm:text-lg">
          {t.hero.body}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#book"
            className="rounded-full bg-coconut px-7 py-3.5 text-sm font-medium text-forest transition hover:bg-sand"
          >
            {t.hero.cta}
          </a>
          <a href="#stay" className="text-sm text-coconut/85 underline-offset-4 hover:underline">
            {t.hero.view}
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Availability ---------------- */
function AvailabilitySearch() {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [checkin, setCheckin] = useState(today);
  const [checkout, setCheckout] = useState(tomorrow);
  const [guests, setGuests] = useState("2");
  const [room, setRoom] = useState("Any cabin");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({
      to: "/book",
      search: { checkin, checkout, guests, room },
    });
  }

  return (
    <section id="book" className="relative z-20 -mt-24 px-6 lg:px-10">
      <form
        onSubmit={submit}
        className="mx-auto grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-2xl shadow-forest/20 md:grid-cols-[1fr_1fr_0.7fr_1fr_auto]"
      >
        <Field label={t.search.checkin} type="date" value={checkin} min={today} onChange={setCheckin} />
        <Field label={t.search.checkout} type="date" value={checkout} min={checkin} onChange={setCheckout} />
        <SelectField
          label={t.search.guests}
          value={guests}
          onChange={setGuests}
          options={["1", "2", "3", "4", "5", "6+"]}
        />
        <SelectField
          label={t.search.room}
          value={room}
          onChange={setRoom}
          options={[t.search.anyCabin, "Deluxe Queen", "Deluxe Twin", "Family Suite", "Triple Suite"]}
        />
        <button
          type="submit"
          className="whitespace-nowrap bg-forest px-8 py-6 text-sm font-medium uppercase tracking-widest text-coconut transition hover:bg-forest/90"
        >
          {t.search.submit}
        </button>
      </form>
      <p className="mx-auto mt-3 max-w-6xl text-center text-xs text-stone">
        {t.search.note}
      </p>
    </section>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  min,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-base text-foreground outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 bg-card px-5 py-4 text-left">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-base text-foreground outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/* ---------------- About ---------------- */
function About() {
  const { t } = useLanguage();
  return (
    <section id="about" className="mx-auto max-w-7xl px-6 py-28 lg:px-10 lg:py-36">
      <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="mb-6 text-[11px] uppercase tracking-[0.3em] text-stone">{t.about.eyebrow}</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t.about.title1}<br />{t.about.title2}
          </h2>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/80">
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
            <p className="text-forest">{t.about.p3}</p>
          </div>
        </div>
        <div className="relative">
          <img
            src={cabinsExterior}
            alt="Wooden chalet cabins among coconut palms at dusk"
            width={1600}
            height={1067}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-sm object-cover"
          />
          <div className="absolute -bottom-6 -left-6 hidden rounded-sm border border-border bg-coconut p-6 shadow-xl shadow-forest/10 lg:block">
            <p className="font-display text-3xl text-forest">{t.about.badgeNum}</p>
            <p className="text-xs uppercase tracking-widest text-stone">{t.about.badgeLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Accommodation ---------------- */
function Accommodation() {
  const { t } = useLanguage();
  return (
    <section id="stay" className="bg-secondary/40 py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-stone">{t.stay.eyebrow}</p>
            <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
              {t.stay.title1}<br />{t.stay.title2}
            </h2>
          </div>
          <p className="max-w-sm text-sm text-foreground/70">
            {t.stay.intro}
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {t.stay.cabins.map((c, idx) => (
            <article key={c.name} className="group flex flex-col overflow-hidden rounded-sm bg-card">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={cabinImages[idx]}
                  alt={`${c.name} interior`}
                  width={1280}
                  height={960}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <h3 className="font-display text-2xl">{c.name}</h3>
                  <p className="mt-1 text-xs uppercase tracking-widest text-stone">{c.sleeps}</p>
                </div>
                <ul className="space-y-1.5 text-sm text-foreground/75">
                  {c.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-2 size-1 rounded-full bg-forest/60" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#book"
                  className="mt-auto inline-flex w-fit items-center gap-2 text-sm text-forest hover:gap-3 transition-all"
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
    <section className="mx-auto max-w-7xl px-6 py-28 lg:px-10 lg:py-36">
      <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-stone">{t.why.eyebrow}</p>
      <h2 className="mb-16 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
        {t.why.title1}<br />{t.why.title2}
      </h2>
      <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {t.why.reasons.map((r, i) => (
          <div key={r.title} className="border-t border-border pt-6">
            <p className="text-xs text-stone">0{i + 1}</p>
            <h3 className="mt-3 font-display text-xl text-forest">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Nearby ---------------- */
function NearbySection() {
  const { t } = useLanguage();
  return (
    <section id="nearby" className="bg-forest text-coconut py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-14 max-w-2xl">
          <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-coconut/60">{t.nearby.eyebrow}</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {t.nearby.title}
          </h2>
          <p className="mt-5 text-coconut/75">
            {t.nearby.body}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {t.nearby.items.map((n, idx) => (
            <figure key={n.name} className="group overflow-hidden rounded-sm">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={nearbyImages[idx]}
                  alt={n.name}
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
        <div className="mt-12 grid gap-4 text-sm text-coconut/75 sm:grid-cols-2">
          <p>
            <span className="text-coconut">{t.nearby.alsoLabel}</span> {t.nearby.also}
          </p>
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
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
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
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="hover:text-forest">
                {t.footer.whatsapp}
              </a>
            </li>
            <li>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" className="hover:text-forest">
                Facebook
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="hover:text-forest">
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-stone sm:flex-row sm:items-center lg:px-10">
          <p>{t.footer.copyright.replace("{year}", String(new Date().getFullYear()))}</p>
          <p className="italic">{t.footer.slogan}</p>
        </div>
      </div>
    </footer>
  );
}
