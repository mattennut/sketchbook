import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { getStripe, idOf, markPaid, markUnpaidBySubscription } from "@/lib/stripe";

/**
 * Stripe webhook: marks the guest session as paid when Checkout completes,
 * and unpaid when the subscription ends. Signature-verified; idempotent.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const db = await getDb();
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const cs = event.data.object;
      const guestId = cs.client_reference_id ?? cs.metadata?.guestSessionId;
      if (guestId && (cs.payment_status === "paid" || cs.payment_status === "no_payment_required")) {
        await markPaid(db, guestId, { customerId: idOf(cs.customer), subscriptionId: idOf(cs.subscription) });
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
        await markUnpaidBySubscription(db, sub.id);
      }
      break;
    }
    case "customer.subscription.deleted":
      await markUnpaidBySubscription(db, event.data.object.id);
      break;
  }
  return NextResponse.json({ received: true });
}
