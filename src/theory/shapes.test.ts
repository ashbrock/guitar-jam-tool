import { describe, expect, it } from 'vitest';
import { chord, chordPcs, parseChord } from './chords';
import { KEY_TONICS } from './keys';
import { formatNote, pc } from './notes';
import { basicQuality, basicShape, MAX_SPAN, shapeMatchesChord, type BasicQuality } from './shapes';

const QUALITIES: BasicQuality[] = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim'];
// Every root spelling a key can produce.
const ROOTS = [...new Set([...KEY_TONICS.major, ...KEY_TONICS.minor].map((n) => formatNote(n, true)))];

describe('basicQuality', () => {
  it.each([
    ['C', ''], ['Am', 'm'], ['G7', '7'], ['Fmaj7', 'maj7'], ['Dm7', 'm7'], ['Asus2', 'sus2'], ['Dsus4', 'sus4'], ['Bdim', 'dim'],
  ] as const)('%s → "%s"', (s, q) => {
    expect(basicQuality(chord(s))).toBe(q);
  });

  it.each(['C9', 'Cm9', 'C6', 'Cadd9', 'C/E', 'C7#9', 'Cm7b5', 'C5', 'Caug', 'C7sus4'])('%s is outside the default set', (s) => {
    expect(basicQuality(chord(s))).toBeNull();
  });
});

describe('basicShape', () => {
  it('covers every root in every default quality, within five frets, with only chord tones', () => {
    for (const r of ROOTS) {
      for (const q of QUALITIES) {
        const c = parseChord(`${r}${q}`);
        expect(c.ok, `${r}${q}`).toBe(true);
        if (!c.ok) continue;
        const s = basicShape(c.chord, q)!;
        const name = `${r}${q}`;
        expect(s, name).not.toBeNull();
        expect(s.frets).toHaveLength(6);
        const fretted = s.frets.filter((f) => f > 0);
        if (fretted.length) expect(Math.max(...fretted) - s.baseFret, name).toBeLessThan(MAX_SPAN);
        expect(shapeMatchesChord(s, c.chord), `${name} plays a non-chord tone: ${s.frets.join(' ')}`).toBe(true);
        // The root is present, and so is the 3rd (or sus tone).
        expect(s.roots.length, `${name} has no root`).toBeGreaterThan(0);
        const sounding = new Set(s.notes.filter((n) => n !== null));
        expect(sounding.size, `${name} misses chord tones: ${s.frets.join(' ')}`).toBeGreaterThanOrEqual(Math.min(3, chordPcs(c.chord).size));
        // At least four strings sound, and fingers are only on fretted strings.
        expect(s.frets.filter((f) => f >= 0).length, name).toBeGreaterThanOrEqual(4);
        s.frets.forEach((f, i) => {
          if (f <= 0) expect(s.fingers[i], `${name} string ${i}`).toBe(0);
          else expect(s.fingers[i], `${name} string ${i}`).toBeGreaterThan(0);
        });
      }
    }
  });

  it('prefers open shapes', () => {
    expect(basicShape(chord('C'), '')!.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(basicShape(chord('Em7'), 'm7')!.frets).toEqual([0, 2, 0, 0, 0, 0]);
    expect(basicShape(chord('Dmaj7'), 'maj7')!.frets).toEqual([-1, -1, 0, 2, 2, 2]);
  });

  it('uses the lower barre shape when there is no open shape', () => {
    // F♯m7: E-shape at 2 beats A-shape at 9.
    const s = basicShape(chord('F#m7'), 'm7')!;
    expect(s.frets).toEqual([2, 4, 2, 2, 2, 2]);
    expect(s.barre).toEqual([2, 0, 5]);
    // Bm: A-shape at 2 beats E-shape at 7.
    expect(basicShape(chord('Bm'), 'm')!.frets).toEqual([-1, 2, 4, 4, 3, 2]);
    // C♯dim: A-shape (x4565x).
    expect(basicShape(chord('C#dim'), 'dim')!.frets).toEqual([-1, 4, 5, 6, 5, -1]);
  });

  it('computes roots from the notes, including second roots', () => {
    expect(basicShape(chord('Asus4'), 'sus4')!.roots).toEqual([1, 3]); // A and the A on the G string
    expect(basicShape(chord('C#dim'), 'dim')!.roots).toEqual([1, 3]);
    expect(basicShape(chord('G'), '')!.roots.map((i) => i)).toEqual([0, 3, 5]);
  });

  it('places the chart: base fret 1 near the nut, otherwise the lowest fretted note', () => {
    expect(basicShape(chord('F#m7'), 'm7')!.baseFret).toBe(1);
    expect(basicShape(chord('C#dim'), 'dim')!.baseFret).toBe(4);
    expect(basicShape(chord('Ebm7'), 'm7')!.baseFret).toBe(6);
  });

  it('spells nothing: roots are pitch classes, so enharmonic roots share shapes', () => {
    expect(basicShape(chord('Bb'), '')!.frets).toEqual(basicShape(chord('A#'), '')!.frets);
    expect(pc(chord('Bb').root)).toBe(10);
  });
});
