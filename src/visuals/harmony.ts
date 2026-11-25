// The maths behind "sympathetic strings" (DESIGN.md §3): pure functions, no canvas, no DOM.
// A chord becomes a set of just-intonation ratios; the ratios become a wave; overlapping chord layers
// blend so the picture never snaps.
import type { SimpleChord } from '../theory/simplify';

/** The chord's interval ratios (just intonation), root first. These are the wave's harmonics. */
export function chordRatios(c: SimpleChord | undefined): number[] {
  if (!c) return [1, 3 / 2];
  const s = c.chord.spec;
  const third =
    c.kind === 'major' ? 5 / 4 : c.kind === 'minor' || c.kind === 'dim' ? 6 / 5 : s.third === 'sus2' ? 9 / 8 : 4 / 3;
  const fifth = c.kind === 'dim' ? 64 / 45 : 3 / 2; // a tritone looks restless
  const out = [1, third, fifth];
  if (s.seventh === 'major') out.push(15 / 8);
  if (s.seventh === 'minor') out.push(c.kind === 'minor' ? 9 / 5 : 7 / 4);
  return out;
}

/**
 * One string's displacement at position x (0–1 along it), for line `line`, at time t, in −1…1.
 * The first ratio is weighted most; each harmonic drifts at its own speed.
 */
export function wave(ratios: readonly number[], base: number, x: number, line: number, t: number): number {
  let sum = 0;
  let norm = 0;
  for (let j = 0; j < ratios.length; j++) {
    const r = ratios[j]!;
    const w = 1 / (1 + j * 0.6);
    sum += w * Math.sin(2 * Math.PI * base * r * x + t * r * (1 + 0.13 * j) + line * 0.33 * r);
    norm += w;
  }
  return norm ? sum / norm : 0;
}

export interface Layer {
  ratios: number[];
  /** Current weight, 0–1. */
  w: number;
  /** Weight it's easing towards. */
  target: number;
}

/** The blended displacement of all layers, weighted. */
export function field(layers: readonly Layer[], base: number, x: number, line: number, t: number): number {
  let v = 0;
  let wsum = 0;
  for (const l of layers) {
    if (l.w < 0.001) continue;
    v += l.w * wave(l.ratios, base, x, line, t);
    wsum += l.w;
  }
  return wsum ? v / wsum : 0;
}

/** Frame-rate-independent easing of `cur` toward `target` at `perSecond`. */
export function approach(cur: number, target: number, dt: number, perSecond: number): number {
  return cur + (target - cur) * (1 - Math.exp(-perSecond * dt));
}

/** The beat swell (DESIGN.md §3.3): a cosine over each beat, continuous at the beat line, max +12%. */
export function beatSwell(beatFraction: number): number {
  return 0.12 * (0.5 + 0.5 * Math.cos(2 * Math.PI * beatFraction));
}

/** Base wave cycles for a chord: the vibe's cycles, nudged by the root so a new root changes the picture. */
export function baseCycles(cycles: number, rootPc: number): number {
  return cycles * (0.85 + rootPc / 40);
}
