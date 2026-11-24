import { describe, expect, it } from 'vitest';
import { chord } from './chords';
import { displayStringOrder, fretPositions, mapFretboard, markerLabel, TUNINGS, tuningById, type Layers } from './fretboard';
import type { Key } from './keys';
import { formatNote, parseNote, type Note } from './notes';

const N = (s: string): Note => parseNote(s)!;
const standard = tuningById('standard');
const at = (markers: ReturnType<typeof mapFretboard>, string: number, fret: number) =>
  markers.find((m) => m.string === string && m.fret === fret)!;
const allOn: Layers = { chord: true, scale: true, landing: true, approach: true, avoid: true };

describe('tunings', () => {
  it('has six tunings, each with six strings in ascending pitch', () => {
    expect(TUNINGS).toHaveLength(6);
    for (const t of TUNINGS) {
      expect(t.strings).toHaveLength(6);
      for (let i = 1; i < 6; i++) expect(t.strings[i]!).toBeGreaterThan(t.strings[i - 1]!);
    }
  });

  it('falls back to standard for unknown ids', () => {
    expect(tuningById('nope').id).toBe('standard');
  });
});

describe('fretPositions', () => {
  it('maps standard tuning correctly', () => {
    const p = fretPositions(standard);
    expect(p).toHaveLength(6 * 16);
    const find = (s: number, f: number) => p.find((x) => x.string === s && x.fret === f)!;
    expect(find(0, 0).pc).toBe(4); // low E
    expect(find(0, 5).pc).toBe(9); // A
    expect(find(1, 0).pc).toBe(9); // A string
    expect(find(4, 0).pc).toBe(11); // B string
    expect(find(5, 12).midi).toBe(76); // high E, 12th fret
    expect(find(3, 15).pc).toBe(10); // G string 15th = B♭
  });

  it('re-maps for drop D', () => {
    const p = fretPositions(tuningById('drop-d'));
    expect(p.find((x) => x.string === 0 && x.fret === 0)!.pc).toBe(2);
    expect(p.find((x) => x.string === 0 && x.fret === 2)!.pc).toBe(4);
  });
});

describe('mapFretboard roles', () => {
  const key: Key = { tonic: N('A'), mode: 'minor' };
  const input = {
    key,
    chord: chord('Am7'),
    next: chord('Dm7'),
    scale: { root: N('A'), id: 'naturalMinor' as const },
    layers: allOn,
  };
  const m = mapFretboard(standard, input);

  it('marks the chord root as root', () => {
    expect(at(m, 0, 5).role).toBe('root'); // A on low E, 5th fret
    expect(at(m, 1, 0).role).toBe('root'); // open A
  });

  it('marks chord tones', () => {
    expect(at(m, 0, 8).role).toBe('chord'); // C
    expect(at(m, 0, 0).role).toBe('chord'); // E
  });

  it('marks landing notes that are not chord tones', () => {
    expect(at(m, 0, 1).role).toBe('landing'); // F (3rd of Dm7)
    expect(at(m, 0, 10).role).toBe('landing'); // D
  });

  it('badges chord tones that are also landing notes', () => {
    expect(at(m, 0, 5).landingBadge).toBe(true); // A is in Dm7 too
    expect(at(m, 0, 8).landingBadge).toBe(true); // C is in Dm7
    expect(at(m, 0, 0).landingBadge).toBe(false); // E is not
  });

  it('marks scale tones and nothing outside the scale', () => {
    const plain = mapFretboard(standard, { ...input, layers: { ...allOn, approach: false } });
    expect(at(plain, 0, 7).role).toBe('scale'); // B
    expect(at(plain, 0, 6).role).toBeNull(); // B♭
  });

  it('marks approach notes a half step from a landing note', () => {
    // Next chord Dm7 = D F A C. Approaches: C♯ D♯ E F♯ G♯ B♭ B.
    expect(at(m, 0, 4).role).toBe('approach'); // G♯ → A
    expect(at(m, 0, 0).role).toBe('chord'); // E approaches F, but it's a chord tone of Am7, which wins
    expect(at(m, 0, 9).role).toBe('approach'); // C♯ → D and C
    expect(at(m, 0, 6).role).toBe('approach'); // B♭ → approaches A
    expect(at(m, 0, 7).role).toBe('approach'); // B (scale tone) shows as approach while landing is shown
  });

  it('hides approach notes when their layer is off, or when landing notes are off', () => {
    const noApproach = mapFretboard(standard, { ...input, layers: { ...allOn, approach: false } });
    expect(at(noApproach, 0, 9).role).toBeNull(); // C♯ isn't in A minor
    expect(at(noApproach, 0, 7).role).toBe('scale');
    const noLanding = mapFretboard(standard, { ...input, layers: { ...allOn, landing: false } });
    expect(noLanding.some((x) => x.role === 'approach' || x.role === 'landing')).toBe(false);
  });

  it('shows avoid notes above plain scale tones', () => {
    const noLanding = mapFretboard(standard, { ...input, next: null });
    expect(at(noLanding, 0, 1).role).toBe('avoid'); // F over Am7 in A minor
  });

  it('respects layer toggles', () => {
    const scaleOnly = mapFretboard(standard, { ...input, layers: { chord: false, scale: true, landing: false, approach: false, avoid: false } });
    expect(at(scaleOnly, 0, 5).role).toBe('root'); // scale root
    expect(at(scaleOnly, 0, 8).role).toBe('scale');
    const none = mapFretboard(standard, { ...input, layers: { chord: false, scale: false, landing: false, approach: false, avoid: false } });
    expect(none.every((x) => x.role === null)).toBe(true);
  });

  it('spells notes from the chord, then the scale, then the key', () => {
    const e7 = mapFretboard(standard, { ...input, chord: chord('E7'), next: null });
    expect(formatNote(at(e7, 0, 4).note)).toBe('G♯');
    const bb = mapFretboard(standard, { ...input, chord: chord('Bbmaj7'), next: null });
    expect(formatNote(at(bb, 0, 6).note)).toBe('B♭');
  });
});

describe('labels and handedness', () => {
  const key: Key = { tonic: N('D'), mode: 'major' };
  it('labels notes, intervals (to the chord) and degrees (to the key)', () => {
    const c = chord('Em7');
    expect(markerLabel(N('G'), 'note', key, c)).toBe('G');
    expect(markerLabel(N('G'), 'interval', key, c)).toBe('♭3');
    expect(markerLabel(N('E'), 'interval', key, c)).toBe('R');
    expect(markerLabel(N('G'), 'degree', key, c)).toBe('4');
    expect(markerLabel(N('D'), 'degree', key, c)).toBe('1');
    expect(markerLabel(N('F'), 'degree', key, null)).toBe('♭3');
  });

  it('mirrors string order for left-handed players', () => {
    expect(displayStringOrder(6, false)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(displayStringOrder(6, true)).toEqual([5, 4, 3, 2, 1, 0]);
  });
});
