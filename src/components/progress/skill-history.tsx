"use client";

import { useState } from "react";
import { SKILLS, SKILL_LABELS, type Skill, type SkillScores } from "@/lib/skills";

type Snapshot = { at: string; source: string; scores: SkillScores };

const W = 240;
const H = 56;
const PAD = 6;

/**
 * Skill profile over time as small multiples: one single-series sparkline per skill,
 * all on the same 1–5 scale. Ink lines, the latest point in the accent color, a faint
 * tick at the starting score. Hover/focus shows the value and date; a table view follows.
 */
export function SkillHistory({ snapshots }: { snapshots: Snapshot[] }) {
  const n = snapshots.length;
  const x = (i: number) => (n <= 1 ? W - PAD : PAD + (i * (W - PAD * 2)) / (n - 1));
  const y = (v: number) => H - PAD - ((v - 1) / 4) * (H - PAD * 2);
  const latest = snapshots[n - 1]?.scores;
  const first = snapshots[0]?.scores;

  return (
    <div>
      <ul className="grid gap-1">
        {SKILLS.map((skill) => (
          <Row key={skill} skill={skill} snapshots={snapshots} x={x} y={y} latest={latest} first={first} />
        ))}
      </ul>
      <details className="mt-6 text-sm">
        <summary className="link cursor-pointer text-ink-soft">Show as a table</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left tabular-nums">
            <thead>
              <tr className="border-b border-rule-strong text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  When
                </th>
                {SKILLS.map((s) => (
                  <th key={s} scope="col" className="py-2 pr-3 font-semibold">
                    {SKILL_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap, i) => (
                <tr key={i} className="border-b border-rule">
                  <th scope="row" className="py-2 pr-3 font-normal text-ink-soft">
                    {fmtDate(snap.at)} · {snap.source === "assessment" ? "assessment" : "critique"}
                  </th>
                  {SKILLS.map((s) => (
                    <td key={s} className="py-2 pr-3">
                      {snap.scores[s].toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Row({
  skill,
  snapshots,
  x,
  y,
  latest,
  first,
}: {
  skill: Skill;
  snapshots: Snapshot[];
  x: (i: number) => number;
  y: (v: number) => number;
  latest?: SkillScores;
  first?: SkillScores;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = snapshots.map((s) => s.scores[skill]);
  const current = latest?.[skill] ?? 1;
  const delta = first ? Math.round((current - first[skill]) * 10) / 10 : 0;
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const shown = hover ?? values.length - 1;

  return (
    <li className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3 border-b border-rule py-3 last:border-0 sm:grid-cols-[9rem_1fr_5rem]">
      <span className="font-medium text-ink-soft">{SKILL_LABELS[skill]}</span>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-14 w-full overflow-visible"
          role="img"
          aria-label={`${SKILL_LABELS[skill]}: ${values.map((v) => v.toFixed(1)).join(", ")}`}
          onMouseLeave={() => setHover(null)}
        >
          {[1, 3, 5].map((g) => (
            <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke="var(--color-rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {values.length > 1 ? (
            <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ) : null}
          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--color-ink-muted)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ) : null}
          {values.map((v, i) => (
            <g key={i}>
              {/* generous invisible hit target */}
              <rect
                x={x(i) - 12}
                y={0}
                width={24}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
        </svg>
        {/* markers drawn in HTML so they stay round under preserveAspectRatio="none" */}
        {values.map((v, i) =>
          i === values.length - 1 || i === hover ? (
            <span
              key={i}
              className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-sheet ${
                i === values.length - 1 ? "bg-accent" : "bg-ink"
              }`}
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%` }}
              aria-hidden="true"
            />
          ) : null,
        )}
        {hover !== null ? (
          <div
            className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-sheet"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            {values[hover].toFixed(1)} · {fmtDate(snapshots[hover].at)}
          </div>
        ) : null}
      </div>
      <span className="text-right">
        <span className="font-display text-xl tabular-nums">{values[shown]?.toFixed(1)}</span>
        {delta !== 0 ? (
          <span className={`ml-1.5 text-xs font-semibold tabular-nums ${delta > 0 ? "text-moss" : "text-ink-muted"}`}>
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta).toFixed(1)}
          </span>
        ) : null}
      </span>
    </li>
  );
}
