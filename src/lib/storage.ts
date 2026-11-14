import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { get, put } from "@vercel/blob";

/**
 * Drawing uploads. Production: Vercel Blob with *private* access (images are only
 * served through our owner-checked route). Local dev without a token: `.data/uploads`.
 * Refs are stored in the DB as `blob:<pathname>` or `local:<file>`.
 */
export function storageConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN || !process.env.VERCEL;
}

const LOCAL_DIR = () => path.join(process.cwd(), ".data", "uploads");

export async function saveImage(key: string, data: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`drawings/${key}`, data, {
      access: "private",
      contentType,
      addRandomSuffix: true,
    });
    return `blob:${blob.pathname}`;
  }
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN is required in production.");
  await mkdir(LOCAL_DIR(), { recursive: true });
  const file = `${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(LOCAL_DIR(), file), data);
  return `local:${file}`;
}

export async function loadImage(ref: string): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  if (ref.startsWith("blob:")) {
    const result = await get(ref.slice(5), { access: "private" });
    if (!result || !result.stream) return null;
    return { body: result.stream, contentType: result.blob.contentType ?? "image/jpeg" };
  }
  if (ref.startsWith("local:")) {
    const file = path.basename(ref.slice(6));
    try {
      return { body: await readFile(path.join(LOCAL_DIR(), file)), contentType: "image/jpeg" };
    } catch {
      return null;
    }
  }
  return null;
}
