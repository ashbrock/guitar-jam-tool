import { afterEach, describe, expect, it, vi } from 'vitest';
import wurlitzer from '../data/instruments/wurlitzer-ep200.json';
import { CHORD_RANGE } from './voicing';
import { MAX_STRUM, jitterVelocity, lateBy, strumOffsets } from './humanize';
import { Sampler, pickRegion, toMidiVelocity, type InstrumentMap } from './sampler';
import { createRng } from '../theory/random';

const map = wurlitzer as InstrumentMap;

describe('Wurlitzer mapping data', () => {
  it('has four velocity layers covering 1–127 without gaps', () => {
    const layers = [...map.layers].sort((a, b) => a.lovel - b.lovel);
    expect(layers).toHaveLength(4);
    expect(layers[0]!.lovel).toBe(1);
    expect(layers[layers.length - 1]!.hivel).toBe(127);
    for (let i = 1; i < layers.length; i++) expect(layers[i]!.lovel).toBe(layers[i - 1]!.hivel + 1);
  });

  it('every region names a listed file', () => {
    for (const l of map.layers) for (const r of l.regions) expect(map.files).toContain(r.file);
  });

  it('covers every note we voice, in every layer, with no gaps', () => {
    for (const l of map.layers) {
      for (let midi = CHORD_RANGE.low; midi <= CHORD_RANGE.high; midi++) {
        expect(l.regions.some((r) => midi >= r.lokey && midi <= r.hikey), `layer ${l.lovel}-${l.hivel}, note ${midi}`).toBe(true);
      }
    }
  });
});

describe('pickRegion', () => {
  it('picks the velocity layer and the region for the note', () => {
    const soft = pickRegion(map, 61, 20)!;
    const hard = pickRegion(map, 61, 110)!;
    expect(soft.region.file).toBe('db4pp.m4a');
    expect(hard.region.file).not.toBe(soft.region.file);
    expect(hard.gain).toBeGreaterThan(soft.gain);
  });

  it('plays a recording at its own pitch (plus its tuning) on its centre note', () => {
    const p = pickRegion(map, 61, 50)!;
    expect(p.region.center).toBe(61);
    expect(p.rate).toBeCloseTo(2 ** (p.region.tune / 1200), 9);
  });

  it('never stretches a recording more than six semitones', () => {
    for (let midi = CHORD_RANGE.low; midi <= CHORD_RANGE.high; midi++) {
      for (const v of [10, 50, 80, 120]) {
        const p = pickRegion(map, midi, v)!;
        expect(Math.abs(Math.log2(p.rate) * 12), `note ${midi} vel ${v}`).toBeLessThanOrEqual(6.2);
      }
    }
  });

  it('falls back to the nearest region outside the mapped range', () => {
    expect(pickRegion(map, 20, 60)).not.toBeNull();
    expect(pickRegion(map, 110, 60)).not.toBeNull();
  });

  it('maps our 0–1 velocities into a musical MIDI range', () => {
    expect(toMidiVelocity(0)).toBe(30);
    expect(toMidiVelocity(0.7)).toBe(83);
    expect(toMidiVelocity(1)).toBe(105);
  });
});

describe('humanize', () => {
  it('rolls chords low to high, only ever later, within 30 ms', () => {
    const rand = createRng(3);
    for (let i = 0; i < 200; i++) {
      const o = strumOffsets(5, rand(), rand);
      expect(o[0]!).toBeGreaterThanOrEqual(0);
      expect(Math.max(...o)).toBeLessThanOrEqual(MAX_STRUM + 1e-9);
      for (let k = 1; k < o.length; k++) expect(o[k]!).toBeGreaterThan(o[k - 1]! - 0.0021);
    }
    expect(strumOffsets(1, 0.5)).toEqual([0]);
  });

  it('keeps velocity jitter small and in range', () => {
    const rand = createRng(9);
    for (let i = 0; i < 200; i++) {
      const v = jitterVelocity(0.7, rand);
      expect(v).toBeGreaterThanOrEqual(0.7 * 0.94 - 1e-9);
      expect(v).toBeLessThanOrEqual(0.7 * 1.06 + 1e-9);
    }
    expect(jitterVelocity(1, () => 1)).toBe(1);
  });

  it('only pushes hits late, by at most 5 ms', () => {
    const rand = createRng(1);
    for (let i = 0; i < 200; i++) {
      const d = lateBy(rand);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(0.005);
    }
  });
});

describe('Sampler.load', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ctx = { decodeAudioData: async () => ({ duration: 1 }) } as unknown as BaseAudioContext;

  it('skips a bad file instead of failing the whole instrument', async () => {
    const bad = map.files[3]!;
    vi.stubGlobal('fetch', async (url: string) => ({ ok: !url.endsWith(bad), status: 404, arrayBuffer: async () => new ArrayBuffer(8) }));
    const s = new Sampler(ctx, map, '/s/');
    const progress: number[] = [];
    expect(await s.load((d) => progress.push(d))).toBe(true);
    expect(s.status).toBe('ready');
    expect(s.missing).toEqual([bad]);
    expect(progress.at(-1)).toBe(map.files.length);
  });

  it('fails when most files are unavailable, so the synth keeps playing', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    const s = new Sampler(ctx, map, '/s/');
    expect(await s.load()).toBe(false);
    expect(s.status).toBe('failed');
  });
});
