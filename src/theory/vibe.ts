// Vibe data schema and validation. Vibes live as JSON in src/data/vibes/; the generator only ever
// sees GeneratorParams, so a v2 free-text feature can produce the same params without touching it.
import { parseChord } from './chords';
import { parseDegree } from './degrees';
import type { Mode } from './keys';
import { DURATIONS, type Bars } from './progression';
import { isScaleId, type ScaleId } from './scales';

/** Weighted choices: { option: weight }. Weights are relative and must be > 0. */
export type Weights = Record<string, number>;

export interface TemplateSet {
  /** Weight of using the rule-based (Markov) generator instead of a template at this length. 0 = templates only. */
  markov: number;
  forms: { w: number; degrees: string[] }[];
}

export interface ModeRules {
  /** degree → { quality suffix: weight }. "" is a plain major triad. */
  vocabulary: Record<string, Weights>;
  /** First-chord weights. */
  starts: Weights;
  /** degree → { next degree: weight }. */
  transitions: Record<string, Weights>;
  /** Fixed forms by length in bars, e.g. "12" for a 12-bar blues. One degree per bar. */
  templates?: Record<string, TemplateSet>;
}

export interface GeneratorParams {
  /** Bar lengths offered in Jam. */
  lengths: number[];
  /** Weighted chord durations in bars (½, 1, 2, 4). */
  harmonicRhythm: { bars: Bars; w: number }[];
  minChords: number;
  /** Whether the same degree may repeat back to back (vamps). */
  allowRepeats: boolean;
  /** "closed": the last chord must be able to move back into the first. */
  loop: 'closed' | 'free';
  modes: Record<Mode, ModeRules>;
}

export interface VibePlayback {
  feel: 'straight' | 'shuffle';
  /** 0 = straight, 1 = full triplet swing. */
  swing: number;
  groove: string;
  voicing: 'close' | 'open' | 'shell';
  tempo: { default: number; min: number; max: number };
}

/**
 * How the vibe looks in the generative visuals (DESIGN.md §3). Plain data, so a v2 can map free text
 * onto it just like the generator params.
 */
/** The six visual styles, one per vibe (DESIGN.md §3.2). */
export const VISUAL_STYLES = ['ribbons', 'smoke', 'grooves', 'road', 'aurora', 'dunes'] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

/** WebGL scenes (DESIGN.md §3.5). A vibe with one uses it where WebGL 2 works; `style` is the fallback. */
export const GL_SCENES = ['liquid'] as const;
export type GlScene = (typeof GL_SCENES)[number];

export interface VibeLook {
  /** The 2D visualisation (and the fallback when the vibe has a WebGL scene). */
  style: VisualStyle;
  /** The WebGL scene, if this vibe has one. */
  gl?: GlScene;
  /** Gradient pairs: warmer for major-family chords, cooler for minor and diminished. */
  major: [string, string];
  minor: [string, string];
  /** How many elements the style draws (smoke streams, record rings, road lines, dune ridges). */
  lines: number;
  /** Stroke width in CSS px (ribbons: thickness factor). */
  width: number;
  /** Wave amplitude as a multiple of the line spacing. */
  amp: number;
  /** Drift speed (scaled by tempo). */
  speed: number;
  /** Base wave cycles across the screen. */
  cycles: number;
  /** Side-to-side lilt for shuffle feels, 0–1. */
  sway: number;
}

export interface Vibe {
  id: string;
  name: string;
  descriptor: string;
  references: string[];
  params: GeneratorParams;
  playback: VibePlayback;
  scalePreference: Record<Mode, ScaleId[]>;
  look: VibeLook;
}

/** Collects every problem in a vibe definition (an empty array means it's valid). */
export function vibeProblems(v: Vibe): string[] {
  const p: string[] = [];
  const at = (where: string, msg: string) => p.push(`${v.id || '?'} ${where}: ${msg}`);
  const weights = (where: string, w: Weights) => {
    if (Object.keys(w).length === 0) at(where, 'no options');
    for (const [k, x] of Object.entries(w)) if (!(x > 0)) at(where, `weight for "${k}" must be > 0`);
  };

  if (!/^[a-z0-9-]+$/.test(v.id)) at('id', 'must be kebab-case');
  if (!v.name) at('name', 'missing');
  if (!v.descriptor) at('descriptor', 'missing');
  if (v.references.length < 2) at('references', 'needs at least 2 artists');

  const { params, playback } = v;
  if (params.lengths.length === 0) at('lengths', 'none');
  for (const l of params.lengths) if (![4, 8, 12].includes(l)) at('lengths', `${l} is not 4, 8 or 12`);
  if (params.harmonicRhythm.length === 0) at('harmonicRhythm', 'none');
  for (const h of params.harmonicRhythm) {
    if (!(DURATIONS as readonly number[]).includes(h.bars)) at('harmonicRhythm', `${h.bars} bars is not allowed`);
    if (!(h.w > 0)) at('harmonicRhythm', 'weights must be > 0');
  }
  if (params.minChords < 1) at('minChords', 'must be at least 1');

  for (const mode of ['major', 'minor'] as Mode[]) {
    const rules = params.modes[mode];
    if (!rules) {
      at(mode, 'missing rules');
      continue;
    }
    const degrees = Object.keys(rules.vocabulary);
    for (const d of degrees) {
      if (!parseDegree(d)) at(`${mode}.vocabulary`, `"${d}" is not a degree`);
      weights(`${mode}.vocabulary.${d}`, rules.vocabulary[d]!);
      for (const q of Object.keys(rules.vocabulary[d]!)) {
        if (!parseChord(`C${q}`).ok) at(`${mode}.vocabulary.${d}`, `"${q}" is not a valid chord quality`);
      }
      if (!rules.transitions[d]) at(`${mode}.transitions`, `"${d}" has no way out`);
    }
    weights(`${mode}.starts`, rules.starts);
    for (const d of Object.keys(rules.starts)) if (!degrees.includes(d)) at(`${mode}.starts`, `"${d}" not in vocabulary`);
    for (const [from, to] of Object.entries(rules.transitions)) {
      if (!degrees.includes(from)) at(`${mode}.transitions`, `"${from}" not in vocabulary`);
      weights(`${mode}.transitions.${from}`, to);
      for (const d of Object.keys(to)) if (!degrees.includes(d)) at(`${mode}.transitions.${from}`, `"${d}" not in vocabulary`);
    }
    // Every degree should be reachable from a start.
    const seen = new Set(Object.keys(rules.starts));
    const queue = [...seen];
    while (queue.length) for (const n of Object.keys(rules.transitions[queue.shift()!] ?? {})) if (!seen.has(n)) (seen.add(n), queue.push(n));
    for (const d of degrees) if (!seen.has(d)) at(`${mode}`, `"${d}" can never be reached`);

    for (const [len, set] of Object.entries(rules.templates ?? {})) {
      if (!params.lengths.includes(Number(len))) at(`${mode}.templates.${len}`, 'length not offered');
      if (!(set.markov >= 0)) at(`${mode}.templates.${len}`, 'markov weight must be ≥ 0');
      for (const f of set.forms) {
        if (f.degrees.length !== Number(len)) at(`${mode}.templates.${len}`, `form has ${f.degrees.length} bars`);
        for (const d of f.degrees) if (!degrees.includes(d)) at(`${mode}.templates.${len}`, `"${d}" not in vocabulary`);
        if (!(f.w > 0)) at(`${mode}.templates.${len}`, 'weights must be > 0');
      }
    }
    for (const s of v.scalePreference[mode] ?? []) if (!isScaleId(s)) at(`scalePreference.${mode}`, `"${s}" is not a scale`);
  }

  const t = playback.tempo;
  if (!(t.min >= 40 && t.max <= 240 && t.min <= t.default && t.default <= t.max)) at('playback.tempo', 'must sit inside 40–240 with min ≤ default ≤ max');
  if (!(playback.swing >= 0 && playback.swing <= 1)) at('playback.swing', 'must be 0–1');
  if (!['straight', 'shuffle'].includes(playback.feel)) at('playback.feel', 'must be straight or shuffle');
  if (!['close', 'open', 'shell'].includes(playback.voicing)) at('playback.voicing', 'unknown voicing');

  const look = v.look;
  if (!look) at('look', 'missing');
  else {
    if (!(VISUAL_STYLES as readonly string[]).includes(look.style)) at('look.style', `must be one of ${VISUAL_STYLES.join(', ')}`);
    if (look.gl !== undefined && !(GL_SCENES as readonly string[]).includes(look.gl)) at('look.gl', `must be one of ${GL_SCENES.join(', ')}`);
    for (const k of ['major', 'minor'] as const) {
      const pair = look[k];
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((c) => /^#[0-9a-f]{6}$/i.test(c))) at(`look.${k}`, 'must be two #rrggbb colours');
    }
    const range = (k: keyof VibeLook, lo: number, hi: number) => {
      const x = look[k] as number;
      if (!(typeof x === 'number' && x >= lo && x <= hi)) at(`look.${k}`, `must be ${lo}–${hi}`);
    };
    range('lines', 4, 60);
    range('width', 0.5, 6);
    range('amp', 0.2, 5);
    range('speed', 0.05, 2);
    range('cycles', 0.2, 5);
    range('sway', 0, 1);
  }
  return p;
}

/** Turns untyped JSON into a Vibe, throwing with every problem listed if it's invalid. */
export function parseVibe(json: unknown): Vibe {
  const v = json as Vibe;
  const problems = vibeProblems(v);
  if (problems.length) throw new Error(`Invalid vibe:\n${problems.join('\n')}`);
  return v;
}
