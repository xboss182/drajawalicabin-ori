import { supabase } from "@/integrations/supabase/client";

const MAX_DIM = 1600;
const MAX_DIRECT_BYTES = 1_500_000;

/** Downscale big phone photos so uploads don't die on weak mobile networks. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_DIRECT_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Uploads a payment receipt to storage with compression + retries.
 * Returns the stored object path.
 */
export async function uploadReceipt(bookingId: string, file: File, prefix: "proof" | "balance") {
  const prepared = await compressImage(file);
  const ext = (prepared.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  let lastErr: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    const path = `bookings/${bookingId}/${prefix}-${Date.now()}-${attempt}.${ext}`;
    try {
      const { error } = await supabase.storage
        .from("payment-proofs")
        .upload(path, prepared, { upsert: true, contentType: prepared.type || "application/octet-stream" });
      if (error) throw error;
      return path;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (/fetch|network|load failed/i.test(msg)) {
    throw new Error(
      "Upload failed — the connection dropped. Please check your internet and try again, or send the receipt to us on WhatsApp.",
    );
  }
  throw new Error(msg || "Upload failed");
}
