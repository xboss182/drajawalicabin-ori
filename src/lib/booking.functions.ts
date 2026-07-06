import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECURITY_DEPOSIT_PER_ROOM = 50;

function securityDepositForRooms(numRooms: number) {
  return SECURITY_DEPOSIT_PER_ROOM * numRooms;
}

function generateRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `RJW-${n}`;
}

// Strip legacy summary suffix like " (Twin room + Triple room)" from stored room_type.
function cleanRoomType(name: string | null | undefined): string {
  if (!name) return name ?? "";
  return name.replace(/\s*\([^()]*(?:\s\+\s|\s×\s)[^()]*\)\s*$/, "").trim();
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
  paymentType: z.enum(["deposit", "full"]).optional(),
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

    const isFull = (data.paymentType ?? "deposit") === "full";
    const securityDeposit = securityDepositForRooms(totalRooms);

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
      payment_type: data.paymentType ?? "deposit",
    };

    const rows = assigned.map((a) => ({
      ...sharedBase,
      cabin_id: a.cabinId,
      room_type: a.cabinName,
      nights: a.nights,
      subtotal: a.subtotal,
      comforter_total: a.comforterTotal,
      total_amount: a.total,
      deposit_amount: SECURITY_DEPOSIT_PER_ROOM,
      balance_amount: isFull ? 0 : a.total,
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
      securityDeposit,
      holdExpiresAt: lead.hold_expires_at as string,
      guestToken: lead.guest_token as string,
      paymentType: (data.paymentType ?? "deposit") as "deposit" | "full",
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
      .select("id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, cabin_id, subtotal, comforter, comforter_total, total_amount, deposit_amount, balance_amount, payment_reference, payment_type, locker_code, confirmation_email_sent_at, created_at")
      .eq("booking_group_id", groupId)
      .order("created_at", { ascending: true });
    const leadRow = groupRows?.[0];
    const alreadySent = (groupRows ?? []).some((r) => r.confirmation_email_sent_at);
    if (leadRow && !alreadySent) {
      const totalAmount = (groupRows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
      const hasOldBalance = (groupRows ?? []).some((r) => r.balance_amount == null);
      const securityDeposit = hasOldBalance
        ? Number(leadRow.deposit_amount ?? 50)
        : (groupRows ?? []).reduce((s, r) => s + Number(r.deposit_amount ?? 0), 0);
      const remaining = hasOldBalance
        ? Math.max(0, totalAmount - securityDeposit)
        : (groupRows ?? []).reduce((s, r) => s + Number(r.balance_amount ?? 0), 0);
      const templateData = {
        guestName: leadRow.guest_name,
        reference: leadRow.payment_reference ?? leadRow.id.slice(0, 8),
        roomType: cleanRoomType(leadRow.room_type),
        checkIn: leadRow.check_in,
        checkOut: leadRow.check_out,
        nights: leadRow.nights,
        guests: leadRow.guests,
        total: totalAmount,
        securityDeposit,
        remaining,
        paymentType: (leadRow as any).payment_type ?? 'deposit',
        rooms: (groupRows ?? []).map((r) => ({ name: cleanRoomType(r.room_type), total: Number(r.total_amount ?? 0) })),
      };
      const { sendTransactionalEmail, getAdminRecipients } = await import("./email/send.server");
      // Guest copy
      await sendTransactionalEmail(supabaseAdmin, {
        templateName: 'booking-summary',
        recipientEmail: leadRow.email,
        idempotencyKey: `booking-summary-${leadRow.id}-guest`,
        templateData,
      });
      // Admin copies — one per opted-in recipient
      const admins = await getAdminRecipients(supabaseAdmin, 'notify_payment_proof');
      const adminTemplateData = {
        ...templateData,
        guestEmail: leadRow.email,
        guestPhone: (leadRow as any).phone,
        bookingId: leadRow.id,
      };
      for (const adminEmail of admins) {
        await sendTransactionalEmail(supabaseAdmin, {
          templateName: 'admin-booking-alert',
          recipientEmail: adminEmail,
          idempotencyKey: `admin-booking-alert-${leadRow.id}-${adminEmail}`,
          templateData: adminTemplateData,
        });
      }
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
            name: cleanRoomType(r.room_type),
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

    // Look up payment_type — full-payment bookings skip the balance step
    const { data: typeRow } = await supabaseAdmin
      .from("booking_requests")
      .select("payment_type")
      .eq("booking_group_id", gid)
      .limit(1)
      .maybeSingle();
    const isFull = (typeRow as { payment_type?: string } | null)?.payment_type === "full";

    if (isFull) {
      const { error } = await supabaseAdmin
        .from("booking_requests")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: context.userId,
          balance_paid_at: new Date().toISOString(),
          balance_due_at: null,
        })
        .eq("booking_group_id", gid);
      if (error) throw new Error(error.message);
      return { ok: true, fullPayment: true };
    }

    // Default balance_due_at = check_in - balance_due_days_before (if not already set)
    let dueDays = 7;
    try {
      const { data: s } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "balance_due_days_before")
        .maybeSingle();
      if (s?.value != null) dueDays = Number(s.value);
    } catch {}
    const { data: lead } = await supabaseAdmin
      .from("booking_requests")
      .select("check_in, balance_due_at")
      .eq("booking_group_id", gid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    let balanceDueIso: string | null = null;
    if (lead && !lead.balance_due_at) {
      const due = new Date(lead.check_in as string);
      due.setUTCDate(due.getUTCDate() - dueDays);
      balanceDueIso = due.toISOString();
    }
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: context.userId,
        ...(balanceDueIso ? { balance_due_at: balanceDueIso } : {}),
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

// Cancel a Stripe-paid booking and refund any captured payment intents
// (deposit and/or balance). Admin only.
const cancelRefundSchema = z.object({
  bookingId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]),
});
export const cancelAndRefundBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelRefundSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);

    const { data: rows } = await supabaseAdmin
      .from("booking_requests")
      .select("id, stripe_payment_intent_id, stripe_balance_payment_intent_id, payment_method")
      .eq("booking_group_id", gid)
      .order("created_at", { ascending: true });
    const head = rows?.[0];
    if (!head) throw new Error("Booking not found");

    const refunds: Array<{ kind: string; amount: number; id: string }> = [];
    const errors: string[] = [];
    if (head.payment_method === "stripe") {
      const { createStripeClient, getStripeErrorMessage } = await import(
        "@/lib/stripe.server"
      );
      const stripe = createStripeClient(data.environment);
      const intents: Array<{ kind: string; id: string | null }> = [
        { kind: "deposit", id: (head.stripe_payment_intent_id as string | null) ?? null },
        {
          kind: "balance",
          id: (head.stripe_balance_payment_intent_id as string | null) ?? null,
        },
      ];
      for (const intent of intents) {
        if (!intent.id) continue;
        try {
          const refund = await stripe.refunds.create({ payment_intent: intent.id });
          refunds.push({
            kind: intent.kind,
            amount: (refund.amount ?? 0) / 100,
            id: refund.id,
          });
        } catch (e) {
          errors.push(`${intent.kind}: ${getStripeErrorMessage(e)}`);
        }
      }
    }

    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "cancelled" })
      .eq("booking_group_id", gid);
    if (error) throw new Error(error.message);

    return { ok: true, refunds, errors };
  });

// Hard-delete a booking (all rows in the group). Admin only.
export const deleteBooking = createServerFn({ method: "POST" })
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
      .delete()
      .eq("booking_group_id", gid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Manually add a booking on behalf of guests booked outside the site.
const adminCreateSchema = z.object({
  cabinId: z.string().uuid().optional(),
  cabinIds: z.array(z.string().uuid()).min(1).max(10).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().max(255).optional().default(""),
  guests: z.number().int().min(1).default(1),
  totalAmount: z.number().min(0).max(100000).default(0),
  notes: z.string().trim().max(1000).optional().default(""),
  status: z.enum(["confirmed", "fully_paid", "pending_payment"]).default("confirmed"),
  perRoomAmounts: z
    .array(z.object({ cabinId: z.string().uuid(), amount: z.number().min(0).max(100000) }))
    .optional(),
}).refine((v) => v.cabinId || (v.cabinIds && v.cabinIds.length > 0), {
  message: "Pick at least one cabin",
});

export const adminCreateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      throw new Error("Check-out must be after check-in");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cabinIds = data.cabinIds && data.cabinIds.length > 0
      ? data.cabinIds
      : (data.cabinId ? [data.cabinId] : []);
    if (cabinIds.length === 0) throw new Error("Pick at least one cabin");
    const { data: cabinRows, error: cErr } = await supabaseAdmin
      .from("cabins")
      .select("id, name")
      .in("id", cabinIds);
    if (cErr || !cabinRows || cabinRows.length !== cabinIds.length) {
      throw new Error("Cabin not found");
    }
    const cabinById = new Map(cabinRows.map((c) => [c.id, c]));

    const reference = `RJW-M${Math.floor(1000 + Math.random() * 9000)}`;
    const nights = Math.round(
      (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 86400000,
    );
    const groupId = globalThis.crypto?.randomUUID?.();
    const guestToken = globalThis.crypto?.randomUUID?.();
    const nowIso = new Date().toISOString();
    // Prefer explicit per-room overrides when provided; otherwise split totalAmount evenly.
    const overrideMap = new Map<string, number>();
    for (const p of data.perRoomAmounts ?? []) overrideMap.set(p.cabinId, p.amount);
    const useOverrides = overrideMap.size > 0;
    const evenPer = Math.round((data.totalAmount / cabinIds.length) * 100) / 100;
    const evenRemainder = Math.round((data.totalAmount - evenPer * cabinIds.length) * 100) / 100;
    const rows = cabinIds.map((cid, i) => {
      const cabin = cabinById.get(cid)!;
      const amount = useOverrides
        ? (overrideMap.get(cid) ?? 0)
        : (i === 0 ? evenPer + evenRemainder : evenPer);
      const row: Record<string, unknown> = {
        guest_name: data.guestName,
        email: data.email || "manual@admin.local",
        phone: data.phone || "—",
        check_in: data.checkIn,
        check_out: data.checkOut,
        guests: data.guests,
        room_type: cabin.name,
        cabin_id: cabin.id,
        nights,
        subtotal: amount,
        comforter: false,
        comforter_total: 0,
        total_amount: amount,
        deposit_amount: SECURITY_DEPOSIT_PER_ROOM,
        balance_amount: data.status === "fully_paid" ? 0 : amount,
        payment_reference: reference,
        status: data.status,
        payment_type: "full",
        num_rooms: 1,
        notes: data.notes ? `[Manual entry] ${data.notes}` : "[Manual entry]",
        confirmed_at: data.status !== "pending_payment" ? nowIso : null,
        confirmed_by: data.status !== "pending_payment" ? context.userId : null,
        balance_paid_at: data.status === "fully_paid" ? nowIso : null,
      };
      if (groupId) row.booking_group_id = groupId;
      if (guestToken) row.guest_token = guestToken;
      return row;
    });

    const { data: inserted, error } = await supabaseAdmin
      .from("booking_requests")
      .insert(rows as any)
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true, bookingId: inserted?.[0]?.id };
  });

// Grant admin role to any signed-in user whose email is on the
// active admin_email_recipients allowlist. Idempotent — safe to call on every sign-in.
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let email = String((context.claims as { email?: string }).email ?? "").trim().toLowerCase();
    if (!email) {
      const { data: u } = await context.supabase.auth.getUser();
      email = String(u?.user?.email ?? "").trim().toLowerCase();
    }

    // Bootstrap: if no admins exist yet, first signed-in user becomes admin.
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) === 0) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "admin" });
      return { granted: true };
    }

    if (!email) return { granted: false };

    // Allowlist sync: grant admin to anyone on the active recipients list.
    const { data: recipient } = await supabaseAdmin
      .from("admin_email_recipients")
      .select("id")
      .eq("is_active", true)
      .ilike("email", email)
      .maybeSingle();
    if (!recipient) return { granted: false };

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (existing) return { granted: false };

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    return { granted: true };
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

// Admin: quote room prices for a set of cabins over a date range.
// Uses compute_booking_price RPC so weekend / holiday / school-break rates apply.
const quoteSchema = z.object({
  cabinIds: z.array(z.string().uuid()).min(1).max(10),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const quoteRoomPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => quoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      throw new Error("Check-out must be after check-in");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quotes: Array<{ cabinId: string; nights: number; total: number }> = [];
    for (const cid of data.cabinIds) {
      const { data: q, error } = await supabaseAdmin.rpc("compute_booking_price", {
        _cabin_id: cid,
        _check_in: data.checkIn,
        _check_out: data.checkOut,
        _comforter: false,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(q) ? q[0] : q) as { nights: number; total: number } | null;
      quotes.push({ cabinId: cid, nights: Number(row?.nights ?? 0), total: Number(row?.total ?? 0) });
    }
    return { quotes };
  });

// Admin: update per-room amounts on an existing booking group.
const updatePricesSchema = z.object({
  bookingId: z.string().uuid(),
  rows: z.array(z.object({ id: z.string().uuid(), amount: z.number().min(0).max(100000) })).min(1),
});
export const updateBookingRoomPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updatePricesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin.data) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);
    const { data: existing, error: eErr } = await supabaseAdmin
      .from("booking_requests")
      .select("id, comforter_total, status, balance_paid_at")
      .eq("booking_group_id", gid);
    if (eErr) throw new Error(eErr.message);
    const byId = new Map((existing ?? []).map((r) => [r.id as string, r]));
    for (const r of data.rows) {
      const cur = byId.get(r.id);
      if (!cur) throw new Error("Row not in this booking");
      const comforter = Number(cur.comforter_total ?? 0);
      const total = Math.round((r.amount + comforter) * 100) / 100;
      const isPaid = cur.status === "fully_paid" || cur.balance_paid_at;
      const patch: Record<string, unknown> = {
        subtotal: r.amount,
        total_amount: total,
        balance_amount: isPaid ? 0 : total,
      };
      const { error: uErr } = await supabaseAdmin
        .from("booking_requests")
        .update(patch as never)
        .eq("id", r.id);
      if (uErr) throw new Error(uErr.message);
    }
    return { ok: true };
  });

// Admin gate: signed-in user's email must be on the admin_email_recipients allowlist.
export const isAdminRecipient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let email = String((context.claims as { email?: string }).email ?? "").trim().toLowerCase();
    if (!email) {
      const { data: u } = await context.supabase.auth.getUser();
      email = String(u?.user?.email ?? "").trim().toLowerCase();
    }
    if (!email) return { allowed: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_email_recipients")
      .select("id")
      .eq("is_active", true)
      .ilike("email", email)
      .maybeSingle();
    return { allowed: Boolean(data) };
  });

// Customer lookup: view manage-booking by email + reference without an email link.
const lookupSchema = z.object({
  email: z.string().trim().email().max(255),
  reference: z.string().trim().min(3).max(40),
});
export const getBookingByEmailAndReference = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = callerIp();

    // Rate limit: 5 attempts per 15 min per IP (shared with manage-link recovery)
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

    const ref = data.reference.trim().toUpperCase();
    const email = data.email.trim().toLowerCase();
    const { data: rows } = await supabaseAdmin
      .from("booking_requests")
      .select("id, booking_group_id, email, payment_reference, guest_token, status, created_at")
      .ilike("payment_reference", ref)
      .order("created_at", { ascending: true })
      .limit(20);
    const seen = new Set<string>();
    const leads = (rows ?? []).filter((r) => {
      const gid = (r.booking_group_id as string) ?? r.id;
      if (seen.has(gid)) return false;
      seen.add(gid);
      return true;
    });
    const match = leads.find(
      (r) => (r.email ?? "").trim().toLowerCase() === email && r.status !== "cancelled",
    );
    if (!match) throw new Error("No booking matches that email and reference.");
    return { bookingId: match.id as string, guestToken: match.guest_token as string };
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
      .select("id, booking_group_id, guest_name, email, payment_reference, check_in, room_type, status, guest_token, created_at")
      .ilike("payment_reference", ref)
      .order("created_at", { ascending: true })
      .limit(20);
    // Dedupe by group (one manage link per reservation), keep first row in each group
    const seen = new Set<string>();
    const groupLeads = (rows ?? []).filter((r) => {
      const gid = (r.booking_group_id as string) ?? r.id;
      if (seen.has(gid)) return false;
      seen.add(gid);
      return true;
    });
    const match = groupLeads.find((r) => (r.email ?? "").trim().toLowerCase() === email);

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
      const reference = match.payment_reference ?? match.id.slice(0, 8);
      const { sendTransactionalEmail } = await import("./email/send.server");
      await sendTransactionalEmail(supabaseAdmin, {
        templateName: "manage-link",
        recipientEmail: match.email,
        idempotencyKey: `manage-link-${match.id}-${Date.now()}`,
        templateData: {
          guestName: match.guest_name,
          reference,
          roomType: cleanRoomType(match.room_type),
          manageUrl,
        },
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
    const { data: lead, error } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id, booking_group_id, guest_token"
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error || !lead) throw new Error("Booking not found");
    if (lead.guest_token !== data.guestToken) throw new Error("Booking not found");
    const gid = (lead.booking_group_id as string) ?? lead.id;
    const { data: rows } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id, guest_name, email, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, balance_paid_at, payment_reference, status, locker_code, comforter, comforter_total, guest_token, created_at"
      )
      .eq("booking_group_id", gid)
      .order("created_at", { ascending: true });
    if (!rows || rows.length === 0) throw new Error("Booking not found");
    const head = rows[0];
    const total = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const hasOldBalance = rows.some((r) => r.balance_amount == null);
    const securityDeposit = hasOldBalance
      ? Number(head.deposit_amount ?? 50)
      : rows.reduce((s, r) => s + Number(r.deposit_amount ?? 0), 0);
    const remaining = hasOldBalance
      ? Math.max(0, total - securityDeposit)
      : rows.reduce((s, r) => s + Number(r.balance_amount ?? 0), 0);
    return {
      id: head.id,
      reference: head.payment_reference,
      guestName: head.guest_name,
      email: head.email,
      checkIn: head.check_in,
      checkOut: head.check_out,
      guests: head.guests,
      nights: head.nights,
      roomType: rows.map((r) => cleanRoomType(r.room_type)).join(", "),
      rooms: rows.map((r) => ({ id: r.id, name: cleanRoomType(r.room_type), nights: r.nights, total: Number(r.total_amount ?? 0) })),
      total,
      securityDeposit,
      remaining,
      status: head.status,
      lockerCode: head.locker_code,
      balancePaidAt: head.balance_paid_at,
      comforter: head.comforter,
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
      .select("id, status, guest_token, booking_group_id")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) throw new Error("Booking not found");
    if (b.guest_token !== data.guestToken) throw new Error("Booking not found");
    if (b.status === "fully_paid") throw new Error("This booking is already fully paid.");
    if (b.status === "cancelled") throw new Error("This booking is no longer active.");
    const gid = (b.booking_group_id as string) ?? b.id;
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ balance_proof_path: data.path, balance_paid_at: new Date().toISOString(), balance_amount: 0 })
      .eq("booking_group_id", gid);
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
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({
        status: "fully_paid",
        locker_code: data.lockerCode,
        balance_paid_at: new Date().toISOString(),
        balance_amount: 0,
      })
      .eq("booking_group_id", gid);
    if (error) throw new Error(error.message);

    const { data: rows } = await supabaseAdmin
      .from("booking_requests")
      .select("id, guest_name, email, phone, check_in, check_out, guests, nights, room_type, total_amount, deposit_amount, balance_amount, payment_reference, locker_code, created_at")
      .eq("booking_group_id", gid)
      .order("created_at", { ascending: true });
    const head = rows?.[0];
    if (head) {
      const total = (rows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
      const templateData = {
        guestName: head.guest_name,
        reference: head.payment_reference ?? head.id.slice(0, 8),
        checkIn: head.check_in,
        checkOut: head.check_out,
        rooms: (rows ?? []).map((r) => cleanRoomType(r.room_type)).join(', '),
        lockerCode: head.locker_code,
      };
      void total;
      const { sendTransactionalEmail, getAdminRecipients } = await import("./email/send.server");
      await sendTransactionalEmail(supabaseAdmin, {
        templateName: 'fully-paid',
        recipientEmail: head.email,
        idempotencyKey: `fully-paid-${head.id}-guest`,
        templateData,
      });
      const admins = await getAdminRecipients(supabaseAdmin, 'notify_fully_paid');
      for (const adminEmail of admins) {
        await sendTransactionalEmail(supabaseAdmin, {
          templateName: 'fully-paid',
          recipientEmail: adminEmail,
          idempotencyKey: `fully-paid-${head.id}-${adminEmail}`,
          templateData,
        });
      }
    }
    return { ok: true };
  });

// ============== ADMIN: invoice / balance schedule ==============

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const getInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);
    const { data: rows, error } = await supabaseAdmin
      .from("booking_requests")
      .select("*")
      .eq("booking_group_id", gid)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Booking not found");
    const head: any = rows[0];
    let depositProofUrl: string | null = null;
    let balanceProofUrl: string | null = null;
    if (head.payment_proof_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("payment-proofs")
        .createSignedUrl(head.payment_proof_path, 60 * 60);
      depositProofUrl = signed?.signedUrl ?? null;
    }
    if (head.balance_proof_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("payment-proofs")
        .createSignedUrl(head.balance_proof_path, 60 * 60);
      balanceProofUrl = signed?.signedUrl ?? null;
    }
    const total = rows.reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0);
    const subtotal = rows.reduce((s, r: any) => s + Number(r.subtotal ?? 0), 0);
    const comforter_total = rows.reduce((s, r: any) => s + Number(r.comforter_total ?? 0), 0);
    const hasOldBalance = rows.some((r: any) => r.balance_amount == null);
    const securityDeposit = hasOldBalance
      ? Number(head.deposit_amount ?? 50)
      : rows.reduce((s, r: any) => s + Number(r.deposit_amount ?? 0), 0);
    const balance = hasOldBalance
      ? Math.max(0, total - securityDeposit)
      : rows.reduce((s, r: any) => s + Number(r.balance_amount ?? 0), 0);
    return {
      id: head.id,
      groupId: gid,
      reference: head.payment_reference,
      status: head.status,
      guest_name: head.guest_name,
      email: head.email,
      phone: head.phone,
      check_in: head.check_in,
      check_out: head.check_out,
      nights: head.nights,
      guests: head.guests,
      comforter: head.comforter,
      notes: head.notes,
      created_at: head.created_at,
      confirmed_at: head.confirmed_at,
      balance_paid_at: head.balance_paid_at,
      balance_due_at: head.balance_due_at,
      locker_code: head.locker_code,
      total,
      subtotal,
      comforter_total,
      securityDeposit,
      balance,
      depositProofUrl,
      balanceProofUrl,
      rooms: rows.map((r: any) => ({
        id: r.id,
        cabinId: r.cabin_id,
        name: cleanRoomType(r.room_type),
        nights: r.nights,
        subtotal: Number(r.subtotal ?? 0),
        comforterTotal: Number(r.comforter_total ?? 0),
        total: Number(r.total_amount ?? 0),
      })),
    };
  });

export const setBalanceDueAt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ bookingId: z.string().uuid(), dueAt: z.string().min(8).max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gid = await groupIdFor(supabaseAdmin, data.bookingId);
    const iso = new Date(data.dueAt).toISOString();
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ balance_due_at: iso })
      .eq("booking_group_id", gid);
    if (error) throw new Error(error.message);
    return { ok: true, balance_due_at: iso };
  });

// ============== ADMIN: occupancy calendar ==============

export const getOccupancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cabins } = await supabaseAdmin
      .from("cabins")
      .select("id, name, cabin_type, is_active");
    const totalsByType = new Map<string, number>();
    for (const c of cabins ?? []) {
      if (!c.is_active) continue;
      totalsByType.set(c.cabin_type, (totalsByType.get(c.cabin_type) ?? 0) + 1);
    }

    const { data: bookings } = await supabaseAdmin
      .from("booking_requests")
      .select(
        "id, booking_group_id, payment_reference, guest_name, status, check_in, check_out, cabin_id, room_type, hold_expires_at, total_amount",
      )
      .lt("check_in", data.to)
      .gt("check_out", data.from)
      .in("status", ["pending_payment", "awaiting_review", "confirmed", "fully_paid"]);

    const { data: holidayRows } = await supabaseAdmin
      .from("school_holidays")
      .select("label, starts_on, ends_on, kind")
      .lte("starts_on", data.to)
      .gte("ends_on", data.from);

    const cabinById = new Map<string, { name: string; cabin_type: string }>();
    for (const c of cabins ?? []) cabinById.set(c.id, { name: c.name, cabin_type: c.cabin_type });

    // Build per-date map
    const days: Record<
      string,
      {
        date: string;
        byType: Record<
          string,
          {
            booked: number;
            total: number;
            bookings: Array<{
              id: string;
              reference: string | null;
              guest: string;
              cabin: string;
              status: string;
              total: number;
            }>;
          }
        >;
      }
    > = {};

    const start = new Date(data.from + "T00:00:00Z");
    const end = new Date(data.to + "T00:00:00Z");
    for (let t = new Date(start); t < end; t.setUTCDate(t.getUTCDate() + 1)) {
      const ds = t.toISOString().slice(0, 10);
      const byType: any = {};
      for (const [type, total] of totalsByType.entries()) {
        byType[type] = { booked: 0, total, bookings: [] };
      }
      days[ds] = { date: ds, byType };
    }

    const now = Date.now();
    for (const b of bookings ?? []) {
      // pending_payment expired → skip
      if (
        b.status === "pending_payment" &&
        b.hold_expires_at &&
        new Date(b.hold_expires_at).getTime() <= now
      ) {
        continue;
      }
      const cabin = b.cabin_id ? cabinById.get(b.cabin_id) : null;
      if (!cabin) continue;
      const from = new Date(b.check_in + "T00:00:00Z");
      const to = new Date(b.check_out + "T00:00:00Z");
      for (let t = new Date(from); t < to; t.setUTCDate(t.getUTCDate() + 1)) {
        const ds = t.toISOString().slice(0, 10);
        const day = days[ds];
        if (!day) continue;
        const slot = day.byType[cabin.cabin_type];
        if (!slot) continue;
        slot.booked += 1;
        slot.bookings.push({
          id: b.id,
          reference: b.payment_reference,
          guest: b.guest_name,
          cabin: cabin.name,
          status: b.status,
          total: Number(b.total_amount ?? 0),
        });
      }
    }
    // Attach holiday info per day
    const daysWithHolidays: Record<
      string,
      (typeof days)[string] & {
        holidays: Array<{ label: string; kind: "public_holiday" | "school_break" }>;
      }
    > = {};
    for (const [ds, d] of Object.entries(days)) {
      daysWithHolidays[ds] = { ...d, holidays: [] };
    }
    for (const h of holidayRows ?? []) {
      const hs = new Date(h.starts_on + "T00:00:00Z");
      const he = new Date(h.ends_on + "T00:00:00Z");
      for (let t = new Date(hs); t <= he; t.setUTCDate(t.getUTCDate() + 1)) {
        const ds = t.toISOString().slice(0, 10);
        const d = daysWithHolidays[ds];
        if (!d) continue;
        d.holidays.push({
          label: h.label,
          kind: (h.kind ?? "school_break") as "public_holiday" | "school_break",
        });
      }
    }
    return { days: Object.values(daysWithHolidays) };
  });

// ============== ADMIN: recipients ==============

export const listAdminRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_email_recipients")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { recipients: data ?? [] };
  });

export const upsertAdminRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        email: z.string().trim().email().max(255),
        label: z.string().trim().max(80).optional().nullable(),
        notify_new_booking: z.boolean(),
        notify_payment_proof: z.boolean(),
        notify_fully_paid: z.boolean(),
        is_active: z.boolean(),
        password: z.string().min(8).max(128).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      email: data.email.toLowerCase(),
      label: data.label ?? null,
      notify_new_booking: data.notify_new_booking,
      notify_payment_proof: data.notify_payment_proof,
      notify_fully_paid: data.notify_fully_paid,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("admin_email_recipients")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("admin_email_recipients")
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    // If a password was provided, create or update the Supabase auth user
    // for this email so they can sign in with email + password.
    if (data.password) {
      const email = data.email.toLowerCase();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Find existing auth user by email (paginate defensively)
      let existingId: string | null = null;
      for (let page = 1; page <= 20 && !existingId; page++) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listErr) throw new Error(listErr.message);
        const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (found) existingId = found.id;
        if (list.users.length < 200) break;
      }
      if (existingId) {
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: data.password,
          email_confirm: true,
        });
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
        });
        if (createErr) throw new Error(createErr.message);
      }
    }

    return { ok: true };
  });

export const deleteAdminRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("admin_email_recipients")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== ADMIN: app settings ==============

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("key, value");
    if (error) throw new Error(error.message);
    const map: Record<string, any> = {};
    for (const r of data ?? []) map[r.key] = r.value;
    return {
      deposit_amount_default: Number(map.deposit_amount_default ?? 50),
      balance_due_days_before: Number(map.balance_due_days_before ?? 7),
    };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        deposit_amount_default: z.number().min(0).max(10000),
        balance_due_days_before: z.number().int().min(0).max(365),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const entries = [
      { key: "deposit_amount_default", value: data.deposit_amount_default as any },
      { key: "balance_due_days_before", value: data.balance_due_days_before as any },
    ];
    for (const e of entries) {
      const { error } = await context.supabase
        .from("app_settings")
        .upsert({ key: e.key, value: e.value, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============== ADMIN: cabin management ==============

export const listCabinsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cabins")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { cabins: data ?? [] };
  });

const cabinSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(80),
  cabin_type: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(19),
  weekday_rate: z.number().min(0).max(100000),
  weekend_rate: z.number().min(0).max(100000),
  school_holiday_rate: z.number().min(0).max(100000),
  description: z.string().max(2000).optional().nullable(),
  display_order: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
});

export const upsertCabin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cabinSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("cabins").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("cabins").insert(rest);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setCabinActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cabins")
      .update({ is_active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== ADMIN: school holidays ==============

export const listHolidays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("school_holidays")
      .select("*")
      .order("starts_on", { ascending: true });
    if (error) throw new Error(error.message);
    return { holidays: data ?? [] };
  });

const holidaySchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(120),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["public_holiday", "school_break"]).default("school_break"),
});

export const upsertHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => holidaySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.ends_on < data.starts_on) throw new Error("End date must be after start date");
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("school_holidays").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("school_holidays").insert(rest);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("school_holidays").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedHolidays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Curated Malaysian federal public holidays + MOE school breaks through
    // end of next year. Islamic/lunar dates are best-effort estimates —
    // admins can edit or delete inaccurate rows.
    const rows: Array<{
      label: string;
      starts_on: string;
      ends_on: string;
      kind: "public_holiday" | "school_break";
    }> = [
      // ===== 2026 =====
      { label: "New Year's Day", starts_on: "2026-01-01", ends_on: "2026-01-01", kind: "public_holiday" },
      { label: "Chinese New Year", starts_on: "2026-02-17", ends_on: "2026-02-18", kind: "public_holiday" },
      { label: "Hari Raya Aidilfitri", starts_on: "2026-03-20", ends_on: "2026-03-21", kind: "public_holiday" },
      { label: "Labour Day", starts_on: "2026-05-01", ends_on: "2026-05-01", kind: "public_holiday" },
      { label: "Wesak Day", starts_on: "2026-05-01", ends_on: "2026-05-01", kind: "public_holiday" },
      { label: "Agong's Birthday", starts_on: "2026-06-01", ends_on: "2026-06-01", kind: "public_holiday" },
      { label: "Hari Raya Haji", starts_on: "2026-05-27", ends_on: "2026-05-27", kind: "public_holiday" },
      { label: "Awal Muharram", starts_on: "2026-06-16", ends_on: "2026-06-16", kind: "public_holiday" },
      { label: "Merdeka Day", starts_on: "2026-08-31", ends_on: "2026-08-31", kind: "public_holiday" },
      { label: "Maulidur Rasul", starts_on: "2026-08-25", ends_on: "2026-08-25", kind: "public_holiday" },
      { label: "Malaysia Day", starts_on: "2026-09-16", ends_on: "2026-09-16", kind: "public_holiday" },
      { label: "Deepavali", starts_on: "2026-11-08", ends_on: "2026-11-08", kind: "public_holiday" },
      { label: "Christmas Day", starts_on: "2026-12-25", ends_on: "2026-12-25", kind: "public_holiday" },
      // 2026 school breaks (approx MOE calendar)
      { label: "School Break — Term 1", starts_on: "2026-03-14", ends_on: "2026-03-22", kind: "school_break" },
      { label: "School Break — Term 2", starts_on: "2026-05-23", ends_on: "2026-06-07", kind: "school_break" },
      { label: "School Break — Term 3", starts_on: "2026-08-22", ends_on: "2026-08-30", kind: "school_break" },
      { label: "School Break — Year End", starts_on: "2026-12-12", ends_on: "2027-01-03", kind: "school_break" },

      // ===== 2027 =====
      { label: "New Year's Day", starts_on: "2027-01-01", ends_on: "2027-01-01", kind: "public_holiday" },
      { label: "Chinese New Year", starts_on: "2027-02-06", ends_on: "2027-02-07", kind: "public_holiday" },
      { label: "Hari Raya Aidilfitri", starts_on: "2027-03-10", ends_on: "2027-03-11", kind: "public_holiday" },
      { label: "Labour Day", starts_on: "2027-05-01", ends_on: "2027-05-01", kind: "public_holiday" },
      { label: "Wesak Day", starts_on: "2027-05-20", ends_on: "2027-05-20", kind: "public_holiday" },
      { label: "Hari Raya Haji", starts_on: "2027-05-17", ends_on: "2027-05-17", kind: "public_holiday" },
      { label: "Agong's Birthday", starts_on: "2027-06-07", ends_on: "2027-06-07", kind: "public_holiday" },
      { label: "Awal Muharram", starts_on: "2027-06-06", ends_on: "2027-06-06", kind: "public_holiday" },
      { label: "Maulidur Rasul", starts_on: "2027-08-15", ends_on: "2027-08-15", kind: "public_holiday" },
      { label: "Merdeka Day", starts_on: "2027-08-31", ends_on: "2027-08-31", kind: "public_holiday" },
      { label: "Malaysia Day", starts_on: "2027-09-16", ends_on: "2027-09-16", kind: "public_holiday" },
      { label: "Deepavali", starts_on: "2027-10-28", ends_on: "2027-10-28", kind: "public_holiday" },
      { label: "Christmas Day", starts_on: "2027-12-25", ends_on: "2027-12-25", kind: "public_holiday" },
      { label: "School Break — Term 1", starts_on: "2027-03-13", ends_on: "2027-03-21", kind: "school_break" },
      { label: "School Break — Term 2", starts_on: "2027-05-29", ends_on: "2027-06-13", kind: "school_break" },
      { label: "School Break — Term 3", starts_on: "2027-08-21", ends_on: "2027-08-29", kind: "school_break" },
      { label: "School Break — Year End", starts_on: "2027-12-11", ends_on: "2028-01-02", kind: "school_break" },
    ];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("school_holidays")
      .select("label, starts_on");
    const seen = new Set(
      (existing ?? []).map((r: any) => `${r.label}::${r.starts_on}`),
    );
    const toInsert = rows.filter((r) => !seen.has(`${r.label}::${r.starts_on}`));
    let inserted = 0;
    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from("school_holidays").insert(toInsert);
      if (error) throw new Error(error.message);
      inserted = toInsert.length;
    }
    return { inserted, skipped: rows.length - toInsert.length };
  });

// ============== ADMIN: stats + email log ==============

export const getBookingStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("booking_requests")
      .select("booking_group_id, status, total_amount, deposit_amount, nights, room_type, cabin_id, created_at, check_in, check_out, guests, notes")
      .gte("created_at", data.from)
      .lte("created_at", data.to + "T23:59:59");
    if (error) throw new Error(error.message);

    const seenGroups = new Set<string>();
    let reservations = 0;
    let confirmedRevenue = 0;
    let depositRevenue = 0;
    let nightsSold = 0;
    let adults = 0;
    let kids = 0;
    const byType = new Map<string, { reservations: number; nights: number; revenue: number }>();
    const byMonth = new Map<
      string,
      { reservations: number; nights: number; revenue: number; adults: number; kids: number }
    >();
    const seenGroupsPerMonth = new Map<string, Set<string>>();

    const { data: cabins } = await supabaseAdmin.from("cabins").select("id, cabin_type, is_active");
    const typeByCabin = new Map<string, string>();
    let activeCabins = 0;
    for (const c of cabins ?? []) {
      typeByCabin.set(c.id, c.cabin_type);
      if (c.is_active) activeCabins++;
    }

    for (const r of rows ?? []) {
      const gid = (r.booking_group_id as string) ?? "";
      if (!seenGroups.has(gid)) {
        seenGroups.add(gid);
        reservations++;
      }
      const active = ["confirmed", "fully_paid", "awaiting_review"].includes(r.status as string);
      if (active) {
        confirmedRevenue += Number(r.total_amount ?? 0);
        depositRevenue += Number(r.deposit_amount ?? 0);
        nightsSold += Number(r.nights ?? 0);
        const rowAdults = Number(r.guests ?? 0);
        const kidsMatch = /(\d+)\s*(?:kid|child|children)/i.exec(String(r.notes ?? ""));
        const rowKids = kidsMatch ? Number(kidsMatch[1]) : 0;
        adults += rowAdults;
        kids += rowKids;
        const type = (r.cabin_id ? typeByCabin.get(r.cabin_id) : null) ?? "Unknown";
        const slot = byType.get(type) ?? { reservations: 0, nights: 0, revenue: 0 };
        slot.reservations += 1;
        slot.nights += Number(r.nights ?? 0);
        slot.revenue += Number(r.total_amount ?? 0);
        byType.set(type, slot);

        // Group by check-in month (YYYY-MM)
        const ci = String(r.check_in ?? r.created_at ?? "").slice(0, 7);
        if (ci) {
          const mSlot = byMonth.get(ci) ?? {
            reservations: 0,
            nights: 0,
            revenue: 0,
            adults: 0,
            kids: 0,
          };
          const monthGroups = seenGroupsPerMonth.get(ci) ?? new Set<string>();
          if (!monthGroups.has(gid)) {
            monthGroups.add(gid);
            mSlot.reservations += 1;
            seenGroupsPerMonth.set(ci, monthGroups);
          }
          mSlot.nights += Number(r.nights ?? 0);
          mSlot.revenue += Number(r.total_amount ?? 0);
          mSlot.adults += rowAdults;
          mSlot.kids += rowKids;
          byMonth.set(ci, mSlot);
        }
      }
    }

    const dayCount =
      Math.max(
        1,
        Math.ceil(
          (new Date(data.to).getTime() - new Date(data.from).getTime()) / 86400000,
        ) + 1,
      );
    const capacity = activeCabins * dayCount;
    const occupancy = capacity > 0 ? nightsSold / capacity : 0;

    return {
      reservations,
      confirmedRevenue,
      depositRevenue,
      nightsSold,
      occupancy,
      activeCabins,
      dayCount,
      adults,
      kids,
      capacity,
      byType: Array.from(byType, ([type, v]) => ({ type, ...v })),
      byMonth: Array.from(byMonth, ([month, v]) => ({ month, ...v })).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    };
  });

export const listEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kind: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read Lovable Emails send log; dedupe by message_id (latest row wins).
    // Fall back gracefully to the legacy email_outbox table if the new one is empty.
    const { data: logRows, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at, metadata")
      .gte("created_at", data.from)
      .lte("created_at", data.to + "T23:59:59")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    // Latest status per message_id (rows are already sorted desc by created_at).
    const latest = new Map<string, typeof logRows[number]>();
    for (const r of logRows ?? []) {
      const key = r.message_id ?? r.id;
      if (!latest.has(key)) latest.set(key, r);
    }
    const unified = Array.from(latest.values()).map((r) => ({
      id: r.id,
      kind: r.template_name,
      to_email: r.recipient_email,
      subject: (r.metadata as { subject?: string } | null)?.subject ?? "",
      status: r.status,
      sent_at: r.status === "sent" ? r.created_at : null,
      error: r.error_message,
      created_at: r.created_at,
      booking_id: (r.metadata as { booking_id?: string } | null)?.booking_id ?? null,
    }));

    // Fallback: if no queue rows, show legacy outbox (older bookings).
    let combined = unified;
    if (unified.length === 0) {
      const { data: legacy } = await supabaseAdmin
        .from("email_outbox")
        .select("id, kind, to_email, subject, status, sent_at, error, created_at, booking_id")
        .gte("created_at", data.from)
        .lte("created_at", data.to + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(2000);
      combined = (legacy ?? []).map((r) => ({ ...r, subject: r.subject ?? "" })) as typeof unified;
    }

    const filtered = combined.filter((r) => {
      if (data.kind && r.kind !== data.kind) return false;
      if (data.status) {
        if (data.status === "failed" && !(r.status === "failed" || r.status === "dlq" || r.status === "bounced" || r.status === "complained")) return false;
        if (data.status !== "failed" && r.status !== data.status) return false;
      }
      return true;
    });

    const kinds = Array.from(new Set(combined.map((r) => r.kind))).sort();
    const summary = { total: filtered.length, sent: 0, failed: 0, pending: 0 };
    for (const r of filtered) {
      if (r.status === "sent") summary.sent += 1;
      else if (r.status === "failed" || r.status === "dlq" || r.status === "bounced" || r.status === "complained") summary.failed += 1;
      else summary.pending += 1;
    }

    const paged = filtered.slice(data.offset, data.offset + 50);
    return { rows: paged, totalCount: filtered.length, kinds, summary };
  });

// ============== PUBLIC: recommend best-fit cabins for "Any cabin" ==============

const recommendSchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(12),
  comforter: z.boolean().optional(),
});

export const recommendCabins = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recommendSchema.parse(d))
  .handler(async ({ data }) => {
    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      return { picks: [] };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Last booked night (checkout is exclusive)
    const co = new Date(data.checkOut);
    co.setUTCDate(co.getUTCDate() - 1);
    const lastNightStr = co.toISOString().slice(0, 10);

    // Fetch all active cabins (we'll filter / combine below)
    const { data: cabins, error } = await supabaseAdmin
      .from("cabins")
      .select("id, name, cabin_type, capacity, weekday_rate, weekend_rate, school_holiday_rate")
      .eq("is_active", true)
      .order("capacity");
    if (error) throw new Error(error.message);
    if (!cabins || cabins.length === 0) return { picks: [] };

    type Pick = {
      cabinId: string;
      cabinType: string;
      name: string;
      capacity: number;
      nights: number;
      total: number;
      score: number;
      combo?: Array<{ cabinType: string; name: string; capacity: number }>;
    };
    // Compute availability + price once per cabin
    type Available = {
      id: string;
      cabinType: string;
      name: string;
      capacity: number;
      nights: number;
      total: number;
    };
    const available: Available[] = [];
    for (const c of cabins) {
      const { data: taken } = await supabaseAdmin.rpc("cabin_taken_dates", {
        _cabin_id: c.id,
        _from: data.checkIn,
        _to: lastNightStr,
      });
      if (taken && taken.length > 0) continue;
      const { data: priceRows } = await supabaseAdmin.rpc("compute_booking_price", {
        _cabin_id: c.id,
        _check_in: data.checkIn,
        _check_out: data.checkOut,
        _comforter: data.comforter ?? false,
      });
      const price = Array.isArray(priceRows) ? priceRows[0] : priceRows;
      if (!price) continue;
      available.push({
        id: c.id,
        cabinType: c.cabin_type,
        name: c.name.replace(/\s*\d+\s*$/, "").trim(),
        capacity: Number(c.capacity),
        nights: Number(price.nights),
        total: Number(price.total),
      });
    }

    // Single-cabin picks (capacity fits whole party), one best per type
    const byType = new Map<string, Pick>();
    for (const a of available) {
      if (a.capacity < data.guests) continue;
      const score = (a.capacity - data.guests) * 1000 + a.total;
      const existing = byType.get(a.cabinType);
      if (!existing || score < existing.score) {
        byType.set(a.cabinType, {
          cabinId: a.id,
          cabinType: a.cabinType,
          name: a.name,
          capacity: a.capacity,
          nights: a.nights,
          total: a.total,
          score,
        });
      }
    }
    let picks = Array.from(byType.values())
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    // If nothing fits as a single room, suggest 2-room combos
    if (picks.length === 0 && available.length >= 2) {
      // One representative per cabin_type (cheapest first)
      const reps = new Map<string, Available>();
      for (const a of [...available].sort((x, y) => x.total - y.total)) {
        if (!reps.has(a.cabinType)) reps.set(a.cabinType, a);
      }
      const repList = Array.from(reps.values());
      const combos: Pick[] = [];
      // Same-type pair (need >=2 free in that type)
      const freeCountByType = new Map<string, number>();
      for (const a of available) freeCountByType.set(a.cabinType, (freeCountByType.get(a.cabinType) ?? 0) + 1);
      for (const r of repList) {
        if ((freeCountByType.get(r.cabinType) ?? 0) < 2) continue;
        const cap = r.capacity * 2;
        if (cap < data.guests) continue;
        combos.push({
          cabinId: `${r.id}x2`,
          cabinType: r.cabinType,
          name: `${r.name} ×2`,
          capacity: cap,
          nights: r.nights,
          total: r.total * 2,
          score: (cap - data.guests) * 1000 + r.total * 2,
          combo: [
            { cabinType: r.cabinType, name: r.name, capacity: r.capacity },
            { cabinType: r.cabinType, name: r.name, capacity: r.capacity },
          ],
        });
      }
      // Mixed-type pair
      for (let i = 0; i < repList.length; i++) {
        for (let j = i + 1; j < repList.length; j++) {
          const a = repList[i];
          const b = repList[j];
          const cap = a.capacity + b.capacity;
          if (cap < data.guests) continue;
          combos.push({
            cabinId: `${a.id}+${b.id}`,
            cabinType: a.cabinType,
            name: `${a.name} + ${b.name}`,
            capacity: cap,
            nights: a.nights,
            total: a.total + b.total,
            score: (cap - data.guests) * 1000 + (a.total + b.total),
            combo: [
              { cabinType: a.cabinType, name: a.name, capacity: a.capacity },
              { cabinType: b.cabinType, name: b.name, capacity: b.capacity },
            ],
          });
        }
      }
      picks = combos.sort((x, y) => x.score - y.score).slice(0, 3);
    }

    return { picks };
  });
