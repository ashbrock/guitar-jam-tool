// Scale tables. Intervals carry step numbers so every scale spells correctly in any key.
import { iv, pc, spellInterval, type Interval, type Note, type PitchClass } from './notes';

export type ScaleId =
  | 'major'
  | 'naturalMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'minorBlues'
  | 'majorBlues'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'harmonicMinor';

export interface ScaleDef {
  id: ScaleId;
  name: string;
  intervals: readonly Interval[];
}

const R = iv(1, 0);
const m2 = iv(2, 1), M2 = iv(2, 2);
const m3 = iv(3, 3), M3 = iv(3, 4);
const P4 = iv(4, 5), A4 = iv(4, 6);
const d5 = iv(5, 6), P5 = iv(5, 7);
const m6 = iv(6, 8), M6 = iv(6, 9);
const m7 = iv(7, 10), M7 = iv(7, 11);

export const SCALES: Record<ScaleId, ScaleDef> = {
  major: { id: 'major', name: 'Major', intervals: [R, M2, M3, P4, P5, M6, M7] },
  naturalMinor: { id: 'naturalMinor', name: 'Natural minor', intervals: [R, M2, m3, P4, P5, m6, m7] },
  majorPentatonic: { id: 'majorPentatonic', name: 'Major pentatonic', intervals: [R, M2, M3, P5, M6] },
  minorPentatonic: { id: 'minorPentatonic', name: 'Minor pentatonic', intervals: [R, m3, P4, P5, m7] },
  minorBlues: { id: 'minorBlues', name: 'Minor blues', intervals: [R, m3, P4, d5, P5, m7] },
  majorBlues: { id: 'majorBlues', name: 'Major blues', intervals: [R, M2, m3, M3, P5, M6] },
  dorian: { id: 'dorian', name: 'Dorian', intervals: [R, M2, m3, P4, P5, M6, m7] },
  mixolydian: { id: 'mixolydian', name: 'Mixolydian', intervals: [R, M2, M3, P4, P5, M6, m7] },
  lydian: { id: 'lydian', name: 'Lydian', intervals: [R, M2, M3, A4, P5, M6, M7] },
  phrygian: { id: 'phrygian', name: 'Phrygian', intervals: [R, m2, m3, P4, P5, m6, m7] },
  harmonicMinor: { id: 'harmonicMinor', name: 'Harmonic minor', intervals: [R, M2, m3, P4, P5, m6, M7] },
};

export const SCALE_IDS = Object.keys(SCALES) as ScaleId[];

export function isScaleId(id: string): id is ScaleId {
  return id in SCALES;
}

export function scaleNotes(root: Note, id: ScaleId): Note[] {
  return SCALES[id].intervals.map((i) => spellInterval(root, i));
}

export function scalePcs(root: Note, id: ScaleId): Set<PitchClass> {
  return new Set(scaleNotes(root, id).map(pc));
}
