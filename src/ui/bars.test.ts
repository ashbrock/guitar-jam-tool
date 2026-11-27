import { describe, expect, it } from 'vitest';
import { beatIndex, slotStarts } from './bars';

describe('song map helpers', () => {
  it('places chords where they start, including half-bar chords', () => {
    expect(slotStarts([{ bars: 2 }, { bars: 0.5 }, { bars: 0.5 }, { bars: 1 }])).toEqual([0, 2, 2.5, 3]);
  });

  it('finds the beat playing inside a chord, and -1 outside it', () => {
    expect(beatIndex(1, 1, 1)).toBe(0);
    expect(beatIndex(1.74, 1, 1)).toBe(2);
    expect(beatIndex(1.999, 1, 1)).toBe(3);
    expect(beatIndex(2, 1, 1)).toBe(-1);
    expect(beatIndex(0.5, 1, 1)).toBe(-1);
    // A 2-bar chord has eight beats.
    expect(beatIndex(3.75, 2, 2)).toBe(7);
  });
});
