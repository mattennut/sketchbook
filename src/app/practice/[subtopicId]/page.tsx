import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadGuestContext } from "@/lib/guest";
import { canOpenSubtopic, critiquesLeft } from "@/lib/access";
import { weekOf } from "@/lib/plan";
import { PracticeFlow } from "@/components/practice/practice-flow";
import { Paywall } from "@/components/states";

type Props = {
  params: Promise<{ subtopicId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subtopicId } = await params;
  const { byId } = await loadGuestContext();
  return { title: `Practice: ${byId.get(subtopicId)?.title ?? "lesson"}` };
}

export default async function PracticePage({ params, searchParams }: Props) {
  const { subtopicId } = await params;
  const { task } = await searchParams;
  const { session, plan, byId } = await loadGuestContext();
  const entry = byId.get(subtopicId);
  if (!entry) notFound();
  if (!session || !plan) redirect("/assessment");

  if (!canOpenSubtopic(session, plan, subtopicId)) {
    return (
      <Paywall
        title={`Practice for “${entry.title}” is in week ${weekOf(plan, subtopicId) ?? "–"}`}
        reason="Your free plan includes every week-1 exercise. Unlock Plus for all 12 weeks."
        from={subtopicId}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-2 sm:px-8 sm:pt-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href={`/lesson/${subtopicId}`} className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Lesson: {entry.title}
        </Link>
      </div>
      <PracticeFlow
        subtopicId={subtopicId}
        initialTaskId={task && /^t[1-3]$/.test(task) ? task : null}
        critiquesLeft={critiquesLeft(session)}
      />
    </div>
  );
}
