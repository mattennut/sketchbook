import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PRICE_LABEL, FREE_CRITIQUES } from "@/lib/access";

const STEPS = [
  {
    title: "Take a five-minute eye test",
    body: "Spot-the-difference perspective, proportion, value and color checks — drawn in your browser, no drawing required.",
  },
  {
    title: "Get a 12-week plan in your direction",
    body: "Landscapes, portraits, urban scenes, ink, watercolor or manga. Chosen and ordered from a 65-lesson curriculum around your weakest skills.",
  },
  {
    title: "Draw on paper. Snap a photo. Get one clear fix.",
    body: "Short lessons, a timed exercise with the rubric up front, then calm, specific feedback on your actual page.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <section className="grid items-center gap-12 pt-8 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="animate-fade-up">
          <h1 className="text-5xl leading-[1.03] sm:text-7xl">
            Learn to draw, one honest page at a time.
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink-soft">
            A drawing coach for grown-ups with day jobs: a plan built around your eye, ten-minute lessons, and feedback on
            photos of your real sketchbook pages.
          </p>
          <div className="mt-10 flex flex-col items-start gap-3">
            <Link href="/assessment" className="btn btn-primary px-7 text-lg">
              Start free assessment <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <span className="text-sm text-ink-muted">About 5 minutes · no sign-up · nothing to install</span>
          </div>
        </div>

        <figure className="mx-auto w-full max-w-xl">
          <div className="relative rotate-[0.6deg]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/samples/sample-stilllife.jpg"
              alt="A learner's pencil still life of a sphere and a cup, photographed on a table."
              className="block w-full rounded-xl shadow-[0_30px_60px_-30px_rgba(28,27,25,0.45)]"
            />
            {/* hand-drawn annotation around the cup's base */}
            <svg viewBox="0 0 1500 1125" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <ellipse
                cx="995"
                cy="732"
                rx="160"
                ry="52"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="7"
                strokeLinecap="round"
                transform="rotate(-3 995 732)"
                style={{ strokeDasharray: 750, ["--len" as string]: 750, animation: "draw-line 1.4s 0.5s var(--ease-calm) both" }}
              />
            </svg>
          </div>
          <figcaption className="sheet relative -mt-10 ml-auto mr-2 max-w-[19rem] rotate-[-1deg] p-5 sm:-mt-16 sm:mr-[-1.5rem]">
            <p className="eyebrow text-accent-deep">The one thing to work on</p>
            <p className="mt-2 font-display text-lg leading-snug">Open up the bottom of the cup.</p>
            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">
              It&apos;s further below your eye level than the rim, so its ellipse should be rounder — right now it&apos;s flatter.
            </p>
          </figcaption>
        </figure>
      </section>

      <section className="mt-28 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="how-h">
        <div>
          <h2 id="how-h" className="text-3xl leading-tight sm:text-4xl">
            Tutorials show you how they draw. This shows you what to fix in yours.
          </h2>
        </div>
        <ol className="grid gap-10">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4">
              <span className="font-display text-4xl leading-none text-accent">{i + 1}</span>
              <div>
                <h3 className="font-sans text-xl font-semibold tracking-normal">{s.title}</h3>
                <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-28 border-t border-rule pt-14" aria-labelledby="price-h">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 id="price-h" className="text-3xl sm:text-4xl">
              Start free. Stay if it helps.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
              Free includes the assessment, your full 12-week plan, every week-1 lesson and {FREE_CRITIQUES} critiques. Plus opens all
              twelve weeks and unlimited critiques for {PRICE_LABEL} — less than one hour with a private teacher.
            </p>
          </div>
          <div className="flex items-start sm:justify-end">
            <Link href="/assessment" className="btn btn-primary text-lg">
              Start free assessment <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
