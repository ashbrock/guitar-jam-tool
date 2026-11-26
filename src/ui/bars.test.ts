import { describe, expect, it } from 'vitest';
import { blockFill, chartLines, slotStarts } from './bars';

describe('song map helpers', () => {
  it('places chords where they start, including half-bar chords', () => {
    expect(slotStarts([{ bars: 2 }, { bars: 0.5 }, { bars: 0.5 }, { bars: 1 }])).toEqual([0, 2, 2.5, 3]);
  });

  it('keeps a 4-bar section on one line', () => {
    const lines = chartLines([{ bars: 1 }, { bars: 1 }, { bars: 1 }, { bars: 1 }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(lines[0]!.every((s) => s.head && s.tail)).toBe(true);
  });

  it('wraps every 4 bars, splitting a chord that runs over a line end', () => {
    const lines = chartLines([{ bars: 3 }, { bars: 2 }, { bars: 0.5 }, { bars: 0.5 }, { bars: 2 }]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual([
      { index: 0, start: 0, bars: 3, head: true, tail: true },
      { index: 1, start: 3, bars: 1, head: true, tail: false },
    ]);
    expect(lines[1]).toEqual([
      { index: 1, start: 4, bars: 1, head: false, tail: true },
      { index: 2, start: 5, bars: 0.5, head: true, tail: true },
      { index: 3, start: 5.5, bars: 0.5, head: true, tail: true },
      { index: 4, start: 6, bars: 2, head: true, tail: true },
    ]);
    // Every line adds up to the full grid.
    for (const l of lines) expect(l.reduce((a, s) => a + s.bars, 0)).toBe(4);
  });

  it('lays a 12-bar blues out in three lines', () => {
    expect(chartLines(Array.from({ length: 12 }, () => ({ bars: 1 })))).toHaveLength(3);
  });

  it('fills a block from its start to its end', () => {
    expect(blockFill(2.25, 2, 1)).toBe(0.25);
    expect(blockFill(1, 2, 1)).toBe(0);
    expect(blockFill(5, 2, 1)).toBe(1);
    expect(blockFill(3, 2, 2)).toBe(0.5);
  });
});
