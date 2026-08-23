// Message copy for the numbered-text conversation. Bilingual (EN default,
// BM for chats that greet in Malay). Staff takeovers continue in this chat.

export const CABIN_TYPES = [
  { n: "1", label: "Queen" },
  { n: "2", label: "Twin" },
  { n: "3", label: "Triple" },
  { n: "4", label: "Family" },
];

const T = {
  en: {
    menu: (ctx) =>
      `Welcome to D'Rajawali Cabin 🌿\n\n` +
      `1. Book a cabin\n2. Check my booking\n3. Talk to our staff\n\n` +
      `Reply with a number.`,
    checkBooking: () =>
      `Please send your booking reference (e.g. RJW-1234) and your name here. Our staff will check and reply to you shortly.`,
    askDates: () =>
      `What dates would you like? Please reply with check-in and check-out in one message, e.g.\n\n25-27 Aug 2026\nor\n25/8 - 27/8/2026`,
    badDates: () => `I couldn't read those dates. Please try again, e.g.\n\n25-27 Aug 2026`,
    askGuests: () => `How many guests? (1-12)`,
    badGuests: () => `Please reply with a number between 1 and 12.`,
    askRoomType: () =>
      `Which cabin type?\n\n1. Queen (2 guests)\n2. Twin (2 guests)\n3. Triple (3 guests)\n4. Family (4 guests)\n\nReply 1-4.`,
    badRoomType: () => `Please reply 1 (Queen), 2 (Twin), 3 (Triple) or 4 (Family).`,
    askComforter: () => `Add a comforter? (+RM20/night)\n\n1. Yes\n2. No`,
    badComforter: () => `Please reply 1 (Yes) or 2 (No).`,
    askName: () => `What name should the booking be under?`,
    badName: () => `Please reply with the guest name (2-100 characters).`,
    askPhone: () => `What's your phone number? (Reply "same" to use your WhatsApp number)`,
    badPhone: () =>
      `That phone number doesn't look right. Please reply with digits only, or "same".`,
    soldOut: () =>
      `Sorry, those dates were just taken for that cabin type. Please pick different dates:\n\nReply with check-in - check-out, e.g. 25-27 Aug 2026`,
    tryAgain: () =>
      `Something went wrong on our side. Please reply with your dates again:\n\n25-27 Aug 2026`,
    agent: (note) =>
      `Okay — our staff will take over from here. Please keep this chat open, a human will reply soon.\n` +
      (note ? `(You wrote: ${note})` : ""),
    invalid: (state) =>
      `I didn't understand that. ${HintText.en[state] ?? ""}\n\nType "menu" to start over or "agent" to talk to our staff.`,
    proofNudge: () => `Please send a photo of your payment proof here, or type "agent" for help.`,
    proofReceived: (ref) =>
      `Thank you! Payment proof received for ${ref}. Our staff will review it shortly — I'll message you here with the result. 📎`,
    proofAlready: () =>
      `We already received that proof — our staff are reviewing it. I'll message you when there's an update.`,
    proofTooLarge: () => `That file is too large (max 10 MB). Please send a smaller photo or PDF.`,
    proofBadType: () => `Please send the proof as a photo (JPG/PNG) or PDF.`,
    proofFetchFailed: () => `I couldn't download that file. Please send the proof photo again.`,
  },
  bm: {
    menu: (ctx) =>
      `Selamat datang ke D'Rajawali Cabin 🌿\n\n` +
      `1. Tempah kabin\n2. Semak tempahan saya\n3. Berhubung dengan staf kami\n\n` +
      `Balas dengan nombor.`,
    checkBooking: () =>
      `Sila hantar nombor rujukan tempahan anda (cth. RJW-1234) dan nama anda di sini. Staf kami akan menyemak dan membalas sebentar lagi.`,
    askDates: () =>
      `Tarikh bila? Sila balas tarikh daftar masuk dan daftar keluar dalam satu mesej, cth.\n\n25-27 Ogos 2026\natau\n25/8 - 27/8/2026`,
    badDates: () => `Saya tidak dapat membaca tarikh itu. Cuba lagi, cth.\n\n25-27 Ogos 2026`,
    askGuests: () => `Berapa tetamu? (1-12)`,
    badGuests: () => `Sila balas nombor antara 1 hingga 12.`,
    askRoomType: () =>
      `Jenis kabin yang mana?\n\n1. Queen (2 tetamu)\n2. Twin (2 tetamu)\n3. Triple (3 tetamu)\n4. Family (4 tetamu)\n\nBalas 1-4.`,
    badRoomType: () => `Sila balas 1 (Queen), 2 (Twin), 3 (Triple) atau 4 (Family).`,
    askComforter: () => `Tambah comforter? (+RM20/malam)\n\n1. Ya\n2. Tidak`,
    badComforter: () => `Sila balas 1 (Ya) atau 2 (Tidak).`,
    askName: () => `Tempahan atas nama siapa?`,
    badName: () => `Sila balas dengan nama tetamu (2-100 aksara).`,
    askPhone: () => `Nombor telefon anda? (Balas "same" untuk guna nombor WhatsApp anda)`,
    badPhone: () =>
      `Nombor telefon itu tidak kelihatan betul. Sila balas nombor sahaja, atau "same".`,
    soldOut: () =>
      `Maaf, tarikh itu baru sahaja diambil untuk jenis kabin itu. Sila pilih tarikh lain:\n\nBalas daftar masuk - daftar keluar, cth. 25-27 Ogos 2026`,
    tryAgain: () =>
      `Berlaku masalah teknikal. Sila balas tarikh anda sekali lagi:\n\n25-27 Ogos 2026`,
    agent: (note) =>
      `Baik — staf kami akan menyambung dari sini. Sila kekalkan chat ini terbuka, seorang staf akan membalas sebentar lagi.\n` +
      (note ? `(Anda menulis: ${note})` : ""),
    invalid: (state) => `Saya tidak faham. ${HintText.bm[state] ?? ""}`,
    proofNudge: () =>
      `Sila hantar gambar bukti pembayaran di sini, atau taip "agent" untuk bantuan.`,
    proofReceived: (ref) =>
      `Terima kasih! Bukti pembayaran untuk ${ref} telah diterima. Staf kami akan menyemaknya sebentar lagi — saya akan mesej anda di sini dengan keputusannya. 📎`,
    proofAlready: () =>
      `Bukti itu sudah kami terima — staf sedang menyemak. Saya akan mesej anda bila ada kemas kini.`,
    proofTooLarge: () =>
      `Fail terlalu besar (maks 10 MB). Sila hantar gambar atau PDF yang lebih kecil.`,
    proofBadType: () => `Sila hantar bukti sebagai gambar (JPG/PNG) atau PDF.`,
    proofFetchFailed: () =>
      `Saya tidak dapat memuat turun fail itu. Sila hantar semula gambar bukti.`,
  },
};

const HintText = {
  en: {
    MENU: `Reply a number 1-3.`,
    DATES: `Reply with check-in - check-out dates.`,
    GUESTS: `Reply with the number of guests.`,
    ROOM: `Reply 1-4 for cabin type.`,
    COMFORTER: `Reply 1 (Yes) or 2 (No).`,
    NAME: `Reply with the guest name.`,
    PHONE: `Reply with a phone number or "same".`,
    SUMMARY: `Reply 1 (Confirm), 2 (Change dates), 3 (Edit details) or 4 (Cancel).`,
    AWAIT_PROOF: `Send your payment proof as a photo/PDF.`,
    AGENT: `A staff member will reply.`,
  },
  bm: {
    MENU: `Balas nombor 1-3.`,
    DATES: `Balas tarikh daftar masuk - daftar keluar.`,
    GUESTS: `Balas bilangan tetamu.`,
    ROOM: `Balas 1-4 untuk jenis kabin.`,
    COMFORTER: `Balas 1 (Ya) atau 2 (Tidak).`,
    NAME: `Balas nama tetamu.`,
    PHONE: `Balas nombor telefon atau "same".`,
    SUMMARY: `Balas 1 (Sahkan), 2 (Tukar tarikh), 3 (Ubah butiran) atau 4 (Batal).`,
    AWAIT_PROOF: `Hantar bukti pembayaran sebagai gambar/PDF.`,
    AGENT: `Staf akan membalas.`,
  },
};

export function copy(lang, key, arg) {
  const t = T[lang] ?? T.en;
  const fn = t[key] ?? T.en[key];
  return typeof fn === "function" ? fn(arg) : key;
}

// -------- dynamic (outbox-delivered) messages, bilingual by construction ----
export function drawMenu(lang, draft) {
  const base = copy(lang, "menu");
  if (draft && draft.payment_reference) {
    const live = draft.status === "awaiting_review";
    return (
      base +
      (live
        ? `\n\n📎 Booking ${draft.payment_reference} is awaiting staff review.`
        : `\n\n⏳ You have booking ${draft.payment_reference} in progress — send your payment proof to continue, or type "agent".`)
    );
  }
  return base;
}

export function summaryText(lang, p) {
  const rm = (n) => Number(n).toFixed(2);
  const en =
    `Here's your booking summary:\n\n` +
    `📅 ${p.checkIn} → ${p.checkOut}\n👥 ${p.guests} guest(s)\n🏡 ${p.cabinName}\n` +
    (p.comforter ? `🛏️ Comforter: yes\n` : "") +
    (p.discountAmount > 0 ? `🏷️ Discount: -RM${rm(p.discountAmount)}\n` : "") +
    `\nTotal: RM${rm(p.total)}\n` +
    `To confirm, pay a deposit of RM${rm(p.deposit)} (balance before check-in).\n\n` +
    `1. Confirm\n2. Change dates\n3. Edit details\n4. Cancel`;
  const bm =
    `Ringkasan tempahan anda:\n\n` +
    `📅 ${p.checkIn} → ${p.checkOut}\n👥 ${p.guests} tetamu\n🏡 ${p.cabinName}\n` +
    (p.comforter ? `🛏️ Comforter: ya\n` : "") +
    (p.discountAmount > 0 ? `🏷️ Diskaun: -RM${rm(p.discountAmount)}\n` : "") +
    `\nJumlah: RM${rm(p.total)}\n` +
    `Untuk sahkan, bayar deposit RM${rm(p.deposit)} (baki sebelum daftar masuk).\n\n` +
    `1. Sahkan\n2. Tukar tarikh\n3. Ubah butiran\n4. Batal`;
  return lang === "bm" ? bm : en;
}

// Payment instructions text. The payment methods block (`paymentText`) comes
// from owner-approved wa_settings in Lovable Cloud — never hardcoded here.
export function instructionsText(lang, b, paymentText = null) {
  const rm = (n) => Number(n).toFixed(2);
  const ref = b.payment_reference;
  const methods = paymentText?.trim()
    ? paymentText.trim()
    : lang === "bm"
      ? `Kaedah pembayaran akan dikirim oleh staf kami di chat ini sebentar lagi.`
      : `Payment methods will be sent by our staff in this chat shortly.`;
  const en =
    `Booking ${ref} is reserved for 30 minutes ⏳\n\n` +
    `Pay the deposit of RM${rm(b.deposit_amount)} via:\n\n` +
    `${methods}\n\n` +
    `After paying, send a photo of the receipt here.\n\n` +
    `Total: RM${rm(b.total_amount)} · Balance due before check-in.\n\n` +
    `(type "agent" for help)`;
  const bm =
    `Tempahan ${ref} dipegang selama 30 minit ⏳\n\n` +
    `Bayar deposit RM${rm(b.deposit_amount)} melalui:\n\n` +
    `${methods}\n\n` +
    `Selepas membayar, hantar gambar resit di sini.\n\n` +
    `Jumlah: RM${rm(b.total_amount)} · Baki perlu dibayar sebelum daftar masuk.\n\n` +
    `(taip "agent" untuk bantuan)`;
  return lang === "bm" ? bm : en;
}

export function outboxText(kind, lang, payload = {}) {
  const rm = (n) => Number(n ?? 0).toFixed(2);
  const en = O.en[kind];
  const bm = O.bm[kind];
  const fn = (lang === "bm" ? bm : en) ?? en;
  return fn ? fn(payload, rm) : null;
}

const O = {
  en: {
    "staff-confirmed": (p, rm) =>
      `✅ Good news — your booking ${p.reference} (${p.room_type}, ${p.check_in} → ${p.check_out}) is CONFIRMED.\n\nTotal: RM${rm(p.total_amount)} · Deposit paid: RM${rm(p.deposit_amount)}\n\nWe'll send your check-in details before arrival. See you soon! 🌿`,
    "staff-resubmit": (p, rm) =>
      `❌ Our staff reviewed your payment proof for ${p.reference} and could not accept it.${p.reason ? ` Reason: ${p.reason}` : ""} Please send a new proof photo here. Your booking is held for another 30 minutes.`,
    "staff-hold-extended": (p) =>
      `⏳ Your booking hold has been extended until ${p.hold_expires_at ?? "the time confirmed by staff"}. Please send payment proof here when ready.`,
    "staff-cancelled": (p) =>
      `Your booking has been cancelled.${p.reason ? ` Reason: ${p.reason}` : ""}`,
    "hold-expired": () =>
      `⏳ Your booking hold expired before payment was received, so the dates were released. Reply "menu" to book again — we'll hold them for 30 minutes when you confirm.`,
    "staff-message": (p) => String(p.message ?? ""),
    "staff-paused": () => `Our staff are reviewing this chat. Please wait for their reply here.`,
    "staff-takeover": () => `A staff member has taken over this chat and will reply here shortly.`,
    "staff-resumed": () =>
      `The booking assistant is available again. Reply "menu" whenever you are ready.`,
  },
  bm: {
    "staff-confirmed": (p, rm) =>
      `✅ Berita baik — tempahan anda ${p.reference} (${p.room_type}, ${p.check_in} → ${p.check_out}) DISAHKAN.\n\nJumlah: RM${rm(p.total_amount)} · Deposit dibayar: RM${rm(p.deposit_amount)}\n\nKami akan hantar butiran daftar masuk sebelum ketibaan. Jumpa lagi! 🌿`,
    "staff-resubmit": (p, rm) =>
      `❌ Staf kami menyemak bukti pembayaran untuk ${p.reference} dan tidak dapat menerimanya.${p.reason ? ` Sebab: ${p.reason}` : ""} Sila hantar bukti baharu di sini. Tempahan anda dipegang 30 minit lagi.`,
    "staff-hold-extended": (p) =>
      `⏳ Pegangan tempahan anda dilanjutkan sehingga ${p.hold_expires_at ?? "masa yang disahkan oleh staf"}. Sila hantar bukti bayaran di sini apabila bersedia.`,
    "staff-cancelled": (p) =>
      `Tempahan anda telah dibatalkan.${p.reason ? ` Sebab: ${p.reason}` : ""}`,
    "hold-expired": () =>
      `⏳ Pegangan tempahan anda luput sebelum bayaran diterima, jadi tarikh telah dilepaskan. Balas "menu" untuk tempah semula — kami akan pegang 30 minit apabila anda sahkan.`,
    "staff-message": (p) => String(p.message ?? ""),
    "staff-paused": () => `Staf kami sedang menyemak chat ini. Sila tunggu balasan mereka di sini.`,
    "staff-takeover": () =>
      `Seorang staf telah mengambil alih chat ini dan akan membalas di sini sebentar lagi.`,
    "staff-resumed": () => `Pembantu tempahan tersedia semula. Balas "menu" apabila anda bersedia.`,
  },
};

export const MENU_RE = /^(menu|mula|restart|reset|batalkan|batal semua)$/i;
export const AGENT_RE = /agent|staff|human|operator|orang|tolong|help me|talk to/i;
export const GREETING_RE = /^(hi+|helo|hello|halo|assalam|salam|selamat|hai)\b/i;
export const STATUS_RE = /status|semak|check/i;

export function detectLang(body = "") {
  return /helo|assalam|selamat|salam|mula|tempah|sila|tuan|puan/i.test(body) ? "bm" : "en";
}
