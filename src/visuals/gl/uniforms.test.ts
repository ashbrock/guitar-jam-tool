import { describe, expect, it } from 'vitest';
import type { Layer } from '../harmony';
import type { Scene } from '../scene';
import { vibeById } from '../../data/vibes/index';
import { glUniforms } from './uniforms';

const scene = (layers: Layer[], extra: Partial<Scene> = {}): Scene => ({
  w: 390, h: 844, look: vibeById('neo-soul')!.look, layers, base: 1.2, t: 3, swell: 0.06, presence: 1,
  colA: [255, 138, 61], colB: [255, 77, 126], changeAge: 0, beatPos: 0, levels: { bass: 0.6, mid: 0.3, treble: 0.1 }, ...extra,
});
const triad: Layer = { ratios: [1, 5 / 4, 3 / 2], w: 1, target: 1 };
const maj7: Layer = { ratios: [1, 5 / 4, 3 / 2, 15 / 8], w: 1, target: 1 };

describe('GL uniforms', () => {
  it('pads a triad to four voices with the fourth silent', () => {
    const u = glUniforms(scene([triad]));
    expect(u.ratios).toEqual([1, 5 / 4, 3 / 2, 1]);
    expect(u.voices).toEqual([1, 1, 1, 0]);
    expect(u.mix).toBe(1);
  });

  it('crossfades: the newest chord mixes in by its weight; a 7th voice fades in with it', () => {
    const u = glUniforms(scene([{ ...triad, w: 0.75, target: 0 }, { ...maj7, w: 0.25 }]));
    expect(u.ratios[3]).toBeCloseTo(15 / 8, 12);
    expect(u.prevRatios).toEqual([1, 5 / 4, 3 / 2, 1]);
    expect(u.mix).toBeCloseTo(0.25, 12);
    expect(u.voices[3]).toBeCloseTo(0.25, 12);
  });

  it('passes the audio levels through', () => {
    const u = glUniforms(scene([triad]));
    expect([u.bass, u.mid, u.treble]).toEqual([0.6, 0.3, 0.1]);
  });

  it('colours go to 0–1, and the change pulse starts at 1 and fades', () => {
    const u = glUniforms(scene([triad]));
    expect(u.colA[0]).toBe(1);
    expect(u.pulse).toBe(1);
    expect(glUniforms(scene([triad], { changeAge: 2 })).pulse).toBeLessThan(0.05);
  });
});
