import { createFileRoute } from "@tanstack/react-router";

// Daily cron hook: finds bookings whose check-in is exactly 7 days from today
// (and that are awaiting_review or confirmed, with balance unpaid), enqueues
// the balance-reminder email, and marks balance_reminder_sent_at.
export const Route = createFileRoute("/api/public/hooks/send-balance-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { renderBalanceReminderEmail, enqueueEmail } = await import("@/lib/email.server");

        const target = new Date();
        target.setUTCDate(target.getUTCDate() + 7);
        const targetDate = target.toISOString().slice(0, 10);

        const { data: rows, error } = await supabaseAdmin
          .from("booking_requests")
          .select("id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, payment_reference, locker_code, status, balance_reminder_sent_at, balance_paid_at, guest_token")
          .eq("check_in", targetDate)
          .in("status", ["awaiting_review", "confirmed"])
          .is("balance_reminder_sent_at", null)
          .is("balance_paid_at", null);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const origin = new URL(request.url).origin;
        let sent = 0;
        for (const r of rows ?? []) {
          const manageUrl = `${origin}/manage-booking?id=${r.id}&token=${r.guest_token}`;
          const { subject, body } = renderBalanceReminderEmail(r as never, manageUrl);
          await enqueueEmail(supabaseAdmin, { kind: "balance_reminder", toEmail: r.email, subject, body, bookingId: r.id });
          await supabaseAdmin
            .from("booking_requests")
            .update({ balance_reminder_sent_at: new Date().toISOString() })
            .eq("id", r.id);
          sent++;
        }
        return new Response(JSON.stringify({ ok: true, targetDate, sent }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});