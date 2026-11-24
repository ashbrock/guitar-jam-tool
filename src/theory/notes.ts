// Notes, pitch classes and intervals. Pure functions, no DOM or audio.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A spelled note: letter plus accidental (-2 = double flat … +2 = double sharp). */
export interface Note {
  letter: Letter;
  acc: number;
}

/** Pitch class 0–11, C = 0. */
export type PitchClass = number;

/** An interval as a scale-step number (1 = unison, 3 = third, 9 = ninth) plus its size in semitones. */
export interface Interval {
  num: number;
  semis: number;
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

export function pc(note: Note): PitchClass {
  return mod12(LETTER_PC[note.letter] + note.acc);
}

export function note(letter: Letter, acc = 0): Note {
  return { letter, acc };
}

/**
 * Reads a note name from the start of a string, e.g. "Bb", "f#", "E♭".
 * Accepts at most one accidental. Returns null if the string doesn't start with a note.
 */
export function readNote(input: string): { note: Note; length: number } | null {
  const m = /^([A-Ga-g])([#b♯♭]?)/.exec(input);
  if (!m) return null;
  const letter = m[1]!.toUpperCase() as Letter;
  const accChar = m[2] ?? '';
  const acc = accChar === '#' || accChar === '♯' ? 1 : accChar === 'b' || accChar === '♭' ? -1 : 0;
  return { note: { letter, acc }, length: m[0].length };
}

/** Parses a whole string as a note name. */
export function parseNote(input: string): Note | null {
  const r = readNote(input.trim());
  return r && r.length === input.trim().length ? r.note : null;
}

/** "B♭" (display) or "Bb" (ascii). */
export function formatNote(n: Note, ascii = false): string {
  const flat = ascii ? 'b' : '♭';
  const sharp = ascii ? '#' : '♯';
  return n.letter + (n.acc < 0 ? flat.repeat(-n.acc) : sharp.repeat(n.acc));
}

/** "B flat", "F sharp", "E". */
export function spokenNote(n: Note): string {
  const words: Record<number, string> = { [-2]: ' double flat', [-1]: ' flat', 0: '', 1: ' sharp', 2: ' double sharp' };
  return n.letter + (words[n.acc] ?? '');
}

export function sameNote(a: Note, b: Note): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}

/** Semitones of the natural (major/perfect) interval for each step number 1–13. */
const NATURAL_SEMIS: Record<number, number> = {
  1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12, 9: 14, 10: 16, 11: 17, 12: 19, 13: 21,
};

/** Keeps an accidental offset in -6..5 so octave wrap-arounds don't produce nonsense. */
function normaliseAcc(acc: number): number {
  let a = acc % 12;
  if (a > 5) a -= 12;
  if (a < -6) a += 12;
  return a;
}

/** Spells the note an interval above a root, e.g. C + minor 3rd = E♭ (not D♯). */
export function spellInterval(root: Note, iv: Interval): Note {
  const idx = (letterIndex(root.letter) + iv.num - 1) % 7;
  const letter = LETTERS[idx]!;
  const target = pc(root) + iv.semis;
  return { letter, acc: normaliseAcc(target - LETTER_PC[letter]) };
}

/** The interval from root up to other, within an octave, spelled by letter distance. */
export function intervalBetween(root: Note, other: Note): Interval {
  const steps = (letterIndex(other.letter) - letterIndex(root.letter) + 7) % 7;
  const num = steps + 1;
  const acc = normaliseAcc(mod12(pc(other) - pc(root)) - NATURAL_SEMIS[num]!);
  return { num, semis: NATURAL_SEMIS[num]! + acc };
}

/** Accidental of an interval relative to its natural form (♭3 → -1, ♯11 → +1). */
export function intervalAccidental(iv: Interval): number {
  return iv.semis - NATURAL_SEMIS[iv.num]!;
}

/**
 * Interval label: "R", "♭3", "5", "♯11". With asDegree, the unison is "1" instead of "R".
 */
export function intervalLabel(iv: Interval, asDegree = false, ascii = false): string {
  const acc = intervalAccidental(iv);
  if (iv.num === 1 && acc === 0) return asDegree ? '1' : 'R';
  const flat = ascii ? 'b' : '♭';
  const sharp = ascii ? '#' : '♯';
  return (acc < 0 ? flat.repeat(-acc) : sharp.repeat(acc)) + String(iv.num);
}

export function iv(num: number, semis: number): Interval {
  return { num, semis };
}
