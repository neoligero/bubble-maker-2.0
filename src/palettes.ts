/**
 * A bubble colour scheme. Colours go from the lit centre to the rim and accept any of
 * #rgb, #rrggbb, #rrggbbaa, rgb() and rgba(). Only the first seven fields are required.
 */
export interface BubblePalette {
  /** Lit centre. */
  light: string;
  body: string;
  edge: string;
  /** The rim, where the film is thickest. */
  rim: string;
  /** Opacity at [centre, body, edge, rim] once the bubble settles (e.g. into a honeycomb). */
  opacity: readonly [number, number, number, number];
  /** 0 solid … 1 very see-through while it floats. */
  clarity: number;
  /** Lit and shaded side of the flat face it takes when it becomes a hexagon. */
  face: readonly [string, string];
  /** Strength of the specular highlights, 0..1. Default 1. */
  shine?: number;
  /** A whisper of iridescence near the shadow side, or null for none. */
  nacre?: { color: string; alpha: number } | null;
  /** Aura colour for `glow`, as "r,g,b". Default warm gold. */
  glow?: string;
  /** Tint of the light focused through the bubble, as "r,g,b", and its strength 0..1. */
  caustic?: { color: string; alpha: number };
  /** Shade of the rim on the side away from the light. */
  rimShade?: string;
  /** Rim thickness as a fraction of the radius. Default 0.06. */
  rimWidth?: number;
}

export type PaletteMap = Record<string, BubblePalette>;

const clone = (p: BubblePalette): BubblePalette => ({ ...p, opacity: [...p.opacity] as BubblePalette['opacity'], face: [...p.face] as BubblePalette['face'] });

/** The three schemes the original site ships with. */
export const defaultPalettes: Readonly<PaletteMap> = Object.freeze({
  // lustrous pearl: milky, slightly translucent, faint nacre at the edge
  pearl: {
    light: '#fffffd', body: '#faf7f0', edge: '#eee6d6', rim: '#dcd0ba',
    opacity: [0.96, 0.9, 0.92, 0.95], clarity: 0.3, face: ['#fdfbf6', '#e6ddcc'],
    shine: 1, nacre: { color: '255,226,214', alpha: 0.28 }, caustic: { color: '255,248,228', alpha: 0.55 },
    rimShade: 'rgba(255,248,230,0.72)', rimWidth: 0.06,
  },
  // champagne: soft satin, a touch of transparency, no metallic bands
  gold: {
    light: '#f2dfac', body: '#dcbe7c', edge: '#c4a15a', rim: '#ac8b44',
    opacity: [1, 1, 1, 1], clarity: 0.3, face: ['#e4cb92', '#b99650'],
    shine: 0.62, nacre: null, glow: '240, 206, 128', caustic: { color: '255,234,184', alpha: 0.38 },
    rimShade: 'rgba(255,236,186,0.55)', rimWidth: 0.06,
  },
  // crystal / soap: the room shows through, the edge catches the light
  glass: {
    light: '#ffffff', body: '#fffdf5', edge: '#fffaec', rim: '#ffffff',
    opacity: [0.04, 0.1, 0.38, 0.7], clarity: 0, face: ['rgba(255,255,255,0.35)', 'rgba(234,216,168,0.25)'],
    shine: 1, nacre: { color: '255,214,170', alpha: 0.22 }, caustic: { color: '255,248,228', alpha: 0.55 },
    rimShade: 'rgba(255,248,230,0.72)', rimWidth: 0.045,
  },
} satisfies PaletteMap);

let current: PaletteMap = Object.fromEntries(Object.entries(defaultPalettes).map(([k, v]) => [k, clone(v)]));
let version = 0;

/** Increments whenever palettes change, so painters can drop their caches. */
export const paletteVersion = () => version;

/**
 * Adds or overrides palettes. A kind that already exists is merged field by field, so you
 * can change just `body` on 'pearl'; a new kind must be complete.
 */
export function registerPalettes(palettes: Record<string, Partial<BubblePalette>>): void {
  for (const [kind, p] of Object.entries(palettes)) {
    const base = current[kind];
    const merged = { ...(base ?? {}), ...p } as BubblePalette;
    for (const f of ['light', 'body', 'edge', 'rim', 'opacity', 'clarity', 'face'] as const) {
      if (merged[f] === undefined) throw new Error(`bubble-maker: palette "${kind}" is missing "${f}"`);
    }
    current[kind] = merged;
  }
  version++;
}

/** Returns the palette for a kind, falling back to 'pearl'. */
export function getPalette(kind: string): BubblePalette {
  return current[kind] ?? current.pearl;
}

export function listPalettes(): string[] {
  return Object.keys(current);
}

/** Restores the three built-in palettes. */
export function resetPalettes(): void {
  current = Object.fromEntries(Object.entries(defaultPalettes).map(([k, v]) => [k, clone(v)]));
  version++;
}
