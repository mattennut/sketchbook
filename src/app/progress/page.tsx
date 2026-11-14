import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { loadGuestContext } from "@/lib/guest";
import { skillSnapshots } from "@/lib/db/schema";
import { getProgressSets, recentSubmissions } from "@/lib/progress";
import { currentWeek } from "@/lib/plan";
import { critiquesLeft } from "@/lib/access";
import { EQUIPMENT_IDS, isSpecialization, type EquipmentId } from "@/lib/skills";
import { EquipmentSettings } from "@/components/progress/equipment-settings";
import { SkillHistory } from "@/components/progress/skill-history";
import { PlanSettings } from "@/components/progress/plan-settings";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { db, session, plan, byId } = await loadGuestContext();
  if (!session || !plan) redirect("/assessment");

  const [{ practiced, lessonDone }, snaps, recent] = await Promise.all([
    getProgressSets(db, session.id),
    db.select().from(skillSnapshots).where(eq(skillSnapshots.sessionId, session.id)).orderBy(asc(skillSnapshots.createdAt)),
    recentSubmissions(db, session.id, 12),
  ]);
  const all = plan.weeks.flatMap((w) => w.subtopicIds);
  const practicedInPlan = all.filter((id) => practiced.has(id)).length;
  const week = currentWeek(plan, practiced);
  const left = critiquesLeft(session);

  const stats = [
    { value: `${week}`, unit: "of 12", label: "Current week" },
    { value: `${practicedInPlan}`, unit: `of ${all.length}`, label: "Lessons practiced" },
    { value: `${all.filter((id) => lessonDone.has(id)).length}`, unit: "", label: "Lessons read" },
    left === null
      ? { value: "∞", unit: "with Plus", label: "Critiques" }
      : { value: `${left}`, unit: "of 3", label: "Free critiques left" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-8 sm:pt-12">
      <p className="eyebrow">Progress</p>
      <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Week {week} of 12</h1>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-paper-deep" role="img" aria-label={`${practicedInPlan} of ${all.length} lessons practiced`}>
        <div
          className="h-full rounded-full bg-moss transition-[width] duration-700 ease-[var(--ease-calm)]"
          style={{ width: `${Math.max(1.5, (practicedInPlan / all.length) * 100)}%` }}
        />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-ink-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-4xl tabular-nums">
              {s.value}
              {s.unit ? <span className="ml-1.5 font-sans text-base text-ink-muted">{s.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-14" aria-labelledby="skills-h">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="skills-h" className="text-2xl sm:text-3xl">
            Your skills over time
          </h2>
          <span className="text-sm text-ink-muted">1–5 scale · updates after each critique</span>
        </div>
        {snaps.length ? (
          <div className="sheet mt-5 px-5 py-3 sm:px-7">
            <SkillHistory
              snapshots={snaps.map((s) => ({ at: s.createdAt.toISOString(), source: s.source, scores: s.scores }))}
            />
          </div>
        ) : (
          <p className="mt-4 text-ink-soft">
            No skill profile yet — your first critique starts one, or{" "}
            <Link href="/assessment" className="link">
              take the 5-minute skill test
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-14" aria-labelledby="drawings-h">
        <h2 id="drawings-h" className="text-2xl sm:text-3xl">
          Your drawings
        </h2>
        {recent.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {recent.map((s) => (
              <li key={s.id}>
                <Link href={`/critique/${s.id}`} className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/images/${s.id}`}
                    alt={`Your drawing for ${byId.get(s.subtopicId)?.title ?? "a lesson"}`}
                    className="aspect-[4/3] w-full rounded-xl border border-rule bg-sheet object-cover transition-transform duration-300 group-hover:-translate-y-0.5"
                    loading="lazy"
                  />
                  <span className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{byId.get(s.subtopicId)?.title}</span>
                    {s.overallScore !== null ? <span className="tabular-nums text-ink-muted">{s.overallScore.toFixed(1)}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-soft">
            Nothing here yet. Your critiqued drawings will collect here, so you can see the change over weeks.{" "}
            <Link href="/plan" className="link">
              Pick up your plan
            </Link>
            .
          </p>
        )}
      </section>

      <section id="plan-settings" className="mt-14 max-w-md scroll-mt-8" aria-labelledby="settings-h">
        <h2 id="settings-h" className="text-2xl sm:text-3xl">
          Plan settings
        </h2>
        <div className="mt-5">
          <PlanSettings current={isSpecialization(plan.specialization) ? plan.specialization : "nature"} isPaid={session.isPaid} />
        </div>
      </section>

      <section id="equipment" className="mt-14 scroll-mt-8" aria-labelledby="equipment-h">
        <h2 id="equipment-h" className="text-2xl sm:text-3xl">
          Your tools
        </h2>
        <p className="mt-2 text-ink-soft">The coach takes these into account when it reviews your work.</p>
        <div className="mt-5">
          <EquipmentSettings
            initial={(session.equipment ?? []).filter((e): e is EquipmentId => EQUIPMENT_IDS.includes(e as EquipmentId)) as EquipmentId[]}
          />
        </div>
      </section>
    </div>
  );
}
