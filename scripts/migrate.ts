/**
 * Applies SQL migrations in ./drizzle to DATABASE_URL (Neon / Supabase / any Postgres).
 * Without DATABASE_URL the app migrates its embedded PGlite database automatically on boot.
 */
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipping (local dev uses embedded PGlite, migrated on boot).");
    return;
  }
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
