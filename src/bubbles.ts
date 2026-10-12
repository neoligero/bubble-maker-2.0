import { BubbleField, lerp, prng, smooth, type Bubble, type FieldOptions } from './engine';
import { paintBubble, type Light } from './draw';
import { registerPalettes, type BubblePalette } from './palettes';

export interface BubblesOptions {
  /** How many bubbles to start with, or 'auto' to fit the canvas area. Default 'auto'. */
  count?: number | 'auto';
  /** Hard limit when the visitor adds more. Default 90. */
  maxBubbles?: number;
  /** Radius range as a fraction of the canvas size. Default [0.035, 0.11] (larger on phones). */
  size?: readonly [number, number];
  /** Relative weight of each palette kind in new bubbles. Default pearl 62 %, gold 24 %, glass 14 %. */
  kinds?: Record<string, number>;
  /** Registers or overrides palettes (merged field by field). */
  palettes?: Record<string, Partial<BubblePalette>>;
  /** Physics of the field. */
  physics?: FieldOptions;
  /** How much the bubbles react to the cursor, 0 (nothing) … 3 (grow on hover) … 10 (very lively). Default 5. */
  reaction?: number;
  /** Radius multiplier of the bubble under the cursor at maximum reaction. Default 1.6. */
  hoverGrow?: number;
  /** Idle drift, as a fraction of the canvas size. 0 keeps them still. Default 0.015. */
  float?: number;
  /** Light sources in canvas pixels, or a function of the canvas size. Default: two lights above the canvas. */
  lights?: Light[] | ((width: number, height: number) => Light[]);
  /** Paint for dark backgrounds (a faint room shows through each bubble). */
  dark?: boolean;
  /** Flexible glass: bubbles stretch along their motion. Default true. */
  flex?: boolean;
  /** Clicking an empty spot creates a bubble. Default true. */
  clickToCreate?: boolean;
  /** Honeycomb cell size as a fraction of the canvas size. Default 0.045 (larger on phones). */
  honeycomb?: number;
  /** Fill the canvas with a colour each frame. Default null (transparent). */
  background?: string | null;
  /** Cap on the device pixel ratio. Default 2. */
  maxDpr?: number;
  /** Seed of the pseudo-random layout, so it is the same on every load. Default 7. */
  seed?: number;
  /** Start as a still honeycomb when the visitor prefers reduced motion. Default true. */
  respectReducedMotion?: boolean;
  /** Called when a bubble is created by a click. */
  onCreate?: (bubble: Bubble) => void;
}

export interface BubbleCanvas {
  /** The physics field: add, remove or inspect bubbles directly. */
  readonly field: BubbleField;
  readonly bubbles: Bubble[];
  readonly compressed: boolean;
  /** Options in use. Changing hoverGrow, float, flex, dark, background or clickToCreate takes effect on the next frame. */
  readonly options: { hoverGrow: number; float: number; flex: boolean; dark: boolean; background: string | null; clickToCreate: boolean };
  /** Adds a bubble at a position (default: random). `radius` is in pixels. */
  add(init?: { x?: number; y?: number; radius?: number; kind?: string }): Bubble;
  remove(b: Bubble): void;
  clear(): void;
  /** Packs every bubble into a honeycomb of hexagonal tiles. */
  compress(): void;
  /** Lets the tiles go back to being bubbles. */
  release(): void;
  toggle(): boolean;
  /** Gives every bubble a random push. Default strength 2400 px/s. */
  shake(strength?: number): void;
  setReaction(level: number): void;
  /** Changes colours at runtime. */
  setPalette(kind: string, palette: Partial<BubblePalette>): void;
  resize(): void;
  start(): void;
  stop(): void;
  destroy(): void;
}

type Meta = { x: number; y: number; r: number; phase: number; slot?: { x: number; y: number; a: number } };
const DEFAULT_KINDS = { pearl: 0.62, gold: 0.24, glass: 0.14 };

export function createBubbles(target: HTMLCanvasElement | string, options: BubblesOptions = {}): BubbleCanvas {
  const canvas = typeof target === 'string' ? document.querySelector<HTMLCanvasElement>(target) : target;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) throw new Error('bubble-maker: a <canvas> element is needed');
  const o = {
    count: 'auto' as number | 'auto', maxBubbles: 90, size: [0.035, 0.11] as readonly [number, number], kinds: DEFAULT_KINDS as Record<string, number>,
    reaction: 5, hoverGrow: 1.6, float: 0.015, flex: true, clickToCreate: true, honeycomb: 0.045, background: null as string | null,
    maxDpr: 2, seed: 7, respectReducedMotion: true, dark: false, ...options,
  };
  if (o.palettes) registerPalettes(o.palettes);
  const rand = prng(o.seed);
  const field = new BubbleField({ stiffness: 18, damping: 3.2, iterations: 4, gap: 2, ...o.physics, reaction: o.reaction });
  const meta = new Map<Bubble, Meta>();
  const reducedMotion = o.respectReducedMotion && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0;
  let H = 0;
  let unit = 1;
  let compressed = false;
  let morph = 0;
  let running = false;
  let visible = true;
  let last = 0;
  let raf = 0;
  let destroyed = false;

  const pickKind = () => {
    const entries = Object.entries(o.kinds);
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = rand() * total;
    for (const [k, w] of entries) if ((r -= w) <= 0) return k;
    return entries[0]?.[0] ?? 'pearl';
  };
  const phone = () => W < 600;
  const randomRadius = () => unit * (phone() ? o.size[0] * 1.5 + rand() * o.size[1] * 0.7 : o.size[0] + rand() * (o.size[1] - o.size[0]));

  function add(init: { x?: number; y?: number; radius?: number; kind?: string } = {}) {
    const x = init.x ?? lerp(W * 0.08, W * 0.92, rand());
    const y = init.y ?? lerp(H * 0.12, H * 0.88, rand());
    const r = init.radius ?? randomRadius();
    const b = field.add({ x, y, base: r * 0.2, kind: init.kind ?? pickKind(), grow: o.hoverGrow });
    meta.set(b, { x, y, r, phase: rand() * Math.PI * 2 });
    if (compressed) lattice();
    return b;
  }

  function resize() {
    const r = canvas!.getBoundingClientRect();
    W = r.width;
    H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr);
    canvas!.width = Math.max(1, Math.round(W * dpr));
    canvas!.height = Math.max(1, Math.round(H * dpr));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    unit = Math.min(W, H * 1.4);
    field.bounds = { x: 0, y: 0, w: W, h: H };
    for (const m of meta.values()) {
      m.x = Math.min(m.x, W - 10);
      m.y = Math.min(m.y, H - 10);
    }
    if (compressed) lattice();
  }

  /** Honeycomb slots (flat-top, axial coordinates), filled from the centre outwards. */
  function lattice() {
    const list = [...meta.keys()];
    const a = unit * (phone() ? o.honeycomb * 1.5 : o.honeycomb);
    const R = (2 * a + 2) / Math.sqrt(3);
    const slots: { x: number; y: number; d: number }[] = [];
    const n = Math.ceil(Math.sqrt(list.length)) + 3;
    for (let q = -n; q <= n; q++) {
      for (let r = -n; r <= n; r++) {
        const x = W / 2 + 1.5 * R * q;
        const y = H / 2 + Math.sqrt(3) * R * (r + q / 2);
        if (x < a || x > W - a || y < a || y > H - a) continue;
        slots.push({ x, y, d: Math.hypot(x - W / 2, (y - H / 2) * 1.2) });
      }
    }
    slots.sort((s1, s2) => s1.d - s2.d);
    const pool = new Set(list);
    for (const m of meta.values()) delete m.slot;
    for (const s of slots) {
      if (!pool.size) break;
      let best: Bubble | null = null;
      let bd = Infinity;
      for (const b of pool) {
        const d = (b.x - s.x) ** 2 + (b.y - s.y) ** 2;
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (!best) break;
      pool.delete(best);
      meta.get(best)!.slot = { x: s.x, y: s.y, a };
    }
  }

  const lightsNow = (): Light[] => (typeof o.lights === 'function' ? o.lights(W, H) : o.lights ?? [{ x: W * 0.3, y: -H * 0.35 }, { x: W * 0.72, y: -H * 0.3 }]);

  function frame(now: number) {
    if (!running || destroyed) return;
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25); // a clock that jumps back never breaks the physics
    last = now;
    const t = now / 1000;
    morph = lerp(morph, compressed ? 1 : 0, 1 - Math.exp(-dt * 3));
    field.hoverEnabled = !compressed;
    for (const [b, m] of meta) {
      if (compressed && m.slot) {
        b.hx = m.slot.x;
        b.hy = m.slot.y;
        b.base = lerp(b.base, m.slot.a, 0.12);
      } else {
        b.hx = m.x + Math.sin(t * 0.7 + m.phase) * unit * o.float;
        b.hy = m.y + Math.cos(t * 0.6 + m.phase) * unit * o.float;
        b.base = lerp(b.base, m.r, 0.08);
      }
      b.shape = smooth(0.35, 1, morph);
      b.grow = o.hoverGrow;
    }
    const steps = Math.min(8, Math.max(1, Math.ceil(dt * 60)));
    for (let i = 0; i < steps; i++) field.step(dt / steps);
    draw();
    if (visible) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function draw() {
    if (o.background) {
      ctx!.fillStyle = o.background;
      ctx!.fillRect(0, 0, W, H);
    } else ctx!.clearRect(0, 0, W, H);
    const lights = lightsNow();
    for (const b of meta.keys()) paintBubble(ctx!, b, { lights, glow: morph * 0.5, wallShadow: morph > 0.4, flex: o.flex, dark: o.dark });
  }

  function start() {
    if (running || destroyed) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const pointerAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    field.pointer.x = e.clientX - r.left;
    field.pointer.y = e.clientY - r.top;
    field.pointer.inside = true;
  };
  const onMove = (e: PointerEvent) => pointerAt(e);
  const onLeave = () => (field.pointer.inside = false);
  const onDown = (e: PointerEvent) => e.pointerType !== 'mouse' && pointerAt(e); // touch: pressing grows a bubble
  let releaseTimer = 0;
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => (field.pointer.inside = false), 450);
  };
  const onClick = (e: MouseEvent) => {
    if (!o.clickToCreate) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (field.hit(x, y)) return; // tapping a bubble grows it instead of creating one
    if (meta.size >= o.maxBubbles) return;
    const b = add({ x, y, radius: unit * (phone() ? 0.05 + rand() * 0.06 : 0.03 + rand() * 0.05) });
    o.onCreate?.(b);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('click', onClick);

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(canvas);
  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
        })
      : null;
  io?.observe(canvas);

  resize();
  const n = o.count === 'auto' ? Math.round(Math.min(48, Math.max(20, (W * H) / 9000))) : o.count;
  for (let i = 0; i < n; i++) add();
  for (let i = 0; i < 200; i++) field.step(1 / 60); // settle the layout before the first frame
  if (reducedMotion) {
    compressed = true;
    morph = 1;
    lattice();
    for (const [b, m] of meta) {
      b.x = b.px = m.slot?.x ?? b.x;
      b.y = b.py = m.slot?.y ?? b.y;
      b.base = b.r = m.slot?.a ?? b.base;
      b.shape = 1;
    }
    draw();
  } else start();

  return {
    field,
    options: o,
    get bubbles() {
      return [...meta.keys()];
    },
    get compressed() {
      return compressed;
    },
    add,
    remove(b) {
      meta.delete(b);
      const i = field.bubbles.indexOf(b);
      if (i >= 0) field.bubbles.splice(i, 1);
      if (compressed) lattice();
    },
    clear() {
      meta.clear();
      field.bubbles.length = 0;
    },
    compress() {
      compressed = true;
      lattice();
    },
    release() {
      compressed = false;
    },
    toggle() {
      compressed = !compressed;
      if (compressed) lattice();
      return compressed;
    },
    shake(strength = 2400) {
      compressed = false;
      for (const b of meta.keys()) field.kick(b, (rand() - 0.5) * strength, (rand() - 0.5) * strength);
    },
    setReaction(level) {
      field.reaction = level;
    },
    setPalette(kind, palette) {
      registerPalettes({ [kind]: palette });
    },
    resize,
    start,
    stop,
    destroy() {
      destroyed = true;
      stop();
      clearTimeout(releaseTimer);
      ro?.disconnect();
      io?.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('click', onClick);
      meta.clear();
      field.bubbles.length = 0;
    },
  };
}
