import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const meta = session?.metadata ?? {};
  const bookingId = meta.bookingId as string | undefined;
  const groupId = (meta.bookingGroupId as string | undefined) ?? bookingId;
  const kind = meta.kind as "deposit" | "balance" | undefined;
  if (!bookingId || !groupId || !kind) {
    console.warn("Stripe webhook: missing metadata on session", session?.id);
    return;
  }
  if (session.payment_status !== "paid") {
    console.log("Stripe webhook: session not paid yet", session?.id, session.payment_status);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Pull payment-type so we know whether deposit==full
  const { data: head } = await supabaseAdmin
    .from("booking_requests")
    .select("id, payment_type, status, check_in")
    .eq("booking_group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!head) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const nowIso = new Date().toISOString();

  if (kind === "deposit") {
    const isFull = head.payment_type === "full";
    const update: Record<string, unknown> = {
      status: isFull ? "fully_paid" : "confirmed",
      payment_method: "stripe",
      stripe_session_id: session.id,
      confirmed_at: nowIso,
      ...(isFull ? { balance_paid_at: nowIso, balance_due_at: null } : {}),
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    };
    // Default balance_due_at = check_in - 7 days for deposit-only
    if (!isFull && head.check_in) {
      try {
        const { data: s } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "balance_due_days_before")
          .maybeSingle();
        const days = s?.value != null ? Number(s.value) : 7;
        const due = new Date(head.check_in as string);
        due.setUTCDate(due.getUTCDate() - days);
        update.balance_due_at = due.toISOString();
      } catch {}
    }
    await supabaseAdmin
      .from("booking_requests")
      .update(update)
      .eq("booking_group_id", groupId);
  } else {
    // Balance payment
    await supabaseAdmin
      .from("booking_requests")
      .update({
        status: "fully_paid",
        payment_method: "stripe",
        stripe_balance_session_id: session.id,
        balance_paid_at: nowIso,
        ...(paymentIntentId ? { stripe_balance_payment_intent_id: paymentIntentId } : {}),
      })
      .eq("booking_group_id", groupId);

    // Fire the same fully-paid emails the admin path sends
    try {
      const { data: rows } = await supabaseAdmin
        .from("booking_requests")
        .select(
          "id, guest_name, email, check_in, check_out, room_type, payment_reference, locker_code",
        )
        .eq("booking_group_id", groupId)
        .order("created_at", { ascending: true });
      const lead = rows?.[0];
      if (lead?.email) {
        const templateData = {
          guestName: lead.guest_name,
          reference: lead.payment_reference ?? lead.id.slice(0, 8),
          checkIn: lead.check_in,
          checkOut: lead.check_out,
          rooms: (rows ?? []).map((r) => r.room_type).join(", "),
          lockerCode: lead.locker_code,
        };
        const { sendTransactionalEmail, getAdminRecipients } = await import(
          "@/lib/email/send.server"
        );
        await sendTransactionalEmail(supabaseAdmin, {
          templateName: "fully-paid",
          recipientEmail: lead.email,
          idempotencyKey: `fully-paid-${lead.id}-guest-stripe`,
          templateData,
        });
        const admins = await getAdminRecipients(supabaseAdmin, "notify_fully_paid");
        for (const adminEmail of admins) {
          await sendTransactionalEmail(supabaseAdmin, {
            templateName: "fully-paid",
            recipientEmail: adminEmail,
            idempotencyKey: `fully-paid-${lead.id}-${adminEmail}-stripe`,
            templateData,
          });
        }
      }
    } catch (e) {
      console.error("fully-paid email send failed", e);
    }
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled Stripe event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env param:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});