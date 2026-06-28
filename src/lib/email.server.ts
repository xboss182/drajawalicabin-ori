// Server-only email helpers. Renders booking emails and enqueues them into
// the `email_outbox` table. A future provider (Resend, Lovable Emails, etc.)
// can read `status='pending'` rows and send them.
import type { SupabaseClient } from "@supabase/supabase-js";

const TEAM_CC = ["awang.mfauzi@gmail.com", "salikin1305@gmail.com", "xboss182@gmail.com"];

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
};

function balanceOf(b: BookingRow) {
  const total = Number(b.total_amount ?? 0);
  const deposit = Number(b.deposit_amount ?? 50);
  const remaining = b.balance_amount != null ? Number(b.balance_amount) : Math.max(0, total - deposit);
  return { total, deposit, remaining };
}

export function renderBookingSummaryEmail(b: BookingRow) {
  const { total, deposit, remaining } = balanceOf(b);
  const subject = `Booking ${b.payment_reference ?? b.id.slice(0, 8)} received — Rajawali D'Cabin`;
  const body = [
    `Hi ${b.guest_name},`,
    ``,
    `Thank you — we have received your booking and your RM${deposit.toFixed(2)} deposit proof.`,
    `Our team will verify the transfer shortly and your dates are now reserved.`,
    ``,
    `— Booking Summary —`,
    `Booking number:   ${b.payment_reference ?? b.id.slice(0, 8)}`,
    `Cabin:            ${b.room_type}`,
    `Check-in:         ${fmtDate(b.check_in)} (3:00 PM)`,
    `Check-out:        ${fmtDate(b.check_out)} (12:00 PM)`,
    `Nights / guests:  ${b.nights ?? "—"} night(s) · ${b.guests} guest(s)`,
    `Total cost:       ${money(total)}`,
    `Deposit paid:     ${money(deposit)}  ✓`,
    `Remaining balance:${money(remaining)}  (due 7 days before check-in)`,
    ``,
    `We will send a balance-payment reminder 7 days before your check-in date,`,
    `with a secure link to pay the remaining ${money(remaining)}.`,
    ``,
    `Questions? WhatsApp us at 011-5500 7204.`,
    `— Rajawali D'Cabin Chalet`,
  ].join("\n");
  return { subject, body };
}

export function renderBalanceReminderEmail(b: BookingRow, manageUrl: string) {
  const { total, deposit, remaining } = balanceOf(b);
  const subject = `Balance due in 7 days — ${b.payment_reference ?? b.id.slice(0, 8)} · Rajawali D'Cabin`;
  const body = [
    `Hi ${b.guest_name},`,
    ``,
    `Your stay at Rajawali D'Cabin is coming up on ${fmtDate(b.check_in)}.`,
    `Please settle the remaining balance to complete your booking.`,
    ``,
    `— Balance Summary —`,
    `Booking number:   ${b.payment_reference ?? b.id.slice(0, 8)}`,
    `Cabin:            ${b.room_type}`,
    `Check-in:         ${fmtDate(b.check_in)}`,
    `Total cost:       ${money(total)}`,
    `Deposit paid:     ${money(deposit)}  ✓`,
    `Balance due now:  ${money(remaining)}`,
    ``,
    `Pay securely here:`,
    manageUrl,
    ``,
    `Once we receive your balance we will share your key-locker check-in code.`,
    `— Rajawali D'Cabin Chalet`,
  ].join("\n");
  return { subject, body };
}

export function renderFullyPaidEmail(b: BookingRow) {
  const subject = `You're fully paid ✓  Key-locker code inside — ${b.payment_reference ?? b.id.slice(0, 8)}`;
  const body = [
    `Hi ${b.guest_name},`,
    ``,
    `Your balance is received in full. You're all set for ${fmtDate(b.check_in)}.`,
    ``,
    `— Self check-in —`,
    `Check-in:    From 3:00 PM on ${fmtDate(b.check_in)}`,
    `Check-out:   By 12:00 PM on ${fmtDate(b.check_out)}`,
    `Key locker:  ${b.locker_code ? `Code ${b.locker_code}` : `Code will be shared on check-in day via WhatsApp`}`,
    ``,
    `Locker tips: please return keys to the locker on check-out and keep`,
    `the code confidential. The RM50 deposit is refunded after check-out`,
    `if no damage/loss is recorded.`,
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
  const { error } = await admin.from("email_outbox").insert({
    kind: args.kind,
    to_email: args.toEmail,
    cc_emails: TEAM_CC,
    subject: args.subject,
    body: args.body,
    booking_id: args.bookingId ?? null,
  } as never);
  if (error) console.error("[email_outbox] enqueue failed", error.message);
}