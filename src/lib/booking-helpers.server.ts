import type { DiscountScope, NightBreakdown } from "@/lib/discounts";

/** Build per-night rate breakdown for a cabin over [checkIn, checkOut). */
export async function buildNightBreakdown(
  admin: any,
  cabinId: string,
  checkIn: string,
  checkOut: string,
): Promise<NightBreakdown[]> {
  const { data: cabin } = await admin
    .from("cabins")
    .select("weekday_rate, weekend_rate, school_holiday_rate")
    .eq("id", cabinId)
    .single();
  if (!cabin) return [];
  const { data: holidays } = await admin
    .from("school_holidays")
    .select("kind, starts_on, ends_on");
  const publicH = (holidays ?? []).filter((h: any) => h.kind === "public_holiday");
  const school = (holidays ?? []).filter((h: any) => h.kind === "school_break");
  const nights: NightBreakdown[] = [];
  const start = new Date(checkIn + "T00:00:00Z");
  const end = new Date(checkOut + "T00:00:00Z");
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const isSchool = school.some((h: any) => iso >= h.starts_on && iso <= h.ends_on);
    const isPublic = publicH.some((h: any) => iso >= h.starts_on && iso <= h.ends_on);
    const dow = d.getUTCDay();
    let rate: number;
    let scope: DiscountScope;
    if (isSchool) {
      rate = Number(cabin.school_holiday_rate);
      scope = "holiday";
    } else if (isPublic) {
      rate = Number(cabin.weekend_rate);
      scope = "holiday";
    } else if (dow === 5 || dow === 6 || dow === 0) {
      rate = Number(cabin.weekend_rate);
      scope = "weekend";
    } else {
      rate = Number(cabin.weekday_rate);
      scope = "weekday";
    }
    nights.push({ date: iso, rate, scope });
  }
  return nights;
}