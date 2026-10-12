export type Rgba = [number, number, number, number];

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba() into [r, g, b, a] (a in 0..1). */
export function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`bubble-maker: invalid colour "${input}"`);
    const v = parseInt(h, 16);
    if (Number.isNaN(v)) throw new Error(`bubble-maker: invalid colour "${input}"`);
    return h.length === 6
      ? [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1]
      : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, ((v & 255) / 255)];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (!m) throw new Error(`bubble-maker: invalid colour "${input}"`);
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]), Math.min(1, Math.max(0, a))];
}

export const rgbaString = (c: Rgba, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] * alpha).toFixed(3)})`;
