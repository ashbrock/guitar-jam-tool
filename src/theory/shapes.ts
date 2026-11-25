// Guitar chord shapes for chord charts. Pure: no DOM. Basic shapes only: an open chord where one
// exists, otherwise the lower of the two common movable barre shapes (E-shape, A-shape).
// Roots are never typed in; they're computed from the notes so they can't be wrong.
import { chordPcs, type Chord } from './chords';
import { mod12, pc, type PitchClass } from './notes';

export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const; // E2 A2 D3 G3 B3 E4
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'E'] as const;
export const MAX_SPAN = 5;

/** The default chord set's qualities (canonical suffixes). */
export type BasicQuality = '' | 'm' | '7' | 'maj7' | 'm7' | 'sus2' | 'sus4' | 'dim';

export interface Shape {
  /** Fret per string, low E first. -1 = muted, 0 = open. */
  frets: number[];
  /** Finger per string (1–4), 0 = none (open or muted). */
  fingers: number[];
  /** A barre: [fret, from string, to string], strings inclusive. */
  barre: [number, number, number] | null;
}

export interface PlacedShape extends Shape {
  /** First fret shown in the chart (1 = at the nut). */
  baseFret: number;
  /** Strings whose note is the chord root. */
  roots: number[];
  /** Notes sounded, as pitch classes per string (null = muted). */
  notes: (PitchClass | null)[];
}

type Grip = { frets: number[]; fingers: number[]; barre?: [number, number, number] };
const g = (frets: number[], fingers: number[], barre?: [number, number, number]): Grip => ({ frets, fingers, barre });

/** Open shapes, by root pitch class then quality. Only well-known, comfortable grips. */
const OPEN: Partial<Record<number, Partial<Record<BasicQuality, Grip>>>> = {
  0: { // C
    '': g([-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
    '7': g([-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]),
    maj7: g([-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]),
  },
  2: { // D
    '': g([-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]),
    m: g([-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]),
    '7': g([-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]),
    maj7: g([-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 2, 3]),
    m7: g([-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1]),
    sus2: g([-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0]),
    sus4: g([-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 2, 3]),
  },
  4: { // E
    '': g([0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),
    m: g([0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),
    '7': g([0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]),
    maj7: g([0, 2, 1, 1, 0, 0], [0, 3, 1, 2, 0, 0]),
    m7: g([0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]),
    sus4: g([0, 2, 2, 2, 0, 0], [0, 2, 3, 4, 0, 0]),
  },
  7: { // G
    '': g([3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]),
    '7': g([3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]),
    maj7: g([3, -1, 0, 0, 0, 2], [2, 0, 0, 0, 0, 1]),
  },
  9: { // A
    '': g([-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]),
    m: g([-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]),
    '7': g([-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]),
    maj7: g([-1, 0, 2, 1, 2, 0], [0, 0, 2, 1, 3, 0]),
    m7: g([-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]),
    sus2: g([-1, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0]),
    sus4: g([-1, 0, 2, 2, 3, 0], [0, 0, 1, 2, 3, 0]),
  },
};

/** Movable shapes as fret offsets from the root fret (-1 = muted), with fingers. */
const E_SHAPE: Partial<Record<BasicQuality, { off: number[]; fingers: number[]; barre: boolean }>> = {
  '': { off: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barre: true },
  m: { off: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barre: true },
  '7': { off: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barre: true },
  maj7: { off: [0, -1, 1, 1, 0, -1], fingers: [1, 0, 3, 4, 2, 0], barre: false },
  m7: { off: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barre: true },
  sus4: { off: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1], barre: true },
};
const A_SHAPE: Partial<Record<BasicQuality, { off: number[]; fingers: number[]; barre: boolean }>> = {
  '': { off: [-1, 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1], barre: true },
  m: { off: [-1, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1], barre: true },
  '7': { off: [-1, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barre: true },
  maj7: { off: [-1, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barre: true },
  m7: { off: [-1, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barre: true },
  sus2: { off: [-1, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1], barre: true },
  sus4: { off: [-1, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1], barre: true },
  dim: { off: [-1, 0, 1, 2, 1, -1], fingers: [0, 1, 2, 4, 3, 0], barre: false },
};

function movable(shape: { off: number[]; fingers: number[]; barre: boolean }, rootFret: number): Grip {
  const frets = shape.off.map((o) => (o < 0 ? -1 : rootFret + o));
  const sounding = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  const barreStrings = sounding.filter((i) => shape.off[i] === 0);
  const barre: [number, number, number] | undefined =
    shape.barre && barreStrings.length > 1 ? [rootFret, Math.min(...barreStrings), Math.max(...barreStrings)] : undefined;
  return { frets, fingers: shape.fingers.slice(), barre };
}

/** The basic shape for a chord in standard tuning, or null if its quality isn't in the default set. */
export function basicShape(c: Chord, quality: BasicQuality): PlacedShape | null {
  const root = pc(c.root);
  const open = OPEN[root]?.[quality];
  let grip: Grip | null = open ?? null;
  if (!grip) {
    const eFret = mod12(root - 4); // root on the low E string
    const aFret = mod12(root - 9); // root on the A string
    const options: Grip[] = [];
    const e = E_SHAPE[quality];
    const a = A_SHAPE[quality];
    // Fret 0 is the open shape (handled above); movable shapes start at fret 1.
    if (e) options.push(movable(e, eFret === 0 ? 12 : eFret));
    if (a) options.push(movable(a, aFret === 0 ? 12 : aFret));
    if (options.length === 0) return null;
    const lowest = (x: Grip) => Math.min(...x.frets.filter((f) => f > 0));
    grip = options.sort((x, y) => lowest(x) - lowest(y))[0]!;
  }
  const fretted = grip.frets.filter((f) => f > 0);
  const maxFret = fretted.length ? Math.max(...fretted) : 0;
  const minFret = fretted.length ? Math.min(...fretted) : 0;
  const baseFret = maxFret <= MAX_SPAN ? 1 : minFret;
  const notes = grip.frets.map((f, i) => (f < 0 ? null : mod12(STANDARD_TUNING[i]! + f)));
  const roots = notes.flatMap((n, i) => (n === root ? [i] : []));
  return { frets: grip.frets, fingers: grip.fingers, barre: grip.barre ?? null, baseFret, roots, notes };
}

/** Quality of a chord within the default set, or null for anything else. */
export function basicQuality(c: Chord): BasicQuality | null {
  const s = c.spec;
  if (s.power || s.sixth || s.extension || s.adds.length || s.alterations.length || c.bass) return null;
  if (s.third === 'sus2' && s.seventh === 'none') return 'sus2';
  if (s.third === 'sus4' && s.seventh === 'none') return 'sus4';
  if (s.third === 'minor' && s.fifth === 'flat' && s.seventh === 'none') return 'dim';
  if (s.fifth !== 'perfect') return null;
  if (s.third === 'major') return s.seventh === 'none' ? '' : s.seventh === 'minor' ? '7' : s.seventh === 'major' ? 'maj7' : null;
  if (s.third === 'minor') return s.seventh === 'none' ? 'm' : s.seventh === 'minor' ? 'm7' : null;
  return null;
}

/** All notes sounded by a shape are chord tones (used in tests and as a runtime guard). */
export function shapeMatchesChord(shape: PlacedShape, c: Chord): boolean {
  const tones = chordPcs(c);
  return shape.notes.every((n) => n === null || tones.has(n));
}
