/** Upserts the fixed curriculum catalog (topics + subtopics). Safe to run on every deploy. */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/lib/db/schema";
import { seedCatalog } from "../src/lib/db/seed-catalog";
import { SUBTOPICS, TOPICS } from "../src/lib/catalog/data";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipping (local dev seeds the embedded PGlite database on boot).");
    return;
  }
  validateCatalog();
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });
  await seedCatalog(drizzle(pool, { schema }));
  await pool.end();
  console.log(`Catalog seeded: ${TOPICS.length} topics, ${SUBTOPICS.length} subtopics.`);
}

/** Fails the deploy if the catalog references unknown prerequisites or topics. */
function validateCatalog() {
  const ids = new Set(SUBTOPICS.map((s) => s.id));
  const topics = new Set(TOPICS.map((t) => t.id));
  if (ids.size !== SUBTOPICS.length) throw new Error("Duplicate subtopic ids in catalog");
  for (const s of SUBTOPICS) {
    if (!topics.has(s.topicId)) throw new Error(`${s.id}: unknown topic ${s.topicId}`);
    for (const p of s.prerequisites) if (!ids.has(p)) throw new Error(`${s.id}: unknown prerequisite ${p}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
