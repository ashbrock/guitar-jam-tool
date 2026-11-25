import { describe, expect, it } from 'vitest';
import { VIBES } from '../../data/vibes/index';
import { VISUAL_STYLES } from '../../theory/vibe';
import type { Layer } from '../harmony';
import type { Scene } from '../scene';
import { curtainAlpha, CURTAINS, jitter, streakLength } from './aurora';
import { ridgeBase, ridgeScale } from './dunes';
import { closedLoop, pulseBoost, pulseRadius } from './grooves';
import { drawStyle, resolutionFor } from './index';
import { ribbonAlphas, ribbonCentre } from './ribbons';
import { HORIZON, lineDepth, roadY } from './road';
import { plumeCount, restlessness, smokeSpread } from './smoke';

const triad: Layer = { ratios: [1, 5 / 4, 3 / 2], w: 1, target: 1 };
const dom7: Layer = { ratios: [1, 5 / 4, 3 / 2, 7 / 4], w: 1, target: 1 };
const maj7: Layer = { ratios: [1, 5 / 4, 3 / 2, 15 / 8], w: 1, target: 1 };

describe('each vibe has its own style', () => {
  it('six vibes, six different styles, all known', () => {
    const styles = VIBES.map((v) => v.look.style);
    expect(new Set(styles).size).toBe(6);
    for (const s of styles) expect(VISUAL_STYLES).toContain(s);
  });
});

describe('resolution', () => {
  it('hazy styles draw at 1×, crisp ones at device resolution up to 2×', () => {
    expect(resolutionFor('smoke', 3)).toBe(1);
    expect(resolutionFor('aurora', 2)).toBe(1);
    expect(resolutionFor('road', 3)).toBe(2);
    expect(resolutionFor('grooves', 1)).toBe(1);
  });
});

describe('ribbons (Neo-soul)', () => {
  it('one ribbon per chord tone: a 7th grows a fourth, fading with the crossfade', () => {
    expect(ribbonAlphas([triad])).toEqual([1, 1, 1, 0]);
    expect(ribbonAlphas([maj7])).toEqual([1, 1, 1, 1]);
    const half = ribbonAlphas([{ ...triad, w: 0.5 }, { ...maj7, w: 0.5 }]);
    expect(half[3]).toBeCloseTo(0.5, 9);
  });
  it('ribbons sit around the middle of the screen', () => {
    for (let i = 0; i < 4; i++) expect(Math.abs(ribbonCentre(i) - 0.5)).toBeLessThan(0.2);
  });
});

describe('smoke (Blues)', () => {
  it('spreads as it rises', () => {
    for (let r = 0; r < 1; r += 0.1) expect(smokeSpread(r + 0.1)).toBeGreaterThan(smokeSpread(r));
  });
  it('only dominant 7ths make the edges restless', () => {
    expect(restlessness([triad])).toBe(0);
    expect(restlessness([maj7])).toBe(0);
    expect(restlessness([dom7])).toBe(1);
  });
  it('a handful of plumes', () => {
    expect(plumeCount(16)).toBe(8);
    expect(plumeCount(4)).toBe(4);
  });
});

describe('grooves (Soul & Roots)', () => {
  it('the change ring travels outward and its glow is a soft bump, never above 1', () => {
    expect(pulseRadius(0, 20)).toBe(0);
    expect(pulseRadius(1, 20)).toBeGreaterThan(pulseRadius(0.5, 20));
    expect(pulseBoost(5, 5)).toBe(1);
    expect(pulseBoost(5, 9)).toBeLessThan(0.01);
  });
  it('each ring closes on itself (no seam)', () => {
    const g = (u: number) => Math.sin(2 * Math.PI * 1.37 * u + 0.4);
    expect(closedLoop(g, 0)).toBeCloseTo(closedLoop(g, 1), 12);
  });
});

describe('road (Heartland)', () => {
  it('perspective: nearer lines sit lower, from the horizon to the bottom', () => {
    expect(roadY(0)).toBe(HORIZON);
    expect(roadY(1)).toBe(1);
    for (let d = 0; d < 1; d += 0.1) expect(roadY(d + 0.1)).toBeGreaterThan(roadY(d));
  });
  it('lines move one place per eighth note, locked to the beat', () => {
    const n = 14;
    expect(lineDepth(3, n, 0)).toBeCloseTo(3 / n, 9);
    expect(lineDepth(3, n, 0.25)).toBeCloseTo(3.5 / n, 9);
    // After an eighth note each line is where the next one was.
    expect(lineDepth(3, n, 0.5 - 1e-9)).toBeCloseTo(4 / n, 6);
  });
});

describe('aurora (Dreamy) and dunes (Desert Groove)', () => {
  it('curtains stay soft', () => {
    for (let i = 0; i < CURTAINS; i++) expect(curtainAlpha(i) * 2.5).toBeLessThanOrEqual(0.7);
    for (let k = 0; k < 200; k++) {
      const l = streakLength(k, 3.3, 1);
      expect(l).toBeGreaterThan(0.1);
      expect(l).toBeLessThanOrEqual(1);
      // Smooth along the curtain: neighbouring streaks are close in length.
      expect(Math.abs(streakLength(k + 1, 3.3, 1) - l)).toBeLessThan(0.05);
      expect(jitter(k)).toBeGreaterThanOrEqual(0);
      expect(jitter(k)).toBeLessThan(1);
    }
    expect(jitter(5)).toBe(jitter(5));
  });
  it('ridges step from far (high, low) to near (low, tall)', () => {
    const n = 16;
    for (let k = 1; k < n; k++) {
      expect(ridgeBase(k, n)).toBeGreaterThan(ridgeBase(k - 1, n));
      expect(ridgeScale(k, n)).toBeGreaterThan(ridgeScale(k - 1, n));
    }
    expect(ridgeBase(n - 1, n)).toBeLessThan(1);
  });
});

/** A canvas context that records what's drawn, so every style can be checked without a browser. */
function fakeContext() {
  const log = { points: 0, nan: 0, alphas: [] as number[], fills: 0, strokes: 0 };
  const alphaOf = (c: unknown) => {
    if (typeof c !== 'string') return;
    const m = /\/ ([\d.e-]+)\)$/.exec(c);
    if (m) log.alphas.push(Number(m[1]));
  };
  const grad = { addColorStop: (_o: number, c: string) => alphaOf(c) };
  const pt = (x: number, y: number) => {
    log.points++;
    if (!Number.isFinite(x) || !Number.isFinite(y)) log.nan++;
  };
  const ctx = {
    set fillStyle(c: unknown) { alphaOf(c); },
    set strokeStyle(c: unknown) { alphaOf(c); },
    lineWidth: 1, lineCap: 'butt', globalAlpha: 1,
    createLinearGradient: () => grad,
    beginPath() {}, closePath() {}, moveTo: pt, lineTo: pt,
    fill() { log.fills++; }, stroke() { log.strokes++; }, fillRect() { log.fills++; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

describe('every style draws a sane frame', () => {
  for (const v of VIBES) {
    it(`${v.name} (${v.look.style})`, () => {
      for (const [w, h] of [[390, 844], [1280, 800]] as const) {
        for (const layers of [[triad], [dom7], [{ ...triad, w: 0.3 }, { ...maj7, w: 0.7 }]]) {
          const { ctx, log } = fakeContext();
          const scene: Scene = {
            w, h, look: v.look, layers, base: 1.3, t: 12.3, swell: 0.12, presence: 1,
            colA: [255, 138, 61], colB: [255, 77, 126], changeAge: 0.4, beatPos: 7.3, levels: { bass: 0.5, mid: 0.3, treble: 0.2 },
          };
          drawStyle(v.look.style, ctx, scene, '#0b0b0b');
          expect(log.points).toBeGreaterThan(50);
          expect(log.nan).toBe(0);
          expect(log.strokes + log.fills).toBeGreaterThan(0);
          for (const a of log.alphas) expect(a).toBeGreaterThanOrEqual(0), expect(a).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  it('draws nothing visible at zero presence', () => {
    for (const v of VIBES) {
      const { ctx, log } = fakeContext();
      drawStyle(v.look.style, ctx, { w: 390, h: 844, look: v.look, layers: [triad], base: 1, t: 0, swell: 0, presence: 0, colA: [1, 2, 3], colB: [4, 5, 6], changeAge: 0, beatPos: 0, levels: { bass: 0, mid: 0, treble: 0 } }, '#0b0b0b');
      for (const a of log.alphas) expect(a).toBe(0);
    }
  });
});
