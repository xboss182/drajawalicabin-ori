// Environment configuration for the WA booking bridge (MNC-961).
// Nothing here may ever ship to the browser; this process runs on the VPS
// next to WAHA. Secrets come from the environment, never from Git.

function fail(name) {
  throw new Error(`Missing required env var: ${name}`);
}

export function loadConfig(env = process.env) {
  const cfg = {
    // WAHA (self-hosted, NOT publicly exposed; reachable on private net)
    wahaUrl: (env.WAHA_URL ?? "").replace(/\/+$/, "") || fail("WAHA_URL"),
    wahaApiKey: env.WAHA_API_KEY || fail("WAHA_API_KEY"),
    wahaSession: env.WAHA_SESSION || "default",
    // HMAC key WAHA signs webhooks with (same value as session webhook hmac.key)
    wahaWebhookHmacKey: env.WAHA_WEBHOOK_HMAC_KEY || fail("WAHA_WEBHOOK_HMAC_KEY"),

    // Lovable app machine API (source of truth)
    machineUrl: (env.MACHINE_URL ?? "https://drajawalicabin.com").replace(/\/+$/, ""),
    machineSecret: env.WA_MACHINE_SECRET || fail("WA_MACHINE_SECRET"),
    machineKeyId: env.WA_MACHINE_KEY_ID ?? "wa-bridge-v1",

    // Bridge
    port: Number(env.BRIDGE_PORT ?? 8080),
    outboxPollMs: Number(env.OUTBOX_POLL_MS ?? 1500),
    outboxClaimBatch: Math.min(25, Number(env.OUTBOX_CLAIM_BATCH ?? 10)),
    sweepIntervalMs: Number(env.SWEEP_INTERVAL_MS ?? 60000),
    maxProofBytes: Number(env.MAX_PROOF_BYTES ?? 10 * 1024 * 1024),
    // Minimum gap between outbound WAHA messages for this session (ms).
    sendGapMs: Number(env.SEND_GAP_MS ?? 250),
    // Months in the (single) message-copy calendar supported by the parser.
  };
  if (!Number.isFinite(cfg.port) || cfg.port < 1 || cfg.port > 65535) fail("BRIDGE_PORT");
  return cfg;
}