"use client";

import { useId } from "react";

/**
 * Programmatically drawn perception-test figures. Each item has two variants;
 * which one is correct is only known server-side (lib/assessment/scoring.ts).
 */

type Pt = [number, number];
const INK = "#1C1B19";
const PAPER = "#FBF9F4";

function along(p: Pt, vp: Pt, x: number): Pt {
  const t = (x - p[0]) / (vp[0] - p[0]);
  return [x, p[1] + (vp[1] - p[1]) * t];
}

function intersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt {
  const d = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0]);
  const ta = a1[0] * a2[1] - a1[1] * a2[0];
  const tb = b1[0] * b2[1] - b1[1] * b2[0];
  return [
    (ta * (b1[0] - b2[0]) - (a1[0] - a2[0]) * tb) / d,
    (ta * (b1[1] - b2[1]) - (a1[1] - a2[1]) * tb) / d,
  ];
}

const pts = (...p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

function PerspectiveBox({ variant }: { variant: string }) {
  // Vanishing points sit off-canvas on the eye-level line (y = 50).
  const VPL: Pt = [-160, 50];
  const VPR: Pt = [400, 50];
  const FT: Pt = [110, 88];
  const FB: Pt = [110, 150];
  const TL = along(FT, VPL, 40);
  const BL = along(FB, VPL, 40);
  const TR = along(FT, VPR, 200);
  // Variant b: the right face's bottom edge heads to a point below eye level, so it widens as it recedes.
  const BR = variant === "a" ? along(FB, VPR, 200) : along(FB, [400, 178], 200);
  const back = intersect(TL, VPR, TR, VPL);
  return (
    <>
      <line x1="0" y1="50" x2="240" y2="50" stroke={INK} strokeOpacity="0.35" strokeDasharray="4 4" />
      <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
        <polygon points={pts(FT, TL, back, TR)} fill="#F1ECE2" />
        <polygon points={pts(FT, TL, BL, FB)} fill="#D9D0BF" />
        <polygon points={pts(FT, TR, BR, FB)} fill="#BDB19C" />
      </g>
    </>
  );
}

function Glass({ variant }: { variant: string }) {
  // Variant b is correct: below eye level, the farther-down ellipse is rounder.
  const topRy = variant === "b" ? 7 : 14;
  const botRy = variant === "b" ? 13 : 5;
  const cx = 120;
  return (
    <g stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round">
      <ellipse cx={cx} cy="150" rx="70" ry={botRy + 6} fill="#EAE3D5" stroke="none" />
      <path d={`M78 40 L88 150`} />
      <path d={`M162 40 L152 150`} />
      <path
        d={`M88 150 A32 ${botRy} 0 0 0 152 150`}
        fill="none"
      />
      <path d={`M88 150 A32 ${botRy} 0 0 1 152 150`} strokeOpacity="0.35" strokeDasharray="3 3" />
      <ellipse cx={cx} cy="40" rx="42" ry={topRy} fill="#FBF9F4" />
    </g>
  );
}

function Face({ variant }: { variant: string }) {
  // Variant a: eyes halfway down the head. Variant b: eyes too high (a classic beginner habit).
  const v =
    variant === "a"
      ? { eye: 92, brow: 81, nose: 118, mouth: 134, earTop: 84, earBot: 118, hair: 48 }
      : { eye: 64, brow: 55, nose: 86, mouth: 100, earTop: 58, earBot: 86, hair: 38 };
  // Hair: a cap that follows the skull above the hairline, with a little volume.
  const dy = (v.hair - 92) / 69;
  const dx = 53 * Math.sqrt(Math.max(0, 1 - dy * dy));
  return (
    <g stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 150 L98 178 M140 150 L142 178" />
      <ellipse cx="120" cy="92" rx="50" ry="66" fill={PAPER} />
      <path
        d={`M${120 - dx} ${v.hair + 8} A53 69 0 0 1 ${120 + dx} ${v.hair + 8} Q 140 ${v.hair - 4} 120 ${v.hair} Q 98 ${v.hair - 2} ${120 - dx} ${v.hair + 8} Z`}
        fill="#3A342D"
        stroke="none"
      />
      <path d={`M70 ${v.earTop} q -12 ${(v.earBot - v.earTop) / 2} 2 ${v.earBot - v.earTop}`} />
      <path d={`M170 ${v.earTop} q 12 ${(v.earBot - v.earTop) / 2} -2 ${v.earBot - v.earTop}`} />
      <path d={`M88 ${v.brow} q 12 -6 24 0 M128 ${v.brow} q 12 -6 24 0`} />
      <path d={`M90 ${v.eye} q 10 -7 20 0 q -10 6 -20 0 Z M130 ${v.eye} q 10 -7 20 0 q -10 6 -20 0 Z`} />
      <circle cx="100" cy={v.eye - 0.5} r="2.6" fill={INK} stroke="none" />
      <circle cx="140" cy={v.eye - 0.5} r="2.6" fill={INK} stroke="none" />
      <path d={`M116 ${v.eye + 8} L113 ${v.nose - 2} q 7 5 14 0`} />
      <path d={`M106 ${v.mouth} q 14 7 28 0`} />
    </g>
  );
}

function Sphere({ variant }: { variant: string }) {
  const gid = useSvgId("sph");
  // Variant b is correct: cast shadow falls away from the light (lower right).
  const castX = variant === "b" ? 150 : 90;
  return (
    <>
      <defs>
        <radialGradient id={gid} cx="0.5" cy="0.5" r="0.5" fx="0.34" fy="0.3">
          <stop offset="0" stopColor="#FDFBF7" />
          <stop offset="0.42" stopColor="#D2C8B6" />
          <stop offset="0.78" stopColor="#6E6455" />
          <stop offset="0.93" stopColor="#837866" />
          <stop offset="1" stopColor="#8E8370" />
        </radialGradient>
      </defs>
      <g stroke={INK} strokeWidth="1.4" strokeLinecap="round">
        <circle cx="24" cy="24" r="7" fill="#F2E6CF" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={24 + Math.cos(a) * 11}
              y1={24 + Math.sin(a) * 11}
              x2={24 + Math.cos(a) * 15}
              y2={24 + Math.sin(a) * 15}
            />
          );
        })}
      </g>
      <line x1="10" y1="140" x2="230" y2="140" stroke={INK} strokeOpacity="0.3" />
      <ellipse cx={castX} cy="143" rx="52" ry="9" fill="#4A4239" fillOpacity="0.55" />
      <circle cx="120" cy="92" r="48" fill={`url(#${gid})`} stroke={INK} strokeWidth="1.2" />
    </>
  );
}

function ColorValue({ variant }: { variant: string }) {
  // #D9534F and #808080 share an L* of ~53.5; #E6C34A is far lighter (~80).
  const color = variant === "a" ? "#D9534F" : "#E6C34A";
  return (
    <g stroke={INK} strokeWidth="1.2">
      <rect x="28" y="40" width="92" height="100" fill="#808080" />
      <rect x="120" y="40" width="92" height="100" fill={color} />
    </g>
  );
}

function ColorTemp({ variant }: { variant: string }) {
  // Variant b is correct: warm light, cool shadows.
  const shade = variant === "b" ? "#6C6B8F" : "#7A4A26";
  const cast = variant === "b" ? "#7D7BA0" : "#8D5C34";
  return (
    <>
      <rect x="0" y="0" width="240" height="110" fill="#F4DDBA" />
      <rect x="0" y="110" width="240" height="70" fill="#E7BE8C" />
      <circle cx="30" cy="30" r="14" fill="#F7B860" />
      <polygon points="126,160 176,146 234,154 196,172" fill={cast} />
      <g stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
        <polygon points="80,96 130,84 176,96 126,108" fill="#F6C48A" />
        <polygon points="80,96 126,108 126,160 80,146" fill="#EBA165" />
        <polygon points="126,108 176,96 176,146 126,160" fill={shade} />
      </g>
    </>
  );
}

function Focal({ variant }: { variant: string }) {
  if (variant === "a") {
    return (
      <>
        <rect x="0" y="0" width="240" height="122" fill="#EDE7DC" />
        <rect x="0" y="122" width="240" height="58" fill="#B8AD99" />
        <path d="M0 122 Q 60 114 120 121 T 240 118 L240 124 L0 124 Z" fill="#A69B87" />
        <ellipse cx="40" cy="120" rx="14" ry="5" fill="#A69B87" />
        <ellipse cx="96" cy="121" rx="10" ry="4" fill="#A69B87" />
        <rect x="157" y="88" width="6" height="36" fill="#22201C" />
        <ellipse cx="160" cy="70" rx="26" ry="30" fill="#22201C" />
      </>
    );
  }
  return (
    <>
      <rect x="0" y="0" width="240" height="90" fill="#C9C1B2" />
      <rect x="0" y="90" width="240" height="90" fill="#A79E8D" />
      {[60, 120, 180].map((x) => (
        <g key={x} fill="#8F8676">
          <rect x={x - 3} y="68" width="6" height="24" />
          <ellipse cx={x} cy="58" rx="18" ry="20" />
        </g>
      ))}
    </>
  );
}

const FIGURES: Record<string, (p: { variant: string }) => React.ReactNode> = {
  "persp-box": PerspectiveBox,
  ellipse: Glass,
  face: Face,
  sphere: Sphere,
  "color-value": ColorValue,
  "color-temp": ColorTemp,
  focal: Focal,
};

export function PerceptionFigure({
  itemId,
  variant,
  label,
}: {
  itemId: string;
  variant: string;
  label: string;
}) {
  const Fig = FIGURES[itemId];
  return (
    <svg viewBox="0 0 240 180" role="img" aria-label={label} className="block h-auto w-full">
      <rect width="240" height="180" fill={PAPER} />
      {Fig ? <Fig variant={variant} /> : null}
    </svg>
  );
}
