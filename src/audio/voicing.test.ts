import { describe, expect, it } from 'vitest';
import { chord } from '../theory/chords';
import { mod12 } from '../theory/notes';
import { bassMidi, CHORD_RANGE, MAX_VOICES, midiToFrequency, voiceChord, type VoicingStyle } from './voicing';

const pcs = (notes: number[]) => [...new Set(notes.map(mod12))].sort((a, b) => a - b);
const STYLES: VoicingStyle[] = ['close', 'open', 'shell'];
const SYMBOLS = ['C', 'Em', 'B7', 'Cmaj7', 'Am7', 'Asus2', 'D7sus4', 'Cadd9', 'C6/9', 'Em9', 'Dm11', 'G13', 'Bm7b5',
  'Bdim7', 'Caug', 'E7#9', 'Fmaj7#11', 'E5', 'C/E', 'F#m7', 'Bbmaj9', 'C13#11', 'Ebm6'];

describe('voiceChord', () => {
  it.each(STYLES)('%s voicings stay in range, ascend, and cap at six notes', (style) => {
    for (const s of SYMBOLS) {
      const notes = voiceChord(chord(s), style);
      expect(notes.length, s).toBeGreaterThanOrEqual(2);
      expect(notes.length, s).toBeLessThanOrEqual(MAX_VOICES);
      expect(notes[0]!, s).toBeGreaterThanOrEqual(CHORD_RANGE.low);
      expect(notes[notes.length - 1]!, s).toBeLessThanOrEqual(CHORD_RANGE.high);
      for (let i = 1; i < notes.length; i++) expect(notes[i]!, s).toBeGreaterThan(notes[i - 1]!);
    }
  });

  it('close and open voicings contain exactly the chord tones', () => {
    // Cmaj7 = C E G B
    expect(pcs(voiceChord(chord('Cmaj7'), 'close'))).toEqual([0, 4, 7, 11]);
    expect(pcs(voiceChord(chord('Cmaj7'), 'open'))).toEqual([0, 4, 7, 11]);
    // Em9 = E G B D F♯
    expect(pcs(voiceChord(chord('Em9'), 'open'))).toEqual([2, 4, 6, 7, 11]);
  });

  it('shell voicings keep root, 3rd and 7th and drop the 5th', () => {
    // G7 shell: G, F, B
    expect(pcs(voiceChord(chord('G7'), 'shell'))).toEqual([5, 7, 11]);
    // E7#9 shell: E, D, G♯ plus the ♯9 (G) on top
    const e = voiceChord(chord('E7#9'), 'shell');
    expect(pcs(e)).toEqual([2, 4, 7, 8]);
    expect(mod12(e[e.length - 1]!)).toBe(7);
  });

  it('simplifies very dense chords', () => {
    expect(voiceChord(chord('C13#11'), 'close').length).toBeLessThanOrEqual(5);
  });

  it('voice-leads: the next chord sits near the previous one', () => {
    const cmaj7 = voiceChord(chord('Cmaj7'), 'close');
    const am7 = voiceChord(chord('Am7'), 'close', cmaj7);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.abs(avg(am7) - avg(cmaj7))).toBeLessThan(6);
    const high = voiceChord(chord('Cmaj7'), 'close', [72, 76, 79]);
    const low = voiceChord(chord('Cmaj7'), 'close', [48, 52, 55]);
    expect(avg(high)).toBeGreaterThan(avg(low));
  });
});

describe('bassMidi', () => {
  it('plays roots in C2–B2 and chord-aware passing notes', () => {
    expect(bassMidi(chord('C'), 'root')).toBe(36);
    expect(bassMidi(chord('B7'), 'root')).toBe(47);
    expect(bassMidi(chord('A7'), 'fifth')).toBe(45 + 7);
    expect(bassMidi(chord('A7'), 'third')).toBe(45 + 4);
    expect(bassMidi(chord('Am7'), 'third')).toBe(45 + 3);
    expect(bassMidi(chord('A7'), 'seventh')).toBe(45 + 10);
    expect(bassMidi(chord('E'), 'octave')).toBe(52);
  });

  it('plays the slash bass note instead of the root', () => {
    expect(bassMidi(chord('C/E'), 'root')).toBe(40);
  });

  it('approaches the next chord from a half step below', () => {
    expect(bassMidi(chord('C'), 'approach', chord('F'))).toBe(41 - 1);
    expect(bassMidi(chord('C'), 'approach', chord('C7'))).toBe(43); // same root: fifth instead
  });

  it('converts MIDI to frequency', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBeCloseTo(220);
  });
});
