import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { guestSessions, submissions } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { getActivePlan, getLatestProfile } from "@/lib/plan";
import { catalogById, loadCatalog } from "@/lib/catalog";
import { FREE_CRITIQUES, canOpenSubtopic } from "@/lib/access";
import { getReadyTaskSet } from "@/lib/content";
import { bandForPlan } from "@/lib/guest";
import { readImageFile } from "@/lib/image";
import { saveImage, storageConfigured } from "@/lib/storage";
import { critiqueDrawing, overallScore } from "@/lib/critique";
import { applyCritiqueToProfile, markPracticed } from "@/lib/progress";
import { aiConfigured } from "@/lib/ai/client";
import { handleRouteError, jsonError } from "@/lib/http";
import { equipmentLabels } from "@/lib/skills";

export const maxDuration = 180;

/** Upload a photo of a drawing for a practice task → AI critique against that task's rubric. */
export async function POST(request: Request) {
  let submissionId: string | null = null;
  let refundSessionId: string | null = null;
  const db = await getDb();
  try {
    const session = await requireSession();
    const form = await request.formData();
    const subtopicId = String(form.get("subtopicId") ?? "");
    const taskId = String(form.get("taskId") ?? "");

    const plan = await getActivePlan(db, session.id);
    if (!plan) return jsonError(409, "no_plan", "Take the assessment to get your plan first.");
    const entry = catalogById(await loadCatalog(db)).get(subtopicId);
    if (!entry) return jsonError(404, "not_found", "Unknown lesson.");
    if (!canOpenSubtopic(session, plan, subtopicId)) {
      return jsonError(402, "paywall", "This lesson is part of Sketchbook Plus.");
    }
    if (!aiConfigured()) return jsonError(503, "not_configured", "The AI coach isn't configured on this deployment yet.");
    if (!storageConfigured()) return jsonError(503, "storage", "Image storage isn't configured on this deployment yet.");

    const band = bandForPlan(plan, entry.skill);
    const task = (await getReadyTaskSet(db, subtopicId, band))?.tasks.find((t) => t.id === taskId);
    if (!task) return jsonError(409, "task_missing", "That practice task isn't ready yet. Reload and try again.");

    const image = await readImageFile(form.get("image"));
    if (!image.ok) return jsonError(400, "bad_image", image.message);

    // Reserve one free critique atomically (Plus members are unlimited, rate limits still apply).
    if (!session.isPaid) {
      const reserved = await db
        .update(guestSessions)
        .set({ freeCritiquesUsed: sql`${guestSessions.freeCritiquesUsed} + 1` })
        .where(and(eq(guestSessions.id, session.id), lt(guestSessions.freeCritiquesUsed, FREE_CRITIQUES)))
        .returning({ used: guestSessions.freeCritiquesUsed });
      if (!reserved.length) {
        return jsonError(402, "paywall", `You've used your ${FREE_CRITIQUES} free critiques. Plus includes unlimited critiques.`);
      }
      refundSessionId = session.id;
    }

    const imageRef = await saveImage(`${session.id}/${crypto.randomUUID()}.jpg`, image.buf, image.type);
    const [row] = await db
      .insert(submissions)
      .values({ sessionId: session.id, subtopicId, taskId, levelBand: band, imageRef, status: "critiquing" })
      .returning({ id: submissions.id });
    submissionId = row.id;

    const critique = await critiqueDrawing({
      db,
      sessionId: session.id,
      kind: "critique",
      image,
      task,
      band,
      equipment: equipmentLabels(session.equipment),
    });
    const score = overallScore(critique);
    await db
      .update(submissions)
      .set({ status: "done", critique, overallScore: score })
      .where(eq(submissions.id, row.id));

    if (critique.isDrawing && score !== null) {
      refundSessionId = null; // the critique counted
      await markPracticed(db, session.id, subtopicId, score);
      const current = (await getLatestProfile(db, session.id)) ?? plan.profile;
      await applyCritiqueToProfile(db, session.id, current, task, critique);
    }
    await refund(db, refundSessionId);
    return NextResponse.json({ id: row.id, isDrawing: critique.isDrawing });
  } catch (err) {
    await refund(db, refundSessionId).catch(() => {});
    if (submissionId) {
      await db
        .update(submissions)
        .set({ status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "error" })
        .where(eq(submissions.id, submissionId))
        .catch(() => {});
    }
    return handleRouteError(err, "submissions");
  }
}

/** A failed or non-drawing critique doesn't use up a free critique. */
async function refund(db: Awaited<ReturnType<typeof getDb>>, sessionId: string | null) {
  if (!sessionId) return;
  await db
    .update(guestSessions)
    .set({ freeCritiquesUsed: sql`greatest(${guestSessions.freeCritiquesUsed} - 1, 0)` })
    .where(eq(guestSessions.id, sessionId));
}
