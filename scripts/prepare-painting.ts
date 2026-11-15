/**
 * Turns the landing-page background painting into web-sized WebP files.
 *   npm run painting -- "C:\path\to\Cornard_Wood.jpg"
 * Source: Thomas Gainsborough, "Cornard Wood, near Sudbury, Suffolk" (1748), National Gallery,
 * London — public domain (Wikimedia Commons, PD-Art).
 */
import path from "node:path";
import { mkdir, stat } from "node:fs/promises";
import sharp from "sharp";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: npm run painting -- "path/to/painting.jpg"');
  const outDir = path.join(process.cwd(), "public", "landing");
  await mkdir(outDir, { recursive: true });
  const meta = await sharp(input).metadata();
  console.log(`source: ${meta.width}×${meta.height} ${meta.format}`);
  for (const width of [2400, 1200]) {
    const out = path.join(outDir, `cornard-wood-${width}.webp`);
    await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      // Slightly soften and mute so it reads as a backdrop, not a competing picture.
      .blur(width > 1500 ? 1.2 : 0.8)
      .modulate({ saturation: 0.85 })
      .webp({ quality: 68 })
      .toFile(out);
    console.log(`wrote ${out} (${((await stat(out)).size / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
