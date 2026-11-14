import { NextResponse, after } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getActivePlan } from "@/lib/plan";
import { catalogById, loadCatalog } from "@/lib/catalog";
import { canOpenSubtopic } from "@/lib/access";
import { ensureLessonContent } from "@/lib/content";
import { bandForPlan } from "@/lib/guest";
import { AI_ERROR_COPY, type AiErrorCode } from "@/lib/ai/client";
import { handleRouteError, jsonError } from "@/lib/http";

export const maxDuration = 300; // generation continues in after() up to this limit

type Ctx = { params: Promise<{ kind: string; subtopicId: string }> };

async function handle(ctx: Ctx, retry: boolean) {
  try {
    const { kind, subtopicId } = await ctx.params;
    if (kind !== "deck" && kind !== "tasks") return jsonError(404, "not_found", "Unknown content type.");

    const session = await requireSession();
    const db = await getDb();
    const plan = await getActivePlan(db, session.id);
    if (!plan) return jsonError(409, "no_plan", "Take the assessment to get your plan first.");
    const entry = catalogById(await loadCatalog(db)).get(subtopicId);
    if (!entry) return jsonError(404, "not_found", "That lesson doesn't exist.");
    if (!canOpenSubtopic(session, plan, subtopicId)) {
      return jsonError(402, "paywall", "This lesson is part of Sketchbook Plus.");
    }

    const state = await ensureLessonContent({
      db,
      kind,
      entry,
      band: bandForPlan(plan, entry.skill),
      sessionId: session.id,
      retry,
      schedule: (job) => after(job),
    });

    if (state.status === "failed") {
      const message =
        state.error in AI_ERROR_COPY
          ? AI_ERROR_COPY[state.error as AiErrorCode]
          : "We couldn't prepare this lesson. Please try again.";
      return NextResponse.json({ status: "failed", error: state.error, message });
    }
    return NextResponse.json(state, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return handleRouteError(err, "content");
  }
}

/** Returns the cached deck/task set, or starts generating it (once, shared by all learners). */
export function GET(_req: Request, ctx: Ctx) {
  return handle(ctx, false);
}

/** Retry after a failed generation. */
export function POST(_req: Request, ctx: Ctx) {
  return handle(ctx, true);
}
