// Pure helpers for the song map (SPEC.md §5.2), so they're tested without a browser.

/** Bars per line of the song map, like a lead sheet. */
export const BARS_PER_LINE = 4;

/** Where each slot starts, in bars from the start of its list. */
export function slotStarts(slots: readonly { bars: number }[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of slots) {
    out.push(t);
    t += s.bars;
  }
  return out;
}

/** One block on a line: a chord, or the part of one that falls on this line. */
export interface Segment {
  /** The chord's index in its section. */
  index: number;
  /** Where this part starts, in bars from the start of the section, and how long it is. */
  start: number;
  bars: number;
  /** First part of its chord (carries the name); last part of its chord. */
  head: boolean;
  tail: boolean;
}

/**
 * Lays a section out in lines of `perLine` bars. A chord that runs over a line end is split into
 * parts, so every line keeps the same bar grid.
 */
export function chartLines(slots: readonly { bars: number }[], perLine: number = BARS_PER_LINE): Segment[][] {
  const lines: Segment[][] = [];
  const starts = slotStarts(slots);
  slots.forEach((s, index) => {
    const end = starts[index]! + s.bars;
    let at = starts[index]!;
    while (at < end - 1e-9) {
      const line = Math.floor(at / perLine + 1e-9);
      const stop = Math.min(end, (line + 1) * perLine);
      (lines[line] ??= []).push({ index, start: at, bars: stop - at, head: at === starts[index], tail: stop >= end - 1e-9 });
      at = stop;
    }
  });
  return lines;
}

/** How full a block is (0–1), given how many bars into its section we are. */
export function blockFill(barsIn: number, start: number, bars: number): number {
  return bars <= 0 ? 0 : Math.max(0, Math.min(1, (barsIn - start) / bars));
}
