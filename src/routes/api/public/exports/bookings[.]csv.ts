import { createFileRoute } from "@tanstack/react-router";

// CSV feed for Excel Power Query sync.
// URL: /api/public/exports/bookings.csv?token=<BOOKINGS_EXPORT_TOKEN>
// Optional: &from=YYYY-MM-DD&to=YYYY-MM-DD (filters on check_in)
//
// Excel: Data -> From Web -> paste URL. Refresh via Data -> Refresh All.

const HEADERS = [
  "Booking Ref",
  "Date Booking",
  "Name",
  "IC",
  "Contact/Tel",
  "Vehicle Model",
  "Veh Reg No",
  "No of Pax",
  "Deposit Status",
  "Total Payment Status",
  "No of Nite Stay",
  "No of Rooms",
  "Room No",
  "Comforter No",
  "Occupancy (room x stay)",
  "Date Check In",
  "Date Check Out",
  "Security Deposit",
  "Room Payment Amount",
  "Remarks",
  "Relation",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

function depositStatus(status: string): string {
  // Deposit is considered paid once we've moved past pending_payment.
  if (status === "pending_payment") return "Unpaid";
  return "Paid";
}

function totalPaymentStatus(status: string): string {
  switch (status) {
    case "fully_paid":
      return "Fully paid";
    case "confirmed":
      return "Deposit paid";
    case "awaiting_review":
      return "Awaiting review";
    case "pending_payment":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    default:
      return status ?? "";
  }
}

export const Route = createFileRoute("/api/public/exports/bookings.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.BOOKINGS_EXPORT_TOKEN;
        const url = new URL(request.url);
        const presented = url.searchParams.get("token") ?? "";
        if (!expected || !presented || presented !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        let q = supabaseAdmin
          .from("booking_requests")
          .select(
            "id, payment_reference, created_at, guest_name, phone, vehicle_type, vehicle_number, guests, status, nights, num_rooms, comforter_total, check_in, check_out, deposit_amount, total_amount, notes, relationship, room_type, cabin_id, booking_group_id, cabins(name)",
          )
          .order("created_at", { ascending: false });
        if (from) q = q.gte("check_in", from);
        if (to) q = q.lte("check_in", to);

        const { data, error } = await q;
        if (error) {
          return new Response(`Error: ${error.message}`, { status: 500 });
        }

        const lines: string[] = [toRow(HEADERS)];
        for (const b of data ?? []) {
          const nights = Number(b.nights ?? 0);
          const numRooms = Number(b.num_rooms ?? 1);
          const comforterTotal = Number(b.comforter_total ?? 0);
          const comforterCount =
            nights > 0 ? Math.round(comforterTotal / (20 * nights)) : 0;
          const occupancy = numRooms * nights;
          const cabinName =
            (b as unknown as { cabins?: { name?: string } | null }).cabins
              ?.name ?? b.room_type ?? "";
          const dateBooked = b.created_at
            ? String(b.created_at).slice(0, 10)
            : "";

          // One row per cabin/room in the booking so "Room No" is meaningful.
          for (let i = 1; i <= Math.max(1, numRooms); i++) {
            const roomLabel =
              numRooms > 1 ? `${cabinName} #${i}` : cabinName;
            lines.push(
              toRow([
                b.payment_reference ?? b.id.slice(0, 8),
                dateBooked,
                b.guest_name,
                "", // IC — not collected in the booking form yet
                b.phone,
                b.vehicle_type ?? "",
                b.vehicle_number ?? "",
                b.guests,
                depositStatus(b.status as string),
                totalPaymentStatus(b.status as string),
                nights,
                numRooms,
                roomLabel,
                comforterCount,
                occupancy,
                b.check_in,
                b.check_out,
                b.deposit_amount ?? "",
                b.total_amount ?? "",
                b.notes ?? "",
                b.relationship ?? "",
              ]),
            );
          }
        }

        // Prepend UTF-8 BOM so Excel opens the file with the right encoding.
        const body = "\uFEFF" + lines.join("\r\n") + "\r\n";
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="bookings.csv"',
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});