// Small, musical imperfections so the backing doesn't sound like a machine. Pure: randomness is injected.
// Everything only ever moves notes *later*, never earlier, so the look-ahead scheduler stays safe.

export type Random = () => number;

/** Max total spread of a chord "roll", low note to high note, in seconds. */
export const MAX_STRUM = 0.03;

/**
 * Offsets for each note of a chord, lowest first, like fingers landing a few ms apart.
 * Softer playing rolls a little more; there's a touch of randomness so no two hits are identical.
 */
export function strumOffsets(count: number, vel: number, rand: Random = Math.random): number[] {
  if (count <= 1) return [0];
  const per = (0.006 + 0.006 * (1 - Math.min(1, Math.max(0, vel)))) * (0.8 + 0.4 * rand());
  const offsets = Array.from({ length: count }, (_, i) => i * per + rand() * 0.002);
  const max = Math.max(...offsets);
  return max > MAX_STRUM ? offsets.map((o) => (o / max) * MAX_STRUM) : offsets;
}

/** A slightly different velocity on every note (±6%), clamped to 0–1. */
export function jitterVelocity(vel: number, rand: Random = Math.random): number {
  return Math.min(1, Math.max(0, vel * (0.94 + 0.12 * rand())));
}

/** A tiny late push on a whole hit (0–5 ms), so parts don't land with machine precision. */
export function lateBy(rand: Random = Math.random): number {
  return rand() * 0.005;
}
