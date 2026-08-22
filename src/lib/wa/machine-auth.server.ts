// Machine-to-machine authentication for the VPS WA booking bridge
// (MNC-961). Mirrors the Stripe webhook pattern: every /api/machine/* call
// must carry an HMAC signature over the raw body plus timestamp + nonce.
// The nonce is recorded in public.wa_nonces so replayed requests are
// rejected even within the timestamp window.
//
// Contract (shared with wa-bridge/src/crypto.js):
//   headers: x-wa-key  = machine key id ("wa-bridge-v1")
//            x-wa-ts   = unix milliseconds
//            x-wa-nonce = random hex (16+ chars)
//            x-wa-sig  = hex hmac-sha256(secret,
//                          `${keyId}.${ts}.${nonce}.${sha256Hex(body)}`)
//   Window: ts must be within ±WA_MACHINE_SKEW_MS (default 5 min) of now.

import { createHmac, timingSafeEqual, createHash } from "node:crypto";

const MACHINE_KEY_ID = process.env.WA_MACHINE_KEY_ID ?? "wa-bridge-v1";
const SKEW_MS = 5 * 60 * 1000;

function secret(): string {
  return process.env.WA_MACHINE_SECRET ?? "";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function signMachineRequest(secretValue: string, keyId: string, ts: number, nonce: string, rawBody: string): string {
  return createHmac("sha256", secretValue)
    .update(`${keyId}.${ts}.${nonce}.${sha256Hex(rawBody)}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type MachineAuthResult =
  | { ok: true }
  | { ok: false; response: Response };

export async function verifyMachineRequest(req: Request): Promise<MachineAuthResult> {
  const s = secret();
  if (!s) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "WA_MACHINE_SECRET is not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const keyId = req.headers.get("x-wa-key") ?? "";
  const tsRaw = req.headers.get("x-wa-ts") ?? "";
  const nonce = req.headers.get("x-wa-nonce") ?? "";
  const sig = req.headers.get("x-wa-sig") ?? "";
  const rawBody = await req.clone().text();

  if (!keyId || !tsRaw || !nonce || !sig) {
    return { ok: false, response: unauthorized("missing machine auth headers") };
  }
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SKEW_MS) {
    return { ok: false, response: unauthorized("timestamp outside window") };
  }
  if (!/^[a-f0-9]{16,64}$/.test(nonce)) {
    return { ok: false, response: unauthorized("bad nonce") };
  }

  const expected = signMachineRequest(s, keyId, ts, nonce, rawBody);
  if (!safeEqual(expected, sig.toLowerCase())) {
    return { ok: false, response: unauthorized("bad signature") };
  }
  if (keyId !== MACHINE_KEY_ID) {
    return { ok: false, response: unauthorized("unknown machine key") };
  }

  // Replay protection: first writer of (key, nonce) wins.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("wa_nonces")
    .insert({ key_id: keyId, nonce, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    .select("key_id");
  if (error || !data || data.length === 0) {
    return { ok: false, response: unauthorized("replayed nonce") };
  }

  // Opportunistic cleanup of expired nonces (best effort).
  try {
    await supabaseAdmin.from("wa_nonces").delete().lt("expires_at", new Date().toISOString());
  } catch {
    // ignore cleanup failures
  }

  return { ok: true };
}

function unauthorized(reason: string): Response {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized", reason }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}