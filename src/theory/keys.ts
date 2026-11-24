// Keys: conventional spellings, key scales, and spelling any pitch class in a key.
import { formatNote, intervalBetween, iv, mod12, pc, spellInterval, type Interval, type Note, type PitchClass } from './notes';
import { scaleNotes } from './scales';

export type Mode = 'major' | 'minor';

export interface Key {
  tonic: Note;
  mode: Mode;
}

const n = (letter: Note['letter'], acc = 0): Note => ({ letter, acc });

/**
 * Key tonics in circle-of-fifths order, using the conventional key signature
 * (fewest accidentals; F♯ major over G♭, E♭ minor over D♯ minor).
 */
export const KEY_TONICS: Record<Mode, readonly Note[]> = {
  major: [n('C'), n('G'), n('D'), n('A'), n('E'), n('B'), n('F', 1), n('D', -1), n('A', -1), n('E', -1), n('B', -1), n('F')],
  minor: [n('A'), n('E'), n('B'), n('F', 1), n('C', 1), n('G', 1), n('E', -1), n('B', -1), n('F'), n('C'), n('G'), n('D')],
};

/** The conventional key for a pitch class and mode, e.g. (1, 'major') → D♭ major. */
export function keyFor(tonicPc: PitchClass, mode: Mode): Key {
  const tonic = KEY_TONICS[mode].find((t) => pc(t) === mod12(tonicPc));
  if (!tonic) throw new Error(`No key for pitch class ${tonicPc}`);
  return { tonic, mode };
}

export function keyScaleNotes(key: Key): Note[] {
  return scaleNotes(key.tonic, key.mode === 'major' ? 'major' : 'naturalMinor');
}

/**
 * How chromatic (non-diatonic) notes are spelled, as intervals above the tonic.
 * Major: ♭2 ♭3 ♯4 ♭6 ♭7. Minor: ♭2, 3 (Picardy/major III), ♭5 (blue note), 6 (Dorian), 7 (leading tone).
 */
const CHROMATIC: Record<Mode, Record<number, Interval>> = {
  major: { 1: iv(2, 1), 3: iv(3, 3), 6: iv(4, 6), 8: iv(6, 8), 10: iv(7, 10) },
  minor: { 1: iv(2, 1), 4: iv(3, 4), 6: iv(5, 6), 9: iv(6, 9), 11: iv(7, 11) },
};

/** Spells any pitch class in the context of a key. */
export function spellInKey(p: PitchClass, key: Key): Note {
  const diatonic = keyScaleNotes(key).find((x) => pc(x) === mod12(p));
  if (diatonic) return diatonic;
  const semis = mod12(p - pc(key.tonic));
  const interval = CHROMATIC[key.mode][semis];
  if (!interval) throw new Error(`Unreachable: no spelling for ${semis} in ${key.mode}`);
  return spellInterval(key.tonic, interval);
}

/** Scale-degree interval of a note relative to the key tonic. */
export function degreeInKey(note: Note, key: Key): Interval {
  return intervalBetween(key.tonic, note);
}

export function formatKey(key: Key, ascii = false): string {
  return `${formatNote(key.tonic, ascii)} ${key.mode}`;
}

export function sameKey(a: Key, b: Key): boolean {
  return a.mode === b.mode && pc(a.tonic) === pc(b.tonic) && a.tonic.letter === b.tonic.letter;
}
