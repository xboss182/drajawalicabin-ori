import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;
type JsonObject = Record<string, Json | undefined>;
type BookingRow = Database["public"]["Tables"]["booking_requests"]["Row"];
type ConversationRow = Database["public"]["Tables"]["wa_conversations"]["Row"];
type OutboxRow = Database["public"]["Tables"]["wa_outbox"]["Row"];
type ProofRow = Database["public"]["Tables"]["wa_proofs"]["Row"];
type AuditRow = Database["public"]["Tables"]["wa_admin_audit"]["Row"];
type RuntimeRow = Database["public"]["Tables"]["wa_runtime_status"]["Row"];

type ActionBooking = Pick<
  BookingRow,
  | "id"
  | "booking_group_id"
  | "source"
  | "wa_chat_id"
  | "guest_name"
  | "phone"
  | "payment_reference"
  | "check_in"
  | "check_out"
  | "room_type"
  | "total_amount"
  | "deposit_amount"
  | "status"
  | "hold_expires_at"
> & {
  wa_chat_id: string;
};

const uuid = z.string().uuid();

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function adminClient(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function detailReason(value: Json | null): string {
  const reason = asJsonObject(value).reason;
  return typeof reason === "string" ? reason : "";
}

async function enqueue(
  admin: AdminClient,
  chatId: string,
  kind: string,
  dedupeKey: string,
  payload: Json,
) {
  const { error } = await admin.from("wa_outbox").insert({
    chat_id: chatId,
    kind,
    dedupe_key: dedupeKey,
    payload,
    status: "pending",
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function audit(
  admin: AdminClient,
  actorId: string,
  action: string,
  fields: {
    bookingGroupId?: string | null;
    chatId?: string | null;
    detail?: Json;
  },
) {
  const { error } = await admin.from("wa_admin_audit").insert({
    booking_group_id: fields.bookingGroupId ?? null,
    chat_id: fields.chatId ?? null,
    action,
    detail: fields.detail ?? {},
    actor_id: actorId,
  });
  if (error) throw new Error(error.message);
}

async function bookingFor(admin: AdminClient, bookingId: string): Promise<ActionBooking> {
  const { data, error } = await admin
    .from("booking_requests")
    .select(
      "id, booking_group_id, source, wa_chat_id, guest_name, phone, payment_reference, check_in, check_out, room_type, total_amount, deposit_amount, status, hold_expires_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.source !== "wa" || !data.wa_chat_id) {
    throw new Error("WhatsApp booking not found");
  }
  return data as ActionBooking;
}

function customerPayload(booking: ActionBooking): Json {
  return {
    guest_name: booking.guest_name,
    reference: booking.payment_reference ?? booking.booking_group_id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    room_type: booking.room_type,
    total_amount: Number(booking.total_amount ?? 0),
    deposit_amount: Number(booking.deposit_amount ?? 0),
  };
}

export const getWaAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await adminClient();
    const [bookingsRes, proofsRes, conversationsRes, outboxRes, auditRes, runtimeRes] =
      await Promise.all([
        admin
          .from("booking_requests")
          .select(
            "id, booking_group_id, wa_chat_id, guest_name, phone, payment_reference, status, check_in, check_out, guests, room_type, comforter, total_amount, deposit_amount, hold_expires_at, created_at, notes, payment_proof_path",
          )
          .eq("source", "wa")
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("wa_proofs")
          .select("booking_group_id, chat_id, status, mime, file_path, created_at, reviewed_at")
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("wa_conversations")
          .select("chat_id, state, data, updated_at, failure_count")
          .order("updated_at", { ascending: false })
          .limit(200),
        admin
          .from("wa_outbox")
          .select("id, chat_id, kind, status, attempts, last_error, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("wa_admin_audit")
          .select("id, booking_group_id, chat_id, action, detail, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("wa_runtime_status")
          .select("state, session, observed_at, last_error")
          .eq("id", true)
          .maybeSingle(),
      ]);

    for (const result of [
      bookingsRes,
      proofsRes,
      conversationsRes,
      outboxRes,
      auditRes,
      runtimeRes,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const proofByGroup = new Map<string, ProofRow>();
    for (const proof of (proofsRes.data ?? []) as ProofRow[]) {
      if (!proofByGroup.has(proof.booking_group_id)) {
        proofByGroup.set(proof.booking_group_id, proof);
      }
    }

    const conversationByChat = new Map<string, ConversationRow>(
      ((conversationsRes.data ?? []) as ConversationRow[]).map((row) => [row.chat_id, row]),
    );
    const groups = new Map<string, BookingRow[]>();
    for (const row of (bookingsRes.data ?? []) as BookingRow[]) {
      const groupId = row.booking_group_id ?? row.id;
      const rows = groups.get(groupId) ?? [];
      rows.push(row);
      groups.set(groupId, rows);
    }

    const bookings = await Promise.all(
      [...groups.entries()].map(async ([groupId, rows]) => {
        rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        const lead = rows[0];
        const proof = proofByGroup.get(groupId) ?? null;
        const conversation = lead.wa_chat_id ? conversationByChat.get(lead.wa_chat_id) : null;
        let proofUrl: string | null = null;

        if (lead.payment_proof_path) {
          const { data, error } = await admin.storage
            .from("payment-proofs")
            .createSignedUrl(lead.payment_proof_path, 300);
          if (error) throw new Error(error.message);
          proofUrl = data?.signedUrl ?? null;
        }

        return {
          id: lead.id,
          groupId,
          chatId: lead.wa_chat_id ?? "",
          guestName: lead.guest_name,
          phone: lead.phone,
          reference: lead.payment_reference,
          status: lead.status,
          checkIn: lead.check_in,
          checkOut: lead.check_out,
          guests: Number(lead.guests ?? 0),
          roomType: lead.room_type,
          comforter: Boolean(lead.comforter),
          totalAmount: rows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
          depositAmount: rows.reduce((sum, row) => sum + Number(row.deposit_amount ?? 0), 0),
          holdExpiresAt: lead.hold_expires_at,
          createdAt: lead.created_at,
          notes: lead.notes,
          rooms: rows.map((row) => ({
            id: row.id,
            name: row.room_type,
            total: Number(row.total_amount ?? 0),
          })),
          proof: proof
            ? {
                status: proof.status,
                mime: proof.mime,
                createdAt: proof.created_at,
                reviewedAt: proof.reviewed_at,
                url: proofUrl,
              }
            : null,
          conversationState: conversation?.state ?? null,
          staffPaused: Boolean(asJsonObject(conversation?.data).staffPaused),
        };
      }),
    );

    const activity = [
      ...((auditRes.data ?? []) as AuditRow[]).map((row) => ({
        id: `audit-${row.id}`,
        at: row.created_at,
        summary: `${row.action.replace(/-/g, " ")}${
          detailReason(row.detail) ? `: ${detailReason(row.detail)}` : ""
        }`,
        bookingGroupId: row.booking_group_id,
        chatId: row.chat_id,
      })),
      ...((proofsRes.data ?? []) as ProofRow[]).map((row) => ({
        id: `proof-${row.booking_group_id}-${row.created_at}`,
        at: row.created_at,
        summary: `Payment proof ${row.status}`,
        bookingGroupId: row.booking_group_id,
        chatId: row.chat_id,
      })),
      ...((outboxRes.data ?? []) as OutboxRow[]).map((row) => ({
        id: `outbox-${row.id}`,
        at: row.updated_at,
        summary: `${row.kind.replace(/-/g, " ")}: ${row.status}`,
        bookingGroupId: null,
        chatId: row.chat_id,
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 80);

    const runtime = runtimeRes.data as RuntimeRow | null;
    return {
      runtime: {
        state: runtime?.state ?? null,
        session: runtime?.session ?? null,
        observedAt: runtime?.observed_at ?? null,
        lastError: runtime?.last_error ?? null,
      },
      bookings,
      conversations: ((conversationsRes.data ?? []) as ConversationRow[]).map((row) => ({
        chatId: row.chat_id,
        state: row.state,
        paused: Boolean(asJsonObject(row.data).staffPaused),
        updatedAt: row.updated_at,
        failureCount: Number(row.failure_count ?? 0),
      })),
      outbox: ((outboxRes.data ?? []) as OutboxRow[]).map((row) => ({
        id: row.id,
        chatId: row.chat_id,
        kind: row.kind,
        status: row.status,
        attempts: Number(row.attempts ?? 0),
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      activity,
    };
  });

const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), bookingId: uuid }),
  z.object({
    action: z.literal("reject"),
    bookingId: uuid,
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("request-proof"),
    bookingId: uuid,
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("extend-hold"),
    bookingId: uuid,
    minutes: z.number().int().min(5).max(120),
  }),
  z.object({ action: z.literal("expire-hold"), bookingId: uuid }),
  z.object({
    action: z.literal("cancel"),
    bookingId: uuid,
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("message"),
    bookingId: uuid,
    message: z.string().trim().min(1).max(1000),
  }),
]);

export const waAdminBookingAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => bookingActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await adminClient();
    const booking = await bookingFor(admin, data.bookingId);
    const groupId = booking.booking_group_id;
    const chatId = booking.wa_chat_id;
    const now = new Date();
    const payload = customerPayload(booking);

    if (data.action === "approve") {
      if (booking.status !== "awaiting_review") {
        throw new Error("Only a proof awaiting review can be approved");
      }
      const { error } = await admin
        .from("booking_requests")
        .update({
          status: "confirmed",
          confirmed_at: now.toISOString(),
          confirmed_by: context.userId,
          hold_expires_at: null,
        })
        .eq("booking_group_id", groupId);
      if (error) throw new Error(error.message);
      await enqueue(admin, chatId, "staff-confirmed", `staff-confirmed-${groupId}`, payload);
      await audit(admin, context.userId, "approved", {
        bookingGroupId: groupId,
        chatId,
      });
      return { ok: true };
    }

    if (data.action === "reject" || data.action === "request-proof") {
      if (booking.status !== "awaiting_review") {
        throw new Error("Only a proof awaiting review can be sent back");
      }
      const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
      const { error } = await admin
        .from("booking_requests")
        .update({
          status: "pending_payment",
          payment_proof_path: null,
          hold_expires_at: expiresAt,
        })
        .eq("booking_group_id", groupId);
      if (error) throw new Error(error.message);
      const { error: proofError } = await admin
        .from("wa_proofs")
        .update({
          status: "rejected",
          reviewed_by: context.userId,
          reviewed_at: now.toISOString(),
        })
        .eq("booking_group_id", groupId)
        .eq("status", "stored");
      if (proofError) throw new Error(proofError.message);
      await enqueue(admin, chatId, "staff-resubmit", `staff-resubmit-${groupId}-${now.getTime()}`, {
        ...asJsonObject(payload),
        reason: data.reason,
      });
      await audit(
        admin,
        context.userId,
        data.action === "reject" ? "rejected" : "requested-new-proof",
        {
          bookingGroupId: groupId,
          chatId,
          detail: { reason: data.reason },
        },
      );
      return { ok: true };
    }

    if (data.action === "extend-hold") {
      if (booking.status !== "pending_payment") {
        throw new Error("Only an active payment hold can be extended");
      }
      const existing = Date.parse(booking.hold_expires_at ?? "");
      const startsAt =
        Number.isNaN(existing) || existing < now.getTime() ? now.getTime() : existing;
      const expiresAt = new Date(startsAt + data.minutes * 60_000).toISOString();
      const { error } = await admin
        .from("booking_requests")
        .update({ hold_expires_at: expiresAt })
        .eq("booking_group_id", groupId);
      if (error) throw new Error(error.message);
      await enqueue(
        admin,
        chatId,
        "staff-hold-extended",
        `staff-hold-extended-${groupId}-${expiresAt}`,
        { ...asJsonObject(payload), hold_expires_at: expiresAt },
      );
      await audit(admin, context.userId, "extended-hold", {
        bookingGroupId: groupId,
        chatId,
        detail: { minutes: data.minutes },
      });
      return { ok: true };
    }

    if (data.action === "expire-hold") {
      if (booking.status !== "pending_payment") {
        throw new Error("Only an active payment hold can be expired");
      }
      const { error } = await admin
        .from("booking_requests")
        .update({ status: "expired", hold_expires_at: now.toISOString() })
        .eq("booking_group_id", groupId);
      if (error) throw new Error(error.message);
      await enqueue(admin, chatId, "hold-expired", `hold-expired-${groupId}`, payload);
      await audit(admin, context.userId, "expired-hold", {
        bookingGroupId: groupId,
        chatId,
      });
      return { ok: true };
    }

    if (data.action === "cancel") {
      if (["cancelled", "expired"].includes(booking.status)) {
        throw new Error("This booking is already closed");
      }
      const { error } = await admin
        .from("booking_requests")
        .update({ status: "cancelled", hold_expires_at: null })
        .eq("booking_group_id", groupId);
      if (error) throw new Error(error.message);
      await enqueue(admin, chatId, "staff-cancelled", `staff-cancelled-${groupId}`, {
        ...asJsonObject(payload),
        reason: data.reason,
      });
      await audit(admin, context.userId, "cancelled", {
        bookingGroupId: groupId,
        chatId,
        detail: { reason: data.reason },
      });
      return { ok: true };
    }

    await enqueue(admin, chatId, "staff-message", `staff-message-${crypto.randomUUID()}`, {
      message: data.message,
    });
    await audit(admin, context.userId, "messaged-customer", {
      bookingGroupId: groupId,
      chatId,
      detail: { sent: true },
    });
    return { ok: true };
  });

const conversationActionSchema = z.object({
  chatId: z.string().trim().min(8).max(80),
  bookingGroupId: uuid.optional(),
  action: z.enum(["pause", "takeover", "resume"]),
});

export const waAdminConversationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => conversationActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await adminClient();
    const { data: current, error: currentError } = await admin
      .from("wa_conversations")
      .select("data, version")
      .eq("chat_id", data.chatId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);

    const paused = data.action !== "resume";
    const next = {
      state: paused ? "AGENT" : "MENU",
      data: {
        ...asJsonObject(current?.data),
        staffPaused: paused,
        staffPauseMode: paused ? data.action : null,
        staffPauseUpdatedAt: new Date().toISOString(),
      },
      version: Number(current?.version ?? 0) + 1,
      ...(data.bookingGroupId ? { booking_group_id: data.bookingGroupId } : {}),
    };

    if (current) {
      const { data: updated, error } = await admin
        .from("wa_conversations")
        .update(next)
        .eq("chat_id", data.chatId)
        .eq("version", current.version)
        .select("version");
      if (error) throw new Error(error.message);
      if (!updated?.length) {
        throw new Error("Conversation changed; refresh and retry");
      }
    } else {
      const { error } = await admin.from("wa_conversations").insert({
        chat_id: data.chatId,
        ...next,
        lang: "en",
        failure_count: 0,
      });
      if (error) throw new Error(error.message);
    }

    const kind =
      data.action === "pause"
        ? "staff-paused"
        : data.action === "takeover"
          ? "staff-takeover"
          : "staff-resumed";
    await enqueue(admin, data.chatId, kind, `${kind}-${data.chatId}-${Date.now()}`, {});
    await audit(admin, context.userId, `${data.action}-bot`, {
      bookingGroupId: data.bookingGroupId ?? null,
      chatId: data.chatId,
    });
    return { ok: true };
  });

export const retryWaOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await adminClient();
    const { data: row, error: rowError } = await admin
      .from("wa_outbox")
      .select("id, chat_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    if (!row || row.status !== "failed") {
      throw new Error("Only failed messages can be retried");
    }

    const { error } = await admin
      .from("wa_outbox")
      .update({ status: "pending", attempts: 0, last_error: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(admin, context.userId, "retried-message", { chatId: row.chat_id });
    return { ok: true };
  });

export const getWhatsappBookingEntry = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await (
      await adminClient()
    )
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_booking")
      .maybeSingle();
    if (error) return { phone: null, enabled: false };
    const booking = asJsonObject(data?.value);
    const enabled = booking.enabled === true;
    return {
      phone: enabled ? normalizePhone(booking.phone) : null,
      enabled,
    };
  } catch {
    return { phone: null, enabled: false };
  }
});

export const getWaAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await adminClient();
    const [{ data: appRow, error: appError }, { data: settings, error: settingsError }] =
      await Promise.all([
        admin.from("app_settings").select("value").eq("key", "whatsapp_booking").maybeSingle(),
        admin
          .from("wa_settings")
          .select("payment_text_en, payment_text_bm")
          .eq("id", true)
          .maybeSingle(),
      ]);
    if (appError) throw new Error(appError.message);
    if (settingsError) throw new Error(settingsError.message);
    const booking = asJsonObject(appRow?.value);
    return {
      phone: normalizePhone(booking.phone) ?? "",
      enabled: booking.enabled === true,
      paymentTextEn: settings?.payment_text_en ?? "",
      paymentTextBm: settings?.payment_text_bm ?? "",
    };
  });

const waSettingsSchema = z.object({
  phone: z.string().trim().max(30),
  enabled: z.boolean(),
  paymentTextEn: z.string().trim().max(2000),
  paymentTextBm: z.string().trim().max(2000),
});

export const updateWaAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => waSettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const phone = normalizePhone(data.phone);
    if (data.enabled && !phone) {
      throw new Error("A valid dedicated WhatsApp number is required before enabling chat booking");
    }

    const admin = await adminClient();
    const now = new Date().toISOString();
    const [appResult, settingsResult] = await Promise.all([
      admin.from("app_settings").upsert({
        key: "whatsapp_booking",
        value: { phone, enabled: data.enabled },
        updated_at: now,
      }),
      admin.from("wa_settings").upsert({
        id: true,
        payment_text_en: data.paymentTextEn,
        payment_text_bm: data.paymentTextBm,
        updated_by: context.userId,
        updated_at: now,
      }),
    ]);
    if (appResult.error) throw new Error(appResult.error.message);
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    await audit(admin, context.userId, "updated-whatsapp-settings", {
      detail: { enabled: data.enabled },
    });
    return { ok: true };
  });
