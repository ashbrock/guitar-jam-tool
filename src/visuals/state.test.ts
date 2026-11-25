import { describe, expect, it } from 'vitest';
import { vibeById } from '../data/vibes/index';
import { parseChord } from '../theory/chords';
import { simplify } from '../theory/simplify';
import { VisualState, type VisualInput } from './state';

const chord = (s: string) => {
  const r = parseChord(s);
  if (!r.ok) throw new Error(s);
  return simplify(r.chord);
};
const input = (over: Partial<VisualInput> = {}): VisualInput => ({
  look: vibeById('neo-soul')!.look, chord: chord('Dmaj7'), slotIndex: 0, phase: 'playing',
  beatFraction: 0.25, beatPosition: 1.25, tempo: 90, reducedMotion: false, ...over,
});

/** Steps the state for `seconds` at 60 fps and returns the last scene. */
function run(s: VisualState, seconds: number, from: number, f: (i: number) => VisualInput) {
  let scene = null;
  const frames = Math.round(seconds * 60);
  for (let i = 1; i <= frames; i++) scene = s.step(from + (i * 1000) / 60, f(i), 390, 844);
  return { scene, at: from + seconds * 1000 };
}

describe('visual state', () => {
  it('is hidden before playing, and fades in on play', () => {
    const s = new VisualState();
    expect(s.step(0, input({ phase: 'stopped' }), 390, 844)).toBeNull();
    const { scene } = run(s, 2, 0, () => input());
    expect(scene!.presence).toBeGreaterThan(0.95);
  });

  it('freezes everything while paused, and stays visible', () => {
    const s = new VisualState();
    const { at } = run(s, 2, 0, () => input());
    const a = s.step(at + 16, input({ phase: 'paused' }), 390, 844)!;
    const { scene: b } = run(s, 1, at + 16, () => input({ phase: 'paused', beatFraction: 0.9 }));
    expect(b!.t).toBe(a.t);
    expect(b!.swell).toBe(a.swell);
    expect(b!.changeAge).toBe(a.changeAge);
    expect(b!.presence).toBeGreaterThan(0.95);
  });

  it('a chord change starts a crossfade and resets the change age', () => {
    const s = new VisualState();
    const { at } = run(s, 1, 0, () => input());
    const scene = s.step(at + 16, input({ slotIndex: 1, chord: chord('Em7') }), 390, 844)!;
    expect(scene.layers.length).toBeGreaterThanOrEqual(2);
    expect(scene.changeAge).toBeLessThan(0.05);
    const { scene: later } = run(s, 2, at + 16, () => input({ slotIndex: 1, chord: chord('Em7') }));
    expect(later!.layers[later!.layers.length - 1]!.w).toBeGreaterThan(0.99);
  });

  it('reduced motion: no drift, no swell', () => {
    const s = new VisualState();
    const { scene } = run(s, 2, 0, () => input({ reducedMotion: true }));
    expect(scene!.swell).toBe(0);
    expect(scene!.t).toBe(0);
  });
});
