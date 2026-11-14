import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { SUBTOPICS, TOPICS } from "../catalog/data";
import * as schema from "./schema";

/** Idempotent upsert of the fixed curriculum catalog. */
export async function seedCatalog(db: PostgresJsDatabase<typeof schema>) {
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
