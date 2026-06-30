import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/test/admin-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const bookingId = url.searchParams.get("bookingId");
        if (!bookingId) return new Response("missing bookingId", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("booking_requests")
          .select(
            "id, guest_name, email, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, payment_reference, payment_type",
          )
          .eq("id", bookingId)
          .maybeSingle();
        if (error || !row) return new Response("booking not found", { status: 404 });

        const total = Number(row.total_amount ?? 0);
        const deposit = Number(row.deposit_amount ?? 50);
        const remaining = Math.max(0, total - deposit);
        const templateData = {
          guestName: row.guest_name,
          reference: row.payment_reference ?? row.id.slice(0, 8),
          roomType: row.room_type,
          checkIn: row.check_in,
          checkOut: row.check_out,
          nights: row.nights,
          guests: row.guests,
          total,
          deposit,
          remaining,
          paymentType: (row as any).payment_type ?? "deposit",
          rooms: [{ name: row.room_type, total }],
        };
        const { sendTransactionalEmail, getAdminRecipients } = await import("@/lib/email/send.server");
        const admins = await getAdminRecipients(supabaseAdmin, "notify_payment_proof");
        for (const adminEmail of admins) {
          await sendTransactionalEmail(supabaseAdmin, {
            templateName: "booking-summary",
            recipientEmail: adminEmail,
            idempotencyKey: `booking-summary-${row.id}-${adminEmail}-test`,
            templateData,
          });
        }
        return new Response(JSON.stringify({ ok: true, sentTo: admins }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});