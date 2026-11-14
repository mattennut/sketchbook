import Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { guestSessions } from "./db/schema";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

/** For local demos without Stripe keys: lets "Unlock" flip the flag directly. Never enable in production. */
export function instantUnlockAllowed(): boolean {
  return !getStripe() && process.env.DEMO_INSTANT_UNLOCK === "true";
}

export async function markPaid(
  db: DB,
  guestId: string,
  ids: { customerId?: string | null; subscriptionId?: string | null } = {},
) {
  await db
    .update(guestSessions)
    .set({
      isPaid: true,
      paidAt: new Date(),
      ...(ids.customerId ? { stripeCustomerId: ids.customerId } : {}),
      ...(ids.subscriptionId ? { stripeSubscriptionId: ids.subscriptionId } : {}),
    })
    .where(eq(guestSessions.id, guestId));
}

export async function markUnpaidBySubscription(db: DB, subscriptionId: string) {
  await db.update(guestSessions).set({ isPaid: false }).where(eq(guestSessions.stripeSubscriptionId, subscriptionId));
}

export const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));
