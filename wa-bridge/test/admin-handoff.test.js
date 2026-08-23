import assert from "node:assert/strict";
import test from "node:test";

import { freshConversation, transition } from "../src/state-machine.js";

const chatId = "60123456789@s.whatsapp.net";

test("paused conversations ignore customer commands until staff resumes them", () => {
  const paused = freshConversation(chatId);
  paused.state = "AGENT";
  paused.data.staffPaused = true;

  const whilePaused = transition(paused, {
    chatId,
    body: "menu",
    hasMedia: false,
  });
  assert.equal(whilePaused.convo.state, "AGENT");
  assert.deepEqual(whilePaused.effects, []);

  paused.state = "MENU";
  paused.data.staffPaused = false;
  const afterResume = transition(paused, {
    chatId,
    body: "menu",
    hasMedia: false,
  });
  assert.equal(afterResume.convo.state, "MENU");
  assert.equal(afterResume.effects.length, 1);
});
