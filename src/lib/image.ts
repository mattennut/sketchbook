export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB bodies.

/** Sniffs magic bytes instead of trusting the client-declared type. */
export function sniffImageType(buf: Buffer): ImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function readImageFile(
  file: FormDataEntryValue | null,
): Promise<{ ok: true; buf: Buffer; type: ImageType } | { ok: false; message: string }> {
  if (!file || typeof file === "string") return { ok: false, message: "Please attach an image." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That image is too large (max 4 MB)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) return { ok: false, message: "Please upload a JPEG, PNG or WebP image." };
  return { ok: true, buf, type };
}
