import { describe, expect, it } from 'vitest';
import { VIBES } from '../data/vibes/index';
import { generateSong } from './song';

const bars = (s: { bars: number }[]) => s.reduce((a, x) => a + x.bars, 0);
const degrees = (s: { degree: string; bars: number }[]) => s.map((x) => `${x.degree}:${x.bars}`).join(' ');

describe('generateSong', () => {
  it('is deterministic for a seed', () => {
    const v = VIBES[0]!;
    const a = generateSong({ params: v.params, mode: 'major', lengthBars: 4, seed: 11 });
    const b = generateSong({ params: v.params, mode: 'major', lengthBars: 4, seed: 11 });
    expect(a).toEqual(b);
  });

  for (const v of VIBES) {
    for (const mode of ['major', 'minor'] as const) {
      it(`${v.name} (${mode}): verse and chorus are the same length and never the same progression`, () => {
        let newStarts = 0;
        const runs = 25;
        for (let seed = 1; seed <= runs; seed++) {
          for (const len of v.params.lengths) {
            const s = generateSong({ params: v.params, mode, lengthBars: len, seed: seed * 31 + len });
            expect(bars(s.verse)).toBe(len);
            expect(bars(s.chorus)).toBe(len);
            expect(degrees(s.chorus)).not.toBe(degrees(s.verse));
            if (s.chorus[0]!.degree !== s.verse[0]!.degree) newStarts++;
          }
        }
        // The chorus almost always starts somewhere new (fixed forms like the 12-bar blues may not).
        expect(newStarts / (runs * v.params.lengths.length)).toBeGreaterThan(0.6);
      });
    }
  }
});
