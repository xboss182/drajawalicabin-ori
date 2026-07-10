import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import step1 from "@/assets/booking-guide/step-1-dates.jpg.asset.json";
import step2 from "@/assets/booking-guide/step-2-add-room.jpg.asset.json";
import step3 from "@/assets/booking-guide/step-3-details.jpg.asset.json";
import step4 from "@/assets/booking-guide/step-4-checkout.jpg.asset.json";

export const Route = createFileRoute("/booking-guide")({
  head: () => ({
    meta: [
      { title: "How to Book — Rajawali D'Cabin Chalet" },
      {
        name: "description",
        content:
          "Step-by-step visual guide to booking your stay at Rajawali D'Cabin, with tips for large groups of 12+ guests. Download as PDF.",
      },
      { property: "og:title", content: "How to Book — Rajawali D'Cabin Chalet" },
      {
        property: "og:description",
        content:
          "Step-by-step visual guide to booking rooms, plus large-group tips (12+ guests).",
      },
    ],
  }),
  component: BookingGuidePage,
});

type Step = {
  n: string;
  title: string;
  desc: string;
  bullets: string[];
  image: string;
  callout?: { title: string; body: string };
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Select dates & initial guests",
    desc: "Open the booking page and choose your check-in and check-out dates on the calendar, then enter how many adults and children (under 12) will stay.",
    bullets: [
      "Click Check-in and Check-out on the calendar.",
      "Enter number of adults.",
      "Enter number of children under 12 (if any).",
    ],
    image: step1.url,
  },
  {
    n: "02",
    title: "Add multiple rooms",
    desc: "Pick a cabin that suits your party, then keep adding rooms until the total capacity fits everyone in your group.",
    bullets: [
      "Choose a cabin (Queen, Twin, Family, etc.).",
      "Click Add Room to place it in your cart.",
      "Click Add Another Room and repeat for every additional cabin.",
      "Mix Queen and Twin rooms to reach the exact headcount.",
    ],
    image: step2.url,
    callout: {
      title: "Booking for a large group?",
      body: "If you have more than 12 guests, use the Add Room feature to select multiple rooms until your total guest count is accommodated. Our cabins fit different capacities — combine Queen and Twin rooms to cover everyone.",
    },
  },
  {
    n: "03",
    title: "Review & guest details",
    desc: "Confirm all the rooms in your cart, then fill in the primary guest's information for the whole booking.",
    bullets: [
      "Double-check dates, rooms, and total price.",
      "Enter primary guest name, IC number, phone, and vehicle details.",
      "Add any remarks (arrival time, requests).",
    ],
    image: step3.url,
  },
  {
    n: "04",
    title: "Secure your booking",
    desc: "Choose deposit or full payment, accept the terms, and complete checkout. You'll receive a confirmation email with your manage-booking link.",
    bullets: [
      "Select deposit or full-payment option.",
      "Accept terms (incl. late check-out RM10/hour).",
      "Complete payment on the secure checkout page.",
      "Save the confirmation email for check-in.",
    ],
    image: step4.url,
  },
];

function BookingGuidePage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function downloadPdf() {
    if (!printRef.current || busy) return;
    setBusy(true);
    try {
      await (document as any).fonts?.ready;
      const imgs = Array.from(printRef.current.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.addEventListener("load", () => res(null), { once: true });
                img.addEventListener("error", () => res(null), { once: true });
              }),
        ),
      );
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default ?? mod;
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: "Rajawali-DCabin-Booking-Guide.pdf",
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(printRef.current)
        .save();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold uppercase tracking-widest">
            ← Rajawali D'Cabin
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/gallery" className="hover:underline">Gallery</Link>
            <Link to="/book" search={{}} className="hover:underline">Book</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-8 pt-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Booking guide
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          How to book your stay
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          A visual, step-by-step guide — perfect for groups of 12+ guests booking
          multiple cabins in one reservation.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={downloadPdf}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Preparing PDF…" : "⬇  Download guide as PDF"}
          </button>
          <Link
            to="/book"
            search={{}}
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-muted"
          >
            Start booking →
          </Link>
        </div>
      </section>

      {/* Printable content */}
      <div ref={printRef} className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-10 hidden text-center print:block">
          <h1 className="text-2xl font-bold">Rajawali D'Cabin — Booking Guide</h1>
          <p className="text-sm text-muted-foreground">drajawalicabin.com</p>
        </div>

        <ol className="space-y-10">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              style={{ pageBreakInside: "avoid" }}
            >
              <div
                className={`grid gap-0 md:grid-cols-2 ${
                  i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="flex items-center justify-center bg-muted/40 p-4">
                  <img
                    src={step.image}
                    alt={`Step ${step.n}: ${step.title}`}
                    loading="lazy"
                    className="h-auto w-full max-w-lg rounded-xl border border-border object-contain shadow-sm"
                  />
                </div>
                <div className="p-6 sm:p-8">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-primary">{step.n}</span>
                    <h2 className="text-xl font-semibold sm:text-2xl">{step.title}</h2>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                    {step.desc}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {step.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {step.callout && (
                    <div className="mt-5 rounded-xl border-l-4 border-primary bg-primary/10 p-4">
                      <p className="text-sm font-semibold text-primary">
                        💡 {step.callout.title}
                      </p>
                      <p className="mt-1 text-sm">{step.callout.body}</p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div
          className="mt-12 rounded-2xl border border-border bg-card p-8 text-center"
          style={{ pageBreakInside: "avoid" }}
        >
          <h2 className="text-2xl font-semibold">Ready to book?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You can also WhatsApp us if you'd like help booking for a large group.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-16 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/book"
            search={{}}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
          >
            Start booking →
          </Link>
          <button
            onClick={downloadPdf}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {busy ? "Preparing PDF…" : "⬇  Download guide as PDF"}
          </button>
        </div>
      </section>
    </div>
  );
}