// Small deterministic helpers. The city is laid out from one seeded
// stream, so the Meridian Bay a player learns on day one is the same city
// on day ten; traffic and pedestrians draw from the same stream after it.

/** sfc32 — a small fast seeded PRNG with a long period. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  let b = (seed * 2654435761) >>> 0;
  let c = (seed * 40503) >>> 0;
  let counter = 1;
  return function next() {
    a >>>= 0; b >>>= 0; c >>>= 0;
    let t = (a + b + counter++) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    t = (t + a) >>> 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Uniform integer in [min, max], inclusive. */
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/** One element of an array, uniformly. */
export function choice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher-Yates shuffle, in place, from the seeded stream. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed turn from angle a to angle b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Flat (x/z) distance between two points. */
export function flatDist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
