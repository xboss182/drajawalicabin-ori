import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DiscountRow } from "@/lib/discounts";

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  code: z.string().trim().min(1).max(40).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  type: z.enum(["percent", "fixed", "nth_night", "nth_night_onwards"]),
  value: z.number().min(0),
  nth_night_percent: z.number().min(0).max(100).nullable().optional(),
  active: z.boolean(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  stay_from: z.string().nullable().optional(),
  stay_to: z.string().nullable().optional(),
  min_nights: z.number().int().min(1),
  min_rooms: z.number().int().min(1),
  min_subtotal: z.number().min(0),
  cabin_types: z.array(z.string()),
  applies_to: z.enum(["any", "weekday", "weekend", "holiday"]),
  max_uses: z.number().int().min(0).nullable().optional(),
  max_uses_per_email: z.number().int().min(0).nullable().optional(),
  stackable: z.boolean(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscountRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DiscountRow[];
  });

export const upsertDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const code = data.code ? data.code.trim().toUpperCase() : null;
    const row: any = {
      code,
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      value: data.value,
      nth_night_percent: data.nth_night_percent ?? null,
      active: data.active,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      stay_from: data.stay_from || null,
      stay_to: data.stay_to || null,
      min_nights: data.min_nights,
      min_rooms: data.min_rooms,
      min_subtotal: data.min_subtotal,
      cabin_types: data.cabin_types,
      applies_to: data.applies_to,
      max_uses: data.max_uses ?? null,
      max_uses_per_email: data.max_uses_per_email ?? null,
      stackable: data.stackable,
    };
    if (data.id) {
      const { error } = await context.supabase.from("discounts").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("discounts")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("discounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleDiscountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("discounts")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type RedemptionRow = {
  id: string;
  discount_id: string;
  booking_group_id: string;
  email: string | null;
  amount_off: number;
  created_at: string;
};

export const listRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RedemptionRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("discount_redemptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as RedemptionRow[];
  });

// Public: automatic-rule discounts only (no coupon code), currently active.
// Used by the guest booking page to preview auto discounts on the price card.
export const listActiveAutoDiscounts = createServerFn({ method: "GET" })
  .handler(async (): Promise<DiscountRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("discounts")
      .select("*")
      .eq("active", true)
      .is("code", null);
    if (error) throw new Error(error.message);
    return (data ?? []).filter((d: any) => {
      if (d.starts_at && d.starts_at > nowIso) return false;
      if (d.ends_at && d.ends_at < nowIso) return false;
      return true;
    }) as DiscountRow[];
  });
