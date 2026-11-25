// Jam's default chord set (SPEC.md §5.6): triads, 7ths, sus and dim only. The generator's richer
// qualities (9ths, 13ths, 6/9…) are rounded to the nearest of these for display, charts and playback.
import { parseChord, type Chord } from './chords';

/** The family a chord belongs to, for visuals and colour: dominant 7ths count as major. */
export type ChordKind = 'major' | 'minor' | 'dim' | 'sus';

export interface SimpleChord {
  chord: Chord;
  kind: ChordKind;
}

/** The suffixes of the simple set, in the order we test for them. */
export const SIMPLE_SUFFIXES = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim'] as const;

const SPECS = new Map(
  SIMPLE_SUFFIXES.map((s) => {
    const r = parseChord(`C${s}`);
    if (!r.ok) throw new Error(`simple chord "${s}" doesn't parse`);
    return [s, r.chord.spec] as const;
  }),
);

/**
 * Rounds any chord to the simple set, keeping its root (a slash bass is dropped):
 * sus stays sus; diminished (or minor ♭5) → dim; minor → m, or m7 if it has a 7th or 6th;
 * everything else → major, 7 or maj7 by its 7th.
 */
export function simplify(c: Chord): SimpleChord {
  const s = c.spec;
  let suffix: (typeof SIMPLE_SUFFIXES)[number];
  let kind: ChordKind;
  if (s.third === 'sus2' || s.third === 'sus4') {
    suffix = s.third;
    kind = 'sus';
  } else if (s.seventh === 'diminished' || (s.third === 'minor' && s.fifth === 'flat')) {
    suffix = 'dim';
    kind = 'dim';
  } else if (s.third === 'minor') {
    suffix = s.seventh === 'none' && !s.sixth ? 'm' : 'm7';
    kind = 'minor';
  } else {
    suffix = s.seventh === 'major' ? 'maj7' : s.seventh === 'minor' ? '7' : '';
    kind = 'major';
  }
  return { chord: { root: c.root, bass: null, spec: SPECS.get(suffix)! }, kind };
}
