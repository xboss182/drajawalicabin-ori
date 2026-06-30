import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "@/lib/stripe.server";

const checkoutSchema = z.object({
  bookingId: z.string().uuid(),
  guestToken: z.string().min(8),
  kind: z.enum(["deposit", "balance"]),
  environment: z.enum(["sandbox", "live"]),
  origin: z.string().url(),
});

type CheckoutResult = { clientSecret: string } | { error: string };

/**
 * Creates a Stripe Embedded Checkout session for the deposit or balance of a
 * booking. Guests pay anonymously (no user account) — verified by the
 * booking's guest_token. On success the webhook updates booking status.
 */
export const createBookingCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => checkoutSchema.parse(d))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up the booking group head (lead row)
    const { data: head } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id, booking_group_id, guest_token, guest_name, email, check_in, check_out, payment_reference, status, payment_type, deposit_amount, balance_amount, total_amount",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!head) return { error: "Booking not found" };
    if (head.guest_token !== data.guestToken) return { error: "Booking not found" };

    // Sum amounts across the booking group
    const groupId = (head.booking_group_id as string) ?? head.id;
    const { data: rows } = await supabaseAdmin
      .from("booking_requests")
      .select("total_amount, deposit_amount, balance_amount")
      .eq("booking_group_id", groupId);
    const total = (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const deposit = Number(head.deposit_amount ?? 50);
    const balance = Math.max(0, total - deposit);

    let amountRM = 0;
    let description = "";
    if (data.kind === "deposit") {
      // Deposit OR full payment (full uses deposit step with total as amount)
      amountRM = (head.payment_type === "full") ? total : deposit;
      description =
        head.payment_type === "full"
          ? `Rajawali D'Cabin — Full payment (${head.payment_reference ?? head.id.slice(0, 8)})`
          : `Rajawali D'Cabin — Booking deposit (${head.payment_reference ?? head.id.slice(0, 8)})`;
    } else {
      if (balance <= 0) return { error: "No balance due." };
      amountRM = balance;
      description = `Rajawali D'Cabin — Balance payment (${head.payment_reference ?? head.id.slice(0, 8)})`;
    }
    if (amountRM <= 0) return { error: "Nothing to charge." };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded_page",
        mode: "payment",
        return_url: `${data.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        customer_email: head.email ?? undefined,
        line_items: [
          {
            price_data: {
              currency: "myr",
              product_data: {
                name: description,
                description: `Stay: ${head.check_in} → ${head.check_out}`,
              },
              unit_amount: Math.round(amountRM * 100),
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          description,
          metadata: {
            bookingId: head.id,
            bookingGroupId: groupId,
            kind: data.kind,
            reference: head.payment_reference ?? "",
          },
        },
        metadata: {
          bookingId: head.id,
          bookingGroupId: groupId,
          kind: data.kind,
          reference: head.payment_reference ?? "",
        },
      });

      // Record the session id on the booking group so the webhook + return
      // page can correlate even if metadata is later trimmed.
      const updateCol =
        data.kind === "deposit"
          ? { stripe_session_id: session.id, payment_method: "stripe" as const }
          : { stripe_balance_session_id: session.id, payment_method: "stripe" as const };
      await supabaseAdmin
        .from("booking_requests")
        .update(updateCol)
        .eq("booking_group_id", groupId);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

const statusSchema = z.object({
  sessionId: z.string().min(8),
  environment: z.enum(["sandbox", "live"]),
});

type StatusResult =
  | {
      status: string;
      paymentStatus: string | null;
      bookingId: string | null;
      guestToken: string | null;
      reference: string | null;
      kind: "deposit" | "balance" | null;
    }
  | { error: string };

/**
 * Reads the Stripe Checkout session by id and pairs it with the corresponding
 * booking so the return page can deep-link the guest into manage-booking.
 */
export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data }): Promise<StatusResult> => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const kind = (session.metadata?.kind as "deposit" | "balance" | undefined) ?? null;
      const bookingId = (session.metadata?.bookingId as string | undefined) ?? null;

      let guestToken: string | null = null;
      let reference: string | null = null;
      if (bookingId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("booking_requests")
          .select("guest_token, payment_reference")
          .eq("id", bookingId)
          .maybeSingle();
        guestToken = (row?.guest_token as string | undefined) ?? null;
        reference = (row?.payment_reference as string | undefined) ?? null;
      }

      return {
        status: session.status ?? "open",
        paymentStatus: session.payment_status ?? null,
        bookingId,
        guestToken,
        reference,
        kind,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });