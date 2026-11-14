import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStripe, instantUnlockAllowed, markPaid } from "@/lib/stripe";
import { handleRouteError, jsonError } from "@/lib/http";

/** Starts Stripe Checkout (test mode) for Sketchbook Plus — $12/month subscription. */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.isPaid) return NextResponse.json({ url: "/plan" });

    const stripe = getStripe();
    if (!stripe) {
      if (instantUnlockAllowed()) {
        await markPaid(await getDb(), session.id);
        return NextResponse.json({ url: "/upgrade/success?demo=1" });
      }
      return jsonError(503, "payments_off", "Payments aren't configured on this deployment yet.");
    }

    const origin = process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const priceId = process.env.STRIPE_PRICE_ID;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        priceId
          ? { price: priceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: 1200,
                recurring: { interval: "month" },
                product_data: {
                  name: "Sketchbook Plus",
                  description: "All 12 weeks, unlimited critiques, plan rebuilds.",
                },
              },
            },
      ],
      client_reference_id: session.id,
      metadata: { guestSessionId: session.id },
      subscription_data: { metadata: { guestSessionId: session.id } },
      success_url: `${origin}/upgrade/success?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upgrade?canceled=1`,
    });
    if (!checkout.url) return jsonError(502, "stripe", "Stripe didn't return a checkout page.");
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    return handleRouteError(err, "checkout");
  }
}
