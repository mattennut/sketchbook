import path from "node:path";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { seedCatalog } from "./seed-catalog";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __sketchbookDb?: Promise<DB> };

/**
 * Returns the database. With DATABASE_URL set we talk to Postgres (Supabase/Neon).
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
    // node-postgres pool + Vercel's attachDatabasePool: idle connections are closed
    // before a Fluid Compute instance suspends, so a resumed instance never writes to a
    // socket the pooler already dropped (which used to hang requests until the 300s limit).
    const pool = new Pool({
      connectionString: url,
      max: process.env.VERCEL ? 3 : 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      // Client-side guard: a stuck query fails fast instead of holding the request open.
      query_timeout: 25_000,
      keepAlive: true,
    });
    // An idle client can be killed server-side (pooler restart, admin terminate);
    // without a listener that error would crash the process.
    pool.on("error", (err) => console.warn("[db] idle client error:", err.message));
    attachDatabasePool(pool);
    return drizzlePg(pool, { schema });
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
  // PGlite and node-postgres drizzle instances share the same query-builder surface.
  const typed = db as unknown as DB;
  await seedCatalog(typed);
  return typed;
}
