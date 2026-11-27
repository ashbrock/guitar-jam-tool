import { describe, expect, it } from 'vitest';
import { generate, swapOptions, type DegreeSlot } from './generator';
import { createRng, pickWeighted } from './random';
import { slotStarts, totalBars } from './progression';
import type { GeneratorParams } from './vibe';
import { vibeById } from '../data/vibes/index';

/** A tiny, fully predictable vibe for testing the generator's rules in isolation. */
const toy: GeneratorParams = {
  lengths: [{ bars: 4, w: 1 }, { bars: 8, w: 1 }],
  harmonicRhythm: [{ bars: 1, w: 1 }],
  // High enough that these tests are about the rules, not the cap (tested separately below).
  maxChords: 8,
  minChords: 2,
  allowRepeats: false,
  loop: 'closed',
  modes: {
    major: {
      vocabulary: { I: { maj7: 1 }, IV: { maj7: 1 }, V: { '7': 1 }, vi: { m7: 1 } },
      starts: { I: 1 },
      transitions: { I: { IV: 1, vi: 1 }, IV: { V: 1 }, V: { I: 1 }, vi: { IV: 1 } },
    },
    minor: {
      vocabulary: { i: { m7: 1 }, iv: { m7: 1 } },
      starts: { i: 1 },
      transitions: { i: { iv: 1 }, iv: { i: 1 } },
    },
  },
};
const degrees = (s: readonly DegreeSlot[]) => s.map((x) => x.degree).join(' ');

describe('random', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });

  it('respects weights roughly and never picks zero-weight options', () => {
    const rng = createRng(1);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) counts[pickWeighted(rng, [['a', 3], ['b', 1], ['c', 0]] as const)!]++;
    expect(counts.c).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.4);
    expect(counts.a / counts.b).toBeLessThan(3.6);
    expect(pickWeighted(rng, [])).toBeNull();
  });
});

describe('generate', () => {
  it('is deterministic for the same seed', () => {
    const a = generate({ params: toy, mode: 'major', lengthBars: 4, seed: 7 });
    const b = generate({ params: toy, mode: 'major', lengthBars: 4, seed: 7 });
    expect(a).toEqual(b);
  });

  it('follows starts and transitions, and closes the loop', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { slots, relaxed } = generate({ params: toy, mode: 'major', lengthBars: 4, seed });
      expect(relaxed).toEqual([]);
      expect(slots[0]!.degree).toBe('I');
      const all = [...slots, slots[0]!];
      for (let i = 0; i < slots.length; i++) {
        expect(toy.modes.major.transitions[all[i]!.degree]![all[i + 1]!.degree], degrees(slots)).toBeGreaterThan(0);
      }
    }
  });

  it('only finds the one valid 4-bar loop in the toy rules: I IV V I is out, I vi IV V is in', () => {
    const { slots } = generate({ params: toy, mode: 'major', lengthBars: 4, seed: 3 });
    expect(degrees(slots)).toBe('I vi IV V');
  });

  it('keeps locked slots exactly where they were', () => {
    const neo = vibeById('neo-soul')!.params;
    const first = generate({ params: neo, mode: 'major', lengthBars: 8, seed: 11 }).slots;
    const lockIdx = Math.min(2, first.length - 1);
    const current = first.map((s, i) => ({ ...s, locked: i === lockIdx }));
    const lockedStart = slotStarts(current)[lockIdx]!;
    for (let seed = 100; seed < 160; seed++) {
      const next = generate({ params: neo, mode: 'major', lengthBars: 8, current, seed }).slots;
      expect(totalBars(next)).toBe(8);
      const i = slotStarts(next).indexOf(lockedStart);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(next[i]).toEqual(current[lockIdx]);
    }
  });

  it('respects transitions into a locked chord', () => {
    const current: DegreeSlot[] = [
      { degree: 'I', quality: 'maj7', bars: 1, locked: false },
      { degree: 'I', quality: 'maj7', bars: 1, locked: false },
      { degree: 'IV', quality: 'maj7', bars: 1, locked: true },
      { degree: 'I', quality: 'maj7', bars: 1, locked: false },
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const { slots, relaxed } = generate({ params: toy, mode: 'major', lengthBars: 4, current, seed });
      expect(relaxed).toEqual([]);
      expect(slots[2]).toEqual(current[2]);
      expect(slots[1]!.degree).toBe('vi'); // from I, only vi can move into IV without repeating
      expect(slots[3]!.degree).toBe('V');
    }
  });

  it('never repeats the previous roll exactly', () => {
    const neo = vibeById('neo-soul')!.params;
    let prev = generate({ params: neo, mode: 'minor', lengthBars: 4, seed: 1 }).slots;
    for (let seed = 2; seed < 80; seed++) {
      const next = generate({ params: neo, mode: 'minor', lengthBars: 4, current: prev, seed }).slots;
      expect(next).not.toEqual(prev);
      prev = next;
    }
  });

  it('relaxes rules instead of failing when locks make them impossible', () => {
    // Locked I in bar 2 after a forced start of I: with no repeats allowed, that's unsatisfiable strictly.
    const current: DegreeSlot[] = [
      { degree: 'vi', quality: 'm7', bars: 1, locked: false },
      { degree: 'I', quality: 'maj7', bars: 1, locked: true },
      { degree: 'IV', quality: 'maj7', bars: 1, locked: true },
      { degree: 'I', quality: 'maj7', bars: 1, locked: true },
    ];
    const { slots, relaxed } = generate({ params: toy, mode: 'major', lengthBars: 4, current, seed: 5 });
    expect(slots).toHaveLength(4);
    expect(relaxed.length).toBeGreaterThan(0);
    expect(slots.slice(1)).toEqual(current.slice(1));
  });

  it('drops locked slots that no longer fit after shortening', () => {
    const current: DegreeSlot[] = Array.from({ length: 8 }, (_, i) => ({
      degree: i % 2 ? 'IV' : 'I', quality: 'maj7', bars: 1 as const, locked: i === 6,
    }));
    const { slots } = generate({ params: toy, mode: 'major', lengthBars: 4, current, seed: 1 });
    expect(totalBars(slots)).toBe(4);
    expect(slots.some((s) => s.locked)).toBe(false);
  });

  it('keeps ½-bar chords in pairs inside a bar, and longer chords on bar lines', () => {
    const p: GeneratorParams = { ...toy, harmonicRhythm: [{ bars: 0.5, w: 2 }, { bars: 1, w: 1 }, { bars: 2, w: 1 }], allowRepeats: true, loop: 'free' };
    for (let seed = 1; seed <= 100; seed++) {
      const { slots } = generate({ params: p, mode: 'major', lengthBars: 8, seed });
      const starts = slotStarts(slots);
      slots.forEach((s, i) => {
        if (s.bars >= 1) expect(starts[i]! % 1).toBe(0);
      });
      expect(totalBars(slots)).toBe(8);
    }
  });
});

describe('held chords', () => {
  it('merges a repeated degree into one longer chord instead of chopping it up', () => {
    for (const id of ['blues', 'desert-groove']) {
      const params = vibeById(id)!.params;
      for (const mode of ['major', 'minor'] as const) {
        for (let seed = 1; seed <= 150; seed++) {
          const { slots } = generate({ params, mode, lengthBars: 8, seed });
          const starts = slotStarts(slots);
          for (let i = 1; i < slots.length; i++) {
            if (slots[i]!.degree !== slots[i - 1]!.degree) continue;
            // A repeat is only left in place when merging would make an invalid, misaligned or too-long chord.
            const combined = slots[i]!.bars + slots[i - 1]!.bars;
            const aligned = starts[i - 1]! % 1 === 0;
            const longest = Math.max(...params.harmonicRhythm.map((h) => h.bars));
            expect([1, 2, 4].includes(combined) && combined <= longest && aligned, `${id} ${mode} seed ${seed}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('chord cap', () => {
  it('never makes more than maxChords chords, however the bars are split', () => {
    const p: GeneratorParams = { ...toy, harmonicRhythm: [{ bars: 1, w: 3 }, { bars: 2, w: 1 }], maxChords: 4, allowRepeats: true, loop: 'free' };
    for (let seed = 1; seed <= 200; seed++) {
      for (const lengthBars of [4, 8]) {
        const { slots } = generate({ params: p, mode: 'major', lengthBars, seed });
        expect(slots.length).toBeLessThanOrEqual(4);
        expect(totalBars(slots)).toBe(lengthBars);
      }
    }
  });

  it('fills 8 bars with four 2-bar chords when 2 bars is the longest', () => {
    const p: GeneratorParams = { ...toy, harmonicRhythm: [{ bars: 1, w: 5 }, { bars: 2, w: 1 }], maxChords: 4 };
    for (let seed = 1; seed <= 50; seed++) {
      const { slots } = generate({ params: p, mode: 'major', lengthBars: 8, seed });
      expect(slots.map((s) => s.bars)).toEqual([2, 2, 2, 2]);
    }
  });

  it('allows fewer chords than the cap', () => {
    const p: GeneratorParams = { ...toy, harmonicRhythm: [{ bars: 1, w: 1 }, { bars: 2, w: 3 }], maxChords: 4 };
    const counts = new Set<number>();
    for (let seed = 1; seed <= 100; seed++) counts.add(generate({ params: p, mode: 'major', lengthBars: 4, seed }).slots.length);
    expect([...counts].some((n) => n < 4)).toBe(true);
  });

  it('never holds a chord longer than the longest the vibe allows', () => {
    const p: GeneratorParams = { ...toy, harmonicRhythm: [{ bars: 2, w: 1 }], maxChords: 4, allowRepeats: true, loop: 'free' };
    for (let seed = 1; seed <= 100; seed++) {
      for (const s of generate({ params: p, mode: 'major', lengthBars: 8, seed }).slots) expect(s.bars).toBeLessThanOrEqual(2);
    }
  });
});

describe('templates', () => {
  const withForms = (forms: string[][], markov = 0, maxChords = 4): GeneratorParams => ({
    ...toy,
    maxChords,
    harmonicRhythm: [{ bars: 1, w: 1 }, { bars: 2, w: 1 }],
    modes: { ...toy.modes, major: { ...toy.modes.major, templates: { '4': { markov, forms: forms.map((degrees) => ({ w: 1, degrees })) } } } },
  });
  const perBar = (slots: readonly DegreeSlot[]) => slots.flatMap((s) => Array.from({ length: s.bars }, () => s.degree)).join(' ');

  it('follows a fixed form exactly', () => {
    const p = withForms([['I', 'vi', 'IV', 'V']]);
    for (let seed = 1; seed <= 30; seed++) expect(perBar(generate({ params: p, mode: 'major', lengthBars: 4, seed }).slots)).toBe('I vi IV V');
  });

  it('merges repeated template bars into longer chords', () => {
    const { slots } = generate({ params: withForms([['I', 'I', 'IV', 'V']]), mode: 'major', lengthBars: 4, seed: 3 });
    expect(slots.map((s) => `${s.degree}:${s.bars}`).join(' ')).toBe('I:2 IV:1 V:1');
  });

  it('only uses forms that agree with the locks', () => {
    const p = withForms([['I', 'I', 'IV', 'V'], ['I', 'vi', 'V', 'V']]);
    const current: DegreeSlot[] = [
      { degree: 'I', quality: 'maj7', bars: 2, locked: false },
      { degree: 'IV', quality: 'maj7', bars: 1, locked: true },
      { degree: 'V', quality: '7', bars: 1, locked: false },
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const { slots } = generate({ params: p, mode: 'major', lengthBars: 4, current, seed });
      expect(slots[1]).toEqual(current[1]);
      expect(perBar(slots)).toBe('I I IV V');
    }
  });

  it('never uses a form with more chords than the cap', () => {
    const p = withForms([['I', 'vi', 'IV', 'V']], 1, 3);
    for (let seed = 1; seed <= 50; seed++) expect(generate({ params: p, mode: 'major', lengthBars: 4, seed }).slots.length).toBeLessThanOrEqual(3);
  });
});

describe('swapOptions', () => {
  it('suggests degrees that connect both neighbours, then other colours of the same degree', () => {
    const slots: DegreeSlot[] = [
      { degree: 'I', quality: 'maj7', bars: 1, locked: false },
      { degree: 'vi', quality: 'm7', bars: 1, locked: false },
      { degree: 'IV', quality: 'maj7', bars: 1, locked: false },
      { degree: 'V', quality: '7', bars: 1, locked: false },
    ];
    const neo = vibeById('neo-soul')!.params;
    const opts = swapOptions(neo, 'major', slots, 1);
    expect(opts.length).toBeGreaterThanOrEqual(3);
    expect(opts.length).toBeLessThanOrEqual(6);
    expect(opts.some((o) => o.degree === 'vi' && o.quality === 'm7')).toBe(false);
    const other = opts.filter((o) => o.degree !== 'vi');
    for (const o of other.slice(0, 2)) {
      expect(neo.modes.major.transitions.I![o.degree] ?? 0).toBeGreaterThan(0);
    }
    expect(opts.some((o) => o.degree === 'vi' && o.quality === 'm9')).toBe(true);
  });
});
