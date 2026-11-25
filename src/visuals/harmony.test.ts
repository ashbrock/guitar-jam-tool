import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory/chords';
import { simplify } from '../theory/simplify';
import { approach, baseCycles, beatSwell, chordRatios, field, wave, type Layer } from './harmony';

const simple = (s: string) => {
  const r = parseChord(s);
  if (!r.ok) throw new Error(s);
  return simplify(r.chord);
};

describe('chordRatios', () => {
  it('maps chord qualities to just-intonation ratios', () => {
    expect(chordRatios(simple('C'))).toEqual([1, 5 / 4, 3 / 2]);
    expect(chordRatios(simple('Am'))).toEqual([1, 6 / 5, 3 / 2]);
    expect(chordRatios(simple('Bdim'))).toEqual([1, 6 / 5, 64 / 45]);
    expect(chordRatios(simple('Dsus2'))).toEqual([1, 9 / 8, 3 / 2]);
    expect(chordRatios(simple('Dsus4'))).toEqual([1, 4 / 3, 3 / 2]);
    expect(chordRatios(simple('Fmaj7'))).toEqual([1, 5 / 4, 3 / 2, 15 / 8]);
    expect(chordRatios(simple('G7'))).toEqual([1, 5 / 4, 3 / 2, 7 / 4]);
    expect(chordRatios(simple('Em7'))).toEqual([1, 6 / 5, 3 / 2, 9 / 5]);
  });

  it('has a fallback for no chord', () => {
    expect(chordRatios(undefined)).toEqual([1, 3 / 2]);
  });
});

describe('wave and field', () => {
  it('stays within −1…1', () => {
    for (let i = 0; i < 500; i++) {
      const v = wave([1, 5 / 4, 3 / 2, 15 / 8], 1.4, i / 500, i % 30, i * 0.37);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it('blends layers by weight, and a layer at weight 1 alone is its own wave', () => {
    const a: Layer = { ratios: [1, 5 / 4, 3 / 2], w: 1, target: 1 };
    const b: Layer = { ratios: [1, 6 / 5, 3 / 2], w: 0, target: 0 };
    expect(field([a, b], 1.4, 0.3, 2, 1.1)).toBeCloseTo(wave(a.ratios, 1.4, 0.3, 2, 1.1), 12);
    const half = field([{ ...a, w: 0.5 }, { ...b, w: 0.5 }], 1.4, 0.3, 2, 1.1);
    expect(half).toBeCloseTo((wave(a.ratios, 1.4, 0.3, 2, 1.1) + wave(b.ratios, 1.4, 0.3, 2, 1.1)) / 2, 12);
    expect(field([], 1, 0, 0, 0)).toBe(0);
  });
});

describe('motion helpers', () => {
  it('approach is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 1, 1 / 60, 3);
    let b = 0;
    for (let i = 0; i < 30; i++) b = approach(b, 1, 1 / 30, 3);
    expect(a).toBeCloseTo(b, 9);
    expect(approach(0.4, 1, 0, 3)).toBe(0.4); // dt 0 (paused) holds still
  });

  it('beat swell is smooth and continuous across the beat line, never above 12%', () => {
    expect(beatSwell(0)).toBeCloseTo(0.12, 12);
    expect(beatSwell(1)).toBeCloseTo(0.12, 12);
    expect(beatSwell(0.5)).toBeCloseTo(0, 12);
    for (let f = 0; f <= 1; f += 0.01) expect(beatSwell(f)).toBeLessThanOrEqual(0.12 + 1e-12);
  });

  it('base cycles shift with the root', () => {
    expect(baseCycles(1.4, 0)).toBeCloseTo(1.19, 9);
    expect(baseCycles(1.4, 7)).toBeGreaterThan(baseCycles(1.4, 2));
  });
});
