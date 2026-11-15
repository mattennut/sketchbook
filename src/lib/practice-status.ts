import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "./db";
import { generatedContent, submissions, type Plan } from "./db/schema";
import type { CatalogEntry } from "./catalog";
import type { StoredTaskSet } from "./content";
import { bandFor } from "./skills";

export type PracticeItem = {
  taskId: string;
  title: string;
  minutes: number;
  /** Best overall rubric score (1–5) across the learner's own critiqued attempts; null = not completed. */
  best: number | null;
  attempts: number;
  /** Most recent critique for this practice, to link to its feedback. */
  latestSubmissionId: string | null;
};

/**
 * Practice exercises for the given lessons with the learner's completion and best score.
 * A practice counts as completed once one of the learner's own drawings (not a sample)
 * has been critiqued for it. Lessons whose exercises aren't generated yet map to null.
 */
export async function getPracticeStatus(
  db: DB,
  sessionId: string,
  plan: Plan,
  lessons: CatalogEntry[],
): Promise<Map<string, PracticeItem[] | null>> {
  const out = new Map<string, PracticeItem[] | null>();
  if (!lessons.length) return out;
  const ids = lessons.map((l) => l.id);

  const [taskRows, subs] = await Promise.all([
    db
      .select({ subtopicId: generatedContent.subtopicId, levelBand: generatedContent.levelBand, content: generatedContent.content })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.kind, "tasks"),
          eq(generatedContent.status, "ready"),
          eq(generatedContent.variant, ""),
          inArray(generatedContent.subtopicId, ids),
        ),
      ),
    db
      .select({
        id: submissions.id,
        subtopicId: submissions.subtopicId,
        taskId: submissions.taskId,
        levelBand: submissions.levelBand,
        score: submissions.overallScore,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.sessionId, sessionId),
          eq(submissions.status, "done"),
          isNull(submissions.sampleId),
          isNotNull(submissions.overallScore),
          inArray(submissions.subtopicId, ids),
        ),
      )
      .orderBy(desc(submissions.createdAt)),
  ]);

  for (const lesson of lessons) {
    const band = bandFor(plan.profile, lesson.skill);
    const set = taskRows.find((r) => r.subtopicId === lesson.id && r.levelBand === band)?.content as StoredTaskSet | undefined;
    if (!set) {
      out.set(lesson.id, null);
      continue;
    }
    out.set(
      lesson.id,
      set.tasks.map((t) => {
        const mine = subs.filter((s) => s.subtopicId === lesson.id && s.taskId === t.id && s.levelBand === band);
        const scores = mine.map((s) => s.score!).filter((n) => Number.isFinite(n));
        return {
          taskId: t.id,
          title: t.title,
          minutes: t.timeboxMinutes,
          best: scores.length ? Math.max(...scores) : null,
          attempts: mine.length,
          latestSubmissionId: mine[0]?.id ?? null,
        };
      }),
    );
  }
  return out;
}
