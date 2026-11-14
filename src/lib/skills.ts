export const SKILLS = [
  "perspective",
  "proportion",
  "value",
  "color",
  "linework",
  "composition",
] as const;

export type Skill = (typeof SKILLS)[number];
export type SkillScores = Record<Skill, number>;

export const SKILL_LABELS: Record<Skill, string> = {
  perspective: "Perspective",
  proportion: "Proportion",
  value: "Value & light",
  color: "Color",
  linework: "Linework",
  composition: "Composition",
};

export const SKILL_BLURBS: Record<Skill, string> = {
  perspective: "Placing forms convincingly in 3D space",
  proportion: "Measuring sizes and angles by eye",
  value: "Light, shadow and contrast",
  color: "Hue, temperature and harmony",
  linework: "Confident, expressive marks",
  composition: "Arranging the page so the eye knows where to go",
};

export const SPECIALIZATIONS = [
  "nature",
  "portraits",
  "urban",
  "ink",
  "watercolor",
  "manga",
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

export const SPECIALIZATION_INFO: Record<
  Specialization,
  { label: string; kind: "subject" | "style"; blurb: string }
> = {
  nature: {
    label: "Nature & landscapes",
    kind: "subject",
    blurb: "Trees, skies, water and the light that ties them together.",
  },
  portraits: {
    label: "People & portraits",
    kind: "subject",
    blurb: "Heads, faces, hands and figures that feel alive.",
  },
  urban: {
    label: "Urban & backgrounds",
    kind: "subject",
    blurb: "Streets, buildings and believable spaces.",
  },
  ink: {
    label: "Ink & line art",
    kind: "style",
    blurb: "Pen, brush pen and hatching — bold marks, no erasing.",
  },
  watercolor: {
    label: "Watercolor",
    kind: "style",
    blurb: "Washes, glazes and luminous, loose color.",
  },
  manga: {
    label: "Anime & manga-inspired",
    kind: "style",
    blurb: "Characters, expressions and dynamic staging.",
  },
};

export function isSpecialization(v: unknown): v is Specialization {
  return typeof v === "string" && (SPECIALIZATIONS as readonly string[]).includes(v);
}

export function isSkill(v: unknown): v is Skill {
  return typeof v === "string" && (SKILLS as readonly string[]).includes(v);
}

export type LevelBand = "beginner" | "intermediate";

/** Level band for a subtopic's skill, given a profile. Used as part of the shared content cache key. */
export function bandFor(scores: SkillScores, skill: Skill): LevelBand {
  return (scores[skill] ?? 1) < 3 ? "beginner" : "intermediate";
}

export function clampScore(n: number): number {
  return Math.round(Math.min(5, Math.max(1, n)) * 10) / 10;
}
