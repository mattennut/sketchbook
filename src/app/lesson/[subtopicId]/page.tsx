import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadGuestContext } from "@/lib/guest";
import { canOpenSubtopic } from "@/lib/access";
import { weekOf } from "@/lib/plan";
import { SKILL_LABELS } from "@/lib/skills";
import { DeckLoader } from "@/components/deck/deck-loader";
import { Paywall } from "@/components/states";

type Props = { params: Promise<{ subtopicId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subtopicId } = await params;
  const { byId } = await loadGuestContext();
  return { title: byId.get(subtopicId)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: Props) {
  const { subtopicId } = await params;
  const { session, plan, byId } = await loadGuestContext();
  const entry = byId.get(subtopicId);
  if (!entry) notFound();
  if (!session || !plan) redirect("/assessment");

  if (!canOpenSubtopic(session, plan, subtopicId)) {
    const week = weekOf(plan, subtopicId);
    return (
      <Paywall
        title={`“${entry.title}” is in week ${week ?? "–"}`}
        reason="Your free plan includes every week-1 lesson. Unlock Plus to keep going through all 12 weeks."
        from={subtopicId}
      />
    );
  }

  const week = weekOf(plan, subtopicId);
  return (
    <div className="px-4 pt-2 sm:px-8 sm:pt-6">
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-4">
        <Link href="/plan" className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Plan
        </Link>
        <p className="eyebrow">
          Week {week} · {SKILL_LABELS[entry.skill]}
        </p>
      </div>
      <DeckLoader subtopicId={subtopicId} title={entry.title} />
    </div>
  );
}
