import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "./db";
import { skillSnapshots, submissions, subtopicProgress } from "./db/schema";
import { clampScore, isSkill, type SkillScores } from "./skills";
import type { CritiqueOutput } from "./ai/prompts";
import type { StoredTask } from "./content";

export async function getProgressSets(db: DB, sessionId: string) {
  const rows = await db.select().from(subtopicProgress).where(eq(subtopicProgress.sessionId, sessionId));
  return {
    lessonDone: new Set(rows.filter((r) => r.lessonCompletedAt).map((r) => r.subtopicId)),
    practiced: new Set(rows.filter((r) => r.practicedAt).map((r) => r.subtopicId)),
    rows,
  };
}

export async function markLessonDone(db: DB, sessionId: string, subtopicId: string) {
  await db
    .insert(subtopicProgress)
    .values({ sessionId, subtopicId, lessonCompletedAt: new Date() })
    .onConflictDoUpdate({
      target: [subtopicProgress.sessionId, subtopicProgress.subtopicId],
      set: { lessonCompletedAt: sql`coalesce(${subtopicProgress.lessonCompletedAt}, now())` },
    });
}

export async function markPracticed(db: DB, sessionId: string, subtopicId: string, score: number) {
  await db
    .insert(subtopicProgress)
    .values({ sessionId, subtopicId, practicedAt: new Date(), bestScore: score })
    .onConflictDoUpdate({
      target: [subtopicProgress.sessionId, subtopicProgress.subtopicId],
      set: {
        practicedAt: sql`coalesce(${subtopicProgress.practicedAt}, now())`,
        bestScore: sql`greatest(coalesce(${subtopicProgress.bestScore}, 0), ${score})`,
      },
    });
}

/**
 * Nudges the skill profile toward what the critique observed.
 * Each rubric criterion maps to a skill; new = 0.8·old + 0.2·observed (gentle EMA,
 * so one bad photo can't tank a profile). Stored as a new snapshot for the history chart.
 */
export async function applyCritiqueToProfile(
  db: DB,
  sessionId: string,
  current: SkillScores,
  task: StoredTask,
  critique: CritiqueOutput,
): Promise<SkillScores> {
  const bySkill = new Map<string, number[]>();
  for (const s of critique.scores) {
    const criterion = task.rubric.find((r) => r.id === s.criterionId);
    if (!criterion || !isSkill(criterion.skill)) continue;
    bySkill.set(criterion.skill, [...(bySkill.get(criterion.skill) ?? []), s.score]);
  }
  if (!bySkill.size) return current;
  const next = { ...current };
  for (const [skill, scores] of bySkill) {
    const observed = scores.reduce((a, b) => a + b, 0) / scores.length;
    const key = skill as keyof SkillScores;
    next[key] = clampScore(current[key] * 0.8 + observed * 0.2);
  }
  await db.insert(skillSnapshots).values({ sessionId, source: "critique", scores: next });
  return next;
}

export async function recentSubmissions(db: DB, sessionId: string, limit = 12) {
  return db
    .select()
    .from(submissions)
    .where(and(eq(submissions.sessionId, sessionId), eq(submissions.status, "done"), isNull(submissions.sampleId)))
    .orderBy(desc(submissions.createdAt))
    .limit(limit);
}
