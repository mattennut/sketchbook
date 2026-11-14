# Sketchbook — build plan

A calm AI drawing coach for adults (25–45) learning to draw/paint as a hobby.
No login: every visitor gets an anonymous guest session (random UUID in an
httpOnly cookie, all data server-side).

## Stack (and the two deliberate deviations)

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4.
- Postgres via **Drizzle** (`postgres.js` driver) — Neon or Supabase in production.
  - Deviation 1: when `DATABASE_URL` is empty the app falls back to **PGlite**
    (embedded Postgres in WASM, stored in `.data/`). Same schema, same SQL, zero
    setup for local runs and for reviewers cloning the repo.
- Object storage: **Vercel Blob** (private access) in production.
  - Deviation 2: local filesystem (`.data/uploads`) when no Blob token is set.
- OpenAI API through server routes only (`OPENAI_MODEL`, default `gpt-5.4-mini`),
  structured outputs + zod validation, one retry with the validation errors.
- Stripe Checkout (test mode), subscription $12/month, webhook marks the guest paid.
- Vercel deploy; `vercel-build` runs migrations + catalog seed before `next build`.

## Data model

| table | purpose |
| --- | --- |
| `guest_sessions` | id (cookie UUID), specialization, is_paid, stripe ids, free_critiques_used |
| `assessments` | raw answers, portfolio estimate, computed profile |
| `skill_snapshots` | skill profile over time (`source`: assessment / critique) |
| `topics`, `subtopics` | fixed seeded curriculum: stable `id`, skill, difficulty 1–5, prerequisites, tracks |
| `plans` | 12-week plan (weeks JSON: theme, rationale, ordered subtopic ids), `source` ai/fallback |
| `generated_content` | shared cache: `(kind, subtopic_id, level_band, variant)` UNIQUE, `status` generating/ready/failed. Kinds: `deck`, `tasks`, `sample_critique` |
| `submissions` | photo/upload or sample, task id, critique JSON, overall score |
| `subtopic_progress` | lesson finished / practiced per guest |
| `ai_calls` | every model call: per-session hourly limits + global daily cap |

## API routes

- `POST /api/assessment` — score perception tests + MCQs (+ portfolio estimate) → profile
- `POST /api/portfolio` — 1–3 images → AI per-skill estimate
- `POST /api/plan` — select + order catalog subtopics into 12 weeks (AI, validated; deterministic fallback)
- `POST /api/specialization` — change track (rebuilds plan)
- `GET|POST /api/content/[kind]/[subtopicId]` — deck/tasks: return cached, or claim + generate in `after()`; clients poll
- `POST /api/submissions` — upload drawing → AI critique against the task rubric
- `POST /api/submissions/sample` — critique a bundled sample drawing (shared cache)
- `GET /api/images/[submissionId]` — owner-only image proxy
- `POST /api/progress/lesson` — mark deck finished
- `POST /api/checkout`, `POST /api/stripe/webhook`

## Pages

`/` landing → `/assessment` → `/plan` → `/lesson/[id]` (mini-deck) → `/practice/[id]`
(task → submit) → `/critique/[submissionId]` → `/progress`; `/upgrade` (+ `/upgrade/success`).

## AI tasks (all in `src/lib/ai/prompts.ts`)

| task | input | output (zod) |
| --- | --- | --- |
| portfolio | 1–3 images, specialization | per-skill `{score 1–5 \| null, note}` + summary |
| plan | profile, specialization, eligible catalog | `{overview, weeks[12]{week, theme, rationale, subtopicIds[3–4]}}` — ids must exist, prerequisites first, week 1 from starter set |
| deck | subtopic, level band | `{slides[5–8]}` of `title / concept / steps / do_dont / diagram / exercise_preview`; diagram SVG sanitised with an allowlist |
| tasks | subtopic, level band | `{tasks[2–3]{title, instruction, timeboxMinutes, focus[], rubric[3–4]{id, criterion, skill, lookFor}}}` |
| critique | image, task + rubric | `{isDrawing, scores[]{criterionId, score 1–5, comment}, strengths[2], mostImportantFix, drill, summary}` |

## Milestones

M1 session + specialization + perception tests + profile → M2 catalog + plan →
M3 cached decks → M4 practice + critique → M5 Stripe + progress + polish.
