import { and, eq, lt, or, sql } from "drizzle-orm";
import type { DB } from "./db";
import { generatedContent, type ContentKind } from "./db/schema";
import type { CatalogEntry } from "./catalog";
import { AiError, aiConfigured, generateStructured } from "./ai/client";
import { checkAiBudget } from "./ai/budget";
import {
  CRITERION_IDS,
  DeckSchema,
  deckPrompt,
  TaskSetSchema,
  tasksPrompt,
  type DeckOutput,
} from "./ai/prompts";
import { sanitizeSvg } from "./svg-sanitize";
import type { LevelBand } from "./skills";

// ---------------------------------------------------------------------------
// Stored shapes (what the UI renders)
// ---------------------------------------------------------------------------

export type Slide =
  | { type: "title"; heading: string; body: string }
  | { type: "concept"; heading: string; body: string; points: string[] }
  | { type: "steps"; heading: string; points: string[]; body: string | null }
  | { type: "do_dont"; heading: string; dos: string[]; donts: string[] }
  | { type: "diagram"; heading: string; svg: string; body: string }
  | { type: "exercise_preview"; heading: string; body: string; points: string[] };

export type StoredDeck = { slides: Slide[] };

export type StoredTask = {
  id: string;
  title: string;
  instruction: string;
  timeboxMinutes: number;
  focus: string[];
  rubric: { id: string; criterion: string; skill: string; lookFor: string }[];
};

export type StoredTaskSet = { tasks: StoredTask[] };

const filled = (s: string | null | undefined) => typeof s === "string" && s.trim().length > 0;
const filledList = (l: string[] | null | undefined, min = 1) => Array.isArray(l) && l.filter(filled).length >= min;

/** Converts validated model output into render-ready slides. Returns problems instead when it can't. */
export function normalizeDeck(out: DeckOutput): { deck: StoredDeck; problems: string[] } {
  const problems: string[] = [];
  const slides: Slide[] = [];
  out.slides.forEach((s, i) => {
    const at = `slide ${i + 1} (${s.type})`;
    switch (s.type) {
      case "title":
        if (!filled(s.body)) problems.push(`${at}: body is required.`);
        slides.push({ type: "title", heading: s.heading, body: s.body ?? "" });
        break;
      case "concept":
        if (!filled(s.body) || !filledList(s.points, 2)) problems.push(`${at}: needs body and 2–4 points.`);
        slides.push({ type: "concept", heading: s.heading, body: s.body ?? "", points: s.points ?? [] });
        break;
      case "steps":
        if (!filledList(s.points, 3)) problems.push(`${at}: needs 3–6 steps in points.`);
        slides.push({ type: "steps", heading: s.heading, points: s.points ?? [], body: filled(s.body) ? s.body : null });
        break;
      case "do_dont":
        if (!filledList(s.dos, 2) || !filledList(s.donts, 2)) problems.push(`${at}: needs 2–3 dos and 2–3 donts.`);
        slides.push({ type: "do_dont", heading: s.heading, dos: s.dos ?? [], donts: s.donts ?? [] });
        break;
      case "diagram": {
        const svg = sanitizeSvg(s.svg);
        if (!svg) problems.push(`${at}: svg is missing or uses disallowed elements; follow the SVG rules exactly.`);
        slides.push({ type: "diagram", heading: s.heading, svg: svg ?? "", body: s.body ?? "" });
        break;
      }
      case "exercise_preview":
        if (!filled(s.body) || !filledList(s.points, 2)) problems.push(`${at}: needs body and 2–3 points.`);
        slides.push({ type: "exercise_preview", heading: s.heading, body: s.body ?? "", points: s.points ?? [] });
        break;
    }
  });
  if (slides[0]?.type !== "title") problems.push("The first slide must be type \"title\".");
  if (slides.at(-1)?.type !== "exercise_preview") problems.push("The last slide must be type \"exercise_preview\".");
  if (slides.filter((s) => s.type === "diagram").length !== 1) problems.push("Include exactly one \"diagram\" slide.");
  if (!slides.some((s) => s.type === "steps")) problems.push("Include at least one \"steps\" slide.");
  return { deck: { slides }, problems };
}

async function generateDeck(db: DB, entry: CatalogEntry, band: LevelBand, sessionId: string | null): Promise<StoredDeck> {
  const out = await generateStructured({
    db,
    kind: "deck",
    sessionId,
    skipBudget: true, // checked before claiming the cache row
    system: deckPrompt.system,
    content: deckPrompt.user(entry, band),
    schema: DeckSchema,
    validate: (d) => normalizeDeck(d).problems,
    effort: "medium",
    maxTokens: 24000,
  });
  return normalizeDeck(out).deck;
}

async function generateTasks(db: DB, entry: CatalogEntry, band: LevelBand, sessionId: string | null): Promise<StoredTaskSet> {
  const out = await generateStructured({
    db,
    kind: "tasks",
    sessionId,
    skipBudget: true,
    system: tasksPrompt.system,
    content: tasksPrompt.user(entry, band),
    schema: TaskSetSchema,
    effort: "low",
  });
  return {
    tasks: out.tasks.map((t, i) => ({
      id: `t${i + 1}`,
      title: t.title,
      instruction: t.instruction,
      timeboxMinutes: t.timeboxMinutes,
      focus: t.focus,
      rubric: t.rubric.map((r, j) => ({ id: CRITERION_IDS[j], criterion: r.criterion, skill: r.skill, lookFor: r.lookFor })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Shared cache with single-flight generation
// ---------------------------------------------------------------------------

const STALE_MS = 4 * 60 * 1000;

type Key = { kind: ContentKind; subtopicId: string; band: LevelBand; variant?: string };

const where = (k: Key) =>
  and(
    eq(generatedContent.kind, k.kind),
    eq(generatedContent.subtopicId, k.subtopicId),
    eq(generatedContent.levelBand, k.band),
    eq(generatedContent.variant, k.variant ?? ""),
  );

export async function getContentRow(db: DB, k: Key) {
  const [row] = await db.select().from(generatedContent).where(where(k));
  return row ?? null;
}

/**
 * Atomically takes the right to generate. Exactly one concurrent caller wins:
 * either the INSERT (unique key) or the UPDATE of a failed / stale row.
 */
export async function claimGeneration(db: DB, k: Key): Promise<boolean> {
  const inserted = await db
    .insert(generatedContent)
    .values({ kind: k.kind, subtopicId: k.subtopicId, levelBand: k.band, variant: k.variant ?? "", status: "generating" })
    .onConflictDoNothing()
    .returning({ id: generatedContent.id });
  if (inserted.length) return true;

  const staleBefore = new Date(Date.now() - STALE_MS);
  const updated = await db
    .update(generatedContent)
    .set({
      status: "generating",
      startedAt: sql`now()`,
      updatedAt: sql`now()`,
      attempts: sql`${generatedContent.attempts} + 1`,
      error: null,
    })
    .where(
      and(
        where(k),
        or(
          eq(generatedContent.status, "failed"),
          and(eq(generatedContent.status, "generating"), lt(generatedContent.startedAt, staleBefore)),
        ),
      ),
    )
    .returning({ id: generatedContent.id });
  return updated.length > 0;
}

export async function runGeneration(db: DB, k: Key, produce: () => Promise<unknown>) {
  try {
    const content = await produce();
    await db
      .update(generatedContent)
      .set({ status: "ready", content, error: null, updatedAt: sql`now()` })
      .where(where(k));
    return content;
  } catch (err) {
    const code = err instanceof AiError ? err.code : "server_error";
    console.error(`[content:${k.kind}:${k.subtopicId}:${k.band}]`, err instanceof Error ? err.message : err);
    await db
      .update(generatedContent)
      .set({ status: "failed", error: code, updatedAt: sql`now()` })
      .where(where(k));
    throw err;
  }
}

export type ContentState<T> =
  | { status: "ready"; content: T }
  | { status: "generating" }
  | { status: "failed"; error: string };

/**
 * Returns cached lesson material, or kicks off generation (once, across all users).
 * `schedule` runs the generation — `after()` in route handlers, inline in scripts.
 */
export async function ensureLessonContent<T extends StoredDeck | StoredTaskSet>(opts: {
  db: DB;
  kind: "deck" | "tasks";
  entry: CatalogEntry;
  band: LevelBand;
  sessionId: string | null;
  retry?: boolean;
  schedule: (job: () => Promise<unknown>) => void;
}): Promise<ContentState<T>> {
  const { db, kind, entry, band, sessionId } = opts;
  const key: Key = { kind, subtopicId: entry.id, band };
  const row = await getContentRow(db, key);

  if (row?.status === "ready") return { status: "ready", content: row.content as T };
  const stale = row?.status === "generating" && Date.now() - row.startedAt.getTime() > STALE_MS;
  if (row?.status === "generating" && !stale) return { status: "generating" };
  // Failures caused by the environment (busy API, setup, credit, caps) heal on their own once
  // fixed, so they're retried automatically after a short cooldown instead of staying stuck.
  const autoRetry =
    row?.status === "failed" &&
    !["invalid_output", "refused"].includes(row.error ?? "") &&
    Date.now() - row.updatedAt.getTime() > 30_000;
  if (row?.status === "failed" && !opts.retry && !autoRetry) {
    return { status: "failed", error: row.error ?? "server_error" };
  }

  if (!aiConfigured()) return { status: "failed", error: "not_configured" };
  const budget = await checkAiBudget(db, sessionId, kind);
  if (!budget.ok) return { status: "failed", error: budget.reason };

  if (await claimGeneration(db, key)) {
    opts.schedule(() =>
      runGeneration(db, key, () =>
        kind === "deck" ? generateDeck(db, entry, band, sessionId) : generateTasks(db, entry, band, sessionId),
      ).catch(() => {}),
    );
  }
  return { status: "generating" };
}

/** Used by the seed script: generate and wait. */
export async function generateLessonContentNow(db: DB, kind: "deck" | "tasks", entry: CatalogEntry, band: LevelBand) {
  const key: Key = { kind, subtopicId: entry.id, band };
  const row = await getContentRow(db, key);
  if (row?.status === "ready") return "cached" as const;
  if (!(await claimGeneration(db, key))) return "busy" as const;
  await runGeneration(db, key, () =>
    kind === "deck" ? generateDeck(db, entry, band, null) : generateTasks(db, entry, band, null),
  );
  return "generated" as const;
}

export async function getReadyTaskSet(db: DB, subtopicId: string, band: LevelBand): Promise<StoredTaskSet | null> {
  const row = await getContentRow(db, { kind: "tasks", subtopicId, band });
  return row?.status === "ready" ? (row.content as StoredTaskSet) : null;
}
