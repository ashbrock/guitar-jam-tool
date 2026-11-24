// Playback grooves, as data. Each vibe names one in `playback.groove`; Solo's default is "plain".
// A bar has 16 steps (16th notes). Step 0 is the downbeat; 4, 8 and 12 are beats 2, 3 and 4.
import type { BassNote } from '../audio/voicing';

export interface Hit {
  step: number;
  /** Length in steps. */
  len: number;
  /** 0–1. */
  vel: number;
}

export interface BassHit extends Hit {
  note: BassNote;
}

export interface Groove {
  id: string;
  kick: number[];
  snare: number[];
  hat: number[];
  /** Chord hits. A new chord also always sounds where it starts, even between hits. */
  comp: Hit[];
  bass: BassHit[];
}

const h = (step: number, len: number, vel = 0.8): Hit => ({ step, len, vel });
const b = (step: number, len: number, note: BassNote, vel = 0.85): BassHit => ({ step, len, note, vel });
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];

export const GROOVES: readonly Groove[] = [
  {
    // Solo default: sustained chords, root on 1 and 3, no drums.
    id: 'plain',
    kick: [],
    snare: [],
    hat: [],
    comp: [h(0, 16, 0.7)],
    bass: [b(0, 8, 'root'), b(8, 8, 'root', 0.75)],
  },
  {
    // Laid-back pocket: lazy kick on the "and" of 2, chords pushed off the beat.
    id: 'neo-soul-pocket',
    kick: [0, 7, 10],
    snare: [4, 12],
    hat: EIGHTHS,
    comp: [h(0, 6, 0.75), h(10, 6, 0.6)],
    bass: [b(0, 6, 'root'), b(7, 3, 'octave', 0.6), b(10, 4, 'fifth', 0.7), b(14, 2, 'approach', 0.6)],
  },
  {
    // Blues shuffle: quarter-note boogie bass (R 3 5 6), chords on 1 and the "and" of 2.
    id: 'shuffle',
    kick: [0, 8],
    snare: [4, 12],
    hat: EIGHTHS,
    comp: [h(0, 3, 0.75), h(6, 2, 0.6), h(8, 3, 0.7), h(14, 2, 0.55)],
    bass: [b(0, 4, 'root'), b(4, 4, 'third', 0.75), b(8, 4, 'fifth', 0.8), b(12, 4, 'sixth', 0.75)],
  },
  {
    // Soul backbeat: piano-style stabs, bass walking up into the next chord.
    id: 'soul-backbeat',
    kick: [0, 6, 8],
    snare: [4, 12],
    hat: EIGHTHS,
    comp: [h(0, 3, 0.75), h(6, 2, 0.6), h(8, 3, 0.7), h(12, 4, 0.6)],
    bass: [b(0, 6, 'root'), b(6, 2, 'fifth', 0.65), b(8, 6, 'root', 0.8), b(14, 2, 'approach', 0.6)],
  },
  {
    // Heartland: sustained chords over driving eighth-note bass.
    id: 'driving-eighths',
    kick: [0, 8, 10],
    snare: [4, 12],
    hat: EIGHTHS,
    comp: [h(0, 16, 0.65)],
    bass: EIGHTHS.map((s) => b(s, 2, 'root', s % 4 === 0 ? 0.85 : 0.65)),
  },
  {
    // Dreamy: half-time, long chords, almost no drums.
    id: 'half-time-wash',
    kick: [0],
    snare: [8],
    hat: [0, 4, 8, 12],
    comp: [h(0, 16, 0.6)],
    bass: [b(0, 16, 'root', 0.7)],
  },
  {
    // Desert groove: syncopated chord stabs, a bass line that leans on the 7th and 5th.
    id: 'desert-groove',
    kick: [0, 6, 10],
    snare: [4, 12],
    hat: [...EIGHTHS, 3, 11],
    comp: [h(0, 2, 0.7), h(3, 2, 0.55), h(8, 2, 0.65), h(11, 2, 0.55)],
    bass: [b(0, 3, 'root'), b(3, 3, 'octave', 0.6), b(6, 2, 'fifth', 0.7), b(8, 3, 'root', 0.8), b(11, 3, 'seventh', 0.6), b(14, 2, 'fifth', 0.65)],
  },
];

export function grooveById(id: string): Groove {
  return GROOVES.find((g) => g.id === id) ?? GROOVES[0]!;
}
