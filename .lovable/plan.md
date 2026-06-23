## Update Malay (BM) translations for landing page

Replace the `bm` strings in `src/lib/i18n.tsx` (sections: `hero`, `search`, `about`, `stay`, `why`, `nearby`, `footer`) with the user-provided Malay copy. English (`en`) and `book` flow strings stay untouched.

### Key string changes

**hero**
- badge: `Hanya 8 buah kabin · Kuala Ibai`
- title1: `Kembali ke alam,`
- title2: `nikmati keselesaan.`
- body: `Kabin persendirian di Kuala Ibai, Kuala Terengganu. Destinasi tenang buat keluarga, pasangan, dan pengembara yang inginkan kicauan burung berbanding bunyi notifikasi telefon.`
- cta: `Semak kekosongan`
- view: `Lihat kabin kami →`

**search**
- checkin: `Daftar masuk` · checkout: `Daftar keluar` · guests: `Tetamu` · room: `Jenis bilik` · anyCabin: `Mana-mana kabin` · submit: `Cari`
- note: `Maklumat anda akan diambil pada langkah seterusnya. Tarikh anda akan disahkan secara peribadi — biasanya dalam masa beberapa jam.`

**about**
- eyebrow: `Tentang chalet`
- title1: `Percutian tenang berhampiran`
- title2: `Kuala Terengganu.`
- p1: `Tersembunyi di dalam kehijauan alam Kuala Ibai, Rajawali D'Cabin Chalet menawarkan pilihan kabin kayu persendirian yang eksklusif — cukup dekat dengan bandar untuk urusan harian, cukup jauh untuk anda melupakan peti masuk e-mel anda.`
- p2: `Sama ada anda merancang percutian keluarga, hujung minggu memancing, perjalanan kerja yang santai, atau hari Ahad yang tenang bersama yang tersayang, kabin kami menawarkan privasi dan ketenangan yang jarang ditemui di hotel biasa.`
- p3: `Hanya 8 buah kabin. Tiada lobi. Tiada kesesakan. Cuma sebuah tempat untuk anda berehat dan beristirahat.`
- badgeLabel: `kabin persendirian`

**stay**
- eyebrow: `Pilih kabin anda`
- title1: `Empat gaya kabin.`
- title2: `Direka khas untuk ketenangan.`
- intro: `Setiap kabin dilengkapi penghawa dingin, privasi penuh, dan suasana yang tenang. Pilih yang paling sesuai untuk kumpulan anda — kami akan sediakan segalanya.`
- cta: `Semak kekosongan →`
- cabins[0] Deluxe Queen: sleeps `Muat 2 orang`, features `[Katil Queen, Penghawa dingin, Bilik air peribadi, Smart TV, WiFi percuma]`
- cabins[1] Deluxe Twin: sleeps `Muat 2 orang — rakan`, features `[Dua katil Single, Penghawa dingin, Bilik air peribadi, WiFi percuma]`
- cabins[2] Family Suite: sleeps `Muat 4 orang — keluarga`, features `[Dua katil Double, Ruang yang luas, Bilik air peribadi, TV & WiFi]`
- cabins[3] Triple Suite: sleeps `Muat 3 orang — fleksibel`, features `[1 Double + 1 Single, Sesuai untuk keluarga kecil, Penghawa dingin, WiFi percuma]`

**why**
- eyebrow: `Kenapa tetamu memilih kami`
- title1: `Perkara kecil yang kami`
- title2: `sediakan dengan sempurna.`
- reasons:
  1. `Suasana yang tenang` — `Dikelilingi kehijauan alam, pemandangan sungai, dan langit pantai yang luas.`
  2. `Minit ke pusat bandar` — `Hanya beberapa minit memandu ke pusat bandar Kuala Terengganu, pantai, dan pasar kraf.`
  3. `Mesra keluarga` — `Kabin peribadi yang selesa, sangat sesuai untuk keluarga dan kumpulan kecil.`
  4. `Tempat letak kenderaan peribadi` — `Tempat letak kenderaan percuma disediakan betul-betul di sebelah pintu kabin anda.`
  5. `WiFi berkelajuan tinggi` — `Kekal berhubung bila perlu — dan putuskan talian apabila anda ingin berehat.`
  6. `Hanya 8 buah kabin` — `Tiada kesesakan, tiada barisan panjang. Setiap penginapan terasa tenang, peribadi, dan santai.`

**nearby**
- eyebrow: `Terokai kawasan sekitar`
- title: `Terengganu, betul-betul di hadapan mata anda.`
- body: `Kabin kami terletak hanya beberapa minit dari masjid terapung, pusat kraf tradisional, pantai berpasir halus, dan taman lagun — memudahkan anda merancang hari yang indah selepas pagi yang santai.`
- alsoLabel: `Turut berdekatan:`
- also: `Jambatan Kuala Ibai · Taman Lagun · Pantai Teluk Kalong · Pasar Malam Chendering`
- items: `Masjid Terapung Kuala Ibai` / `Masjid terapung yang indah di atas lagun.` · `Pantai Batu Buruk` / `Pantai persisiran dengan pasir putih yang halus.` · `Kompleks Kraf Noor Arfa` / `Pusat batik tradisional Terengganu yang terkemuka.`

**footer**
- tagline: `Di mana penginapan yang tenang bertemu keindahan Terengganu. Sebuah chalet butik yang hanya mempunyai 8 kabin persendirian, tersembunyi di sepanjang tebing sungai Kuala Ibai.`
- visit: `Kunjungi kami` · reach: `Hubungi kami` · maps: `Buka di Google Maps →`
- slogan: `Di mana penginagan yang tenang bertemu keindahan Terengganu.` → use `Di mana penginapan yang tenang bertemu keindahan Terengganu.`

### Out of scope
- English copy
- Booking page (`book.*`) strings
- Layout, styling, or component code
