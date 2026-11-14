import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { assessments, guestSessions, portfolioEstimates, skillSnapshots } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { AnswersSchema, computeProfile } from "@/lib/assessment/scoring";
import { handleRouteError, jsonError } from "@/lib/http";
import { EQUIPMENT_IDS, SPECIALIZATIONS } from "@/lib/skills";

const Body = z.object({
  specialization: z.enum(SPECIALIZATIONS),
  answers: AnswersSchema,
  equipment: z.array(z.enum(EQUIPMENT_IDS)).max(EQUIPMENT_IDS.length).optional(),
  portfolioId: z.uuid().nullable().optional(),
});

/** Scores the onboarding assessment and stores the resulting skill profile. */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "invalid", "Some answers are missing.");
    const { specialization, answers, portfolioId } = parsed.data;
    const equipment = parsed.data.equipment ? [...new Set(parsed.data.equipment)] : null;

    const db = await getDb();
    let portfolio = null;
    if (portfolioId) {
      const [row] = await db
        .select()
        .from(portfolioEstimates)
        .where(and(eq(portfolioEstimates.id, portfolioId), eq(portfolioEstimates.sessionId, session.id)));
      portfolio = row?.estimate ?? null;
    }

    const profile = computeProfile(answers, portfolio);
    await db.insert(assessments).values({ sessionId: session.id, specialization, answers, equipment, portfolio, profile });
    await db.insert(skillSnapshots).values({ sessionId: session.id, source: "assessment", scores: profile });
    await db
      .update(guestSessions)
      .set({ specialization, ...(equipment ? { equipment } : {}) })
      .where(eq(guestSessions.id, session.id));

    return NextResponse.json({ profile, portfolioSummary: portfolio?.summary ?? null });
  } catch (err) {
    return handleRouteError(err, "assessment");
  }
}
