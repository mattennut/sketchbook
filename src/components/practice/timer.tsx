"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

/** Optional time box. Deliberately quiet: no alarms, just a gentle note at zero. */
export function Timer({ minutes }: { minutes: number }) {
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const [wantsRun, setRunning] = useState(false);
  const running = wantsRun && left > 0;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const started = left !== total;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-11 w-11" aria-hidden="true">
        <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--color-paper-deep)" strokeWidth="3" />
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={(2 * Math.PI * 19 * left) / total}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
      </div>
      <span className="font-display text-2xl tabular-nums" aria-live="off">
        {mm}:{ss}
      </span>
      <button
        type="button"
        onClick={() => (left === 0 ? (setLeft(total), setRunning(true)) : setRunning(!running))}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-rule-strong px-3.5 text-sm font-medium hover:border-ink"
      >
        {running ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        {running ? "Pause" : started && left > 0 ? "Resume" : `Start ${minutes}-min timer`}
      </button>
      {started ? (
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setLeft(total);
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-paper-deep"
          aria-label="Reset timer"
        >
          <RotateCcw size={16} />
        </button>
      ) : null}
      {left === 0 ? <span className="text-sm text-ink-soft" role="status">Time&apos;s up — finish your thought, then photograph it.</span> : null}
    </div>
  );
}
