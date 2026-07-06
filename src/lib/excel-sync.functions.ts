import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { groupBookings, groupToCells, type BookingRow } from "./booking-export-shared";

// Syncs all bookings to a CSV file on the admin's OneDrive.
// File: /Rajawali D'Cabin - Bookings.csv at the OneDrive root.
// Overwrites on every call. Open from OneDrive in Excel (web or desktop).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_excel";
const FILE_NAME = "Rajawali D'Cabin - Bookings.csv";

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

export const syncBookingsToOneDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.MICROSOFT_EXCEL_API_KEY;
    if (!lovableKey || !connKey) {
      throw new Error("Microsoft connection not configured");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id, payment_reference, created_at, guest_name, phone, vehicle_type, vehicle_number, guests, status, nights, num_rooms, comforter_total, check_in, check_out, deposit_amount, total_amount, notes, relationship, room_type, booking_group_id, cabins(name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const lines: string[] = [toRow(HEADERS)];
    let rowCount = 0;
    const groups = groupBookings((data ?? []) as unknown as BookingRow[]);
    for (const g of groups) {
      lines.push(toRow(groupToCells(g)));
      rowCount++;
    }
    const body = "\uFEFF" + lines.join("\r\n") + "\r\n";

    // PUT file to OneDrive root, overwriting if it exists.
    const uploadPath = encodeURIComponent(FILE_NAME);
    const uploadUrl = `${GATEWAY_URL}/me/drive/root:/${uploadPath}:/content`;
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": "text/csv",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OneDrive upload failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const item = (await res.json().catch(() => ({}))) as {
      webUrl?: string;
      name?: string;
      id?: string;
    };

    // Create (or fetch existing) anonymous view link so other admins can open it.
    let shareUrl: string | null = null;
    if (item.id) {
      const linkRes = await fetch(
        `${GATEWAY_URL}/me/drive/items/${item.id}/createLink`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": connKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "view", scope: "anonymous" }),
        },
      );
      if (linkRes.ok) {
        const linkData = (await linkRes.json().catch(() => ({}))) as {
          link?: { webUrl?: string };
        };
        shareUrl = linkData.link?.webUrl ?? null;
      }
    }

    return {
      ok: true as const,
      fileName: item.name ?? FILE_NAME,
      webUrl: item.webUrl ?? null,
      shareUrl,
      rowCount,
    };
  });