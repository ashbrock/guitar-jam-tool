import { describe, expect, it } from 'vitest';
import { VIBES, vibeById } from './index';
import { vibeProblems, parseVibe, type Vibe } from '../../theory/vibe';
import { chord, chordSuffix } from '../../theory/chords';
import { generate } from '../../theory/generator';
import { KEY_TONICS } from '../../theory/keys';
import { resolveDegreeChord } from '../../theory/degrees';
import { totalBars } from '../../theory/progression';

describe('vibe data', () => {
  it('ships six vibes with unique ids', () => {
    expect(VIBES.map((v) => v.id)).toEqual(['neo-soul', 'blues', 'soul-roots', 'heartland', 'dreamy', 'desert-groove']);
    expect(vibeById('blues')?.name).toBe('Blues');
  });

  it.each(VIBES.map((v) => [v.id, v] as const))('%s passes validation', (_id, v) => {
    expect(vibeProblems(v)).toEqual([]);
  });

  it.each(VIBES.map((v) => [v.id, v] as const))('%s writes qualities in canonical form', (_id, v) => {
    for (const mode of ['major', 'minor'] as const) {
      for (const qualities of Object.values(v.params.modes[mode].vocabulary)) {
        for (const q of Object.keys(qualities)) expect(chordSuffix(chord(`C${q}`).spec), q).toBe(q);
      }
    }
  });

  it('only Blues offers 12 bars', () => {
    expect(VIBES.filter((v) => v.params.lengths.includes(12)).map((v) => v.id)).toEqual(['blues']);
  });

  it('rejects broken vibe data with readable problems', () => {
    const broken = structuredClone(VIBES[0]!) as Vibe;
    broken.params.modes.major.transitions.I = { nowhere: 1 };
    broken.params.modes.major.vocabulary.ii = { xyz: 1 };
    broken.playback.tempo.default = 300;
    const problems = vibeProblems(broken).join('\n');
    expect(problems).toMatch(/"nowhere" not in vocabulary/);
    expect(problems).toMatch(/"xyz" is not a valid chord quality/);
    expect(problems).toMatch(/tempo/);
    expect(() => parseVibe(broken)).toThrow(/Invalid vibe/);
  });
});

describe('every vibe generates usable progressions', () => {
  for (const vibe of VIBES) {
    for (const mode of ['major', 'minor'] as const) {
      for (const lengthBars of vibe.params.lengths) {
        it(`${vibe.id} ${mode} ${lengthBars} bars, 200 seeds, all 12 keys`, () => {
          let relaxedCount = 0;
          for (let seed = 1; seed <= 200; seed++) {
            const { slots, relaxed } = generate({ params: vibe.params, mode, lengthBars, seed });
            if (relaxed.length) relaxedCount++;
            expect(totalBars(slots)).toBe(lengthBars);
            expect(slots.length).toBeGreaterThanOrEqual(vibe.params.minChords);
            for (const s of slots) expect(vibe.params.modes[mode].vocabulary[s.degree], s.degree).toBeDefined();
            if (seed <= 10) {
              for (const tonic of KEY_TONICS[mode]) {
                for (const s of slots) expect(() => resolveDegreeChord(s.degree, s.quality, { tonic, mode })).not.toThrow();
              }
            }
          }
          // The rules should almost never need relaxing without locks.
          expect(relaxedCount).toBeLessThanOrEqual(4);
        });
      }
    }
  }
});

describe('vibe looks (visuals)', () => {
  it('every vibe has a valid look, and the six looks differ', () => {
    for (const v of VIBES) expect(vibeProblems(v).filter((p) => p.includes('look'))).toEqual([]);
    const keys = new Set(VIBES.map((v) => JSON.stringify(v.look)));
    expect(keys.size).toBe(VIBES.length);
  });

  it('reports a bad look', () => {
    const v = structuredClone(vibeById('dreamy')!) as Vibe;
    v.look = { ...v.look, style: 'swirls' as 'road', major: ['#fff', '#000000'], lines: 0 };
    const problems = vibeProblems(v).join('\n');
    expect(problems).toContain('look.style');
    expect(problems).toContain('look.major');
    expect(problems).toContain('look.lines');
  });
});
