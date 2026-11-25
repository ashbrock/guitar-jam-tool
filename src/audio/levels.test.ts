import { describe, expect, it } from 'vitest';
import { bandLevels } from './levels';

const fft = 1024;
const rate = 48000;
const binHz = rate / fft; // 46.9 Hz per bin
const spectrum = (fill: (hz: number) => number) => Uint8Array.from({ length: fft / 2 }, (_, i) => fill(i * binHz));

describe('bandLevels', () => {
  it('is silent for silence and full for full scale', () => {
    expect(bandLevels(spectrum(() => 0), rate, fft)).toEqual({ bass: 0, mid: 0, treble: 0 });
    expect(bandLevels(spectrum(() => 255), rate, fft)).toEqual({ bass: 1, mid: 1, treble: 1 });
  });

  it('puts energy in the right band', () => {
    const bassOnly = bandLevels(spectrum((hz) => (hz < 240 ? 200 : 0)), rate, fft);
    expect(bassOnly.bass).toBeGreaterThan(0.6);
    expect(bassOnly.mid).toBeLessThan(0.05);
    expect(bassOnly.treble).toBe(0);
    const hats = bandLevels(spectrum((hz) => (hz > 2100 && hz < 7900 ? 255 : 0)), rate, fft);
    expect(hats.treble).toBeGreaterThan(0.9);
    expect(hats.bass).toBe(0);
  });
});
