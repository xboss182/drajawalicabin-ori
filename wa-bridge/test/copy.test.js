import assert from "node:assert/strict";
import test from "node:test";

import { outboxText } from "../src/copy.js";

test("staff messages and rejection reasons reach the guest", () => {
  assert.equal(
    outboxText("staff-message", "en", {
      message: "Please send a clearer receipt.",
    }),
    "Please send a clearer receipt.",
  );
  assert.match(
    outboxText("staff-resubmit", "en", {
      reference: "RJW-42",
      reason: "The reference number is unreadable.",
    }),
    /The reference number is unreadable/,
  );
});
