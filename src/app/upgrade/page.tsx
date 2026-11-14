import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { getSession } from "@/lib/session";
import { getStripe, instantUnlockAllowed } from "@/lib/stripe";
import { FREE_CRITIQUES, PRICE_LABEL } from "@/lib/access";
import { UpgradeButton } from "@/components/upgrade-button";

export const metadata: Metadata = { title: "Sketchbook Plus" };

type Props = { searchParams: Promise<{ demo?: string; canceled?: string; from?: string }> };

const ROWS: { label: string; free: string | boolean; plus: string | boolean }[] = [
  { label: "Skill assessment & full 12-week plan preview", free: true, plus: true },
  { label: "Lessons and practice", free: "Week 1", plus: "All 12 weeks" },
  { label: "AI critiques of your drawings", free: `${FREE_CRITIQUES} critiques`, plus: "Unlimited" },
  { label: "Rebuild your plan as your skills grow", free: false, plus: true },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={18} className="text-moss" aria-label="Included" />;
  if (v === false) return <Minus size={18} className="text-ink-muted" aria-label="Not included" />;
  return <span>{v}</span>;
}

export default async function UpgradePage({ searchParams }: Props) {
  const { demo, canceled } = await searchParams;
  const session = await getSession();
  const paymentsReady = !!getStripe() || instantUnlockAllowed();

  if (session?.isPaid) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-8">
        <h1 className="text-4xl">You&apos;re on Plus.</h1>
        <p className="mt-4 text-lg text-ink-soft">Every week is open. Go make a mess of some paper.</p>
        <Link href="/plan" className="btn btn-primary mt-8">
          Back to my plan
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-8 sm:pt-12">
      {demo ? (
        <p className="mb-8 rounded-2xl border border-rule bg-sheet px-5 py-4 text-ink-soft">
          <span className="font-semibold text-ink">Demo mode.</span> Checkout runs in Stripe test mode — no real charge.
          Use card <span className="font-mono text-ink">4242 4242 4242 4242</span>, any future date and any CVC.
        </p>
      ) : null}
      {canceled ? (
        <p className="mb-8 rounded-2xl bg-paper-deep px-5 py-4 text-ink-soft" role="status">
          Checkout canceled — no charge was made. Your free plan is right where you left it.
        </p>
      ) : null}

      <p className="eyebrow">Sketchbook Plus</p>
      <h1 className="mt-3 text-4xl leading-[1.08] sm:text-6xl">Keep going. All twelve weeks.</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
        A private drawing teacher costs $40–80 an hour. Plus gives you a plan that adapts to you and feedback on every page you
        draw, for {PRICE_LABEL}. Cancel any time.
      </p>

      <div className="mt-10">
        {paymentsReady ? (
          <UpgradeButton label={`Unlock Plus — ${PRICE_LABEL}`} />
        ) : (
          <p className="rounded-2xl bg-paper-deep px-5 py-4 text-ink-soft">Payments aren&apos;t configured on this deployment yet.</p>
        )}
        <p className="mt-3 text-sm text-ink-muted">Stripe test mode · card 4242 4242 4242 4242 · any future date · any CVC</p>
      </div>

      <table className="mt-14 w-full border-collapse text-left">
        <caption className="sr-only">Free compared with Plus</caption>
        <thead>
          <tr className="border-b border-rule-strong text-sm">
            <th scope="col" className="py-3 font-semibold text-ink-muted">
              What you get
            </th>
            <th scope="col" className="w-28 py-3 font-semibold text-ink-muted sm:w-36">
              Free
            </th>
            <th scope="col" className="w-28 py-3 font-semibold sm:w-36">
              Plus
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label} className="border-b border-rule">
              <th scope="row" className="py-4 pr-4 font-normal">
                {r.label}
              </th>
              <td className="py-4 text-ink-soft">
                <Cell v={r.free} />
              </td>
              <td className="py-4 font-semibold">
                <Cell v={r.plus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
