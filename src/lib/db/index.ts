import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { seedCatalog } from "./seed-catalog";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __sketchbookDb?: Promise<DB> };

/**
 * Returns the database. With DATABASE_URL set we talk to Postgres (Neon/Supabase).
 * Without it we fall back to PGlite — an embedded, file-backed Postgres — and run
 * migrations + the catalog seed automatically, so `npm run dev` works with zero setup.
 */
export function getDb(): Promise<DB> {
  if (!globalForDb.__sketchbookDb) {
    globalForDb.__sketchbookDb = createDb().catch((err) => {
      globalForDb.__sketchbookDb = undefined;
      throw err;
    });
  }
  return globalForDb.__sketchbookDb;
}

export function usingEmbeddedDb(): boolean {
  return !process.env.DATABASE_URL;
}

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, {
      // Transaction poolers (Supabase :6543, Neon -pooler) don't support prepared statements.
      prepare: false,
      max: process.env.VERCEL ? 1 : 5,
      idle_timeout: 20,
    });
    return drizzlePostgres(client, { schema });
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required in production (PGlite is for local development only).");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // PGlite and postgres-js drizzle instances share the same query-builder surface.
  const typed = db as unknown as DB;
  await seedCatalog(typed);
  return typed;
}
