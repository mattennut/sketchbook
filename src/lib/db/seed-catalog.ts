import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { SUBTOPICS, TOPICS } from "../catalog/data";
import * as schema from "./schema";

/** Idempotent upsert of the fixed curriculum catalog. Works with any drizzle Postgres driver. */
export async function seedCatalog(db: PgDatabase<PgQueryResultHKT, typeof schema>) {
  await db
    .insert(schema.topics)
    .values(TOPICS.map((t, i) => ({ ...t, sortOrder: i })))
    .onConflictDoUpdate({
      target: schema.topics.id,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  await db
    .insert(schema.subtopics)
    .values(SUBTOPICS.map((s, i) => ({ ...s, sortOrder: i })))
    .onConflictDoUpdate({
      target: schema.subtopics.id,
      set: {
        topicId: sql`excluded.topic_id`,
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        skill: sql`excluded.skill`,
        difficulty: sql`excluded.difficulty`,
        prerequisites: sql`excluded.prerequisites`,
        tracks: sql`excluded.tracks`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
}
