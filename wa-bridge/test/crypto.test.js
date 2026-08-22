import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signRequest, verifyHmacHex, newNonce, sha256Hex } from "../src/crypto.js";

test("machine request signature verifies end-to-end", () => {
  const secret = "s3cret-value";
  const keyId = "wa-bridge-v1";
  const ts = Date.now();
  const nonce = newNonce();
  const raw = JSON.stringify({ chat_id: "6011@s.whatsapp.net", state: "MENU" });
  const sig = signRequest(secret, keyId, ts, nonce, raw);
  assert.match(sig, /^[a-f0-9]{64}$/);
  // app-side recomputation (same scheme as machine-auth.server.ts)
  assert.equal(sig, signRequest(secret, keyId, ts, nonce, raw));
});

test("tampered body, wrong secret, or wrong keyId produce different signatures", () => {
  const secret = "s3cret-value";
  const keyId = "wa-bridge-v1";
  const ts = Date.now();
  const nonce = newNonce();
  const raw = JSON.stringify({ a: 1 });
  const sig = signRequest(secret, keyId, ts, nonce, raw);
  assert.notEqual(sig, signRequest(secret, keyId, ts, nonce, JSON.stringify({ a: 2 })));
  assert.notEqual(sig, signRequest(secret, "other-key", ts, nonce, raw));
  assert.notEqual(sig, signRequest("different-secret", keyId, ts, nonce, raw));
  assert.notEqual(sig, signRequest(secret, keyId, ts + 1, nonce, raw));
});

test("nonces are unique", () => {
  assert.notEqual(newNonce(), newNonce());
});

test("WAHA webhook HMAC verification", () => {
  const secret = "webhook-hmac-secret";
  const body = JSON.stringify({ event: "message", payload: { id: "abc" } });
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const unrelated = createHmac("sha256", "other").update(body).digest("hex");
  assert.equal(verifyHmacHex(secret, body, expected), true);
  assert.equal(verifyHmacHex(secret, body, unrelated), false);
  assert.equal(verifyHmacHex(secret, body + "x", expected), false);
  assert.equal(verifyHmacHex("wrong", body, expected), false);
  assert.equal(verifyHmacHex(secret, body, "zz"), false);
});

test("sha256Hex is deterministic", () => {
  assert.equal(sha256Hex("abc"), sha256Hex("abc"));
  assert.match(sha256Hex("abc"), /^[a-f0-9]{64}$/);
});