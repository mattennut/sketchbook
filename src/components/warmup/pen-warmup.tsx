"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, PenLine, RotateCcw } from "lucide-react";
import { scoreEllipse, scoreHatching, scoreLine, type Box, type Ellipse, type Pt } from "@/lib/warmup/geometry";

/**
 * Two-minute pen warm-up for tablet users, shown before each lesson.
 * Three drills — confident lines, ellipses, a hatching patch — scored by geometry.
 * Pointer Events with coalesced samples, pen pressure for line width, and simple palm
 * rejection (touch is ignored once a pen has been seen).
 */

type Drill = "lines" | "ellipses" | "hatching";
type Phase = "intro" | Drill | "summary";

const LINE_REPS = 5;
const ELLIPSE_REPS = 3;
const MIN_HATCH = 6;
const INK = "#1c1b19";
const ACCENT = "#a34a25";
const GUIDE = "rgba(28,27,25,0.28)";

type Stroke = { pts: Pt[]; widths: number[] };
type Results = { lines: number[]; ellipses: number[]; hatching: number | null };

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Targets are stored in 0–1 coordinates so they survive canvas resizes. */
type LineTarget = { a: Pt; b: Pt };
function newLine(): LineTarget {
  const len = rand(0.45, 0.72);
  const ang = (rand(-35, 35) + (Math.random() < 0.3 ? 90 : 0)) * (Math.PI / 180);
  const cx = rand(0.35, 0.65);
  const cy = rand(0.35, 0.65);
  const dx = (Math.cos(ang) * len) / 2;
  const dy = (Math.sin(ang) * len) / 2 * 1.4; // canvas is wider than tall
  const fit = (v: number) => Math.min(0.92, Math.max(0.08, v));
  return { a: { x: fit(cx - dx), y: fit(cy - dy) }, b: { x: fit(cx + dx), y: fit(cy + dy) } };
}
function newEllipse(): { rx: number; ratio: number; rot: number } {
  return { rx: rand(0.2, 0.3), ratio: rand(0.35, 0.95), rot: (rand(-40, 40) * Math.PI) / 180 };
}

const HISTORY_KEY = "sb_warmup_history";
function readBest(): number | null {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as { overall: number }[];
    return h.length ? Math.max(...h.map((x) => x.overall)) : null;
  } catch {
    return null;
  }
}
function saveRun(overall: number) {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown[];
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...h.slice(-29), { at: Date.now(), overall }]));
  } catch {
    /* storage unavailable — fine */
  }
}

export function PenWarmup({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [rep, setRep] = useState(0);
  const [results, setResults] = useState<Results>({ lines: [], ellipses: [], hatching: null });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hatchCount, setHatchCount] = useState(0);
  const [mouseHint, setMouseHint] = useState(false);
  const [best, setBest] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const penSeen = useRef(false);
  const locked = useRef(false);
  const lineTarget = useRef<LineTarget>({ a: { x: 0.2, y: 0.5 }, b: { x: 0.8, y: 0.5 } });
  const ellipseTarget = useRef(newEllipse());
  const solution = useRef<null | (() => void)>(null);

  const px = (p: Pt): Pt => ({ x: p.x * size.current.w, y: p.y * size.current.h });
  const ellipseInPx = (): Ellipse => {
    const { w, h } = size.current;
    const t = ellipseTarget.current;
    const rx = t.rx * w;
    return { cx: w / 2, cy: h / 2, rx, ry: Math.min(rx * t.ratio, h * 0.38), rot: t.rot };
  };
  const hatchBox = (): Box => {
    const { w, h } = size.current;
    const bw = Math.min(w * 0.42, 280);
    const bh = h * 0.6;
    return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
  };

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { w, h } = size.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // guides
    if (phase === "lines") {
      const { a, b } = lineTarget.current;
      for (const p of [px(a), px(b)]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (phase === "ellipses") {
      const el = ellipseInPx();
      ctx.strokeStyle = GUIDE;
      ctx.lineWidth = 1.5;
      if (rep === 0) {
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        ctx.ellipse(el.cx, el.cy, el.rx, el.ry, el.rot, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // axis end points (the guide fades to just these after the first rep)
      const pts = [
        [el.rx, 0],
        [-el.rx, 0],
        [0, el.ry],
        [0, -el.ry],
      ].map(([u, v]) => ({
        x: el.cx + u * Math.cos(el.rot) - v * Math.sin(el.rot),
        y: el.cy + u * Math.sin(el.rot) + v * Math.cos(el.rot),
      }));
      ctx.fillStyle = INK;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(el.cx, el.cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (phase === "hatching") {
      const b = hatchBox();
      ctx.strokeStyle = GUIDE;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 7]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
    }

    // ink
    ctx.strokeStyle = INK;
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      for (let i = 1; i < s.pts.length; i++) {
        ctx.lineWidth = s.widths[i];
        ctx.beginPath();
        ctx.moveTo(s.pts[i - 1].x, s.pts[i - 1].y);
        ctx.lineTo(s.pts[i].x, s.pts[i].y);
        ctx.stroke();
      }
    }
    solution.current?.();
  }, [phase, rep]);

  // Size the canvas to its container (crisp on high-DPI screens).
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const c = canvasRef.current;
    if (!wrap || !c) return;
    const fit = () => {
      const w = Math.round(wrap.clientWidth);
      const h = Math.round(Math.min(440, Math.max(280, w * 0.6)));
      const dpr = window.devicePixelRatio || 1;
      size.current = { w, h };
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.height = `${h}px`;
      draw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw, phase]);

  useEffect(() => {
    draw();
  }, [draw]);

  const point = (e: PointerEvent | React.PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const widthFor = (e: PointerEvent | React.PointerEvent) =>
    e.pointerType === "pen" ? 1.2 + (e.pressure || 0.5) * 3.6 : 2.6;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked.current) return;
    if (e.pointerType === "pen") penSeen.current = true;
    if (e.pointerType === "touch" && penSeen.current) return; // palm rejection
    if (e.pointerType === "mouse") setMouseHint(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; drawing works without it */
    }
    solution.current = null;
    current.current = { pts: [point(e)], widths: [widthFor(e)] };
    draw();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = current.current;
    if (!s) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      s.pts.push(point(ev));
      s.widths.push(widthFor(ev));
    }
    draw();
  };

  const onUp = () => {
    const s = current.current;
    current.current = null;
    if (!s || s.pts.length < 2) return draw();

    if (phase === "lines") {
      const { a, b } = lineTarget.current;
      const r = scoreLine(s.pts, px(a), px(b));
      strokes.current = [s];
      setFeedback(`Straight ${r.straight} · on target ${r.onTarget}`);
      solution.current = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const pa = px(a);
        const pb = px(b);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      advance("lines", r.score);
    } else if (phase === "ellipses") {
      const el = ellipseInPx();
      const r = scoreEllipse(s.pts, el);
      strokes.current = [s];
      setFeedback(`Shape ${r.shape} · closed ${r.closed}`);
      solution.current = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(el.cx, el.cy, el.rx, el.ry, el.rot, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      advance("ellipses", r.score);
    } else if (phase === "hatching") {
      strokes.current = [...strokes.current, s];
      setHatchCount(strokes.current.length);
    }
    draw();
  };

  const advance = (drill: "lines" | "ellipses", score: number) => {
    locked.current = true;
    const reps = drill === "lines" ? LINE_REPS : ELLIPSE_REPS;
    setResults((r) => ({ ...r, [drill]: [...r[drill], score] }));
    setTimeout(() => {
      locked.current = false;
      strokes.current = [];
      solution.current = null;
      setFeedback(null);
      setRep((n) => {
        const next = n + 1;
        if (next >= reps) {
          if (drill === "lines") {
            ellipseTarget.current = newEllipse();
            setPhase("ellipses");
          } else {
            setPhase("hatching");
          }
          return 0;
        }
        if (drill === "lines") lineTarget.current = newLine();
        else ellipseTarget.current = newEllipse();
        return next;
      });
    }, 900);
  };

  const finishHatching = () => {
    const r = scoreHatching(
      strokes.current.map((s) => s.pts),
      hatchBox(),
    );
    const final = { ...results, hatching: r.score };
    setResults(final);
    const overall = avg([avg(final.lines), avg(final.ellipses), r.score]);
    setBest(readBest());
    saveRun(overall);
    strokes.current = [];
    setPhase("summary");
  };

  const start = () => {
    lineTarget.current = newLine();
    strokes.current = [];
    setResults({ lines: [], ellipses: [], hatching: null });
    setRep(0);
    setPhase("lines");
  };

  const skip = (
    <button type="button" onClick={onFinish} className="link text-sm text-ink-muted">
      Skip warm-up
    </button>
  );

  if (phase === "intro") {
    return (
      <section className="sheet animate-fade-up mx-auto max-w-3xl p-6 sm:p-10">
        <p className="eyebrow">Pen warm-up · about 2 minutes</p>
        <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">Loosen up before the lesson</h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Three quick drills with your pen: five confident lines, three ellipses and a small patch of hatching. Each
          stroke is scored on its geometry, so you can watch your hand get steadier week by week.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <button className="btn btn-primary" onClick={start}>
            <PenLine size={18} aria-hidden="true" /> Start warm-up
          </button>
          {skip}
        </div>
      </section>
    );
  }

  if (phase === "summary") {
    const overall = avg([avg(results.lines), avg(results.ellipses), results.hatching ?? 0]);
    const rows = [
      { label: "Confident lines", value: avg(results.lines) },
      { label: "Ellipses", value: avg(results.ellipses) },
      { label: "Hatching", value: results.hatching ?? 0 },
    ];
    return (
      <section className="sheet animate-fade-up mx-auto max-w-3xl p-6 sm:p-10">
        <p className="eyebrow">Warm-up done</p>
        <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
          {overall}
          <span className="ml-2 font-sans text-lg text-ink-muted">/ 100</span>
        </h2>
        <p className="mt-2 text-ink-soft">
          {best !== null
            ? overall > best
              ? "A new personal best. Your hand is warmed up."
              : `Your best so far is ${best}. Your hand is warmed up.`
            : "Your first warm-up. Your hand is ready."}
        </p>
        <dl className="mt-7 grid gap-3">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3">
              <dt className="text-ink-soft">{r.label}</dt>
              <dd className="h-2 overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(3, r.value)}%` }} />
              </dd>
              <dd className="text-right font-display text-lg tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <button className="btn btn-primary" onClick={onFinish}>
            Start the lesson <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={start} className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
            <RotateCcw size={15} aria-hidden="true" /> Go again
          </button>
        </div>
      </section>
    );
  }

  const instruction =
    phase === "lines"
      ? "Ghost the motion above the screen, then draw one smooth line from dot to dot."
      : phase === "ellipses"
        ? rep === 0
          ? "Trace the dashed ellipse in one continuous loop."
          : "Draw the ellipse through the four dots — one loop, no going back."
        : "Fill the box with parallel strokes, evenly spaced, all in the same direction.";
  const progress =
    phase === "lines" ? `${rep + 1} / ${LINE_REPS}` : phase === "ellipses" ? `${rep + 1} / ${ELLIPSE_REPS}` : `${hatchCount} strokes`;
  const step = phase === "lines" ? 1 : phase === "ellipses" ? 2 : 3;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="eyebrow">
          Warm-up {step} of 3 · {phase === "lines" ? "Confident lines" : phase === "ellipses" ? "Ellipses" : "Hatching"}
        </p>
        <span className="text-sm tabular-nums text-ink-muted">{progress}</span>
      </div>
      <p className="mb-4 text-lg">{instruction}</p>
      <div ref={wrapRef} className="sheet overflow-hidden p-0">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="img"
          aria-label={`Drawing area: ${instruction}`}
        />
      </div>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-4">
        <p className="text-ink-soft" role="status" aria-live="polite">
          {feedback ??
            (mouseHint ? "Works with a mouse too, but it's made for a pen or stylus." : " ")}
        </p>
        <div className="flex items-center gap-4">
          {phase === "hatching" ? (
            <>
              <button
                type="button"
                className="text-sm font-medium text-ink-soft hover:text-ink"
                onClick={() => {
                  strokes.current = [];
                  setHatchCount(0);
                  draw();
                }}
              >
                Clear
              </button>
              <button className="btn btn-primary" onClick={finishHatching} disabled={hatchCount < MIN_HATCH}>
                {hatchCount < MIN_HATCH ? `${MIN_HATCH - hatchCount} more strokes` : "Done"}
              </button>
            </>
          ) : null}
          {skip}
        </div>
      </div>
    </section>
  );
}
