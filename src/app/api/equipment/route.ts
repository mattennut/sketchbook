import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { guestSessions } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { handleRouteError, jsonError } from "@/lib/http";
import { EQUIPMENT_IDS } from "@/lib/skills";

const Body = z.object({ equipment: z.array(z.enum(EQUIPMENT_IDS)).max(EQUIPMENT_IDS.length) });

/** Update the learner's drawing equipment (Progress → Plan settings). */
export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "invalid", "Unknown equipment.");
    const session = await requireSession();
    const equipment = [...new Set(parsed.data.equipment)];
    const db = await getDb();
    await db.update(guestSessions).set({ equipment }).where(eq(guestSessions.id, session.id));
    return NextResponse.json({ equipment });
  } catch (err) {
    return handleRouteError(err, "equipment");
  }
}
