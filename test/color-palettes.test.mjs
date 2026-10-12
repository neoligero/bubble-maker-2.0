import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, registerPalettes, getPalette, listPalettes, resetPalettes, defaultPalettes } from '../dist/index.js';

beforeEach(() => resetPalettes());

test('parseColor understands hex and rgb()', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('#1a2b3c'), [26, 43, 60, 1]);
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), [1, 2, 3, 1]);
  assert.deepEqual(parseColor('rgba(10,20,30,0.5)'), [10, 20, 30, 0.5]);
  assert.equal(parseColor('#ff000080')[3].toFixed(2), '0.50');
  assert.throws(() => parseColor('not a colour'));
});

test('three palettes ship by default', () => {
  assert.deepEqual(listPalettes().sort(), ['glass', 'gold', 'pearl']);
});

test('overriding one field keeps the rest', () => {
  registerPalettes({ pearl: { body: '#123456' } });
  assert.equal(getPalette('pearl').body, '#123456');
  assert.equal(getPalette('pearl').light, defaultPalettes.pearl.light);
});

test('a new palette must be complete', () => {
  assert.throws(() => registerPalettes({ rose: { body: '#f4c' } }), /missing/);
  registerPalettes({ rose: { light: '#fff', body: '#fcd', edge: '#f9b', rim: '#e78', opacity: [1, 1, 1, 1], clarity: 0.2, face: ['#fde', '#e9b'] } });
  assert.ok(listPalettes().includes('rose'));
});

test('unknown kinds fall back to pearl', () => {
  assert.equal(getPalette('does-not-exist').body, getPalette('pearl').body);
});

test('built-in palettes cannot be mutated by accident', () => {
  assert.throws(() => { 'use strict'; defaultPalettes.pearl = null; });
  registerPalettes({ pearl: { body: '#000000' } });
  assert.notEqual(defaultPalettes.pearl.body, '#000000');
});
