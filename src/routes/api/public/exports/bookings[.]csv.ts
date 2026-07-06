import { createFileRoute } from "@tanstack/react-router";
import { groupBookings, groupToCells, type BookingRow } from "@/lib/booking-export-shared";

// CSV feed for Excel Power Query sync.
// URL: /api/public/exports/bookings.csv?token=<BOOKINGS_EXPORT_TOKEN>
// Optional: &from=YYYY-MM-DD&to=YYYY-MM-DD (filters on check_in)
//
// Excel: Data -> From Web -> paste URL. Refresh via Data -> Refresh All.

const HEADERS = [
  "Booking No",
  "Guest Name",
  "IC no.",
  "Contact @HP No",
  "Jenis Kenderaan",
  "No Kenderaan",
  "Deposit @ Booking",
  "Room Payment",
  "No. of Pax",
  "Relation",
  "Nite stay",
  "Room Qty",
  "Room No",
  "Comforter",
  "Occupancy",
  "Check-in Date",
  "Check-out Date",
  "Booking @ Security Deposit (RM50/Room)",
  "Room Payment (paid before check in)",
  "Remarks",
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
        const groups = groupBookings((data ?? []) as unknown as BookingRow[]);
        for (const g of groups) lines.push(toRow(groupToCells(g)));

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