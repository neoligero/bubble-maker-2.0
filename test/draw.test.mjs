import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { paintBubble, registerPalettes, resetPalettes, BubbleField } from '../dist/index.js';
import { fakeContext } from './helpers.mjs';

beforeEach(() => resetPalettes());
const bubble = (kind, over = {}) => new BubbleField().add({ x: 100, y: 100, base: 40, kind, ...over });

test('every built-in kind paints without throwing, at every stage of the morph', () => {
  for (const kind of ['pearl', 'gold', 'glass']) {
    for (const shape of [0, 0.3, 0.6, 0.8, 1]) {
      const ctx = fakeContext();
      paintBubble(ctx, bubble(kind, { shape }), { lights: [{ x: 60, y: -300 }, { x: 200, y: -280 }], glow: 0.5, wallShadow: true, flex: true });
      assert.ok(ctx.calls.length > 5, `${kind} @ ${shape}`);
    }
  }
});

test('invisible or tiny bubbles are skipped', () => {
  const a = fakeContext(); paintBubble(a, bubble('pearl', { alpha: 0 }));
  const b = fakeContext(); paintBubble(b, bubble('pearl', { base: 0.2, r: 0.2 }));
  assert.equal(a.calls.length + b.calls.length, 0);
});

test('palette colours reach the canvas', () => {
  registerPalettes({ pearl: { body: '#123456', opacity: [1, 1, 1, 1], clarity: 0 } });
  const ctx = fakeContext();
  paintBubble(ctx, bubble('pearl'));
  assert.ok(ctx.stops.some(([, c]) => c.startsWith('rgba(18,52,86,')), 'the body colour #123456 should appear in a gradient stop');
});

test('palettes can be changed between frames', () => {
  const b = bubble('pearl');
  const first = fakeContext(); paintBubble(first, b);
  registerPalettes({ pearl: { light: '#ff0000' } });
  const second = fakeContext(); paintBubble(second, b);
  assert.ok(second.stops.some(([, c]) => c.startsWith('rgba(255,0,0,')));
  assert.ok(!first.stops.some(([, c]) => c.startsWith('rgba(255,0,0,')));
});

test('only palettes with a glow show an aura', () => {
  const aura = (ctx) => ctx.sets.some(([k, v]) => k === 'shadowColor' && String(v).includes('240, 206, 128'));
  const pearl = fakeContext(); paintBubble(pearl, bubble('pearl'), { glow: 1 });
  const gold = fakeContext(); paintBubble(gold, bubble('gold'), { glow: 1 });
  const none = fakeContext(); paintBubble(none, bubble('gold'), { glow: 0 });
  assert.equal(aura(pearl), false, 'pearl has no glow');
  assert.equal(aura(gold), true, 'gold glows');
  assert.equal(aura(none), false, 'glow 0 switches it off');
});

test('the dark option paints the room inside', () => {
  const light = fakeContext(); paintBubble(light, bubble('pearl'));
  const dark = fakeContext(); paintBubble(dark, bubble('pearl'), { dark: true });
  assert.ok(dark.calls.filter(([k]) => k === 'fill').length > light.calls.filter(([k]) => k === 'fill').length);
});

test('the palette example from the README is valid and paints', () => {
  registerPalettes({
    pearl: { body: '#fdf3f6' },
    rose: {
      light: '#fffafc', body: '#fbe0ea', edge: '#f4bdd0', rim: '#e59ab4',
      opacity: [0.95, 0.9, 0.92, 0.95], clarity: 0.4, face: ['#fdeef3', '#ebc3d2'],
      shine: 1, nacre: { color: '255,226,214', alpha: 0.28 }, glow: '244, 189, 208',
      caustic: { color: '255,248,228', alpha: 0.55 }, rimShade: 'rgba(255,248,230,0.72)', rimWidth: 0.06,
    },
  });
  const ctx = fakeContext();
  paintBubble(ctx, bubble('rose'), { glow: 1 });
  assert.ok(ctx.stops.some(([, c]) => c.startsWith('rgba(251,224,234,')), 'rose body colour');
  assert.ok(ctx.sets.some(([k, v]) => k === 'shadowColor' && String(v).includes('244, 189, 208')), 'rose aura colour');
});
