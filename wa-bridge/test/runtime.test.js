import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { Bridge } from "../src/runner.js";

test("WAHA session events are reported through the machine API", async () => {
  const reports = [];
  const bridge = new Bridge(
    {
      wahaWebhookHmacKey: "hmac",
      wahaSession: "default",
    },
    {
      machine: {
        reportRuntime: async (report) => {
          reports.push(report);
          return { ok: true };
        },
      },
    },
  );
  const body = JSON.stringify({
    event: "session.status",
    session: "default",
    payload: { status: "SCAN_QR_CODE", session: "default" },
  });
  const signature = createHmac("sha256", "hmac").update(body).digest("hex");

  await bridge.handleWebhook(body, { "x-webhook-hmac": signature });

  assert.deepEqual(reports, [{ state: "SCAN_QR_CODE", session: "default", error: null }]);
});
