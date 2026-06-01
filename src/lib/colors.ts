// Participant color system.
// Colors are a participant's visual fingerprint, so candidates must be
// pleasant (never too bright/dark/washed-out) AND maximally distinct from
// colors already taken in the room. We rank a curated palette by perceptual
// distance (CIE Lab ΔE) from existing colors and return the most distinct.

// Curated palette: saturated-but-soft, readable on white, distinct hues.
export const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
] as const;

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

/**
 * Return `count` color candidates from the palette, excluding ones already
 * taken, ordered so the most perceptually distinct from existing colors come
 * first. With no existing colors, returns a spread-out default selection.
 */
export function suggestColors(taken: string[], count = 5): string[] {
  const takenLower = taken.map((c) => c.toLowerCase());
  const available = PALETTE.filter((c) => !takenLower.includes(c.toLowerCase()));

  if (takenLower.length === 0) {
    // Evenly sample across the palette for variety.
    const step = Math.max(1, Math.floor(available.length / count));
    const picks: string[] = [];
    for (let i = 0; i < available.length && picks.length < count; i += step) {
      picks.push(available[i]);
    }
    return picks.slice(0, count);
  }

  return available
    .map((c) => ({
      c,
      score: Math.min(...takenLower.map((t) => colorDistance(c, t))),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.c);
}

/** Whether a color reads better with white vs dark text on top. */
export function readableTextOn(hex: string): '#ffffff' | '#1a1a1a' {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#1a1a1a' : '#ffffff';
}
