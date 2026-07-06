import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Syncs all bookings to a CSV file on the admin's OneDrive.
// File: /Dr Ajawali Cabin - Bookings.csv at the OneDrive root.
// Overwrites on every call. Open from OneDrive in Excel (web or desktop).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_excel";
const FILE_NAME = "Dr Ajawali Cabin - Bookings.csv";

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
  if (status === "pending_payment") return "Unpaid";
  return "Paid";
}
function totalPaymentStatus(status: string): string {
  switch (status) {
    case "fully_paid": return "Fully paid";
    case "confirmed": return "Deposit paid";
    case "awaiting_review": return "Awaiting review";
    case "pending_payment": return "Pending";
    case "cancelled": return "Cancelled";
    default: return status ?? "";
  }
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
        "id, payment_reference, created_at, guest_name, phone, vehicle_type, vehicle_number, guests, status, nights, num_rooms, comforter_total, check_in, check_out, deposit_amount, total_amount, notes, relationship, room_type, cabins(name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const lines: string[] = [toRow(HEADERS)];
    let rowCount = 0;
    for (const b of data ?? []) {
      const nights = Number(b.nights ?? 0);
      const numRooms = Number(b.num_rooms ?? 1);
      const comforterTotal = Number(b.comforter_total ?? 0);
      const comforterCount =
        nights > 0 ? Math.round(comforterTotal / (20 * nights)) : 0;
      const occupancy = numRooms * nights;
      const cabinName =
        (b as unknown as { cabins?: { name?: string } | null }).cabins?.name ??
        b.room_type ?? "";
      const dateBooked = b.created_at ? String(b.created_at).slice(0, 10) : "";
      for (let i = 1; i <= Math.max(1, numRooms); i++) {
        const roomLabel = numRooms > 1 ? `${cabinName} #${i}` : cabinName;
        lines.push(
          toRow([
            b.payment_reference ?? b.id.slice(0, 8),
            dateBooked,
            b.guest_name,
            "",
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
        rowCount++;
      }
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