# Bubble Maker 2.0

Soap bubbles for the web: bubbles that grow when you touch them, push each other out of the way, drift with the cursor and pack into a honeycomb of hexagons. No dependencies, about 14 KB minified, fully configurable.

**[Live demo](https://neoligero.github.io/bubble-maker-2.0/)** · [Español](README.es.md) · [Bubble Maker 1.0 (2013)](https://github.com/neoligero/Bubble_maker)

Bubble Maker started in 2013 as the navigation of a personal website: every section was a bubble that grew on hover and pushed its neighbours with chained timeouts. Version 2.0 is a rewrite from scratch as a small physics engine plus a painter, and it powers [neoligero.com](https://www.neoligero.com).

## Install

```bash
npm install bubble-maker
```

or, without a bundler:

```html
<script src="https://cdn.jsdelivr.net/npm/bubble-maker/dist/bubble-maker.global.js"></script>
<script>
  BubbleMaker.createBubbles(document.querySelector('canvas'));
</script>
```

## Quick start

```html
<canvas id="bubbles" style="width: 100%; height: 480px"></canvas>
```

```js
import { createBubbles } from 'bubble-maker';

const bubbles = createBubbles('#bubbles', {
  reaction: 7,                 // 0 still … 3 grow on hover … 10 very lively
  palettes: { pearl: { body: '#fdf3f6' } },
});

bubbles.compress();            // pack everything into a honeycomb
bubbles.release();             // …and let the bubbles go again
```

`createBubbles` gives you a canvas that floats, reacts to mouse and touch, creates a bubble on click, pauses when it is off screen, respects `prefers-reduced-motion` and handles high-DPI screens.

## Options

Everything is optional.

| Option | Default | What it does |
|---|---|---|
| `count` | `'auto'` | Bubbles at the start, or `'auto'` to fit the canvas (20–48). |
| `maxBubbles` | `90` | Limit when visitors add more. |
| `size` | `[0.035, 0.11]` | Radius range, as a fraction of the canvas size (phones get larger bubbles). |
| `kinds` | pearl 0.62, gold 0.24, glass 0.14 | Relative weight of each palette in new bubbles. |
| `palettes` | built-ins | Colours, see below. Merged field by field. |
| `reaction` | `5` | How much bubbles react to the cursor: `0` nothing, `3` only the bubble under the cursor grows, `10` the air around the cursor pushes bubbles away and drags them along. |
| `hoverGrow` | `1.6` | Radius multiplier of the bubble under the cursor. |
| `float` | `0.015` | Idle drift, as a fraction of the canvas size. `0` keeps them still. |
| `physics` | see below | `stiffness`, `damping`, `iterations`, `gap`. |
| `lights` | two above the canvas | `[{ x, y }]` in canvas pixels, or `(width, height) => lights`. Bubbles are lit by the nearest one. |
| `dark` | `false` | For dark backgrounds: a faint room shows through each bubble. |
| `flex` | `true` | Bubbles stretch along their motion. |
| `clickToCreate` | `true` | Clicking an empty spot creates a bubble. |
| `honeycomb` | `0.045` | Cell size of the honeycomb, as a fraction of the canvas size. |
| `background` | `null` | Fill colour for each frame; `null` keeps the canvas transparent. |
| `maxDpr` | `2` | Cap on the device pixel ratio. |
| `seed` | `7` | Seed of the pseudo-random layout: the same one on every load. |
| `respectReducedMotion` | `true` | Start as a still honeycomb for visitors who prefer reduced motion. |
| `onCreate` | – | Called with each bubble created by a click. |

Physics defaults for `createBubbles`: `{ stiffness: 18, damping: 3.2, iterations: 4, gap: 2 }`. Higher `stiffness` pulls bubbles back home faster, higher `damping` calms them, `iterations` is the number of collision passes per step, `gap` the breathing room in pixels.

### The object you get back

```ts
bubbles.add({ x, y, radius, kind })   // create a bubble
bubbles.remove(bubble)  bubbles.clear()
bubbles.compress()  bubbles.release()  bubbles.toggle()
bubbles.shake(strength = 2400)
bubbles.setReaction(8)
bubbles.setPalette('gold', { body: '#caa' })   // live
bubbles.options.hoverGrow = 2                  // live: hoverGrow, float, flex, dark, background, clickToCreate
bubbles.field                                  // the physics field
bubbles.bubbles  bubbles.compressed
bubbles.resize()  bubbles.start()  bubbles.stop()  bubbles.destroy()
```

## Colours

A palette describes a kind of bubble. Colours go from the lit centre to the rim and accept `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`.

```js
import { registerPalettes } from 'bubble-maker';

registerPalettes({
  // change one field of a built-in…
  pearl: { body: '#fdf3f6' },
  // …or add a new kind (it must be complete)
  rose: {
    light: '#fffafc', body: '#fbe0ea', edge: '#f4bdd0', rim: '#e59ab4',
    opacity: [0.95, 0.9, 0.92, 0.95],   // centre, body, edge, rim once settled
    clarity: 0.4,                        // 0 solid … 1 very see-through while floating
    face: ['#fdeef3', '#ebc3d2'],        // lit and shaded side of the hexagon tile
    shine: 1,                            // optional: highlights, 0..1
    nacre: { color: '255,226,214', alpha: 0.28 },   // optional: iridescence, or null
    glow: '244, 189, 208',               // optional: aura colour "r, g, b"
    caustic: { color: '255,248,228', alpha: 0.55 }, // optional: light focused through the bubble
    rimShade: 'rgba(255,248,230,0.72)',  // optional
    rimWidth: 0.06,                      // optional: fraction of the radius
  },
});

createBubbles(canvas, { kinds: { rose: 3, pearl: 1 } });
```

Built-in palettes: `pearl`, `gold` and `glass`. `getPalette(kind)`, `listPalettes()` and `resetPalettes()` are also exported.

## Lower level

`createBubbles` is built from two parts you can use on their own, for example to turn a menu made of DOM elements into bubbles:

```js
import { BubbleField, paintBubble } from 'bubble-maker';

const field = new BubbleField({ stiffness: 26, damping: 4, iterations: 4, gap: 6, reaction: 5 });
const a = field.add({ x: 200, y: 120, base: 50, kind: 'gold', grow: 1.35 });
field.pointer.x = mouseX; field.pointer.y = mouseY; field.pointer.inside = true;

function frame(dt) {
  field.step(dt);                       // seconds
  for (const b of field.bubbles) paintBubble(ctx, b, { lights: [{ x: 80, y: -300 }] });
}
```

A bubble has `x, y` (position), `r` (current radius), `base` (resting radius), `grow`, `hx, hy` (the point it springs back to: move it to move the bubble), `shape` (`0` circle … `1` hexagon), `alpha`, `ghost` (ignores collisions), `fixed` and `kind`. `field.hit(x, y)` finds the bubble under a point and `field.kick(bubble, vx, vy)` pushes it. Also exported: `prng`, `clamp`, `lerp`, `smooth`, `easeInOut`, `cellPath`, `parseColor`.

## Browsers

Any browser with Canvas 2D and `PointerEvent`. ES2020 output, TypeScript types included.

## Development

```bash
npm install
npm test        # builds and runs the tests (node:test)
npm run demo    # builds the demo into docs/ (served by GitHub Pages)
```

## License

[MIT](LICENSE) © 2013–2026 José Manuel Ligero Márquez
