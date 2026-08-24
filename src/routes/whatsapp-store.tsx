import { createFileRoute } from "@tanstack/react-router";

import { PublicWhatsAppBookingEntry } from "@/components/public-whatsapp-booking-entry";

export const Route = createFileRoute("/whatsapp-store")({
  head: () => ({
    meta: [
      { title: "Book in WhatsApp — Rajawali D'Cabin" },
      {
        name: "description",
        content: "Start your Rajawali D'Cabin booking in WhatsApp.",
      },
    ],
  }),
  component: PublicWhatsAppBookingEntry,
});
