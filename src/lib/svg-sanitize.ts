import sanitizeHtml from "sanitize-html";

/**
 * Model-written SVG is untrusted. We keep only a small allowlist of shape and text
 * elements and presentation attributes — no scripts, event handlers, links, styles,
 * <use>, <image>, <foreignObject>, external references or url() paint servers.
 */
const TAGS = ["svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "text", "tspan", "title"];

const ATTRS = [
  "viewBox", "xmlns", "d", "x", "y", "x1", "y1", "x2", "y2", "dx", "dy", "cx", "cy", "r", "rx", "ry",
  "width", "height", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-opacity", "fill-opacity", "fill-rule", "opacity", "transform",
  "font-size", "font-family", "font-weight", "font-style", "text-anchor", "dominant-baseline", "letter-spacing",
];

const UNSAFE_VALUE = /url\s*\(|javascript:|data:|expression\s*\(|[<>]/i;

export function sanitizeSvg(input: string | null | undefined): string | null {
  if (!input) return null;
  const start = input.indexOf("<svg");
  const end = input.lastIndexOf("</svg>");
  if (start === -1 || end === -1) return null;
  const raw = input.slice(start, end + "</svg>".length);
  if (raw.length > 30_000) return null;

  let rootSeen = false;
  const clean = sanitizeHtml(raw, {
    allowedTags: TAGS,
    allowedAttributes: Object.fromEntries(TAGS.map((t) => [t, ATTRS])),
    allowedSchemes: [],
    allowProtocolRelative: false,
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false, recognizeSelfClosing: true },
    transformTags: {
      "*": (tagName, attribs) => {
        const safe: Record<string, string> = {};
        for (const [k, v] of Object.entries(attribs)) {
          if (!UNSAFE_VALUE.test(v)) safe[k] = v;
        }
        if (tagName === "svg" && !rootSeen) {
          rootSeen = true;
          delete safe.width;
          delete safe.height;
          safe.xmlns = "http://www.w3.org/2000/svg";
          if (!safe.viewBox) safe.viewBox = "0 0 400 260";
          safe.role = "img";
        }
        return { tagName, attribs: safe };
      },
    },
  });

  if (!clean.startsWith("<svg")) return null;
  // Require at least a few drawing elements so an empty shell isn't shown as a diagram.
  const shapes = clean.match(/<(path|line|polyline|polygon|rect|circle|ellipse)\b/g)?.length ?? 0;
  return shapes >= 2 ? clean : null;
}
