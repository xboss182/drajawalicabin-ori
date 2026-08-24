// WAHA REST client (thin). WAHA lives on the same VPS behind a private
// network / reverse proxy; the API key never reaches the browser or the app.

import { sleep } from "./machine.js";

export class WahaClient {
  constructor(cfg, fetchImpl = globalThis.fetch) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl;
    this.lastSendAt = 0;
  }

  _headers(extra = {}) {
    return {
      "X-Api-Key": this.cfg.wahaApiKey,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  // Outbound rate guard: WhatsApp punishes aggressive automated sending even
  // inside a customer-initiated window (per WAHA "How to avoid blocking").
  async _pace() {
    const wait = this.cfg.sendGapMs - (Date.now() - this.lastSendAt);
    if (wait > 0) await sleep(wait);
    this.lastSendAt = Date.now();
  }

  async _post(path, body, headersExtra = {}) {
    await this._pace();
    const res = await this.fetchImpl(`${this.cfg.wahaUrl}${path}`, {
      method: "POST",
      headers: this._headers(headersExtra),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`waha ${path} -> ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json().catch(() => ({}));
  }

  async sendText(chatId, text, id = null) {
    return this._post("/api/sendText", {
      session: this.cfg.wahaSession,
      chatId,
      text,
      ...(id ? { id } : {}),
    });
  }

  // Sends an image from a buffer (payment QR, etc). Uses multipart so the
  // bridge container does not need a shared volume with the WAHA container.
  async sendImage(chatId, buffer, mime, filename, caption = "", id = null) {
    await this._pace();
    const form = new FormData();
    form.append("session", this.cfg.wahaSession);
    form.append("chatId", chatId);
    form.append("caption", caption);
    if (id) form.append("id", id);
    form.append("file", new Blob([buffer], { type: mime || "image/png" }), filename);
    const res = await this.fetchImpl(`${this.cfg.wahaUrl}/api/sendImage`, {
      method: "POST",
      headers: { "X-Api-Key": this.cfg.wahaApiKey },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`waha /api/sendImage -> ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json().catch(() => ({}));
  }

  // Downloads inbound media. `url` comes from the webhook payload
  // (payload.media.url); authenticate with the same API key.
  async downloadMedia(url) {
    const res = await this.fetchImpl(url, {
      headers: { "X-Api-Key": this.cfg.wahaApiKey },
    });
    if (!res.ok) {
      throw new Error(`waha media -> ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType, status: res.status };
  }
}
