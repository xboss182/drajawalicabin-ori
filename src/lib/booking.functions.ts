import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function generateRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `RJW-${n}`;
}

async function groupIdFor(admin: any, bookingId: string): Promise<string> {
  const { data } = await admin
    .from("booking_requests")
    .select("booking_group_id")
    .eq("id", bookingId)
    .maybeSingle();
  return (data?.booking_group_id as string) ?? bookingId;
}

const createSchema = z.object({
  items: z
    .array(
      z.object({
        cabinType: z.string().trim().min(1).max(60),
        numRooms: z.number().int().min(1).max(8),
      }),
    )
    .min(1)
    .max(8),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(12),
  comforter: z.boolean(),
  guestName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(30),
  relationship: z.string().trim().max(100).optional(),
  vehicleType: z.string().trim().max(100).optional(),
  vehicleNumber: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      throw new Error("Check-out must be after check-in");
    }

    // Collapse duplicate types in case the UI sent them split.
    const itemMap = new Map<string, number>();
    for (const it of data.items) {
      itemMap.set(it.cabinType, (itemMap.get(it.cabinType) ?? 0) + it.numRooms);
    }
    const items = Array.from(itemMap, ([cabinType, numRooms]) => ({ cabinType, numRooms }));
    const totalRooms = items.reduce((s, it) => s + it.numRooms, 0);
    if (totalRooms < 1 || totalRooms > 8) {
      throw new Error("Pick between 1 and 8 rooms.");
    }

    // Check-out is exclusive, so only booked nights are tested.
    const co = new Date(data.checkOut);
    co.setUTCDate(co.getUTCDate() - 1);
    const lastNightStr = co.toISOString().slice(0, 10);
    if (co < new Date(data.checkIn)) {
      throw new Error("Check-out must be after check-in");
    }

    // Resolve cabins per type and pick available rooms for each.
    type Assigned = {
      cabinId: string;
      cabinName: string;
      cabinType: string;
      nights: number;
      subtotal: number;
      comforterTotal: number;
      total: number;
    };
    const assigned: Assigned[] = [];

    for (const it of items) {
      const { data: cabinsInType, error: cabinsErr } = await supabaseAdmin
        .from("cabins")
        .select("id, name, cabin_type")
        .eq("cabin_type", it.cabinType)
        .eq("is_active", true)
        .order("display_order");
      if (cabinsErr) throw new Error(cabinsErr.message);
      if (!cabinsInType || cabinsInType.length === 0) {
        throw new Error(`Cabin type ${it.cabinType} not found.`);
      }

      const free: Array<{ id: string; name: string; cabin_type: string }> = [];
      for (const cabin of cabinsInType) {
        const { data: taken, error: takenErr } = await supabaseAdmin.rpc("cabin_taken_dates", {
          _cabin_id: cabin.id,
          _from: data.checkIn,
          _to: lastNightStr,
        });
        if (takenErr) throw new Error(takenErr.message);
        if (!taken || taken.length === 0) free.push(cabin);
      }
      if (free.length < it.numRooms) {
        throw new Error("Sorry, those dates were just taken. Please pick different dates.");
      }

      const sample = free[0];
      const { data: priceRows, error: priceErr } = await supabaseAdmin.rpc("compute_booking_price", {
        _cabin_id: sample.id,
        _check_in: data.checkIn,
        _check_out: data.checkOut,
        _comforter: data.comforter,
      });
      if (priceErr) throw new Error(priceErr.message);
      const price = Array.isArray(priceRows) ? priceRows[0] : priceRows;
      if (!price) throw new Error("Could not compute price");

      for (let i = 0; i < it.numRooms; i++) {
        const cabin = free[i];
        assigned.push({
          cabinId: cabin.id,
          cabinName: cabin.name,
          cabinType: cabin.cabin_type,
          nights: Number(price.nights),
          subtotal: Number(price.subtotal),
          comforterTotal: Number(price.comforter_total),
          total: Number(price.total),
        });
      }
    }

    const reference = generateRef();
    const holdMinutes = 30;
    const holdExpires = new Date(Date.now() + holdMinutes * 60_000).toISOString();
    // Shared identifiers across all rows in the reservation.
    const groupId = (globalThis.crypto?.randomUUID?.() ?? null);
    const guestToken = (globalThis.crypto?.randomUUID?.() ?? null);

    // Build a single combined room_type label (used by emails / older list code).
    const typeCounts = new Map<string, { label: string; count: number }>();
    for (const a of assigned) {
      const label = a.cabinName.replace(/\s*\d+\s*$/, "").trim() || a.cabinType;
      const cur = typeCounts.get(a.cabinType);
      if (cur) cur.count += 1;
      else typeCounts.set(a.cabinType, { label, count: 1 });
    }
    const roomTypeSummary = Array.from(typeCounts.values())
      .map((t) => (t.count > 1 ? `${t.label} × ${t.count}` : t.label))
      .join(" + ");

    const sharedBase = {
      guest_name: data.guestName,
      email: data.email,
      phone: data.phone,
      check_in: data.checkIn,
      check_out: data.checkOut,
      guests: data.guests,
      notes: data.notes ?? null,
      relationship: data.relationship ?? null,
      vehicle_type: data.vehicleType ?? null,
      vehicle_number: data.vehicleNumber ?? null,
      comforter: data.comforter,
      payment_reference: reference,
      hold_expires_at: holdExpires,
      status: "pending_payment",
      num_rooms: 1,
    };

    const rows = assigned.map((a) => ({
      ...sharedBase,
      cabin_id: a.cabinId,
      room_type: assigned.length > 1 ? `${a.cabinName} (part of ${roomTypeSummary})` : a.cabinName,
      nights: a.nights,
      subtotal: a.subtotal,
      comforter_total: a.comforterTotal,
      total_amount: a.total,
      ...(groupId ? { booking_group_id: groupId } : {}),
      ...(guestToken ? { guest_token: guestToken } : {}),
    }));

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("booking_requests")
      .insert(rows as any)
      .select("id, booking_group_id, guest_token, payment_reference, total_amount, hold_expires_at, created_at")
      .order("created_at", { ascending: true });
    if (insErr) throw new Error(insErr.message);
    if (!inserted || inserted.length === 0) throw new Error("Could not create booking");

    const lead = inserted[0];
    const total = inserted.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

    return {
      bookingId: lead.id as string,
      groupId: (lead.booking_group_id as string) ?? lead.id,
      reference: lead.payment_reference as string,
      total,
      holdExpiresAt: lead.hold_expires_at as string,
      guestToken: lead.guest_token as string,
    };
  });

const attachSchema = z.object({
  bookingId: z.string().uuid(),
  reference: z.string().min(3).max(40),
  path: z.string().min(3).max(500),
});

export const attachPaymentProof = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => attachSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.path.startsWith(`bookings/${data.bookingId}/`)) {
      throw new Error("Invalid upload path");
    }
    const { data: lead } = await supabaseAdmin
      .from("booking_requests")
      .select("id, booking_group_id, payment_reference, status, email")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!lead || lead.payment_reference !== data.reference) {
      throw new Error("Booking not found");
    }
    if (lead.status !== "pending_payment" && lead.status !== "awaiting_review") {
      throw new Error("This booking can no longer be updated");
    }
    const groupId = (lead as { booking_group_id?: string }).booking_group_id ?? lead.id;
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ payment_proof_path: data.path, status: "awaiting_review" })
      .eq("booking_group_id", groupId);
    if (error) throw new Error(error.message);

    // Group rows for the summary email
    const { data: groupRows } = await supabaseAdmin
      .from("booking_requests")
      .select("id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, cabin_id, subtotal, comforter, comforter_total, total_amount, deposit_amount, balance_amount, payment_reference, locker_code, confirmation_email_sent_at, created_at")
      .eq("booking_group_id", groupId)
      .order("created_at", { ascending: true });
    const leadRow = groupRows?.[0];
    const alreadySent = (groupRows ?? []).some((r) => r.confirmation_email_sent_at);
    if (leadRow && !alreadySent) {
      const { renderBookingSummaryEmail, enqueueEmail } = await import("./email.server");
      const totalAmount = (groupRows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
      const aggregate = {
        ...leadRow,
        total_amount: totalAmount,
        rooms: (groupRows ?? []).map((r) => ({
          name: r.room_type,
          nights: r.nights,
          total: Number(r.total_amount ?? 0),
        })),
      };
      const { subject, body } = renderBookingSummaryEmail(aggregate as never);
      await enqueueEmail(supabaseAdmin, { kind: "booking_summary", toEmail: leadRow.email, subject, body, bookingId: leadRow.id });
      await supabaseAdmin
        .from("booking_requests")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("booking_group_id", groupId);
    }
    return { ok: true };
  });

const cabinAvailSchema = z.object({
  cabinId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const getTakenDates = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cabinAvailSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("cabin_taken_dates", {
      _cabin_id: data.cabinId,
      _from: data.from,
      _to: data.to,
    });
    if (error) throw new Error(error.message);
    return { dates: (rows ?? []).map((r: { d: string }) => r.d) };
  });

const previewSchema = z.object({
  cabinId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comforter: z.boolean(),
});
export const previewPrice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => previewSchema.parse(d))
  .handler(async ({ data }) => {
    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      return { nights: 0, subtotal: 0, comforter_total: 0, total: 0 };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("compute_booking_price", {
      _cabin_id: data.cabinId,
      _check_in: data.checkIn,
      _check_out: data.checkOut,
      _comforter: data.comforter,
    });
    if (error) throw new Error(error.message);
    const r = Array.isArray(rows) ? rows[0] : rows;
    return {
      nights: Number(r?.nights ?? 0),
      subtotal: Number(r?.subtotal ?? 0),
      comforter_total: Number(r?.comforter_total ?? 0),
      total: Number(r?.total ?? 0),
    };
  });

// ============== ADMIN ==============

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("booking_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Group rows by booking_group_id so multi-room reservations show as one card
    const byGroup = new Map<string, any[]>();
    for (const row of data ?? []) {
      const gid = (row.booking_group_id as string | null) ?? row.id;
      const arr = byGroup.get(gid);
      if (arr) arr.push(row);
      else byGroup.set(gid, [row]);
    }
    const groups = Array.from(byGroup.values()).map((rows) => {
      // Order rows by created_at ascending so the lead row (first inserted) is rooms[0]
      rows.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      return rows;
    });
    // Sort groups by most recent created_at desc
    groups.sort((a, b) => +new Date(b[0].created_at) - +new Date(a[0].created_at));

    const result = await Promise.all(
      groups.map(async (rows) => {
        const lead = rows[0];
        const total_amount = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
        const subtotal = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
        const comforter_total = rows.reduce((s, r) => s + Number(r.comforter_total ?? 0), 0);
        let proofUrl: string | null = null;
        if (lead.payment_proof_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("payment-proofs")
            .createSignedUrl(lead.payment_proof_path, 60 * 60);
          proofUrl = signed?.signedUrl ?? null;
        }
        return {
          ...lead,
          total_amount,
          subtotal,
          comforter_total,
          num_rooms: rows.length,
          rooms: rows.map((r) => ({
            id: r.id,
            cabinId: r.cabin_id,
            name: r.room_type,
            nights: r.nights,
            total: Number(r.total_amount ?? 0),
          })),
          proofUrl,
        };
      }),
    );
    return { bookings: result };
  });

const idSchema = z.object({ bookingId: z.string().uuid() });

export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: context.userId,
      })
      .eq("booking_group_id", gid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "cancelled" })
      .eq("booking_group_id", gid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// First signup becomes admin automatically (one-time bootstrap)
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
      return { granted: true };
    }
    return { granted: false };
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

// ============== FIND BOOKING (lost-link recovery) ==============

const findSchema = z.object({
  email: z.string().trim().email().max(255),
  reference: z.string().trim().min(3).max(40),
});

function callerIp(): string {
  try {
    const req = getRequest();
    const h = req.headers;
    const fwd = h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for") ?? "";
    return (fwd.split(",")[0] ?? "").trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export const requestManageLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => findSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = callerIp();

    // Rate limit: 5 attempts per 15 min per IP
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("manage_link_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("requested_at", since);
    if ((count ?? 0) >= 5) {
      throw new Error("Too many attempts. Please try again in 15 minutes.");
    }
    await supabaseAdmin.from("manage_link_requests").insert({ ip } as never);

    // Look up the booking — case-insensitive match on both fields.
    const ref = data.reference.trim().toUpperCase();
    const email = data.email.trim().toLowerCase();
    const { data: rows } = await supabaseAdmin
      .from("booking_requests")
      .select("id, guest_name, email, payment_reference, check_in, room_type, status, guest_token")
      .ilike("payment_reference", ref)
      .limit(5);
    const match = (rows ?? []).find((r) => (r.email ?? "").trim().toLowerCase() === email);

    if (match && match.status !== "cancelled") {
      // Build the manage link from the request's own origin.
      let origin = "";
      try {
        const req = getRequest();
        origin = new URL(req.url).origin;
      } catch {
        origin = "";
      }
      const manageUrl = `${origin}/manage-booking?id=${match.id}&token=${match.guest_token}`;
      const subject = `Your booking link — ${match.payment_reference ?? match.id.slice(0, 8)} · Rajawali D'Cabin`;
      const body = [
        `Hi ${match.guest_name},`,
        ``,
        `Here is the link to manage your booking:`,
        manageUrl,
        ``,
        `Booking number: ${match.payment_reference ?? match.id.slice(0, 8)}`,
        `Cabin: ${match.room_type}`,
        ``,
        `If you didn't request this, you can safely ignore this email.`,
        `— Rajawali D'Cabin Chalet`,
      ].join("\n");
      const { enqueueEmail } = await import("./email.server");
      await enqueueEmail(supabaseAdmin, {
        kind: "manage_link",
        toEmail: match.email,
        subject,
        body,
        bookingId: match.id,
      });
    }

    // Always return the same response (no enumeration).
    return { ok: true };
  });

// ============== GUEST MANAGE-BOOKING ==============

const getByIdSchema = z.object({
  bookingId: z.string().uuid(),
  guestToken: z.string().uuid(),
});

export const getBookingForGuest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => getByIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b, error } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id, guest_name, email, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, balance_paid_at, payment_reference, status, locker_code, comforter, comforter_total, guest_token"
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error || !b) throw new Error("Booking not found");
    if (b.guest_token !== data.guestToken) throw new Error("Booking not found");
    const total = Number(b.total_amount ?? 0);
    const deposit = Number(b.deposit_amount ?? 50);
    const remaining = b.balance_amount != null ? Number(b.balance_amount) : Math.max(0, total - deposit);
    return {
      id: b.id,
      reference: b.payment_reference,
      guestName: b.guest_name,
      email: b.email,
      checkIn: b.check_in,
      checkOut: b.check_out,
      guests: b.guests,
      nights: b.nights,
      roomType: b.room_type,
      total,
      deposit,
      remaining,
      status: b.status,
      lockerCode: b.locker_code,
      balancePaidAt: b.balance_paid_at,
      comforter: b.comforter,
    };
  });

const balanceProofSchema = z.object({
  bookingId: z.string().uuid(),
  guestToken: z.string().uuid(),
  path: z.string().min(3).max(500),
});
export const attachBalanceProof = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => balanceProofSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.path.startsWith(`bookings/${data.bookingId}/`)) {
      throw new Error("Invalid upload path");
    }
    const { data: b } = await supabaseAdmin
      .from("booking_requests")
      .select("id, status, guest_token")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) throw new Error("Booking not found");
    if (b.guest_token !== data.guestToken) throw new Error("Booking not found");
    if (b.status === "fully_paid") throw new Error("This booking is already fully paid.");
    if (b.status === "cancelled") throw new Error("This booking is no longer active.");
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ balance_proof_path: data.path, balance_paid_at: new Date().toISOString() })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const fullyPaidSchema = z.object({
  bookingId: z.string().uuid(),
  lockerCode: z.string().trim().min(3).max(20),
});
export const markFullyPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fullyPaidSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({
        status: "fully_paid",
        locker_code: data.lockerCode,
        balance_paid_at: new Date().toISOString(),
      })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);

    const { data: full } = await supabaseAdmin
      .from("booking_requests")
      .select("id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, payment_reference, locker_code")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (full) {
      const { renderFullyPaidEmail, enqueueEmail } = await import("./email.server");
      const { subject, body } = renderFullyPaidEmail(full as never);
      await enqueueEmail(supabaseAdmin, { kind: "fully_paid", toEmail: full.email, subject, body, bookingId: full.id });
    }
    return { ok: true };
  });
