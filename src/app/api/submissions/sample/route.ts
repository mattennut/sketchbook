import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { getActivePlan } from "@/lib/plan";
import { catalogById, loadCatalog } from "@/lib/catalog";
import { canOpenSubtopic } from "@/lib/access";
import { claimGeneration, getContentRow, getReadyTaskSet, runGeneration } from "@/lib/content";
import { bandForPlan } from "@/lib/guest";
import { getSample } from "@/lib/samples";
import { critiqueDrawing, overallScore } from "@/lib/critique";
import { AiError, aiConfigured } from "@/lib/ai/client";
import { checkAiBudget } from "@/lib/ai/budget";
import type { CritiqueOutput } from "@/lib/ai/prompts";
import { handleRouteError, jsonError } from "@/lib/http";

export const maxDuration = 180;

const Body = z.object({
  sampleId: z.string().max(40),
  subtopicId: z.string().max(64),
  taskId: z.string().max(8),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Try with a sample drawing": critiques a bundled drawing against the current task.
 * Results are cached per (sample, subtopic, task, band) and shared, so a jury clicking
 * around sees instant results after the first run. Doesn't use a free critique.
 */
export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "invalid", "Pick a sample drawing.");
    const { sampleId, subtopicId, taskId } = parsed.data;
    const sample = getSample(sampleId);
    if (!sample) return jsonError(404, "not_found", "Unknown sample.");

    const session = await requireSession();
    const db = await getDb();
    const plan = await getActivePlan(db, session.id);
    if (!plan) return jsonError(409, "no_plan", "Take the assessment to get your plan first.");
    const entry = catalogById(await loadCatalog(db)).get(subtopicId);
    if (!entry) return jsonError(404, "not_found", "Unknown lesson.");
    if (!canOpenSubtopic(session, plan, subtopicId)) {
      return jsonError(402, "paywall", "This lesson is part of Sketchbook Plus.");
    }
    const band = bandForPlan(plan, entry.skill);
    const task = (await getReadyTaskSet(db, subtopicId, band))?.tasks.find((t) => t.id === taskId);
    if (!task) return jsonError(409, "task_missing", "That practice task isn't ready yet. Reload and try again.");

    // Bump SAMPLE_PROMPT_VERSION when the sample critique prompt changes, so cached results refresh.
    const SAMPLE_PROMPT_VERSION = "v2";
    const key = { kind: "sample_critique" as const, subtopicId, band, variant: `${sampleId}:${taskId}:${SAMPLE_PROMPT_VERSION}` };
    let critique: CritiqueOutput | null = null;

    for (let waited = 0; waited < 120_000 && !critique; ) {
      const row = await getContentRow(db, key);
      if (row?.status === "ready") {
        critique = row.content as CritiqueOutput;
        break;
      }
      const busy = row?.status === "generating" && Date.now() - row.startedAt.getTime() < 4 * 60_000;
      if (!busy) {
        if (!aiConfigured()) throw new AiError("not_configured", "not configured");
        const budget = await checkAiBudget(db, session.id, "sample_critique");
        if (!budget.ok) throw new AiError(budget.reason, budget.reason);
        if (await claimGeneration(db, key)) {
          const buf = await readFile(path.join(process.cwd(), "public", "samples", sample.file));
          critique = (await runGeneration(db, key, () =>
            critiqueDrawing({
              db,
              sessionId: session.id,
              kind: "sample_critique",
              image: { buf, type: "image/jpeg" },
              task,
              band,
              skipBudget: true,
            }),
          )) as CritiqueOutput;
          break;
        }
      }
      await sleep(2000);
      waited += 2000;
    }
    if (!critique) return jsonError(504, "timeout", "The coach is taking too long. Please try again.");

    const [row] = await db
      .insert(submissions)
      .values({
        sessionId: session.id,
        subtopicId,
        taskId,
        levelBand: band,
        sampleId,
        status: "done",
        critique,
        overallScore: overallScore(critique),
      })
      .returning({ id: submissions.id });
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return handleRouteError(err, "sample-critique");
  }
}
