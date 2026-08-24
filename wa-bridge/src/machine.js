// Lovable Cloud machine API client. Every call is HMAC-signed
// (see crypto.js / machine-auth.server.ts in the app) and retried on
// transient failures. 4xx responses are never retried.

import { signRequest, newNonce } from "./crypto.js";

export class MachineClient {
  constructor(cfg, fetchImpl = globalThis.fetch) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl;
    this.log = (...args) => console.error("[machine]", ...args);
  }

  async call(path, body, { retries = 3 } = {}) {
    const rawBody = JSON.stringify(body ?? {});
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        await sleep(300 * 2 ** (attempt - 1));
      }
      const ts = Date.now();
      const nonce = newNonce();
      const sig = signRequest(this.cfg.machineSecret, this.cfg.machineKeyId, ts, nonce, rawBody);
      let res;
      try {
        res = await this.fetchImpl(`${this.cfg.machineUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wa-key": this.cfg.machineKeyId,
            "x-wa-ts": String(ts),
            "x-wa-nonce": nonce,
            "x-wa-sig": sig,
          },
          body: rawBody,
        });
      } catch (e) {
        lastErr = e;
        continue;
      }
      if (res.ok) {
        return await res.json().catch(() => ({ ok: true }));
      }
      if (res.status >= 400 && res.status < 500) {
        const text = await res.text().catch(() => "");
        const err = new Error(`machine ${path} -> ${res.status}: ${text.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
      lastErr = new Error(`machine ${path} -> ${res.status}`);
    }
    throw lastErr ?? new Error(`machine ${path} failed`);
  }

  claimEvent(eventId, chatId, type, payload) {
    return this.call("/api/machine/wa/events/claim", {
      event_id: eventId,
      chat_id: chatId,
      type,
      payload,
    });
  }

  completeEvent(eventId) {
    return this.call("/api/machine/wa/events/complete", { event_id: eventId });
  }

  releaseEvent(eventId) {
    return this.call("/api/machine/wa/events/complete", { event_id: eventId, release: true });
  }

  getSettings() {
    return this.call("/api/machine/wa/settings/get", {});
  }

  getState(chatId) {
    return this.call("/api/machine/wa/state/get", { chat_id: chatId });
  }

  putState(snapshot) {
    return this.call("/api/machine/wa/state/put", {
      chat_id: snapshot.chatId,
      state: snapshot.state,
      data: snapshot.data,
      lang: snapshot.lang,
      failure_count: snapshot.failureCount,
      booking_group_id: snapshot.bookingGroupId ?? null,
      version: snapshot.version,
    });
  }

  prepareHold({ cabinType, checkIn, checkOut, comforter, guests }) {
    return this.call("/api/machine/wa/holds/prepare", {
      cabin_type: cabinType,
      check_in: checkIn,
      check_out: checkOut,
      comforter,
      guests,
    });
  }

  claimHold(args) {
    return this.call("/api/machine/wa/holds/claim", {
      cabin_id: args.cabinId,
      check_in: args.checkIn,
      check_out: args.checkOut,
      comforter: args.comforter,
      guests: args.guests,
      guest_name: args.guestName,
      phone: args.phone,
      chat_id: args.chatId,
      subtotal: args.subtotal,
      comforter_total: args.comforterTotal,
      discount_id: args.discountId ?? null,
      discount_code: args.discountCode ?? null,
      discount_amount: args.discountAmount ?? 0,
    });
  }

  sweepHolds() {
    return this.call("/api/machine/wa/holds/expire-sweep", {});
  }

  proofUploadUrl({ chatId, bookingGroupId, waMessageId, mime, bytes }) {
    return this.call("/api/machine/wa/proofs/upload-url", {
      chat_id: chatId,
      booking_group_id: bookingGroupId,
      wa_message_id: waMessageId,
      mime,
      bytes,
    });
  }

  proofAttach({ chatId, waMessageId, filePath, mime, bytes }) {
    return this.call("/api/machine/wa/proofs/attach", {
      chat_id: chatId,
      wa_message_id: waMessageId,
      file_path: filePath,
      mime,
      bytes,
    });
  }

  outboxEnqueue({ chatId, kind, dedupeKey, payload }) {
    return this.call("/api/machine/wa/outbox/enqueue", {
      chat_id: chatId,
      kind,
      dedupe_key: dedupeKey,
      payload,
    });
  }

  outboxClaim(batch) {
    return this.call("/api/machine/wa/outbox/claim", { batch });
  }

  outboxAck(id, ok, extra = {}) {
    return this.call("/api/machine/wa/outbox/ack", {
      id,
      ok,
      wa_message_id: extra.waMessageId ?? null,
      error: extra.error ?? null,
    });
  }

  notifyAgent(chatId, note) {
    return this.call("/api/machine/wa/agent", { chat_id: chatId, note: note ?? null });
  }

  reportRuntime({ state, session, error = null }) {
    return this.call("/api/machine/wa/runtime/report", {
      state,
      session: session ?? null,
      error,
    });
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
