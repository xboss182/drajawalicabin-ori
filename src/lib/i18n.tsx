import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "bm";

export const translations = {
  en: {
    nav: { cabins: "Cabins", about: "About", nearby: "Nearby", book: "Book", whatsapp: "WhatsApp Us" },
    whatsappMessage:
      "Salam Team Rajawali D'Cabin Chalet, I have a question regarding my staycation. (Note: All bookings and payments are made only through our official website.)",
    hero: {
      badge: "Only 8 cabins · Chendering",
      title1: "Escape to nature,",
      title2: "stay in comfort.",
      body: "Private cabin-style accommodations in Chendering, Kuala Terengganu. A peaceful retreat for families, couples, and travellers chasing birdsong over notifications.",
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
      note: "We'll take your details on the next step. Your dates will be confirmed shortly.",
      childNote: "Up to 2 children under 12 stay free per room.",
    },
    notice: {
      title: "Important Notice",
      line1: "This is the sole official website of this property.",
      line2:
        "We have no affiliation, partnership, or business relationship with OYO, Agoda, Booking.com, Expedia, or any other online travel agency. Any listing of this property on such platforms is not authorized by us and may contain inaccurate or outdated information.",
      line3:
        "For genuine reservations, current rates, and official enquiries, please book directly through this website or contact us using our official contact information.",
      close: "Dismiss notice",
    },
    about: {
      eyebrow: "About the chalet",
      title1: "A quiet escape near",
      title2: "Kuala Terengganu.",
      p1: "Tucked into the greenery of Chendering, Rajawali D'Cabin Chalet is a small collection of private wooden cabins — close enough to the city for an easy errand, far enough to forget your inbox.",
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
        { name: "Queen Room", sleeps: "Sleeps 2", features: ["1 Queen bed", "Air conditioning", "Private bathroom", "TV", "USB charger", "Free WiFi", "Electric kettle"] },
        { name: "Twin Room", sleeps: "Sleeps 2", features: ["2 Single beds", "Air conditioning", "Private bathroom", "TV", "USB charger", "Free WiFi", "Electric kettle"] },
        { name: "Family Room", sleeps: "Sleeps 4", features: ["1 Queen + 2 Single beds", "Air conditioning", "Spacious layout", "Private bathroom", "TV", "USB charger", "Free WiFi", "Electric kettle"] },
        { name: "Triple Room", sleeps: "Sleeps 3", features: ["1 Queen + 1 Single bed", "Air conditioning", "Private bathroom", "TV", "USB charger", "Free WiFi", "Electric kettle"] },
      ],
    },
    why: {
      eyebrow: "Why guests stay with us",
      title1: "The small things,",
      title2: "done quietly well.",
      reasons: [
        { title: "Peaceful environment", body: "Surrounded by greenery, river views, and open coastal sky." },
        { title: "Minutes from the city", body: "A short drive from Kuala Terengganu centre, beaches, and craft markets." },
        { title: "Swimming pool", body: "A refreshing pool (kolam renang) available for all guests." },
        { title: "Secure parking", body: "Autogate remote access with CCTV security on the property." },
        { title: "In-cabin comforts", body: "Hot shower, complimentary drinks, and a balcony dining set in every room." },
        { title: "BBQ area & iron", body: "Shared BBQ area for the evenings, and an iron available on request." },
      ],
    },
    nearby: {
      eyebrow: "Explore nearby",
      title: "Terengganu, on your doorstep.",
      body: "Famous local food is right next door, the lagoon park is a 5-minute walk, and Marang Jetty and Kuala Terengganu city are a short drive away.",
      alsoLabel: "Also nearby:",
      also: "1 km to Chendering Lagoon Recreation Park (TER) & NABC · Masjid Terapung · Pantai Batu Buruk · Noor Arfa Craft Complex",
      items: [
        { name: "Local food, next door", note: "Keropok lekor, ikan bakar, nasi dagang & ICT" },
        { name: "Marang Jetty · 5 km (7 mins)", note: "Gateway to Pulau Kapas & Pulau Redang" },
        { name: "Kuala Terengganu city · 7 km (10 mins)", note: "Drawbridge, Pasar Payang & HSNZ" },
      ],
    },
    footer: {
      tagline: "Where peaceful stays meet the beauty of Terengganu. A boutique chalet of just 8 private cabins, hidden along the Chendering riverside.",
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
    goodToKnow: {
      eyebrow: "Good to know",
      title: "Before you book.",
      items: [
        { title: "Check-in & check-out", body: "Check-in from 3:00 PM. Check-out by 12:00 PM." },
        { title: "Flexible deposit", body: "Bookings are secured with a refundable RM50 security deposit per room. The security deposit is not part of the room rate and is refunded after check-out, subject to room inspection. Full room rate is due 7 days before check-in." },
        { title: "Children stay free", body: "Up to 2 children under 12 years old stay free per room, sharing existing bedding." },
        { title: "Self check-in", body: "Convenient self check-in via secure key lockers — arrive on your own schedule." },
      ],
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
        bookingNumNote: "Will be confirmed after security deposit payment",
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
        securityDeposit: "Refundable security deposit",
        total: "Total",
        totalPayable: "Total payable",
        priceNote: "Rates vary by weekday, weekend & school holidays. Security deposit is not part of the room rate and is refunded after check-out.",
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
        terms: "Please agree to the property rules to continue",
      },
      terms: {
        eyebrow: "Property rules",
        title: "Quick summary before you continue.",
        summary: "A refundable RM50/room security deposit is required to secure your dates. The security deposit is not part of the room rate. Full room rate plus the security deposit must be settled before check-in. Cancellations within 7 days of check-in are strictly non-refundable.",
        agree: "I agree to the property rules (RM50/room refundable security deposit to secure dates, full room rate + security deposit before check-in, and 7-day cancellation policy).",
      },
      houseRules: {
        title: "Your house rules & terms",
        intro: "Please read through before your arrival — it keeps every stay smooth for everyone.",
        items: [
          "A refundable RM50 security deposit per room is required to secure your booking; it is not part of the room rate.",
          "Full room rate plus the refundable security deposit must be cleared before check-in.",
          "The security deposit is fully refunded after check-out, subject to a room inspection ensuring no damage or loss has occurred.",
          "Up to 2 children under 12 years old stay free per room, sharing the existing bedding.",
          "Cancellations made within 7 days of your check-in date are strictly non-refundable.",
          "Self check-in: locker code and instructions will be shared via WhatsApp on arrival day. Please lock the locker again after retrieving the key.",
          "Guests are responsible for cleanliness, safety, conserving electricity & water, and safekeeping of the room key during their stay.",
        ],
      },
      pay: {
        eyebrow: "Step 2 — Payment",
        title: "Pay directly to the owner.",
        holdPrefix: "Your booking is held for",
        holdSuffix: ". Transfer the amount due and upload your receipt below — we'll confirm via email. The security deposit is separate from the room rate and is refundable after check-out.",
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
    whatsappMessage:
      "Salam Team Rajawali D'Cabin Chalet, saya ada pertanyaan berkenaan penginapan saya. (Nota: Semua tempahan dan pembayaran dibuat hanya melalui laman web rasmi kami.)",
    hero: {
      badge: "Hanya 8 buah kabin · Chendering",
      title1: "Kembali ke alam,",
      title2: "nikmati keselesaan.",
      body: "Kabin persendirian di Chendering, Kuala Terengganu. Destinasi tenang buat keluarga, pasangan, dan pengembara yang inginkan kicauan burung berbanding bunyi notifikasi telefon.",
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
      childNote: "Sehingga 2 kanak-kanak bawah 12 tahun menginap percuma setiap bilik.",
    },
    about: {
      eyebrow: "Tentang chalet",
      title1: "Percutian tenang berhampiran",
      title2: "Kuala Terengganu.",
      p1: "Tersembunyi di dalam kehijauan alam Chendering, Rajawali D'Cabin Chalet menawarkan pilihan kabin kayu persendirian yang eksklusif — cukup dekat dengan bandar untuk urusan harian, cukup jauh untuk anda melupakan peti masuk e-mel anda.",
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
        { name: "Bilik Queen", sleeps: "Muat 2 orang", features: ["1 katil Queen", "Penghawa dingin", "Bilik air peribadi", "TV", "Pengecas USB", "WiFi percuma", "Cerek elektrik"] },
        { name: "Bilik Twin", sleeps: "Muat 2 orang", features: ["2 katil Single", "Penghawa dingin", "Bilik air peribadi", "TV", "Pengecas USB", "WiFi percuma", "Cerek elektrik"] },
        { name: "Bilik Family", sleeps: "Muat 4 orang", features: ["1 katil Queen + 2 katil Single", "Penghawa dingin", "Ruang yang luas", "Bilik air peribadi", "TV", "Pengecas USB", "WiFi percuma", "Cerek elektrik"] },
        { name: "Bilik Triple", sleeps: "Muat 3 orang", features: ["1 katil Queen + 1 katil Single", "Penghawa dingin", "Bilik air peribadi", "TV", "Pengecas USB", "WiFi percuma", "Cerek elektrik"] },
      ],
    },
    why: {
      eyebrow: "Kenapa tetamu memilih kami",
      title1: "Perkara kecil yang kami",
      title2: "sediakan dengan sempurna.",
      reasons: [
        { title: "Suasana yang tenang", body: "Dikelilingi kehijauan alam, pemandangan sungai, dan langit pantai yang luas." },
        { title: "Minit ke pusat bandar", body: "Hanya beberapa minit memandu ke pusat bandar Kuala Terengganu, pantai, dan pasar kraf." },
        { title: "Kolam renang", body: "Kolam renang yang menyegarkan disediakan untuk semua tetamu." },
        { title: "Tempat letak kereta selamat", body: "Pintu pagar autogate dengan kawalan jauh dan pengawasan CCTV." },
        { title: "Keselesaan dalam kabin", body: "Pancuran air panas, minuman percuma, dan set makan di balkoni dalam setiap bilik." },
        { title: "Ruang BBQ & seterika", body: "Ruang BBQ untuk waktu malam, dan seterika disediakan atas permintaan." },
      ],
    },
    nearby: {
      eyebrow: "Terokai kawasan sekitar",
      title: "Terengganu, betul-betul di hadapan mata anda.",
      body: "Makanan tempatan yang terkenal berada betul-betul di sebelah, taman lagun hanya 1 km, manakala Jeti Marang dan pusat bandar Kuala Terengganu pula hanya beberapa minit memandu.",
      alsoLabel: "Turut berdekatan:",
      also: "1 km ke Taman Rekreasi Lagun Chendering (TER) & NABC · Masjid Terapung · Pantai Batu Buruk · Kompleks Kraf Noor Arfa",
      items: [
        { name: "Makanan tempatan, sebelah sahaja", note: "Keropok lekor, ikan bakar, nasi dagang & ICT" },
        { name: "Jeti Marang · 5 km (7 minit)", note: "Pintu masuk ke Pulau Kapas & Pulau Redang" },
        { name: "Bandar Kuala Terengganu · 7 km (10 minit)", note: "Drawbridge, Pasar Payang & HSNZ" },
      ],
    },
    footer: {
      tagline: "Di mana penginapan yang tenang bertemu keindahan Terengganu. Sebuah chalet butik yang hanya mempunyai 8 kabin persendirian, tersembunyi di sepanjang tebing sungai Chendering.",
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
    goodToKnow: {
      eyebrow: "Perkara baik untuk diketahui",
      title: "Sebelum anda menempah.",
      items: [
        { title: "Check-in & check-out", body: "Check-in dari jam 3:00 petang. Check-out sebelum jam 12:00 tengah hari." },
        { title: "Deposit fleksibel", body: "Tempahan diamankan dengan deposit keselamatan RM50 setiap bilik yang boleh dikembalikan. Deposit keselamatan bukan sebahagian daripada kadar bilik dan akan dikembalikan selepas check-out, tertakluk kepada pemeriksaan bilik. Kadar bilik penuh perlu diselesaikan 7 hari sebelum check-in." },
        { title: "Kanak-kanak menginap percuma", body: "Sehingga 2 kanak-kanak bawah 12 tahun menginap percuma setiap bilik, berkongsi katil sedia ada." },
        { title: "Self check-in", body: "Self check-in mudah melalui key locker berkunci — tiba mengikut masa anda sendiri." },
      ],
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
        bookingNumNote: "Akan dimaklumkan selepas bayaran deposit keselamatan",
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
        securityDeposit: "Deposit keselamatan boleh dikembalikan",
        total: "Jumlah",
        totalPayable: "Jumlah perlu bayar",
        priceNote: "Harga berbeza mengikut hari biasa, hujung minggu & cuti sekolah. Deposit keselamatan bukan sebahagian daripada kadar bilik dan akan dikembalikan selepas check-out.",
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
        terms: "Sila setuju dengan peraturan penginapan untuk meneruskan",
      },
      terms: {
        eyebrow: "Peraturan penginapan",
        title: "Ringkasan sebelum anda meneruskan.",
        summary: "Deposit keselamatan RM50/bilik yang boleh dikembalikan diperlukan untuk mengesahkan tarikh anda. Deposit keselamatan bukan sebahagian daripada kadar bilik. Kadar bilik penuh berserta deposit keselamatan mesti dijelaskan sebelum check-in. Pembatalan dalam tempoh 7 hari sebelum check-in tidak akan dikembalikan.",
        agree: "Saya bersetuju dengan peraturan penginapan (deposit keselamatan RM50/bilik yang boleh dikembalikan untuk mengesahkan tarikh, kadar bilik penuh + deposit keselamatan sebelum check-in, dan polisi pembatalan 7 hari).",
      },
      houseRules: {
        title: "Peraturan & syarat penginapan anda",
        intro: "Sila baca sebelum tiba — supaya setiap penginapan berjalan lancar.",
        items: [
          "Deposit keselamatan RM50/bilik yang boleh dikembalikan diperlukan untuk mengesahkan tempahan; ia bukan sebahagian daripada kadar bilik.",
          "Kadar bilik penuh berserta deposit keselamatan yang boleh dikembalikan mesti dijelaskan sebelum check-in.",
          "Deposit keselamatan akan dikembalikan sepenuhnya selepas check-out, tertakluk kepada pemeriksaan bilik yang memastikan tiada kerosakan atau kehilangan.",
          "Sehingga 2 kanak-kanak bawah 12 tahun menginap percuma setiap bilik, berkongsi katil sedia ada.",
          "Pembatalan yang dibuat dalam tempoh 7 hari sebelum tarikh check-in adalah tidak boleh dikembalikan.",
          "Self check-in: kod locker dan arahan akan dikongsi melalui WhatsApp pada hari ketibaan. Sila kunci semula locker selepas mengambil kunci.",
          "Tetamu bertanggungjawab terhadap kebersihan, keselamatan, penjimatan elektrik & air, serta menjaga kunci bilik sepanjang penginapan.",
        ],
      },
      pay: {
        eyebrow: "Langkah 2 — Pembayaran",
        title: "Bayar terus ke pemilik.",
        holdPrefix: "Tempahan anda dipegang selama",
        holdSuffix: ". Pindahkan jumlah yang perlu dibayar dan muat naik resit di bawah — kami akan sahkan melalui emel. Deposit keselamatan adalah berasingan daripada kadar bilik dan boleh dikembalikan selepas check-out.",
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