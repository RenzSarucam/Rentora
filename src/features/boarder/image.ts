"use client";

export const CLIENT_MAX_BYTES = 4 * 1024 * 1024;
const DOWNSCALE_OVER = 1.2 * 1024 * 1024;
const MAX_EDGE = 1600;

/**
 * Phone photos are often 3–8 MB. Shrink large images to a 1600px JPEG before upload so they fit
 * the 4 MB server limit. PDFs and small images pass through unchanged. The server re-validates.
 */
export async function prepareUpload(file: File): Promise<{ file: File } | { error: string }> {
  if (file.type.startsWith("image/") && file.size > DOWNSCALE_OVER) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (blob) file = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      // Fall through: the size check below decides.
    }
  }
  if (file.size > CLIENT_MAX_BYTES) return { error: "This file is larger than 4 MB. Try a screenshot instead." };
  return { file };
}
