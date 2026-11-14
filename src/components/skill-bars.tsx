import { SKILLS, SKILL_LABELS, type SkillScores } from "@/lib/skills";

/** Six horizontal 1–5 bars. Optional `previous` shows a faint tick for the starting score. */
export function SkillBars({ scores, previous }: { scores: SkillScores; previous?: SkillScores | null }) {
  return (
    <dl className="grid gap-4">
      {SKILLS.map((s) => {
        const v = scores[s];
        const prev = previous?.[s];
        const delta = prev !== undefined ? Math.round((v - prev) * 10) / 10 : 0;
        return (
          <div key={s} className="grid grid-cols-[7.5rem_1fr_3.25rem] items-center gap-3 sm:grid-cols-[9rem_1fr_3.5rem]">
            <dt className="text-[0.95rem] font-medium text-ink-soft">{SKILL_LABELS[s]}</dt>
            <dd className="relative h-2.5 rounded-full bg-paper-deep" aria-hidden="true">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-700 ease-[var(--ease-calm)]"
                style={{ width: `${((v - 1) / 4) * 92 + 8}%` }}
              />
              {prev !== undefined && Math.abs(delta) >= 0.1 ? (
                <div
                  className="absolute -top-1 h-4.5 w-0.5 rounded bg-accent"
                  style={{ left: `${((prev - 1) / 4) * 92 + 8}%` }}
                  title={`Started at ${prev.toFixed(1)}`}
                />
              ) : null}
            </dd>
            <dd className="text-right font-display text-lg tabular-nums">
              {v.toFixed(1)}
              <span className="sr-only">
                {" "}
                out of 5 for {SKILL_LABELS[s]}
                {prev !== undefined && delta !== 0 ? `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since you started` : ""}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
