import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Circle, CircleDot, Lock } from "lucide-react";
import { loadGuestContext } from "@/lib/guest";
import { getProgressSets } from "@/lib/progress";
import { currentWeek } from "@/lib/plan";
import { canOpenSubtopic } from "@/lib/access";
import { SKILL_LABELS, SPECIALIZATION_INFO, isSpecialization } from "@/lib/skills";

export const metadata: Metadata = { title: "Your 12-week plan" };

export default async function PlanPage() {
  const { db, session, plan, byId } = await loadGuestContext();
  if (!session || !plan) redirect("/assessment");

  const { lessonDone, practiced } = await getProgressSets(db, session.id);
  const now = currentWeek(plan, practiced);
  const nextId =
    plan.weeks.flatMap((w) => w.subtopicIds).find((id) => !practiced.has(id) && canOpenSubtopic(session, plan, id)) ??
    null;
  const nextEntry = nextId ? byId.get(nextId) : null;
  const total = plan.weeks.reduce((n, w) => n + w.subtopicIds.length, 0);
  const done = plan.weeks.flatMap((w) => w.subtopicIds).filter((id) => practiced.has(id)).length;
  const specLabel = isSpecialization(plan.specialization) ? SPECIALIZATION_INFO[plan.specialization].label : "";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-8 sm:pt-12">
      <p className="eyebrow">Your 12 weeks · {specLabel}</p>
      <h1 className="mt-3 text-4xl leading-[1.1] sm:text-5xl">
        Week {now}. <span className="text-ink-muted">{plan.weeks[now - 1]?.theme}</span>
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-soft">{plan.overview}</p>
      {plan.source === "default" ? (
        <p className="mt-4 text-[0.95rem] text-ink-muted">
          You&apos;re on the default course.{" "}
          <Link href="/assessment" className="link font-medium text-ink-soft">
            Take the 5-minute skill test
          </Link>{" "}
          to reorder it around your weakest skills.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        {nextEntry ? (
          <Link href={lessonDone.has(nextEntry.id) ? `/practice/${nextEntry.id}` : `/lesson/${nextEntry.id}`} className="btn btn-primary">
            {lessonDone.has(nextEntry.id) ? "Practice" : "Continue"}: {nextEntry.title}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : session.isPaid ? null : (
          <Link href="/upgrade?from=plan" className="btn btn-primary">
            Week 1 done — unlock weeks 2–12
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
            <div className="h-full rounded-full bg-moss" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          {done} of {total} practiced
        </div>
      </div>

      <ol className="mt-12 border-t border-rule">
        {plan.weeks.map((w) => {
          const locked = !session.isPaid && w.week > 1;
          const doneInWeek = w.subtopicIds.filter((id) => practiced.has(id)).length;
          return (
            <li key={w.week} className="border-b border-rule">
              <details open={w.week === now} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span
                    className={`w-10 shrink-0 font-display text-3xl tabular-nums ${w.week === now ? "text-accent" : "text-ink-muted"}`}
                  >
                    {String(w.week).padStart(2, "0")}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-semibold leading-snug">{w.theme}</span>
                    <span className="text-sm text-ink-muted">
                      {w.subtopicIds.length} lessons
                      {doneInWeek ? ` · ${doneInWeek} practiced` : ""}
                    </span>
                  </span>
                  {locked ? (
                    <Lock size={18} className="text-ink-muted" aria-label="Locked — part of Plus" />
                  ) : doneInWeek === w.subtopicIds.length ? (
                    <Check size={20} className="text-moss" aria-label="Week complete" />
                  ) : null}
                </summary>
                <div className="pb-6 pl-14">
                  <p className="mb-4 max-w-prose text-ink-soft">{w.rationale}</p>
                  <ul className="grid gap-1">
                    {w.subtopicIds.map((id) => {
                      const e = byId.get(id);
                      if (!e) return null;
                      const isPracticed = practiced.has(id);
                      const isRead = lessonDone.has(id);
                      const href = locked ? `/upgrade?from=${id}` : isRead && !isPracticed ? `/practice/${id}` : `/lesson/${id}`;
                      return (
                        <li key={id}>
                          <Link
                            href={href}
                            className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-paper-deep/70"
                          >
                            {locked ? (
                              <Lock size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
                            ) : isPracticed ? (
                              <Check size={16} className="shrink-0 text-moss" aria-hidden="true" />
                            ) : isRead ? (
                              <CircleDot size={16} className="shrink-0 text-accent" aria-hidden="true" />
                            ) : (
                              <Circle size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
                            )}
                            <span className="flex-1">
                              <span className={locked ? "text-ink-soft" : "font-medium"}>{e.title}</span>
                              <span className="ml-2 text-sm text-ink-muted">{SKILL_LABELS[e.skill]}</span>
                            </span>
                            <span className="sr-only">
                              {locked ? "(locked)" : isPracticed ? "(practiced)" : isRead ? "(lesson read)" : ""}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 text-sm text-ink-muted">
        {session.isPaid ? (
          <>
            Your skills have moved?{" "}
            <Link href="/progress#plan-settings" className="link">
              Rebuild the plan from your latest profile
            </Link>
            .
          </>
        ) : (
          <>
            Weeks 2–12 are part of{" "}
            <Link href="/upgrade?from=plan" className="link">
              Sketchbook Plus
            </Link>{" "}
            — every lesson, unlimited critiques, plan rebuilds.
          </>
        )}
      </p>
    </div>
  );
}
