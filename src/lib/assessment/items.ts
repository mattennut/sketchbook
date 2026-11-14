import type { Skill } from "../skills";

/**
 * Assessment items shown to the client. The answer key lives server-side in
 * `scoring.ts`; perception figures are drawn programmatically in
 * `components/assessment/figures.tsx` (no external image assets).
 */
export type PerceptionItem = {
  id: string;
  kind: "ab";
  skill: Skill;
  prompt: string;
  hint: string;
  variants: [string, string];
};

export type McqItem = {
  id: string;
  kind: "mcq";
  skill: Skill;
  prompt: string;
  options: { id: string; label: string }[];
};

export type ExperienceOption = { id: string; label: string; detail: string };

export const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  { id: "new", label: "Just starting", detail: "I rarely draw, or haven't since school." },
  { id: "doodle", label: "Occasional doodler", detail: "Margins of notebooks, the odd sketch." },
  { id: "class", label: "Some learning", detail: "I've taken a class or followed tutorials." },
  { id: "weekly", label: "Regular practice", detail: "I draw or paint most weeks." },
  { id: "trained", label: "Studied seriously", detail: "Art school, ateliers or years of study." },
];

export const PERCEPTION_ITEMS: PerceptionItem[] = [
  {
    id: "persp-box",
    kind: "ab",
    skill: "perspective",
    prompt: "Which box sits correctly in two-point perspective?",
    hint: "Both boxes share the same eye level (the dashed line).",
    variants: ["a", "b"],
  },
  {
    id: "ellipse",
    kind: "ab",
    skill: "perspective",
    prompt: "We're looking down at a glass on a table. Which one is drawn correctly?",
    hint: "Compare how open the top and bottom ellipses are.",
    variants: ["a", "b"],
  },
  {
    id: "face",
    kind: "ab",
    skill: "proportion",
    prompt: "Which face has more natural adult proportions?",
    hint: "Look at where the eyes sit on the head.",
    variants: ["a", "b"],
  },
  {
    id: "sphere",
    kind: "ab",
    skill: "value",
    prompt: "Light comes from the upper left. Which sphere is lit consistently?",
    hint: "Follow the light to the shadow.",
    variants: ["a", "b"],
  },
  {
    id: "color-value",
    kind: "ab",
    skill: "color",
    prompt: "In which pair is the color the same value (lightness) as the gray?",
    hint: "Squint: a matching pair almost blends together.",
    variants: ["a", "b"],
  },
  {
    id: "color-temp",
    kind: "ab",
    skill: "color",
    prompt: "Warm late-afternoon sun hits this block. Which shadows look more natural?",
    hint: "Light and shadow usually lean opposite ways in temperature.",
    variants: ["a", "b"],
  },
  {
    id: "focal",
    kind: "ab",
    skill: "composition",
    prompt: "Which thumbnail gives the eye one clear place to land?",
    hint: "Think about contrast and placement.",
    variants: ["a", "b"],
  },
];

export const MCQ_ITEMS: McqItem[] = [
  {
    id: "mcq-horizon",
    kind: "mcq",
    skill: "perspective",
    prompt: "In a worm's-eye view (looking up from the ground), where does the horizon line usually sit?",
    options: [
      { id: "high", label: "High in the picture, above the subject" },
      { id: "middle", label: "Exactly in the middle" },
      { id: "low", label: "Low — near or below the bottom edge" },
      { id: "none", label: "Worm's-eye views have no horizon" },
    ],
  },
  {
    id: "mcq-core",
    kind: "mcq",
    skill: "value",
    prompt: "On a sphere lit from one side, where is the core shadow?",
    options: [
      { id: "direct", label: "Where the light hits most directly" },
      { id: "terminator", label: "Just past the edge where the form turns away from the light" },
      { id: "ground", label: "On the ground beside the sphere" },
      { id: "rim", label: "Along the outer rim of the shadow side" },
    ],
  },
  {
    id: "mcq-complement",
    kind: "mcq",
    skill: "color",
    prompt: "Which pair of colors is complementary?",
    options: [
      { id: "blue-green", label: "Blue and green" },
      { id: "blue-orange", label: "Blue and orange" },
      { id: "red-pink", label: "Red and pink" },
      { id: "yellow-orange", label: "Yellow and orange" },
    ],
  },
];

export const UNSURE = "unsure";
