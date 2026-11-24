import { describe, expect, it } from 'vitest';
import { GROOVES, grooveById } from './grooves';
import { VIBES } from './vibes/index';

describe('grooves', () => {
  it('every vibe refers to a groove that exists, and "plain" exists for Solo', () => {
    const ids = GROOVES.map((g) => g.id);
    expect(ids).toContain('plain');
    for (const v of VIBES) expect(ids, v.id).toContain(v.playback.groove);
  });

  it('every hit sits inside the bar and is well-formed', () => {
    for (const g of GROOVES) {
      for (const s of [...g.kick, ...g.snare, ...g.hat]) expect(s >= 0 && s < 16 && Number.isInteger(s), g.id).toBe(true);
      for (const x of [...g.comp, ...g.bass]) {
        expect(x.step >= 0 && x.step < 16, g.id).toBe(true);
        expect(x.len >= 1 && x.step + x.len <= 16, `${g.id} step ${x.step}`).toBe(true);
        expect(x.vel > 0 && x.vel <= 1, g.id).toBe(true);
      }
      expect(g.comp.length, g.id).toBeGreaterThan(0);
      expect(g.bass.length, g.id).toBeGreaterThan(0);
      expect(g.comp[0]!.step, `${g.id} comp starts on the downbeat`).toBe(0);
    }
  });

  it('falls back to plain for unknown ids', () => {
    expect(grooveById('nope').id).toBe('plain');
  });
});
