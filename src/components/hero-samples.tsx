"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { SAMPLES } from "@/lib/samples";

const INTERVAL_MS = 3000;

/**
 * Landing hero: a learner's drawing with the coach's "one thing to work on", cycling
 * through the bundled samples every 3 seconds. Pauses on hover/focus, has a visible
 * pause control (WCAG 2.2.2), and doesn't auto-advance for reduced-motion users.
 */
export function HeroSamples() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const running = !paused && !hovering && !reducedMotion;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SAMPLES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [running]);

  const s = SAMPLES[index];

  return (
    <figure
      className="mx-auto w-full max-w-xl"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
      aria-roledescription="carousel"
      aria-label="Example critiques"
    >
      <div className="relative rotate-[0.6deg] overflow-hidden rounded-xl shadow-[0_30px_60px_-30px_rgba(28,27,25,0.55)]">
        {/* All samples stacked; only the current one is visible (cross-fade). */}
        <div className="relative aspect-[4/3] w-full bg-sheet">
          {SAMPLES.map((sample, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={sample.id}
              src={`/samples/${sample.file}`}
              alt={i === index ? sample.alt : ""}
              aria-hidden={i !== index}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-[var(--ease-calm)]"
              style={{ opacity: i === index ? 1 : 0 }}
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
          <svg viewBox="0 0 1500 1125" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <ellipse
              key={s.id}
              cx={s.mark.cx}
              cy={s.mark.cy}
              rx={s.mark.rx}
              ry={s.mark.ry}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="7"
              strokeLinecap="round"
              transform={`rotate(${s.mark.rot} ${s.mark.cx} ${s.mark.cy})`}
              style={{
                strokeDasharray: 3200,
                ["--len" as string]: 3200,
                animation: "draw-line 1.1s 0.25s var(--ease-calm) both",
              }}
            />
          </svg>
        </div>
      </div>

      <figcaption className="sheet relative -mt-10 ml-auto mr-2 min-h-[10.5rem] max-w-[19.5rem] rotate-[-1deg] p-5 sm:-mt-16 sm:mr-[-1.5rem]">
        <div key={s.id} className="animate-fade-up">
          <p className="eyebrow text-accent-deep">The one thing to work on</p>
          <p className="mt-2 font-display text-lg leading-snug">{s.tip.title}</p>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">{s.tip.body}</p>
        </div>
      </figcaption>

      <div className="mt-4 flex items-center justify-center gap-2">
        {SAMPLES.map((sample, i) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show example ${i + 1}: ${sample.title}`}
            aria-current={i === index}
            className="group inline-flex h-8 w-8 items-center justify-center"
          >
            <span
              className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-ink" : "w-2 bg-rule-strong group-hover:bg-ink-muted"}`}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play examples" : "Pause examples"}
          className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-paper-deep hover:text-ink"
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
    </figure>
  );
}
