import { describe, expect, it } from 'vitest';
import { formatNote, intervalBetween, intervalLabel, iv, parseNote, pc, spellInterval, spokenNote, type Note } from './notes';
import { SCALES, SCALE_IDS, scaleNotes } from './scales';
import { KEY_TONICS, keyFor, keyScaleNotes, spellInKey, type Key } from './keys';

const N = (s: string): Note => {
  const n = parseNote(s);
  if (!n) throw new Error(s);
  return n;
};
const names = (notes: Note[]) => notes.map((n) => formatNote(n, true)).join(' ');
const key = (tonic: string, mode: Key['mode']): Key => ({ tonic: N(tonic), mode });

describe('notes', () => {
  it('parses note names with ASCII and Unicode accidentals', () => {
    expect(N('Bb')).toEqual({ letter: 'B', acc: -1 });
    expect(N('B♭')).toEqual({ letter: 'B', acc: -1 });
    expect(N('f#')).toEqual({ letter: 'F', acc: 1 });
    expect(parseNote('H')).toBeNull();
    expect(parseNote('Cbb')).toBeNull();
  });

  it('maps notes to pitch classes, including wrap-around', () => {
    expect(pc(N('C'))).toBe(0);
    expect(pc(N('B#'))).toBe(0);
    expect(pc(N('Cb'))).toBe(11);
    expect(pc(N('Bb'))).toBe(10);
  });

  it('formats and speaks notes', () => {
    expect(formatNote(N('Eb'))).toBe('E♭');
    expect(formatNote(N('Eb'), true)).toBe('Eb');
    expect(spokenNote(N('F#'))).toBe('F sharp');
  });

  it('spells intervals by letter, not just semitones', () => {
    expect(formatNote(spellInterval(N('C'), iv(3, 3)))).toBe('E♭');
    expect(formatNote(spellInterval(N('C'), iv(2, 3)))).toBe('D♯');
    expect(formatNote(spellInterval(N('F#'), iv(3, 4)))).toBe('A♯');
    expect(formatNote(spellInterval(N('Db'), iv(7, 10)))).toBe('C♭');
    expect(formatNote(spellInterval(N('A'), iv(9, 14)))).toBe('B');
  });

  it('labels intervals between notes', () => {
    expect(intervalLabel(intervalBetween(N('C'), N('C')))).toBe('R');
    expect(intervalLabel(intervalBetween(N('C'), N('C')), true)).toBe('1');
    expect(intervalLabel(intervalBetween(N('C'), N('Eb')))).toBe('♭3');
    expect(intervalLabel(intervalBetween(N('E'), N('D')))).toBe('♭7');
    expect(intervalLabel(intervalBetween(N('C'), N('F#')))).toBe('♯4');
    expect(intervalLabel(intervalBetween(N('A'), N('G#')))).toBe('7');
  });
});

describe('scales', () => {
  it('has eleven v1 scales', () => {
    expect(SCALE_IDS).toHaveLength(11);
  });

  it.each([
    ['C', 'major', 'C D E F G A B'],
    ['A', 'naturalMinor', 'A B C D E F G'],
    ['E', 'minorPentatonic', 'E G A B D'],
    ['A', 'minorBlues', 'A C D Eb E G'],
    ['G', 'majorPentatonic', 'G A B D E'],
    ['C', 'majorBlues', 'C D Eb E G A'],
    ['D', 'dorian', 'D E F G A B C'],
    ['G', 'mixolydian', 'G A B C D E F'],
    ['F', 'lydian', 'F G A B C D E'],
    ['E', 'phrygian', 'E F G A B C D'],
    ['A', 'harmonicMinor', 'A B C D E F G#'],
    ['F#', 'major', 'F# G# A# B C# D# E#'],
    ['Eb', 'naturalMinor', 'Eb F Gb Ab Bb Cb Db'],
  ] as const)('%s %s = %s', (root, id, expected) => {
    expect(names(scaleNotes(N(root), id))).toBe(expected);
  });

  it('every scale has unique letters except the blues scales', () => {
    for (const id of SCALE_IDS) {
      if (id === 'minorBlues' || id === 'majorBlues') continue;
      const letters = scaleNotes(N('C'), id).map((n) => n.letter);
      expect(new Set(letters).size, id).toBe(letters.length);
      expect(SCALES[id].intervals[0]).toEqual(iv(1, 0));
    }
  });
});

describe('keys', () => {
  it('lists 12 tonics per mode covering every pitch class', () => {
    for (const mode of ['major', 'minor'] as const) {
      expect(new Set(KEY_TONICS[mode].map(pc)).size).toBe(12);
    }
  });

  it('uses conventional spellings for ambiguous keys', () => {
    expect(formatNote(keyFor(1, 'major').tonic)).toBe('D♭');
    expect(formatNote(keyFor(6, 'major').tonic)).toBe('F♯');
    expect(formatNote(keyFor(3, 'minor').tonic)).toBe('E♭');
    expect(formatNote(keyFor(10, 'minor').tonic)).toBe('B♭');
    expect(formatNote(keyFor(1, 'minor').tonic)).toBe('C♯');
  });

  it('every conventional key scale uses only one kind of accidental', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const tonic of KEY_TONICS[mode]) {
        const accs = keyScaleNotes({ tonic, mode }).map((n) => n.acc);
        expect(accs.some((a) => a > 0) && accs.some((a) => a < 0), formatNote(tonic) + mode).toBe(false);
        expect(accs.every((a) => Math.abs(a) <= 1)).toBe(true);
      }
    }
  });

  it('spells diatonic notes from the key signature', () => {
    expect(formatNote(spellInKey(10, key('F', 'major')))).toBe('B♭');
    expect(formatNote(spellInKey(6, key('D', 'major')))).toBe('F♯');
  });

  it('spells chromatic notes by function', () => {
    // Major: ♭3, ♭7, ♯4
    expect(formatNote(spellInKey(5, key('D', 'major')))).toBe('F');
    expect(formatNote(spellInKey(0, key('D', 'major')))).toBe('C');
    expect(formatNote(spellInKey(8, key('D', 'major')))).toBe('G♯');
    // Minor: leading tone, blue note, major 3rd
    expect(formatNote(spellInKey(8, key('A', 'minor')))).toBe('G♯');
    expect(formatNote(spellInKey(10, key('E', 'minor')))).toBe('B♭');
    expect(formatNote(spellInKey(8, key('E', 'minor')))).toBe('G♯');
  });

  it('can spell all 12 pitch classes in all 24 keys', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const tonic of KEY_TONICS[mode]) {
        for (let p = 0; p < 12; p++) {
          const n = spellInKey(p, { tonic, mode });
          expect(pc(n)).toBe(p);
          expect(Math.abs(n.acc)).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});
