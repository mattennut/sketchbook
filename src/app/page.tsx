import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PRICE_LABEL, FREE_CRITIQUES } from "@/lib/access";
import { HeroSamples } from "@/components/hero-samples";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { currentWeek, getActivePlan } from "@/lib/plan";
import { getProgressSets } from "@/lib/progress";
import { SPECIALIZATION_INFO, isSpecialization } from "@/lib/skills";

const STEPS = [
  {
    title: "Take a five-minute eye test",
    body: "Spot-the-difference perspective, proportion, value and color checks — drawn in your browser, no drawing required.",
  },
  {
    title: "Get a 12-week plan in your direction",
    body: "Landscapes, portraits, urban scenes, ink, watercolor or manga. Chosen and ordered from a 67-lesson curriculum around your weakest skills.",
  },
  {
    title: "Draw on paper. Snap a photo. Get one clear fix.",
    body: "Short lessons, a timed exercise with the rubric up front, then calm, specific feedback on your actual page.",
  },
];

/** Returning guests (a plan already exists for this browser) get "Go to my course" instead of the sign-up buttons. */
async function loadReturning(): Promise<{ week: number; specialization: string } | null> {
  try {
    const session = await getSession();
    if (!session) return null;
    const db = await getDb();
    const plan = await getActivePlan(db, session.id);
    if (!plan) return null;
    const { practiced } = await getProgressSets(db, session.id);
    return {
      week: currentWeek(plan, practiced),
      specialization: isSpecialization(plan.specialization) ? SPECIALIZATION_INFO[plan.specialization].label : "",
    };
  } catch {
    return null; // never block the landing page on the database
  }
}

export default async function Home() {
  const returning = await loadReturning();
  return (
    <>
      {/* Hero over Gainsborough's "Cornard Wood" (1748, public domain), washed with paper tone for legibility. */}
      <section className="relative isolate -mt-[5.5rem] overflow-hidden pt-[5.5rem]">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <picture>
            <source media="(max-width: 767px)" srcSet="/landing/cornard-wood-1200.webp" />
            <img
              src="/landing/cornard-wood-2400.webp"
              alt=""
              className="h-full w-full object-cover object-[50%_35%]"
              fetchPriority="high"
            />
          </picture>
          <div className="hero-wash absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-paper" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
          <div className="animate-fade-up">
            <h1 className="text-5xl leading-[1.03] sm:text-7xl">Learn to draw, one honest page at a time.</h1>
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink-soft">
              A drawing coach for grown-ups with day jobs: a plan built around your eye, ten-minute lessons, and feedback
              on photos of your real sketchbook pages.
            </p>
            {returning ? (
              <>
                <div className="mt-10">
                  <Link href="/plan" className="btn btn-primary px-7 text-lg">
                    Go to my course <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-4 text-sm text-ink-soft">
                  Welcome back — you&apos;re in week {returning.week} of 12
                  {returning.specialization ? ` · ${returning.specialization}` : ""}.
                </p>
              </>
            ) : (
              <>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <Link href="/assessment" className="btn btn-primary px-7 text-lg">
                    Start free assessment <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link
                    href="/assessment?mode=default"
                    className="btn btn-secondary bg-sheet/70 px-6 text-lg backdrop-blur-[2px]"
                  >
                    Take the default course
                  </Link>
                </div>
                <p className="mt-4 text-sm text-ink-soft">
                  Assessment: about 5 minutes · Default course: start in under a minute · No sign-up
                </p>
              </>
            )}
          </div>

          <HeroSamples />
        </div>

        <p className="mx-auto max-w-6xl px-4 pb-4 text-right text-xs text-ink-muted sm:px-8">
          Background: Thomas Gainsborough, <cite>Cornard Wood, near Sudbury, Suffolk</cite> (1748), National Gallery,
          London. Public domain.
        </p>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-8">

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
            {returning ? (
              <Link href="/plan" className="btn btn-primary text-lg">
                Go to my course <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/assessment" className="btn btn-primary text-lg">
                Start free assessment <ArrowRight size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
