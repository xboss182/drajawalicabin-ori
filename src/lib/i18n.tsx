import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "bm";

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
    book: {
      locale: "en-MY",
      metaTitle: "Room Booking — Rajawali D'Cabin Chalet",
      metaDesc: "Book a cabin at Rajawali D'Cabin Chalet, Kuala Terengganu. Only 8 cabins, personally managed.",
      header: { back: "← Back" },
      step1Eyebrow: "Step 1 — Stay details",
      title: "Room Booking.",
      f: {
        checkin: "Check-in date",
        checkout: "Check-out date",
        guests: "Guests (pax)",
        rooms: "Number of rooms",
        cabinType: "Cabin type",
        loading: "Loading…",
        cabinOption: "{name} · sleeps {cap}",
      },
      takenPrefix: "Already booked for",
      comforter: "Add comforter set",
      comforterPrice: "(+RM20 / night)",
      step2Eyebrow: "Step 2 — Personal details",
      g: {
        fullName: "Full name",
        fullNamePh: "Aisyah Rahman",
        email: "Email",
        emailPh: "you@example.com",
        phone: "Phone / WhatsApp",
        phonePh: "+60 11 5500 7204",
        relationship: "Relationship",
        relationshipPh: "Family / Friend / Colleague",
        vehicleType: "Vehicle type",
        vehicleTypePh: "Car / Van / Motorcycle",
        vehicleNumber: "Vehicle number",
        vehicleNumberPh: "ABC 1234",
        notes: "Notes (optional)",
        notesPh: "Arrival time, special requests…",
      },
      info: {
        roomNum: "Room number:",
        roomNumNote: "Will be confirmed after booking is verified",
        bookingNum: "Booking number:",
        bookingNumNote: "Will be confirmed after deposit payment",
      },
      submitting: "Holding your dates…",
      submit: "Continue to payment",
      holdNote: "Your dates are held for 30 minutes while you complete payment.",
      summary: {
        eyebrow: "Stay summary",
        pickCabin: "Pick a cabin",
        capacityLine: "Sleeps {cap} · RM{min}–{max}/night",
        checkin: "Check-in",
        checkout: "Check-out",
        nights: "Nights",
        guests: "Guests (pax)",
        rooms: "Number of rooms",
        roomSubtotal: "Room subtotal",
        comforterLabel: "Comforter",
        total: "Total",
        priceNote: "Rates vary by weekday, weekend & school holidays.",
      },
      errors: {
        pickCabin: "Please select a cabin",
        dates: "Check-out date must be after check-in",
        overlap: "Cabin not available on those dates. Please pick another date.",
        name: "Please enter your full name",
        email: "Please enter a valid email",
        phone: "Please enter a phone / WhatsApp number",
        bookFailed: "Failed to create booking",
        uploadFailed: "Upload failed",
      },
      pay: {
        eyebrow: "Step 2 — Payment",
        title: "Pay directly to the owner.",
        holdPrefix: "Your booking is held for",
        holdSuffix: ". Transfer the full amount and upload your receipt below — we'll confirm via WhatsApp.",
        amountDue: "Amount due",
        reference: "Reference no.",
        refNote: "Please include reference",
        refNoteSuffix: "in the transfer remarks so we can verify quickly.",
        transfer: "Bank transfer / DuitNow",
        bank: "CIMB Islamic (Current Account)",
        acctNum: "Account no.",
        acctName: "Account name",
        copy: "Copy",
        qrTitle: "DuitNow QR",
        qrSub: "Scan & Pay",
        uploadEyebrow: "Step 3 — Upload proof of payment",
        uploadTitle: "Attach your receipt",
        uploadHint: "Transfer screenshot or e-wallet receipt. JPG / PNG / PDF, max ~5MB.",
        uploading: "Uploading…",
        uploadCta: "Submit proof of payment",
        summary: "Booking summary:",
      },
      done: {
        eyebrow: "Proof received",
        thanks: "Thank you, {name}.",
        body1: "We've received your payment proof for reference",
        body2: ". The owner will verify the transfer and share your room number and booking number via WhatsApp / email at",
        bodyTail: " — usually within a few hours.",
        whatsappCta: "Message us on WhatsApp",
        whatsappText: "Hi! I just uploaded payment proof for booking {ref} under {name}.",
        backHome: "Back to home",
      },
    },
  },
  bm: {
    nav: { cabins: "Bilik", about: "Tentang", nearby: "Berdekatan", book: "Tempah", whatsapp: "WhatsApp Kami" },
    hero: {
      badge: "Hanya 8 buah kabin · Kuala Ibai",
      title1: "Kembali ke alam,",
      title2: "nikmati keselesaan.",
      body: "Kabin persendirian di Kuala Ibai, Kuala Terengganu. Destinasi tenang buat keluarga, pasangan, dan pengembara yang inginkan kicauan burung berbanding bunyi notifikasi telefon.",
      cta: "Semak kekosongan",
      view: "Lihat kabin kami →",
    },
    search: {
      checkin: "Daftar masuk",
      checkout: "Daftar keluar",
      guests: "Tetamu",
      room: "Jenis bilik",
      anyCabin: "Mana-mana kabin",
      submit: "Cari",
      note: "Maklumat anda akan diambil pada langkah seterusnya. Tarikh anda akan disahkan secara peribadi — biasanya dalam masa beberapa jam.",
    },
    about: {
      eyebrow: "Tentang chalet",
      title1: "Percutian tenang berhampiran",
      title2: "Kuala Terengganu.",
      p1: "Tersembunyi di dalam kehijauan alam Kuala Ibai, Rajawali D'Cabin Chalet menawarkan pilihan kabin kayu persendirian yang eksklusif — cukup dekat dengan bandar untuk urusan harian, cukup jauh untuk anda melupakan peti masuk e-mel anda.",
      p2: "Sama ada anda merancang percutian keluarga, hujung minggu memancing, perjalanan kerja yang santai, atau hari Ahad yang tenang bersama yang tersayang, kabin kami menawarkan privasi dan ketenangan yang jarang ditemui di hotel biasa.",
      p3: "Hanya 8 buah kabin. Tiada lobi. Tiada kesesakan. Cuma sebuah tempat untuk anda berehat dan beristirahat.",
      badgeNum: "8",
      badgeLabel: "kabin persendirian",
    },
    stay: {
      eyebrow: "Pilih kabin anda",
      title1: "Empat gaya kabin.",
      title2: "Direka khas untuk ketenangan.",
      intro: "Setiap kabin dilengkapi penghawa dingin, privasi penuh, dan suasana yang tenang. Pilih yang paling sesuai untuk kumpulan anda — kami akan sediakan segalanya.",
      cta: "Semak kekosongan →",
      cabins: [
        { name: "Deluxe Queen", sleeps: "Muat 2 orang", features: ["Katil Queen", "Penghawa dingin", "Bilik air peribadi", "Smart TV", "WiFi percuma"] },
        { name: "Deluxe Twin", sleeps: "Muat 2 orang — rakan", features: ["Dua katil Single", "Penghawa dingin", "Bilik air peribadi", "WiFi percuma"] },
        { name: "Family Suite", sleeps: "Muat 4 orang — keluarga", features: ["Dua katil Double", "Ruang yang luas", "Bilik air peribadi", "TV & WiFi"] },
        { name: "Triple Suite", sleeps: "Muat 3 orang — fleksibel", features: ["1 Double + 1 Single", "Sesuai untuk keluarga kecil", "Penghawa dingin", "WiFi percuma"] },
      ],
    },
    why: {
      eyebrow: "Kenapa tetamu memilih kami",
      title1: "Perkara kecil yang kami",
      title2: "sediakan dengan sempurna.",
      reasons: [
        { title: "Suasana yang tenang", body: "Dikelilingi kehijauan alam, pemandangan sungai, dan langit pantai yang luas." },
        { title: "Minit ke pusat bandar", body: "Hanya beberapa minit memandu ke pusat bandar Kuala Terengganu, pantai, dan pasar kraf." },
        { title: "Mesra keluarga", body: "Kabin peribadi yang selesa, sangat sesuai untuk keluarga dan kumpulan kecil." },
        { title: "Tempat letak kenderaan peribadi", body: "Tempat letak kenderaan percuma disediakan betul-betul di sebelah pintu kabin anda." },
        { title: "WiFi berkelajuan tinggi", body: "Kekal berhubung bila perlu — dan putuskan talian apabila anda ingin berehat." },
        { title: "Hanya 8 buah kabin", body: "Tiada kesesakan, tiada barisan panjang. Setiap penginapan terasa tenang, peribadi, dan santai." },
      ],
    },
    nearby: {
      eyebrow: "Terokai kawasan sekitar",
      title: "Terengganu, betul-betul di hadapan mata anda.",
      body: "Kabin kami terletak hanya beberapa minit dari masjid terapung, pusat kraf tradisional, pantai berpasir halus, dan taman lagun — memudahkan anda merancang hari yang indah selepas pagi yang santai.",
      alsoLabel: "Turut berdekatan:",
      also: "Jambatan Kuala Ibai · Taman Lagun · Pantai Teluk Kalong · Pasar Malam Chendering",
      items: [
        { name: "Masjid Terapung Kuala Ibai", note: "Masjid terapung yang indah di atas lagun." },
        { name: "Pantai Batu Buruk", note: "Pantai persisiran dengan pasir putih yang halus." },
        { name: "Kompleks Kraf Noor Arfa", note: "Pusat batik tradisional Terengganu yang terkemuka." },
      ],
    },
    footer: {
      tagline: "Di mana penginapan yang tenang bertemu keindahan Terengganu. Sebuah chalet butik yang hanya mempunyai 8 kabin persendirian, tersembunyi di sepanjang tebing sungai Kuala Ibai.",
      visit: "Kunjungi kami",
      address1: "307, Pengkalan Rajawali",
      address2: "Chendering, Kuala Terengganu",
      address3: "Terengganu, Malaysia",
      maps: "Buka di Google Maps →",
      reach: "Hubungi kami",
      whatsapp: "WhatsApp · 011-5500 7204",
      copyright: "© {year} Rajawali D'Cabin Chalet. Hak cipta terpelihara.",
      slogan: "Di mana penginapan yang tenang bertemu keindahan Terengganu.",
    },
    book: {
      locale: "ms-MY",
      metaTitle: "Tempahan Bilik — Rajawali D'Cabin Chalet",
      metaDesc: "Tempah bilik di Rajawali D'Cabin Chalet, Kuala Terengganu. Hanya 8 bilik, diurus secara peribadi.",
      header: { back: "← Kembali" },
      step1Eyebrow: "Langkah 1 — Maklumat Penginapan",
      title: "Tempahan Bilik.",
      f: {
        checkin: "Tarikh check in",
        checkout: "Tarikh check out",
        guests: "Bil Org @ pax",
        rooms: "Bil bilik",
        cabinType: "Jenis Bilik",
        loading: "Memuatkan…",
        cabinOption: "{name} · muat {cap} orang",
      },
      takenPrefix: "Sudah ditempah untuk",
      comforter: "Tambah comforter set",
      comforterPrice: "(+RM20 / malam)",
      step2Eyebrow: "Langkah 2 — Butiran Peribadi",
      g: {
        fullName: "Nama penuh",
        fullNamePh: "Aisyah Rahman",
        email: "Emel",
        emailPh: "anda@contoh.com",
        phone: "No Telefon / WhatsApp",
        phonePh: "+60 11 5500 7204",
        relationship: "Hubungan",
        relationshipPh: "Keluarga / Kawan / Rakan niaga",
        vehicleType: "Jenis Kenderaan",
        vehicleTypePh: "Kereta / Van / Motosikal",
        vehicleNumber: "No Kenderaan",
        vehicleNumberPh: "ABC 1234",
        notes: "Nota (pilihan)",
        notesPh: "Masa ketibaan, permintaan khas…",
      },
      info: {
        roomNum: "No Bilik:",
        roomNumNote: "Akan dimaklumkan selepas pengesahan tempahan",
        bookingNum: "No Tempahan:",
        bookingNumNote: "Akan dimaklumkan selepas bayaran deposit",
      },
      submitting: "Memegang tarikh anda…",
      submit: "Teruskan ke pembayaran",
      holdNote: "Tarikh anda dipegang selama 30 minit sementara anda menyelesaikan pembayaran.",
      summary: {
        eyebrow: "Maklumat Penginapan",
        pickCabin: "Pilih bilik",
        capacityLine: "Muat {cap} orang · RM{min}–{max}/malam",
        checkin: "Check-in",
        checkout: "Check-out",
        nights: "Bil malam",
        guests: "Bil Org @ pax",
        rooms: "Bil bilik",
        roomSubtotal: "Jumlah bilik",
        comforterLabel: "Comforter",
        total: "Jumlah",
        priceNote: "Harga berbeza mengikut hari biasa, hujung minggu & cuti sekolah.",
      },
      errors: {
        pickCabin: "Sila pilih bilik",
        dates: "Tarikh check-out mesti selepas check-in",
        overlap: "Bilik tidak tersedia pada tarikh tersebut. Sila pilih tarikh lain.",
        name: "Sila masukkan nama penuh",
        email: "Sila masukkan emel yang sah",
        phone: "Sila masukkan nombor telefon / WhatsApp",
        bookFailed: "Gagal membuat tempahan",
        uploadFailed: "Muat naik gagal",
      },
      pay: {
        eyebrow: "Langkah 2 — Pembayaran",
        title: "Bayar terus ke pemilik.",
        holdPrefix: "Tempahan anda dipegang selama",
        holdSuffix: ". Pindahkan jumlah penuh dan muat naik resit di bawah — kami akan sahkan melalui WhatsApp.",
        amountDue: "Jumlah perlu bayar",
        reference: "No Rujukan",
        refNote: "Sila sertakan rujukan",
        refNoteSuffix: "dalam catatan pemindahan untuk kami sahkan dengan cepat.",
        transfer: "Pemindahan bank / DuitNow",
        bank: "CIMB Islamic (Akaun Semasa)",
        acctNum: "No Akaun",
        acctName: "Nama Akaun",
        copy: "Salin",
        qrTitle: "QR DuitNow",
        qrSub: "Imbas & Bayar",
        uploadEyebrow: "Langkah 3 — Muat naik bukti pembayaran",
        uploadTitle: "Lampirkan resit anda",
        uploadHint: "Screenshot pemindahan atau resit e-wallet. JPG / PNG / PDF, maks ~5MB.",
        uploading: "Sedang muat naik…",
        uploadCta: "Hantar bukti pembayaran",
        summary: "Ringkasan tempahan:",
      },
      done: {
        eyebrow: "Bukti diterima",
        thanks: "Terima kasih, {name}.",
        body1: "Kami telah menerima bukti pembayaran anda untuk rujukan",
        body2: ". Pemilik akan sahkan pemindahan dan memaklumkan nombor bilik serta nombor tempahan anda melalui WhatsApp / emel di",
        bodyTail: " — biasanya dalam masa beberapa jam.",
        whatsappCta: "Mesej kami di WhatsApp",
        whatsappText: "Assalamualaikum! Saya baru muat naik bukti bayaran untuk tempahan {ref} atas nama {name}.",
        backHome: "Kembali ke laman utama",
      },
    },
  },
};

type Dict = (typeof translations)["en"];

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

export function LanguageToggle({ className = "", variant = "light" }: { className?: string; variant?: "light" | "dark" }) {
  const { lang, setLang } = useLanguage();
  const isDark = variant === "dark";
  const containerCls = isDark
    ? "border-forest/30 bg-forest/10"
    : "border-coconut/40 bg-coconut/10";
  const inactive = isDark ? "text-forest/80 hover:text-forest" : "text-coconut hover:text-coconut";
  const active = isDark ? "bg-forest text-coconut" : "bg-coconut text-forest";
  return (
    <div
      className={`inline-flex items-center rounded-full border ${containerCls} p-0.5 text-[11px] uppercase tracking-widest backdrop-blur ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`rounded-full px-3 py-1 transition ${lang === "en" ? active : inactive}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("bm")}
        aria-pressed={lang === "bm"}
        className={`rounded-full px-3 py-1 transition ${lang === "bm" ? active : inactive}`}
      >
        BM
      </button>
    </div>
  );
}