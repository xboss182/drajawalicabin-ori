export function whatsappBookingHref(value: unknown, message = "Book"): string | null {
  const phone = String(value ?? "").replace(/\D/g, "");
  return phone.length >= 8 && phone.length <= 15
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : null;
}

export function bookingStatus(status: string | null | undefined) {
  switch (status) {
    case "awaiting_review":
      return { label: "Proof awaiting review", tone: "review" };
    case "pending_payment":
      return { label: "Payment hold active", tone: "payment" };
    case "confirmed":
      return { label: "Confirmed", tone: "confirmed" };
    case "fully_paid":
      return { label: "Fully paid", tone: "confirmed" };
    case "expired":
      return { label: "Hold expired", tone: "expired" };
    case "cancelled":
      return { label: "Cancelled", tone: "cancelled" };
    default:
      return {
        label: String(status ?? "").replace(/_/g, " ") || "Unknown",
        tone: "default",
      };
  }
}

export function holdStatus(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return { label: "No active hold", expired: false };

  const at = Date.parse(expiresAt);
  if (Number.isNaN(at) || at <= now) {
    return { label: "Hold expired", expired: true };
  }

  return {
    label: `Hold expires ${new Date(at).toLocaleString()}`,
    expired: false,
  };
}

export function runtimeStatus(state: string | null | undefined) {
  switch (String(state ?? "").toUpperCase()) {
    case "WORKING":
      return { label: "WAHA session working", tone: "confirmed" };
    case "SCAN_QR_CODE":
    case "QR_REQUIRED":
      return { label: "WAHA needs QR pairing", tone: "review" };
    case "FAILED":
    case "STOPPED":
    case "OFFLINE":
      return { label: "WAHA offline", tone: "expired" };
    default:
      return { label: "WAHA status not reported", tone: "default" };
  }
}

export type HandoffAction = "pause" | "takeover" | "resume";

export function isHandoffConversation(
  state: string | null | undefined,
  staffPaused: boolean,
  failureCount: number,
) {
  return String(state ?? "").toUpperCase() === "AGENT" || staffPaused || failureCount > 0;
}

export function handoffActions(staffPaused: boolean): HandoffAction[] {
  return staffPaused ? ["resume"] : ["pause", "takeover"];
}
