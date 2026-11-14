/**
 * Pre-generates lesson decks + practice tasks for every week-1 "starter" subtopic,
 * in both level bands, so the first lessons a new visitor (or a jury) opens are instant.
 *
 *   npm run seed:content                 # all starters, both bands, decks + tasks
 *   npm run seed:content -- --band beginner --kind deck
 *
 * Needs OPENAI_API_KEY. With the embedded PGlite DB, stop `npm run dev` first
 * (PGlite allows one process at a time).
 */
import { getDb } from "../src/lib/db";
import { isStarter, loadCatalog, type CatalogEntry } from "../src/lib/catalog";
import { generateLessonContentNow } from "../src/lib/content";
import { aiConfigured } from "../src/lib/ai/client";
import { bandFor, type LevelBand } from "../src/lib/skills";
import { DEFAULT_PROFILE, DEFAULT_WEEK1 } from "../src/lib/plan";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (!aiConfigured()) {
    console.error("OPENAI_API_KEY is not set (add it to .env.local).");
    process.exit(1);
  }
  const db = await getDb();
  const catalog = await loadCatalog(db);
  // --default: only the fixed week 1 of the default course (what "skip the test" users open first).
  const onlyDefault = process.argv.includes("--default");
  const starters = onlyDefault
    ? catalog.filter((c) => DEFAULT_WEEK1.includes(c.id))
    : catalog.filter(isStarter);
  const bands = (
    onlyDefault
      ? [...new Set(starters.map((s) => bandFor(DEFAULT_PROFILE, s.skill)))]
      : arg("band")
        ? [arg("band")]
        : ["beginner", "intermediate"]
  ) as LevelBand[];
  const kinds = (arg("kind") ? [arg("kind")] : ["deck", "tasks"]) as ("deck" | "tasks")[];

  const jobs: { entry: CatalogEntry; band: LevelBand; kind: "deck" | "tasks" }[] = [];
  for (const entry of starters) for (const band of bands) for (const kind of kinds) jobs.push({ entry, band, kind });
  console.log(`Seeding ${jobs.length} items for ${starters.length} starter subtopics: ${starters.map((s) => s.id).join(", ")}`);

  let done = 0;
  let failed = 0;
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const label = `${job.kind}:${job.entry.id}:${job.band}`;
      const started = Date.now();
      try {
        const result = await generateLessonContentNow(db, job.kind, job.entry, job.band);
        done++;
        console.log(`  ✓ ${label} — ${result} (${((Date.now() - started) / 1000).toFixed(0)}s) [${done + failed}/${jobs.length}]`);
      } catch (err) {
        failed++;
        console.log(`  ✗ ${label} — ${err instanceof Error ? err.message : err}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(arg("concurrency") ?? 3) }, worker));
  console.log(`Done: ${done} ready, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
