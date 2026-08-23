import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingStatus,
  handoffActions,
  holdStatus,
  runtimeStatus,
  whatsappBookingHref,
} from "../src/lib/whatsapp-ui.ts";

test("WhatsApp entry uses a configured number and the minimal Book message", () => {
  assert.equal(whatsappBookingHref("+60 12 345 6789"), "https://wa.me/60123456789?text=Book");
  assert.equal(whatsappBookingHref("123"), null);
});

test("booking and runtime states have explicit text labels", () => {
  assert.deepEqual(bookingStatus("awaiting_review"), {
    label: "Proof awaiting review",
    tone: "review",
  });
  assert.deepEqual(runtimeStatus("SCAN_QR_CODE"), {
    label: "WAHA needs QR pairing",
    tone: "review",
  });
  assert.deepEqual(runtimeStatus("OFFLINE"), {
    label: "WAHA offline",
    tone: "expired",
  });
});

test("expired holds and bot handoff controls are explicit", () => {
  assert.deepEqual(holdStatus("2020-01-01T00:00:00.000Z", Date.now()), {
    label: "Hold expired",
    expired: true,
  });
  assert.deepEqual(handoffActions(false), ["pause", "takeover"]);
  assert.deepEqual(handoffActions(true), ["resume"]);
});
