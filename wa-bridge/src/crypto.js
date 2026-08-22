// HMAC helpers shared by contract with
// src/lib/wa/machine-auth.server.ts in the app. If you change the scheme
// here, change it there too (and vice versa).

import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function signRequest(secret, keyId, ts, nonce, rawBody) {
  return createHmac("sha256", secret)
    .update(`${keyId}.${ts}.${nonce}.${sha256Hex(rawBody)}`)
    .digest("hex");
}

export function newNonce() {
  return randomBytes(16).toString("hex");
}

export function verifyHmacHex(secret, rawBody, hexDigest) {
  if (typeof hexDigest !== "string" || !/^[a-f0-9]+$/i.test(hexDigest)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hexDigest.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}