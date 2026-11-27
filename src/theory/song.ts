// A song for Jam (SPEC.md §5.9): a verse and a contrasting chorus, in the same key, tempo and length.
// The vibe picks the length (4 or 8 bars a section); each section has at most its maxChords changes.
// Pure and seeded, like the generator it builds on.
import { generate, type DegreeSlot } from './generator';
import type { Mode } from './keys';
import { createRng, pickWeighted } from './random';
import type { GeneratorParams } from './vibe';

export type Section = 'verse' | 'chorus';
export const SECTIONS: readonly Section[] = ['verse', 'chorus'];

export interface Song {
  verse: DegreeSlot[];
  chorus: DegreeSlot[];
}

/**
 * Chords a chorus likes to start on: the classic "lift" away from the verse's home. Weighted; a vibe
 * only uses the ones in its vocabulary, and the verse's own first chord is always left out.
 */
export const CHORUS_LIFT: Record<Mode, Record<string, number>> = {
  major: { IV: 5, vi: 4, ii: 2, V: 2, I: 1, '♭VII': 2, iii: 1 },
  minor: { iv: 4, '♭VI': 5, '♭III': 4, '♭VII': 3, v: 1, i: 1, IV: 2 },
};

const sameDegrees = (a: readonly DegreeSlot[], b: readonly DegreeSlot[]) =>
  a.length === b.length && a.every((s, i) => s.degree === b[i]!.degree && s.bars === b[i]!.bars);

const ATTEMPTS = 24;

/**
 * Generates a verse, then a chorus that starts somewhere new and is never the same progression. Both
 * are the same length: `lengthBars` if given (tests), otherwise picked from the vibe's weighted lengths.
 */
export function generateSong(input: { params: GeneratorParams; mode: Mode; lengthBars?: number; seed: number }): Song {
  const rng = createRng(input.seed);
  const seed = () => Math.floor(rng() * 2 ** 31);
  const lengthBars = input.lengthBars ?? pickWeighted(rng, input.params.lengths.map((l) => [l.bars, l.w] as const)) ?? 4;
  input = { ...input, lengthBars };
  const verse = generate({ params: input.params, mode: input.mode, lengthBars, seed: seed() }).slots;
  const home = verse[0]?.degree;
  const vocab = input.params.modes[input.mode].vocabulary;
  // Lift starts the vibe actually has, minus the verse's first chord. If none are left, any start but home.
  let starts = Object.fromEntries(Object.entries(CHORUS_LIFT[input.mode]).filter(([d]) => d in vocab && d !== home));
  if (Object.keys(starts).length === 0) starts = Object.fromEntries(Object.keys(vocab).filter((d) => d !== home).map((d) => [d, 1]));

  let chorus = verse;
  for (let i = 0; i < ATTEMPTS && (sameDegrees(chorus, verse) || chorus[0]?.degree === home); i++) {
    chorus = generate({ params: input.params, mode: input.mode, lengthBars, starts, seed: seed() }).slots;
  }
  // Fixed forms (a 12-bar blues) may only ever start on home: then just make sure it's a different form.
  for (let i = 0; i < ATTEMPTS && sameDegrees(chorus, verse); i++) {
    chorus = generate({ params: input.params, mode: input.mode, lengthBars, seed: seed() }).slots;
  }
  return { verse, chorus };
}
