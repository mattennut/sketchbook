import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getActivePlan } from "@/lib/plan";
import { canOpenSubtopic } from "@/lib/access";
import { markLessonDone } from "@/lib/progress";
import { handleRouteError, jsonError } from "@/lib/http";

const Body = z.object({ subtopicId: z.string().min(1).max(64) });

/** Marks a lesson deck as finished (reached the last slide). */
export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "invalid", "Missing lesson.");
    const session = await requireSession();
    const db = await getDb();
    const plan = await getActivePlan(db, session.id);
    if (!canOpenSubtopic(session, plan, parsed.data.subtopicId)) {
      return jsonError(402, "paywall", "This lesson is part of Sketchbook Plus.");
    }
    await markLessonDone(db, session.id, parsed.data.subtopicId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "progress-lesson");
  }
}
