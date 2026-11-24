// Chord symbol parsing, formatting and chord tones. Pure functions, no DOM or audio.
import {
  formatNote,
  iv,
  pc,
  readNote,
  spellInterval,
  spokenNote,
  type Interval,
  type Note,
  type PitchClass,
} from './notes';

export type Alteration = 'b5' | '#5' | 'b9' | '#9' | '#11' | 'b13';
const ALTERATION_ORDER: Alteration[] = ['b5', '#5', 'b9', '#9', '#11', 'b13'];

export interface ChordSpec {
  third: 'major' | 'minor' | 'sus2' | 'sus4' | 'none';
  fifth: 'perfect' | 'flat' | 'sharp';
  seventh: 'none' | 'minor' | 'major' | 'diminished';
  sixth: boolean;
  /** Highest stacked extension implied by the symbol (C9 → 9, C13 → 13). 0 = none. */
  extension: 0 | 9 | 11 | 13;
  /** Added natural tones: add2, add4, add9, add11, add13. */
  adds: number[];
  alterations: Alteration[];
  power: boolean;
}

export interface Chord {
  root: Note;
  bass: Note | null;
  spec: ChordSpec;
}

export type ChordErrorCode = 'empty' | 'bad-root' | 'unknown' | 'conflict' | 'too-long' | 'bad-bass';

export interface ChordError {
  code: ChordErrorCode;
  message: string;
  /** True when the text looks like the start of a valid chord (the user is still typing). */
  incomplete: boolean;
}

export type ChordParseResult = { ok: true; chord: Chord } | { ok: false; error: ChordError };

export const MAX_CHORD_LENGTH = 16;

const EMPTY_SPEC = (): ChordSpec => ({
  third: 'major',
  fifth: 'perfect',
  seventh: 'none',
  sixth: false,
  extension: 0,
  adds: [],
  alterations: [],
  power: false,
});

/** Tokens a suffix may still grow into, used to tell "still typing" from "wrong". */
const PARTIAL_TOKENS = [
  'maj', 'maj7', 'maj9', 'maj11', 'maj13', 'm', 'dim', 'dim7', 'aug', 'sus', 'sus2', 'sus4',
  'add', 'add2', 'add4', 'add9', 'add11', 'add13', 'b5', 'b9', 'b13', '#5', '#9', '#11', '11', '13', '6/9',
];

/** Rewrites aliases and mixed case into one canonical lowercase form. */
function normaliseSuffix(raw: string): string {
  let s = raw.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[()\s,]/g, '');
  s = s.replace(/Δ(7|9|11|13)?/g, (_m, d?: string) => `maj${d ?? '7'}`);
  s = s.replace(/ø7?/g, 'm7b5');
  s = s.replace(/°7/g, 'dim7').replace(/°/g, 'dim');
  s = s.replace(/^-/, 'm');
  s = s.replace(/^\+/, 'aug');
  s = s.replace(/\+(5|9|11)?/g, (_m, d?: string) => `#${d ?? '5'}`);
  // Uppercase M means major (CM7, CMaj7, CmM7); lowercase m means minor.
  s = s.replace(/M(?:aj|AJ|a)?/g, 'maj');
  s = s.toLowerCase();
  s = s.replace(/min/g, 'm').replace(/mi(?=\d|$)/g, 'm');
  if (s === 'maj') s = '';
  return s;
}

function parseSuffix(s: string): { spec: ChordSpec } | { error: ChordErrorCode; rest: string } {
  const spec = EMPTY_SPEC();
  if (s === '5') {
    spec.power = true;
    spec.third = 'none';
    return { spec };
  }
  let i = 0;
  const rest = () => s.slice(i);
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(rest());
    if (m) i += m[0].length;
    return m;
  };

  // Base quality (only at the start).
  let m: RegExpExecArray | null;
  if ((m = take(/^maj(7|9|11|13)?/))) {
    if (m[1]) {
      spec.seventh = 'major';
      const n = Number(m[1]);
      if (n > 7) spec.extension = n as 9 | 11 | 13;
    }
  } else if (take(/^dim7/)) {
    Object.assign(spec, { third: 'minor', fifth: 'flat', seventh: 'diminished' });
  } else if (take(/^dim/)) {
    Object.assign(spec, { third: 'minor', fifth: 'flat' });
  } else if (take(/^aug/)) {
    spec.fifth = 'sharp';
  } else if (take(/^m/)) {
    spec.third = 'minor';
    if ((m = take(/^maj(7|9|11|13)/))) {
      spec.seventh = 'major';
      const n = Number(m[1]);
      if (n > 7) spec.extension = n as 9 | 11 | 13;
    }
  }

  // Sixths come before sevenths/extensions: C6, C6/9, C69, Cm6.
  if (take(/^6\/?9/)) {
    spec.sixth = true;
    spec.adds.push(9);
  } else if (take(/^6/)) {
    spec.sixth = true;
  }

  while (i < s.length) {
    if ((m = take(/^(13|11|9|7)/))) {
      const n = Number(m[1]);
      if (spec.seventh === 'none' && !spec.sixth) spec.seventh = 'minor';
      if (n > 7 && n > spec.extension) spec.extension = n as 9 | 11 | 13;
      continue;
    }
    if ((m = take(/^sus([24])?/))) {
      if (spec.third === 'minor' || spec.third === 'sus2' || spec.third === 'sus4') return { error: 'conflict', rest: s };
      spec.third = m[1] === '2' ? 'sus2' : 'sus4';
      continue;
    }
    if ((m = take(/^add(b|#)?(13|11|9|4|2)/))) {
      if (m[1]) {
        const alt = `${m[1]}${m[2]}` as Alteration;
        if (!ALTERATION_ORDER.includes(alt)) return { error: 'unknown', rest: s };
        if (!spec.alterations.includes(alt)) spec.alterations.push(alt);
      } else {
        const n = Number(m[2]);
        if (!spec.adds.includes(n)) spec.adds.push(n);
      }
      continue;
    }
    if ((m = take(/^(b|#)(13|11|9|5)/))) {
      const alt = `${m[1]}${m[2]}` as Alteration;
      if (!ALTERATION_ORDER.includes(alt)) return { error: 'unknown', rest: s.slice(i - m[0].length) };
      if (alt === 'b5') spec.fifth = 'flat';
      else if (alt === '#5') spec.fifth = 'sharp';
      else if (!spec.alterations.includes(alt)) spec.alterations.push(alt);
      continue;
    }
    return { error: 'unknown', rest: rest() };
  }
  return { spec };
}

function looksIncomplete(rest: string): boolean {
  if (rest === '') return true;
  return PARTIAL_TOKENS.some((t) => t.startsWith(rest) && t !== rest);
}

function errorMessage(code: ChordErrorCode, input: string, rootText: string): string {
  const r = rootText || 'C';
  switch (code) {
    case 'empty':
      return 'Enter a chord, like Em, Cmaj7 or B7.';
    case 'bad-root':
      return 'Chords start with a note from A to G, like Em or B♭7.';
    case 'too-long':
      return `Chord symbols can be up to ${MAX_CHORD_LENGTH} characters.`;
    case 'bad-bass':
      return `The note after "/" should be a note from A to G, like ${r}/E.`;
    case 'conflict':
      return `"${input}" mixes qualities that can't go together (like minor and sus). Try ${r}m7 or ${r}7sus4.`;
    case 'unknown':
      return `Didn't recognise "${input}". Try ${r}maj7, ${r}m7♭5 or ${r}7♯9.`;
  }
}

/** Parses a chord symbol in common notation, e.g. "Em", "Cmaj7", "B7", "Asus2", "F#m7b5", "C/E". */
export function parseChord(input: string): ChordParseResult {
  const text = input.trim();
  const fail = (code: ChordErrorCode, rootText = '', incomplete = false): ChordParseResult => ({
    ok: false,
    error: { code, message: errorMessage(code, text, rootText), incomplete },
  });

  if (text === '') return fail('empty', '', true);
  if (text.length > MAX_CHORD_LENGTH) return fail('too-long');

  const root = readNote(text);
  if (!root) return fail('bad-root');
  const rootText = formatNote(root.note);
  let suffix = text.slice(root.length);

  // Slash bass: a trailing "/X" where X is a note (so "6/9" isn't mistaken for a bass note).
  let bass: Note | null = null;
  const slash = /\/([^/]*)$/.exec(suffix);
  if (slash && !/^6\/9$/.test(suffix.slice(Math.max(0, slash.index - 1)))) {
    const bassText = slash[1] ?? '';
    if (bassText === '') return fail('bad-bass', rootText, true);
    const b = readNote(bassText);
    if (!b || b.length !== bassText.length) return fail('bad-bass', rootText);
    bass = b.note;
    suffix = suffix.slice(0, slash.index);
  }

  const parsed = parseSuffix(normaliseSuffix(suffix));
  if ('error' in parsed) return fail(parsed.error, rootText, parsed.error === 'unknown' && looksIncomplete(parsed.rest));
  return { ok: true, chord: { root: root.note, bass, spec: parsed.spec } };
}

/** The chord's intervals above its root, sorted by size. Bass note not included. */
export function chordIntervals(spec: ChordSpec): Interval[] {
  if (spec.power) return [iv(1, 0), iv(5, 7)];
  const out: Interval[] = [iv(1, 0)];
  const alts = new Set(spec.alterations);

  if (spec.third === 'major') out.push(iv(3, 4));
  else if (spec.third === 'minor') out.push(iv(3, 3));
  else if (spec.third === 'sus2') out.push(iv(2, 2));
  else if (spec.third === 'sus4') out.push(iv(4, 5));

  out.push(spec.fifth === 'flat' ? iv(5, 6) : spec.fifth === 'sharp' ? iv(5, 8) : iv(5, 7));
  if (spec.sixth) out.push(iv(6, 9));
  if (spec.seventh === 'minor') out.push(iv(7, 10));
  else if (spec.seventh === 'major') out.push(iv(7, 11));
  else if (spec.seventh === 'diminished') out.push(iv(7, 9));

  const ninth = alts.has('b9') ? iv(9, 13) : alts.has('#9') ? iv(9, 15) : iv(9, 14);
  const eleventh = alts.has('#11') ? iv(11, 18) : iv(11, 17);
  const thirteenth = alts.has('b13') ? iv(13, 20) : iv(13, 21);

  if (spec.extension >= 9 || alts.has('b9') || alts.has('#9')) out.push(ninth);
  // 11th: natural 11 only when stacked (C11, Cm11), skipped on major 13ths where it clashes with the 3rd.
  if (alts.has('#11') || spec.extension === 11 || (spec.extension === 13 && spec.third === 'minor')) out.push(eleventh);
  if (spec.extension === 13 || alts.has('b13')) out.push(thirteenth);

  for (const a of spec.adds) {
    const add = a === 2 ? iv(2, 2) : a === 4 ? iv(4, 5) : a === 9 ? iv(9, 14) : a === 11 ? iv(11, 17) : iv(13, 21);
    out.push(add);
  }

  const seen = new Set<string>();
  return out
    .filter((x) => {
      const k = `${x.num}:${x.semis}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.semis - b.semis);
}

/** Spelled chord tones (root first), plus the slash bass if it isn't already a chord tone. */
export function chordNotes(chord: Chord): Note[] {
  const notes = chordIntervals(chord.spec).map((i) => spellInterval(chord.root, i));
  if (chord.bass && !notes.some((n) => pc(n) === pc(chord.bass!))) notes.unshift(chord.bass);
  return notes;
}

export function chordPcs(chord: Chord): Set<PitchClass> {
  return new Set(chordNotes(chord).map(pc));
}

/** Root, 3rd (or sus tone), 5th and 7th/6th only: the tones that define the chord. */
export function coreIntervals(spec: ChordSpec): Interval[] {
  return chordIntervals(spec).filter((i) => i.num <= 7);
}

/** The 3rd and 7th (or what replaces them) — the notes that make a chord sound like itself. */
export function guideIntervals(spec: ChordSpec): Interval[] {
  const core = coreIntervals(spec);
  const guides = core.filter((i) => i.num === 3 || i.num === 7 || i.num === 6);
  return guides.length > 0 ? guides : core.filter((i) => i.num !== 1);
}

/** True when a chord's full tones can't all be played (we only voice up to six notes). */
export function needsSimplifying(chord: Chord): boolean {
  return chordNotes(chord).length > 6;
}

/** Canonical quality suffix in ASCII (b/#), e.g. "m7b5", "maj9", "7sus4", "m(maj7)". */
export function chordSuffix(spec: ChordSpec): string {
  if (spec.power) return '5';
  const minor = spec.third === 'minor';
  const alts: Alteration[] = [...spec.alterations];
  let q = '';
  const ext = spec.extension;

  if (spec.seventh === 'diminished') {
    q = 'dim7';
  } else if (minor && spec.fifth === 'flat' && spec.seventh === 'minor' && ext === 0) {
    q = 'm7b5';
  } else if (minor && spec.fifth === 'flat' && spec.seventh === 'none' && !spec.sixth) {
    q = 'dim';
  } else {
    if (minor) q += 'm';
    if (spec.fifth === 'sharp' && spec.seventh === 'none' && !minor) q += 'aug';
    else if (spec.fifth === 'sharp') alts.unshift('#5');
    if (spec.fifth === 'flat') alts.unshift('b5');
    if (spec.sixth) q += spec.adds.includes(9) ? '6/9' : '6';
    if (spec.seventh === 'major') q += minor ? `(maj${ext || 7})` : `maj${ext || 7}`;
    else if (spec.seventh === 'minor') q += String(ext || 7);
    if (spec.third === 'sus2') q += 'sus2';
    else if (spec.third === 'sus4') q += 'sus4';
  }
  const adds = spec.adds.filter((a) => !(spec.sixth && a === 9)).sort((a, b) => a - b);
  for (const a of adds) q += `add${a}`;
  let altText = '';
  for (const a of ALTERATION_ORDER) if (alts.includes(a)) altText += a;
  // A bare alteration straight after the root ("C#11") would read back as a sharp root: bracket it.
  if (q === '' && altText !== '') return `(${altText})`;
  return q + altText;
}

/** Display suffix with real accidentals: "m7♭5", "7♯9". */
export function displaySuffix(spec: ChordSpec): string {
  return chordSuffix(spec).replace(/b/g, '♭').replace(/#/g, '♯');
}

/** The full chord symbol. Display form uses ♭/♯; ascii form uses b/# (for storage). */
export function formatChord(chord: Chord, ascii = false): string {
  const suffix = ascii ? chordSuffix(chord.spec) : displaySuffix(chord.spec);
  return formatNote(chord.root, ascii) + suffix + (chord.bass ? `/${formatNote(chord.bass, ascii)}` : '');
}

/** Parts for lead-sheet typesetting (DESIGN.md §4.3). */
export function chordParts(chord: Chord): { root: string; suffix: string; bass: string | null } {
  return {
    root: formatNote(chord.root),
    suffix: displaySuffix(chord.spec),
    bass: chord.bass ? formatNote(chord.bass) : null,
  };
}

/** Accessible name, e.g. "E minor 9", "B flat major 7 over D", "C major". */
export function spokenChord(chord: Chord): string {
  const suffix = chordSuffix(chord.spec);
  let words: string;
  if (suffix === '') words = 'major';
  else if (suffix === '5') words = '5';
  else {
    words = suffix
      .replace(/m7b5/, ' minor 7 flat 5 ')
      .replace(/maj/g, ' major ')
      .replace(/^m/, ' minor ')
      .replace(/dim/g, ' diminished ')
      .replace(/aug/g, ' augmented ')
      .replace(/sus/g, ' sus ')
      .replace(/add/g, ' add ')
      .replace(/6\/9/g, ' 6 9 ')
      .replace(/b(?=\d)/g, ' flat ')
      .replace(/#/g, ' sharp ')
      .replace(/[()]/g, ' ');
  }
  const bass = chord.bass ? ` over ${spokenNote(chord.bass)}` : '';
  return `${spokenNote(chord.root)} ${words}`.replace(/\s+/g, ' ').trim() + bass;
}

/** Re-parses a known-good symbol; throws if it isn't valid. For data and tests. */
export function chord(symbol: string): Chord {
  const r = parseChord(symbol);
  if (!r.ok) throw new Error(`Invalid chord "${symbol}": ${r.error.message}`);
  return r.chord;
}
