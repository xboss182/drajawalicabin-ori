import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { createBookingCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/checkout")({
  validateSearch: (raw: Record<string, unknown>) => ({
    id: typeof raw.id === "string" ? raw.id : "",
    token: typeof raw.token === "string" ? raw.token : "",
    kind: raw.kind === "balance" ? "balance" : ("deposit" as "deposit" | "balance"),
  }),
  head: () => ({
    meta: [
      { title: "Pay by card — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id, token, kind } = Route.useSearch();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!isPaymentsConfigured()) {
          throw new Error(
            "Card payments are not configured for this build yet. Use bank transfer / DuitNow QR instead.",
          );
        }
        if (!id || !token) throw new Error("Missing booking reference.");
        const result = await createBookingCheckout({
          data: {
            bookingId: id,
            guestToken: token,
            kind,
            environment: getStripeEnvironment(),
            origin: window.location.origin,
          },
        });
        if (cancelled) return;
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("No checkout session returned.");
        setClientSecret(result.clientSecret);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not start checkout.");
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [id, token, kind]);

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">
            Rajawali D'Cabin
          </Link>
          <button
            onClick={() => navigate({ to: "/manage-booking", search: { id, token } })}
            className="text-xs uppercase tracking-widest text-stone hover:text-forest"
          >
            ← Back to booking
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Pay by card</p>
        <h1 className="mt-2 font-display text-3xl text-forest">
          {kind === "balance" ? "Pay your room rate balance" : "Pay your security deposit"}
        </h1>
        <p className="mt-2 text-sm text-stone">
          {kind === "balance"
            ? "This payment covers the remaining room rate. The security deposit is separate and refundable after check-out."
            : "Payments are processed securely. Your booking is auto-confirmed on success. The security deposit is refundable after check-out, subject to room inspection."}
        </p>

        {error && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {clientSecret && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-2">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}

        {!clientSecret && !error && (
          <p className="mt-8 text-sm text-stone">Starting secure checkout…</p>
        )}
      </section>
    </main>
  );
}