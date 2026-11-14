import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { guestSessions } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { buildDefaultPlan } from "@/lib/plan";
import { handleRouteError, jsonError } from "@/lib/http";
import { SPECIALIZATIONS } from "@/lib/skills";

const Body = z.object({ specialization: z.enum(SPECIALIZATIONS) });

/** Skip the skill test: instant, deterministic default course (no AI call, week 1 pre-generated). */
export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "invalid", "Pick a direction first.");
    const session = await requireSession();
    const db = await getDb();
    await db
      .update(guestSessions)
      .set({ specialization: parsed.data.specialization })
      .where(eq(guestSessions.id, session.id));
    const plan = await buildDefaultPlan({ db, sessionId: session.id, specialization: parsed.data.specialization });
    return NextResponse.json({ planId: plan.id, source: plan.source });
  } catch (err) {
    return handleRouteError(err, "plan-default");
  }
}
