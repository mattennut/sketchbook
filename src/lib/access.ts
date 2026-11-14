import type { GuestSession, Plan } from "./db/schema";

export const FREE_CRITIQUES = 3;
export const PRICE_LABEL = "$12/month";

/** Free tier: the whole plan is visible, but only week 1 lessons and practice are open. */
export function canOpenSubtopic(session: GuestSession, plan: Plan | null, subtopicId: string): boolean {
  if (!plan) return false;
  const inPlan = plan.weeks.some((w) => w.subtopicIds.includes(subtopicId));
  if (!inPlan) return false;
  if (session.isPaid) return true;
  return plan.weeks[0]?.subtopicIds.includes(subtopicId) ?? false;
}

export function critiquesLeft(session: GuestSession): number | null {
  if (session.isPaid) return null; // unlimited (still rate limited)
  return Math.max(0, FREE_CRITIQUES - session.freeCritiquesUsed);
}
