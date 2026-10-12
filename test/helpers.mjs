// A recording stand-in for CanvasRenderingContext2D: every call is accepted and logged.
export function fakeContext() {
  const calls = [];
  const stops = [];
  const sets = []; // every property assignment, in order
  const grad = () => ({ addColorStop: (o, c) => stops.push([o, c]) });
  const ctx = new Proxy(
    { calls, stops, sets },
    {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad();
        return (...a) => { calls.push([k, ...a]); };
      },
      set(t, k, v) { t.sets.push([k, v]); t[k] = v; return true; },
    },
  );
  return ctx;
}
export function fakeCanvas(w = 800, h = 500) {
  const ctx = fakeContext();
  const listeners = {};
  return {
    ctx, listeners, width: 0, height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener: (type, fn) => ((listeners[type] ??= new Set()).add(fn)),
    removeEventListener: (type, fn) => listeners[type]?.delete(fn),
    fire: (type, e) => listeners[type]?.forEach((fn) => fn(e)),
  };
}
