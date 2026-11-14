/**
 * Client-side downscale + JPEG re-encode before upload (long edge ≤ 1600px).
 * Phone photos of paper are often 4000px+ and 5–10 MB; this keeps uploads fast
 * on mobile data and under the serverless body limit. Respects EXIF orientation.
 */
export async function prepareImage(file: File, maxEdge = 1600): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("We couldn't read that image. Try a JPEG or PNG photo.");
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white paper
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  for (const quality of [0.85, 0.72, 0.6]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size < 3.8 * 1024 * 1024) return blob;
  }
  throw new Error("That image is too large even after compression.");
}
