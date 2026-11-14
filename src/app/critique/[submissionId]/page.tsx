import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowRight, Check, Clock, RotateCcw } from "lucide-react";
import { loadGuestContext } from "@/lib/guest";
import { submissions } from "@/lib/db/schema";
import { getReadyTaskSet } from "@/lib/content";
import { getSample } from "@/lib/samples";
import { SKILL_LABELS, isSkill, type LevelBand } from "@/lib/skills";
import type { CritiqueOutput } from "@/lib/ai/prompts";
import { ErrorState } from "@/components/states";

export const metadata: Metadata = { title: "Your critique" };

type Props = { params: Promise<{ submissionId: string }> };

function ScoreDots({ score, label }: { score: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${label}: ${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-2 w-2 rounded-full ${n <= score ? "bg-ink" : "bg-rule"}`} />
      ))}
    </span>
  );
}

export default async function CritiquePage({ params }: Props) {
  const { submissionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) notFound();
  const { db, session, byId } = await loadGuestContext();
  if (!session) redirect("/");

  const [sub] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), eq(submissions.sessionId, session.id)));
  if (!sub) notFound();

  const entry = byId.get(sub.subtopicId);
  const task = (await getReadyTaskSet(db, sub.subtopicId, sub.levelBand as LevelBand))?.tasks.find((t) => t.id === sub.taskId);
  const sample = sub.sampleId ? getSample(sub.sampleId) : null;
  const imageSrc = sample ? `/samples/${sample.file}` : `/api/images/${sub.id}`;
  const critique = sub.critique as CritiqueOutput | null;
  const retryHref = `/practice/${sub.subtopicId}?task=${sub.taskId}`;

  if (sub.status !== "done" || !critique) {
    return (
      <ErrorState
        title="This critique didn't finish"
        message="Something interrupted the coach. Your free critique wasn't used — please submit the photo again."
        action={
          <Link href={retryHref} className="btn btn-primary">
            Try again
          </Link>
        }
      />
    );
  }

  const criterion = (id: string) => task?.rubric.find((r) => r.id === id);
  const avg = sub.overallScore;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-8 sm:pt-6">
      <p className="eyebrow">
        Critique · {entry?.title ?? "Practice"}
        {task ? ` · ${task.title}` : ""}
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <figure className="lg:sticky lg:top-6 lg:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={sample ? sample.alt : `Your drawing for ${task?.title ?? "this exercise"}`}
            className="max-h-[80vh] w-full rounded-2xl border border-rule bg-sheet object-contain shadow-[0_18px_40px_-24px_rgba(28,27,25,0.35)]"
          />
          {sample ? (
            <figcaption className="mt-3 text-sm text-ink-muted">
              Sample drawing — the critique below shows exactly what you&apos;d get for your own page.
            </figcaption>
          ) : null}
        </figure>

        <div className="animate-fade-up">
          {!critique.isDrawing ? (
            <>
              <h1 className="text-3xl leading-tight sm:text-4xl">Let&apos;s try that photo again</h1>
              <p className="mt-4 text-lg text-ink-soft">{critique.summary}</p>
              <p className="mt-3 text-sm text-ink-muted">This didn&apos;t use one of your free critiques.</p>
              <Link href={retryHref} className="btn btn-primary mt-8">
                Retake the photo
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-3xl leading-[1.15] sm:text-[2.5rem]">{critique.summary}</h1>

              <section className="mt-8 rounded-2xl border-l-4 border-accent bg-accent-wash/70 px-6 py-5" aria-labelledby="fix-h">
                <p id="fix-h" className="eyebrow text-accent-deep">
                  The one thing to work on
                </p>
                <h2 className="mt-2 text-2xl leading-snug">{critique.mostImportantFix.title}</h2>
                <p className="mt-2 leading-relaxed text-ink-soft">{critique.mostImportantFix.explanation}</p>
              </section>

              <section className="mt-8" aria-labelledby="strengths-h">
                <h2 id="strengths-h" className="eyebrow">
                  What&apos;s already working
                </h2>
                <ul className="mt-3 grid gap-3">
                  {critique.strengths.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <Check size={18} className="mt-1 shrink-0 text-moss" aria-hidden="true" />
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-8 rounded-2xl border border-rule bg-sheet p-5" aria-labelledby="drill-h">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="drill-h" className="eyebrow">
                    Drill for next time
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                    <Clock size={14} aria-hidden="true" /> {critique.drill.minutes} min
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold">{critique.drill.title}</p>
                <p className="mt-1 leading-relaxed text-ink-soft">{critique.drill.instructions}</p>
              </section>

              <details className="group mt-8 border-t border-rule pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold">
                    Rubric scores{avg !== null ? <span className="ml-2 font-normal text-ink-muted">avg {avg.toFixed(1)} / 5</span> : null}
                  </span>
                  <span className="text-sm text-ink-muted group-open:hidden">Show</span>
                  <span className="hidden text-sm text-ink-muted group-open:inline">Hide</span>
                </summary>
                <dl className="mt-5 grid gap-5">
                  {critique.scores.map((s) => {
                    const c = criterion(s.criterionId);
                    return (
                      <div key={s.criterionId}>
                        <dt className="flex items-center justify-between gap-3">
                          <span className="font-medium">
                            {c?.criterion ?? s.criterionId}
                            {c && isSkill(c.skill) ? (
                              <span className="ml-2 text-sm font-normal text-ink-muted">{SKILL_LABELS[c.skill]}</span>
                            ) : null}
                          </span>
                          <ScoreDots score={s.score} label={c?.criterion ?? s.criterionId} />
                        </dt>
                        <dd className="mt-1 text-ink-soft">{s.comment}</dd>
                      </div>
                    );
                  })}
                </dl>
              </details>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link href="/plan" className="btn btn-primary">
                  Continue my plan <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link href={retryHref} className="inline-flex items-center gap-2 font-medium text-ink-soft hover:text-ink">
                  <RotateCcw size={16} aria-hidden="true" /> {sample ? "Now try it with your own drawing" : "Try this exercise again"}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
