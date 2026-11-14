# Sketchbook — a calm AI drawing coach

**Live demo:** _add your Vercel URL here_ · no sign-up, works on phone and desktop

Sketchbook helps adults who want to learn drawing or painting as a hobby actually improve. It
tests your eye in five minutes, builds a 12-week plan in the direction you care about (landscapes,
portraits, urban scenes, ink, watercolor, manga-inspired), teaches each topic in a short mini-deck,
and then critiques **photos of your real paper drawings** against a clear rubric — one strength-led,
specific fix at a time.

## Who it's for, and the pain

US adults, 25–45, with jobs and a sketchbook they bought with good intentions. The problem is
not motivation and not a lack of tutorials — YouTube has thousands. The problem is that:

- **Nobody tells them what's wrong with _their_ drawing.** Tutorials show how someone else draws.
  Classes and private teachers ($40–80/hour) are the only feedback, and they don't fit an evening schedule.
- **There's no path.** Hobbyists bounce between random videos, practice what's fun rather than what's weak,
  and plateau.
- **Feedback online is noisy or harsh.** Posting work publicly for critique is intimidating for beginners.

Sketchbook is a private teacher in your pocket: a path chosen for your weak spots, and calm,
specific feedback on every page — for $12/month.

## Try it (jury path, ~3 minutes)

1. Open the site → **Start free assessment** (no account; an anonymous guest session is created).
2. Pick a specialization, answer 7 "which looks correct?" perception tests (drawn in SVG in your browser)
   and 3 theory questions. Optional: upload up to 3 past drawings for an AI level estimate.
3. **Build my 12-week plan** — The AI (OpenAI) selects and orders lessons from a fixed 67-subtopic catalog.
4. Open a week-1 lesson (a swipeable mini-deck; ← → keys on desktop), then **Start practice**.
5. On the submit step use **Try with a sample drawing** to see a full critique without drawing anything,
   or photograph your own page (mobile opens the camera).
6. Hit a locked week (or **Demo: unlock paid** in the footer) to see the paywall → Stripe test checkout with
   card `4242 4242 4242 4242`, any future date, any CVC. The webhook flips the guest to Plus.

## How it works

```
Landing → Assessment → Skill profile → 12-week plan → Lesson deck → Practice task → Photo → Critique → Progress
```

| Piece | Design decision |
| --- | --- |
| **Guest sessions** | `src/proxy.ts` sets a random UUID in an httpOnly cookie on first visit. All data lives server-side keyed by it. No PII. |
| **Perception tests** | Generated programmatically (`components/assessment/figures.tsx`): boxes with consistent vs. broken vanishing points, ellipses in a glass, face proportions, sphere lighting, color value, color temperature, focal point. Answer key is server-side. |
| **Skill profile** | Six skills on 1–5 (`perspective, proportion, value, color, linework, composition`), blending self-reported experience, test results and (optionally) a vision-model portfolio estimate. |
| **Curriculum catalog** | Fixed and seeded (`lib/catalog/data.ts` → `subtopics` table): stable ids, skill trained, difficulty, prerequisites, tracks. The AI **never invents subtopics** — it selects and orders. Output is validated against the catalog (unknown ids, duplicates, prerequisite order, week-1 starter rule) and retried once with the exact problems; if it still fails, a deterministic planner takes over so the user always gets a plan. |
| **Mini-decks** | 5–8 typed slides (`title, concept, steps, do_dont, diagram, exercise_preview`) rendered as React components. The model-drawn diagram SVG is sanitized with a strict allowlist before it is cached. |
| **Shared content cache** | Decks and practice tasks are generated **once per `subtopic_id + level_band`** and reused by everyone. A unique index plus `status: generating / ready / failed` makes generation single-flight under concurrency; other requests poll. Stale or failed rows can be re-claimed atomically. |
| **Critique** | Vision call with the task rubric → strict JSON: per-criterion 1–5 scores, 2 strengths, the single most important fix, a drill. Shown calmly with the drawing as the hero. Each critique nudges the skill profile (gentle moving average) and is stored for the progress view. |
| **Cost control** | Per-guest hourly limits per AI endpoint, a global daily cap (`AI_DAILY_CAP`), and cached shared content. Every call is logged in `ai_calls`. |
| **Privacy** | Drawings are stored in **private** Vercel Blob storage and served only through an owner-checked route. Portfolio images are analyzed and discarded. |

All prompts and output schemas are in one file: [`src/lib/ai/prompts.ts`](src/lib/ai/prompts.ts).
The call wrapper (strict structured outputs, zod validation, one retry with feedback, refusal handling) is
[`src/lib/ai/client.ts`](src/lib/ai/client.ts). The plan is in [`docs/PLAN.md`](docs/PLAN.md).

### Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM on Postgres (Neon or Supabase) ·
Vercel Blob · OpenAI API (`openai` SDK, Chat Completions with strict JSON-schema outputs, model via `OPENAI_MODEL`) · Stripe Checkout (test mode) · Vercel.

## Run locally

Requires Node 22.9+.

```bash
npm install
cp .env.example .env.local   # then add OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000.

**Zero-config mode:** with `DATABASE_URL` empty the app uses an embedded Postgres
([PGlite](https://pglite.dev)) stored in `./.data/`, migrates and seeds it on boot, and saves uploads to
`./.data/uploads`. Without `OPENAI_API_KEY` the assessment and the (deterministic) plan still work, and lessons
show a friendly "AI not configured" state. Set `DEMO_INSTANT_UNLOCK=true` to test the paid tier without Stripe.

Pre-generate the week-1 lessons (decks + practice tasks for every starter subtopic, both level bands):

```bash
npm run seed:content
```

With PGlite, stop `npm run dev` first (PGlite allows one process at a time).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | prod | OpenAI API key |
| `OPENAI_MODEL` | no | Model for all AI calls (default `gpt-5.5`; must support vision + structured outputs) |
| `AI_DAILY_CAP` | no | Max model calls per UTC day across all users (default 400) |
| `DATABASE_URL` | prod | Postgres connection string (Neon pooled URL, or Supabase transaction pooler on :6543) |
| `BLOB_READ_WRITE_TOKEN` | prod | Vercel Blob token (private store for drawings) |
| `STRIPE_SECRET_KEY` | prod | Stripe **test** secret key (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | prod | Signing secret of the webhook endpoint (`whsec_…`) |
| `STRIPE_PRICE_ID` | no | Use an existing recurring price instead of the inline $12/month price |
| `APP_URL` | no | Absolute base URL for Stripe redirects (defaults to the request origin) |
| `DEMO_INSTANT_UNLOCK` | no | Local only: unlock Plus without Stripe. Never set in production |

## Deploy (Vercel)

1. Push this repo to GitHub and **import it in Vercel** (framework preset: Next.js).
2. **Database:** Vercel → Storage → add **Neon** (or paste a Supabase pooler URL) so `DATABASE_URL` is set.
3. **Images:** Vercel → Storage → create a **Blob** store and connect it, which sets `BLOB_READ_WRITE_TOKEN`.
4. Add `OPENAI_API_KEY`, `STRIPE_SECRET_KEY` (test mode) and `AI_DAILY_CAP` in Project → Settings → Environment Variables.
5. Deploy. The `vercel-build` script runs `db:migrate` and `db:seed` (catalog) before `next build`.
6. **Stripe webhook:** Stripe Dashboard (test mode) → Developers → Webhooks → add endpoint
   `https://<your-domain>/api/stripe/webhook` with events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
7. **Pre-generate week-1 content** against the production database from your machine:
   `DATABASE_URL=… OPENAI_API_KEY=… npm run seed:content` (or put both in `.env.local`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | Generate a SQL migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:seed` | Upsert the curriculum catalog (validated: unknown prerequisites fail the deploy) |
| `npm run seed:content` | Pre-generate week-1 decks and practice tasks |
| `npm run samples` | Regenerate the bundled sample drawings in `public/samples/` |
| `npm run typecheck` / `lint` | Checks |

## Project structure

```
src/
  proxy.ts                      guest-session cookie
  app/                          pages + API routes (see docs/PLAN.md)
  components/                   assessment, deck, practice, progress, shared UI
  lib/
    ai/prompts.ts               every prompt + zod schema
    ai/client.ts                structured call, validation, retry, refusals
    ai/budget.ts                rate limits + daily cap
    catalog/                    fixed curriculum (data + loaders)
    content.ts                  shared deck/task cache, single-flight generation
    plan.ts                     plan generation, validation, deterministic fallback
    critique.ts                 critique call + validation
    db/                         Drizzle schema, Postgres/PGlite client, catalog seed
scripts/                        migrate, seed catalog, seed content, make samples
drizzle/                        SQL migrations
```

## Monetization

| | Free | Plus — $12/month |
| --- | --- | --- |
| Assessment + full 12-week plan preview | ✓ | ✓ |
| Lessons and practice | Week 1 | All 12 weeks |
| AI critiques | 3 | Unlimited (rate limited) |
| Rebuild plan from your latest skills | – | ✓ |

The paywall appears where a free user naturally hits it: a locked week, the 4th critique, or "rebuild plan".
Failed or non-drawing critiques don't consume a free critique.

## What's next

- Optional "save your progress with email" (magic link) to move a guest session across devices.
- Side-by-side "then vs. now" comparisons of the same exercise.
- Weekly reminder emails and streaks tuned for a calm, non-gamified tone.
