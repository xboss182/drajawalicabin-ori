import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingStatus,
  handoffActions,
  holdStatus,
  isHandoffConversation,
  runtimeStatus,
  whatsappBookingHref,
} from "../src/lib/whatsapp-ui.ts";
import { freshConversation, transition } from "../wa-bridge/src/state-machine.js";

const chatId = "60123456789@s.whatsapp.net";
const inbound = (body: string) => ({
  chatId,
  body,
  fromMe: false,
  hasMedia: false,
  isGroup: false,
});

test("WhatsApp entry uses a configured number and the minimal Book message", () => {
  assert.equal(whatsappBookingHref("+60 12 345 6789"), "https://wa.me/60123456789?text=Book");
  assert.equal(whatsappBookingHref("123"), null);
});

test("WhatsApp entry preserves a supplied booking follow-up message", () => {
  assert.equal(
    whatsappBookingHref("+60 12 345 6789", "Hi Aina — booking RJW-1234"),
    "https://wa.me/60123456789?text=Hi%20Aina%20%E2%80%94%20booking%20RJW-1234",
  );
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

test("direct staff requests remain in the handoff queue without a booking", () => {
  for (const request of ["3", "agent please"]) {
    const direct = transition(freshConversation(chatId), inbound(request)).convo;
    assert.equal(direct.state, "AGENT");
    assert.equal(direct.bookingGroupId, null);
    assert.equal(isHandoffConversation(direct.state, false, direct.failureCount), true);
  }
});

test("invalid-input escalation remains in the handoff queue without a booking", () => {
  let escalated = { ...freshConversation(chatId), state: "DATES" };
  for (let count = 0; count < 3; count += 1) {
    escalated = transition(escalated, inbound("not a date")).convo;
  }
  assert.equal(escalated.state, "AGENT");
  assert.equal(escalated.bookingGroupId, null);
  assert.equal(isHandoffConversation(escalated.state, false, escalated.failureCount), true);
});
