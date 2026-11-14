import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { portfolioEstimates } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { generateStructured, imageBlock } from "@/lib/ai/client";
import { portfolioPrompt, PortfolioSchema } from "@/lib/ai/prompts";
import { readImageFile } from "@/lib/image";
import { handleRouteError, jsonError } from "@/lib/http";
import { SPECIALIZATION_INFO, isSpecialization } from "@/lib/skills";

export const maxDuration = 120;

/** Optional portfolio upload during onboarding: 1–3 images → per-skill level estimate. Images are not stored. */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const form = await request.formData();
    const files = form.getAll("images").slice(0, 3);
    if (!files.length) return jsonError(400, "no_images", "Add at least one image.");
    const spec = form.get("specialization");
    const specLabel = isSpecialization(spec) ? SPECIALIZATION_INFO[spec].label : "drawing in general";

    const images = [];
    for (const f of files) {
      const img = await readImageFile(f);
      if (!img.ok) return jsonError(400, "bad_image", img.message);
      images.push(imageBlock(img.buf, img.type));
    }

    const db = await getDb();
    const estimate = await generateStructured({
      db,
      kind: "portfolio",
      sessionId: session.id,
      system: portfolioPrompt.system,
      content: [...images, { type: "text", text: portfolioPrompt.user(specLabel, images.length) }],
      schema: PortfolioSchema,
      effort: "low",
    });

    const stored = { estimates: estimate.isArtwork ? estimate.estimates : {}, summary: estimate.summary };
    const [row] = await db
      .insert(portfolioEstimates)
      .values({ sessionId: session.id, estimate: stored, imageCount: images.length })
      .returning({ id: portfolioEstimates.id });

    return NextResponse.json({ id: row.id, isArtwork: estimate.isArtwork, summary: estimate.summary });
  } catch (err) {
    return handleRouteError(err, "portfolio");
  }
}
