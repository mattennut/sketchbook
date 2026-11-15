import Link from "next/link";
import { Check, Circle, Clock } from "lucide-react";
import type { PracticeItem } from "@/lib/practice-status";

function ScoreDots({ score }: { score: number }) {
  const filled = Math.round(score);
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= filled ? "bg-ink" : "bg-rule-strong"}`} />
      ))}
    </span>
  );
}

/** A completed lesson's practice exercises, with completion and best rubric score. */
export function PracticeList({ subtopicId, items }: { subtopicId: string; items: PracticeItem[] | null }) {
  if (!items) {
    // Exercises not generated yet (rare: they're prepared while the lesson is read).
    return (
      <div className="mb-2 ml-[1.15rem] flex items-center justify-between gap-3 border-l border-rule py-1.5 pl-5">
        <span className="text-[0.95rem] text-ink-soft">Practice exercises</span>
        <PracticeButton href={`/practice/${subtopicId}`} />
      </div>
    );
  }
  return (
    <ul className="mb-2 ml-[1.15rem] grid gap-0.5 border-l border-rule pl-5" aria-label="Practice exercises">
      {items.map((p) => {
        const done = p.best !== null;
        return (
          <li key={p.taskId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            {done ? (
              <Check size={14} className="shrink-0 text-moss" aria-hidden="true" />
            ) : (
              <Circle size={14} className="shrink-0 text-rule-strong" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              <span className="text-[0.95rem]">{p.title}</span>
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-muted">
                <Clock size={12} aria-hidden="true" /> {p.minutes} min
              </span>
            </span>
            {done ? (
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-2" title={`Best rubric score across ${p.attempts} attempt${p.attempts === 1 ? "" : "s"}`}>
                  <ScoreDots score={p.best!} />
                  <span className="font-display text-base tabular-nums">
                    {p.best!.toFixed(1)}
                    <span className="font-sans text-xs text-ink-muted">/5</span>
                  </span>
                  <span className="sr-only">best score {p.best!.toFixed(1)} out of 5, completed</span>
                </span>
                {p.latestSubmissionId ? (
                  <Link href={`/critique/${p.latestSubmissionId}`} className="link text-sm text-ink-soft">
                    Feedback
                  </Link>
                ) : null}
              </span>
            ) : (
              <PracticeButton href={`/practice/${subtopicId}?task=${p.taskId}`} label={`Practice: ${p.title}`} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PracticeButton({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-8 items-center rounded-full border border-ink px-3.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-sheet"
    >
      Practice
    </Link>
  );
}
