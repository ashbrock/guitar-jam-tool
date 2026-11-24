// Roman-numeral degrees, relative to the key tonic and always measured against the major scale
// (so a minor key's chords read i, ♭III, iv, ♭VI, ♭VII — the usual pop/jazz convention).
// Secondary dominants use "V/x" (e.g. "V/ii").
import { chord as mustParse, chordSuffix, type Chord } from './chords';
import type { Key } from './keys';
import { intervalBetween, intervalAccidental, iv, mod12, spellInterval, type Note } from './notes';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];

export interface DegreeInfo {
  /** Letter steps above the tonic, 0–6. */
  steps: number;
  /** Semitones above the tonic, 0–11. */
  semis: number;
}

const SIMPLE = /^([b#♭♯]*)(VII|VI|IV|V|III|II|I)$/i;

/** Parses "bVII", "iv", "#iv", "V/ii". Case doesn't change the root; it's a label for the reader. */
export function parseDegree(id: string): DegreeInfo | null {
  const parts = id.split('/');
  if (parts.length > 2) return null;
  let steps = 0;
  let semis = 0;
  for (const part of parts) {
    const m = SIMPLE.exec(part);
    if (!m) return null;
    const idx = NUMERALS.indexOf(m[2]!.toUpperCase() as (typeof NUMERALS)[number]);
    const acc = [...m[1]!].reduce((a, c) => a + (c === 'b' || c === '♭' ? -1 : 1), 0);
    steps += idx;
    semis += MAJOR_SEMIS[idx]! + acc;
  }
  return { steps: steps % 7, semis: mod12(semis) };
}

export function isDegree(id: string): boolean {
  return parseDegree(id) !== null;
}

/** The spelled root of a degree in a key: bVII in E minor → D. */
export function degreeRoot(id: string, key: Key): Note {
  const d = parseDegree(id);
  if (!d) throw new Error(`Invalid degree "${id}"`);
  return spellInterval(key.tonic, iv(d.steps + 1, d.semis));
}

/** A degree slot made concrete: "bVII" + "maj7" in E minor → Dmaj7. */
export function resolveDegreeChord(degree: string, quality: string, key: Key, bassDegree?: string): Chord {
  // Parse the quality on a neutral root, then swap in the real one, so double-flat roots still work.
  const shape = mustParse(`C${quality}`);
  return { root: degreeRoot(degree, key), bass: bassDegree ? degreeRoot(bassDegree, key) : null, spec: shape.spec };
}

/** Numeral for a note relative to a key, e.g. F in D major → "bIII". */
export function degreeOfNote(n: Note, key: Key, lowercase = false): string {
  const i = intervalBetween(key.tonic, n);
  const acc = intervalAccidental(i);
  const numeral = NUMERALS[i.num - 1]!;
  return (acc < 0 ? 'b'.repeat(-acc) : '#'.repeat(acc)) + (lowercase ? numeral.toLowerCase() : numeral);
}

/** Turns a concrete chord into a key-relative degree slot (used when the user edits a Jam chord). */
export function chordToDegree(c: Chord, key: Key): { degree: string; quality: string; bassDegree?: string } {
  const minorish = c.spec.third === 'minor';
  const out: { degree: string; quality: string; bassDegree?: string } = {
    degree: degreeOfNote(c.root, key, minorish),
    quality: chordSuffix(c.spec),
  };
  if (c.bass) out.bassDegree = degreeOfNote(c.bass, key);
  return out;
}
