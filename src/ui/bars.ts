// Pure helpers for the bar timeline (SPEC.md §5.2), so they're tested without a browser.

/** How full bar i (0-based) of a section is, given how many bars into the section we are (0–1). */
export function barFill(i: number, barsIn: number): number {
  return Math.max(0, Math.min(1, barsIn - i));
}

/** Where each slot starts, in bars from the start of its section. */
export function slotStarts(slots: readonly { bars: number }[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of slots) {
    out.push(t);
    t += s.bars;
  }
  return out;
}
