/**
 * Bubble Maker 2.0 — physics core.
 *
 * Rewrite of the 2013–2015 Bubble Maker (github.com/neoligero/Bubble_maker).
 * The original grew a bubble on hover and pushed its neighbours with chained
 * 200 ms timeouts, splitting the push by |dx|/(|dx|+|dy|). This version runs
 * a continuous simulation instead:
 *  - Verlet integration with a damped spring towards each bubble's home,
 *  - position-based collision relaxation along the true centre-to-centre
 *    direction, weighted by mass (area), so chain reactions resolve in-frame,
 *  - hover / focus growth with eased radius, touch friendly,
 *  - the cursor moves the air: nearby bubbles drift away and follow its wake,
 *    with a single 0–10 `reaction` dial,
 *  - a `shape` value (0 circle → 1 hexagon) used by renderers to compress
 *    bubbles into a honeycomb.
 */
export interface Bubble {
  x: number;
  y: number;
  px: number; // previous position (Verlet)
  py: number;
  r: number; // current radius (apothem when hexagonal)
  base: number; // resting radius
  grow: number; // hover multiplier, e.g. 1.6
  hover: number; // eased 0..1
  hx: number; // spring home
  hy: number;
  shape: number; // 0 circle … 1 hexagon
  alpha: number;
  ghost: boolean; // ignores collisions
  fixed: boolean;
  kind: string;
  el?: HTMLElement;
}

export interface FieldOptions {
  stiffness?: number; // spring strength (1/s²)
  damping?: number; // velocity damping (1/s)
  iterations?: number; // collision relaxation passes per step
  gap?: number; // breathing room between bubbles (px)
  reaction?: number; // 0 still … 3 grow on hover only … 10 very lively
}

export class BubbleField {
  bubbles: Bubble[] = [];
  pointer = { x: -1e5, y: -1e5, inside: false };
  focused: Bubble | null = null;
  hoverEnabled = true;
  bounds: { x: number; y: number; w: number; h: number } | null = null;
  stiffness: number;
  damping: number;
  iterations: number;
  gap: number;
  reaction: number;
  private pv = { x: 0, y: 0 }; // pointer velocity (px/s), eased
  private last = { x: -1e5, y: -1e5, t: 0 };

  constructor(o: FieldOptions = {}) {
    this.stiffness = o.stiffness ?? 40;
    this.damping = o.damping ?? 6;
    this.iterations = o.iterations ?? 3;
    this.gap = o.gap ?? 2;
    this.reaction = o.reaction ?? 3;
  }

  add(init: Partial<Bubble> & { x: number; y: number; base: number }): Bubble {
    const b: Bubble = {
      px: init.x,
      py: init.y,
      r: init.base,
      grow: 1.55,
      hover: 0,
      hx: init.x,
      hy: init.y,
      shape: 0,
      alpha: 1,
      ghost: false,
      fixed: false,
      kind: 'pearl',
      ...init,
    };
    this.bubbles.push(b);
    return b;
  }

  /** Gives a bubble an instant velocity (px/s). */
  kick(b: Bubble, vx: number, vy: number, dt = 1 / 60) {
    b.px -= vx * dt;
    b.py -= vy * dt;
  }

  hit(x: number, y: number): Bubble | null {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy < b.r * b.r && b.alpha > 0.2) return b;
    }
    return null;
  }

  step(dtIn: number) {
    const dt = Math.min(dtIn, 1 / 30);
    const bs = this.bubbles;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    const hovered = this.hoverEnabled && this.pointer.inside ? this.hit(this.pointer.x, this.pointer.y) : null;
    const friction = Math.exp(-this.damping * dt);
    // the dial: 0 nothing, 3 the classic hover growth, up to 10 more growth and a stronger air current
    const level = Math.min(Math.max(this.reaction, 0), 10);
    const growScale = Math.min(level / 3, 1) * (1 + (Math.max(level - 3, 0) / 7) * 0.6);
    const air = Math.max(level - 2, 0) / 8;
    const pt = this.pointer;
    this.last.t += dt;
    if (pt.x !== this.last.x || pt.y !== this.last.y) {
      if (this.last.x > -1e4 && pt.inside) {
        const t = Math.max(this.last.t, 1 / 240);
        this.pv.x += ((pt.x - this.last.x) / t - this.pv.x) * 0.6;
        this.pv.y += ((pt.y - this.last.y) / t - this.pv.y) * 0.6;
      }
      this.last.x = pt.x;
      this.last.y = pt.y;
      this.last.t = 0;
    } else if (this.last.t > 0.06) {
      this.pv.x *= 1 - ease(10);
      this.pv.y *= 1 - ease(10);
    }
    const blowing = air > 0 && this.hoverEnabled && pt.inside;
    const reach = 60 + 160 * air;

    for (const b of bs) {
      const on = b === hovered || b === this.focused ? 1 : 0;
      b.hover += (on - b.hover) * ease(9);
      const target = b.base * (1 + (b.grow - 1) * growScale * b.hover);
      b.r += (target - b.r) * ease(11);
      if (b.fixed) {
        b.px = b.x;
        b.py = b.y;
        continue;
      }
      const vx = (b.x - b.px) * friction;
      const vy = (b.y - b.py) * friction;
      let ax = this.stiffness * (b.hx - b.x);
      let ay = this.stiffness * (b.hy - b.y);
      if (blowing && b.alpha > 0.2 && b !== hovered) {
        const dx = b.x - pt.x;
        const dy = b.y - pt.y;
        const d = Math.hypot(dx, dy) || 1;
        const gap = d - b.r; // the air pushes from outside; the bubble under the cursor only grows
        if (gap > 0 && gap < reach) {
          const f = (1 - gap / reach) ** 2;
          // drift away from the cursor, and get carried along by its wake (air drag)
          ax += (dx / d) * 1600 * air * f + (this.pv.x - vx / dt) * 6 * air * f;
          ay += (dy / d) * 1600 * air * f + (this.pv.y - vy / dt) * 6 * air * f;
        }
      }
      b.px = b.x;
      b.py = b.y;
      b.x += vx + ax * dt * dt;
      b.y += vy + ay * dt * dt;
    }

    for (let it = 0; it < this.iterations; it++) {
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (a.ghost) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j];
          if (b.ghost) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r + this.gap;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const overlap = min - d;
          const nx = dx / d;
          const ny = dy / d;
          // heavier (bigger or hovered) bubbles push the lighter ones
          const ma = a.r * a.r * (1 + a.hover * 4);
          const mb = b.r * b.r * (1 + b.hover * 4);
          let wa = a.fixed ? 0 : mb / (ma + mb);
          let wb = b.fixed ? 0 : ma / (ma + mb);
          if (a.fixed && b.fixed) continue;
          if (a.fixed) wb = 1;
          if (b.fixed) wa = 1;
          a.x -= nx * overlap * wa;
          a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb;
          b.y += ny * overlap * wb;
        }
      }
    }

    const box = this.bounds;
    if (box) {
      for (const b of bs) {
        if (b.fixed) continue;
        b.x = Math.min(Math.max(b.x, box.x + b.r), box.x + box.w - b.r);
        b.y = Math.min(Math.max(b.y, box.y + b.r), box.y + box.h - b.r);
      }
    }
  }
}

/** Small deterministic PRNG so layouts are stable between reloads. */
export function prng(seed = 2011) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
