import { createFileRoute } from "@tanstack/react-router";

import { PublicWhatsAppBookingEntry } from "@/components/public-whatsapp-booking-entry";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book in WhatsApp — Rajawali D'Cabin" },
      {
        name: "description",
        content: "Start your Rajawali D'Cabin booking in WhatsApp.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicWhatsAppBookingEntry,
});
