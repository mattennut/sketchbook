import type { Skill, Specialization } from "../skills";

/**
 * The fixed curriculum catalog. The AI never invents subtopics — it only selects
 * and orders these ids. Ids are stable: never rename one that has shipped, because
 * cached decks, plans and submissions reference them.
 *
 * `tracks`: "core" = relevant to every specialization; otherwise the list of
 * specializations it belongs to.
 */
export type CatalogTopic = { id: string; title: string; description: string };

export type CatalogSubtopic = {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  skill: Skill;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  tracks: ("core" | Specialization)[];
};

export const TOPICS: CatalogTopic[] = [
  { id: "line", title: "Line & construction", description: "Confident marks and simple forms that hold a drawing together." },
  { id: "perspective", title: "Perspective & space", description: "Making flat paper feel deep." },
  { id: "value", title: "Value & light", description: "Seeing and drawing light and shadow." },
  { id: "color", title: "Color", description: "Hue, value, temperature and harmony." },
  { id: "paint", title: "Painting techniques", description: "Washes, layers and economical brushwork." },
  { id: "figure", title: "Anatomy & figure", description: "Heads, faces, hands and bodies." },
  { id: "subjects", title: "Subjects & rendering", description: "Applying fundamentals to real subjects." },
  { id: "composition", title: "Composition & design", description: "Arranging the page with intent." },
  { id: "practice", title: "Process & practice", description: "Habits that make every hour of drawing count." },
];

export const SUBTOPICS: CatalogSubtopic[] = [
  // Line & construction
  { id: "line-confidence", topicId: "line", title: "Confident lines", summary: "Ghosting, drawing from the shoulder and committing to smooth, deliberate strokes.", skill: "linework", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "contour-drawing", topicId: "line", title: "Contour & blind contour", summary: "Slow observational contours that train the hand to follow the eye.", skill: "linework", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "line-weight", topicId: "line", title: "Line weight that shows form", summary: "Thicker lines for shadow sides and overlaps, thinner for light and distance.", skill: "linework", difficulty: 2, prerequisites: ["line-confidence"], tracks: ["core"] },
  { id: "gesture", topicId: "line", title: "Gesture drawing", summary: "30–120 second drawings that capture movement and rhythm before detail.", skill: "linework", difficulty: 2, prerequisites: ["line-confidence"], tracks: ["core"] },
  { id: "basic-shapes", topicId: "line", title: "Seeing basic shapes", summary: "Breaking any subject into circles, rectangles and triangles before drawing it.", skill: "proportion", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "3d-primitives", topicId: "line", title: "3D primitives", summary: "Drawing spheres, cubes, cylinders and cones as solid forms.", skill: "perspective", difficulty: 2, prerequisites: ["basic-shapes"], tracks: ["core"] },
  { id: "drawing-through", topicId: "line", title: "Drawing through forms", summary: "Transparent construction: drawing the hidden back edges to check your structure.", skill: "perspective", difficulty: 3, prerequisites: ["3d-primitives"], tracks: ["core"] },
  { id: "measuring", topicId: "line", title: "Measuring proportions", summary: "Comparative measuring with a pencil and sight-size to get sizes right.", skill: "proportion", difficulty: 2, prerequisites: ["basic-shapes"], tracks: ["core"] },
  { id: "angles-plumb", topicId: "line", title: "Plumb lines & angles", summary: "Vertical and horizontal checks that catch drifting proportions early.", skill: "proportion", difficulty: 2, prerequisites: ["measuring"], tracks: ["core"] },
  { id: "negative-space", topicId: "line", title: "Negative space", summary: "Drawing the shapes between things to see proportions freshly.", skill: "proportion", difficulty: 2, prerequisites: [], tracks: ["core"] },
  { id: "silhouette", topicId: "line", title: "Silhouette readability", summary: "Making a subject recognizable from its outline alone.", skill: "composition", difficulty: 2, prerequisites: [], tracks: ["core"] },

  // Perspective & space
  { id: "persp-1pt", topicId: "perspective", title: "One-point perspective", summary: "Horizon line, a single vanishing point and boxes that recede straight back.", skill: "perspective", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "persp-2pt", topicId: "perspective", title: "Two-point perspective", summary: "Corners toward the viewer, two vanishing points on the horizon.", skill: "perspective", difficulty: 2, prerequisites: ["persp-1pt"], tracks: ["core"] },
  { id: "persp-3pt", topicId: "perspective", title: "Three-point perspective", summary: "Looking up or down: verticals that converge too.", skill: "perspective", difficulty: 4, prerequisites: ["persp-2pt"], tracks: ["urban", "manga"] },
  { id: "ellipses", topicId: "perspective", title: "Ellipses in perspective", summary: "Cups, wheels and tree trunks: ellipses that open up as they move away from eye level.", skill: "perspective", difficulty: 3, prerequisites: ["persp-1pt"], tracks: ["core"] },
  { id: "foreshortening", topicId: "perspective", title: "Foreshortening", summary: "Forms pointing toward the viewer: overlap, size change and compressed lengths.", skill: "perspective", difficulty: 4, prerequisites: ["3d-primitives"], tracks: ["portraits", "manga"] },
  { id: "atmospheric", topicId: "perspective", title: "Atmospheric perspective", summary: "Lighter, cooler, softer distance for instant depth.", skill: "value", difficulty: 2, prerequisites: [], tracks: ["nature", "watercolor", "urban"] },
  { id: "depth-cues", topicId: "perspective", title: "Overlap & depth cues", summary: "Overlap, size, placement and detail as quick ways to show depth.", skill: "composition", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "horizon-scale", topicId: "perspective", title: "Horizon line & scale", summary: "Placing people and objects at believable sizes using the horizon.", skill: "perspective", difficulty: 2, prerequisites: ["persp-1pt"], tracks: ["urban", "nature", "manga"] },

  // Value & light
  { id: "value-scale", topicId: "value", title: "Value scales", summary: "Building a 5-step scale from white to black and matching values by squinting.", skill: "value", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "hatching", topicId: "value", title: "Hatching & cross-hatching", summary: "Building tone from parallel and crossing lines.", skill: "value", difficulty: 2, prerequisites: ["line-confidence"], tracks: ["core"] },
  { id: "stippling", topicId: "value", title: "Stippling & texture marks", summary: "Dots and marks that build tone and texture in ink.", skill: "value", difficulty: 2, prerequisites: [], tracks: ["ink"] },
  { id: "light-anatomy", topicId: "value", title: "Light on form", summary: "Highlight, light side, terminator, core shadow and reflected light.", skill: "value", difficulty: 3, prerequisites: ["value-scale", "3d-primitives"], tracks: ["core"] },
  { id: "cast-shadows", topicId: "value", title: "Form vs. cast shadows", summary: "Telling attached shadows from cast shadows and placing them logically.", skill: "value", difficulty: 3, prerequisites: ["light-anatomy"], tracks: ["core"] },
  { id: "edge-control", topicId: "value", title: "Edge control", summary: "Hard, soft and lost edges to guide the eye and turn form.", skill: "value", difficulty: 4, prerequisites: ["light-anatomy"], tracks: ["portraits", "watercolor", "nature"] },
  { id: "notan", topicId: "value", title: "Notan: two-value design", summary: "Simplifying a scene into black and white shapes to test its design.", skill: "composition", difficulty: 2, prerequisites: ["value-scale"], tracks: ["core"] },
  { id: "high-low-key", topicId: "value", title: "High-key & low-key", summary: "Choosing an overall value range to set mood.", skill: "value", difficulty: 3, prerequisites: ["value-scale"], tracks: ["nature", "watercolor", "urban"] },
  { id: "chiaroscuro", topicId: "value", title: "Chiaroscuro", summary: "Strong single-source light and deep shadow for drama.", skill: "value", difficulty: 4, prerequisites: ["light-anatomy"], tracks: ["portraits"] },

  // Color
  { id: "color-wheel", topicId: "color", title: "Hue & the color wheel", summary: "Primaries, secondaries and how hues relate around the wheel.", skill: "color", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "color-value", topicId: "color", title: "Reading the value of a color", summary: "Seeing how light or dark a color is, independent of its hue.", skill: "color", difficulty: 2, prerequisites: ["value-scale", "color-wheel"], tracks: ["core"] },
  { id: "color-temp", topicId: "color", title: "Warm & cool temperature", summary: "Warm light, cool shadows and temperature shifts that suggest depth.", skill: "color", difficulty: 2, prerequisites: ["color-wheel"], tracks: ["core"] },
  { id: "color-harmony", topicId: "color", title: "Color harmonies", summary: "Complementary, analogous and triadic schemes, and when to use each.", skill: "color", difficulty: 3, prerequisites: ["color-wheel"], tracks: ["core"] },
  { id: "saturation", topicId: "color", title: "Saturation control", summary: "Muted versus intense color, and saving saturation for the focal point.", skill: "color", difficulty: 3, prerequisites: ["color-value"], tracks: ["watercolor", "nature", "portraits"] },
  { id: "limited-palette", topicId: "color", title: "Limited palettes", summary: "Painting with three or four pigments, such as the Zorn palette.", skill: "color", difficulty: 3, prerequisites: ["color-harmony"], tracks: ["portraits", "watercolor"] },
  { id: "color-mood", topicId: "color", title: "Mood & color grading", summary: "Shifting a whole scene's palette to tell a time of day or feeling.", skill: "color", difficulty: 4, prerequisites: ["color-temp", "color-harmony"], tracks: ["manga", "urban", "nature"] },

  // Painting techniques
  { id: "wc-washes", topicId: "paint", title: "Flat, graded & variegated washes", summary: "Controlling water and pigment for even and blended washes.", skill: "color", difficulty: 1, prerequisites: [], tracks: ["watercolor", "nature"] },
  { id: "wc-wet", topicId: "paint", title: "Wet-on-wet vs. wet-on-dry", summary: "Soft blooms or crisp edges — choosing by paper wetness.", skill: "color", difficulty: 2, prerequisites: ["wc-washes"], tracks: ["watercolor", "nature"] },
  { id: "wc-lifting-masking", topicId: "paint", title: "Lifting & masking", summary: "Saving and recovering whites with lifting, tape and masking fluid.", skill: "value", difficulty: 3, prerequisites: ["wc-wet"], tracks: ["watercolor"] },
  { id: "glazing", topicId: "paint", title: "Glazing", summary: "Transparent layers that deepen color and shadow.", skill: "color", difficulty: 3, prerequisites: ["wc-washes"], tracks: ["watercolor"] },
  { id: "brush-economy", topicId: "paint", title: "Brush economy", summary: "Fewer, smarter strokes: describing a form in one confident mark.", skill: "linework", difficulty: 3, prerequisites: ["line-weight"], tracks: ["ink", "watercolor", "manga"] },
  { id: "block-in", topicId: "paint", title: "Blocking in large masses", summary: "Big shapes first, details last.", skill: "composition", difficulty: 2, prerequisites: ["value-scale"], tracks: ["nature", "urban", "watercolor"] },
  { id: "dry-brush", topicId: "paint", title: "Dry brush texture", summary: "Broken, textured strokes for bark, grass and weathered surfaces.", skill: "linework", difficulty: 3, prerequisites: [], tracks: ["ink", "watercolor", "nature"] },

  // Anatomy & figure
  { id: "figure-proportions", topicId: "figure", title: "Figure proportions", summary: "The figure measured in head-heights and its key landmarks.", skill: "proportion", difficulty: 2, prerequisites: ["basic-shapes"], tracks: ["portraits", "manga"] },
  { id: "head-construction", topicId: "figure", title: "Head construction", summary: "The Loomis method: a ball, a jaw and guidelines that rotate.", skill: "proportion", difficulty: 3, prerequisites: ["3d-primitives"], tracks: ["portraits", "manga"] },
  { id: "facial-features", topicId: "figure", title: "Eyes, nose & mouth", summary: "Drawing features as forms that sit on the head, not symbols.", skill: "proportion", difficulty: 3, prerequisites: ["head-construction"], tracks: ["portraits", "manga"] },
  { id: "hands", topicId: "figure", title: "Hands", summary: "A box for the palm, cylinders for fingers, gesture first.", skill: "proportion", difficulty: 4, prerequisites: ["3d-primitives"], tracks: ["portraits", "manga"] },
  { id: "contrapposto", topicId: "figure", title: "Weight & balance", summary: "Contrapposto and the line of action for poses that stand.", skill: "proportion", difficulty: 3, prerequisites: ["gesture", "figure-proportions"], tracks: ["portraits", "manga"] },
  { id: "expressions", topicId: "figure", title: "Facial expressions", summary: "How brows, eyes and mouth combine to show emotion.", skill: "linework", difficulty: 3, prerequisites: ["facial-features"], tracks: ["portraits", "manga"] },
  { id: "hair", topicId: "figure", title: "Hair as shapes", summary: "Big masses and clumps, not individual strands.", skill: "value", difficulty: 3, prerequisites: ["head-construction"], tracks: ["portraits", "manga"] },
  { id: "drapery", topicId: "figure", title: "Drapery & folds", summary: "Pipe, zigzag and hanging folds driven by tension points.", skill: "value", difficulty: 4, prerequisites: ["gesture"], tracks: ["portraits", "manga"] },

  // Subjects & rendering
  { id: "still-life", topicId: "subjects", title: "Still life from observation", summary: "Arranging and drawing everyday objects from life.", skill: "value", difficulty: 2, prerequisites: ["basic-shapes"], tracks: ["core"] },
  { id: "trees-foliage", topicId: "subjects", title: "Trees & foliage", summary: "Trunk gesture, big leaf masses and light through the canopy.", skill: "linework", difficulty: 2, prerequisites: ["basic-shapes"], tracks: ["nature", "watercolor", "ink"] },
  { id: "skies-clouds", topicId: "subjects", title: "Skies & clouds", summary: "Clouds as lit 3D forms and skies that grade toward the horizon.", skill: "value", difficulty: 2, prerequisites: [], tracks: ["nature", "watercolor"] },
  { id: "water-reflections", topicId: "subjects", title: "Water & reflections", summary: "Reflections that mirror vertically and break up with ripples.", skill: "value", difficulty: 3, prerequisites: ["value-scale"], tracks: ["nature", "watercolor"] },
  { id: "architecture", topicId: "subjects", title: "Buildings & streets", summary: "Simplifying architecture into boxes, then adding windows, doors and wear.", skill: "perspective", difficulty: 3, prerequisites: ["persp-2pt"], tracks: ["urban", "ink", "manga"] },
  { id: "materials", topicId: "subjects", title: "Rendering materials", summary: "How metal, glass, skin and fur each handle light.", skill: "value", difficulty: 4, prerequisites: ["light-anatomy"], tracks: ["core"] },
  { id: "character-design", topicId: "subjects", title: "Character design basics", summary: "Shape language, silhouette and a few memorable details.", skill: "composition", difficulty: 3, prerequisites: ["silhouette", "figure-proportions"], tracks: ["manga"] },
  { id: "likeness", topicId: "subjects", title: "Portraits & likeness", summary: "Measuring the specific proportions that make a face that person.", skill: "proportion", difficulty: 4, prerequisites: ["facial-features", "measuring"], tracks: ["portraits"] },

  // Composition & design
  { id: "thumbnailing", topicId: "composition", title: "Thumbnailing", summary: "Tiny, fast sketches to try layouts before committing.", skill: "composition", difficulty: 1, prerequisites: [], tracks: ["core"] },
  { id: "focal-thirds", topicId: "composition", title: "Focal points & thirds", summary: "Choosing one star of the picture and placing it with intent.", skill: "composition", difficulty: 2, prerequisites: ["thumbnailing"], tracks: ["core"] },
  { id: "leading-lines", topicId: "composition", title: "Leading lines & eye flow", summary: "Roads, edges and gestures that walk the eye to the focal point.", skill: "composition", difficulty: 3, prerequisites: ["focal-thirds"], tracks: ["core"] },
  { id: "framing", topicId: "composition", title: "Framing & cropping", summary: "Deciding what to leave out, and frames within the frame.", skill: "composition", difficulty: 2, prerequisites: ["thumbnailing"], tracks: ["core"] },
  { id: "storytelling", topicId: "composition", title: "Visual storytelling", summary: "Staging a moment so the viewer reads what happened.", skill: "composition", difficulty: 4, prerequisites: ["focal-thirds"], tracks: ["manga", "urban", "portraits"] },

  // Process & practice
  { id: "master-copy", topicId: "practice", title: "Master copies", summary: "Copying a master's drawing to learn their decisions.", skill: "linework", difficulty: 3, prerequisites: [], tracks: ["core"] },
  { id: "memory-drawing", topicId: "practice", title: "Memory drawing", summary: "Observe, put the reference away, draw — building a visual library.", skill: "proportion", difficulty: 3, prerequisites: [], tracks: ["core"] },
  { id: "urban-sketching", topicId: "practice", title: "Sketching on location", summary: "Drawing outside: choosing a view, working fast, embracing mess.", skill: "composition", difficulty: 3, prerequisites: ["persp-2pt"], tracks: ["urban", "ink", "watercolor"] },
  { id: "self-critique", topicId: "practice", title: "Seeing your work fresh", summary: "Flip it, squint at it, step back — habits to catch your own mistakes.", skill: "composition", difficulty: 1, prerequisites: [], tracks: ["core"] },
];
