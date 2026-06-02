// Participant color system.
// A color is a participant's visual fingerprint. We auto-assign one — no manual
// picking — choosing randomly among palette colors that are perceptually
// distinct (CIE Lab ΔE) from those already taken, so a room ends up with a
// varied, well-spread set rather than clustering near one hue.

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const c = ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ~90 pleasant colors: 30 hues × 3 tone tiers, plus a few neutrals. All read
// fine on white, with text contrast handled by readableTextOn().
const TONE_TIERS = [
  { s: 68, l: 52 }, // vivid
  { s: 55, l: 43 }, // deep
  { s: 62, l: 64 }, // soft
];
export const PALETTE: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 360; h += 12) for (const t of TONE_TIERS) out.push(hslToHex(h, t.s, t.l));
  out.push('#64748b', '#78716c', '#6b7280'); // slate / stone / gray
  return out;
})();

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  // sRGB -> linear
  const f = (c: number) => {
    c /= 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };
  const rl = f(r);
  const gl = f(g);
  const bl = f(b);
  // linear RGB -> XYZ (D65)
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = g2(x);
  const fy = g2(y);
  const fz = g2(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Perceptual distance between two hex colors (CIE76 ΔE). */
export function colorDistance(a: string, b: string): number {
  const [l1, a1, b1] = rgbToLab(hexToRgb(a));
  const [l2, a2, b2] = rgbToLab(hexToRgb(b));
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

const DISTINCT_THRESHOLD = 22; // min ΔE from existing colors to count as "distinct"

/**
 * Auto-assign one color, avoiding those already taken. Picks randomly among
 * palette colors that are perceptually distinct from every existing color (so
 * the room stays varied); falls back to the most-distinct available color, then
 * to any palette color, when the room is crowded.
 */
export function pickColor(taken: string[]): string {
  const takenLower = taken.map((c) => c.toLowerCase());
  const fresh = PALETTE.filter((c) => !takenLower.includes(c.toLowerCase()));
  const pool = fresh.length ? fresh : PALETTE;
  const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (takenLower.length === 0) return rand(pool);

  const scored = pool.map((c) => ({
    c,
    score: Math.min(...takenLower.map((t) => colorDistance(c, t))),
  }));
  const distinct = scored.filter((x) => x.score >= DISTINCT_THRESHOLD).map((x) => x.c);
  if (distinct.length) return rand(distinct);
  return scored.sort((a, b) => b.score - a.score)[0].c;
}

/** Whether a color reads better with white vs dark text on top. */
export function readableTextOn(hex: string): '#ffffff' | '#1a1a1a' {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#1a1a1a' : '#ffffff';
}
