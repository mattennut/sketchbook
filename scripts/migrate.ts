/**
 * Applies SQL migrations in ./drizzle to DATABASE_URL (Supabase / Neon / any Postgres).
 * Without DATABASE_URL the app migrates its embedded PGlite database automatically on boot.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipping (local dev uses embedded PGlite, migrated on boot).");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await pool.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
