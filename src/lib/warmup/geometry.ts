/**
 * Deterministic stroke scoring for the pen warm-up. Pure functions, no AI:
 * every score is a 0–100 number derived from the geometry of the stroke.
 */
export type Pt = { x: number; y: number };
export type Ellipse = { cx: number; cy: number; rx: number; ry: number; rot: number };
export type Box = { x: number; y: number; w: number; h: number };

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Straight line between two anchors: how straight, and how close to the anchors. */
export function scoreLine(stroke: Pt[], a: Pt, b: Pt) {
  if (stroke.length < 2) return { score: 0, straight: 0, onTarget: 0 };
  const s = stroke[0];
  const e = stroke[stroke.length - 1];
  const target = dist(a, b) || 1;
  const endErr = Math.min(dist(s, a) + dist(e, b), dist(s, b) + dist(e, a)) / 2;
  const chord = dist(s, e) || 1;
  let maxDev = 0;
  for (const p of stroke) {
    const dev = Math.abs((e.x - s.x) * (p.y - s.y) - (e.y - s.y) * (p.x - s.x)) / chord;
    maxDev = Math.max(maxDev, dev);
  }
  const straight = clamp(100 - (maxDev / target) * 600); // 3% bow → 82
  const onTarget = clamp(100 - (endErr / target) * 300); // 5% off → 85
  return { score: Math.round(0.55 * straight + 0.45 * onTarget), straight: Math.round(straight), onTarget: Math.round(onTarget) };
}

/** Freehand ellipse against a target: shape error, coverage of the full loop, and closure. */
export function scoreEllipse(stroke: Pt[], el: Ellipse) {
  if (stroke.length < 8) return { score: 0, shape: 0, closed: 0 };
  const cos = Math.cos(-el.rot);
  const sin = Math.sin(-el.rot);
  const bins = new Set<number>();
  const errs: number[] = [];
  for (const p of stroke) {
    const dx = p.x - el.cx;
    const dy = p.y - el.cy;
    const u = (dx * cos - dy * sin) / el.rx;
    const v = (dx * sin + dy * cos) / el.ry;
    errs.push(Math.abs(Math.hypot(u, v) - 1));
    bins.add(Math.floor(((Math.atan2(v, u) + Math.PI) / (2 * Math.PI)) * 16) % 16);
  }
  const coverage = bins.size / 16;
  const gap = dist(stroke[0], stroke[stroke.length - 1]) / ((el.rx + el.ry) / 2);
  const shape = clamp(100 - mean(errs) * 300); // 10% average error → 70
  const closed = clamp(100 - Math.max(0, gap - 0.12) * 160);
  const score = Math.round((0.75 * shape + 0.25 * closed) * Math.min(1, coverage / 0.9));
  return { score, shape: Math.round(shape), closed: Math.round(closed) };
}

/** A patch of hatching: parallel strokes, even spacing, kept inside the box. */
export function scoreHatching(strokes: Pt[][], box: Box) {
  const lines = strokes.filter((s) => s.length >= 2 && dist(s[0], s[s.length - 1]) > 8);
  if (lines.length < 3) return { score: 0, parallel: 0, spacing: 0, inside: 0 };

  // Circular mean of doubled angles (direction-agnostic).
  const angles = lines.map((s) => Math.atan2(s[s.length - 1].y - s[0].y, s[s.length - 1].x - s[0].x));
  const meanAngle = Math.atan2(mean(angles.map((a) => Math.sin(2 * a))), mean(angles.map((a) => Math.cos(2 * a)))) / 2;
  const devDeg = angles.map((a) => {
    let d = ((a - meanAngle) * 180) / Math.PI;
    d = ((((d + 90) % 180) + 180) % 180) - 90;
    return Math.abs(d);
  });
  const parallel = clamp(100 - mean(devDeg) * 5); // 4° average wobble → 80

  // Spacing along the normal of the mean direction.
  const nx = -Math.sin(meanAngle);
  const ny = Math.cos(meanAngle);
  const offsets = lines
    .map((s) => {
      const m = s[Math.floor(s.length / 2)];
      return m.x * nx + m.y * ny;
    })
    .sort((a, b) => a - b);
  const gaps = offsets.slice(1).map((o, i) => o - offsets[i]);
  const cv = std(gaps) / (mean(gaps) || 1);
  const spacing = clamp(100 - cv * 120);

  const pad = 8;
  const pts = lines.flat();
  const inBox = pts.filter(
    (p) => p.x >= box.x - pad && p.x <= box.x + box.w + pad && p.y >= box.y - pad && p.y <= box.y + box.h + pad,
  ).length;
  const inside = (inBox / pts.length) * 100;

  return {
    score: Math.round(0.4 * parallel + 0.4 * spacing + 0.2 * inside),
    parallel: Math.round(parallel),
    spacing: Math.round(spacing),
    inside: Math.round(inside),
  };
}
