// Rule-based progression generator. Pure and seeded: same params + locks + seed → same progression.
// Knows nothing about specific vibes; everything comes from GeneratorParams (SPEC.md §9).
import type { Mode } from './keys';
import type { Bars } from './progression';
import { createRng, pickWeighted, type Rng } from './random';
import type { GeneratorParams, ModeRules, Weights } from './vibe';

/** A key-relative chord slot. Jam stores progressions in this form so key changes simply transpose. */
export interface DegreeSlot {
  degree: string;
  quality: string;
  bassDegree?: string;
  bars: Bars;
  locked: boolean;
}

export interface GenerateInput {
  params: GeneratorParams;
  mode: Mode;
  lengthBars: number;
  /** The current progression. Locked slots are kept at their positions; the rest is regenerated. */
  current?: readonly DegreeSlot[];
  seed: number;
}

/** Rules relaxed, in this order, when the strict rules can't be met (SPEC.md §9.3). */
export type Relaxation = 'repeats' | 'loop' | 'neighbours' | 'transitions';
const LEVELS: Relaxation[] = ['repeats', 'loop', 'neighbours', 'transitions'];
const ATTEMPTS_PER_LEVEL = 50;

export interface GenerateResult {
  slots: DegreeSlot[];
  /** Rules that had to be relaxed to produce this result (empty when all rules held). */
  relaxed: Relaxation[];
}

interface Placed {
  start: number;
  bars: Bars;
  fixed: DegreeSlot | null;
}

const entries = (w: Weights | undefined): [string, number][] => Object.entries(w ?? {});

/** Locked slots that still fit inside the requested length, with their start positions. */
function fixedSlots(current: readonly DegreeSlot[] | undefined, length: number): Placed[] {
  const out: Placed[] = [];
  let t = 0;
  for (const s of current ?? []) {
    if (s.locked && t + s.bars <= length) out.push({ start: t, bars: s.bars, fixed: s });
    t += s.bars;
  }
  return out;
}

/** Fills [start, end) with chord durations. Chords of a bar or more start on a bar line; ½-bar chords come in pairs. */
function fillSpan(start: number, end: number, rng: Rng, rhythm: GeneratorParams['harmonicRhythm']): Bars[] {
  const out: Bars[] = [];
  let pos = start;
  while (pos < end - 1e-9) {
    const remaining = end - pos;
    if (pos % 1 !== 0 || remaining < 1) {
      out.push(0.5);
      pos += 0.5;
      continue;
    }
    const options = rhythm.filter((h) => h.bars <= remaining).map((h) => [h.bars, h.w] as const);
    const d = (pickWeighted(rng, options) ?? 1) as Bars;
    if (d === 0.5) {
      out.push(0.5, 0.5);
      pos += 1;
    } else {
      out.push(d);
      pos += d;
    }
  }
  return out;
}

function layout(length: number, fixed: Placed[], rng: Rng, rhythm: GeneratorParams['harmonicRhythm']): Placed[] {
  const out: Placed[] = [];
  let pos = 0;
  for (const f of [...fixed, { start: length, bars: 0.5 as Bars, fixed: null }]) {
    for (const bars of fillSpan(pos, f.start, rng, rhythm)) {
      out.push({ start: pos, bars, fixed: null });
      pos += bars;
    }
    if (f.start < length) {
      out.push(f);
      pos = f.start + f.bars;
    }
  }
  return out;
}

function pickQuality(rules: ModeRules, degree: string, rng: Rng): string {
  return pickWeighted(rng, entries(rules.vocabulary[degree])) ?? '';
}

/** Splits a run of identical template bars into aligned 4/2/1-bar chunks. */
function chunkRun(start: number, length: number): { start: number; bars: Bars }[] {
  const out: { start: number; bars: Bars }[] = [];
  let p = start;
  while (p < start + length) {
    const left = start + length - p;
    const d = ([4, 2, 1] as const).find((x) => x <= left && p % x === 0) ?? 1;
    out.push({ start: p, bars: d });
    p += d;
  }
  return out;
}

function fromTemplate(degrees: string[], fixed: Placed[], rules: ModeRules, rng: Rng): DegreeSlot[] | null {
  // Locks must line up with whole bars of the template and match its degrees.
  for (const f of fixed) {
    if (f.start % 1 !== 0 || f.bars % 1 !== 0) return null;
    for (let b = f.start; b < f.start + f.bars; b++) if (degrees[b] !== f.fixed!.degree) return null;
  }
  const out: DegreeSlot[] = [];
  let bar = 0;
  while (bar < degrees.length) {
    const f = fixed.find((x) => x.start === bar);
    if (f) {
      out.push(f.fixed!);
      bar += f.bars;
      continue;
    }
    let end = bar;
    while (end < degrees.length && degrees[end] === degrees[bar] && !fixed.some((x) => x.start === end)) end++;
    for (const c of chunkRun(bar, end - bar)) {
      const degree = degrees[bar]!;
      out.push({ degree, quality: pickQuality(rules, degree, rng), bars: c.bars, locked: false });
    }
    bar = end;
  }
  return out;
}

function markov(
  input: GenerateInput,
  rules: ModeRules,
  fixed: Placed[],
  rng: Rng,
  level: number,
): DegreeSlot[] | null {
  const { params } = input;
  const relax = (r: Relaxation) => level > LEVELS.indexOf(r);
  const placed = layout(input.lengthBars, fixed, rng, params.harmonicRhythm);
  if (placed.length < params.minChords && level < LEVELS.length) return null;

  const degs: (string | null)[] = placed.map((p) => p.fixed?.degree ?? null);
  const n = placed.length;
  const known = (d: string | null | undefined): d is string => !!d && d in rules.transitions;
  const can = (from: string, to: string) => (rules.transitions[from]?.[to] ?? 0) > 0;
  const closed = params.loop === 'closed' && n > 1;
  const allDegrees: [string, number][] = Object.keys(rules.vocabulary).map((d) => [d, 1]);

  for (let i = 0; i < n; i++) {
    if (degs[i]) continue;
    const prev = i > 0 ? degs[i - 1]! : null;
    let options: [string, number][] = relax('transitions')
      ? allDegrees
      : prev === null
        ? entries(rules.starts)
        : known(prev)
          ? entries(rules.transitions[prev])
          : entries(rules.starts);

    const next = i + 1 < n ? degs[i + 1] : null; // only fixed slots are known ahead
    const last = degs[n - 1];
    options = options.filter(([d]) => {
      if (!relax('repeats') && !params.allowRepeats) {
        if (d === prev || d === next) return false;
        if (closed && i === n - 1 && d === degs[0]) return false;
        if (closed && i === 0 && d === last) return false;
      }
      if (!relax('neighbours') && known(next) && !can(d, next)) return false;
      if (!relax('loop') && closed) {
        if (i === n - 1 && known(degs[0]) && !can(d, degs[0]!)) return false;
        if (i === 0 && known(last) && !can(last, d)) return false;
      }
      return true;
    });
    const choice = pickWeighted(rng, options);
    if (choice === null) return null;
    degs[i] = choice;
  }

  const slots = mergeHeld(
    placed.map((p, i) => p.fixed ?? { degree: degs[i]!, quality: pickQuality(rules, degs[i]!, rng), bars: p.bars, locked: false }),
  );
  if (slots.length < params.minChords && level < LEVELS.length) return null;
  return slots;
}

/**
 * A repeated degree means "hold the chord": merges neighbouring unlocked slots on the same degree
 * (e.g. Em7(½) Em7(½) Em7 → Em7(2)) when the result is a valid, bar-aligned duration.
 */
function mergeHeld(slots: DegreeSlot[]): DegreeSlot[] {
  // Repeat until stable: I(1) I(1) I(2) → I(2) I(2) → I(4).
  let current = slots;
  for (;;) {
    const next = mergeOnce(current);
    if (next.length === current.length) return next;
    current = next;
  }
}

function mergeOnce(slots: DegreeSlot[]): DegreeSlot[] {
  const out: DegreeSlot[] = [];
  let pos = 0;
  let start = 0;
  for (const s of slots) {
    const prev = out[out.length - 1];
    const combined = prev ? prev.bars + s.bars : 0;
    if (
      prev && !prev.locked && !s.locked && prev.degree === s.degree &&
      (combined === 1 || combined === 2 || combined === 4) && start % 1 === 0
    ) {
      out[out.length - 1] = { ...prev, bars: combined as Bars };
    } else {
      out.push(s);
      start = pos;
    }
    pos += s.bars;
  }
  return out;
}

function sameProgression(a: readonly DegreeSlot[], b: readonly DegreeSlot[] | undefined): boolean {
  if (!b || a.length !== b.length) return false;
  return a.every((s, i) => s.degree === b[i]!.degree && s.quality === b[i]!.quality && s.bars === b[i]!.bars);
}

/** Generates a progression. Never returns an empty progression (SPEC.md §9.3.6). */
export function generate(input: GenerateInput): GenerateResult {
  const rules = input.params.modes[input.mode];
  const rng = createRng(input.seed);
  const fixed = fixedSlots(input.current, input.lengthBars);
  const templates = rules.templates?.[String(input.lengthBars)];
  // Only forms that agree with the locks; if none do, fall back to the rule-based path.
  const usableForms = (templates?.forms ?? []).filter((f) => fromTemplate(f.degrees, fixed, rules, createRng(0)) !== null);

  for (let level = 0; level <= LEVELS.length; level++) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_LEVEL; attempt++) {
      let slots: DegreeSlot[] | null = null;
      if (usableForms.length > 0) {
        const choices: [number, number][] = usableForms.map((f, i) => [i, f.w]);
        choices.push([-1, templates!.markov]);
        const pick = pickWeighted(rng, choices);
        if (pick !== null && pick >= 0) {
          const t = fromTemplate(usableForms[pick]!.degrees, fixed, rules, rng);
          slots = t && mergeHeld(t);
        }
      }
      slots ??= markov(input, rules, fixed, rng, level);
      if (!slots) continue;
      const lastChance = level === LEVELS.length && attempt === ATTEMPTS_PER_LEVEL - 1;
      if (sameProgression(slots, input.current) && !lastChance) continue;
      return { slots, relaxed: LEVELS.slice(0, level) };
    }
  }
  // Unreachable in practice (the last level ignores transitions), but never return nothing.
  const degree = Object.keys(rules.starts)[0] ?? 'I';
  return { slots: [{ degree, quality: pickQuality(rules, degree, rng), bars: input.lengthBars as Bars, locked: false }], relaxed: [...LEVELS] };
}

export interface SwapOption {
  degree: string;
  quality: string;
}

/**
 * Alternatives for one slot that the vibe's rules allow between its neighbours (SPEC.md §5.5):
 * other degrees first (ranked by how naturally they connect), then other colours of the same degree.
 */
export function swapOptions(params: GeneratorParams, mode: Mode, slots: readonly DegreeSlot[], index: number, max = 6): SwapOption[] {
  const rules = params.modes[mode];
  const cur = slots[index];
  if (!cur) return [];
  const n = slots.length;
  const closed = params.loop === 'closed';
  const prev = index > 0 ? slots[index - 1] : closed && n > 1 ? slots[n - 1] : undefined;
  const next = index < n - 1 ? slots[index + 1] : closed && n > 1 ? slots[0] : undefined;
  const w = (from: string | undefined, to: string) => (from ? (rules.transitions[from]?.[to] ?? 0) : (rules.starts[to] ?? 0));

  const bestQuality = (d: string) => entries(rules.vocabulary[d]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const score = (d: string, strict: boolean) => {
    const a = w(prev?.degree, d);
    const b = next ? (rules.transitions[d]?.[next.degree] ?? 0) : 1;
    return strict ? (a > 0 && b > 0 ? a * b : 0) : a + b;
  };
  const degrees = Object.keys(rules.vocabulary).filter((d) => d !== cur.degree);
  let ranked = degrees.map((d) => [d, score(d, true)] as const).filter(([, s]) => s > 0);
  if (ranked.length < 3) ranked = degrees.map((d) => [d, score(d, false)] as const).filter(([, s]) => s > 0);
  ranked = [...ranked].sort((a, b) => b[1] - a[1]);

  const others: SwapOption[] = ranked.map(([d]) => ({ degree: d, quality: bestQuality(d) }));
  const colours: SwapOption[] = entries(rules.vocabulary[cur.degree])
    .sort((a, b) => b[1] - a[1])
    .filter(([q]) => q !== cur.quality)
    .map(([q]) => ({ degree: cur.degree, quality: q }));
  // Keep room for up to two colours of the same chord after the alternatives.
  const keepColours = Math.min(colours.length, 2);
  return [...others.slice(0, max - keepColours), ...colours].slice(0, max);
}
