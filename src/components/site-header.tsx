import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getActivePlan } from "@/lib/plan";

async function loadNavState() {
  try {
    const session = await getSession();
    if (!session) return { hasPlan: false, isPaid: false };
    const plan = await getActivePlan(await getDb(), session.id);
    return { hasPlan: !!plan, isPaid: session.isPaid };
  } catch {
    return { hasPlan: false, isPaid: false };
  }
}

export async function SiteHeader() {
  const { hasPlan, isPaid } = await loadNavState();
  return (
    <header className="relative z-10 mx-auto flex h-[5.5rem] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
      <Link href="/" className="font-display text-2xl italic tracking-tight" aria-label="Sketchbook home">
        <span className="scribble">Sketchbook</span>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-5 text-[0.95rem] font-medium text-ink-soft">
        {hasPlan ? (
          <>
            <Link href="/plan" className="link">
              Plan
            </Link>
            <Link href="/progress" className="link">
              Progress
            </Link>
            {isPaid ? (
              <span className="rounded-full border border-accent/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent">
                Plus
              </span>
            ) : null}
          </>
        ) : (
          <Link href="/assessment" className="link">
            Start free
          </Link>
        )}
      </nav>
    </header>
  );
}
