import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("web booking keeps its checkout flow and adds WhatsApp", async () => {
  const book = await source("src/routes/book.tsx");

  assert.match(book, /component:\s*BookPage/);
  assert.match(book, /\bcreateBooking\b/);
  assert.match(book, /\battachPaymentProof\b/);
  assert.match(book, /type Step = "details" \| "payment" \| "done"/);
  assert.match(book, /<BookInWhatsAppLink\b/);
});

test("home search opens web booking while WhatsApp remains separate", async () => {
  const home = await source("src/routes/index.tsx");

  assert.match(home, /<AvailabilitySearch\s*\/>/);
  assert.match(home, /to:\s*"\/book"/);
  assert.match(home, /<BookInWhatsAppLink\b/);
});

test("guide and WhatsApp entry preserve both booking channels", async () => {
  const [guide, whatsappEntry] = await Promise.all([
    source("src/routes/booking-guide.tsx"),
    source("src/components/public-whatsapp-booking-entry.tsx"),
  ]);

  assert.match(guide, /component:\s*BookingGuidePage/);
  assert.match(guide, /<BookInWhatsAppLink\b/);
  assert.match(whatsappEntry, /to="\/whatsapp-store"/);
});
