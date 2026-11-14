"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Clock, ImageUp, RefreshCw } from "lucide-react";
import type { StoredTask, StoredTaskSet } from "@/lib/content";
import { useLessonContent } from "@/lib/client/use-content";
import { prepareImage } from "@/lib/client/resize";
import { SAMPLES } from "@/lib/samples";
import { SKILL_LABELS, isSkill } from "@/lib/skills";
import { InkLoader } from "../ink-loader";
import { ErrorState } from "../states";
import { Timer } from "./timer";

type Step = "pick" | "task" | "submit" | "critiquing";

const CRITIQUE_MESSAGES = [
  "Looking closely at your drawing…",
  "Checking it against the rubric…",
  "Finding what's already working…",
  "Choosing the one thing that matters most…",
];

export function PracticeFlow({
  subtopicId,
  initialTaskId,
  critiquesLeft,
}: {
  subtopicId: string;
  initialTaskId: string | null;
  critiquesLeft: number | null;
}) {
  const { state, retry } = useLessonContent<StoredTaskSet>("tasks", subtopicId);
  const [taskId, setTaskId] = useState<string | null>(initialTaskId);
  const [step, setStep] = useState<Step>(initialTaskId ? "task" : "pick");
  const [error, setError] = useState<{ message: string; paywall?: boolean } | null>(null);
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, taskId]);

  if (state.status === "loading" || state.status === "generating") {
    return (
      <InkLoader
        className="py-24"
        messages={
          state.status === "loading"
            ? ["Fetching your exercises…"]
            : ["Designing a few short exercises…", "Writing a rubric you can see up front…"]
        }
      />
    );
  }
  if (state.status === "failed") {
    return (
      <ErrorState
        title="Practice isn't ready"
        message={state.message}
        action={
          <button className="btn btn-primary" onClick={retry}>
            Try again
          </button>
        }
      />
    );
  }

  const tasks = state.content.tasks;
  const task = tasks.find((t) => t.id === taskId) ?? null;

  const submit = async (body: FormData | { sampleId: string }) => {
    if (!task) return;
    setStep("critiquing");
    setError(null);
    try {
      const isSample = !(body instanceof FormData);
      if (!isSample) {
        body.set("subtopicId", subtopicId);
        body.set("taskId", task.id);
      }
      const res = await fetch(isSample ? "/api/submissions/sample" : "/api/submissions", {
        method: "POST",
        ...(isSample
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...body, subtopicId, taskId: task.id }),
            }
          : { body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError({ message: data?.error?.message ?? "The critique didn't go through.", paywall: res.status === 402 });
        setStep("submit");
        return;
      }
      router.push(`/critique/${data.id}`);
    } catch {
      setError({ message: "You seem to be offline. Your photo is still here — try again when connected." });
      setStep("submit");
    }
  };

  if (step === "critiquing") return <InkLoader className="py-24" messages={CRITIQUE_MESSAGES} />;

  if (step === "pick" || !task) {
    return (
      <section className="animate-fade-up">
        <p className="eyebrow">Practice</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-4xl leading-tight outline-none sm:text-5xl">
          Pick an exercise
        </h1>
        <p className="mt-4 text-lg text-ink-soft">Start with the warm-up if you have time. Each one ends with a photo and a critique.</p>
        <ol className="mt-8 grid gap-3">
          {tasks.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setTaskId(t.id);
                  setStep("task");
                }}
                className="sheet flex w-full items-center gap-5 p-5 text-left transition-colors hover:border-rule-strong sm:p-6"
              >
                <span className="font-display text-3xl text-accent tabular-nums">{i + 1}</span>
                <span className="flex-1">
                  <span className="block text-lg font-semibold">{t.title}</span>
                  <span className="mt-1 block text-ink-soft">{t.focus.join(" · ")}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                  <Clock size={15} aria-hidden="true" /> {t.timeboxMinutes} min
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (step === "task") {
    return (
      <TaskView
        task={task}
        headingRef={headingRef}
        onBack={tasks.length > 1 ? () => setStep("pick") : undefined}
        onReady={() => setStep("submit")}
      />
    );
  }

  return (
    <SubmitView
      task={task}
      headingRef={headingRef}
      critiquesLeft={critiquesLeft}
      error={error}
      onBack={() => setStep("task")}
      onUpload={(form) => void submit(form)}
      onSample={(sampleId) => void submit({ sampleId })}
    />
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function TaskView({
  task,
  headingRef,
  onBack,
  onReady,
}: {
  task: StoredTask;
  headingRef: HeadingRef;
  onBack?: () => void;
  onReady: () => void;
}) {
  return (
    <section className="animate-fade-up">
      {onBack ? (
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> All exercises
        </button>
      ) : null}
      <p className="eyebrow">Step 1 of 3 · The task</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-4xl leading-tight outline-none sm:text-5xl">
        {task.title}
      </h1>
      <p className="mt-6 max-w-2xl text-xl leading-relaxed">{task.instruction}</p>

      <div className="mt-8">
        <Timer minutes={task.timeboxMinutes} />
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="eyebrow mb-3">Focus on</h2>
          <ul className="grid gap-2">
            {task.focus.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-3 h-px w-4 shrink-0 bg-accent" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="eyebrow mb-3">How it&apos;ll be reviewed</h2>
          <dl className="grid gap-4">
            {task.rubric.map((r) => (
              <div key={r.id} className="border-l-2 border-rule pl-4">
                <dt className="font-semibold">
                  {r.criterion}
                  {isSkill(r.skill) ? <span className="ml-2 text-sm font-normal text-ink-muted">{SKILL_LABELS[r.skill]}</span> : null}
                </dt>
                <dd className="mt-0.5 text-ink-soft">{r.lookFor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-12">
        <button className="btn btn-primary" onClick={onReady}>
          I&apos;ve drawn it — add my photo <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function SubmitView({
  task,
  headingRef,
  critiquesLeft,
  error,
  onBack,
  onUpload,
  onSample,
}: {
  task: StoredTask;
  headingRef: HeadingRef;
  critiquesLeft: number | null;
  error: { message: string; paywall?: boolean } | null;
  onBack: () => void;
  onUpload: (form: FormData) => void;
  onSample: (sampleId: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const outOfFree = critiquesLeft === 0;

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setBlob(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "We couldn't read that image.");
    } finally {
      setPreparing(false);
    }
  };

  const send = () => {
    if (!blob) return;
    const form = new FormData();
    form.append("image", blob, "drawing.jpg");
    onUpload(form);
  };

  return (
    <section className="animate-fade-up">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Back to the task
      </button>
      <p className="eyebrow">Step 2 of 3 · {task.title}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-4xl leading-tight outline-none sm:text-5xl">
        Show the coach your page
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink-soft">
        Lay the paper flat in soft daylight and fill the frame. A slightly skewed phone photo is fine.
      </p>

      {error || localError ? (
        <div className="mt-6 rounded-2xl bg-accent-wash px-5 py-4 text-accent-deep" role="alert">
          {error?.message ?? localError}
          {error?.paywall ? (
            <>
              {" "}
              <Link href="/upgrade?from=critique" className="link font-semibold">
                See Plus
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Take a photo of your drawing"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        aria-label="Upload a photo of your drawing"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {outOfFree ? (
        <div className="mt-8 rounded-2xl border border-rule bg-sheet p-6">
          <p className="font-semibold">You&apos;ve used your 3 free critiques.</p>
          <p className="mt-1 text-ink-soft">Plus includes unlimited critiques — or try the coach on a sample drawing below.</p>
          <Link href="/upgrade?from=critique" className="btn btn-primary mt-5">
            Unlock unlimited critiques
          </Link>
        </div>
      ) : preview ? (
        <div className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview of your drawing"
            className="max-h-[70vh] w-full rounded-2xl border border-rule bg-sheet object-contain"
          />
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button className="btn btn-primary" onClick={send}>
              Get my critique <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              className="inline-flex items-center gap-2 font-medium text-ink-soft hover:text-ink"
              onClick={() => {
                setBlob(null);
                setPreview(null);
              }}
            >
              <RefreshCw size={16} aria-hidden="true" /> Use a different photo
            </button>
          </div>
          {critiquesLeft !== null ? (
            <p className="mt-3 text-sm text-ink-muted">
              Uses 1 of your {critiquesLeft} remaining free critique{critiquesLeft === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={preparing}
            className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl bg-ink px-6 py-8 text-sheet hover:bg-ink-soft"
          >
            <Camera size={28} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-lg font-semibold">{preparing ? "Preparing…" : "Take a photo"}</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={preparing}
            className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-rule-strong px-6 py-8 text-ink-soft hover:border-ink-muted hover:text-ink"
          >
            <ImageUp size={28} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-lg font-semibold">Upload an image</span>
          </button>
          {critiquesLeft !== null ? (
            <p className="text-sm text-ink-muted sm:col-span-2">
              {critiquesLeft} of 3 free critiques left.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-12 border-t border-rule pt-6">
        <button
          type="button"
          className="link font-medium text-ink-soft"
          aria-expanded={showSamples}
          onClick={() => setShowSamples(!showSamples)}
        >
          No drawing handy? Try with a sample drawing
        </button>
        {showSamples ? (
          <div className="animate-fade-up mt-5">
            <p className="mb-4 text-sm text-ink-muted">
              See how a critique works on one of our sample sketches. Doesn&apos;t use a free critique.
            </p>
            <ul className="grid grid-cols-3 gap-3">
              {SAMPLES.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSample(s.id)}
                    className="group block w-full overflow-hidden rounded-xl border border-rule bg-sheet text-left hover:border-ink-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/samples/${s.file}`} alt={s.alt} className="aspect-[4/3] w-full object-cover" />
                    <span className="block px-3 py-2 text-sm font-medium">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
