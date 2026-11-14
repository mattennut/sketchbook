import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only needs the schema. DATABASE_URL is used by `drizzle-kit studio`.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL ? { dbCredentials: { url: process.env.DATABASE_URL } } : {}),
});
