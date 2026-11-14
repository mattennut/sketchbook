import type { DB } from "./db";
import { generateStructured, imageBlock } from "./ai/client";
import type { AiKind } from "./ai/budget";
import { CritiqueSchema, critiquePrompt, type CritiqueOutput } from "./ai/prompts";
import type { StoredTask } from "./content";
import type { ImageType } from "./image";
import type { LevelBand } from "./skills";

export function validateCritique(c: CritiqueOutput, task: StoredTask): string[] {
  if (!c.isDrawing) return [];
  const problems: string[] = [];
  const expected = task.rubric.map((r) => r.id);
  const got: string[] = c.scores.map((s) => s.criterionId);
  for (const id of expected) {
    if (!got.includes(id)) problems.push(`Missing a score for criterion ${id}.`);
  }
  if (new Set(got).size !== got.length) problems.push("Score each criterion exactly once.");
  for (const id of got) if (!expected.includes(id)) problems.push(`Unknown criterion ${id}.`);
  if (c.strengths.length !== 2) problems.push("Give exactly 2 strengths.");
  return problems;
}

export function overallScore(c: CritiqueOutput): number | null {
  if (!c.isDrawing || !c.scores.length) return null;
  return Math.round((c.scores.reduce((a, s) => a + s.score, 0) / c.scores.length) * 10) / 10;
}

export async function critiqueDrawing(opts: {
  db: DB;
  sessionId: string | null;
  kind: Extract<AiKind, "critique" | "sample_critique">;
  image: { buf: Buffer; type: ImageType };
  task: StoredTask;
  band: LevelBand;
  skipBudget?: boolean;
}): Promise<CritiqueOutput> {
  return generateStructured({
    db: opts.db,
    kind: opts.kind,
    sessionId: opts.sessionId,
    skipBudget: opts.skipBudget,
    system: critiquePrompt.system,
    content: [
      imageBlock(opts.image.buf, opts.image.type),
      { type: "text", text: critiquePrompt.user(opts.task, opts.band) },
    ],
    schema: CritiqueSchema,
    validate: (c) => validateCritique(c, opts.task),
    effort: "medium",
  });
}
