"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import {
  EXPERIENCE_OPTIONS,
  MCQ_ITEMS,
  PERCEPTION_ITEMS,
  UNSURE,
  type McqItem,
  type PerceptionItem,
} from "@/lib/assessment/items";
import { SPECIALIZATIONS, SPECIALIZATION_INFO, SKILLS, SKILL_LABELS, type SkillScores, type Specialization } from "@/lib/skills";
import { prepareImage } from "@/lib/client/resize";
import type { EquipmentId } from "@/lib/skills";
import { EquipmentPicker } from "../equipment-picker";
import { PerceptionFigure } from "./figures";
import { InkLoader } from "../ink-loader";
import { SkillBars } from "../skill-bars";

type Step =
  | { kind: "specialization" }
  | { kind: "experience" }
  | { kind: "equipment" }
  | { kind: "portfolio" }
  | { kind: "ab"; item: PerceptionItem }
  | { kind: "mcq"; item: McqItem };

/** Display order per item — mixes which side the correct answer appears on. */
const DISPLAY_ORDER: Record<string, [string, string]> = {
  "persp-box": ["a", "b"],
  ellipse: ["a", "b"],
  face: ["b", "a"],
  sphere: ["b", "a"],
  "color-value": ["a", "b"],
  "color-temp": ["a", "b"],
  focal: ["b", "a"],
};

const STEPS: Step[] = [
  { kind: "specialization" },
  { kind: "experience" },
  { kind: "equipment" },
  { kind: "portfolio" },
  ...PERCEPTION_ITEMS.map((item) => ({ kind: "ab" as const, item })),
  ...MCQ_ITEMS.map((item) => ({ kind: "mcq" as const, item })),
];

type PortfolioState =
  | { status: "idle" }
  | { status: "analyzing"; promise: Promise<{ id: string; summary: string } | null> }
  | { status: "done"; id: string; summary: string }
  | { status: "failed"; message: string };

type Phase = "questions" | "scoring" | "result" | "planning" | "default";

export function AssessmentFlow({
  hasPlan,
  isPaid,
  defaultMode = false,
}: {
  hasPlan: boolean;
  isPaid: boolean;
  defaultMode?: boolean;
}) {
  const router = useRouter();
  const [skipTest, setSkipTest] = useState(defaultMode);
  const [index, setIndex] = useState(0);
  const [spec, setSpec] = useState<Specialization | null>(null);
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [portfolio, setPortfolio] = useState<PortfolioState>({ status: "idle" });
  const [phase, setPhase] = useState<Phase>("questions");
  const [profile, setProfile] = useState<SkillScores | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = STEPS[index];
  const progress = phase === "questions" ? index / STEPS.length : 1;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [index, phase]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const finish = useCallback(
    async (finalAnswers: Record<string, string>) => {
      setPhase("scoring");
      setError(null);
      let portfolioId: string | null = null;
      if (portfolio.status === "analyzing") {
        const res = await portfolio.promise;
        portfolioId = res?.id ?? null;
      } else if (portfolio.status === "done") {
        portfolioId = portfolio.id;
      }
      try {
        const res = await fetch("/api/assessment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ specialization: spec, answers: finalAnswers, equipment, portfolioId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't save your answers.");
        setProfile(data.profile);
        setPortfolioSummary(data.portfolioSummary);
        setPhase("result");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save your answers.");
        setPhase("questions");
      }
    },
    [portfolio, spec, equipment],
  );

  const next = useCallback(
    (updated?: Record<string, string>) => {
      if (index < STEPS.length - 1) setIndex(index + 1);
      else void finish(updated ?? answers);
    },
    [answers, finish, index],
  );

  const answer = (id: string, value: string) => {
    const updated = { ...answers, [id]: value };
    setAnswers(updated);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => next(updated), 320);
  };

  const startPortfolio = (files: File[]) => {
    const promise = (async () => {
      try {
        const form = new FormData();
        for (const f of files) form.append("images", await prepareImage(f), "portfolio.jpg");
        if (spec) form.append("specialization", spec);
        const res = await fetch("/api/portfolio", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Portfolio analysis failed.");
        setPortfolio({ status: "done", id: data.id, summary: data.summary });
        return { id: data.id as string, summary: data.summary as string };
      } catch (e) {
        setPortfolio({ status: "failed", message: e instanceof Error ? e.message : "Portfolio analysis failed." });
        return null;
      }
    })();
    setPortfolio({ status: "analyzing", promise });
    next();
  };

  const buildPlan = async () => {
    setPhase("planning");
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialization: spec }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setPaywall(true);
        setPhase("result");
        return;
      }
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't build your plan.");
      router.push("/plan");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build your plan.");
      setPhase("result");
    }
  };

  /** Skip the skill test: deterministic default course, week 1 pre-generated. */
  const startDefault = async (chosen: Specialization) => {
    setPhase("default");
    setError(null);
    try {
      const res = await fetch("/api/plan/default", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialization: chosen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't start the default course.");
      router.push("/plan");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the default course.");
      setPhase("questions");
    }
  };

  if (phase === "default") {
    return <InkLoader className="py-24" messages={["Setting up your default course…"]} />;
  }

  if (phase === "scoring") {
    return (
      <InkLoader
        messages={
          portfolio.status === "analyzing"
            ? ["Looking closely at your drawings…", "Comparing with your answers…", "Almost there…"]
            : ["Adding up what your eye already knows…"]
        }
      />
    );
  }

  if (phase === "planning") {
    return (
      <InkLoader
        className="py-24"
        messages={[
          "Reading your profile…",
          "Choosing from 67 lessons in the catalog…",
          "Ordering twelve weeks so each builds on the last…",
          "Writing a note for each week…",
        ]}
      />
    );
  }

  if (phase === "result" && profile) {
    const sorted = [...SKILLS].sort((a, b) => profile[b] - profile[a]);
    return (
      <section className="animate-fade-up mx-auto max-w-2xl">
        <p className="eyebrow">Your starting point</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-4xl leading-tight outline-none sm:text-5xl">
          Your eye is strongest at {SKILL_LABELS[sorted[0]].toLowerCase()}.
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          We&apos;ll start where you have the most room to grow —{" "}
          {SKILL_LABELS[sorted[5]].toLowerCase()} and {SKILL_LABELS[sorted[4]].toLowerCase()} — and build toward{" "}
          {spec ? SPECIALIZATION_INFO[spec].label.toLowerCase() : "your specialization"}.
        </p>
        <div className="sheet mt-8 p-6 sm:p-8">
          <SkillBars scores={profile} />
          {portfolioSummary ? (
            <p className="mt-6 border-t border-rule pt-5 text-ink-soft">
              <span className="font-semibold text-ink">From your portfolio: </span>
              {portfolioSummary}
            </p>
          ) : null}
        </div>
        {error ? <p className="mt-6 text-accent-deep" role="alert">{error}</p> : null}
        {paywall ? (
          <div className="mt-8 rounded-2xl border border-rule bg-accent-wash/60 p-6">
            <p className="font-medium">You already have a plan for this specialization.</p>
            <p className="mt-1 text-ink-soft">Rebuilding it from a new profile is part of Sketchbook Plus.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/upgrade" className="btn btn-primary">
                See Plus
              </Link>
              <Link href="/plan" className="btn btn-secondary">
                Keep my current plan
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <button className="btn btn-primary w-full sm:w-auto" onClick={buildPlan}>
              {hasPlan ? (isPaid ? "Rebuild my 12-week plan" : "Build my 12-week plan") : "Build my 12-week plan"}
            </button>
            <p className="mt-3 text-sm text-ink-muted">Takes about half a minute.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className={`mb-8 flex items-center gap-4 ${skipTest && index === 0 ? "invisible" : ""}`}>
        <button
          type="button"
          onClick={() => setIndex(Math.max(0, index - 1))}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep ${index === 0 ? "invisible" : ""}`}
          aria-label="Previous question"
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={index}
          aria-label="Assessment progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-calm)]"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
        <span className="w-14 text-right text-sm tabular-nums text-ink-muted">
          {index + 1} / {STEPS.length}
        </span>
      </div>

      {error ? (
        <p className="mb-6 rounded-xl bg-accent-wash px-4 py-3 text-accent-deep" role="alert">
          {error}{" "}
          <button className="link font-semibold" onClick={() => void finish(answers)}>
            Try again
          </button>
        </p>
      ) : null}

      <div key={index} className="animate-fade-up">
        {step.kind === "specialization" && (
          <SpecializationStep
            headingRef={headingRef}
            value={spec}
            skipTest={skipTest}
            onPick={(s) => {
              setSpec(s);
              if (advanceTimer.current) clearTimeout(advanceTimer.current);
              advanceTimer.current = setTimeout(() => (skipTest ? void startDefault(s) : setIndex(1)), 320);
            }}
          />
        )}
        {step.kind === "experience" && (
          <ChoiceStep
            headingRef={headingRef}
            eyebrow="About you"
            title="How much have you drawn before?"
            options={EXPERIENCE_OPTIONS.map((o) => ({ id: o.id, label: o.label, detail: o.detail }))}
            value={answers.experience}
            onPick={(v) => answer("experience", v)}
          />
        )}
        {step.kind === "equipment" && (
          <>
            <StepHeading
              headingRef={headingRef}
              eyebrow="Your tools"
              title="What do you draw or paint with?"
              sub="Pick everything you have. Drawing on a tablet? Each lesson will open with a two-minute pen warm-up."
            />
            <EquipmentPicker value={equipment} onChange={setEquipment} />
            <div className="mt-8">
              <button className="btn btn-primary" onClick={() => next()}>
                {equipment.length ? "Continue" : "Just paper and pencil — continue"}
              </button>
            </div>
          </>
        )}
        {step.kind === "portfolio" && (
          <PortfolioStep headingRef={headingRef} onAnalyze={startPortfolio} onSkip={() => next()} />
        )}
        {step.kind === "ab" && (
          <PerceptionStep
            headingRef={headingRef}
            item={step.item}
            number={PERCEPTION_ITEMS.indexOf(step.item) + 1}
            value={answers[step.item.id]}
            onPick={(v) => answer(step.item.id, v)}
          />
        )}
        {step.kind === "mcq" && (
          <ChoiceStep
            headingRef={headingRef}
            eyebrow={`Theory · ${MCQ_ITEMS.indexOf(step.item) + 1} of ${MCQ_ITEMS.length}`}
            title={step.item.prompt}
            options={step.item.options}
            value={answers[step.item.id]}
            onPick={(v) => answer(step.item.id, v)}
            allowUnsure
          />
        )}
      </div>

      <div className="mt-14 border-t border-rule pt-5 text-center text-sm text-ink-muted">
        {step.kind === "specialization" ? (
          skipTest ? (
            <button type="button" className="link" onClick={() => setSkipTest(false)}>
              Take the 5-minute skill test instead
            </button>
          ) : (
            <>
              Rather jump straight in?{" "}
              <button type="button" className="link font-medium text-ink-soft" onClick={() => setSkipTest(true)}>
                Skip the skill test — use the default course
              </button>
            </>
          )
        ) : spec ? (
          <button type="button" className="link font-medium text-ink-soft" onClick={() => void startDefault(spec)}>
            Skip the rest — start the default course
          </button>
        ) : null}
      </div>
    </section>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function StepHeading({ headingRef, eyebrow, title, sub }: { headingRef: HeadingRef; eyebrow: string; title: string; sub?: string }) {
  return (
    <header className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl leading-tight outline-none sm:text-4xl">
        {title}
      </h1>
      {sub ? <p className="mt-3 text-lg text-ink-soft">{sub}</p> : null}
    </header>
  );
}

function OptionRow({
  selected,
  onClick,
  label,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full flex-col items-start rounded-2xl border px-5 py-4 text-left transition-colors duration-150 ${
        selected ? "border-accent bg-accent-wash" : "border-rule bg-sheet hover:border-rule-strong"
      }`}
    >
      <span className="text-[1.05rem] font-semibold">{label}</span>
      {detail ? <span className="mt-0.5 text-ink-soft">{detail}</span> : null}
    </button>
  );
}

function SpecializationStep({
  headingRef,
  value,
  skipTest,
  onPick,
}: {
  headingRef: HeadingRef;
  value: Specialization | null;
  skipTest: boolean;
  onPick: (s: Specialization) => void;
}) {
  const groups: { title: string; kind: "subject" | "style" }[] = [
    { title: "A subject", kind: "subject" },
    { title: "Or a style", kind: "style" },
  ];
  return (
    <>
      <StepHeading
        headingRef={headingRef}
        eyebrow={skipTest ? "Default course" : "Your focus"}
        title="What do you most want to draw?"
        sub={
          skipTest
            ? "Pick one and your 12-week default course starts right away — no test. You can personalize it later."
            : "Pick one. Your plan leans this way — you can change it later."
        }
      />
      <div className="grid gap-8 sm:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.kind}>
            <legend className="eyebrow mb-3">{g.title}</legend>
            <div className="grid gap-3">
              {SPECIALIZATIONS.filter((s) => SPECIALIZATION_INFO[s].kind === g.kind).map((s) => (
                <OptionRow
                  key={s}
                  selected={value === s}
                  onClick={() => onPick(s)}
                  label={SPECIALIZATION_INFO[s].label}
                  detail={SPECIALIZATION_INFO[s].blurb}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </>
  );
}

function ChoiceStep({
  headingRef,
  eyebrow,
  title,
  options,
  value,
  onPick,
  allowUnsure,
}: {
  headingRef: HeadingRef;
  eyebrow: string;
  title: string;
  options: { id: string; label: string; detail?: string }[];
  value?: string;
  onPick: (id: string) => void;
  allowUnsure?: boolean;
}) {
  return (
    <>
      <StepHeading headingRef={headingRef} eyebrow={eyebrow} title={title} />
      <div className="grid gap-3">
        {options.map((o) => (
          <OptionRow key={o.id} selected={value === o.id} onClick={() => onPick(o.id)} label={o.label} detail={o.detail} />
        ))}
      </div>
      {allowUnsure ? <UnsureButton selected={value === UNSURE} onClick={() => onPick(UNSURE)} /> : null}
    </>
  );
}

function UnsureButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <div className="mt-6 text-center">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`link text-ink-soft ${selected ? "font-semibold text-accent" : ""}`}
      >
        Not sure — skip this one
      </button>
    </div>
  );
}

function PerceptionStep({
  headingRef,
  item,
  number,
  value,
  onPick,
}: {
  headingRef: HeadingRef;
  item: PerceptionItem;
  number: number;
  value?: string;
  onPick: (v: string) => void;
}) {
  const order = DISPLAY_ORDER[item.id] ?? item.variants;
  return (
    <>
      <StepHeading
        headingRef={headingRef}
        eyebrow={`Your eye · ${number} of ${PERCEPTION_ITEMS.length}`}
        title={item.prompt}
        sub={item.hint}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {order.map((variant, i) => {
          const letter = i === 0 ? "A" : "B";
          const selected = value === variant;
          return (
            <button
              key={variant}
              type="button"
              onClick={() => onPick(variant)}
              aria-pressed={selected}
              aria-label={`Option ${letter}`}
              className={`group overflow-hidden rounded-2xl border-2 bg-sheet text-left transition-colors duration-150 ${
                selected ? "border-accent" : "border-rule hover:border-rule-strong"
              }`}
            >
              <PerceptionFigure itemId={item.id} variant={variant} label={`Option ${letter} illustration`} />
              <span
                className={`flex items-center justify-center border-t py-2.5 font-display text-lg ${
                  selected ? "border-accent bg-accent text-sheet" : "border-rule"
                }`}
              >
                {letter}
              </span>
            </button>
          );
        })}
      </div>
      <UnsureButton selected={value === UNSURE} onClick={() => onPick(UNSURE)} />
    </>
  );
}

function PortfolioStep({
  headingRef,
  onAnalyze,
  onSkip,
}: {
  headingRef: HeadingRef;
  onAnalyze: (files: File[]) => void;
  onSkip: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <>
      <StepHeading
        headingRef={headingRef}
        eyebrow="Optional"
        title="Have a few drawings you've already made?"
        sub="Add up to three photos and the coach will factor them into your starting level. They're analyzed once and not stored."
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Choose portfolio images"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          setFiles((prev) => [...prev, ...picked].slice(0, 3));
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) =>
          previews[i] ? (
            <div key={i} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-rule bg-sheet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={`Portfolio image ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sheet/90 text-ink"
                aria-label={`Remove image ${i + 1}`}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rule-strong text-ink-muted hover:border-ink-muted hover:text-ink-soft"
              aria-label="Add a portfolio image"
            >
              <ImagePlus size={24} strokeWidth={1.5} />
              <span className="text-sm">Add photo</span>
            </button>
          ),
        )}
      </div>
      <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {files.length ? (
          <button className="btn btn-primary" onClick={() => onAnalyze(files)}>
            Use {files.length === 1 ? "this drawing" : `these ${files.length} drawings`} and continue
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onSkip}>
            Skip — go to the eye test
          </button>
        )}
        {files.length ? (
          <button className="link text-ink-soft" onClick={onSkip}>
            Skip instead
          </button>
        ) : null}
      </div>
    </>
  );
}
