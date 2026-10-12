import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetPalettes, getPalette, createBubbles } from '../dist/index.js';
import { fakeCanvas } from './helpers.mjs';

// minimal browser stand-ins, with a manual animation clock
let frames = [];
let reduced = false;
beforeEach(() => {
  frames = [];
  resetPalettes();
  globalThis.window = globalThis;
  globalThis.devicePixelRatio = 1;
  globalThis.matchMedia = () => ({ matches: reduced });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => { frames = []; };
});
afterEach(() => { reduced = false; });
const run = (n, t0 = performance.now() + 16) => { for (let i = 0; i < n; i++) { const f = frames.splice(0); f.forEach((fn) => fn(t0 + i * 16)); } };

test('creates the requested number of bubbles and animates', () => {
  const c = fakeCanvas();
  const b = createBubbles(c, { count: 12 });
  assert.equal(b.bubbles.length, 12);
  run(5);
  assert.ok(c.ctx.calls.some(([k]) => k === 'clearRect'));
  b.destroy();
});

test('auto count fits the canvas area (20–48)', () => {
  const b = createBubbles(fakeCanvas(900, 600));
  assert.ok(b.bubbles.length >= 20 && b.bubbles.length <= 48);
  b.destroy();
});

test('compress packs bubbles into hexagons on a honeycomb; release frees them', () => {
  const b = createBubbles(fakeCanvas(), { count: 20, seed: 3 });
  b.compress();
  assert.equal(b.compressed, true);
  run(300);
  assert.ok(b.bubbles.every((x) => x.shape > 0.9), 'every bubble should have become a hexagon');
  assert.ok(new Set(b.bubbles.map((x) => Math.round(x.r))).size <= 2, 'tiles share one size');
  b.release();
  run(300);
  assert.ok(b.bubbles.every((x) => x.shape < 0.1));
  b.destroy();
});

test('click creates a bubble up to maxBubbles; clicking a bubble does not', () => {
  const c = fakeCanvas();
  let created = 0;
  const b = createBubbles(c, { count: 3, maxBubbles: 5, onCreate: () => created++, physics: { stiffness: 0 } });
  b.field.bubbles.forEach((x) => { x.x = x.px = 700; x.y = x.py = 450; });
  for (const p of [10, 20, 30, 40]) c.fire('click', { clientX: p, clientY: p });
  assert.equal(b.bubbles.length, 5);
  assert.equal(created, 2);
  b.destroy();
});

test('clickToCreate: false disables creation', () => {
  const c = fakeCanvas();
  const b = createBubbles(c, { count: 3, clickToCreate: false });
  c.fire('click', { clientX: 10, clientY: 10 });
  assert.equal(b.bubbles.length, 3);
  b.destroy();
});

test('options reach the engine: reaction, physics and palettes', () => {
  const b = createBubbles(fakeCanvas(), { count: 2, reaction: 9, physics: { damping: 9, gap: 5 }, palettes: { pearl: { body: '#abcdef' } } });
  assert.equal(b.field.reaction, 9);
  assert.equal(b.field.damping, 9);
  assert.equal(b.field.gap, 5);
  assert.equal(getPalette('pearl').body, '#abcdef');
  b.setReaction(2);
  assert.equal(b.field.reaction, 2);
  b.setPalette('gold', { body: '#010203' });
  assert.equal(getPalette('gold').body, '#010203');
  b.destroy();
});

test('kinds weights decide the mix', () => {
  const b = createBubbles(fakeCanvas(), { count: 40, kinds: { gold: 1 } });
  assert.ok(b.bubbles.every((x) => x.kind === 'gold'));
  b.destroy();
});

test('shake pushes bubbles and stops compressing', () => {
  const b = createBubbles(fakeCanvas(), { count: 8 });
  b.compress();
  b.shake();
  assert.equal(b.compressed, false);
  b.destroy();
});

test('remove and clear', () => {
  const b = createBubbles(fakeCanvas(), { count: 6 });
  b.remove(b.bubbles[0]);
  assert.equal(b.bubbles.length, 5);
  b.clear();
  assert.equal(b.bubbles.length, 0);
  b.destroy();
});

test('reduced motion starts as a still honeycomb', () => {
  reduced = true;
  const b = createBubbles(fakeCanvas(), { count: 10 });
  assert.equal(b.compressed, true);
  assert.ok(b.bubbles.every((x) => x.shape === 1));
  assert.equal(frames.length, 0, 'no animation loop');
  b.destroy();
});

test('destroy removes every listener and stops the loop', () => {
  const c = fakeCanvas();
  const b = createBubbles(c, { count: 4 });
  b.destroy();
  for (const set of Object.values(c.listeners)) assert.equal(set.size, 0);
  run(3);
  assert.equal(frames.length, 0);
});

test('needs a canvas', () => {
  assert.throws(() => createBubbles(null), /canvas/);
});

test('live options change the next frame', () => {
  const b = createBubbles(fakeCanvas(), { count: 3, float: 0 });
  assert.equal(b.options.float, 0);
  b.options.hoverGrow = 2;
  run(2);
  assert.ok(b.bubbles.every((x) => x.grow === 2));
  b.destroy();
});
