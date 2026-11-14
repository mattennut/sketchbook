import "server-only";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { guestSessions, type GuestSession } from "./db/schema";

export const SESSION_COOKIE = "sb_guest";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export function isValidSessionId(v: string | undefined | null): v is string {
  return !!v && UUID_RE.test(v);
}

/** Reads the guest id from the cookie (set by `src/proxy.ts`). Safe in Server Components. */
export async function readSessionId(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSessionId(value) ? value : null;
}

/** Read-only lookup for Server Components. Returns null for brand-new visitors. */
export async function getSession(): Promise<GuestSession | null> {
  const id = await readSessionId();
  if (!id) return null;
  const db = await getDb();
  const [row] = await db.select().from(guestSessions).where(eq(guestSessions.id, id));
  return row ?? null;
}

/**
 * For Route Handlers: guarantees a cookie and a database row for this guest.
 * The row is created lazily on the first write so landing-page visits cost nothing.
 */
export async function requireSession(): Promise<GuestSession> {
  const jar = await cookies();
  let id = jar.get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(id)) {
    id = crypto.randomUUID();
    jar.set(SESSION_COOKIE, id, SESSION_COOKIE_OPTIONS);
  }
  const db = await getDb();
  const [row] = await db
    .insert(guestSessions)
    .values({ id })
    .onConflictDoUpdate({ target: guestSessions.id, set: { lastSeenAt: sql`now()` } })
    .returning();
  return row;
}
