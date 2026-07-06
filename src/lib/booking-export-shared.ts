// Shared row-building for CSV/OneDrive booking exports.
// One row per guest booking (grouped by booking_group_id when set).

export type BookingRow = {
  id: string;
  payment_reference: string | null;
  guest_name: string | null;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  guests: number | null;
  status: string | null;
  nights: number | null;
  num_rooms: number | null;
  comforter_total: number | null;
  check_in: string | null;
  check_out: string | null;
  deposit_amount: number | string | null;
  total_amount: number | string | null;
  notes: string | null;
  relationship: string | null;
  room_type: string | null;
  booking_group_id?: string | null;
  cabins?: { name?: string | null } | null;
};

function depositPaid(status: string): string {
  return status === "pending_payment" || status === "cancelled" ? "nil" : "paid";
}
function roomPaymentPaid(status: string): string {
  return status === "fully_paid" ? "paid" : "nil";
}

// Extract trailing number from a cabin name like "Twin room 4" -> "4".
function roomNumberOf(name: string): string {
  const m = name.match(/(\d+)\s*$/);
  return m ? m[1] : name;
}

export function groupBookings(rows: BookingRow[]): BookingRow[][] {
  const groups = new Map<string, BookingRow[]>();
  for (const r of rows) {
    const key = r.booking_group_id ?? r.id;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  return Array.from(groups.values());
}

export function groupToCells(group: BookingRow[]): unknown[] {
  // Primary booking = first in group (most recent by caller's ordering).
  const b = group[0];
  const nights = Number(b.nights ?? 0);
  const totalRooms = group.reduce(
    (s, r) => s + Number(r.num_rooms ?? 1),
    0,
  );
  const comforterTotal = group.reduce(
    (s, r) => s + Number(r.comforter_total ?? 0),
    0,
  );
  const comforterCount =
    nights > 0 ? Math.round(comforterTotal / (20 * nights)) : 0;
  const occupancy = totalRooms * nights;

  // Room No: comma-join cabin numbers across the group (dedup, preserve order).
  const seen = new Set<string>();
  const roomNumbers: string[] = [];
  for (const r of group) {
    const name = r.cabins?.name ?? r.room_type ?? "";
    if (!name) continue;
    const num = roomNumberOf(name);
    if (!seen.has(num)) {
      seen.add(num);
      roomNumbers.push(num);
    }
  }
  const roomNo = roomNumbers.join(",");

  const deposit = group.reduce(
    (s, r) => s + Number(r.deposit_amount ?? 0),
    0,
  );
  const total = group.reduce(
    (s, r) => s + Number(r.total_amount ?? 0),
    0,
  );

  return [
    b.payment_reference ?? b.id.slice(0, 8),
    b.guest_name,
    "",
    b.phone,
    b.vehicle_type ?? "",
    b.vehicle_number ?? "",
    depositPaid((b.status ?? "") as string),
    roomPaymentPaid((b.status ?? "") as string),
    b.guests,
    b.relationship ?? "",
    nights,
    totalRooms,
    roomNo,
    comforterCount,
    occupancy,
    b.check_in,
    b.check_out,
    deposit || "",
    total || "",
    b.notes ?? "",
  ];
}