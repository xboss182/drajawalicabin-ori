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
          const { subject, body } = renderBalanceReminderEmail(r as never, manageUrl);
          await enqueueEmail(supabaseAdmin, { kind: "balance_reminder", toEmail: r.email, subject, body, bookingId: r.id });
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