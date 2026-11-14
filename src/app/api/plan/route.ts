import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { guestSessions } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { buildPlan, getActivePlan, getLatestProfile } from "@/lib/plan";
import { handleRouteError, jsonError } from "@/lib/http";
import { SPECIALIZATIONS, isSpecialization } from "@/lib/skills";

export const maxDuration = 300;

const Body = z.object({
  specialization: z.enum(SPECIALIZATIONS).optional(),
});

/**
 * Builds (or rebuilds) the 12-week plan.
 * Free: the first plan, and a rebuild when the specialization changes.
 * Plus: rebuild any time (e.g. after the skill profile has moved).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = Body.safeParse(await request.json().catch(() => ({})));
    if (!body.success) return jsonError(400, "invalid", "Unknown specialization.");

    const db = await getDb();
    const specialization = body.data.specialization ?? session.specialization;
    if (!isSpecialization(specialization)) {
      return jsonError(400, "no_specialization", "Pick a specialization first.");
    }
    const profile = await getLatestProfile(db, session.id);
    if (!profile) return jsonError(400, "no_profile", "Take the assessment first.");

    const existing = await getActivePlan(db, session.id);
    // Upgrading from the default course to a personalized plan is free; so is switching specialization.
    const isRebuild = !!existing && existing.source !== "default" && existing.specialization === specialization;
    if (isRebuild && !session.isPaid) {
      return jsonError(402, "paywall", "Rebuilding your plan is part of Sketchbook Plus.");
    }

    if (specialization !== session.specialization) {
      await db.update(guestSessions).set({ specialization }).where(eq(guestSessions.id, session.id));
    }
    const plan = await buildPlan({ db, sessionId: session.id, profile, specialization });
    return NextResponse.json({ planId: plan.id, source: plan.source });
  } catch (err) {
    return handleRouteError(err, "plan");
  }
}
