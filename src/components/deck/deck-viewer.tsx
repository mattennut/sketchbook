"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { Slide, StoredDeck } from "@/lib/content";

export function DeckViewer({ deck, subtopicId }: { deck: StoredDeck; subtopicId: string }) {
  const slides = deck.slides;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const marked = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const isLast = index === slides.length - 1;

  const go = useCallback(
    (delta: 1 | -1) => {
      setIndex((i) => {
        const next = Math.min(slides.length - 1, Math.max(0, i + delta));
        if (next !== i) setDirection(delta);
        return next;
      });
    },
    [slides.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (isLast && !marked.current) {
      marked.current = true;
      void fetch("/api/progress/lesson", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subtopicId }),
      }).catch(() => {});
    }
  }, [isLast, subtopicId]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3" aria-hidden="true">
        {slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500 ease-[var(--ease-calm)]"
              style={{ width: i < index ? "100%" : i === index ? "100%" : "0%", opacity: i === index ? 1 : 0.35 }}
            />
          </div>
        ))}
      </div>

      <div
        className="sheet relative min-h-[26rem] touch-pan-y overflow-hidden sm:min-h-[30rem]"
        onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touchStart.current;
          touchStart.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
        aria-roledescription="carousel"
        aria-label="Lesson slides"
      >
        <div
          key={index}
          className="p-6 sm:p-10"
          style={{ animation: `${direction === 1 ? "slide-in-right" : "slide-in-left"} 360ms var(--ease-calm) both` }}
          role="group"
          aria-roledescription="slide"
          aria-label={`Slide ${index + 1} of ${slides.length}`}
          aria-live="polite"
        >
          <SlideView slide={slides[index]} subtopicId={subtopicId} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium text-ink-soft hover:bg-paper-deep disabled:invisible"
        >
          <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>
        <span className="text-sm tabular-nums text-ink-muted">
          {index + 1} / {slides.length}
        </span>
        {isLast ? (
          <Link href={`/practice/${subtopicId}`} className="btn btn-primary">
            Start practice <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" onClick={() => go(1)} className="btn btn-secondary">
            Next <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-3 hidden text-center text-xs text-ink-muted sm:block">Use ← → keys to move between slides.</p>
    </div>
  );
}

function SlideView({ slide, subtopicId }: { slide: Slide; subtopicId: string }) {
  switch (slide.type) {
    case "title":
      return (
        <div className="flex min-h-[20rem] flex-col justify-center sm:min-h-[24rem]">
          <p className="eyebrow">Lesson</p>
          <h2 className="mt-4 text-4xl leading-[1.08] sm:text-6xl">{slide.heading}</h2>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink-soft">{slide.body}</p>
        </div>
      );
    case "concept":
      return (
        <div>
          <h2 className="text-3xl leading-tight sm:text-4xl">{slide.heading}</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{slide.body}</p>
          <ul className="mt-7 grid gap-3">
            {slide.points.map((p, i) => (
              <li key={i} className="flex gap-3 text-[1.05rem]">
                <span className="mt-3 h-px w-5 shrink-0 bg-accent" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "steps":
      return (
        <div>
          <h2 className="text-3xl leading-tight sm:text-4xl">{slide.heading}</h2>
          <ol className="mt-7 grid gap-4">
            {slide.points.map((p, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-7 shrink-0 font-display text-2xl leading-7 text-accent tabular-nums">{i + 1}</span>
                <span className="pt-0.5 text-[1.05rem] leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
          {slide.body ? <p className="mt-6 border-t border-rule pt-4 text-ink-soft">{slide.body}</p> : null}
        </div>
      );
    case "do_dont":
      return (
        <div>
          <h2 className="text-3xl leading-tight sm:text-4xl">{slide.heading}</h2>
          <div className="mt-7 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-3 text-moss">Do</p>
              <ul className="grid gap-3">
                {slide.dos.map((d, i) => (
                  <li key={i} className="flex gap-3">
                    <Check size={18} className="mt-1 shrink-0 text-moss" aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-3 text-accent">Avoid</p>
              <ul className="grid gap-3">
                {slide.donts.map((d, i) => (
                  <li key={i} className="flex gap-3">
                    <X size={18} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    case "diagram":
      return (
        <figure>
          <h2 className="text-3xl leading-tight sm:text-4xl">{slide.heading}</h2>
          <div
            className="mt-6 overflow-hidden rounded-2xl border border-rule bg-[#fbf9f4] p-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            // Sanitized server-side with a strict allowlist (lib/svg-sanitize.ts) before it was cached.
            dangerouslySetInnerHTML={{ __html: slide.svg }}
            aria-label={slide.body || slide.heading}
            role="img"
          />
          {slide.body ? <figcaption className="mt-4 text-ink-soft">{slide.body}</figcaption> : null}
        </figure>
      );
    case "exercise_preview":
      return (
        <div className="flex min-h-[20rem] flex-col justify-center sm:min-h-[24rem]">
          <p className="eyebrow">Up next: practice</p>
          <h2 className="mt-4 text-3xl leading-tight sm:text-5xl">{slide.heading}</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">{slide.body}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {slide.points.map((p, i) => (
              <li key={i} className="rounded-full border border-rule-strong px-3 py-1 text-sm">
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-muted">
            Grab paper and a pencil.{" "}
            <Link href={`/practice/${subtopicId}`} className="link">
              Start practice
            </Link>{" "}
            when you&apos;re ready.
          </p>
        </div>
      );
  }
}
