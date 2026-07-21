import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any): Promise<{ email: string; userId: string }> {
  const userId: string = context.userId;
  let email = String((context.claims as { email?: string }).email ?? "").trim().toLowerCase();
  if (!email) {
    const { data: u } = await context.supabase.auth.getUser();
    email = String(u?.user?.email ?? "").trim().toLowerCase();
  }
  if (!email) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_email_recipients")
    .select("id")
    .eq("is_active", true)
    .ilike("email", email)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return { email, userId };
}

// --- Guests ------------------------------------------------------------

export const rebuildCrmGuests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull all bookings that count as real stays
    const { data: bookings, error } = await supabaseAdmin
      .from("booking_requests")
      .select("email, guest_name, phone, check_in, check_out, nights, total_amount, status, booking_group_id, id, created_at")
      .in("status", ["confirmed", "awaiting_review", "fully_paid"]);
    if (error) throw new Error(error.message);

    type Agg = {
      email: string;
      key_email: string;
      full_name: string | null;
      phone: string | null;
      total_bookings: number;
      total_nights: number;
      total_spent: number;
      last_stay_at: string | null;
      first_seen_at: string;
      groups: Set<string>;
    };
    const map = new Map<string, Agg>();
    const slug = (s: string) =>
      s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "guest";
    for (const b of bookings ?? []) {
      const email = String(b.email ?? "").trim().toLowerCase();
      if (!email) continue;
      // Manual admin bookings all share manual@admin.local — group them by
      // guest name so each real person becomes a distinct CRM entry.
      const isManual = email === "manual@admin.local";
      const nameForKey = (b.guest_name ?? "").trim();
      const keyEmail = isManual
        ? `manual+${slug(nameForKey || String(b.id))}@admin.local`
        : email;
      const groupId = String(b.booking_group_id ?? b.id);
      let a = map.get(keyEmail);
      if (!a) {
        a = {
          email: keyEmail,
          key_email: keyEmail,
          full_name: b.guest_name ?? null,
          phone: b.phone ?? null,
          total_bookings: 0,
          total_nights: 0,
          total_spent: 0,
          last_stay_at: null,
          first_seen_at: b.created_at ?? new Date().toISOString(),
          groups: new Set(),
        };
        map.set(keyEmail, a);
      }
      if (b.created_at && b.created_at < a.first_seen_at) a.first_seen_at = b.created_at;
      if (b.guest_name && !a.full_name) a.full_name = b.guest_name;
      if (b.phone && !a.phone) a.phone = b.phone;
      // Count each group's nights/total once (avoid multi-room duplication)
      if (!a.groups.has(groupId)) {
        a.groups.add(groupId);
        a.total_bookings += 1;
        a.total_nights += Number(b.nights ?? 0);
      }
      a.total_spent += Number(b.total_amount ?? 0);
      const ci = b.check_in ?? null;
      if (ci && (!a.last_stay_at || ci > a.last_stay_at)) a.last_stay_at = ci;
    }

    let upserted = 0;
    for (const a of map.values()) {
      const { error: ue } = await supabaseAdmin
        .from("crm_guests")
        .upsert(
          {
            email: a.email,
            full_name: a.full_name,
            phone: a.phone,
            total_bookings: a.total_bookings,
            total_nights: a.total_nights,
            total_spent: a.total_spent,
            last_stay_at: a.last_stay_at,
            first_seen_at: a.first_seen_at,
          } as never,
          { onConflict: "email" },
        );
      if (!ue) upserted += 1;
    }
    return { synced: upserted };
  });

const listSchema = z.object({
  search: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z.enum(["last_stay", "spent", "bookings", "name"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listGuests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("crm_guests").select("*", { count: "exact" });
    if (data.search) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`email.ilike.${s},full_name.ilike.${s},phone.ilike.${s}`);
    }
    if (data.tag) q = q.contains("tags", [data.tag]);
    const sort = data.sort ?? "last_stay";
    if (sort === "last_stay") q = q.order("last_stay_at", { ascending: false, nullsFirst: false });
    else if (sort === "spent") q = q.order("total_spent", { ascending: false });
    else if (sort === "bookings") q = q.order("total_bookings", { ascending: false });
    else q = q.order("full_name", { ascending: true });
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    q = q.range(offset, offset + limit - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

const idSchema = z.object({ id: z.string().uuid() });

export const getGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: guest, error } = await supabaseAdmin
      .from("crm_guests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!guest) throw new Error("Not found");
    const isManual = /^manual\+.*@admin\.local$/i.test(String(guest.email ?? ""));
    const bookingsQuery = isManual
      ? supabaseAdmin
          .from("booking_requests")
          .select("id, payment_reference, booking_group_id, cabin_id, room_type, num_rooms, check_in, check_out, nights, guests, total_amount, status, created_at, notes")
          .ilike("email", "manual@admin.local")
          .ilike("guest_name", guest.full_name ?? "")
          .order("check_in", { ascending: false })
      : supabaseAdmin
          .from("booking_requests")
          .select("id, payment_reference, booking_group_id, cabin_id, room_type, num_rooms, check_in, check_out, nights, guests, total_amount, status, created_at, notes")
          .ilike("email", guest.email)
          .order("check_in", { ascending: false });
    const [{ data: bookings }, { data: tasks }] = await Promise.all([
      bookingsQuery,
      supabaseAdmin
        .from("crm_tasks")
        .select("*")
        .eq("guest_id", data.id)
        .order("done", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false }),
    ]);
    return { guest, bookings: bookings ?? [], tasks: tasks ?? [] };
  });

const updateGuestSchema = z.object({
  id: z.string().uuid(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().max(4000).nullable().optional(),
  marketing_opt_in: z.boolean().optional(),
  full_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).optional(),
});

export const updateGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateGuestSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.marketing_opt_in !== undefined) patch.marketing_opt_in = data.marketing_opt_in;
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.email !== undefined) patch.email = data.email.toLowerCase();
    const { error } = await supabaseAdmin
      .from("crm_guests")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Booking edit -----------------------------------------------------

const editBookingSchema = z.object({
  id: z.string().uuid(),
  guest_name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(["pending_payment","awaiting_review","confirmed","cancelled","expired","fully_paid"]).optional(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cabin_id: z.string().uuid().optional(),
  num_rooms: z.number().int().min(1).max(8).optional(),
  guests: z.number().int().min(1).max(30).optional(),
  total_amount: z.number().min(0).max(100000).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const editBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => editBookingSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.guest_name !== undefined) patch.guest_name = data.guest_name;
    if (data.email !== undefined) patch.email = data.email.toLowerCase();
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.status !== undefined) patch.status = data.status;
    if (data.check_in) patch.check_in = data.check_in;
    if (data.check_out) patch.check_out = data.check_out;
    if (data.cabin_id) {
      patch.cabin_id = data.cabin_id;
      // Keep room_type text in sync so invoices/CRM labels reflect the new cabin.
      const { data: cab } = await supabaseAdmin
        .from("cabins")
        .select("name")
        .eq("id", data.cabin_id)
        .maybeSingle();
      if (cab?.name) patch.room_type = cab.name;
    }
    if (data.num_rooms) patch.num_rooms = data.num_rooms;
    if (data.guests) patch.guests = data.guests;
    if (data.total_amount !== undefined) patch.total_amount = data.total_amount;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.check_in && data.check_out) {
      if (new Date(data.check_out) <= new Date(data.check_in)) {
        throw new Error("Check-out must be after check-in");
      }
      const ci = new Date(data.check_in);
      const co = new Date(data.check_out);
      patch.nights = Math.round((co.getTime() - ci.getTime()) / 86400000);
    }
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Tasks -----------------------------------------------------------

const taskCreateSchema = z.object({
  guest_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  due_at: z.string().nullable().optional(),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, data: row } = await supabaseAdmin
      .from("crm_tasks")
      .insert({
        guest_id: data.guest_id,
        title: data.title,
        due_at: data.due_at || null,
        created_by: userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { task: row };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_tasks")
      .update({ done: data.done } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Broadcast -------------------------------------------------------

const broadcastSchema = z.object({
  subject: z.string().trim().min(2).max(150),
  body_html: z.string().trim().min(2).max(20000),
  audience: z.object({
    scope: z.enum(["all", "tag", "selected"]),
    tag: z.string().trim().max(60).optional(),
    guest_ids: z.array(z.string().uuid()).max(500).optional(),
  }),
  dry_run: z.boolean().optional(),
});

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => broadcastSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("crm_guests")
      .select("id, email, full_name, marketing_opt_in, tags")
      .eq("marketing_opt_in", true);
    if (data.audience.scope === "tag" && data.audience.tag) {
      q = q.contains("tags", [data.audience.tag]);
    } else if (data.audience.scope === "selected") {
      const ids = data.audience.guest_ids ?? [];
      if (ids.length === 0) return { recipient_count: 0, broadcast_id: null };
      q = q.in("id", ids);
    }
    const { data: recipients, error } = await q;
    if (error) throw new Error(error.message);
    const list = (recipients ?? []).filter((r) => r.email);

    if (data.dry_run) return { recipient_count: list.length, broadcast_id: null, preview: true };

    const { data: bc, error: be } = await supabaseAdmin
      .from("crm_broadcasts")
      .insert({
        subject: data.subject,
        body_html: data.body_html,
        audience: data.audience as never,
        recipient_count: list.length,
        sent_by: userId,
      } as never)
      .select("id")
      .single();
    if (be) throw new Error(be.message);

    const { sendTransactionalEmail } = await import("@/lib/email/send.server");
    for (const r of list) {
      const idem = `crm-bc:${bc!.id}:${r.id}`;
      await sendTransactionalEmail(supabaseAdmin as never, {
        templateName: "marketing-broadcast",
        recipientEmail: r.email,
        idempotencyKey: idem,
        templateData: {
          guestName: r.full_name ?? undefined,
          subject: data.subject,
          bodyHtml: data.body_html,
        },
      });
    }
    return { recipient_count: list.length, broadcast_id: bc!.id };
  });

export const listBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("crm_broadcasts")
      .select("id, subject, recipient_count, sent_at, audience")
      .order("sent_at", { ascending: false })
      .limit(50);
    return { rows: data ?? [] };
  });

export const listAllTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("crm_guests").select("tags");
    const set = new Set<string>();
    for (const r of data ?? []) for (const t of (r.tags as string[] | null) ?? []) set.add(t);
    return { tags: Array.from(set).sort() };
  });

export const listCabins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cabins")
      .select("id, name, cabin_type, is_active")
      .eq("is_active", true)
      .order("name");
    return { cabins: data ?? [] };
  });

const byDateSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(120).optional(),
});

export const listBookingsByDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => byDateSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date();
    const fromDefault = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)
      .toISOString().slice(0, 10);
    const toDefault = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
      .toISOString().slice(0, 10);
    const from = data.from ?? fromDefault;
    const to = data.to ?? toDefault;
    let q = supabaseAdmin
      .from("booking_requests")
      .select("id, payment_reference, booking_group_id, guest_name, email, phone, check_in, check_out, nights, num_rooms, guests, total_amount, deposit_amount, status, notes, room_type, cabin_id, cabins(name)")
      .gte("check_in", from)
      .lte("check_in", to)
      .in("status", ["confirmed", "awaiting_review", "fully_paid", "pending_payment"])
      .order("check_in", { ascending: true })
      .order("payment_reference", { ascending: true });
    if (data.search) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`guest_name.ilike.${s},email.ilike.${s},phone.ilike.${s},payment_reference.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], from, to };
  });