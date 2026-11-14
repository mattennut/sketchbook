import { and, desc, eq } from "drizzle-orm";
import type { DB } from "./db";
import { plans, skillSnapshots, type Plan, type PlanWeek } from "./db/schema";
import { catalogById, eligibleFor, isStarter, loadCatalog, type CatalogEntry } from "./catalog";
import { AiError, generateStructured } from "./ai/client";
import { planPrompt, PlanSchema, type PlanOutput } from "./ai/prompts";
import {
  SKILLS,
  SKILL_LABELS,
  SPECIALIZATION_INFO,
  type Skill,
  type SkillScores,
  type Specialization,
} from "./skills";

export async function getActivePlan(db: DB, sessionId: string): Promise<Plan | null> {
  const [row] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.sessionId, sessionId), eq(plans.isActive, true)))
    .orderBy(desc(plans.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getLatestProfile(db: DB, sessionId: string): Promise<SkillScores | null> {
  const [row] = await db
    .select()
    .from(skillSnapshots)
    .where(eq(skillSnapshots.sessionId, sessionId))
    .orderBy(desc(skillSnapshots.createdAt))
    .limit(1);
  return row?.scores ?? null;
}

/** Checks a model-proposed plan against the catalog. Returns human-readable problems (empty = valid). */
export function validatePlan(plan: PlanOutput, eligible: CatalogEntry[], profile?: SkillScores): string[] {
  const problems: string[] = [];
  const byId = catalogById(eligible);
  const seen = new Map<string, number>();
  const sorted = [...plan.weeks].sort((a, b) => a.week - b.week);

  sorted.forEach((w, i) => {
    if (w.week !== i + 1) problems.push(`Weeks must be numbered 1–12 exactly once (found week ${w.week} at position ${i + 1}).`);
  });

  let order = 0;
  for (const w of sorted) {
    for (const id of w.subtopicIds) {
      const entry = byId.get(id);
      if (!entry) {
        problems.push(`Unknown subtopic id "${id}" in week ${w.week} — use only catalog ids.`);
        continue;
      }
      if (seen.has(id)) problems.push(`Subtopic "${id}" is used more than once.`);
      seen.set(id, order++);
      if (w.week === 1 && !isStarter(entry)) problems.push(`Week 1 may only use starter ids; "${id}" is not one.`);
    }
  }
  for (const [id, pos] of seen) {
    for (const pre of byId.get(id)?.prerequisites ?? []) {
      const prePos = seen.get(pre);
      if (prePos !== undefined && prePos > pos) {
        problems.push(`"${pre}" is a prerequisite of "${id}" and must come before it.`);
      }
    }
  }
  if (sorted[0] && sorted[0].subtopicIds.length !== 3) problems.push("Week 1 must have exactly 3 subtopics.");

  // Week 1 must start where the learner is weakest (when starters for those skills exist).
  if (profile && sorted[0]) {
    const weakest = [...SKILLS].sort((a, b) => profile[a] - profile[b]).slice(0, 2);
    const available = eligible.filter((e) => isStarter(e) && weakest.includes(e.skill)).length;
    const hits = sorted[0].subtopicIds.filter((id) => weakest.includes(byId.get(id)?.skill as Skill)).length;
    const needed = Math.min(2, available);
    if (hits < needed) {
      problems.push(
        `Week 1 must include at least ${needed} starter subtopics training the weakest skills (${weakest.join(", ")}); it has ${hits}.`,
      );
    }
  }
  return problems.slice(0, 12);
}

/**
 * Deterministic planner used when the AI is unavailable or fails validation twice.
 * Greedy topological ordering that prefers weak skills, low difficulty and skill variety.
 */
export function fallbackPlan(
  profile: SkillScores,
  spec: Specialization,
  eligible: CatalogEntry[],
  fixedWeek1?: string[],
): PlanOutput {
  const remaining = new Map(eligible.map((e) => [e.id, e]));
  const scheduled = new Set<string>();
  const eligibleIds = new Set(eligible.map((e) => e.id));
  const weeks: PlanOutput["weeks"] = [];

  const ready = (e: CatalogEntry) =>
    e.prerequisites.every((p) => !eligibleIds.has(p) || scheduled.has(p));
  const priority = (e: CatalogEntry, week: number) => {
    const gap = 5 - profile[e.skill];
    const specific = e.tracks.includes(spec) ? (week >= 2 ? -0.6 : 0.4) : 0;
    const tooHard = Math.max(0, e.difficulty - (1 + week / 3));
    return e.difficulty * 1.0 - gap * 0.45 + specific + tooHard * 1.5;
  };

  for (let week = 1; week <= 12; week++) {
    const size = week === 1 ? 3 : week <= 4 ? 3 : 4;
    const picked: CatalogEntry[] = [];
    if (week === 1 && fixedWeek1) {
      for (const id of fixedWeek1) {
        const e = remaining.get(id);
        if (!e) continue;
        picked.push(e);
        remaining.delete(id);
        scheduled.add(id);
      }
    }
    while (picked.length < size) {
      const candidates = [...remaining.values()].filter(
        (e) => ready(e) && (week > 1 || isStarter(e)),
      );
      if (!candidates.length) break;
      const usedSkills = new Set(picked.map((p) => p.skill));
      candidates.sort(
        (a, b) =>
          priority(a, week) + (usedSkills.has(a.skill) ? 0.8 : 0) -
          (priority(b, week) + (usedSkills.has(b.skill) ? 0.8 : 0)),
      );
      const next = candidates[0];
      picked.push(next);
      remaining.delete(next.id);
      scheduled.add(next.id);
    }
    if (!picked.length) break;
    const skillCounts = new Map<Skill, number>();
    picked.forEach((p) => skillCounts.set(p.skill, (skillCounts.get(p.skill) ?? 0) + 1));
    const ranked = [...skillCounts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    const main = ranked[0];
    const phase = week <= 4 ? "basics" : week <= 8 ? "in practice" : "in depth";
    weeks.push({
      week,
      theme: ranked[1]
        ? `${SKILL_LABELS[main]} & ${SKILL_LABELS[ranked[1]].toLowerCase()} ${phase}`
        : `${SKILL_LABELS[main]} ${phase}`,
      rationale:
        profile[main] < 3
          ? `Your ${SKILL_LABELS[main].toLowerCase()} score is ${profile[main].toFixed(1)}/5, so this week builds it step by step alongside ${picked.length - 1} supporting topics.`
          : `You're already comfortable with ${SKILL_LABELS[main].toLowerCase()}, so this week pushes it further toward ${SPECIALIZATION_INFO[spec].label.toLowerCase()}.`,
      subtopicIds: picked.map((p) => p.id),
    });
  }
  const weakest = [...SKILLS].sort((a, b) => profile[a] - profile[b]).slice(0, 2);
  return {
    overview: `We start with ${weakest.map((s) => SKILL_LABELS[s].toLowerCase()).join(" and ")}, where you have the most room to grow, then build toward ${SPECIALIZATION_INFO[spec].label.toLowerCase()}. Difficulty rises gently, and every week mixes skills so practice stays fresh.`,
    weeks,
  };
}

export async function buildPlan(opts: {
  db: DB;
  sessionId: string;
  profile: SkillScores;
  specialization: Specialization;
}): Promise<Plan> {
  const { db, sessionId, profile, specialization } = opts;
  const catalog = await loadCatalog(db);
  const eligible = eligibleFor(catalog, specialization);
  const info = SPECIALIZATION_INFO[specialization];

  let output: PlanOutput;
  let source: "ai" | "fallback" = "ai";
  try {
    output = await generateStructured({
      db,
      kind: "plan",
      sessionId,
      system: planPrompt.system,
      content: planPrompt.user({
        profile,
        specializationLabel: info.label,
        specializationBlurb: info.blurb,
        catalog: eligible,
        starterIds: eligible.filter(isStarter).map((e) => e.id),
      }),
      schema: PlanSchema,
      validate: (p) => validatePlan(p, eligible, profile),
      effort: "medium",
    });
  } catch (err) {
    // Rate limits are surfaced to the user; anything else degrades gracefully.
    if (err instanceof AiError && (err.code === "session_limit" || err.code === "daily_cap")) throw err;
    console.warn("[plan] falling back to deterministic planner:", err instanceof Error ? err.message : err);
    output = fallbackPlan(profile, specialization, eligible);
    source = "fallback";
  }

  const weeks: PlanWeek[] = [...output.weeks]
    .sort((a, b) => a.week - b.week)
    .map((w) => ({ week: w.week, theme: w.theme, rationale: w.rationale, subtopicIds: w.subtopicIds }));

  await db.update(plans).set({ isActive: false }).where(eq(plans.sessionId, sessionId));
  const [row] = await db
    .insert(plans)
    .values({ sessionId, specialization, profile, overview: output.overview, weeks, source, isActive: true })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Default course: for learners who skip the skill test
// ---------------------------------------------------------------------------

/** Flat beginner profile → every lesson uses the "beginner" level band. */
export const DEFAULT_PROFILE: SkillScores = {
  perspective: 2,
  proportion: 2,
  value: 2,
  color: 2,
  linework: 2,
  composition: 2,
};

/** Fixed week 1 of the default course. Its decks + tasks are pre-generated (`npm run seed:default`). */
export const DEFAULT_WEEK1 = ["line-confidence", "basic-shapes", "value-scale"];

/** Deterministic, instant plan (no AI call). Same week 1 for every specialization. */
export async function buildDefaultPlan(opts: {
  db: DB;
  sessionId: string;
  specialization: Specialization;
}): Promise<Plan> {
  const { db, sessionId, specialization } = opts;
  const eligible = eligibleFor(await loadCatalog(db), specialization);
  const output = fallbackPlan(DEFAULT_PROFILE, specialization, eligible, DEFAULT_WEEK1);
  const byId = catalogById(eligible);
  const specLabel = SPECIALIZATION_INFO[specialization].label.toLowerCase();
  const listTitles = (ids: string[]) => {
    const t = ids.map((id) => byId.get(id)?.title ?? id);
    return t.length > 1 ? `${t.slice(0, -1).join(", ")} and ${t.at(-1)}` : (t[0] ?? "");
  };
  // No skill scores exist on the default course, so weeks are named by topic, not by "your score is…".
  const weeks: PlanWeek[] = [...output.weeks]
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      if (w.week === 1) {
        return {
          ...w,
          theme: "Foundations: line, shape & value",
          rationale:
            "Every drawing rests on three things: confident marks, simple shapes and light versus dark. Start here and everything after gets easier.",
        };
      }
      const topics = [...new Set(w.subtopicIds.map((id) => byId.get(id)?.topicTitle).filter(Boolean))] as string[];
      const phase =
        w.week <= 4 ? "Building on the foundations" : w.week <= 8 ? "Putting the basics to work" : `Going deeper toward ${specLabel}`;
      return {
        ...w,
        theme: topics.slice(0, 2).join(" · "),
        rationale: `${phase}: ${listTitles(w.subtopicIds)}.`,
      };
    });
  const overview = `The Sketchbook default course: twelve weeks that build the fundamentals step by step, leaning toward ${SPECIALIZATION_INFO[specialization].label.toLowerCase()} as you go. Take the five-minute skill test any time to personalize it.`;

  await db.update(plans).set({ isActive: false }).where(eq(plans.sessionId, sessionId));
  const [row] = await db
    .insert(plans)
    .values({ sessionId, specialization, profile: DEFAULT_PROFILE, overview, weeks, source: "default", isActive: true })
    .returning();
  return row;
}

/** Where the learner is: first week with unfinished subtopics. */
export function currentWeek(plan: Plan, practiced: Set<string>): number {
  for (const w of plan.weeks) {
    if (w.subtopicIds.some((id) => !practiced.has(id))) return w.week;
  }
  return plan.weeks.length;
}

export function weekOf(plan: Plan, subtopicId: string): number | null {
  return plan.weeks.find((w) => w.subtopicIds.includes(subtopicId))?.week ?? null;
}
