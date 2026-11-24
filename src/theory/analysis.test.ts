import { describe, expect, it } from 'vitest';
import { avoidNotes, chordScaleOptions, detectKeys, landingNotes, scaleFitsChord, suggestKey, suggestSongScales } from './analysis';
import { chord } from './chords';
import { formatKey, type Key } from './keys';
import { formatNote, parseNote, pc } from './notes';
import { parseProgressionText, slotStarts, totalBars } from './progression';
import { scalePcs } from './scales';
import { chordToDegree, degreeRoot, parseDegree, resolveDegreeChord } from './degrees';
import { formatChord } from './chords';

const K = (t: string, mode: Key['mode']): Key => ({ tonic: parseNote(t)!, mode });
const chords = (s: string) => s.split(' ').map(chord);
const pcsToNames = (set: Set<number>, key: Key) =>
  [...set].sort((a, b) => a - b).map((p) => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][p]).join(' ') + (key ? '' : '');

describe('parseProgressionText', () => {
  it('treats space-separated chords as one bar each', () => {
    const r = parseProgressionText('Em C G D');
    expect(r.errorCount).toBe(0);
    expect(r.slots!.map((s) => [formatChord(s.chord, true), s.bars])).toEqual([
      ['Em', 1], ['C', 1], ['G', 1], ['D', 1],
    ]);
  });

  it('splits bars with two chords into halves', () => {
    const r = parseProgressionText('| Em | C | G D |');
    expect(r.slots!.map((s) => s.bars)).toEqual([1, 1, 0.5, 0.5]);
    expect(totalBars(r.slots!)).toBe(3);
    expect(slotStarts(r.slots!)).toEqual([0, 1, 2, 2.5]);
  });

  it('ignores empty bars and missing outer bar lines', () => {
    expect(parseProgressionText('Am7 | D7 || Gmaj7').slots!.map((s) => s.bars)).toEqual([1, 1, 1]);
  });

  it('flags each bad token with its position, and keeps valid ones', () => {
    const input = 'Em Cxyz G Hm';
    const r = parseProgressionText(input);
    expect(r.errorCount).toBe(2);
    expect(r.slots).toBeNull();
    const bad = r.tokens.filter((t) => t.error);
    expect(bad.map((t) => input.slice(t.start, t.end))).toEqual(['Cxyz', 'Hm']);
    expect(r.tokens.filter((t) => t.chord)).toHaveLength(2);
  });

  it('rejects bars with three or more chords', () => {
    const r = parseProgressionText('| C D E | F |');
    expect(r.errorCount).toBe(1);
    expect(r.barErrors[0]!.message).toMatch(/1 or 2 chords/);
  });

  it('returns no slots for empty input', () => {
    expect(parseProgressionText('   ').slots).toBeNull();
    expect(parseProgressionText('   ').errorCount).toBe(0);
  });
});

describe('degrees', () => {
  it('parses numerals and secondary dominants', () => {
    expect(parseDegree('I')).toEqual({ steps: 0, semis: 0 });
    expect(parseDegree('bVII')).toEqual({ steps: 6, semis: 10 });
    expect(parseDegree('iv')).toEqual({ steps: 3, semis: 5 });
    expect(parseDegree('#iv')).toEqual({ steps: 3, semis: 6 });
    expect(parseDegree('V/ii')).toEqual({ steps: 5, semis: 9 });
    expect(parseDegree('V/vi')).toEqual({ steps: 2, semis: 4 });
    expect(parseDegree('X')).toBeNull();
  });

  it('spells degree roots correctly in sharp and flat keys', () => {
    expect(formatNote(degreeRoot('bVII', K('E', 'minor')))).toBe('D');
    expect(formatNote(degreeRoot('bVI', K('E', 'minor')))).toBe('C');
    expect(formatNote(degreeRoot('bIII', K('D', 'major')))).toBe('F');
    expect(formatNote(degreeRoot('V/ii', K('D', 'major')))).toBe('B');
    expect(formatNote(degreeRoot('bII', K('Eb', 'minor')))).toBe('F♭');
    expect(formatNote(degreeRoot('bVI', K('Db', 'major')))).toBe('B♭♭');
  });

  it('resolves a degree slot to a concrete chord', () => {
    expect(formatChord(resolveDegreeChord('ii', 'm9', K('D', 'major')))).toBe('Em9');
    expect(formatChord(resolveDegreeChord('bVI', 'maj7', K('A', 'minor')))).toBe('Fmaj7');
    expect(formatChord(resolveDegreeChord('I', 'maj7', K('C', 'major'), 'III'))).toBe('Cmaj7/E');
  });

  it('round-trips concrete chords through degrees, so locks survive key changes', () => {
    const d = chordToDegree(chord('Bbmaj7'), K('D', 'major'));
    expect(d).toEqual({ degree: 'bVI', quality: 'maj7' });
    expect(chordToDegree(chord('F#m7'), K('D', 'major')).degree).toBe('iii');
    expect(formatChord(resolveDegreeChord(d.degree, d.quality, K('E', 'major')))).toBe('Cmaj7');
  });
});

describe('key detection', () => {
  it.each([
    ['Em C G D', 'E minor'],
    ['G D Em C', 'G major'],
    ['Am F C G', 'A minor'],
    ['C Am F G', 'C major'],
    ['Dm7 G7 Cmaj7', 'C major'],
    ['A7 D7 A7 E7', 'A major'],
    ['Em7 A7 Dmaj7', 'D major'],
    ['Bbmaj7 Gm7 Cm7 F7', 'B♭ major'],
  ])('%s → %s', (prog, expected) => {
    expect(formatKey(detectKeys(chords(prog))[0]!.key)).toBe(expected);
  });

  it('offers a runner-up only when it is close', () => {
    expect(suggestKey(chords('G D Em C'))).toHaveLength(1);
    expect(suggestKey([])).toEqual([]);
  });
});

describe('scale fit', () => {
  const E = parseNote('E')!;

  it('7-note scales must contain the chord', () => {
    const cMajor = scalePcs(parseNote('C')!, 'major');
    expect(scaleFitsChord(cMajor, chord('Dm7'))).toBe(true);
    expect(scaleFitsChord(cMajor, chord('D7'))).toBe(false);
  });

  it('pentatonics may skip chord tones but must not contradict the 3rd or 7th', () => {
    const ePent = scalePcs(E, 'minorPentatonic');
    expect(scaleFitsChord(ePent, chord('Em7'))).toBe(true);
    expect(scaleFitsChord(ePent, chord('Cmaj7'))).toBe(true);
    expect(scaleFitsChord(ePent, chord('G'))).toBe(true);
    expect(scaleFitsChord(ePent, chord('D'))).toBe(true); // G is just the 4th
    expect(scaleFitsChord(ePent, chord('A7'))).toBe(true);
    expect(scaleFitsChord(ePent, chord('B7'))).toBe(false); // D against D♯
    expect(scaleFitsChord(scalePcs(E, 'majorPentatonic'), chord('Em'))).toBe(false); // G♯ against G
  });

  it('ranks whole-song scales by fit, then vibe preference', () => {
    const prog = chords('Em7 Cmaj7 G D');
    const s = suggestSongScales(prog, K('E', 'minor'), ['minorPentatonic']);
    expect(s[0]).toMatchObject({ scale: 'minorPentatonic', fits: 4, total: 4 });
    const dorian = s.find((x) => x.scale === 'dorian')!;
    expect(dorian.fits).toBe(3);
    expect(dorian.clashes).toEqual([1]); // clashes on Cmaj7
  });

  it('follow-chord scales prefer the diatonic mode on each chord', () => {
    const key = K('C', 'major');
    expect(chordScaleOptions(chord('Dm7'), key)[0]!.scale).toBe('dorian');
    expect(chordScaleOptions(chord('G7'), key)[0]!.scale).toBe('mixolydian');
    expect(chordScaleOptions(chord('Fmaj7'), key)[0]!.scale).toBe('lydian');
    expect(chordScaleOptions(chord('Em7'), key)[0]!.scale).toBe('phrygian');
    expect(chordScaleOptions(chord('Am7'), key)[0]!.scale).toBe('naturalMinor');
    expect(chordScaleOptions(chord('Cmaj7'), key)[0]!.scale).toBe('major');
  });

  it('follow-chord scales handle non-diatonic chords and fall back to the key', () => {
    const key = K('C', 'major');
    expect(chordScaleOptions(chord('A7'), key)[0]!.scale).toBe('mixolydian');
    const bm7b5 = chordScaleOptions(chord('Bm7b5'), key);
    expect(bm7b5.some((o) => o.scale === 'major' && pc(o.root) === 0)).toBe(true);
  });
});

describe('landing and avoid notes', () => {
  it('landing targets are the next chord tones; approaches are a half step away', () => {
    const { targets, approaches } = landingNotes(chord('Dmaj7'));
    expect(pcsToNames(targets, K('D', 'major'))).toBe('C# D F# A');
    expect(approaches.has(pc(parseNote('G')!))).toBe(true);
    expect(approaches.has(pc(parseNote('C#')!))).toBe(false);
  });

  it('avoid notes sit a half step above a chord tone', () => {
    const cMajor = scalePcs(parseNote('C')!, 'major');
    expect(pcsToNames(avoidNotes(cMajor, chord('C')), K('C', 'major'))).toBe('F');
    expect(pcsToNames(avoidNotes(cMajor, chord('Cmaj7')), K('C', 'major'))).toBe('F');
    expect(pcsToNames(avoidNotes(scalePcs(parseNote('C')!, 'lydian'), chord('Cmaj7')), K('C', 'major'))).toBe('');
    expect(pcsToNames(avoidNotes(scalePcs(parseNote('A')!, 'naturalMinor'), chord('Am7')), K('A', 'minor'))).toBe('F');
  });
});
