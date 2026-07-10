// Shared late-checkout fee helper.
// Standard check-out is 12:00 PM local time (Asia/Kuala_Lumpur, UTC+8).
// Every started hour past noon is charged at RM10.

export const LATE_CHECKOUT_HOURLY_FEE = 10;
export const STANDARD_CHECKOUT_HOUR = 12; // 24h, local
export const GRACE_MINUTES = 0;

/**
 * @param checkOutDate ISO date (YYYY-MM-DD) — the scheduled check-out day
 * @param actualIso    ISO datetime string of the actual departure (any tz)
 */
export function computeLateCheckout(
  checkOutDate: string,
  actualIso: string | null | undefined,
): { hoursLate: number; feeRM: number; scheduledIso: string } {
  // Scheduled = check-out date at 12:00 MYT (UTC+8) → UTC = 04:00
  const scheduledUtcMs = Date.parse(`${checkOutDate}T${String(STANDARD_CHECKOUT_HOUR - 8).padStart(2, "0")}:00:00Z`);
  const scheduledIso = new Date(scheduledUtcMs).toISOString();
  if (!actualIso) return { hoursLate: 0, feeRM: 0, scheduledIso };
  const actualMs = Date.parse(actualIso);
  if (!Number.isFinite(actualMs)) return { hoursLate: 0, feeRM: 0, scheduledIso };
  const diffMin = (actualMs - scheduledUtcMs) / 60000 - GRACE_MINUTES;
  if (diffMin <= 0) return { hoursLate: 0, feeRM: 0, scheduledIso };
  const hoursLate = Math.ceil(diffMin / 60);
  return { hoursLate, feeRM: hoursLate * LATE_CHECKOUT_HOURLY_FEE, scheduledIso };
}