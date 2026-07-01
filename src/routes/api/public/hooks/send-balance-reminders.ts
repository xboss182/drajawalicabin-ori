import { createFileRoute } from "@tanstack/react-router";

// Daily cron hook: finds bookings whose check-in is exactly 7 days from today
// (and that are awaiting_review or confirmed, with balance unpaid), enqueues
// the balance-reminder email, and marks balance_reminder_sent_at.
export const Route = createFileRoute("/api/public/hooks/send-balance-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authorize: caller must present the service-role key as Bearer token.
        // This route mutates booking state (balance_reminder_sent_at) and triggers
        // emails, so it must not be callable anonymously.
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const authHeader = request.headers.get("Authorization") ?? "";
        const presented = authHeader.startsWith("Bearer ")
          ? authHeader.slice("Bearer ".length).trim()
          : "";
        if (!serviceKey || !presented || presented !== serviceKey) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendTransactionalEmail } = await import("@/lib/email/send.server");

        // Send reminder when balance_due_at is today or in the past, but check-in
        // hasn't happened yet and no reminder has gone out. Falls back to "7 days
        // before check-in" for legacy rows without balance_due_at.
        const today = new Date().toISOString().slice(0, 10);
        const in7 = new Date();
        in7.setUTCDate(in7.getUTCDate() + 7);
        const in7Date = in7.toISOString().slice(0, 10);

        const { data: dueRows, error } = await supabaseAdmin
          .from("booking_requests")
          .select(
            "id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, balance_due_at, payment_reference, locker_code, status, balance_reminder_sent_at, balance_paid_at, guest_token",
          )
          .lte("balance_due_at", new Date().toISOString())
          .gte("check_in", today)
          .in("status", ["awaiting_review", "confirmed"])
          .eq("payment_type", "deposit")
          .is("balance_reminder_sent_at", null)
          .is("balance_paid_at", null);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        // Legacy bookings without balance_due_at: keep the old "check_in == today+7" rule.
        const { data: legacyRows } = await supabaseAdmin
          .from("booking_requests")
          .select(
            "id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, balance_due_at, payment_reference, locker_code, status, balance_reminder_sent_at, balance_paid_at, guest_token",
          )
          .eq("check_in", in7Date)
          .is("balance_due_at", null)
          .in("status", ["awaiting_review", "confirmed"])
          .eq("payment_type", "deposit")
          .is("balance_reminder_sent_at", null)
          .is("balance_paid_at", null);

        const rows = [...(dueRows ?? []), ...(legacyRows ?? [])];

        const origin = new URL(request.url).origin;
        let sent = 0;
        for (const r of rows) {
          const manageUrl = `${origin}/manage-booking?id=${r.id}&token=${r.guest_token}`;
          const total = Number(r.total_amount ?? 0);
          const securityDeposit = r.deposit_amount != null ? Number(r.deposit_amount) : 50;
          const remaining = r.balance_amount != null ? Number(r.balance_amount) : Math.max(0, total - securityDeposit);
          await sendTransactionalEmail(supabaseAdmin, {
            templateName: 'balance-reminder',
            recipientEmail: r.email,
            idempotencyKey: `balance-reminder-${r.id}`,
            templateData: {
              guestName: r.guest_name,
              reference: r.payment_reference ?? r.id.slice(0, 8),
              roomType: r.room_type,
              checkIn: r.check_in,
              total,
              securityDeposit,
              remaining,
              manageUrl,
            },
          });
          await supabaseAdmin
            .from("booking_requests")
            .update({ balance_reminder_sent_at: new Date().toISOString() })
            .eq("id", r.id);
          sent++;
        }
        return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});