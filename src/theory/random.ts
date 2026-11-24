// Seeded randomness so every roll is reproducible in tests.

export type Rng = () => number;

/** mulberry32: small, fast, good enough for music choices. Returns floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a key from { option: weight }. Returns null if there's nothing to pick. */
export function pickWeighted<T extends string | number>(rng: Rng, options: readonly (readonly [T, number])[]): T | null {
  const valid = options.filter(([, w]) => w > 0);
  const total = valid.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [o, w] of valid) {
    r -= w;
    if (r < 0) return o;
  }
  return valid[valid.length - 1]![0];
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
