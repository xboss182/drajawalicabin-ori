import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function generateRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `RJW-${n}`;
}

const createSchema = z.object({
  cabinId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(12),
  numRooms: z.number().int().min(1).max(8).default(1),
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

    // Availability check
    const { data: taken, error: takenErr } = await supabaseAdmin.rpc("cabin_taken_dates", {
      _cabin_id: data.cabinId,
      _from: data.checkIn,
      _to: data.checkOut,
    });
    if (takenErr) throw new Error(takenErr.message);
    if (taken && taken.length > 0) {
      throw new Error("Sorry, those dates were just taken. Please pick different dates.");
    }

    // Price computation
    const { data: priceRows, error: priceErr } = await supabaseAdmin.rpc("compute_booking_price", {
      _cabin_id: data.cabinId,
      _check_in: data.checkIn,
      _check_out: data.checkOut,
      _comforter: data.comforter,
    });
    if (priceErr) throw new Error(priceErr.message);
    const price = Array.isArray(priceRows) ? priceRows[0] : priceRows;
    if (!price) throw new Error("Could not compute price");

    // Get cabin name for room_type
    const { data: cabin } = await supabaseAdmin
      .from("cabins")
      .select("name")
      .eq("id", data.cabinId)
      .maybeSingle();

    const reference = generateRef();
    const holdMinutes = 30;
    const holdExpires = new Date(Date.now() + holdMinutes * 60_000).toISOString();

    const insertPayload = {
      guest_name: data.guestName,
      email: data.email,
      phone: data.phone,
      check_in: data.checkIn,
      check_out: data.checkOut,
      guests: data.guests,
      num_rooms: data.numRooms,
      room_type: cabin?.name ?? "Cabin",
      notes: data.notes ?? null,
      relationship: data.relationship ?? null,
      vehicle_type: data.vehicleType ?? null,
      vehicle_number: data.vehicleNumber ?? null,
      cabin_id: data.cabinId,
      nights: price.nights,
      subtotal: price.subtotal,
      comforter: data.comforter,
      comforter_total: price.comforter_total,
      total_amount: price.total,
      payment_reference: reference,
      hold_expires_at: holdExpires,
      status: "pending_payment",
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("booking_requests")
      .insert(insertPayload as any)
      .select("id, payment_reference, total_amount, hold_expires_at")
      .single();
    if (insErr) throw new Error(insErr.message);

    return {
      bookingId: inserted.id as string,
      reference: inserted.payment_reference as string,
      total: Number(inserted.total_amount),
      holdExpiresAt: inserted.hold_expires_at as string,
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
    const { data: booking } = await supabaseAdmin
      .from("booking_requests")
      .select("id, payment_reference, status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking || booking.payment_reference !== data.reference) {
      throw new Error("Booking not found");
    }
    if (booking.status !== "pending_payment" && booking.status !== "awaiting_review") {
      throw new Error("This booking can no longer be updated");
    }
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ payment_proof_path: data.path, status: "awaiting_review" })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
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

    // sign proof urls
    const withUrls = await Promise.all(
      (data ?? []).map(async (b) => {
        let proofUrl: string | null = null;
        if (b.payment_proof_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("payment-proofs")
            .createSignedUrl(b.payment_proof_path, 60 * 60);
          proofUrl = signed?.signedUrl ?? null;
        }
        return { ...b, proofUrl };
      }),
    );
    return { bookings: withUrls };
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
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: context.userId,
      })
      .eq("id", data.bookingId);
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
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId);
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
