import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStripe, idOf, markPaid } from "@/lib/stripe";

export const metadata: Metadata = { title: "Welcome to Plus" };

type Props = { searchParams: Promise<{ cs?: string; demo?: string }> };

/**
 * Return page from Stripe Checkout. The webhook is the source of truth, but we also
 * verify the Checkout Session here so the unlock is instant even if the webhook lags.
 */
export default async function UpgradeSuccessPage({ searchParams }: Props) {
  const { cs } = await searchParams;
  const session = await getSession();
  let paid = !!session?.isPaid;

  const stripe = getStripe();
  if (!paid && session && stripe && cs && /^cs_[a-zA-Z0-9_]+$/.test(cs)) {
    try {
      const checkout = await stripe.checkout.sessions.retrieve(cs);
      if (checkout.client_reference_id === session.id && checkout.status === "complete") {
        await markPaid(await getDb(), session.id, {
          customerId: idOf(checkout.customer),
          subscriptionId: idOf(checkout.subscription),
        });
        paid = true;
      }
    } catch (err) {
      console.error("[upgrade-success] verify failed", err);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-8 sm:py-24">
      {paid ? (
        <>
          <svg viewBox="0 0 120 40" className="mx-auto mb-8 w-32" aria-hidden="true">
            <path
              d="M6 22 C 18 22, 24 32, 34 32 S 60 6, 112 8"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ strokeDasharray: 160, ["--len" as string]: 160, animation: "draw-line 1.2s var(--ease-calm) both" }}
            />
          </svg>
          <h1 className="text-4xl leading-tight sm:text-5xl">Welcome to Plus.</h1>
          <p className="mt-4 text-lg text-ink-soft">All twelve weeks are open, and critiques are unlimited.</p>
          <Link href="/plan" className="btn btn-primary mt-10">
            Back to my plan <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl leading-tight sm:text-4xl">Confirming your payment…</h1>
          <p className="mt-4 text-lg text-ink-soft">This usually takes a few seconds. Refresh this page in a moment.</p>
          <Link href="/plan" className="link mt-8 inline-block">
            Back to my plan
          </Link>
        </>
      )}
    </div>
  );
}
