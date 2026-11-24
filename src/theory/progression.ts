// Progression text parsing ("| Em | C | G D |") and length rules.
import { parseChord, type Chord, type ChordError } from './chords';

export const DURATIONS = [0.5, 1, 2, 4] as const;
export type Bars = (typeof DURATIONS)[number];

export const MAX_BARS = { solo: 16 } as const;

export interface Slot {
  chord: Chord;
  bars: Bars;
}

export interface ProgressionToken {
  text: string;
  /** Character offsets in the original input, for underlining errors. */
  start: number;
  end: number;
  bars: Bars;
  chord: Chord | null;
  error: ChordError | null;
}

export interface BarError {
  start: number;
  end: number;
  message: string;
}

export interface ProgressionParse {
  tokens: ProgressionToken[];
  barErrors: BarError[];
  /** Number of problems the user must fix. */
  errorCount: number;
  /** The slots, only when everything is valid and there's at least one chord. */
  slots: Slot[] | null;
}

interface RawToken {
  text: string;
  start: number;
  end: number;
}

function tokensIn(text: string, offset: number): RawToken[] {
  const out: RawToken[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ text: m[0], start: offset + m.index, end: offset + m.index + m[0].length });
  return out;
}

/**
 * Parses a whole progression typed as text.
 * Without bar lines every chord is one bar. With bar lines, a bar holds one chord (1 bar)
 * or two chords (½ bar each).
 */
export function parseProgressionText(input: string): ProgressionParse {
  const groups: { tokens: RawToken[]; bars: Bars; start: number; end: number }[] = [];
  const barErrors: BarError[] = [];

  if (input.includes('|')) {
    let pos = 0;
    for (const segment of input.split('|')) {
      const toks = tokensIn(segment, pos);
      if (toks.length === 1) groups.push({ tokens: toks, bars: 1, start: pos, end: pos + segment.length });
      else if (toks.length === 2) groups.push({ tokens: toks, bars: 0.5, start: pos, end: pos + segment.length });
      else if (toks.length > 2) {
        barErrors.push({ start: toks[0]!.start, end: toks[toks.length - 1]!.end, message: 'A bar can hold 1 or 2 chords.' });
        groups.push({ tokens: toks, bars: 1, start: pos, end: pos + segment.length });
      }
      pos += segment.length + 1;
    }
  } else {
    for (const t of tokensIn(input, 0)) groups.push({ tokens: [t], bars: 1, start: t.start, end: t.end });
  }

  const tokens: ProgressionToken[] = [];
  for (const g of groups) {
    for (const t of g.tokens) {
      const r = parseChord(t.text);
      tokens.push({ ...t, bars: g.bars, chord: r.ok ? r.chord : null, error: r.ok ? null : r.error });
    }
  }
  const errorCount = tokens.filter((t) => t.error).length + barErrors.length;
  const slots =
    errorCount === 0 && tokens.length > 0 ? tokens.map((t) => ({ chord: t.chord!, bars: t.bars })) : null;
  return { tokens, barErrors, errorCount, slots };
}

export function totalBars(slots: readonly { bars: number }[]): number {
  return slots.reduce((sum, s) => sum + s.bars, 0);
}

/** Whether a slot of `bars` can be added without exceeding `max`. */
export function fitsLength(slots: readonly { bars: number }[], bars: number, max: number): boolean {
  return totalBars(slots) + bars <= max;
}

/** Start position (in bars) of each slot. */
export function slotStarts(slots: readonly { bars: number }[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of slots) {
    out.push(t);
    t += s.bars;
  }
  return out;
}
