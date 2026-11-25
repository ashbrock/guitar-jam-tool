// What every visual style is given each frame (DESIGN.md §3). The renderer keeps the easing state;
// styles only draw. Shared helpers for colour live here too.
import type { VibeLook } from '../theory/vibe';
import type { Layer } from './harmony';
import type { AudioLevels } from '../audio/levels';

export interface Scene {
  w: number;
  h: number;
  look: VibeLook;
  /** Harmonic layers (crossfading chords), each with its ratios and current weight. */
  layers: readonly Layer[];
  /** Base wave cycles across the screen (shifts with the chord root). */
  base: number;
  /** Drift time: advances with tempo while playing, frozen while paused. */
  t: number;
  /** The beat swell, 0–0.12 (DESIGN.md §3.3). */
  swell: number;
  /** 0 = hidden, 1 = fully shown. Multiply every alpha by it. */
  presence: number;
  /** Gradient end colours as [r, g, b], easing between the vibe's major and minor pairs. */
  colA: readonly number[];
  colB: readonly number[];
  /** Seconds since the last chord change (frozen while paused). */
  changeAge: number;
  /** Continuous position in beats from the start of the loop, from the audio clock (frozen while paused). */
  beatPos: number;
  /** Smoothed loudness of what's playing, by band, 0–1 (held while paused; 0 under reduced motion). */
  levels: AudioLevels;
}

/** A colour between A (0) and B (1), with alpha. */
export function mix(a: readonly number[], b: readonly number[], k: number, alpha = 1): string {
  const c = a.map((x, i) => Math.round(x + (b[i]! - x) * k));
  return `rgb(${c[0]} ${c[1]} ${c[2]} / ${Math.max(0, Math.min(1, alpha))})`;
}

/** Weight of the layers that have at least `n` chord tones: how present an nth voice is. */
export function voiceWeight(layers: readonly Layer[], n: number): number {
  let on = 0;
  let all = 0;
  for (const l of layers) {
    all += l.w;
    if (l.ratios.length >= n) on += l.w;
  }
  return all ? on / all : 0;
}

/** How much the sounding chord leans on a given ratio (e.g. a dominant 7th's 7/4), 0–1. */
export function ratioWeight(layers: readonly Layer[], ratio: number): number {
  let on = 0;
  let all = 0;
  for (const l of layers) {
    all += l.w;
    if (l.ratios.some((r) => Math.abs(r - ratio) < 1e-9)) on += l.w;
  }
  return all ? on / all : 0;
}
