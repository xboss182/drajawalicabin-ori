// Bridge orchestrator: WAHA webhooks -> event claim -> conversation state ->
// state machine -> effects (WAHA sends + machine API calls) -> state save.
// Also runs the outbox poller and the stale-hold sweeper.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
export const QR_ASSET_PATH = join(ROOT, "assets", "duitnow-qr.png");

export class Bridge {
  constructor(cfg, { machine, waha } = {}) {
    this.cfg = cfg;
    this.machine = machine ?? new MachineClient(cfg);
    this.waha = waha ?? new WahaClient(cfg);
    this.pollerRunning = false;
    this.sweeperRunning = false;
  }

  log(...args) {
    console.error("[bridge]", ...args);
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
      this.log("system event", event.event, JSON.stringify(event.payload ?? event).slice(0, 300));
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
    try {
      const claimed = await this.machine.claimEvent(msg.messageId ?? `ts-${msg.timestamp}`, msg.chatId, "message", {
        body: msg.body,
        hasMedia: msg.hasMedia,
        media: msg.media ?? null,
        timestamp: msg.timestamp,
      });
      if (!claimed?.ok) {
        this.log("event claim failed, skipping", msg.messageId, claimed);
        return;
      }
      if (claimed.duplicate || !claimed.claimed) {
        return; // replay or out-of-order duplicate: no work
      }

      const snap = await this.machine.getState(msg.chatId);
      const convRow = snap?.ok ? snap.conversation : null;
      const draft = snap?.ok ? snap.draft ?? null : null;
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

      // Execute effects in order; proof pipelines and booking ops can re-enter.
      for (const eff of effects) {
        if (eff.op === "send") {
          await this.sendEffect(msg.chatId, eff);
        } else if (eff.op === "agent") {
          await this.machine.notifyAgent(msg.chatId, eff.note ?? null).catch((e) => this.log("agent email failed", e));
        } else if (eff.op === "prepare") {
          const res = await this.machine.prepareHold({
            cabinType: next.data.cabinType,
            checkIn: next.data.checkIn,
            checkOut: next.data.checkOut,
            comforter: next.data.comforter,
            guests: next.data.guests,
          }).catch((e) => {
            this.log("prepareHold failed", e);
            return { ok: false };
          });
          const more = onPrepareResult(next, res);
          for (const mEff of more.effects) {
            if (mEff.op === "send") await this.sendEffect(msg.chatId, mEff).catch((e) => this.log("send failed", e));
          }
        } else if (eff.op === "claim") {
          const p = next.data.prepared ?? {};
          const res = await this.machine.claimHold({
            cabinId: p.cabinId,
            checkIn: next.data.checkIn,
            checkOut: next.data.checkOut,
            comforter: next.data.comforter,
            guests: next.data.guests,
            guestName: next.data.guestName,
            phone: next.data.phone,
            chatId: msg.chatId,
            subtotal: p.subtotal,
            comforterTotal: p.comforterTotal,
            discountId: p.discountId ?? null,
            discountCode: p.discountCode ?? null,
            discountAmount: p.discountAmount ?? 0,
          }).catch((e) => {
            this.log("claimHold failed", e);
            return { ok: false };
          });
          const more = onClaimResult(next, res);
          for (const mEff of more.effects) {
            if (mEff.op === "send") await this.sendEffect(msg.chatId, mEff).catch((e) => this.log("send failed", e));
          }
        } else if (eff.op === "proof") {
          const outcome = await this.runProofPipeline(msg, next);
          const more = proofResult(next, outcome);
          for (const mEff of more.effects) {
            if (mEff.op === "send") await this.sendEffect(msg.chatId, mEff).catch((e) => this.log("send failed", e));
          }
        }
      }

      // Persist the conversation frame (last write wins per version chain).
      await this.saveConversation(next, msg);
    } catch (err) {
      // Never let one bad message kill the loop; WAHA will retry delivery.
      this.log("processMessage error", err?.message ?? err, err?.stack?.slice(0, 500) ?? "");
    }
  }

  async sendEffect(chatId, eff) {
    if (eff.image) {
      let buf;
      try {
        buf = await readFile(join(ROOT, eff.image));
      } catch {
        this.log("missing image asset", eff.image, "falling back to text");
        await this.waha.sendText(chatId, eff.text);
        return;
      }
      const isJpeg = eff.image.toLowerCase().endsWith(".jpg") || eff.image.toLowerCase().endsWith(".jpeg");
      await this.waha.sendImage(chatId, buf, isJpeg ? "image/jpeg" : "image/png", eff.image.split("/").pop(), eff.text);
      return;
    }
    await this.waha.sendText(chatId, eff.text);
  }

  async saveConversation(convo, msg) {
    try {
      await this.machine.putState({
        chatId: convo.chatId,
        state: convo.state,
        data: convo.data,
        lang: convo.lang,
        failureCount: convo.failureCount,
        bookingGroupId: convo.bookingGroupId ?? null,
        version: convo.version,
      });
    } catch (e) {
      this.log("putState failed", e?.message ?? e);
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
    if (up.duplicate) return "duplicate";
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
    return att?.ok ? "received" : "fetchFailed";
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
        const sent = await this.waha.sendText(row.chat_id, text);
        await this.machine.outboxAck(row.id, true, { waMessageId: sent?.id ?? null });
        this.log("outbox sent", row.kind, row.chat_id);
      } catch (e) {
        this.log("outbox send failed", row.kind, e?.message ?? e);
        await this.machine.outboxAck(row.id, false, { error: (e?.message ?? "send failed").slice(0, 500) }).catch(() => {});
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