import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCheckoutSessionStatus } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (raw: Record<string, unknown>) => ({
    session_id: typeof raw.session_id === "string" ? raw.session_id : "",
  }),
  head: () => ({
    meta: [
      { title: "Payment received — Rajawali D'Cabin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const { session_id } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; bookingId: string; token: string; reference: string | null; type: "deposit" | "balance" | null }
    | { kind: "pending" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!session_id) {
      setState({ kind: "error", message: "No checkout session in URL." });
      return;
    }
    let cancelled = false;
    async function go() {
      try {
        const r = await getCheckoutSessionStatus({
          data: { sessionId: session_id, environment: getStripeEnvironment() },
        });
        if (cancelled) return;
        if ("error" in r) throw new Error(r.error);
        if (r.paymentStatus === "paid" || r.status === "complete") {
          if (r.bookingId && r.guestToken) {
            setState({
              kind: "ok",
              bookingId: r.bookingId,
              token: r.guestToken,
              reference: r.reference,
              type: r.kind,
            });
          } else {
            setState({ kind: "ok", bookingId: "", token: "", reference: null, type: r.kind });
          }
        } else {
          setState({ kind: "pending" });
        }
      } catch (e: unknown) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not load payment status.",
        });
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [session_id]);

  return (
    <main className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border bg-coconut">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link to="/" className="font-display text-lg text-forest">
            Rajawali D'Cabin
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-16 lg:px-10">
        {state.kind === "loading" && <p className="text-stone">Checking payment…</p>}

        {state.kind === "pending" && (
          <>
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone">Payment processing</p>
            <h1 className="mt-2 font-display text-3xl text-forest">Hang tight — your payment is processing.</h1>
            <p className="mt-3 text-foreground/75">
              We'll send a confirmation email shortly. You can also check your booking status at any time.
            </p>
            <Link to="/find-booking" className="mt-6 inline-block text-sm text-forest underline">
              Look up my booking
            </Link>
          </>
        )}

        {state.kind === "ok" && (
          <>
            <p className="text-[11px] uppercase tracking-[0.3em] text-forest">Payment received ✓</p>
            <h1 className="mt-2 font-display text-3xl text-forest">
              {state.type === "balance" ? "You're fully paid." : "Booking confirmed."}
            </h1>
            <p className="mt-3 text-foreground/75">
              {state.reference && (
                <>
                  Reference{" "}
                  <span className="font-mono text-forest">{state.reference}</span>.{" "}
                </>
              )}
              {state.type === "balance"
                ? "We'll send your key-locker code closer to check-in."
                : "Your balance reminder will arrive 7 days before check-in."}
            </p>
            <div className="mt-8 flex gap-3">
              {state.bookingId && state.token ? (
                <button
                  onClick={() =>
                    navigate({
                      to: "/manage-booking",
                      search: { id: state.bookingId, token: state.token },
                    })
                  }
                  className="rounded-full bg-forest px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-coconut"
                >
                  View booking
                </button>
              ) : (
                <Link
                  to="/find-booking"
                  className="rounded-full bg-forest px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-coconut"
                >
                  Look up my booking
                </Link>
              )}
              <Link
                to="/"
                className="rounded-full border border-border px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-forest"
              >
                Home
              </Link>
            </div>
          </>
        )}

        {state.kind === "error" && (
          <>
            <p className="text-[11px] uppercase tracking-[0.3em] text-red-700">Something went wrong</p>
            <h1 className="mt-2 font-display text-3xl text-forest">{state.message}</h1>
            <Link to="/find-booking" className="mt-6 inline-block text-sm text-forest underline">
              Look up my booking
            </Link>
          </>
        )}
      </section>
    </main>
  );
}