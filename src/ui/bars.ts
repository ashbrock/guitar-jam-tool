// Pure helpers for the song map (SPEC.md §5.2), so they're tested without a browser.

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

/** Which beat of a chord is playing (0-based), given bars into its section; -1 outside the chord. */
export function beatIndex(barsIn: number, start: number, bars: number): number {
  const b = Math.floor((barsIn - start) * 4 + 1e-6);
  return b >= 0 && b < bars * 4 ? b : -1;
}
