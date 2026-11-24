// Fretboard mapping: tunings, which note sits at each string/fret, and each note's role.
import { avoidNotes, landingNotes } from './analysis';
import { chordNotes, chordPcs, type Chord } from './chords';
import { degreeInKey, spellInKey, type Key } from './keys';
import { formatNote, intervalBetween, intervalLabel, mod12, pc, type Note, type PitchClass } from './notes';
import { scaleNotes, type ScaleId } from './scales';

export interface Tuning {
  id: string;
  name: string;
  /** MIDI note numbers, lowest-pitched string first. */
  strings: readonly number[];
}

export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard (E A D G B E)', strings: [40, 45, 50, 55, 59, 64] },
  { id: 'half-step-down', name: 'Half-step down (E♭ A♭ D♭ G♭ B♭ E♭)', strings: [39, 44, 49, 54, 58, 63] },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', strings: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G (D G D G B D)', strings: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d', name: 'Open D (D A D F♯ A D)', strings: [38, 45, 50, 54, 57, 62] },
];

export const DEFAULT_FRETS = 15;

export function tuningById(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]!;
}

export interface FretPosition {
  /** 0 = lowest-pitched string. */
  string: number;
  /** 0 = open string. */
  fret: number;
  midi: number;
  pc: PitchClass;
}

export function fretPositions(tuning: Tuning, frets = DEFAULT_FRETS): FretPosition[] {
  const out: FretPosition[] = [];
  tuning.strings.forEach((open, string) => {
    for (let fret = 0; fret <= frets; fret++) out.push({ string, fret, midi: open + fret, pc: mod12(open + fret) });
  });
  return out;
}

export type Role = 'root' | 'chord' | 'landing' | 'approach' | 'avoid' | 'scale';
export type LabelMode = 'note' | 'interval' | 'degree';

export interface Layers {
  chord: boolean;
  scale: boolean;
  landing: boolean;
  /** Notes a half step from a landing note. Only shown alongside landing notes. */
  approach: boolean;
  avoid: boolean;
}

export interface FretboardInput {
  key: Key;
  chord: Chord | null;
  /** The next chord, when landing notes should be shown right now. */
  next: Chord | null;
  scale: { root: Note; id: ScaleId } | null;
  layers: Layers;
}

export interface FretMarker extends FretPosition {
  role: Role | null;
  /** A chord tone or root that is also a landing note (DESIGN.md §3). */
  landingBadge: boolean;
  note: Note;
}

/** Spell a pitch class using the most specific context: chord, then scale, then key. */
function spell(p: PitchClass, input: FretboardInput, chordSpelled: Note[], scaleSpelled: Note[]): Note {
  return chordSpelled.find((n) => pc(n) === p) ?? scaleSpelled.find((n) => pc(n) === p) ?? spellInKey(p, input.key);
}

/**
 * Assigns each position its role. Priority: Root > Chord tone > Landing > Approach > Avoid > Scale.
 * (Avoid sits above Scale because avoid notes are always scale notes. Approach sits above both
 * because, in the moment before a change, where to go matters more than what to avoid.)
 */
export function mapFretboard(tuning: Tuning, input: FretboardInput, frets = DEFAULT_FRETS): FretMarker[] {
  const { chord, next, scale, layers } = input;
  const chordSet = chord ? chordPcs(chord) : new Set<PitchClass>();
  const scaleSpelled = scale ? scaleNotes(scale.root, scale.id) : [];
  const scaleSet = new Set(scaleSpelled.map(pc));
  const landingInfo = next ? landingNotes(next) : null;
  const landing = layers.landing && landingInfo ? landingInfo.targets : new Set<PitchClass>();
  const approach = layers.landing && layers.approach && landingInfo ? landingInfo.approaches : new Set<PitchClass>();
  const avoid = layers.avoid && chord && scale ? avoidNotes(scaleSet, chord) : new Set<PitchClass>();
  const chordSpelled = chord ? chordNotes(chord) : [];
  const nextSpelled = next ? chordNotes(next) : [];

  let rootPc: PitchClass | null = null;
  if (layers.chord && chord) rootPc = pc(chord.root);
  else if (layers.scale && scale) rootPc = pc(scale.root);

  return fretPositions(tuning, frets).map((pos) => {
    const p = pos.pc;
    const isRoot = rootPc !== null && p === rootPc;
    const isChord = layers.chord && chordSet.has(p);
    const isLanding = landing.has(p);
    const isApproach = approach.has(p);
    const isAvoid = avoid.has(p);
    const isScale = layers.scale && scaleSet.has(p);
    const role: Role | null = isRoot
      ? 'root'
      : isChord
        ? 'chord'
        : isLanding
          ? 'landing'
          : isApproach
            ? 'approach'
            : isAvoid
              ? 'avoid'
              : isScale
                ? 'scale'
                : null;
    const note = isLanding && !isChord ? (nextSpelled.find((n) => pc(n) === p) ?? spell(p, input, chordSpelled, scaleSpelled)) : spell(p, input, chordSpelled, scaleSpelled);
    return { ...pos, role, landingBadge: isLanding && (role === 'chord' || role === 'root'), note };
  });
}

/**
 * Marker label. Intervals are relative to the current chord's root (or the key tonic with no chord);
 * degrees are relative to the key.
 */
export function markerLabel(note: Note, mode: LabelMode, key: Key, chord: Chord | null): string {
  if (mode === 'note') return formatNote(note);
  if (mode === 'degree') return intervalLabel(degreeInKey(note, key), true);
  return intervalLabel(intervalBetween(chord ? chord.root : key.tonic, note));
}

/** Mirrors string order for left-handed display without changing the underlying data. */
export function displayStringOrder(stringCount: number, leftHanded: boolean): number[] {
  const order = Array.from({ length: stringCount }, (_, i) => i);
  return leftHanded ? order.reverse() : order;
}
