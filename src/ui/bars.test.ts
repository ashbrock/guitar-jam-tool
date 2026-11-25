import { describe, expect, it } from 'vitest';
import { barFill, slotStarts } from './bars';

describe('bar timeline helpers', () => {
  it('fills past bars, part of the current one, none of the future', () => {
    expect([0, 1, 2, 3].map((i) => barFill(i, 2.25))).toEqual([1, 1, 0.25, 0]);
    expect(barFill(0, 0)).toBe(0);
    expect(barFill(3, 4)).toBe(1);
  });

  it('places chords where they start, including half-bar chords', () => {
    expect(slotStarts([{ bars: 2 }, { bars: 0.5 }, { bars: 0.5 }, { bars: 1 }])).toEqual([0, 2, 2.5, 3]);
  });
});
