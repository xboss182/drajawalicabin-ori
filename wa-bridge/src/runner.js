// Bridge orchestrator: WAHA webhooks -> event claim -> conversation state ->
// state machine -> durable state save -> effects (WAHA + machine API calls).
// Also runs the outbox poller and the stale-hold sweeper.
//
// Durability order (MNC-961 remediation): every conversation frame is
// persisted with an incremented version BEFORE any reply is sent, so a crash
// between save and send can at worst retry a send with the same provider
// message id, never lose a booking step. Version conflicts re-read and re-run
// the transition once.

import { createHash } from "node:crypto";
import { MachineClient, sleep } from "./machine.js";
import { WahaClient } from "./waha.js";
import { verifyHmacHex } from "./crypto.js";
import {
  transition,
  onPrepareResult,
  onClaimResult,
  proofResult,
  normalizeInbound,
  freshConversation,
} from "./state-machine.js";
import { detectLang, outboxText } from "./copy.js";

const SETTINGS_TTL_MS = 5 * 60 * 1000;
const VERSION_RETRY = 2;

function wahaMessageId(key) {
  return `3EB0${createHash("sha256").update(String(key)).digest("hex").slice(0, 16).toUpperCase()}`;
}

function bookingFromDraft(draft) {
  if (!draft || draft.status !== "pending_payment" || !draft.booking_group_id) return null;
  return {
    booking_id: draft.id,
    booking_group_id: draft.booking_group_id,
    payment_reference: draft.payment_reference,
    hold_expires_at: draft.hold_expires_at,
    total_amount: draft.total_amount,
    deposit_amount: draft.deposit_amount,
  };
}

export class Bridge {
  constructor(cfg, { machine, waha } = {}) {
    this.cfg = cfg;
    this.machine = machine ?? new MachineClient(cfg);
    this.waha = waha ?? new WahaClient(cfg);
    this.pollerRunning = false;
    this.sweeperRunning = false;
    this.settingsCache = { at: 0, value: null };
  }

  log(...args) {
    console.error("[bridge]", ...args);
  }

  // Owner-approved payment settings (fetched from Lovable Cloud, cached).
  // Returns { configured, paymentText(lang), qr } where qr is a Buffer.
  async getSettings(force = false) {
    if (
      !force &&
      this.settingsCache.value &&
      Date.now() - this.settingsCache.at < SETTINGS_TTL_MS
    ) {
      return this.settingsCache.value;
    }
    let s = { configured: false, paymentText: () => null, qr: null, qrMime: null };
    try {
      const res = await this.machine.getSettings();
      if (res?.ok && res.configured) {
        let qr = null;
        if (res.qr_url) {
          const r = await fetch(res.qr_url).catch(() => null);
          if (r?.ok) qr = Buffer.from(await r.arrayBuffer());
        }
        s = {
          configured: true,
          paymentText: (lang) =>
            (lang === "bm" ? res.payment_text_bm : res.payment_text_en) || null,
          qr,
          qrMime: res.qr_mime,
        };
      }
    } catch (e) {
      this.log("settings fetch failed, using fallback", e?.message ?? e);
    }
    this.settingsCache = { at: Date.now(), value: s };
    return s;
  }

  // -------------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------------

  async handleWebhook(rawBody, headers) {
    const digest = headers["x-webhook-hmac"];
    if (!verifyHmacHex(this.cfg.wahaWebhookHmacKey, rawBody, digest)) {
      throw { status: 401, message: "bad hmac" };
    }
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw { status: 400, message: "bad json" };
    }
    if (!event || typeof event !== "object") throw { status: 400, message: "bad payload" };
    if (event.event === "session.status" || event.event === "engine.event") {
      const payload = event.payload ?? event;
      const state = String(payload?.status ?? payload?.state ?? "UNKNOWN").slice(0, 40);
      const session =
        String(payload?.session ?? event.session ?? this.cfg.wahaSession ?? "").slice(0, 120) ||
        null;
      const error =
        typeof payload?.error === "string"
          ? payload.error.slice(0, 500)
          : typeof payload?.lastError === "string"
            ? payload.lastError.slice(0, 500)
            : null;
      if (this.machine.reportRuntime) {
        await this.machine.reportRuntime({ state, session, error }).catch((cause) => {
          this.log("runtime report failed", cause?.message ?? cause);
        });
      }
      this.log("system event", event.event, JSON.stringify(payload).slice(0, 300));
      return { handled: true, system: true };
    }
    const msg = normalizeInbound(event.payload ?? event, this.cfg.wahaSession);
    if (!msg.chatId || msg.isGroup || msg.fromMe) {
      return { handled: true, ignored: true };
    }
    await this.processMessage(msg);
    return { handled: true };
  }

  async processMessage(msg) {
    if (!msg.messageId) {
      this.log("message without id, ignoring (cannot dedupe)", JSON.stringify(msg).slice(0, 200));
      return;
    }
    let accepted = false;
    try {
      const claimed = await this.machine.claimEvent(
        msg.messageId ?? `ts-${msg.timestamp}`,
        msg.chatId,
        "message",
        {
          body: msg.body,
          hasMedia: msg.hasMedia,
          media: msg.media ?? null,
          timestamp: msg.timestamp,
        },
      );
      if (!claimed?.ok) {
        this.log("event claim failed, skipping", msg.messageId, claimed);
        return;
      }
      if (claimed.duplicate || !claimed.claimed) {
        if (claimed.pending) {
          const err = new Error(`event ${msg.messageId} is pending retry`);
          err.retryable = true;
          throw err;
        }
        return; // replay or out-of-order duplicate: no work
      }
      accepted = true;
      await this.processClaimedMessage(msg);
      // Durable lifecycle close: only after processing succeeds do we mark the
      // event processed. A crash or exhausted conflict before this point
      // leaves the row unprocessed and reclaimable.
      await this.machine.completeEvent(msg.messageId).catch((e) => {
        this.log("event complete failed", msg.messageId, e?.message ?? e);
      });
    } catch (err) {
      // Never let one bad message kill the loop. The event stays
      // unprocessed; the reclaim window re-delivers it later.
      this.log("processMessage error", err?.message ?? err, err?.stack?.slice(0, 500) ?? "");
      if (accepted) {
        await this.machine.releaseEvent(msg.messageId).catch((releaseErr) => {
          this.log("event release failed", msg.messageId, releaseErr?.message ?? releaseErr);
        });
      }
      if (accepted || err?.retryable) throw err;
    }
  }

  // Runs the transition with optimistic-concurrency retry on the version
  // chain: read -> transition -> persist -> THEN send effects.
  async processClaimedMessage(msg) {
    for (let attempt = 0; attempt < VERSION_RETRY; attempt++) {
      const snap = await this.machine.getState(msg.chatId);
      if (!snap?.ok) throw new Error("state get failed");
      const convRow = snap.conversation;
      const draft = snap.draft ?? null;
      if (convRow?.data && typeof convRow.data === "object" && convRow.data.staffPaused) {
        this.log("staff takeover active; leaving message for staff", msg.chatId, msg.messageId);
        return;
      }
      const convo = convRow
        ? {
            chatId: convRow.chat_id,
            state: convRow.state,
            data: convRow.data ?? {},
            lang: convRow.lang ?? detectLang(msg.body),
            failureCount: convRow.failure_count ?? 0,
            bookingGroupId: convRow.booking_group_id ?? null,
            version: convRow.version ?? 0,
          }
        : { ...freshConversation(msg.chatId), lang: detectLang(msg.body) };

      const { convo: next, effects } = transition(convo, msg, { draft });

      // Prepare/claim results mutate this same frame. Persist only the final
      // result so a failed nested save leaves the original inbound transition
      // replayable instead of stranding it in an intermediate state.
      const holdEffect = effects.find((eff) => eff.op === "prepare" || eff.op === "claim");
      if (holdEffect) {
        await this.runHoldStep(msg, next, holdEffect.op, draft);
        return;
      }
      if (effects.some((eff) => eff.op === "proof")) {
        await this.runProofStep(msg, next);
        return;
      }

      const saved = await this.saveConversation(next);
      if (saved?.conflict) {
        continue; // someone else advanced the chain: re-read, re-run
      }
      if (!saved?.ok) {
        throw new Error(`state put failed: ${saved?.error ?? "unknown"}`);
      }
      if (Number.isInteger(saved.version)) next.version = saved.version;

      // Frame is durable at the next version — now execute effects.
      for (const [index, eff] of effects.entries()) {
        if (eff.op === "send") {
          await this.sendEffect(msg.chatId, eff, wahaMessageId(`event:${msg.messageId}:${index}`));
        } else if (eff.op === "agent") {
          await this.machine
            .notifyAgent(msg.chatId, eff.note ?? null)
            .catch((e) => this.log("agent email failed", e));
        }
      }
      return;
    }
    throw new Error(`state conflict retry exhausted for ${msg.messageId}`);
  }

  // 'prepare' and 'claim' both follow the durable pattern: run the machine
  // call, apply the result to the frame, persist, then send.
  async runHoldStep(msg, convo, kind, existingDraft = null) {
    const settings = kind === "claim" ? await this.getSettings() : null;
    let res;
    if (kind === "prepare") {
      res = await this.machine
        .prepareHold({
          cabinType: convo.data.cabinType,
          checkIn: convo.data.checkIn,
          checkOut: convo.data.checkOut,
          comforter: convo.data.comforter,
          guests: convo.data.guests,
        })
        .catch((e) => {
          this.log("prepareHold failed", e?.message ?? e);
          return { ok: false };
        });
    } else {
      const recovered = bookingFromDraft(existingDraft);
      res = recovered
        ? { ok: true, claimed: true, booking: recovered }
        : await this.machine
            .claimHold({
              cabinId: convo.data.prepared?.cabinId,
              checkIn: convo.data.checkIn,
              checkOut: convo.data.checkOut,
              comforter: convo.data.comforter,
              guests: convo.data.guests,
              guestName: convo.data.guestName,
              phone: convo.data.phone,
              chatId: msg.chatId,
              subtotal: convo.data.prepared?.subtotal,
              comforterTotal: convo.data.prepared?.comforterTotal,
              discountId: convo.data.prepared?.discountId ?? null,
              discountCode: convo.data.prepared?.discountCode ?? null,
              discountAmount: convo.data.prepared?.discountAmount ?? 0,
            })
            .catch((e) => {
              this.log("claimHold failed", e?.message ?? e);
              return { ok: false };
            });
      if (res?.ok && !res.claimed) {
        const snap = await this.machine.getState(msg.chatId).catch(() => null);
        const raced = bookingFromDraft(snap?.draft);
        if (raced) res = { ok: true, claimed: true, booking: raced };
      }
    }

    const { convo: after, effects } =
      kind === "prepare"
        ? onPrepareResult(convo, res)
        : onClaimResult(
            convo,
            res,
            settings?.paymentText ? settings.paymentText(convo.lang) : null,
          );

    if (kind === "claim" && res?.ok && res?.claimed) {
      // Cache the booking reference so the proof-success message can carry it.
      this.draftRefCache = this.draftRefCache ?? {};
      this.draftRefCache[msg.chatId] = res.booking?.payment_reference ?? null;
    }

    const saved = await this.saveConversation(after);
    if (saved?.conflict) throw new Error(`post-${kind} state conflict`);
    if (!saved?.ok) throw new Error(`post-${kind} state put failed: ${saved?.error ?? "unknown"}`);
    if (Number.isInteger(saved.version)) after.version = saved.version;
    for (const [index, eff] of effects.entries()) {
      if (eff.op === "send") {
        await this.sendEffect(
          msg.chatId,
          eff,
          wahaMessageId(`event:${msg.messageId}:${kind}:${index}`),
        );
      }
    }
  }

  async runProofStep(msg, convo) {
    const outcome = await this.runProofPipeline(msg, convo);
    const { convo: after, effects } = proofResult(convo, outcome);
    const saved = await this.saveConversation(after);
    if (saved?.conflict) throw new Error("post-proof state conflict");
    if (!saved?.ok) throw new Error(`post-proof state put failed: ${saved?.error ?? "unknown"}`);
    if (Number.isInteger(saved.version)) after.version = saved.version;
    for (const [index, eff] of effects.entries()) {
      if (eff.op === "send") {
        await this.sendEffect(
          msg.chatId,
          eff,
          wahaMessageId(`event:${msg.messageId}:proof:${index}`),
        );
      }
    }
  }

  async sendEffect(chatId, eff, messageId) {
    // Settings-driven QR image (owner-approved, fetched from protected
    // Lovable Cloud config — never from a committed asset).
    if (eff.image === "qr") {
      const s = await this.getSettings();
      if (s.configured && s.paymentText && s.qr) {
        await this.waha.sendImage(chatId, s.qr, s.qrMime, "payment-qr", eff.text, messageId);
        return;
      }
      // No approved QR yet: text-only instructions; the methods block already
      // says staff will send payment details. Never fabricate bank details.
      await this.waha.sendText(chatId, eff.text, messageId);
      return;
    }
    await this.waha.sendText(chatId, eff.text, messageId);
  }

  async saveConversation(convo) {
    try {
      const res = await this.machine.putState({
        chatId: convo.chatId,
        state: convo.state,
        data: convo.data,
        lang: convo.lang,
        failureCount: convo.failureCount,
        bookingGroupId: convo.bookingGroupId ?? null,
        version: convo.version,
      });
      return res ?? { ok: false };
    } catch (e) {
      this.log("putState failed", e?.message ?? e);
      return { ok: false, error: e?.message ?? String(e) };
    }
  }

  // -------------------------------------------------------------------------
  // Proof pipeline: WAHA media -> app storage (private bucket)
  // -------------------------------------------------------------------------

  async runProofPipeline(msg, convo) {
    const media = msg.media;
    if (!media?.url) return "fetchFailed";
    const gid = convo.bookingGroupId;
    if (!gid) {
      // Media arrived with no live draft — a booking no longer exists.
      return "received";
    }
    let buffer;
    let mime = media.mime ?? "application/octet-stream";
    try {
      const dl = await this.waha.downloadMedia(media.url);
      buffer = dl.buffer;
      if (dl.contentType && dl.contentType !== "application/octet-stream") mime = dl.contentType;
    } catch (e) {
      this.log("media download failed", e?.message ?? e);
      return "fetchFailed";
    }
    if (buffer.byteLength > this.cfg.maxProofBytes) return "tooLarge";
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(mime)) return "badType";

    const up = await this.machine
      .proofUploadUrl({
        chatId: msg.chatId,
        bookingGroupId: gid,
        waMessageId: msg.messageId,
        mime,
        bytes: buffer.byteLength,
      })
      .catch((e) => {
        this.log("proofUploadUrl failed", e?.message ?? e);
        return { ok: false };
      });
    if (up.ok === false) return "fetchFailed";
    if (up.duplicate) return { kind: "duplicate" };
    if (!up.upload_url) return "fetchFailed";

    const putRes = await fetch(up.upload_url, {
      method: "PUT",
      headers: { "Content-Type": mime },
      body: buffer,
    }).catch(() => null);
    if (!putRes || !putRes.ok) {
      this.log("proof upload PUT failed", putRes?.status);
      return "fetchFailed";
    }
    const att = await this.machine
      .proofAttach({
        chatId: msg.chatId,
        waMessageId: msg.messageId,
        filePath: up.path,
        mime,
        bytes: buffer.byteLength,
      })
      .catch((e) => {
        this.log("proofAttach failed", e?.message ?? e);
        return { ok: false };
      });
    if (att?.ok && att.attached) {
      // Success message must carry the booking reference: prefer the live
      // draft, fall back to the reference cached at claim time.
      const snap = await this.machine.getState(msg.chatId).catch(() => null);
      const ref = snap?.draft?.payment_reference ?? this.draftRefCache?.[msg.chatId] ?? null;
      return ref ? { kind: "received", ref } : "received";
    }
    return "fetchFailed";
  }

  // -------------------------------------------------------------------------
  // Outbox: staff decisions + expiry notices delivered through WAHA
  // -------------------------------------------------------------------------

  async pollOutboxOnce() {
    let rows = [];
    try {
      const res = await this.machine.outboxClaim(this.cfg.outboxClaimBatch);
      rows = (res?.ok && Array.isArray(res.rows) && res.rows) || [];
    } catch (e) {
      this.log("outbox claim failed", e?.message ?? e);
      return;
    }
    for (const row of rows) {
      try {
        const text = outboxText(row.kind, await this.langForChat(row.chat_id), row.payload ?? {});
        if (text === null) {
          await this.machine.outboxAck(row.id, false, { error: `unknown kind ${row.kind}` });
          continue;
        }
        const sent = await this.waha.sendText(row.chat_id, text, wahaMessageId(`outbox:${row.id}`));
        await this.machine.outboxAck(row.id, true, { waMessageId: sent?.id ?? null });
        this.log("outbox sent", row.kind, row.chat_id);
      } catch (e) {
        this.log("outbox send failed", row.kind, e?.message ?? e);
        await this.machine
          .outboxAck(row.id, false, { error: (e?.message ?? "send failed").slice(0, 500) })
          .catch(() => {});
      }
    }
  }

  async langForChat(chatId) {
    try {
      const snap = await this.machine.getState(chatId);
      return snap?.conversation?.lang ?? "en";
    } catch {
      return "en";
    }
  }

  // -------------------------------------------------------------------------
  // Stale holds: expire and notify (idempotent on both sides)
  // -------------------------------------------------------------------------

  async sweepStaleHolds() {
    let expired = [];
    try {
      const res = await this.machine.sweepHolds();
      expired = (res?.ok && Array.isArray(res.expired) && res.expired) || [];
    } catch (e) {
      this.log("sweep failed", e?.message ?? e);
      return;
    }
    for (const row of expired) {
      if (!row.chat_id || !row.booking_group_id) continue;
      try {
        await this.machine.outboxEnqueue({
          chatId: row.chat_id,
          kind: "hold-expired",
          dedupeKey: `hold-expired-${row.booking_group_id}`,
          payload: {},
        });
        this.log("hold expired, notice enqueued", row.chat_id);
      } catch (e) {
        this.log("hold notice enqueue failed", row.chat_id, e?.message ?? e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Loops
  // -------------------------------------------------------------------------

  async startPollers() {
    if (!this.pollerRunning) {
      this.pollerRunning = true;
      this.pollLoop().finally(() => {
        this.pollerRunning = false;
      });
    }
    if (!this.sweeperRunning) {
      this.sweeperRunning = true;
      this.sweepLoop().finally(() => {
        this.sweeperRunning = false;
      });
    }
  }

  async pollLoop() {
    while (this.pollerRunning) {
      await this.pollOutboxOnce();
      await sleep(this.cfg.outboxPollMs);
    }
  }

  async sweepLoop() {
    while (this.sweeperRunning) {
      await this.sweepStaleHolds();
      await sleep(this.cfg.sweepIntervalMs);
    }
  }

  stop() {
    this.pollerRunning = false;
    this.sweeperRunning = false;
  }
}
