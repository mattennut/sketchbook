import "server-only";
import { getDb } from "./db";
import { getSession } from "./session";
import { getActivePlan } from "./plan";
import { catalogById, loadCatalog } from "./catalog";
import { bandFor, type LevelBand, type Skill } from "./skills";
import type { Plan } from "./db/schema";

/** Everything a signed-in-by-cookie page usually needs, in one call. */
export async function loadGuestContext() {
  const session = await getSession();
  const db = await getDb();
  const plan = session ? await getActivePlan(db, session.id) : null;
  const catalog = await loadCatalog(db);
  return { db, session, plan, catalog, byId: catalogById(catalog) };
}

/** Level band is fixed per plan (from the profile it was built with) so lesson and practice always match. */
export function bandForPlan(plan: Plan, skill: Skill): LevelBand {
  return bandFor(plan.profile, skill);
}
