import test from 'node:test';
import assert from 'node:assert/strict';
import { BubbleField, prng, clamp, lerp, smooth } from '../dist/index.js';

const cluster = (reaction, n = 18) => {
  const f = new BubbleField({ stiffness: 30, damping: 4.2, iterations: 3, gap: 3, reaction });
  const rand = prng(7);
  const bs = [];
  for (let i = 0; i < n; i++) bs.push(f.add({ x: 300 + rand() * 400, y: 200 + rand() * 300, base: 25 + rand() * 30, grow: 1.45 }));
  for (let i = 0; i < 240; i++) f.step(1 / 60);
  for (const b of bs) { b.hx = b.x; b.hy = b.y; }
  return { f, bs };
};

test('prng is deterministic and in [0, 1)', () => {
  const a = prng(42), b = prng(42);
  for (let i = 0; i < 100; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});

test('helpers', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(smooth(0, 1, 0), 0);
  assert.equal(smooth(0, 1, 1), 1);
});

test('overlapping bubbles are pushed apart', () => {
  const f = new BubbleField({ stiffness: 0, damping: 6, iterations: 4, gap: 2 });
  const a = f.add({ x: 100, y: 100, base: 30 });
  const b = f.add({ x: 110, y: 100, base: 30 });
  for (let i = 0; i < 120; i++) f.step(1 / 60);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 30 + 30 + 2 - 0.5);
});

test('heavier bubbles move the lighter ones, not the other way round', () => {
  const f = new BubbleField({ stiffness: 0, damping: 6, iterations: 4, gap: 2 });
  const big = f.add({ x: 100, y: 100, base: 60 });
  const small = f.add({ x: 140, y: 100, base: 10 });
  for (let i = 0; i < 90; i++) f.step(1 / 60);
  assert.ok(Math.abs(big.x - 100) < Math.abs(small.x - 140));
});

test('bounds keep bubbles inside', () => {
  const f = new BubbleField({ stiffness: 0 });
  f.bounds = { x: 0, y: 0, w: 200, h: 200 };
  const b = f.add({ x: 190, y: 190, base: 20 });
  f.kick(b, 5000, 5000);
  for (let i = 0; i < 60; i++) f.step(1 / 60);
  assert.ok(b.x <= 180.001 && b.y <= 180.001);
});

test('reaction 0 leaves everything still; higher levels move neighbours further', () => {
  const spans = [];
  for (const level of [0, 3, 7, 10]) {
    const { f, bs } = cluster(level);
    const home = bs.map((b) => [b.x, b.y]);
    f.pointer.inside = true;
    let max = 0;
    for (let i = 0; i < 120; i++) {
      f.pointer.x = 250 + i * 7.5; f.pointer.y = 350 + Math.sin(i / 10) * 40;
      f.step(1 / 60);
      bs.forEach((b, k) => { const d = Math.hypot(b.x - home[k][0], b.y - home[k][1]); assert.ok(Number.isFinite(d)); max = Math.max(max, d); });
    }
    spans.push(max);
  }
  assert.ok(spans[0] < 1, `reaction 0 should leave them still, moved ${spans[0].toFixed(2)} px`);
  assert.ok(spans[0] < spans[1] && spans[1] < spans[2] && spans[2] < spans[3], `not monotonic: ${spans.map((s) => s.toFixed(0))}`);
});

test('everything comes back home once the cursor leaves', () => {
  const { f, bs } = cluster(10);
  const home = bs.map((b) => [b.x, b.y]);
  f.pointer.inside = true; f.pointer.x = 500; f.pointer.y = 350;
  for (let i = 0; i < 90; i++) { f.pointer.x += 3; f.step(1 / 60); }
  f.pointer.inside = false;
  for (let i = 0; i < 240; i++) f.step(1 / 60);
  bs.forEach((b, k) => assert.ok(Math.hypot(b.x - home[k][0], b.y - home[k][1]) < 1));
});

test('a cursor resting on a bubble does not make it tremble', () => {
  for (const level of [3, 7, 10]) {
    const { f, bs } = cluster(level, 30);
    const t = bs[14];
    f.pointer.inside = true; f.pointer.x = t.x + 3; f.pointer.y = t.y + 2;
    const xs = [], rs = [];
    for (let i = 0; i < 180; i++) { f.step(1 / 60); if (i > 60) { xs.push(t.x); rs.push(t.r); } }
    const span = (a) => Math.max(...a) - Math.min(...a);
    assert.ok(span(xs) < 1.5 && span(rs) < 0.1, `level ${level}: moves ${span(xs).toFixed(2)} px, radius ${span(rs).toFixed(2)} px`);
  }
});

test('the bubble under the cursor grows', () => {
  const f = new BubbleField({ reaction: 5 });
  const b = f.add({ x: 100, y: 100, base: 30, grow: 1.6 });
  f.pointer.inside = true; f.pointer.x = 100; f.pointer.y = 100;
  for (let i = 0; i < 120; i++) f.step(1 / 60);
  assert.ok(b.r > 30 * 1.4);
});
