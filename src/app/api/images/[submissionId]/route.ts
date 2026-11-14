import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { readSessionId } from "@/lib/session";
import { loadImage } from "@/lib/storage";
import { getSample } from "@/lib/samples";

type Ctx = { params: Promise<{ submissionId: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

/** Owner-only image proxy: drawings live in private storage and are never publicly addressable. */
export async function GET(_req: Request, ctx: Ctx) {
  const { submissionId } = await ctx.params;
  const sessionId = await readSessionId();
  if (!sessionId || !UUID.test(submissionId)) return new NextResponse(null, { status: 404 });

  const db = await getDb();
  const [row] = await db
    .select({ imageRef: submissions.imageRef, sampleId: submissions.sampleId })
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), eq(submissions.sessionId, sessionId)));
  if (!row) return new NextResponse(null, { status: 404 });

  if (row.sampleId) {
    const sample = getSample(row.sampleId);
    return sample ? NextResponse.redirect(new URL(`/samples/${sample.file}`, _req.url)) : new NextResponse(null, { status: 404 });
  }
  if (!row.imageRef) return new NextResponse(null, { status: 404 });

  const image = await loadImage(row.imageRef);
  if (!image) return new NextResponse(null, { status: 404 });
  const body: BodyInit = Buffer.isBuffer(image.body) ? new Uint8Array(image.body) : (image.body as ReadableStream);
  return new NextResponse(body, {
    headers: {
      "content-type": image.contentType,
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
