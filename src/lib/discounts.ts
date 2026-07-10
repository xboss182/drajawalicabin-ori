// Pure discount-engine logic. No I/O — safe to import anywhere.
// Rules (per user):
//  - Applies to room rate only (not comforter, not security deposit).
//  - Best-one-wins: if a coupon and an automatic rule both qualify, we keep the larger discount.
//  - Nth-night discounts count nights PER ROOM (a 2-room 2-night booking gets 2 discounted nights).

export type DiscountType = "percent" | "fixed" | "nth_night" | "nth_night_onwards";
export type DiscountScope = "any" | "weekday" | "weekend" | "holiday";

export type DiscountRow = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: DiscountType;
  value: number;
  nth_night_percent: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  stay_from: string | null;
  stay_to: string | null;
  min_nights: number;
  min_rooms: number;
  min_subtotal: number;
  cabin_types: string[];
  applies_to: DiscountScope;
  max_uses: number | null;
  max_uses_per_email: number | null;
  stackable: boolean;
};

export type NightBreakdown = {
  date: string; // yyyy-mm-dd
  rate: number;
  scope: DiscountScope; // weekday | weekend | holiday
};

export type CartRoom = {
  cabinType: string;
  nights: NightBreakdown[]; // per-room, in order
};

export type PricingCart = {
  checkIn: string;
  rooms: CartRoom[];
  subtotalRoomOnly: number; // sum of all room-night rates
};

export type DiscountApplication = {
  discountId: string;
  code: string | null;
  name: string;
  amountOff: number; // RM, positive
};

function inWindow(dateISO: string | null | undefined, from: string | null, to: string | null) {
  const d = dateISO ? new Date(dateISO) : new Date();
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + (to.length === 10 ? "T23:59:59Z" : ""))) return false;
  return true;
}

function nightsMatchingScope(cart: PricingCart, scope: DiscountScope): NightBreakdown[] {
  const all = cart.rooms.flatMap((r) => r.nights);
  if (scope === "any") return all;
  return all.filter((n) => n.scope === scope);
}

function qualifies(d: DiscountRow, cart: PricingCart): boolean {
  if (!d.active) return false;
  const now = new Date().toISOString();
  if (!inWindow(now, d.starts_at, d.ends_at)) return false;
  if (!inWindow(cart.checkIn, d.stay_from, d.stay_to)) return false;
  const totalNights = cart.rooms.reduce((s, r) => s + r.nights.length, 0);
  if (totalNights < (d.min_nights || 0)) return false;
  if (cart.rooms.length < (d.min_rooms || 0)) return false;
  if (cart.subtotalRoomOnly < (d.min_subtotal || 0)) return false;
  if (d.cabin_types.length > 0 && !cart.rooms.some((r) => d.cabin_types.includes(r.cabinType))) return false;
  return true;
}

/** Compute RM off for a single discount against the cart. Returns 0 if it doesn't apply. */
export function computeDiscountAmount(d: DiscountRow, cart: PricingCart): number {
  if (!qualifies(d, cart)) return 0;
  const eligible = nightsMatchingScope(cart, d.applies_to);
  const eligibleSubtotal = eligible.reduce((s, n) => s + n.rate, 0);
  if (eligibleSubtotal <= 0) return 0;

  if (d.type === "percent") {
    const pct = Math.max(0, Math.min(100, Number(d.value) || 0));
    return round2((eligibleSubtotal * pct) / 100);
  }
  if (d.type === "fixed") {
    return round2(Math.min(eligibleSubtotal, Number(d.value) || 0));
  }
  if (d.type === "nth_night") {
    // Per room: apply to the Nth night of each room's stay (1-indexed).
    const idx = Math.max(1, Math.floor(Number(d.value) || 2));
    const pct = Math.max(0, Math.min(100, Number(d.nth_night_percent) || 0));
    if (pct === 0) return 0;
    let off = 0;
    for (const r of cart.rooms) {
      const target = r.nights[idx - 1];
      if (!target) continue;
      if (d.applies_to !== "any" && target.scope !== d.applies_to) continue;
      off += (target.rate * pct) / 100;
    }
    return round2(off);
  }
  if (d.type === "nth_night_onwards") {
    // Per room: apply pct off to every night from the Nth night onwards.
    const startIdx = Math.max(1, Math.floor(Number(d.value) || 2));
    const pct = Math.max(0, Math.min(100, Number(d.nth_night_percent) || 0));
    if (pct === 0) return 0;
    let off = 0;
    for (const r of cart.rooms) {
      for (let i = startIdx - 1; i < r.nights.length; i++) {
        const n = r.nights[i];
        if (d.applies_to !== "any" && n.scope !== d.applies_to) continue;
        off += (n.rate * pct) / 100;
      }
    }
    return round2(off);
  }
  return 0;
}

/**
 * Best-one-wins: pick the single highest-value applicable discount from `pool`,
 * plus optionally an explicit coupon (if provided AND qualifies).
 * If both exist we keep the larger one (unless the coupon is marked stackable).
 */
export function pickBestDiscount(
  cart: PricingCart,
  pool: DiscountRow[],
  coupon?: DiscountRow | null,
): DiscountApplication[] {
  const scored = pool
    .filter((d) => !d.code) // automatic rules only in the pool
    .map((d) => ({ d, amount: computeDiscountAmount(d, cart) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const bestAuto = scored[0] ?? null;

  const couponAmount = coupon ? computeDiscountAmount(coupon, cart) : 0;

  const asApp = (d: DiscountRow, amount: number): DiscountApplication => ({
    discountId: d.id,
    code: d.code,
    name: d.name,
    amountOff: amount,
  });

  if (coupon && couponAmount > 0 && coupon.stackable && bestAuto) {
    return [asApp(coupon, couponAmount), asApp(bestAuto.d, bestAuto.amount)];
  }
  if (coupon && couponAmount > 0 && (!bestAuto || couponAmount >= bestAuto.amount)) {
    return [asApp(coupon, couponAmount)];
  }
  if (bestAuto) return [asApp(bestAuto.d, bestAuto.amount)];
  return [];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
