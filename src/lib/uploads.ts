export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type DetectedType = { mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; ext: string };

/** Identifies a file by its leading bytes. The browser-supplied type and file name are never trusted. */
export function sniffFileType(bytes: Uint8Array): DetectedType | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (bytes.length >= 3 && starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 12 && starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (bytes.length >= 5 && starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export type UploadCheck =
  | { ok: true; type: DetectedType; bytes: Uint8Array }
  | { ok: false; error: string };

/** Validates an uploaded file's size and real type against an allow-list. */
export async function checkUpload(file: unknown, allowed: DetectedType["mime"][]): Promise<UploadCheck> {
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "File is larger than 4 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(bytes);
  if (!type || !allowed.includes(type.mime)) {
    const names = allowed.map((m) => m.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(", ");
    return { ok: false, error: `Upload a ${names} file.` };
  }
  return { ok: true, type, bytes };
}

/** "<org>/<member>/<random>.<ext>" — matches the storage RLS policies. */
export function storagePath(orgId: string, memberId: string, ext: string): string {
  return `${orgId}/${memberId}/${crypto.randomUUID()}.${ext}`;
}
