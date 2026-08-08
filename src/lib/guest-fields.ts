// Shared formatting + validation for guest identity fields (client and server).

/** Keep an optional leading + and digits only. */
export function formatPhone(raw: string): string {
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  return (plus ? "+" : "") + digits;
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

/** Malaysian IC: 12 digits rendered as 000000-00-0000. */
export function formatIcNumber(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 12);
  if (d.length <= 6) return d;
  if (d.length <= 8) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

export function isValidIcNumber(value: string): boolean {
  if (!value.trim()) return true; // optional
  return /^\d{6}-\d{2}-\d{4}$/.test(value.trim());
}

/** Letters, spaces and dashes only, trimmed to 40 chars. */
export function formatVehicleType(raw: string): string {
  return raw.replace(/[^\p{L}\s-]/gu, "").replace(/\s{2,}/g, " ").slice(0, 40);
}

export function isValidVehicleType(value: string): boolean {
  if (!value.trim()) return true;
  return /^[\p{L}][\p{L}\s-]{1,39}$/u.test(value.trim());
}

/** Plate: uppercase letters, digits and single spaces. */
export function formatVehicleNumber(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 15);
}

export function isValidVehicleNumber(value: string): boolean {
  if (!value.trim()) return true;
  return /^[A-Z0-9]{1,8}(\s?[A-Z0-9]{1,7})?$/.test(value.trim());
}
