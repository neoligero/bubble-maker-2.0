import type { Bubble } from './engine';
import { parseColor, rgbaString, type Rgba } from './color';
import { getPalette, paletteVersion, type BubblePalette } from './palettes';

const SIN60 = Math.sqrt(3) / 2;
const TAU = Math.PI * 2;

/**
 * Traces a cell that morphs from a circle (t = 0) to a flat-top hexagon
 * (t = 1) while keeping the same apothem `a`: a hexagon of circumradius R
 * whose corners are rounded with radius c, where c shrinks as t grows.
 */
export function cellPath(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, t: number) {
  const c = a * (1 - t);
  const R = (a - c) / SIN60;
  ctx.beginPath();
  if (R < 0.01) {
    ctx.arc(x, y, a, 0, TAU);
    return;
  }
  for (let i = 0; i < 6; i++) {
    const th = (Math.PI / 3) * i;
    ctx.arc(x + R * Math.cos(th), y + R * Math.sin(th), c, th - Math.PI / 6, th + Math.PI / 6);
  }
  ctx.closePath();
}

/** A light in the scene, in canvas pixels. Bubbles are lit by the nearest one. */
export interface Light {
  x: number;
  y: number;
}

export interface PaintOptions {
  /** Light sources. Default: one far up and to the left of each bubble. */
  lights?: Light[];
  /** 0..1 aura around bubbles whose palette defines `glow`. */
  glow?: number;
  /** Hexagons mounted on a wall cast a soft shadow. */
  wallShadow?: boolean;
  /** Stretch along the motion (flexible glass). */
  flex?: boolean;
  /** On a dark background: carry a faint room inside the bubble, as the marble does on a light one. */
  dark?: boolean;
  /** Colours of that room, centre and edge. */
  room?: readonly [string, string];
}

// how much each stop (centre → rim) lets the background through while floating
const SEE = [0.35, 0.75, 0.45, 0.2];
type Prepared = {
  stops: [number, Rgba, number, number][];
  face: [string, string];
  nacre: [string, number] | null;
  causticTint: string;
  causticAlpha: number;
  glow: string | null;
  shine: number;
  rimShade: string;
  rimWidth: number;
};
const prepared = new Map<string, Prepared>();
let seen = -1;

function prepare(pal: BubblePalette): Prepared {
  const cols = [pal.light, pal.body, pal.edge, pal.rim].map(parseColor);
  const tint = (pal.caustic?.color ?? '255,248,228');
  return {
    stops: [0, 0.62, 0.9, 1].map((st, i) => [st, cols[i], pal.opacity[i] * (1 - pal.clarity * SEE[i]), pal.opacity[i]] as [number, Rgba, number, number]),
    face: [pal.face[0], pal.face[1]],
    nacre: pal.nacre === null ? null : pal.nacre ? [pal.nacre.color, pal.nacre.alpha] : ['255,226,214', 0.28],
    causticTint: tint,
    causticAlpha: pal.caustic?.alpha ?? 0.55,
    glow: pal.glow ?? null,
    shine: pal.shine ?? 1,
    rimShade: pal.rimShade ?? 'rgba(255,248,230,0.72)',
    rimWidth: pal.rimWidth ?? 0.06,
  };
}

function palette(kind: string): Prepared {
  if (seen !== paletteVersion()) {
    prepared.clear();
    seen = paletteVersion();
  }
  let p = prepared.get(kind);
  if (!p) {
    p = prepare(getPalette(kind));
    prepared.set(kind, p);
  }
  return p;
}

function nearestLight(x: number, y: number, lights: Light[]) {
  let best = lights[0];
  let bd = Infinity;
  for (const l of lights) {
    const d = (l.x - x) ** 2 + (l.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

const ROOM: readonly [string, string] = ['rgba(250,244,232,0.5)', 'rgba(226,212,186,0.62)'];

/** Paints one bubble (or hexagonal tile) on a 2D canvas. Colours come from the palette of `b.kind`. */
export function paintBubble(ctx: CanvasRenderingContext2D, b: Bubble, o: PaintOptions = {}) {
  const a = b.r;
  const t = b.shape;
  if (a < 0.5 || b.alpha <= 0.01) return;
  const P = palette(b.kind);
  const lights = o.lights?.length ? o.lights : [{ x: b.x - 1000, y: b.y - 1600 }];
  const L = nearestLight(b.x, b.y, lights);
  let lx = L.x - b.x;
  let ly = L.y - b.y;
  const ll = Math.hypot(lx, ly) || 1;
  lx /= ll;
  ly /= ll;

  ctx.save();
  ctx.globalAlpha = b.alpha;
  ctx.translate(b.x, b.y);

  // flexible glass: stretch along the motion, only while still a bubble
  const vx = b.x - b.px;
  const vy = b.y - b.py;
  const stretch = o.flex ? Math.min(Math.hypot(vx, vy) / (a * 1.5 + 4), 0.12) * (1 - t) : 0;
  if (stretch > 0.01) {
    const ang = Math.atan2(vy, vx);
    ctx.rotate(ang);
    ctx.scale(1 + stretch * 0.6, 1 - stretch * 0.4);
    ctx.rotate(-ang);
  }

  // body, lit from the nearest light
  let body: CanvasGradient;
  if (t > 0.6) {
    body = ctx.createLinearGradient(lx * a, ly * a, -lx * a, -ly * a);
    body.addColorStop(0, P.face[0]);
    body.addColorStop(1, P.face[1]);
  } else {
    body = ctx.createRadialGradient(lx * a * 0.35, ly * a * 0.35, a * 0.05, 0, 0, a);
    // floating bubbles are see-through; they firm up as they become tiles
    const k = Math.min(1, t / 0.6);
    const solid = k * k * (3 - 2 * k);
    for (const [s, c, clear, firm] of P.stops) body.addColorStop(s, rgbaString(c, clear + (firm - clear) * solid));
    if (o.dark) {
      const [r0, r1] = o.room ?? ROOM;
      const room = ctx.createRadialGradient(lx * a * 0.3, ly * a * 0.3, 0, 0, 0, a);
      room.addColorStop(0, r0);
      room.addColorStop(1, r1);
      cellPath(ctx, 0, 0, a, t);
      ctx.fillStyle = room;
      ctx.fill();
    }
  }
  if (o.wallShadow && t > 0.6) {
    ctx.shadowColor = `rgba(96, 72, 30, ${(0.32 * (t - 0.6)) / 0.4})`;
    ctx.shadowBlur = a * 0.7;
    ctx.shadowOffsetX = -lx * a * 0.18;
    ctx.shadowOffsetY = a * 0.22;
  }
  if (P.glow && o.glow) {
    ctx.shadowColor = `rgba(${P.glow}, ${0.65 * o.glow})`;
    ctx.shadowBlur = a * 1.8 * o.glow;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  cellPath(ctx, 0, 0, a, t);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // keep every reflection inside the silhouette
  ctx.save();
  cellPath(ctx, 0, 0, a, t);
  ctx.clip();

  // nacre: a whisper of iridescence
  if (P.nacre && t < 0.7) {
    const n = ctx.createRadialGradient(-lx * a * 0.55, -ly * a * 0.55, 0, -lx * a * 0.55, -ly * a * 0.55, a * 0.9);
    n.addColorStop(0, `rgba(${P.nacre[0]},${P.nacre[1]})`);
    n.addColorStop(0.5, 'rgba(214,236,240,0.14)');
    n.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = n;
    ctx.fillRect(-a, -a, a * 2, a * 2);
  }

  // reflections of every light, like windows on a bubble
  const bubbleness = 1 - Math.min(1, t / 0.75);
  for (const l of lights) {
    let dx = l.x - b.x;
    let dy = l.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const near = l === L ? 1 : 0.55;
    const px = dx * a * 0.52;
    const py = dy * a * 0.52;
    const w = a * (0.16 + 0.1 * near);
    const h = a * (0.07 + 0.05 * near);
    const g = ctx.createRadialGradient(px, py, 0, px, py, w);
    const strength = Math.min(1, P.shine * near * (0.35 + 0.65 * bubbleness));
    g.addColorStop(0, `rgba(255,255,255,${strength})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px, py, w, h, Math.atan2(dy, dx) + Math.PI / 2, 0, TAU);
    ctx.fill();
    // crisp specular core of the main light: the gloss of wet glass
    if (near === 1 && bubbleness > 0 && a > 6) {
      const core = ctx.createRadialGradient(px, py, 0, px, py, a * 0.075);
      core.addColorStop(0, `rgba(255,255,255,${(0.95 * bubbleness).toFixed(3)})`);
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(px, py, a * 0.075, a * 0.05, Math.atan2(dy, dx) + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
  }

  // caustic: light focused through the bubble on the far side
  if (bubbleness > 0) {
    const cx = -lx * a * 0.58;
    const cy = -ly * a * 0.58;
    const c = ctx.createRadialGradient(cx, cy, 0, cx, cy, a * 0.42);
    c.addColorStop(0, `rgba(${P.causticTint},${(P.causticAlpha * bubbleness).toFixed(3)})`);
    c.addColorStop(1, `rgba(${P.causticTint},0)`);
    ctx.fillStyle = c;
    ctx.fillRect(-a, -a, a * 2, a * 2);
  }

  // satin sheen across a finished hexagon face
  if (t > 0.5) {
    const s = ctx.createLinearGradient(lx * a, ly * a, -lx * a, -ly * a);
    s.addColorStop(0, `rgba(255,255,255,${0.32 * (t - 0.5) * 2})`);
    s.addColorStop(0.45, 'rgba(255,255,255,0)');
    ctx.fillStyle = s;
    ctx.fillRect(-a, -a, a * 2, a * 2);
  }
  ctx.restore();

  // discontinuous luminous rim (Fresnel): bright towards the light, a bounce opposite
  const rim = ctx.createLinearGradient(lx * a, ly * a, -lx * a, -ly * a);
  rim.addColorStop(0, 'rgba(255,255,255,1)');
  rim.addColorStop(0.35, 'rgba(255,255,255,0)');
  rim.addColorStop(0.7, 'rgba(255,255,255,0)');
  rim.addColorStop(1, P.rimShade);
  ctx.lineWidth = Math.max(0.8, a * P.rimWidth);
  ctx.strokeStyle = rim;
  cellPath(ctx, 0, 0, a - ctx.lineWidth / 2, t);
  ctx.stroke();

  ctx.restore();
}
