/**
 * Generates the bundled sample "photos of drawings" in public/samples/.
 * Pencil-style SVG sketches (seeded jitter, construction lines, hatching) rendered
 * onto paper and slightly rotated on a table so they read like phone photos.
 * Each contains a realistic beginner mistake so the critique has something to find.
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

type Pt = [number, number];
const W = 1400;
const H = 1050;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Sketch {
  parts: string[] = [];
  defs: string[] = [];
  private r: () => number;
  private clipN = 0;
  constructor(seed: number) {
    this.r = rng(seed);
  }
  j(n = 1.6) {
    return (this.r() - 0.5) * 2 * n;
  }
  /** A pencil line: a couple of slightly different passes. */
  line(a: Pt, b: Pt, o: { weight?: number; alpha?: number; passes?: number; overshoot?: number } = {}) {
    const { weight = 2, alpha = 0.72, passes = 2, overshoot = 6 } = o;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (let p = 0; p < passes; p++) {
      const s: Pt = [a[0] - ux * overshoot * this.r() + this.j(), a[1] - uy * overshoot * this.r() + this.j()];
      const e: Pt = [b[0] + ux * overshoot * this.r() + this.j(), b[1] + uy * overshoot * this.r() + this.j()];
      const mid: Pt = [(s[0] + e[0]) / 2 + this.j(2.2), (s[1] + e[1]) / 2 + this.j(2.2)];
      this.parts.push(
        `<path d="M${s[0].toFixed(1)} ${s[1].toFixed(1)} Q${mid[0].toFixed(1)} ${mid[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}" stroke="#2f2d2a" stroke-opacity="${(alpha * (0.75 + this.r() * 0.3)).toFixed(2)}" stroke-width="${(weight * (0.8 + this.r() * 0.4)).toFixed(2)}" fill="none" stroke-linecap="round"/>`,
      );
    }
  }
  poly(points: Pt[], closed = true, o?: Parameters<Sketch["line"]>[2]) {
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) this.line(points[i], points[(i + 1) % points.length], o);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, o: { weight?: number; alpha?: number; from?: number; to?: number; passes?: number } = {}) {
    const { weight = 2, alpha = 0.7, from = 0, to = Math.PI * 2, passes = 2 } = o;
    for (let p = 0; p < passes; p++) {
      const steps = 48;
      const pts: string[] = [];
      const drift = this.j(3);
      for (let i = 0; i <= steps; i++) {
        const t = from + ((to - from) * i) / steps;
        pts.push(`${(cx + Math.cos(t) * (rx + drift) + this.j(0.8)).toFixed(1)},${(cy + Math.sin(t) * (ry + drift * 0.6) + this.j(0.8)).toFixed(1)}`);
      }
      this.parts.push(
        `<polyline points="${pts.join(" ")}" stroke="#2f2d2a" stroke-opacity="${(alpha * (0.75 + this.r() * 0.3)).toFixed(2)}" stroke-width="${(weight * (0.85 + this.r() * 0.3)).toFixed(2)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  }
  /** Parallel hatching clipped to a shape. */
  hatch(clipPath: string, angleDeg: number, spacing: number, o: { alpha?: number; weight?: number; cross?: boolean } = {}) {
    const id = `c${this.clipN++}`;
    this.defs.push(`<clipPath id="${id}"><path d="${clipPath}"/></clipPath>`);
    const lines: string[] = [];
    const draw = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      for (let k = -1600; k < 1600; k += spacing) {
        const ox = W / 2 - dy * k + this.j(1.5);
        const oy = H / 2 + dx * k + this.j(1.5);
        lines.push(
          `<line x1="${(ox - dx * 1600).toFixed(1)}" y1="${(oy - dy * 1600).toFixed(1)}" x2="${(ox + dx * 1600).toFixed(1)}" y2="${(oy + dy * 1600).toFixed(1)}" stroke-opacity="${((o.alpha ?? 0.4) * (0.7 + this.r() * 0.5)).toFixed(2)}"/>`,
        );
      }
    };
    draw(angleDeg);
    if (o.cross) draw(angleDeg + 70);
    this.parts.push(
      `<g clip-path="url(#${id})" stroke="#2f2d2a" stroke-width="${o.weight ?? 1.3}" stroke-linecap="round">${lines.join("")}</g>`,
    );
  }
  svg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.19  0 0 0 0 0.17  0 0 0 0.09 0"/></filter>
    <radialGradient id="light" cx="0.38" cy="0.32" r="0.9"><stop offset="0" stop-color="#fbf8f1"/><stop offset="1" stop-color="#e3ddd0"/></radialGradient>
    ${this.defs.join("\n")}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#light)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  ${this.parts.join("\n")}
</svg>`;
  }
}

const along = (p: Pt, vp: Pt, x: number): Pt => [x, p[1] + ((vp[1] - p[1]) * (x - p[0])) / (vp[0] - p[0])];
function intersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt {
  const d = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0]);
  const ta = a1[0] * a2[1] - a1[1] * a2[0];
  const tb = b1[0] * b2[1] - b1[1] * b2[0];
  return [(ta * (b1[0] - b2[0]) - (a1[0] - a2[0]) * tb) / d, (ta * (b1[1] - b2[1]) - (a1[1] - a2[1]) * tb) / d];
}
const d = (...p: Pt[]) => `M${p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

function boxes() {
  const s = new Sketch(7);
  const HY = 360;
  const VPL: Pt = [-420, HY];
  const VPR: Pt = [1900, HY];
  s.line([60, HY], [1340, HY], { weight: 1.2, alpha: 0.35, passes: 1 });

  const drawBox = (fx: number, top: number, bottom: number, lx: number, rx: number, rightBottomVp: Pt) => {
    const FT: Pt = [fx, top];
    const FB: Pt = [fx, bottom];
    const TL = along(FT, VPL, lx);
    const BL = along(FB, VPL, lx);
    const TR = along(FT, VPR, rx);
    const BR = along(FB, rightBottomVp, rx);
    const back = intersect(TL, VPR, TR, VPL);
    // light construction toward vanishing points
    for (const p of [TL, BL]) s.line(p, along(p, VPL, p[0] - 140), { weight: 1, alpha: 0.22, passes: 1, overshoot: 0 });
    for (const p of [TR, BR]) s.line(p, along(p, VPR, p[0] + 160), { weight: 1, alpha: 0.22, passes: 1, overshoot: 0 });
    s.hatch(d(FT, TR, BR, FB), 62, 11, { alpha: 0.45 });
    s.hatch(d(FT, TL, BL, FB), 62, 22, { alpha: 0.18 });
    s.poly([FT, TL, back, TR]);
    s.line(FT, FB, { weight: 2.6 });
    s.line(TL, BL);
    s.line(TR, BR);
    s.line(BL, FB, { weight: 2.6 });
    s.line(FB, BR, { weight: 2.6 });
    // hidden back edges, drawn through
    const BB = intersect(BL, VPR, BR, VPL);
    s.line(back, BB, { weight: 1, alpha: 0.25, passes: 1 });
    s.line(BL, BB, { weight: 1, alpha: 0.25, passes: 1 });
    s.line(BR, BB, { weight: 1, alpha: 0.25, passes: 1 });
  };
  drawBox(500, 540, 840, 260, 770, VPR);
  // Second box: its right-side bottom edge aims at the wrong point (a classic drift).
  drawBox(1060, 470, 650, 930, 1250, [1900, 520]);
  // cast shadows
  s.hatch(d([770, 760], [1000, 790], [880, 860], [600, 855]), 10, 8, { alpha: 0.35, cross: true });
  return s.svg();
}

function portrait() {
  const s = new Sketch(21);
  const cx = 700;
  // Loomis ball and side plane
  s.ellipse(cx, 420, 205, 210, { weight: 1.4, alpha: 0.4 });
  s.ellipse(cx + 118, 455, 62, 95, { weight: 1.1, alpha: 0.3 });
  // centre line and brow line
  s.line([cx + 10, 205], [cx - 6, 800], { weight: 1, alpha: 0.28, passes: 1 });
  s.line([505, 425], [895, 425], { weight: 1, alpha: 0.28, passes: 1 });
  s.line([540, 600], [860, 600], { weight: 1, alpha: 0.22, passes: 1 });
  // jaw and chin
  s.line([512, 520], [585, 715]);
  s.line([585, 715], [690, 790]);
  s.line([690, 790], [790, 720]);
  s.line([790, 720], [886, 520]);
  // eyes (placed a little high — common beginner habit)
  s.ellipse(615, 462, 44, 16, { from: Math.PI, to: Math.PI * 2 });
  s.ellipse(615, 462, 44, 13, { from: 0, to: Math.PI, alpha: 0.5 });
  s.ellipse(782, 466, 44, 16, { from: Math.PI, to: Math.PI * 2 });
  s.ellipse(782, 466, 44, 13, { from: 0, to: Math.PI, alpha: 0.5 });
  s.ellipse(618, 462, 11, 11, { weight: 3, alpha: 0.85 });
  s.ellipse(780, 466, 11, 11, { weight: 3, alpha: 0.85 });
  // brows
  s.line([565, 425], [655, 418], { weight: 3 });
  s.line([742, 420], [832, 428], { weight: 3 });
  // nose
  s.line([700, 470], [688, 590], { alpha: 0.5 });
  s.ellipse(698, 598, 34, 14, { from: 0.2, to: Math.PI - 0.2, weight: 2.2 });
  s.hatch(d([700, 520], [726, 590], [700, 605], [686, 560]), 70, 7, { alpha: 0.35 });
  // mouth
  s.line([640, 668], [700, 676], { weight: 2.4 });
  s.line([700, 676], [758, 666], { weight: 2.4 });
  s.ellipse(700, 690, 34, 9, { from: 0.3, to: Math.PI - 0.3, alpha: 0.4 });
  // ears
  s.ellipse(498, 520, 24, 62, { from: Math.PI * 0.5, to: Math.PI * 1.5, weight: 2.2 });
  s.ellipse(900, 520, 24, 62, { from: -Math.PI * 0.5, to: Math.PI * 0.5, weight: 2.2 });
  // hair masses
  const hair = "M500 400 C 500 230, 610 175, 720 180 C 840 185, 920 260, 905 420 C 860 320, 760 300, 700 310 C 620 318, 545 340, 500 400 Z";
  s.hatch(hair, 75, 9, { alpha: 0.55, cross: true });
  s.parts.push(`<path d="${hair}" fill="none" stroke="#2f2d2a" stroke-opacity="0.6" stroke-width="2.2"/>`);
  // neck and shoulders
  s.line([615, 745], [600, 900]);
  s.line([790, 735], [805, 900]);
  s.line([600, 900], [380, 960]);
  s.line([805, 900], [1030, 965]);
  // shadow side of face
  s.hatch("M886 520 L 790 720 L 830 600 L 860 470 Z", 60, 9, { alpha: 0.35 });
  return s.svg();
}

function stillLife() {
  const s = new Sketch(42);
  // table edge
  s.line([90, 700], [1310, 712], { weight: 1.8, alpha: 0.5 });
  // sphere
  const sx = 470;
  const sy = 555;
  const r = 150;
  s.ellipse(sx, sy, r, r, { weight: 2.4 });
  s.hatch(`M${sx + 40} ${sy - 140} A${r} ${r} 0 0 1 ${sx - 120} ${sy + 95} C ${sx - 10} ${sy + 60}, ${sx + 60} ${sy - 10}, ${sx + 40} ${sy - 140} Z`, 120, 10, { alpha: 0.42 });
  s.hatch(`M${sx + 110} ${sy - 95} A${r} ${r} 0 0 1 ${sx - 60} ${sy + 138} C ${sx + 30} ${sy + 110}, ${sx + 95} ${sy + 20}, ${sx + 110} ${sy - 95} Z`, 120, 7, { alpha: 0.5, cross: true });
  // cast shadow on table (to the lower right, light from upper left)
  s.hatch(`M${sx - 20} ${sy + 150} C ${sx + 120} ${sy + 165}, ${sx + 300} ${sy + 160}, ${sx + 330} ${sy + 132} C ${sx + 260} ${sy + 110}, ${sx + 80} ${sy + 118}, ${sx - 20} ${sy + 150} Z`, 5, 6, { alpha: 0.55, cross: true });
  // cup: top ellipse rounder than the bottom one (should be the other way round)
  const cx = 930;
  s.ellipse(cx, 420, 115, 34, { weight: 2.3 });
  s.ellipse(cx, 420, 96, 26, { weight: 1.2, alpha: 0.4 });
  s.line([cx - 115, 422], [cx - 98, 680]);
  s.line([cx + 115, 422], [cx + 98, 680]);
  s.ellipse(cx, 680, 98, 16, { from: 0, to: Math.PI, weight: 2.3 });
  // handle
  s.ellipse(cx + 150, 520, 52, 70, { from: -Math.PI * 0.55, to: Math.PI * 0.55, weight: 2.6 });
  s.ellipse(cx + 146, 520, 30, 46, { from: -Math.PI * 0.5, to: Math.PI * 0.5, weight: 1.6, alpha: 0.5 });
  // cup shading
  s.hatch(`M${cx + 30} 440 L ${cx + 115} 422 L ${cx + 98} 680 L ${cx + 25} 690 Z`, 95, 8, { alpha: 0.45 });
  s.hatch(`M${cx + 70} 440 L ${cx + 115} 422 L ${cx + 98} 680 L ${cx + 65} 688 Z`, 30, 8, { alpha: 0.35 });
  s.hatch(`M${cx + 60} 690 C ${cx + 160} 700, ${cx + 260} 705, ${cx + 300} 690 C ${cx + 240} 676, ${cx + 150} 676, ${cx + 60} 690 Z`, 5, 6, { alpha: 0.5, cross: true });
  return s.svg();
}

async function render(svg: string, file: string) {
  const out = path.join(process.cwd(), "public", "samples", file);
  const paper = await sharp(Buffer.from(svg)).png().toBuffer();
  await sharp(paper)
    .rotate(-1.4, { background: "#7b6a57" })
    .resize(1500, 1125, { fit: "cover" })
    .modulate({ brightness: 0.97, saturation: 1.05 })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  console.log("wrote", out);
}

async function main() {
  await mkdir(path.join(process.cwd(), "public", "samples"), { recursive: true });
  await render(boxes(), "sample-boxes.jpg");
  await render(portrait(), "sample-portrait.jpg");
  await render(stillLife(), "sample-stilllife.jpg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
