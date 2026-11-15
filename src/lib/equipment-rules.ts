import type { EquipmentId } from "./skills";

/**
 * Which lessons need which tools. A lesson's practice can't be done without them, so:
 * - new plans leave these lessons out for learners who don't have the tools;
 * - in an existing plan they show as locked ("Needs watercolor paints") until the
 *   learner adds the tool in Progress → Your tools.
 * Learners who never told us their tools (equipment = null) see everything.
 */
export type ToolNeed = "color" | "watercolor" | "brush";

const NEEDS: Record<string, ToolNeed> = {
  // color practice needs something that makes color
  "color-wheel": "color",
  "color-value": "color",
  "color-temp": "color",
  "color-harmony": "color",
  saturation: "color",
  "limited-palette": "color",
  "color-mood": "color",
  // watercolor-specific techniques
  "wc-washes": "watercolor",
  "wc-wet": "watercolor",
  "wc-lifting-masking": "watercolor",
  glazing: "watercolor",
  // brush handling
  "brush-economy": "brush",
  "dry-brush": "brush",
};

const PROVIDED_BY: Record<ToolNeed, EquipmentId[]> = {
  color: ["colored-pencils", "markers", "charcoal-pastel", "watercolor", "gouache-acrylic", "oil", "graphic-tablet", "stylus-tablet"],
  watercolor: ["watercolor"],
  brush: ["ink", "watercolor", "gouache-acrylic", "oil", "graphic-tablet", "stylus-tablet"],
};

export const TOOL_NEED_LABEL: Record<ToolNeed, string> = {
  color: "a color medium",
  watercolor: "watercolor paints",
  brush: "a brush, brush pen or drawing tablet",
};

export const TOOL_NEED_DETAIL: Record<ToolNeed, string> = {
  color: "colored pencils, markers, pastels, any paint, or a drawing tablet",
  watercolor: "watercolor paints",
  brush: "a brush, a brush pen, paint, or a drawing tablet",
};

export function toolNeedFor(subtopicId: string): ToolNeed | null {
  return NEEDS[subtopicId] ?? null;
}

/** True when the learner has what this lesson needs (or hasn't told us their tools). */
export function hasToolsFor(equipment: readonly string[] | null | undefined, subtopicId: string): boolean {
  const need = toolNeedFor(subtopicId);
  if (!need || equipment == null) return true;
  return PROVIDED_BY[need].some((e) => equipment.includes(e));
}
