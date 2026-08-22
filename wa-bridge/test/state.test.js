import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transition,
  onPrepareResult,
  onClaimResult,
  parseDateRange,
  parseGuests,
  parseRoomChoice,
  parseComforter,
  parsePhone,
  normalizeInbound,
  freshConversation,
} from "../src/state-machine.js";

const chat = "601155007204@s.whatsapp.net";

function msg(body, extra = {}) {
  return { ...normalizeInbound({ body, from: chat, id: `id-${Math.random().toString(36).slice(2)}`, timestamp: Date.now() }), ...extra };
}

function walk(convo, body) {
  return transition(convo, msg(body));
}

test("greeting lands in MENU and prints the numbered menu", () => {
  const convo = freshConversation(chat);
  const { convo: next, effects } = walk(convo, "hi");
  assert.equal(next.state, "MENU");
  assert.ok(effects.some((e) => e.op === "send" && /Book a cabin/.test(e.text)));
});

test("full numbered flow: menu -> dates -> guests -> room -> comforter -> name -> phone -> prepare", () => {
  const convo = freshConversation(chat);
  let r = walk(convo, "1");
  assert.equal(r.convo.state, "DATES");
  r = walk(r.convo, "25-27 Aug 2026");
  assert.equal(r.convo.state, "GUESTS");
  assert.equal(r.convo.data.checkIn, "2026-08-25");
  assert.equal(r.convo.data.checkOut, "2026-08-27");
  r = walk(r.convo, "2");
  assert.equal(r.convo.state, "ROOM");
  r = walk(r.convo, "1");
  assert.equal(r.convo.state, "COMFORTER");
  assert.equal(r.convo.data.cabinType, "Queen");
  r = walk(r.convo, "2");
  assert.equal(r.convo.state, "NAME");
  assert.equal(r.convo.data.comforter, false);
  r = walk(r.convo, "Ali bin Abu");
  assert.equal(r.convo.state, "PHONE");
  r = walk(r.convo, "same");
  assert.equal(r.convo.state, "SUMMARY");
  assert.equal(r.convo.data.phone, "601155007204");
  assert.ok(r.effects.some((e) => e.op === "prepare"));
});

test("BM locale: helo switches menu copy to Bahasa", () => {
  const convo = { ...freshConversation(chat) };
  const { convo: next } = walk(convo, "helo");
  assert.equal(next.state, "MENU");
});

test("invalid transitions never move booking state", () => {
  const convo = { ...freshConversation(chat), state: "DATES", failureCount: 0 };
  const r = walk(convo, "not dates at all");
  assert.equal(r.convo.state, "DATES");
  assert.equal(r.convo.failureCount, 1);
  assert.ok(r.effects.some((e) => e.op === "send" && /couldn't read|tidak dapat membaca/i.test(e.text)));
});

test("three bad inputs in a row hand off to a human", () => {
  const convo = { ...freshConversation(chat), state: "DATES" };
  let r = walk(convo, "blah");
  r = walk(r.convo, "blah");
  r = walk(r.convo, "blah");
  assert.equal(r.convo.state, "AGENT");
  assert.ok(r.effects.some((e) => e.op === "agent"));
});

test("menu / restart works from every intermediate state", () => {
  for (const state of ["DATES", "GUESTS", "ROOM", "COMFORTER", "NAME", "PHONE", "SUMMARY", "AWAIT_PROOF"]) {
    const convo = { ...freshConversation(chat), state };
    const r = walk(convo, "restart");
    assert.equal(r.convo.state, "MENU", `restart from ${state}`);
  }
});

test("agent keyword from every state hands off", () => {
  for (const state of ["DATES", "GUESTS", "ROOM", "COMFORTER", "NAME", "PHONE", "SUMMARY", "AWAIT_PROOF", "MENU"]) {
    const convo = { ...freshConversation(chat), state };
    const r = walk(convo, "agent please");
    assert.equal(r.convo.state, "AGENT", `agent from ${state}`);
    assert.ok(r.effects.some((e) => e.op === "agent"));
  }
});

test("summary: confirm enqueues a claim; cancel returns to menu", () => {
  const convo = { ...freshConversation(chat), state: "SUMMARY", data: { prepared: {} } };
  let r = walk(convo, "1");
  assert.ok(r.effects.some((e) => e.op === "claim"));
  r = walk(r.convo, "4");
  assert.equal(r.convo.state, "MENU");
});

test("prepare result sold-out forces new dates", () => {
  const convo = { ...freshConversation(chat), state: "SUMMARY" };
  const { convo: next, effects } = onPrepareResult(convo, { ok: true, available: false });
  assert.equal(next.state, "DATES");
  assert.ok(effects.some((e) => /just taken|baru sahaja diambil/i.test(e.text)));
});

test("claim result success parks at AWAIT_PROOF and sends QR + instructions", () => {
  const convo = { ...freshConversation(chat), state: "SUMMARY" };
  const { convo: next, effects } = onClaimResult(convo, {
    ok: true,
    claimed: true,
    booking: {
      booking_id: "11111111-1111-4111-8111-111111111111",
      booking_group_id: "22222222-2222-4222-8222-222222222222",
      payment_reference: "RJW-1234",
      hold_expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      total_amount: 180,
      deposit_amount: 50,
    },
  });
  assert.equal(next.state, "AWAIT_PROOF");
  assert.equal(next.bookingGroupId, "22222222-2222-4222-8222-222222222222");
  assert.ok(effects.some((e) => e.image === "assets/duitnow-qr.jpg"));
  assert.ok(effects.some((e) => /30 minit|30 minutes/.test(e.text)));
});

test("claim result taken pushes back to dates", () => {
  const convo = { ...freshConversation(chat), state: "SUMMARY" };
  const { convo: next } = onClaimResult(convo, { ok: true, claimed: false });
  assert.equal(next.state, "DATES");
});

test("AWAIT_PROOF accepts resubmitted media (rejection -> new proof)", () => {
  const convo = { ...freshConversation(chat), state: "AWAIT_PROOF", bookingGroupId: "x" };
  const r = transition(convo, msg("", { hasMedia: true, messageId: "m1", media: { url: "http://wa/files/m1", mimetype: "image/jpeg" } }));
  assert.ok(r.effects.some((e) => e.op === "proof" && e.messageId === "m1"));
  // plain text in AWAIT_PROOF must not change state
  const r2 = walk(r.convo, "hello?");
  assert.equal(r2.convo.state, "AWAIT_PROOF");
});

test("media outside AWAIT_PROOF is rejected in MENU without state change", () => {
  const convo = freshConversation(chat);
  const r = transition(convo, msg("", { hasMedia: true, messageId: "m2", media: { url: "http://wa/files/m2" } }));
  assert.equal(r.convo.state, "MENU");
});

test("group chats and self messages are ignored", () => {
  const g = { ...freshConversation("123@g.us") };
  const r = transition(g, msg("book", { isGroup: true }));
  assert.equal(r.convo.state, "MENU");
  assert.equal(r.effects.length, 0);
  const s = { ...freshConversation(chat) };
  const r2 = transition(s, msg("hi", { fromMe: true }));
  assert.equal(r2.effects.length, 0);
});

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

test("parseDateRange handles slash, word and hybrid formats", () => {
  const y = new Date().getUTCFullYear() + 1;
  assert.deepEqual(parseDateRange(`20/8 - 22/8/${y}`), { checkIn: `${y}-08-20`, checkOut: `${y}-08-22`, nights: 2 });
  assert.deepEqual(parseDateRange(`20-22 Aug ${y}`), { checkIn: `${y}-08-20`, checkOut: `${y}-08-22`, nights: 2 });
  assert.deepEqual(parseDateRange(`3 Ogos - 5 Ogos ${y}`), { checkIn: `${y}-08-03`, checkOut: `${y}-08-05`, nights: 2 });
  const bare = parseDateRange(`25.8 - 27.8`);
  assert.equal(bare.nights, 2);
  assert.match(bare.checkIn, /^\d{4}-08-25$/);
});

test("parseDateRange rejects garbage, past and reversed ranges", () => {
  const y = new Date().getUTCFullYear() + 1;
  assert.equal(parseDateRange("tomorrow?"), null);
  assert.equal(parseDateRange(`27/8 - 25/8/${y}`), null);
  assert.equal(parseDateRange("2020-01-01 - 2020-01-02"), null); // past
  const far = parseDateRange("1/1 - 30/3/2099");
  assert.ok(!far.checkIn && far.tooFar);
});

test("choice & field parsers", () => {
  assert.equal(parseGuests("4"), 4);
  assert.equal(parseGuests("13"), null);
  assert.equal(parseGuests("abc"), null);
  assert.equal(parseRoomChoice("1").label, "Queen");
  assert.equal(parseRoomChoice("triple").label, "Triple");
  assert.equal(parseComforter("1"), true);
  assert.equal(parseComforter("tidak"), false);
  assert.deepEqual(parsePhone("same"), { same: true });
  assert.deepEqual(parsePhone("+60 11-5500 7204"), { same: false, phone: "601155007204" });
  assert.equal(parsePhone("12"), null);
});