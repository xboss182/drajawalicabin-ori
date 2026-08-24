// Server-side handlers for the WA booking bridge machine API (MNC-961).
// Every handler expects an authenticated machine request; use
// verifyMachineRequest from ./machine-auth.server. Thin route wrappers live
// under src/routes/api/machine/wa and only forward the Request here.

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { verifyMachineRequest } from "./machine-auth.server";
import { pickBestDiscount } from "@/lib/discounts";
import type { Database, Json } from "@/integrations/supabase/types";

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // matches web-side 10 MB proof budget
const ALLOWED_PROOF_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readBody(req: Request): Promise<{
  body: unknown;
  err?: Response;
}> {
  try {
    return { body: await req.json() };
  } catch {
    return { body: null, err: json({ ok: false, error: "invalid json" }, 400) };
  }
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const uuidRe = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

const eventsClaimSchema = z.object({
  event_id: z.string().trim().min(8).max(64),
  chat_id: z.string().trim().min(8).max(80),
  type: z.string().trim().min(1).max(40),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const stateGetSchema = z.object({
  chat_id: z.string().trim().min(8).max(80),
});

const statePutSchema = z.object({
  chat_id: z.string().trim().min(8).max(80),
  state: z.string().trim().min(2).max(40),
  data: z.record(z.string(), z.unknown()).default({}),
  lang: z.enum(["en", "bm"]).default("en"),
  failure_count: z.number().int().min(0).max(10).default(0),
  booking_group_id: z.string().uuid().nullish(),
  version: z.number().int().min(0),
});

const prepareSchema = z.object({
  cabin_type: z.string().trim().min(1).max(60),
  check_in: z.string().regex(dateRe),
  check_out: z.string().regex(dateRe),
  comforter: z.boolean(),
  guests: z.number().int().min(1).max(12),
});

const claimSchema = prepareSchema.extend({
  cabin_id: z.string().refine(uuidRe),
  guest_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(30),
  chat_id: z.string().trim().min(8).max(80),
  subtotal: z.number().min(0),
  comforter_total: z.number().min(0),
  discount_id: z.string().uuid().nullish(),
  discount_code: z.string().max(200).nullish(),
  discount_amount: z.number().min(0).default(0),
});

const proofUploadUrlSchema = z.object({
  chat_id: z.string().trim().min(8).max(80),
  booking_group_id: z.string().refine(uuidRe),
  wa_message_id: z.string().trim().min(8).max(80),
  mime: z.string().trim().min(3).max(60),
  bytes: z.number().int().min(1),
});

const proofAttachSchema = z.object({
  chat_id: z.string().trim().min(8).max(80),
  wa_message_id: z.string().trim().min(8).max(80),
  file_path: z.string().trim().min(5).max(500),
  mime: z.string().trim().min(3).max(60),
  bytes: z.number().int().min(1),
});

const outboxEnqueueSchema = z.object({
  chat_id: z.string().trim().min(8).max(80),
  kind: z.string().trim().min(1).max(40),
  dedupe_key: z.string().trim().min(1).max(200),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const outboxClaimSchema = z.object({
  batch: z.number().int().min(1).max(25).default(10),
});

const outboxAckSchema = z.object({
  id: z.string().refine(uuidRe),
  ok: z.boolean(),
  wa_message_id: z.string().max(120).nullish(),
  error: z.string().max(500).nullish(),
});

const agentSchema = z.object({
  chat_id: z.string().trim().min(8).max(80),
  note: z.string().trim().max(500).optional(),
});

const runtimeReportSchema = z.object({
  state: z.string().trim().min(1).max(40),
  session: z.string().trim().max(120).optional().nullable(),
  error: z.string().trim().max(500).optional().nullable(),
});

type AdminClient = SupabaseClient<Database>;

async function adminClient(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ===========================================================================
// WA-hosted helpers (shared by handlers)
// ===========================================================================

// Leave the earliest group row as proof target; proofs attach per booking id
// exactly like the web path (bookings/{bookingId}/...).
async function findWaLead(admin: AdminClient, bookingGroupId: string, chatId: string) {
  const { data, error } = await admin
    .from("booking_requests")
    .select("id, booking_group_id, status, payment_reference, guest_name, wa_chat_id, source")
    .eq("booking_group_id", bookingGroupId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data || data.length === 0) return { lead: null, error };
  const lead = data[0];
  if (lead.source !== "wa" || lead.wa_chat_id !== chatId) {
    return { lead: null, error: "chat does not own this booking group" as unknown };
  }
  return { lead, error: null };
}

export async function handleEventsClaim(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = eventsClaimSchema.safeParse(body);
  if (!parsed.success)
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }, 400);

  const admin = await adminClient();
  const { data, error } = await admin
    .from("wa_events")
    .insert({
      event_id: parsed.data.event_id,
      chat_id: parsed.data.chat_id,
      type: parsed.data.type,
      payload: parsed.data.payload as Json,
    })
    .select("event_id");
  if (error) {
    if (error.code === "23505") {
      // Duplicate. Claim only if the previous claimant never completed (e.g.
      // bridge crashed mid-processing) and the reclaim window has passed;
      // otherwise it's a genuine replay.
      const { data: rows } = await admin
        .from("wa_events")
        .select("processed_at, received_at")
        .eq("event_id", parsed.data.event_id)
        .maybeSingle();
      const processed = rows?.processed_at ?? null;
      const staleMs = rows ? Date.now() - Date.parse(rows.received_at) : 0;
      const RECLAIM_MS = 10 * 60 * 1000; // > worst-case bridge processing
      if (processed) {
        return json({ ok: true, claimed: false, duplicate: true });
      }
      if (staleMs < RECLAIM_MS) {
        return json({ ok: true, claimed: false, duplicate: true, pending: true });
      }
      // Re-claim a stranded event: refresh received_at so the window restarts.
      const { error: updErr } = await admin
        .from("wa_events")
        .update({ received_at: new Date().toISOString() })
        .eq("event_id", parsed.data.event_id)
        .is("processed_at", null);
      if (updErr) return json({ ok: false, error: updErr.message }, 500);
      return json({ ok: true, claimed: true, reclaimed: true });
    }
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, claimed: (data?.length ?? 0) > 0 });
}

export async function handleEventsComplete(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = z
    .object({
      event_id: z.string().trim().min(8).max(64),
      release: z.boolean().default(false),
    })
    .safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const admin = await adminClient();
  if (parsed.data.release) {
    const { error } = await admin
      .from("wa_events")
      .update({ received_at: new Date(0).toISOString() })
      .eq("event_id", parsed.data.event_id)
      .is("processed_at", null);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, released: true });
  }
  const { error } = await admin
    .from("wa_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", parsed.data.event_id);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
}

export async function handleStateGet(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = stateGetSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const admin = await adminClient();
  const { data: convo } = await admin
    .from("wa_conversations")
    .select("chat_id, state, data, version, booking_group_id, lang, failure_count")
    .eq("chat_id", parsed.data.chat_id)
    .maybeSingle();

  // Live WA draft for this chat, if any (survives conversation resets).
  const { data: drafts, error: draftErr } = await admin
    .from("booking_requests")
    .select(
      "id, booking_group_id, guest_name, phone, check_in, check_out, guests, room_type, comforter, total_amount, deposit_amount, status, hold_expires_at, payment_reference, payment_proof_path, guest_token",
    )
    .eq("wa_chat_id", parsed.data.chat_id)
    .eq("source", "wa")
    .in("status", ["pending_payment", "awaiting_review"])
    .order("created_at", { ascending: true });
  if (draftErr) return json({ ok: false, error: draftErr.message }, 500);

  return json({
    ok: true,
    conversation: convo ?? null,
    draft: drafts && drafts.length > 0 ? drafts[0] : null,
  });
}

export async function handleStatePut(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = statePutSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const admin = await adminClient();
  const d = parsed.data;

  // Optimistic concurrency: transitions keyed on the version read earlier.
  // Version is incremented atomically by this update, so every durable state
  // change advances the chain (review finding: version never incremented).
  const { data: updated, error: upErr } = await admin
    .from("wa_conversations")
    .update({
      state: d.state,
      data: d.data as Json,
      lang: d.lang,
      failure_count: d.failure_count,
      version: d.version + 1,
      ...(d.booking_group_id ? { booking_group_id: d.booking_group_id } : {}),
    })
    .eq("chat_id", d.chat_id)
    .eq("version", d.version)
    .select("version");
  if (upErr) return json({ ok: false, error: upErr.message }, 500);
  if (updated && updated.length > 0) {
    return json({ ok: true, conflict: false, version: updated[0].version as number });
  }

  // Nothing matched: either the row doesn't exist (fresh chat, version 0) or
  // a concurrent writer is ahead of us (stale bridge message -> drop).
  if (d.version === 0) {
    const { data: inserted, error: insErr } = await admin
      .from("wa_conversations")
      .insert({
        chat_id: d.chat_id,
        state: d.state,
        data: d.data as Json,
        lang: d.lang,
        failure_count: d.failure_count,
        ...(d.booking_group_id ? { booking_group_id: d.booking_group_id } : {}),
      })
      .select("version");
    if (insErr) {
      if (insErr.code === "23505") return json({ ok: true, conflict: true });
      return json({ ok: false, error: insErr.message }, 500);
    }
    return json({ ok: true, conflict: false, version: inserted?.[0]?.version ?? 0 });
  }
  return json({ ok: true, conflict: true });
}

export async function handleHoldsPrepare(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = prepareSchema.safeParse(body);
  if (!parsed.success)
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }, 400);
  const d = parsed.data;
  if (new Date(d.check_out) <= new Date(d.check_in)) {
    return json({ ok: false, error: "check-out must be after check-in" }, 400);
  }
  // Check-out is exclusive: only booked nights count toward availability.
  const lastNight = new Date(d.check_out);
  lastNight.setUTCDate(lastNight.getUTCDate() - 1);
  const lastNightStr = lastNight.toISOString().slice(0, 10);

  const { buildNightBreakdown } = await import("@/lib/booking-helpers.server");
  const admin = await adminClient();

  const { data: cabinsInType, error: cabinsErr } = await admin
    .from("cabins")
    .select("id, name, cabin_type")
    .eq("cabin_type", d.cabin_type)
    .eq("is_active", true)
    .order("display_order");
  if (cabinsErr) return json({ ok: false, error: cabinsErr.message }, 500);
  if (!cabinsInType || cabinsInType.length === 0) {
    return json({ ok: false, error: "unknown cabin type" }, 400);
  }

  let cabin: { id: string; name: string } | null = null;
  for (const c of cabinsInType) {
    const { data: taken, error: takenErr } = await admin.rpc("cabin_taken_dates", {
      _cabin_id: c.id,
      _from: d.check_in,
      _to: lastNightStr,
    });
    if (takenErr) return json({ ok: false, error: takenErr.message }, 500);
    if (!taken || taken.length === 0) {
      cabin = { id: c.id as string, name: c.name as string };
      break;
    }
  }
  if (!cabin) {
    return json({ ok: true, available: false });
  }

  const { data: priceRows, error: priceErr } = await admin.rpc("compute_booking_price", {
    _cabin_id: cabin.id,
    _check_in: d.check_in,
    _check_out: d.check_out,
    _comforter: d.comforter,
  });
  if (priceErr) return json({ ok: false, error: priceErr.message }, 500);
  const price = Array.isArray(priceRows) ? priceRows[0] : priceRows;
  if (!price) return json({ ok: false, error: "price unavailable" }, 500);

  const subtotal = Number(price.subtotal);
  const comforterTotal = Number(price.comforter_total);

  // Same engine as the web flow: automatic discounts, no coupons in chat
  // (ponytail: coupon entry stays a web-only path; guests with codes can
  // mention "agent" and staff can apply them in the admin).
  const { data: activeAutos } = await admin
    .from("discounts")
    .select("*")
    .eq("active", true)
    .is("code", null);
  const nights = await buildNightBreakdown(admin, cabin.id, d.check_in, d.check_out);
  const cart = {
    checkIn: d.check_in,
    rooms: [{ cabinType: d.cabin_type, nights }],
    subtotalRoomOnly: subtotal,
  };
  const applications = pickBestDiscount(
    cart,
    (activeAutos ?? []) as Parameters<typeof pickBestDiscount>[1],
  );
  const discountAmount = applications.reduce((s, a) => s + a.amountOff, 0);
  const leadApp = applications[0] ?? null;

  return json({
    ok: true,
    available: true,
    cabin_id: cabin.id,
    cabin_name: cabin.name,
    nights: Number(price.nights),
    subtotal,
    comforter_total: comforterTotal,
    discount_amount: discountAmount,
    discount: leadApp
      ? {
          id: leadApp.discountId,
          code: applications.map((a) => a.code ?? a.name).join(" + "),
        }
      : null,
    total: subtotal + comforterTotal - discountAmount,
    deposit: 50,
  });
}

export async function handleHoldsClaim(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success)
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }, 400);
  const d = parsed.data;
  if (new Date(d.check_out) <= new Date(d.check_in)) {
    return json({ ok: false, error: "check-out must be after check-in" }, 400);
  }

  const admin = await adminClient();
  const { data, error } = await admin.rpc("wa_claim_hold", {
    _cabin_id: d.cabin_id,
    _check_in: d.check_in,
    _check_out: d.check_out,
    _comforter: d.comforter,
    _guests: d.guests,
    _guest_name: d.guest_name,
    _phone: d.phone,
    _chat_id: d.chat_id,
    _subtotal: d.subtotal,
    _comforter_total: d.comforter_total,
    _discount_id: d.discount_id ?? undefined,
    _discount_code: d.discount_code ?? undefined,
    _discount_amount: d.discount_amount,
  });
  if (error) {
    // WA_HOLD_PRICE_MISMATCH / NOT_FOUND surface as generic PG exceptions.
    return json({ ok: false, error: error.message }, 500);
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || !row.booking_id) {
    return json({ ok: true, claimed: false });
  }
  return json({ ok: true, claimed: true, booking: row });
}

export async function handleHoldsExpireSweep(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const admin = await adminClient();
  const { data, error } = await admin.rpc("wa_expire_stale_holds");
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({
    ok: true,
    expired: (data ?? []).filter((row): row is { chat_id: string; booking_group_id: string } =>
      Boolean(row && row.chat_id),
    ),
  });
}

export async function handleProofsUploadUrl(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = proofUploadUrlSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const d = parsed.data;

  const ext = ALLOWED_PROOF_MIME[d.mime];
  if (!ext) return json({ ok: false, error: "unsupported mime" }, 400);
  if (d.bytes > MAX_PROOF_BYTES) return json({ ok: false, error: "proof too large" }, 400);

  const admin = await adminClient();
  const { lead, error: leadErr } = await findWaLead(admin, d.booking_group_id, d.chat_id);
  if (!lead)
    return json({ ok: false, error: (leadErr as Error)?.message ?? "booking not found" }, 404);
  if (lead.status !== "pending_payment" && lead.status !== "awaiting_review") {
    return json({ ok: false, error: "booking no longer accepts proof" }, 409);
  }

  // Idempotency: same WA media message retried later resolves to the same row.
  const { data: inserted, error: insErr } = await admin
    .from("wa_proofs")
    .insert({
      booking_group_id: d.booking_group_id,
      wa_message_id: d.wa_message_id,
      chat_id: d.chat_id,
      status: "uploading",
    })
    .select("id");
  if (insErr) {
    if (insErr.code === "23505") {
      // Retry of a message we've seen. Only a stored proof is a true
      // duplicate; an `uploading`/`failed` row is a resumable attempt whose
      // upload never completed — re-issue the URL for the same path.
      const { data: existing } = await admin
        .from("wa_proofs")
        .select("id, status, file_path")
        .eq("wa_message_id", d.wa_message_id)
        .eq("chat_id", d.chat_id)
        .maybeSingle();
      if (existing?.status === "stored") return json({ ok: true, duplicate: true });
      if (existing) {
        const path = existing.file_path ?? `bookings/${lead.id}/wa-${d.wa_message_id}.${ext}`;
        const { data: urlData, error: urlErr } = await admin.storage
          .from("payment-proofs")
          .createSignedUploadUrl(path);
        if (urlErr || !urlData?.signedUrl) {
          return json({ ok: false, error: urlErr?.message ?? "signed url failed" }, 500);
        }
        return json({ ok: true, upload_url: urlData.signedUrl, path, content_type: d.mime });
      }
      return json({ ok: true, duplicate: true });
    }
    return json({ ok: false, error: insErr.message }, 500);
  }

  const path = `bookings/${lead.id}/wa-${d.wa_message_id}.${ext}`;
  const { data: urlData, error: urlErr } = await admin.storage
    .from("payment-proofs")
    .createSignedUploadUrl(path);
  if (urlErr || !urlData?.signedUrl) {
    // Roll the placeholder row back so the bridge can retry cleanly.
    await admin.from("wa_proofs").delete().eq("id", inserted[0].id);
    return json({ ok: false, error: urlErr?.message ?? "signed url failed" }, 500);
  }
  return json({ ok: true, upload_url: urlData.signedUrl, path, content_type: d.mime });
}

export async function handleProofsAttach(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = proofAttachSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const d = parsed.data;

  const admin = await adminClient();
  const { data: proofRows, error: proofErr } = await admin
    .from("wa_proofs")
    .update({
      status: "stored",
      file_path: d.file_path,
      mime: d.mime,
      bytes: d.bytes,
    })
    .eq("wa_message_id", d.wa_message_id)
    .eq("chat_id", d.chat_id)
    .eq("status", "uploading")
    .select("booking_group_id");
  if (proofErr) return json({ ok: false, error: proofErr.message }, 500);
  if (!proofRows || proofRows.length === 0) {
    // Either already attached (retry) or never prepared; never double-fire.
    return json({ ok: true, already: true });
  }
  const groupId = proofRows[0].booking_group_id as string;

  const { error: updErr } = await admin
    .from("booking_requests")
    .update({
      payment_proof_path: d.file_path,
      status: "awaiting_review",
      hold_expires_at: null,
    })
    .eq("booking_group_id", groupId)
    .eq("source", "wa");
  if (updErr) return json({ ok: false, error: updErr.message }, 500);

  // Staff review email — same channel the web flow uses for proof arrival.
  try {
    const { data: lead } = await admin
      .from("booking_requests")
      .select(
        "id, guest_name, phone, check_in, check_out, guests, room_type, payment_reference, total_amount, deposit_amount, balance_amount, guest_token",
      )
      .eq("booking_group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (lead && lead.length > 0) {
      const r = lead[0];
      const origin = new URL(req.url).origin;
      const { sendTransactionalEmail, getAdminRecipients } =
        await import("@/lib/email/send.server");
      const templateData = {
        guestName: r.guest_name,
        reference: r.payment_reference ?? (r.id as string).slice(0, 8),
        roomType: r.room_type,
        checkIn: r.check_in,
        checkOut: r.check_out,
        nights: 0,
        guests: r.guests,
        total: Number(r.total_amount ?? 0),
        securityDeposit: Number(r.deposit_amount ?? 50),
        remaining: Number(r.balance_amount ?? 0),
        paymentType: "deposit",
        rooms: [],
        manageUrl: `${origin}/admin`,
        guestEmail: "wa chat (" + d.chat_id + ")",
        guestPhone: r.phone,
        bookingId: r.id,
      };
      const admins = await getAdminRecipients(admin, "notify_payment_proof");
      for (const adminEmail of admins) {
        await sendTransactionalEmail(admin, {
          templateName: "admin-booking-alert",
          recipientEmail: adminEmail,
          idempotencyKey: `wa-proof-${groupId}-${adminEmail}`,
          templateData,
        });
      }
    }
  } catch (e) {
    console.error("[wa proof attach] staff email failed", e);
  }

  return json({ ok: true, attached: true });
}

export async function handleOutboxEnqueue(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = outboxEnqueueSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const admin = await adminClient();
  const { data, error } = await admin
    .from("wa_outbox")
    .insert({
      chat_id: parsed.data.chat_id,
      kind: parsed.data.kind,
      dedupe_key: parsed.data.dedupe_key,
      payload: parsed.data.payload as Json,
      status: "pending",
    })
    .select("id");
  if (error) {
    if (error.code === "23505") return json({ ok: true, enqueued: false, duplicate: true });
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, enqueued: true, id: data?.[0]?.id });
}

export async function handleOutboxClaim(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req).catch(() => ({
    body: {},
    err: undefined as Response | undefined,
  }));
  if (err) return err;
  const parsed = outboxClaimSchema.safeParse(body ?? {});
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const admin = await adminClient();
  const { data, error } = await admin.rpc("wa_outbox_claim", { _batch: parsed.data.batch });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, rows: data ?? [] });
}

export async function handleOutboxAck(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = outboxAckSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const d = parsed.data;

  const admin = await adminClient();
  if (d.ok) {
    const { error } = await admin
      .from("wa_outbox")
      .update({
        status: "sent",
        wa_message_id: d.wa_message_id ?? null,
        last_error: null,
      })
      .eq("id", d.id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  // Failed send: leave status 'sending'; the claim RPC reclaims rows stuck
  // > 5 min and fails rows at attempts >= 3, so backoff lives in Postgres.
  const { error } = await admin
    .from("wa_outbox")
    .update({ last_error: (d.error ?? "send failed").slice(0, 500) })
    .eq("id", d.id)
    .in("status", ["sending"]);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
}

// Owner-approved payment settings for the bridge (MNC-961 remediation).
// Returns payment text + a short-lived signed READ url for the QR image so
// the bridge never needs storage credentials. Empty config => bridge uses
// the "contact staff" fallback copy.
export async function handleSettingsGet(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;

  const admin = await adminClient();
  const { data: row, error } = await admin
    .from("wa_settings")
    .select("payment_text_en, payment_text_bm, qr_storage_path, hold_minutes")
    .eq("id", true)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!row) return json({ ok: true, configured: false });

  let qrUrl: string | null = null;
  if (row.qr_storage_path) {
    const { data: urlData, error: urlErr } = await admin.storage
      .from("payment-proofs")
      .createSignedUrl(row.qr_storage_path, 600);
    if (urlErr || !urlData?.signedUrl) {
      return json({ ok: false, error: urlErr?.message ?? "signed url failed" }, 500);
    }
    qrUrl = urlData.signedUrl;
  }

  return json({
    ok: true,
    configured: true,
    payment_text_en: row.payment_text_en ?? "",
    payment_text_bm: row.payment_text_bm ?? "",
    hold_minutes: row.hold_minutes ?? 30,
    qr_url: qrUrl,
    qr_mime: row.qr_storage_path?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
  });
}

export async function handleAgent(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const d = parsed.data;

  const admin = await adminClient();
  try {
    const { data: drafts } = await admin
      .from("booking_requests")
      .select("id, guest_name, payment_reference, status")
      .eq("wa_chat_id", d.chat_id)
      .eq("source", "wa")
      .order("created_at", { ascending: true })
      .limit(1);
    const draft = drafts?.[0];
    const { sendTransactionalEmail, getAdminRecipients } = await import("@/lib/email/send.server");
    const note = d.note ? ` — ${d.note}` : "";
    const templateData = {
      guestName: draft?.guest_name ?? "WhatsApp guest",
      reference: draft?.payment_reference ?? d.chat_id,
      roomType: `WA chat handoff (${d.chat_id})${note}`,
      checkIn: null,
      checkOut: null,
      nights: 0,
      guests: 0,
      total: 0,
      securityDeposit: 0,
      remaining: 0,
      paymentType: "deposit",
      rooms: [],
      manageUrl: "",
      guestEmail: "",
      guestPhone: d.chat_id,
      bookingId: draft?.id ?? d.chat_id,
    };
    const admins = await getAdminRecipients(admin, "notify_new_booking");
    for (const adminEmail of admins) {
      await sendTransactionalEmail(admin, {
        templateName: "admin-booking-alert",
        recipientEmail: adminEmail,
        idempotencyKey: `wa-handoff-${d.chat_id}-${adminEmail}`,
        templateData,
      });
    }
  } catch (e) {
    console.error("[wa agent handoff] staff email failed", e);
    return json({ ok: false, error: "staff email failed" }, 500);
  }
  return json({ ok: true });
}

export async function handleRuntimeReport(req: Request): Promise<Response> {
  const auth = await verifyMachineRequest(req);
  if (!auth.ok) return auth.response;
  const { body, err } = await readBody(req);
  if (err) return err;
  const parsed = runtimeReportSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const { error } = await (await adminClient()).from("wa_runtime_status").upsert({
    id: true,
    state: parsed.data.state,
    session: parsed.data.session ?? null,
    last_error: parsed.data.error ?? null,
    observed_at: new Date().toISOString(),
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
}
