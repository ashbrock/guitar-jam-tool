import { describe, expect, it } from 'vitest';
import {
  chord,
  chordNotes,
  chordParts,
  formatChord,
  needsSimplifying,
  parseChord,
  spokenChord,
} from './chords';
import { formatNote } from './notes';

const notes = (s: string) => chordNotes(chord(s)).map((n) => formatNote(n, true)).join(' ');
const canonical = (s: string) => formatChord(chord(s), true);

describe('parseChord: chord tones', () => {
  it.each([
    ['C', 'C E G'],
    ['Em', 'E G B'],
    ['B7', 'B D# F# A'],
    ['Cmaj7', 'C E G B'],
    ['Am7', 'A C E G'],
    ['Asus2', 'A B E'],
    ['Dsus4', 'D G A'],
    ['D7sus4', 'D G A C'],
    ['Cadd9', 'C E G D'],
    ['C6', 'C E G A'],
    ['Am6', 'A C E F#'],
    ['C6/9', 'C E G A D'],
    ['C9', 'C E G Bb D'],
    ['Em9', 'E G B D F#'],
    ['Cmaj9', 'C E G B D'],
    ['Dm11', 'D F A C E G'],
    ['G13', 'G B D F A E'],
    ['Bm7b5', 'B D F A'],
    ['Bdim', 'B D F'],
    ['Bdim7', 'B D F Ab'],
    ['Caug', 'C E G#'],
    ['E7#9', 'E G# B D F##'],
    ['A7b9', 'A C# E G Bb'],
    ['Fmaj7#11', 'F A C E B'],
    ['G7b13', 'G B D F Eb'],
    ['E5', 'E B'],
    ['Cm(maj7)', 'C Eb G B'],
    ['Bbmaj7', 'Bb D F A'],
    ['F#m7', 'F# A C# E'],
  ])('%s → %s', (symbol, expected) => {
    expect(notes(symbol)).toBe(expected);
  });

  it('adds a slash bass that is not a chord tone at the front', () => {
    expect(notes('C/E')).toBe('C E G');
    expect(notes('C/D')).toBe('D C E G');
    expect(chord('C/E').bass).toEqual({ letter: 'E', acc: 0 });
  });
});

describe('parseChord: aliases normalise to common notation', () => {
  it.each([
    ['C-7', 'Cm7'],
    ['Cmin7', 'Cm7'],
    ['Cmi7', 'Cm7'],
    ['CΔ7', 'Cmaj7'],
    ['CΔ', 'Cmaj7'],
    ['CM7', 'Cmaj7'],
    ['CMaj9', 'Cmaj9'],
    ['Cø', 'Cm7b5'],
    ['Cø7', 'Cm7b5'],
    ['C°', 'Cdim'],
    ['C°7', 'Cdim7'],
    ['C+', 'Caug'],
    ['C7+5', 'C7#5'],
    ['Caug7', 'C7#5'],
    ['CmM7', 'Cm(maj7)'],
    ['C69', 'C6/9'],
    ['C7(b9)', 'C7b9'],
    ['C7(#9,b13)', 'C7#9b13'],
    ['Cmaj', 'C'],
    ['CM', 'C'],
    ['Csus', 'Csus4'],
    ['C7sus', 'C7sus4'],
    ['em', 'Em'],
    ['B♭7', 'Bb7'],
    ['F♯m7♭5', 'F#m7b5'],
    ['Cadd#11', 'C(#11)'],
    ['C(b5)', 'C(b5)'],
  ])('%s → %s', (input, expected) => {
    expect(canonical(input)).toBe(expected);
  });

  it('round-trips every canonical symbol', () => {
    for (const s of ['C(#11)', 'Cm7b5', 'C7#5', 'Cm(maj9)', 'C6/9/E', 'Ebm6', 'G13sus4', 'C7#9b13']) {
      expect(canonical(canonical(s))).toBe(canonical(s));
    }
  });

  it('keeps the root spelling the user typed', () => {
    expect(canonical('A#m7')).toBe('A#m7');
    expect(canonical('Bbm7')).toBe('Bbm7');
  });
});

describe('parseChord: errors', () => {
  it('rejects empty input as incomplete', () => {
    const r = parseChord('  ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'empty', incomplete: true });
  });

  it('rejects non-note roots', () => {
    const r = parseChord('Hm7');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('bad-root');
  });

  it('rejects unknown suffixes with an example-led message', () => {
    const r = parseChord('Cmaj#');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown');
      expect(r.error.message).toBe('Didn\'t recognise "Cmaj#". Try Cmaj7, Cm7♭5 or C7♯9.');
    }
    const r2 = parseChord('Cxyz');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.incomplete).toBe(false);
  });

  it('flags half-typed chords as incomplete so the UI can wait', () => {
    for (const s of ['C#m7b', 'Csu', 'Cad', 'Cmaj7#1', 'C/']) {
      const r = parseChord(s);
      expect(r.ok, s).toBe(false);
      if (!r.ok) expect(r.error.incomplete, s).toBe(true);
    }
  });

  it('rejects conflicting qualities', () => {
    const r = parseChord('Cmsus4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');
  });

  it('rejects bad slash bass notes', () => {
    const r = parseChord('C/X');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('bad-bass');
  });

  it('rejects symbols over 16 characters', () => {
    const r = parseChord('Cmaj7#11add13b9#9');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('too-long');
  });

  it('rejects impossible alterations', () => {
    expect(parseChord('C7#13').ok).toBe(false);
    expect(parseChord('C7b11').ok).toBe(false);
  });
});

describe('display and speech', () => {
  it('uses real accidentals for display', () => {
    expect(formatChord(chord('Bbmaj7'))).toBe('B♭maj7');
    expect(formatChord(chord('F#m7b5'))).toBe('F♯m7♭5');
    expect(chordParts(chord('Bb7#9/D'))).toEqual({ root: 'B♭', suffix: '7♯9', bass: 'D' });
  });

  it.each([
    ['C', 'C major'],
    ['Em9', 'E minor 9'],
    ['Bbmaj7/D', 'B flat major 7 over D'],
    ['F#m7b5', 'F sharp minor 7 flat 5'],
    ['E7#9', 'E 7 sharp 9'],
    ['Asus2', 'A sus 2'],
    ['Cm(maj7)', 'C minor major 7'],
    ['Bdim7', 'B diminished 7'],
    ['C6/9', 'C 6 9'],
    ['E5', 'E 5'],
  ])('%s is spoken as "%s"', (s, spoken) => {
    expect(spokenChord(chord(s))).toBe(spoken);
  });

  it('marks very dense chords for simplified playback', () => {
    expect(needsSimplifying(chord('Cmaj7'))).toBe(false);
    expect(needsSimplifying(chord('Dm11'))).toBe(false);
    expect(needsSimplifying(chord('C13#11'))).toBe(true);
  });
});
