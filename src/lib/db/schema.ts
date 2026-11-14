import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SkillScores } from "../skills";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const guestSessions = pgTable("guest_sessions", {
  id: uuid("id").primaryKey(),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  specialization: text("specialization"),
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  freeCritiquesUsed: integer("free_critiques_used").default(0).notNull(),
  /** Drawing tools the learner has (EQUIPMENT ids). Null = never asked. */
  equipment: jsonb("equipment").$type<string[]>(),
  // Reserved for the optional "save your progress with email" feature.
  email: text("email"),
});

export type AssessmentAnswers = Record<string, string>;

export type PortfolioEstimate = {
  estimates: Partial<Record<keyof SkillScores, { score: number | null; note: string }>>;
  summary: string;
};

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => guestSessions.id, { onDelete: "cascade" }),
    specialization: text("specialization").notNull(),
    answers: jsonb("answers").$type<AssessmentAnswers>().notNull(),
    equipment: jsonb("equipment").$type<string[]>(),
    portfolio: jsonb("portfolio").$type<PortfolioEstimate | null>(),
    profile: jsonb("profile").$type<SkillScores>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("assessments_session_idx").on(t.sessionId, t.createdAt)],
);

export const portfolioEstimates = pgTable("portfolio_estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => guestSessions.id, { onDelete: "cascade" }),
  estimate: jsonb("estimate").$type<PortfolioEstimate>().notNull(),
  imageCount: integer("image_count").notNull(),
  createdAt: createdAt(),
});

export const skillSnapshots = pgTable(
  "skill_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => guestSessions.id, { onDelete: "cascade" }),
    source: text("source").$type<"assessment" | "critique">().notNull(),
    scores: jsonb("scores").$type<SkillScores>().notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("skill_snapshots_session_idx").on(t.sessionId, t.createdAt)],
);

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const subtopics = pgTable("subtopics", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  skill: text("skill").notNull(),
  difficulty: integer("difficulty").notNull(),
  prerequisites: jsonb("prerequisites").$type<string[]>().notNull(),
  tracks: jsonb("tracks").$type<string[]>().notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export type PlanWeek = {
  week: number;
  theme: string;
  rationale: string;
  subtopicIds: string[];
};

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => guestSessions.id, { onDelete: "cascade" }),
    specialization: text("specialization").notNull(),
    profile: jsonb("profile").$type<SkillScores>().notNull(),
    overview: text("overview").notNull(),
    weeks: jsonb("weeks").$type<PlanWeek[]>().notNull(),
    source: text("source").$type<"ai" | "fallback" | "default">().notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("plans_session_idx").on(t.sessionId, t.isActive)],
);

export type ContentKind = "deck" | "tasks" | "sample_critique";
export type ContentStatus = "generating" | "ready" | "failed";

/** Shared, cross-user cache of generated lesson material. */
export const generatedContent = pgTable(
  "generated_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<ContentKind>().notNull(),
    subtopicId: text("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    levelBand: text("level_band").notNull(),
    variant: text("variant").default("").notNull(),
    status: text("status").$type<ContentStatus>().notNull(),
    content: jsonb("content"),
    error: text("error"),
    attempts: integer("attempts").default(1).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("generated_content_key").on(t.kind, t.subtopicId, t.levelBand, t.variant),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => guestSessions.id, { onDelete: "cascade" }),
    subtopicId: text("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    taskId: text("task_id").notNull(),
    levelBand: text("level_band").notNull(),
    imageRef: text("image_ref"),
    sampleId: text("sample_id"),
    status: text("status").$type<"critiquing" | "done" | "failed">().notNull(),
    critique: jsonb("critique"),
    overallScore: real("overall_score"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("submissions_session_idx").on(t.sessionId, t.createdAt)],
);

export const subtopicProgress = pgTable(
  "subtopic_progress",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => guestSessions.id, { onDelete: "cascade" }),
    subtopicId: text("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    lessonCompletedAt: timestamp("lesson_completed_at", { withTimezone: true }),
    practicedAt: timestamp("practiced_at", { withTimezone: true }),
    bestScore: real("best_score"),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.subtopicId] })],
);

export const aiCalls = pgTable(
  "ai_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id"),
    kind: text("kind").notNull(),
    status: text("status").$type<"started" | "ok" | "error">().notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_calls_created_idx").on(t.createdAt),
    index("ai_calls_session_idx").on(t.sessionId, t.kind, t.createdAt),
  ],
);

export type GuestSession = typeof guestSessions.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subtopic = typeof subtopics.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
