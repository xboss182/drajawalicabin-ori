// Server-only helpers for the guest-facing invoice on /manage-booking.

function cleanRoomType(name: string | null | undefined): string {
  if (!name) return name ?? "";
  return name.replace(/\s*\([^()]*(?:\s\+\s|\s×\s)[^()]*\)\s*$/, "").trim();
}

export async function buildGuestInvoice(admin: any, bookingId: string, guestToken: string) {
  const { data: lead } = await admin
    .from("booking_requests")
    .select("id, booking_group_id, guest_token")
    .eq("id", bookingId)
    .maybeSingle();
  if (!lead || lead.guest_token !== guestToken) throw new Error("Booking not found");
  const gid = (lead.booking_group_id as string) ?? lead.id;

  const { data: rows, error } = await admin
    .from("booking_requests")
    .select("*, cabins(name)")
    .eq("booking_group_id", gid)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) throw new Error("Booking not found");

  const head: any = rows[0];
  const total = rows.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const subtotal = rows.reduce((s: number, r: any) => s + Number(r.subtotal ?? 0), 0);
  const comforterTotal = rows.reduce((s: number, r: any) => s + Number(r.comforter_total ?? 0), 0);
  const discountTotal = rows.reduce((s: number, r: any) => s + Number(r.discount_amount ?? 0), 0);
  const discountCode = (rows.find((r: any) => r.discount_code)?.discount_code as string | null) ?? null;

  const grossPerRoom = rows.map((r: any) => Number(r.subtotal ?? 0) + Number(r.comforter_total ?? 0));
  const grossSum = grossPerRoom.reduce((s: number, n: number) => s + n, 0);
  const roomDiscounts = grossPerRoom.map((g: number) =>
    grossSum > 0 ? Math.round(((discountTotal * g) / grossSum) * 100) / 100 : 0,
  );
  if (roomDiscounts.length > 0) {
    const drift =
      Math.round((discountTotal - roomDiscounts.reduce((s: number, n: number) => s + n, 0)) * 100) / 100;
    roomDiscounts[roomDiscounts.length - 1] =
      Math.round((roomDiscounts[roomDiscounts.length - 1] + drift) * 100) / 100;
  }

  const hasOldBalance = rows.some((r: any) => r.balance_amount == null);
  const securityDeposit = hasOldBalance
    ? Number(head.deposit_amount ?? 50)
    : rows.reduce((s: number, r: any) => s + Number(r.deposit_amount ?? 0), 0);
  const balance = hasOldBalance
    ? Math.max(0, total - securityDeposit)
    : rows.reduce((s: number, r: any) => s + Number(r.balance_amount ?? 0), 0);

  return {
    reference: (head.payment_reference as string | null) ?? head.id.slice(0, 8),
    status: head.status as string,
    guestName: head.guest_name as string,
    email: head.email as string,
    phone: head.phone as string | null,
    checkIn: head.check_in as string,
    checkOut: head.check_out as string,
    nights: head.nights as number | null,
    guests: head.guests as number,
    createdAt: head.created_at as string,
    subtotal,
    comforterTotal,
    discountTotal,
    discountCode,
    total,
    securityDeposit,
    balance,
    rooms: rows.map((r: any, i: number) => ({
      id: r.id as string,
      name: cleanRoomType(r.cabins?.name ?? r.room_type),
      nights: r.nights as number | null,
      subtotal: Number(r.subtotal ?? 0),
      comforterTotal: Number(r.comforter_total ?? 0),
      discount: roomDiscounts[i] ?? 0,
      total: Math.round((grossPerRoom[i] - (roomDiscounts[i] ?? 0)) * 100) / 100,
    })),
  };
}

export async function listGuestBookings(admin: any, bookingId: string, guestToken: string) {
  const { data: lead } = await admin
    .from("booking_requests")
    .select("id, guest_token, email, booking_group_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!lead || lead.guest_token !== guestToken) throw new Error("Booking not found");
  const { data: rows } = await admin
    .from("booking_requests")
    .select("id, booking_group_id, payment_reference, guest_token, status, created_at, room_type, check_in")
    .ilike("email", (lead.email as string) ?? "")
    .order("created_at", { ascending: false })
    .limit(50);
  const seen = new Set<string>();
  const bookings: any[] = [];
  for (const r of rows ?? []) {
    if (r.status === "cancelled") continue;
    const gid = (r.booking_group_id as string) ?? r.id;
    if (seen.has(gid)) continue;
    seen.add(gid);
    bookings.push({
      bookingId: r.id as string,
      guestToken: r.guest_token as string,
      reference: (r.payment_reference as string | null) ?? "",
      roomType: cleanRoomType(r.room_type),
      checkIn: (r.check_in as string | null) ?? "",
      status: (r.status as string | null) ?? "",
    });
  }
  return { bookings };
}
