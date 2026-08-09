/** Remembers the guest's most recent booking link on this device so they can
 *  return to it in one tap instead of re-booking. Client-only. */
export type RememberedBooking = { id: string; token: string; reference: string };

const KEY = "rjw:my-booking";

export function rememberBooking(b: RememberedBooking) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readRememberedBooking(): RememberedBooking | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RememberedBooking>;
    if (!p?.id || !p?.token) return null;
    return { id: p.id, token: p.token, reference: p.reference ?? "" };
  } catch {
    return null;
  }
}

export function forgetBooking() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
