import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Bridge } from "../src/runner.js";

const CHAT = "601155007204@s.whatsapp.net";

function cfg(overrides = {}) {
  return {
    wahaUrl: "http://waha.local:3000",
    wahaApiKey: "key",
    wahaSession: "default",
    wahaWebhookHmacKey: "bebek-hmac",
    machineUrl: "https://app.example",
    machineSecret: "machine-secret",
    machineKeyId: "wa-bridge-v1",
    port: 8080,
    outboxPollMs: 10,
    outboxClaimBatch: 10,
    sweepIntervalMs: 10,
    maxProofBytes: 1000,
    sendGapMs: 0,
    ...overrides,
  };
}

function makeMocks() {
  const calls = { sends: [], acks: [], claims: [], state: [], enqueues: [] };
  const machine = {
    claimEvent: async (eventId, chatId, type, payload) => {
      calls.claims.push({ eventId, chatId });
      return { ok: true, claimed: true };
    },
    getState: async () => ({ ok: true, conversation: null, draft: null }),
    putState: async (s) => {
      calls.state.push(s);
      return { ok: true, conflict: false, version: s.version + 1 };
    },
    prepareHold: async () => ({ ok: true, available: true, cabin_id: "c-1", cabin_name: "Q1", nights: 2, subtotal: 160, comforter_total: 0, discount_amount: 0, discount: null, total: 160, deposit: 50 }),
    claimHold: async () => ({ ok: true, claimed: true, booking: { booking_id: "b-1", booking_group_id: "g-1", payment_reference: "RJW-1", hold_expires_at: "x", total_amount: 160, deposit_amount: 50 } }),
    sweepHolds: async () => ({ ok: true, expired: [] }),
    outboxClaim: async () => ({ ok: true, rows: [] }),
    outboxAck: async (id, ok, extra) => {
      calls.acks.push({ id, ok, extra });
      return { ok: true };
    },
    outboxEnqueue: async (body) => {
      calls.enqueues.push(body);
      return { ok: true, enqueued: true, id: "o-1" };
    },
    proofUploadUrl: async () => ({ ok: true, upload_url: "http://store/put", path: "bookings/b1/wa-m1.jpg" }),
    proofAttach: async () => ({ ok: true, attached: true }),
    notifyAgent: async () => ({ ok: true }),
  };
  const waha = {
    sendText: async (chatId, text) => {
      calls.sends.push({ type: "text", chatId, text });
      return { id: "wa-1", chatId };
    },
    sendImage: async (chatId, buf, mime, filename, caption) => {
      calls.sends.push({ type: "image", chatId, mime, filename, caption, bytes: buf.length });
      return { id: "wa-2", chatId };
    },
    downloadMedia: async (url) => ({ buffer: Buffer.from("fake-jpeg-data"), contentType: "image/jpeg", status: 200 }),
  };
  return { calls, machine, waha };
}

function webhookPayload(body, extra = {}) {
  return JSON.stringify({
    event: "message",
    session: "default",
    payload: { id: "m-1", timestamp: Date.now(), from: CHAT, fromMe: false, body, ...extra },
  });
}

function sign(body, secret = "bebek-hmac") {
  return createHmac("sha256", secret).update(body).digest("hex");
}

test("bad HMAC on webhook is rejected with 401", async () => {
  const { machine, waha } = makeMocks();
  const bridge = new Bridge(cfg(), { machine, waha });
  const body = webhookPayload("hi");
  await assert.rejects(
    () => bridge.handleWebhook(body, { "x-webhook-hmac": "deadbeef" }),
    (e) => e.status === 401,
  );
});

test("greeting produces a menu text reply and persists state", async () => {
  const { calls, machine, waha } = makeMocks();
  const bridge = new Bridge(cfg(), { machine, waha });
  const body = webhookPayload("hi");
  const res = await bridge.handleWebhook(body, { "x-webhook-hmac": sign(body) });
  assert.equal(res.handled, true);
  const textSends = calls.sends.filter((s) => s.type === "text");
  assert.ok(textSends.length >= 1);
  assert.match(textSends[0].text, /Book a cabin|Tempah kabin/);
  const saved = calls.state[calls.state.length - 1];
  assert.equal(saved.state, "MENU");
  assert.equal(saved.version, 0);
});

test("replayed webhook (duplicate event id) does zero work", async () => {
  const { calls, machine, waha } = makeMocks();
  machine.claimEvent = async () => ({ ok: true, claimed: false, duplicate: true });
  const bridge = new Bridge(cfg(), { machine, waha });
  const body = webhookPayload("1");
  await bridge.handleWebhook(body, { "x-webhook-hmac": sign(body) });
  assert.equal(calls.sends.length, 0);
  assert.equal(calls.state.length, 0);
});

test("group and self messages are ignored without machine calls", async () => {
  const { calls, machine, waha } = makeMocks();
  const bridge = new Bridge(cfg(), { machine, waha });
  const groupBody = webhookPayload("", { from: "1234@g.us" });
  await bridge.handleWebhook(groupBody, { "x-webhook-hmac": sign(groupBody) });
  assert.equal(calls.state.length, 0);
  const selfBody = webhookPayload("hi", { fromMe: true });
  await bridge.handleWebhook(selfBody, { "x-webhook-hmac": sign(selfBody) });
  assert.equal(calls.state.length, 0);
});

test("outbox poll sends rows and acks successes and failures", async () => {
  const { calls, machine, waha } = makeMocks();
  let failNext = true;
  waha.sendText = async (_chatId, text) => {
    if (failNext) throw new Error("waha down");
    calls.sends.push({ type: "text", chatId: _chatId, text });
    return { id: "ok-1" };
  };
  machine.outboxClaim = async () => ({
    ok: true,
    rows: [
      { id: "22222222-0000-4000-8000-000000000001", chat_id: CHAT, kind: "staff-confirmed", payload: { reference: "RJW-2", room_type: "Queen", check_in: "x", check_out: "y", total_amount: 10, deposit_amount: 50 }, attempts: 1 },
      { id: "22222222-0000-4000-8000-000000000002", chat_id: CHAT, kind: "staff-resubmit", payload: { reference: "RJW-3" }, attempts: 1 },
    ],
  });
  const bridge = new Bridge(cfg(), { machine, waha });
  await bridge.pollOutboxOnce(); // both sends fail -> ack fail
  failNext = false;
  await bridge.pollOutboxOnce(); // both sent -> ack ok
  const ackOk = calls.acks.filter((a) => a.ok);
  const ackFail = calls.acks.filter((a) => !a.ok);
  assert.equal(ackOk.length, 2);
  assert.equal(ackFail.length, 2);
  assert.equal(calls.sends.length, 2); // only the second round actually delivered
});

test("hold sweep enqueues one deduped notice per expired group", async () => {
  const { calls, machine, waha } = makeMocks();
  machine.sweepHolds = async () => ({
    ok: true,
    expired: [
      { chat_id: CHAT, booking_group_id: "g9" },
      { chat_id: CHAT, booking_group_id: "g9" }, // double sweep result
      { chat_id: CHAT, booking_group_id: null },
    ],
  });
  const bridge = new Bridge(cfg(), { machine, waha });
  await bridge.sweepStaleHolds();
  const enq = calls.enqueues.filter((e) => e.kind === "hold-expired");
  assert.equal(enq.length, 2);
  assert.equal(enq[0].dedupeKey, "hold-expired-g9");
});

test("proof pipeline: valid media uploads, attaches and returns received", async () => {
  const { machine, waha } = makeMocks();
  let putCalls = 0;
  const bridge = new Bridge(cfg(), { machine, waha });
  bridge.machine.proofUploadUrl = async () => ({ ok: true, upload_url: "http://store/put", path: "bookings/b1/wa-m1.jpg" });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url === "http://store/put") {
      putCalls++;
      return { ok: true, status: 200 };
    }
    throw new Error(`unexpected url ${url}`);
  };
  try {
    const outcome = await bridge.runProofPipeline(
      { chatId: CHAT, messageId: "m1", media: { url: "http://waha/files/m1", mime: "image/jpeg" } },
      { bookingGroupId: "g1" },
    );
    assert.equal(outcome, "received");
    assert.equal(putCalls, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("proof pipeline: oversized media rejected before upload", async () => {
  const { machine, waha } = makeMocks();
  waha.downloadMedia = async () => ({ buffer: Buffer.alloc(9999), contentType: "image/jpeg" });
  const bridge = new Bridge(cfg({ maxProofBytes: 1000 }), { machine, waha });
  const outcome = await bridge.runProofPipeline(
    { chatId: CHAT, messageId: "m2", media: { url: "http://waha/files/m2", mime: "image/jpeg" } },
    { bookingGroupId: "g1" },
  );
  assert.equal(outcome, "tooLarge");
});

test("proof pipeline: disallowed mime rejected", async () => {
  const { machine, waha } = makeMocks();
  waha.downloadMedia = async () => ({ buffer: Buffer.from("evil.exe"), contentType: "application/x-msdownload" });
  const bridge = new Bridge(cfg(), { machine, waha });
  const outcome = await bridge.runProofPipeline(
    { chatId: CHAT, messageId: "m3", media: { url: "http://waha/files/m3", mime: "application/x-msdownload" } },
    { bookingGroupId: "g1" },
  );
  assert.equal(outcome, "badType");
});

test("double attachment resolves as duplicate (same wa message id)", async () => {
  const { machine, waha } = makeMocks();
  machine.proofUploadUrl = async () => ({ ok: true, duplicate: true });
  const bridge = new Bridge(cfg(), { machine, waha });
  const outcome = await bridge.runProofPipeline(
    { chatId: CHAT, messageId: "m4", media: { url: "http://waha/files/m4", mime: "image/jpeg" } },
    { bookingGroupId: "g1" },
  );
  assert.equal(outcome, "duplicate");
});