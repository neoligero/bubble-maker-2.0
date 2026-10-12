# Bubble Maker 2.0

Burbujas de jabón para la web: crecen al tocarlas, se empujan unas a otras, se mueven con el cursor y se comprimen en un panal de hexágonos. Sin dependencias, unos 14 KB minificado y totalmente configurable.

**[Demo en vivo](https://neoligero.github.io/bubble-maker-2.0/)** · [English](README.md) · [Bubble Maker 1.0 (2013)](https://github.com/neoligero/Bubble_maker)

Bubble Maker nació en 2013 como la navegación de una web personal: cada sección era una burbuja que crecía al pasar el ratón y empujaba a sus vecinas con temporizadores encadenados. La 2.0 es una reescritura desde cero: un pequeño motor de física más un pintor. Es lo que da vida a [neoligero.com](https://www.neoligero.com).

## Instalación

```bash
npm install bubble-maker
```

## Uso rápido

```html
<canvas id="burbujas" style="width: 100%; height: 480px"></canvas>
```

```js
import { createBubbles } from 'bubble-maker';

const burbujas = createBubbles('#burbujas', {
  reaction: 7,                                  // 0 quietas … 3 solo crece al pasar … 10 muy vivas
  palettes: { pearl: { body: '#fdf3f6' } },     // colores
});

burbujas.compress();   // todas al panal
burbujas.release();    // y vuelven a ser burbujas
```

## Qué se puede configurar

Todo es opcional. Las más útiles:

- **`reaction`** (0–10): cuánto reaccionan al cursor. `0` nada, `3` solo crece la que tocas, `10` el aire alrededor del cursor las empuja y arrastra.
- **`count`, `maxBubbles`, `size`, `kinds`**: cuántas, el límite, su tamaño y la mezcla de tipos (perla, oro, cristal o los tuyos).
- **`palettes`**: colores de cada tipo (centro iluminado, cuerpo, borde, aro), transparencia, brillo, nácar, aura. Acepta `#hex`, `rgb()` y `rgba()`. Puedes cambiar un solo campo de una paleta existente o crear tipos nuevos.
- **`physics`**: `stiffness` (cuánto vuelven a su sitio), `damping` (cuánto se calman), `iterations` y `gap` (separación entre burbujas).
- **`hoverGrow`, `float`, `lights`, `dark`, `flex`, `honeycomb`, `background`, `seed`…**

La tabla completa de opciones, la API (`add`, `remove`, `compress`, `release`, `shake`, `setReaction`, `setPalette`, `destroy`…) y el uso a bajo nivel (`BubbleField` y `paintBubble`, por ejemplo para convertir un menú HTML en burbujas) están en el [README en inglés](README.md).

## Licencia

[MIT](LICENSE) © 2013–2026 José Manuel Ligero Márquez
