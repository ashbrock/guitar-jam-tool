// Turns a Scene into the numbers the WebGL scenes read. Pure, so it's tested without a GPU.
import { voiceWeight, type Scene } from '../scene';

export interface GlUniforms {
  /** The newest chord's ratios, padded to 4 (an absent voice repeats the root). */
  ratios: [number, number, number, number];
  /** The previous chord's ratios, for the crossfade. */
  prevRatios: [number, number, number, number];
  /** 0 = previous chord, 1 = newest chord. */
  mix: number;
  /** How present each of the 4 voices is (a 7th's voice fades in with the chord). */
  voices: [number, number, number, number];
  /** 0–1 sRGB; the renderer converts to linear. */
  colA: [number, number, number];
  colB: [number, number, number];
  time: number;
  swell: number;
  presence: number;
  base: number;
  /** A soft swell after each chord change: 1 at the change, easing to 0 over about 2 s. */
  pulse: number;
  /** Seconds since the last chord change (for ripples that travel outward). */
  changeAge: number;
  /** Smoothed loudness of what's playing. */
  bass: number;
  mid: number;
  treble: number;
}

const pad4 = (r: readonly number[]): [number, number, number, number] => [r[0] ?? 1, r[1] ?? r[0] ?? 1, r[2] ?? r[0] ?? 1, r[3] ?? r[0] ?? 1];

export function glUniforms(s: Scene): GlUniforms {
  const layers = s.layers;
  const newest = layers[layers.length - 1];
  const prev = layers.length > 1 ? layers[layers.length - 2] : newest;
  const total = layers.reduce((a, l) => a + l.w, 0) || 1;
  return {
    ratios: pad4(newest?.ratios ?? [1, 5 / 4, 3 / 2]),
    prevRatios: pad4(prev?.ratios ?? [1, 5 / 4, 3 / 2]),
    mix: newest ? Math.min(1, newest.w / total) : 1,
    voices: [voiceWeight(layers, 1), voiceWeight(layers, 2), voiceWeight(layers, 3), voiceWeight(layers, 4)],
    colA: [s.colA[0]! / 255, s.colA[1]! / 255, s.colA[2]! / 255],
    colB: [s.colB[0]! / 255, s.colB[1]! / 255, s.colB[2]! / 255],
    time: s.t,
    swell: s.swell,
    presence: s.presence,
    base: s.base,
    pulse: Math.exp(-s.changeAge * 1.6),
    changeAge: s.changeAge,
    bass: s.levels.bass,
    mid: s.levels.mid,
    treble: s.levels.treble,
  };
}
