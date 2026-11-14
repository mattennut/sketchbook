import { and, count, eq, gte, sql } from "drizzle-orm";
import type { DB } from "../db";
import { aiCalls } from "../db/schema";

export type AiKind = "portfolio" | "plan" | "deck" | "tasks" | "critique" | "sample_critique";

/** Max model calls per guest per rolling hour. */
const HOURLY_LIMITS: Record<AiKind, number> = {
  portfolio: 3,
  plan: 4,
  deck: 10,
  tasks: 10,
  critique: 12,
  sample_critique: 8,
};

export function dailyCap(): number {
  const n = Number(process.env.AI_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 400;
}

export type BudgetCheck = { ok: true } | { ok: false; reason: "session_limit" | "daily_cap" };

/** Per-session hourly limit + global daily cap. Seed scripts pass sessionId = null to skip the session limit. */
export async function checkAiBudget(db: DB, sessionId: string | null, kind: AiKind): Promise<BudgetCheck> {
  const [{ today }] = await db
    .select({ today: count() })
    .from(aiCalls)
    .where(gte(aiCalls.createdAt, sql`date_trunc('day', now())`));
  if (today >= dailyCap()) return { ok: false, reason: "daily_cap" };

  if (sessionId) {
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(aiCalls)
      .where(
        and(
          eq(aiCalls.sessionId, sessionId),
          eq(aiCalls.kind, kind),
          gte(aiCalls.createdAt, sql`now() - interval '1 hour'`),
        ),
      );
    if (recent >= HOURLY_LIMITS[kind]) return { ok: false, reason: "session_limit" };
  }
  return { ok: true };
}

export async function logAiStart(db: DB, sessionId: string | null, kind: AiKind, model: string) {
  const [row] = await db
    .insert(aiCalls)
    .values({ sessionId, kind, status: "started", model })
    .returning({ id: aiCalls.id });
  return row.id;
}

export async function logAiFinish(
  db: DB,
  id: string,
  status: "ok" | "error",
  usage: { input: number; output: number },
) {
  await db
    .update(aiCalls)
    .set({ status, inputTokens: usage.input, outputTokens: usage.output })
    .where(eq(aiCalls.id, id));
}
