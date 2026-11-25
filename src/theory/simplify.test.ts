import { describe, expect, it } from 'vitest';
import { chordParts, parseChord } from './chords';
import { simplify } from './simplify';

const name = (input: string) => {
  const r = parseChord(input);
  if (!r.ok) throw new Error(input);
  const s = simplify(r.chord);
  const { root, suffix } = chordParts(s.chord);
  return `${root}${suffix} ${s.kind}`;
};

describe('simplify (Jam chord set)', () => {
  it('keeps chords already in the set', () => {
    expect(name('C')).toBe('C major');
    expect(name('Em')).toBe('Em minor');
    expect(name('G7')).toBe('G7 major');
    expect(name('Fmaj7')).toBe('Fmaj7 major');
    expect(name('Am7')).toBe('Am7 minor');
    expect(name('Dsus2')).toBe('Dsus2 sus');
    expect(name('Asus4')).toBe('Asus4 sus');
    expect(name('Bdim')).toBe('Bdim dim');
  });

  it('rounds extensions down to 7ths', () => {
    expect(name('Em9')).toBe('Em7 minor');
    expect(name('A13')).toBe('A7 major');
    expect(name('Dmaj9')).toBe('Dmaj7 major');
    expect(name('C6')).toBe('C major');
    expect(name('Am6')).toBe('Am7 minor');
    expect(name('G7sus4')).toBe('Gsus4 sus');
  });

  it('treats half-diminished and diminished 7th as dim', () => {
    expect(name('Bm7b5')).toBe('Bdim dim');
    expect(name('C#dim7')).toBe('C♯dim dim');
  });

  it('keeps the root spelling and drops a slash bass', () => {
    expect(name('Bbmaj7')).toBe('B♭maj7 major');
    expect(name('C/E')).toBe('C major');
  });
});
