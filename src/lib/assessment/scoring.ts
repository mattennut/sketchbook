import { z } from "zod";
import { SKILLS, clampScore, type Skill, type SkillScores } from "../skills";
import { EXPERIENCE_OPTIONS, MCQ_ITEMS, PERCEPTION_ITEMS, UNSURE } from "./items";
import type { PortfolioEstimate } from "../db/schema";

/** Server-side answer key. */
const KEY: Record<string, string> = {
  "persp-box": "a",
  ellipse: "b",
  face: "a",
  sphere: "b",
  "color-value": "a",
  "color-temp": "b",
  focal: "a",
  "mcq-horizon": "low",
  "mcq-core": "terminator",
  "mcq-complement": "blue-orange",
};

const EXPERIENCE_BASE: Record<string, number> = {
  new: 1,
  doodle: 1.5,
  class: 2.5,
  weekly: 3,
  trained: 4,
};

const itemIds = [...PERCEPTION_ITEMS, ...MCQ_ITEMS].map((i) => i.id);

export const AnswersSchema = z
  .object({
    experience: z.enum(EXPERIENCE_OPTIONS.map((o) => o.id) as [string, ...string[]]),
  })
  .catchall(z.string().max(40))
  .refine((a) => itemIds.every((id) => typeof a[id] === "string"), {
    message: "Every question needs an answer (or 'not sure').",
  });

export type Answers = z.infer<typeof AnswersSchema>;

export function isCorrect(itemId: string, answer: string): boolean {
  return KEY[itemId] === answer;
}

/**
 * Turns answers into a 1–5 profile per skill.
 * score = 0.6·experience + 2.4·(share of that skill's items answered correctly) + 0.4
 * ("not sure" earns a quarter credit). Linework has no perception test, so it relies
 * on experience and — when provided — the portfolio estimate.
 */
export function computeProfile(answers: Answers, portfolio?: PortfolioEstimate | null): SkillScores {
  const base = EXPERIENCE_BASE[answers.experience] ?? 1;
  const items = [...PERCEPTION_ITEMS, ...MCQ_ITEMS];
  const out = {} as SkillScores;

  for (const skill of SKILLS) {
    const mine = items.filter((i) => i.skill === skill);
    let ratio = 0.5;
    if (mine.length) {
      const credit = mine.reduce((sum, i) => {
        const a = answers[i.id];
        if (a === UNSURE) return sum + 0.25;
        return sum + (isCorrect(i.id, a) ? 1 : 0);
      }, 0);
      ratio = credit / mine.length;
    }
    let score = base * 0.6 + ratio * 2.4 + 0.4;

    const est = portfolio?.estimates?.[skill as Skill];
    if (est && typeof est.score === "number") {
      const w = skill === "linework" ? 0.7 : 0.5;
      score = score * (1 - w) + est.score * w;
    }
    out[skill] = clampScore(score);
  }
  return out;
}
