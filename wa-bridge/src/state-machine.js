// Pure numbered-text conversation engine. No I/O: the bridge feeds it an
// inbound message and a conversation frame and receives the next frame plus
// EFFECTS ({send...} for WAHA, {machine...} for the app API). This is the
// single source of truth for valid transitions, so invalid/out-of-order
// inputs can never mutate booking state.

import {
  CABIN_TYPES,
  MENU_RE,
  AGENT_RE,
  GREETING_RE,
  STATUS_RE,
  copy,
  drawMenu,
  summaryText,
  instructionsText,
} from "./copy.js";

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
  januari: 1,
  februari: 2,
  mac: 3,
  april: 4,
  mei: 5,
  jun: 6,
  julai: 7,
  ogos: 8,
  ogo: 8,
  september: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  disember: 12,
  dis: 12,
};

const MAX_NIGHTS = 28;

// ---------------------------------------------------------------------------
// Parsing helpers (pure)
// ---------------------------------------------------------------------------

// Parses "25-27 Aug 2026", "25/8 - 27/8/2026", "25.08 - 27.08", "25 Aug - 27 Aug 2026"
// into {checkIn, checkOut} ISO dates (UTC). Returns null when unreadable,
// {tooFar:true} beyond MAX_NIGHTS, {past:true} for past dates.
const MONTH_NAMES = Object.keys(MONTHS);

export function parseDateRange(text) {
  if (typeof text !== "string") return null;
  const s = text.trim().replace(/\s+/g, " ").toLowerCase();
  // Range separators: spaced hyphen/en-dash, "..", or "to/hingga/ke" as words.
  // (Bare hyphens inside "27/08/2026"-style tokens are NOT separators.)
  let parts = s
    .split(/\s+(?:-|–|~)\s+|\s*\.\.\s*|\s+(?:to|hingga|ke)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  // "25-27 Aug 2026" / "25-27": plain DD-DD range.
  if (parts.length < 2) {
    const m = s.match(/^(\d{1,2})\s*-+\s*(\d{1,2})(?:[^0-9](.*))?$/);
    if (m) parts = m[3] ? [m[1], `${m[2]} ${m[3].trim()}`] : [m[1], m[2]];
  }
  if (parts.length < 2) return null;
  const a = parseSingleDate(parts[0]);
  const b = parseSingleDate(parts[1]);
  if (!a || !b) return null;
  const now = new Date();
  const moIn = a.mo ?? b.mo ?? now.getUTCMonth() + 1;
  const yIn = a.y ?? b.y ?? now.getUTCFullYear();
  const moOut = b.mo ?? a.mo ?? moIn;
  const yOut = b.y ?? a.y ?? yIn;
  return buildRange(a.d, moIn, yIn, b.d, moOut, yOut);
}

// One side of a date range. Returns {d, mo, y} with mo/y null when omitted.
function parseSingleDate(s) {
  let m;
  // "27 aug 2026" / "27 ogos"
  m = s.match(new RegExp(`^(\\d{1,2})\\s+(${MONTH_NAMES.join("|")})(?:\\s+(\\d{2}|\\d{4}))?$`));
  if (m) return { d: Number(m[1]), mo: MONTHS[m[2]], y: y2k(m[3]) };
  // "27/8/2026" / "27.8" / "27-08-26"  (day-month; month>12 looks swapped)
  m = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/);
  if (m) {
    let d = Number(m[1]);
    let mo = Number(m[2]);
    const y = y2k(m[3]);
    if (mo > 12 && d <= 12) {
      const t = d;
      d = mo;
      mo = t;
    }
    return { d, mo, y };
  }
  // "27" (bare day: same month as the other side, or current month)
  m = s.match(/^(\d{1,2})$/);
  if (m) return { d: Number(m[1]), mo: null, y: null };
  return null;
}

function buildRange(dIn, moIn, yIn, dOut, moOut, yOut) {
  if (!isValidDate(dIn, moIn, yIn)) return null;
  if (!isValidDate(dOut, moOut, yOut)) return null;
  const checkIn = toIso(dIn, moIn, yIn);
  const checkOut = toIso(dOut, moOut, yOut);
  const nights = diffDays(checkOut, checkIn);
  if (nights < 1) return null;
  if (nights > MAX_NIGHTS) return { tooFar: true, checkIn: null, checkOut: null, nights };
  if (checkIn < todayIso()) return { past: true, checkIn: null, checkOut: null, nights };
  return { checkIn, checkOut, nights };
}

function y2k(y) {
  if (!y) return null;
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
}

function isValidDate(d, mo, y) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toIso(d, mo, y) {
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function diffDays(aIso, bIso) {
  return Math.round((Date.parse(aIso + "T00:00:00Z") - Date.parse(bIso + "T00:00:00Z")) / 86400000);
}

function todayIsoPlus(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return todayIsoPlus(0);
}

export function parseGuests(text) {
  const m = String(text ?? "")
    .trim()
    .match(/^(\d{1,2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

export function parseRoomChoice(text) {
  const t = String(text ?? "")
    .trim()
    .toLowerCase();
  const found = CABIN_TYPES.find(
    (c) => t === c.n || t.startsWith(c.label.toLowerCase()) || t.includes(c.label.toLowerCase()),
  );
  return found ?? null;
}

export function parseComforter(text) {
  const t = String(text ?? "")
    .trim()
    .toLowerCase();
  if (["1", "y", "yes", "ya", "yeah", "nak", "ok", "okay"].includes(t)) return true;
  if (["2", "n", "no", "tidak", "tak", "x"].includes(t)) return false;
  return null;
}

export function parsePhone(text) {
  const t = String(text ?? "").trim();
  if (/^(same|sama)$/i.test(t)) return { same: true };
  const digits = t.replace(/[^0-9]/g, "");
  if (digits.length >= 7 && digits.length <= 15) return { same: false, phone: digits };
  return null;
}

export function parseMenuChoice(text) {
  const t = String(text ?? "").trim();
  if (/^[1-3]$/.test(t)) return Number(t);
  return null;
}

export function parseSummaryChoice(text) {
  const t = String(text ?? "").trim();
  if (/^[1-4]$/.test(t)) return Number(t);
  return null;
}

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

// WAHA inbound message -> the machine's view of the world.
export function normalizeInbound(payload, session) {
  const media = payload?.media && payload?.hasMedia ? payload.media : null;
  return {
    from: payload?.from ?? null,
    fromMe: Boolean(payload?.fromMe),
    chatId: payload?.from ?? "",
    isGroup: Boolean(payload?.from && payload.from.endsWith("@g.us")),
    body: typeof payload?.body === "string" ? payload.body.trim() : "",
    messageId: payload?.id ?? null,
    timestamp: payload?.timestamp ?? null,
    hasMedia: Boolean(media),
    media: media
      ? {
          url: media.url ?? null,
          mime: media.mimetype ?? null,
          filename: media.filename ?? null,
        }
      : null,
  };
}

export const STATES = {
  MENU: "MENU",
  DATES: "DATES",
  GUESTS: "GUESTS",
  ROOM: "ROOM",
  COMFORTER: "COMFORTER",
  NAME: "NAME",
  PHONE: "PHONE",
  SUMMARY: "SUMMARY",
  AWAIT_PROOF: "AWAIT_PROOF",
  AGENT: "AGENT",
};

export function freshConversation(chatId) {
  return {
    chatId,
    state: STATES.MENU,
    data: {},
    lang: "en",
    failureCount: 0,
    bookingGroupId: null,
    version: 0,
  };
}

// ---------------------------------------------------------------------------
// Reducer: (convo, msg, draft) -> { convo, effects }
// Effects are executed by the bridge:
//   {op:'send', text}
//   {op:'send', text, image:{path}}                                (QR)
//   {op:'prepare}   -> bridge runs machine.prepareHold and re-enters
//                     with resumePrepare(result)
//   {op:'claim'}    -> bridge runs machine.claimHold and re-enters
//                     claimResult(result, resumeClaim)
//   {op:'proof'}    -> bridge runs the proof pipeline, then applies
//                     proofResult({kind, ref})
//   {op:'agent'}    -> bridge calls machine.notifyAgent
// ---------------------------------------------------------------------------
export function transition(convo, msg, { draft = null } = {}) {
  const effects = [];
  const send = (text, imagePath) =>
    effects.push(imagePath ? { op: "send", text, image: imagePath } : { op: "send", text });
  const lang = convo.lang;

  // Staff controls own the conversation until an authorized resume clears the
  // flag. This guard intentionally precedes global commands such as "menu".
  if (convo.data?.staffPaused) return { convo, effects };

  // Flag the failure state and hand off after 3 bad inputs in a row.
  function fail(nextState, hintState) {
    convo.failureCount += 1;
    if (convo.failureCount >= 3) {
      convo.state = STATES.AGENT;
      send(copy(lang, "agent", null));
      effects.push({ op: "agent" });
      return;
    }
    send(copy(lang, "invalid", hintState));
    convo.state = nextState ?? convo.state;
  }

  // ---- global commands (valid from every state, including mid-flow) ----
  if (msg.body && MENU_RE.test(msg.body)) {
    convo.state = STATES.MENU;
    convo.failureCount = 0;
    send(drawMenu(lang, draft));
    return { convo, effects };
  }
  // Post-confirmation "batal" resets the draft booking too: staff handles the
  // cancellation in the admin (the bridge never touches booking state).
  if (msg.body && /^(batal semuanya|cancel everything)$/i.test(msg.body) && convo.bookingGroupId) {
    convo.data = {};
    convo.bookingGroupId = null;
    convo.state = STATES.MENU;
    convo.failureCount = 0;
    send(drawMenu(lang, draft));
    return { convo, effects };
  }
  if (msg.body && AGENT_RE.test(msg.body)) {
    const note = msg.body;
    convo.state = STATES.AGENT;
    convo.failureCount = 0;
    send(copy(lang, "agent", note));
    effects.push({ op: "agent", note });
    return { convo, effects };
  }
  if (msg.chatId && msg.isGroup) return { convo, effects }; // groups: ignore
  if (!msg.chatId) return { convo, effects };
  if (msg.fromMe) return { convo, effects }; // our own echoes

  const body = msg.body;
  const hasMedia = msg.hasMedia && !body;

  switch (convo.state) {
    case STATES.MENU: {
      if (hasMedia) {
        send(copy(lang, "invalid", "MENU"));
        return { convo, effects };
      }
      const greeting = GREETING_RE.test(body) && body.split(/\s+/).length <= 3;
      const choice = parseMenuChoice(body);
      if (choice === null) {
        if (greeting) {
          send(drawMenu(lang, draft));
          return { convo, effects };
        }
        fail(null, "MENU");
        return { convo, effects };
      }
      convo.failureCount = 0;
      if (choice === 1) {
        if (draft && (draft.status === "pending_payment" || draft.status === "awaiting_review")) {
          send(drawMenu(lang, draft));
          return { convo, effects };
        }
        convo.state = STATES.DATES;
        send(copy(lang, "askDates"));
      } else if (choice === 2) {
        send(copy(lang, "checkBooking"));
      } else {
        convo.state = STATES.AGENT;
        send(copy(lang, "agent", null));
        effects.push({ op: "agent" });
      }
      return { convo, effects };
    }

    case STATES.DATES: {
      const parsed = parseDateRange(body);
      if (!parsed || !parsed.checkIn) {
        if (parsed?.tooFar) send(copy(lang, "badDates"));
        else if (parsed?.past) send(copy(lang, "badDates") + "\n(past dates cannot be booked)");
        else send(copy(lang, "badDates"));
        convo.failureCount += 1;
        if (convo.failureCount >= 3) {
          convo.state = STATES.AGENT;
          send(copy(lang, "agent", null));
          effects.push({ op: "agent" });
        }
        return { convo, effects };
      }
      convo.failureCount = 0;
      convo.data.checkIn = parsed.checkIn;
      convo.data.checkOut = parsed.checkOut;
      convo.state = STATES.GUESTS;
      send(copy(lang, "askGuests"));
      return { convo, effects };
    }

    case STATES.GUESTS: {
      const n = parseGuests(body);
      if (n === null) {
        fail(null, "GUESTS");
        return { convo, effects };
      }
      convo.failureCount = 0;
      convo.data.guests = n;
      convo.state = STATES.ROOM;
      send(copy(lang, "askRoomType"));
      return { convo, effects };
    }

    case STATES.ROOM: {
      const c = parseRoomChoice(body);
      if (!c) {
        fail(null, "ROOM");
        return { convo, effects };
      }
      convo.failureCount = 0;
      convo.data.cabinType = c.label;
      convo.state = STATES.COMFORTER;
      send(copy(lang, "askComforter"));
      return { convo, effects };
    }

    case STATES.COMFORTER: {
      const v = parseComforter(body);
      if (v === null) {
        fail(null, "COMFORTER");
        return { convo, effects };
      }
      convo.failureCount = 0;
      convo.data.comforter = v;
      convo.state = STATES.NAME;
      send(copy(lang, "askName"));
      return { convo, effects };
    }

    case STATES.NAME: {
      const name = body;
      if (name.length < 2 || name.length > 100) {
        fail(null, "NAME");
        return { convo, effects };
      }
      convo.failureCount = 0;
      convo.data.guestName = name;
      convo.state = STATES.PHONE;
      send(copy(lang, "askPhone"));
      return { convo, effects };
    }

    case STATES.PHONE: {
      const p = parsePhone(body);
      if (!p) {
        fail(null, "PHONE");
        return { convo, effects };
      }
      convo.failureCount = 0;
      convo.data.phone = p.same ? digitsOnly(msg.chatId) : p.phone;
      convo.state = STATES.SUMMARY;
      effects.push({ op: "prepare" });
      return { convo, effects };
    }

    case STATES.SUMMARY: {
      const choice = parseSummaryChoice(body);
      if (choice === null) {
        fail(null, "SUMMARY");
        return { convo, effects };
      }
      convo.failureCount = 0;
      if (choice === 2) {
        convo.state = STATES.DATES;
        send(copy(lang, "askDates"));
      } else if (choice === 3) {
        convo.state = STATES.NAME;
        send(copy(lang, "askName"));
      } else if (choice === 4) {
        convo.state = STATES.MENU;
        send(drawMenu(lang, draft));
      } else {
        effects.push({ op: "claim" });
      }
      return { convo, effects };
    }

    case STATES.AWAIT_PROOF: {
      if (hasMedia || msg.hasMedia) {
        effects.push({
          op: "proof",
          messageId: msg.messageId,
          media: msg.media,
        });
        return { convo, effects };
      }
      if (body && STATUS_RE.test(body) && body.split(/\s+/).length <= 3) {
        const live =
          draft?.status === "awaiting_review"
            ? `Your booking ${draft.payment_reference ?? ""} is being reviewed by our staff. I'll message you as soon as there's an update.`
            : `Booking ${draft?.payment_reference ?? ""} is waiting for payment proof. Send a photo of the receipt here.`;
        convo.failureCount = 0;
        send(live);
        return { convo, effects };
      }
      send(copy(lang, "proofNudge"));
      return { convo, effects };
    }

    case STATES.AGENT: {
      // Bot parked: staff are on the chat. Only an explicit menu restarts.
      return { convo, effects };
    }

    default:
      return { convo, effects };
  }
}

// Called by the bridge once machine.prepareHold resolves.
export function onPrepareResult(convo, res) {
  const effects = [];
  const send = (text, imagePath) =>
    effects.push(imagePath ? { op: "send", text, image: imagePath } : { op: "send", text });
  if (convo.state !== STATES.SUMMARY) return { convo, effects };

  if (!res.ok) {
    convo.state = STATES.DATES;
    send(copy(convo.lang, "tryAgain"));
    return { convo, effects };
  }
  if (!res.available) {
    convo.state = STATES.DATES;
    send(copy(convo.lang, "soldOut"));
    return { convo, effects };
  }
  convo.data.prepared = {
    cabinId: res.cabin_id,
    cabinName: res.cabin_name,
    nights: res.nights,
    subtotal: res.subtotal,
    comforterTotal: res.comforter_total,
    discountAmount: res.discount_amount,
    discountId: res.discount?.id ?? null,
    discountCode: res.discount?.code ?? null,
    total: res.total,
    deposit: res.deposit,
  };
  send(
    summaryText(convo.lang, {
      checkIn: convo.data.checkIn,
      checkOut: convo.data.checkOut,
      guests: convo.data.guests,
      cabinName: res.cabin_name,
      comforter: convo.data.comforter,
      discountAmount: res.discount_amount,
      total: res.total,
      deposit: res.deposit,
    }),
  );
  return { convo, effects };
}

// Called by the bridge once machine.claimHold resolves.
export function onClaimResult(convo, res, paymentText = null) {
  const effects = [];
  const send = (text, imagePath) =>
    effects.push(imagePath ? { op: "send", text, image: imagePath } : { op: "send", text });
  if (convo.state !== STATES.SUMMARY) return { convo, effects };

  if (!res.ok) {
    convo.state = STATES.DATES;
    send(copy(convo.lang, "tryAgain"));
    return { convo, effects };
  }
  if (!res.claimed) {
    convo.state = STATES.DATES;
    send(copy(convo.lang, "soldOut"));
    return { convo, effects };
  }
  const b = res.booking;
  convo.data.booking = {
    id: b.booking_id,
    reference: b.payment_reference,
    groupId: b.booking_group_id,
    holdExpiresAt: b.hold_expires_at,
    total: Number(b.total_amount),
    deposit: Number(b.deposit_amount),
  };
  convo.bookingGroupId = b.booking_group_id;
  convo.state = STATES.AWAIT_PROOF;
  // `image: "qr"` marks the settings-driven QR (owner-approved, fetched from
  // Lovable Cloud at send time — no committed asset).
  send(
    instructionsText(
      convo.lang,
      {
        payment_reference: b.payment_reference,
        deposit_amount: Number(b.deposit_amount),
        total_amount: Number(b.total_amount),
      },
      paymentText,
    ),
    "qr",
  );
  return { convo, effects };
}

export function proofResult(convo, outcome) {
  const effects = [];
  const send = (text) => effects.push({ op: "send", text });
  const lang = convo.lang;
  const o = typeof outcome === "string" ? { kind: outcome } : (outcome ?? {});
  const ref = o.ref ?? convo.data.booking?.reference ?? "";
  if (o.kind === "duplicate") send(copy(lang, "proofAlready", ref));
  else if (o.kind === "received") send(copy(lang, "proofReceived", ref));
  else
    send(
      copy(
        lang,
        o.kind === "tooLarge"
          ? "proofTooLarge"
          : o.kind === "badType"
            ? "proofBadType"
            : "proofFetchFailed",
      ),
    );
  return { convo, effects };
}

function digitsOnly(chatId = "") {
  return chatId.replace(/[^0-9]/g, "");
}
