import Link from "next/link";
import { Lock } from "lucide-react";
import { PRICE_LABEL } from "@/lib/access";

/** Calm, never-blank error view with one clear way forward. */
export function ErrorState({
  title = "That didn't work",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <svg viewBox="0 0 120 40" className="w-28" aria-hidden="true">
        <path
          d="M4 28 C 20 8, 34 8, 44 24 S 66 38, 74 20 M82 18 l 10 10 M92 18 l -10 10"
          fill="none"
          stroke="var(--color-ink-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <h2 className="text-2xl">{title}</h2>
      <p className="text-ink-soft">{message}</p>
      {action}
    </div>
  );
}

/** Shown when a lesson needs a tool the learner hasn't listed. */
export function ToolsLock({ title, need, detail }: { title: string; need: string; detail: string }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-8">
      <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-rule-strong">
        <Lock size={20} aria-hidden="true" />
      </div>
      <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg text-ink-soft">
        This lesson needs {need}, and it isn&apos;t in your tools yet. Any of these works: {detail}.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link href="/progress#equipment" className="btn btn-primary">
          Update my tools
        </Link>
        <Link href="/plan" className="link text-sm text-ink-soft">
          Back to my plan
        </Link>
      </div>
    </section>
  );
}

/** Shown in place of locked content: what Plus unlocks, one primary action. */
export function Paywall({ title, reason, from }: { title: string; reason: string; from?: string }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-8">
      <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-rule-strong">
        <Lock size={20} aria-hidden="true" />
      </div>
      <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{reason}</p>
      <ul className="mx-auto mt-8 grid max-w-sm gap-2 text-left text-ink-soft">
        <li>— All 12 weeks of lessons and practice</li>
        <li>— Unlimited critiques of your drawings</li>
        <li>— Rebuild your plan as your skills grow</li>
      </ul>
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link href={`/upgrade${from ? `?from=${encodeURIComponent(from)}` : ""}`} className="btn btn-primary">
          Unlock Plus — {PRICE_LABEL}
        </Link>
        <Link href="/plan" className="link text-sm text-ink-soft">
          Back to my plan
        </Link>
      </div>
    </section>
  );
}
