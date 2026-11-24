// Turns chords into MIDI notes for playback. Pure: no Web Audio here, so it can be tested.
import { chordIntervals, coreIntervals, needsSimplifying, type Chord } from '../theory/chords';
import { pc, type Interval } from '../theory/notes';

export type VoicingStyle = 'close' | 'open' | 'shell';

/** Keyboard range for chord voicings: C3–G5. Keeps chords clear of the bass and out of the shrill top. */
export const CHORD_RANGE = { low: 48, high: 79 } as const;
/** Bass range: C2–B2 for roots, so fifths and octaves stay under the chords. */
export const BASS_ROOT_LOW = 36;
const DEFAULT_CENTRE = 62;
export const MAX_VOICES = 6;

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Which intervals to play: everything, unless the chord is too dense, then root/3rd/5th/7th. */
function playable(chord: Chord): Interval[] {
  let ivs = needsSimplifying(chord) ? coreIntervals(chord.spec) : chordIntervals(chord.spec);
  // Over five notes, drop a perfect 5th: it adds the least colour.
  if (ivs.length > 5) ivs = ivs.filter((i) => !(i.num === 5 && i.semis === 7));
  return ivs.slice(0, MAX_VOICES);
}

/** Semitone offsets above the root for a style, before octave placement. */
function shape(chord: Chord, style: VoicingStyle): number[] {
  const ivs = playable(chord);
  if (style === 'close') {
    // Everything folded inside one octave above the root.
    return [...new Set(ivs.map((i) => i.semis % 12))].sort((a, b) => a - b);
  }
  if (style === 'shell') {
    // Root, the 3rd (or sus tone), the 7th (or 6th), plus the top colour tone if there is one.
    const third = ivs.find((i) => i.num === 3 || i.num === 2 || i.num === 4);
    const seventh = ivs.find((i) => i.num === 7) ?? ivs.find((i) => i.num === 6);
    const colour = [...ivs].reverse().find((i) => i.num > 7);
    const out = [0];
    if (seventh) out.push(seventh.semis);
    if (third) out.push(third.semis + (seventh ? 12 : 0));
    if (out.length < 3) {
      const fifth = ivs.find((i) => i.num === 5);
      if (fifth) out.push(fifth.semis);
    }
    if (colour) {
      // Colour tone goes on top of everything else.
      let c = colour.semis % 12;
      while (c <= Math.max(...out)) c += 12;
      out.push(c);
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }
  // Open: root and 5th/7th low, the 3rd and extensions an octave up for a wide, airy spread.
  const out = ivs.map((i) => {
    if (i.num === 1) return 0;
    if (i.num === 5 || i.num === 7 || i.num === 6) return i.semis;
    if (i.num === 3 || i.num === 2 || i.num === 4) return i.semis + 12;
    return i.semis < 12 ? i.semis + 12 : i.semis; // extensions sit on top
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * MIDI notes for a chord, voice-led towards the previous voicing: of the octave positions that fit the
 * range, the one whose centre is closest to the previous chord's centre wins, so chords move smoothly.
 */
export function voiceChord(chord: Chord, style: VoicingStyle, previous?: readonly number[]): number[] {
  const offsets = shape(chord, style);
  const base = CHORD_RANGE.low + pc(chord.root); // root somewhere in C3–B3
  const target = previous && previous.length ? mean(previous) : DEFAULT_CENTRE;
  const candidates = [-12, 0, 12].map((shift) => offsets.map((o) => base + shift + o));
  const overflow = (notes: number[]) =>
    Math.max(0, CHORD_RANGE.low - notes[0]!) + Math.max(0, notes[notes.length - 1]! - CHORD_RANGE.high);
  candidates.sort((a, b) => overflow(a) - overflow(b) || Math.abs(mean(a) - target) - Math.abs(mean(b) - target));
  const best = candidates[0]!;
  if (overflow(best) === 0) return best;
  // A very wide voicing can't fit in any octave: fold stray notes back inside the range.
  const folded = best.map((n) => (n > CHORD_RANGE.high ? n - 12 : n < CHORD_RANGE.low ? n + 12 : n));
  return [...new Set(folded)].sort((a, b) => a - b);
}

export type BassNote = 'root' | 'third' | 'fifth' | 'sixth' | 'seventh' | 'octave' | 'approach';

/** The bass note for a pattern step. A slash chord's bass note replaces the root. */
export function bassMidi(chord: Chord, which: BassNote, next?: Chord): number {
  const bassPc = pc(chord.bass ?? chord.root);
  const root = BASS_ROOT_LOW + bassPc;
  const ivs = chordIntervals(chord.spec);
  const find = (num: number, fallback: number) => ivs.find((i) => i.num === num)?.semis ?? fallback;
  switch (which) {
    case 'root':
      return root;
    case 'third':
      return BASS_ROOT_LOW + pc(chord.root) + find(3, 4) % 12;
    case 'fifth':
      return BASS_ROOT_LOW + pc(chord.root) + find(5, 7);
    case 'sixth':
      return BASS_ROOT_LOW + pc(chord.root) + 9;
    case 'seventh':
      return BASS_ROOT_LOW + pc(chord.root) + find(7, 10);
    case 'octave':
      return root + 12;
    case 'approach': {
      // A half step below the next chord's bass note; if the chord doesn't change, play the fifth.
      if (!next || pc(next.bass ?? next.root) === bassPc) return bassMidi(chord, 'fifth');
      const target = BASS_ROOT_LOW + pc(next.bass ?? next.root);
      return target - 1;
    }
  }
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
