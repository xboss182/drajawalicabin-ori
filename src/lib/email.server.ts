// Server-only email helpers. Renders booking emails and enqueues them into
// the `email_outbox` table. A future provider (Resend, Lovable Emails, etc.)
// can read `status='pending'` rows and send them.
import type { SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_TEAM_CC = ["awang.mfauzi@gmail.com", "salikin1305@gmail.com", "xboss182@gmail.com"];

// Which `notify_*` column to consult for each email kind sent to admins.
const KIND_NOTIFY_COLUMN: Record<string, string | null> = {
  booking_summary: "notify_payment_proof",
  fully_paid: "notify_fully_paid",
  new_booking: "notify_new_booking",
};

async function getAdminCcs(admin: SupabaseClient, kind: string): Promise<string[]> {
  const col = KIND_NOTIFY_COLUMN[kind];
  if (!col) return [];
  try {
    const { data, error } = await admin
      .from("admin_email_recipients")
      .select(`email, is_active, ${col}`)
      .eq("is_active", true)
      .eq(col, true);
    if (error || !data || data.length === 0) return FALLBACK_TEAM_CC;
    return data.map((r: any) => r.email).filter(Boolean);
  } catch {
    return FALLBACK_TEAM_CC;
  }
}

function money(n: number | null | undefined) {
  return `RM ${Number(n ?? 0).toFixed(2)}`;
}
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

type BookingRow = {
  id: string;
  guest_name: string;
  email: string;
  phone: string;
  check_in: string;
  check_out: string;
  guests: number;
  nights: number | null;
  room_type: string;
  total_amount: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  payment_reference: string | null;
  locker_code: string | null;
  payment_type?: string | null;
  rooms?: Array<{ name: string; nights: number | null; total: number }>;
};

function balanceOf(b: BookingRow) {
  const total = Number(b.total_amount ?? 0);
  const deposit = Number(b.deposit_amount ?? 50);
  const remaining = b.balance_amount != null ? Number(b.balance_amount) : Math.max(0, total - deposit);
  return { total, deposit, remaining };
}

export function renderBookingSummaryEmail(b: BookingRow) {
  const { total, deposit, remaining } = balanceOf(b);
  const isFull = b.payment_type === "full" || remaining <= 0;
  const subject = `Booking ${b.payment_reference ?? b.id.slice(0, 8)} received — Rajawali D'Cabin`;
  const roomsBlock =
    b.rooms && b.rooms.length > 1
      ? [
          ``,
          `Rooms in this reservation:`,
          ...b.rooms.map((r, i) => `  ${i + 1}. ${r.name} — ${money(r.total)}`),
        ]
      : [];
  if (isFull) {
    const body = [
      `Hi ${b.guest_name},`,
      ``,
      `Thank you — we have received your full payment proof of ${money(total + deposit)} (room rate + refundable RM${deposit.toFixed(2)}/room security deposit).`,
      `Our team will verify the transfer shortly and confirm your booking. The security deposit is not part of the room rate and is refunded after check-out, subject to a room inspection.`,
      ``,
      `— Booking Summary —`,
      `Booking number:   ${b.payment_reference ?? b.id.slice(0, 8)}`,
      `Cabin:            ${b.rooms && b.rooms.length > 1 ? `${b.rooms.length} rooms` : b.room_type}`,
      `Check-in:         ${fmtDate(b.check_in)} (3:00 PM)`,
      `Check-out:        ${fmtDate(b.check_out)} (12:00 PM)`,
      `Nights / guests:  ${b.nights ?? "—"} night(s) · ${b.guests} guest(s)`,
      ...roomsBlock,
      `Room rate:        ${money(total)}  ✓`,
      `Security deposit: ${money(deposit)}  ✓ (refundable after check-out)`,
      `Total paid:       ${money(total + deposit)}  ✓`,
      `Balance:          RM 0.00 (paid in full)`,
      ``,
      `Once we verify the transfer we will share your key-locker check-in code.`,
      `Questions? WhatsApp us at 011-5500 7204.`,
      `— Rajawali D'Cabin Chalet`,
    ].join("\n");
    return { subject, body };
  }
  const body = [
    `Hi ${b.guest_name},`,
    ``,
    `Thank you — we have received your booking and your RM${deposit.toFixed(2)} refundable security deposit proof.`,
    `The security deposit is not part of the room rate and will be refunded after check-out, subject to a room inspection. Our team will verify the transfer shortly and your dates are now reserved.`,
    ``,
    `— Booking Summary —`,
    `Booking number:   ${b.payment_reference ?? b.id.slice(0, 8)}`,
    `Cabin:            ${b.rooms && b.rooms.length > 1 ? `${b.rooms.length} rooms` : b.room_type}`,
    `Check-in:         ${fmtDate(b.check_in)} (3:00 PM)`,
    `Check-out:        ${fmtDate(b.check_out)} (12:00 PM)`,
    `Nights / guests:  ${b.nights ?? "—"} night(s) · ${b.guests} guest(s)`,
    ...roomsBlock,
    `Room rate:            ${money(total)}`,
    `Security deposit paid:${money(deposit)}  ✓ (refundable after check-out)`,
    `Room rate balance:    ${money(remaining)}  (due 7 days before check-in)`,
    ``,
    `We will send a room-rate balance reminder 7 days before your check-in date,`,
    `with a secure link to settle the remaining ${money(remaining)}.`,
    ``,
    `Questions? WhatsApp us at 011-5500 7204.`,
    `— Rajawali D'Cabin Chalet`,
  ].join("\n");
  return { subject, body };
}

export function renderBalanceReminderEmail(b: BookingRow, manageUrl: string) {
  const { total, deposit, remaining } = balanceOf(b);
  const subject = `Room rate balance due in 7 days — ${b.payment_reference ?? b.id.slice(0, 8)} · Rajawali D'Cabin`;
  const body = [
    `Hi ${b.guest_name},`,
    ``,
    `Your stay at Rajawali D'Cabin is coming up on ${fmtDate(b.check_in)}.`,
    `Please settle the remaining room rate balance to complete your booking. Your security deposit is separate and refundable after check-out.`,
    ``,
    `— Room Rate Balance Summary —`,
    `Booking number:   ${b.payment_reference ?? b.id.slice(0, 8)}`,
    `Cabin:            ${b.room_type}`,
    `Check-in:         ${fmtDate(b.check_in)}`,
    `Room rate:              ${money(total)}`,
    `Security deposit paid:  ${money(deposit)}  ✓ (refundable after check-out)`,
    `Room rate balance due:  ${money(remaining)}`,
    ``,
    `Pay securely here:`,
    manageUrl,
    ``,
    `Once we receive your room rate balance we will share your key-locker check-in code.`,
    `— Rajawali D'Cabin Chalet`,
  ].join("\n");
  return { subject, body };
}

export function renderFullyPaidEmail(b: BookingRow) {
  const subject = `You're fully paid ✓  Key-locker code inside — ${b.payment_reference ?? b.id.slice(0, 8)}`;
  const roomsBlock =
    b.rooms && b.rooms.length > 1
      ? [``, `Rooms:       ${b.rooms.map((r) => r.name).join(", ")}`]
      : [];
  const body = [
    `Hi ${b.guest_name},`,
    ``,
    `Your balance is received in full. You're all set for ${fmtDate(b.check_in)}.`,
    ``,
    `— Self check-in —`,
    `Check-in:    From 3:00 PM on ${fmtDate(b.check_in)}`,
    `Check-out:   By 12:00 PM on ${fmtDate(b.check_out)}`,
    ...roomsBlock,
    `Key locker:  ${b.locker_code ? `Code ${b.locker_code}` : `Code will be shared on check-in day via WhatsApp`}`,
    ``,
    `Locker tips: please return keys to the locker on check-out and keep`,
    `the code confidential. The refundable RM50/room security deposit is`,
    `refunded after check-out, subject to a room inspection ensuring no`,
    `damage or loss has occurred.`,
    ``,
    `Drive safe — see you at Chendering!`,
    `— Rajawali D'Cabin Chalet`,
  ].join("\n");
  return { subject, body };
}

export async function enqueueEmail(
  admin: SupabaseClient,
  args: { kind: string; toEmail: string; subject: string; body: string; bookingId?: string },
) {
  const ccs = await getAdminCcs(admin, args.kind);
  const { error } = await admin.from("email_outbox").insert({
    kind: args.kind,
    to_email: args.toEmail,
    cc_emails: ccs,
    subject: args.subject,
    body: args.body,
    booking_id: args.bookingId ?? null,
  } as never);
  if (error) console.error("[email_outbox] enqueue failed", error.message);
}