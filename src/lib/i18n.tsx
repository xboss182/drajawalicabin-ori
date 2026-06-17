import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "bm";

type Dict = typeof translations.en;

export const translations = {
  en: {
    nav: { cabins: "Cabins", about: "About", nearby: "Nearby", book: "Book", whatsapp: "WhatsApp Us" },
    hero: {
      badge: "Only 8 cabins · Kuala Ibai",
      title1: "Escape to nature,",
      title2: "stay in comfort.",
      body: "Private cabin-style accommodations in Kuala Ibai, Kuala Terengganu. A peaceful retreat for families, couples, and travellers chasing birdsong over notifications.",
      cta: "Check availability",
      view: "View our cabins →",
    },
    search: {
      checkin: "Check-in",
      checkout: "Check-out",
      guests: "Guests",
      room: "Room type",
      anyCabin: "Any cabin",
      submit: "Search",
      note: "We'll take your details on the next step. Your dates are personally confirmed — usually within a few hours.",
    },
    about: {
      eyebrow: "About the chalet",
      title1: "A quiet escape near",
      title2: "Kuala Terengganu.",
      p1: "Tucked into the greenery of Kuala Ibai, Rajawali D'Cabin Chalet is a small collection of private wooden cabins — close enough to the city for an easy errand, far enough to forget your inbox.",
      p2: "Whether you're planning a family holiday, a fishing weekend, a quiet work trip, or a slow Sunday with someone you love, the cabins offer the kind of privacy and stillness that hotels rarely manage.",
      p3: "Only 8 cabins. No lobby. No crowds. Just a place to land.",
      badgeNum: "8",
      badgeLabel: "private cabins",
    },
    stay: {
      eyebrow: "Choose your cabin",
      title1: "Four cabin styles.",
      title2: "All quietly considered.",
      intro: "Every cabin is air-conditioned, fully private, and styled for a slow stay. Pick the one that fits your group — we'll keep it ready.",
      cta: "Check availability →",
      cabins: [
        { name: "Deluxe Queen", sleeps: "Sleeps 2", features: ["Queen bed", "Air conditioning", "Private bathroom", "Smart TV", "Free WiFi"] },
        { name: "Deluxe Twin", sleeps: "Sleeps 2 — friends", features: ["Two single beds", "Air conditioning", "Private bathroom", "Free WiFi"] },
        { name: "Family Suite", sleeps: "Sleeps 4 — family", features: ["Two double beds", "Spacious layout", "Private bathroom", "TV & WiFi"] },
        { name: "Triple Suite", sleeps: "Sleeps 3 — flexible", features: ["1 double + 1 single", "Small family friendly", "Air conditioning", "Free WiFi"] },
      ],
    },
    why: {
      eyebrow: "Why guests stay with us",
      title1: "The small things,",
      title2: "done quietly well.",
      reasons: [
        { title: "Peaceful environment", body: "Surrounded by greenery, river views, and open coastal sky." },
        { title: "Minutes from the city", body: "A short drive from Kuala Terengganu centre, beaches, and craft markets." },
        { title: "Family friendly", body: "Comfortable, private cabins suited to families and small groups." },
        { title: "Private parking", body: "Free parking directly beside your cabin door." },
        { title: "High-speed WiFi", body: "Stay connected when you need to — disconnect when you don't." },
        { title: "Only 8 cabins", body: "No crowds, no queues. Every stay is quiet, personal, and unhurried." },
      ],
    },
    nearby: {
      eyebrow: "Explore nearby",
      title: "Terengganu, on your doorstep.",
      body: "The cabins sit minutes from a floating mosque, traditional craft houses, soft-sand beaches, and the lagoon park — easy to weave a real day out of an unhurried morning.",
      alsoLabel: "Also nearby:",
      also: "Kuala Ibai Bridge · Lagoon Park · Pantai Teluk Kalong · Chendering night market",
      items: [
        { name: "Masjid Terapung Kuala Ibai", note: "Floating mosque on the lagoon" },
        { name: "Pantai Batu Buruk", note: "Soft-sand coastal beach" },
        { name: "Noor Arfa Craft Complex", note: "Traditional Terengganu batik" },
      ],
    },
    footer: {
      tagline: "Where peaceful stays meet the beauty of Terengganu. A boutique chalet of just 8 private cabins, hidden along the Kuala Ibai riverside.",
      visit: "Visit",
      address1: "307, Pengkalan Rajawali",
      address2: "Chendering, Kuala Terengganu",
      address3: "Terengganu, Malaysia",
      maps: "Open in Google Maps →",
      reach: "Reach us",
      whatsapp: "WhatsApp · 011-5500 7204",
      copyright: "© {year} Rajawali D'Cabin Chalet. All rights reserved.",
      slogan: "Where peaceful stays meet the beauty of Terengganu.",
    },
  },
  bm: {
    nav: { cabins: "Bilik", about: "Tentang", nearby: "Berdekatan", book: "Tempah", whatsapp: "WhatsApp Kami" },
    hero: {
      badge: "Hanya 8 kabin · Kuala Ibai",
      title1: "Berehat dalam alam,",
      title2: "selesa sepenuhnya.",
      body: "Penginapan kabin persendirian di Kuala Ibai, Kuala Terengganu. Tempat tenang untuk keluarga, pasangan, dan pengembara yang mencari kicauan burung mengatasi notifikasi.",
      cta: "Semak ketersediaan",
      view: "Lihat kabin kami →",
    },
    search: {
      checkin: "Daftar masuk",
      checkout: "Daftar keluar",
      guests: "Tetamu",
      room: "Jenis bilik",
      anyCabin: "Mana-mana kabin",
      submit: "Cari",
      note: "Kami akan ambil maklumat anda pada langkah seterusnya. Tarikh disahkan secara peribadi — biasanya dalam beberapa jam.",
    },
    about: {
      eyebrow: "Tentang chalet",
      title1: "Pelarian tenang berhampiran",
      title2: "Kuala Terengganu.",
      p1: "Tersembunyi dalam kehijauan Kuala Ibai, Rajawali D'Cabin Chalet ialah koleksi kecil kabin kayu persendirian — cukup dekat ke bandar untuk urusan ringan, cukup jauh untuk lupakan emel anda.",
      p2: "Sama ada percutian keluarga, hujung minggu memancing, kerja yang tenang, atau hari Ahad yang santai bersama orang tersayang — kabin ini memberikan privasi dan ketenangan yang sukar ditemui di hotel.",
      p3: "Hanya 8 kabin. Tiada lobi. Tiada kesesakan. Hanya tempat untuk berlabuh.",
      badgeNum: "8",
      badgeLabel: "kabin persendirian",
    },
    stay: {
      eyebrow: "Pilih kabin anda",
      title1: "Empat gaya kabin.",
      title2: "Semuanya teliti tersusun.",
      intro: "Setiap kabin berhawa dingin, sepenuhnya peribadi, dan bergaya untuk penginapan santai. Pilih yang sesuai dengan kumpulan anda — kami akan sediakannya.",
      cta: "Semak ketersediaan →",
      cabins: [
        { name: "Deluxe Queen", sleeps: "Muat 2 orang", features: ["Katil queen", "Penghawa dingin", "Bilik air persendirian", "Smart TV", "WiFi percuma"] },
        { name: "Deluxe Twin", sleeps: "Muat 2 — rakan", features: ["Dua katil single", "Penghawa dingin", "Bilik air persendirian", "WiFi percuma"] },
        { name: "Family Suite", sleeps: "Muat 4 — keluarga", features: ["Dua katil double", "Ruang luas", "Bilik air persendirian", "TV & WiFi"] },
        { name: "Triple Suite", sleeps: "Muat 3 — fleksibel", features: ["1 double + 1 single", "Mesra keluarga kecil", "Penghawa dingin", "WiFi percuma"] },
      ],
    },
    why: {
      eyebrow: "Mengapa tetamu memilih kami",
      title1: "Perkara kecil,",
      title2: "dilakukan dengan teliti.",
      reasons: [
        { title: "Persekitaran tenang", body: "Dikelilingi kehijauan, pemandangan sungai, dan langit pantai terbuka." },
        { title: "Hampir dengan bandar", body: "Pemanduan singkat dari pusat Kuala Terengganu, pantai dan pasar kraf." },
        { title: "Mesra keluarga", body: "Kabin selesa dan peribadi sesuai untuk keluarga dan kumpulan kecil." },
        { title: "Letak kereta peribadi", body: "Parkir percuma terus di sebelah pintu kabin anda." },
        { title: "WiFi laju", body: "Kekal terhubung bila perlu — putus hubungan bila tidak perlu." },
        { title: "Hanya 8 kabin", body: "Tanpa kesesakan dan beratur. Setiap penginapan tenang dan peribadi." },
      ],
    },
    nearby: {
      eyebrow: "Terokai sekitar",
      title: "Terengganu, di hadapan pintu anda.",
      body: "Kabin terletak beberapa minit dari masjid terapung, rumah kraf tradisional, pantai berpasir lembut, dan taman lagun — mudah untuk merancang hari penuh aktiviti.",
      alsoLabel: "Juga berdekatan:",
      also: "Jambatan Kuala Ibai · Taman Lagun · Pantai Teluk Kalong · Pasar malam Chendering",
      items: [
        { name: "Masjid Terapung Kuala Ibai", note: "Masjid terapung di lagun" },
        { name: "Pantai Batu Buruk", note: "Pantai berpasir lembut" },
        { name: "Noor Arfa Craft Complex", note: "Batik tradisional Terengganu" },
      ],
    },
    footer: {
      tagline: "Tempat penginapan tenang bertemu keindahan Terengganu. Chalet butik dengan hanya 8 kabin peribadi, tersembunyi di tepi sungai Kuala Ibai.",
      visit: "Lawati",
      address1: "307, Pengkalan Rajawali",
      address2: "Chendering, Kuala Terengganu",
      address3: "Terengganu, Malaysia",
      maps: "Buka di Google Maps →",
      reach: "Hubungi kami",
      whatsapp: "WhatsApp · 011-5500 7204",
      copyright: "© {year} Rajawali D'Cabin Chalet. Hak cipta terpelihara.",
      slogan: "Tempat penginapan tenang bertemu keindahan Terengganu.",
    },
  },
} as const;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lang");
      if (stored === "en" || stored === "bm") setLangState(stored);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <div
      className={`inline-flex items-center rounded-full border border-coconut/40 bg-coconut/10 p-0.5 text-[11px] uppercase tracking-widest backdrop-blur ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`rounded-full px-3 py-1 transition ${
          lang === "en" ? "bg-coconut text-forest" : "text-coconut hover:text-coconut"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("bm")}
        aria-pressed={lang === "bm"}
        className={`rounded-full px-3 py-1 transition ${
          lang === "bm" ? "bg-coconut text-forest" : "text-coconut hover:text-coconut"
        }`}
      >
        BM
      </button>
    </div>
  );
}