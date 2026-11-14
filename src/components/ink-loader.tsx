"use client";

import { useEffect, useState } from "react";

/**
 * A line that draws itself, slowly — used for every wait (plan, decks, critiques).
 * Cycles through calm status messages so long AI calls never feel frozen.
 */
export function InkLoader({ messages, className = "" }: { messages: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 4200);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center gap-5 py-10 text-center ${className}`}>
      <svg viewBox="0 0 160 60" className="w-40" aria-hidden="true">
        <path
          d="M6 44 C 26 10, 46 10, 58 32 S 92 58, 104 28 S 138 6, 154 22"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 240,
            ["--len" as string]: 240,
            animation: "draw-line 2.6s var(--ease-calm) infinite alternate",
          }}
        />
        <circle cx="154" cy="22" r="2.6" fill="var(--color-accent)" />
      </svg>
      <p key={i} className="animate-fade-up max-w-xs text-ink-soft">
        {messages[i]}
      </p>
    </div>
  );
}
