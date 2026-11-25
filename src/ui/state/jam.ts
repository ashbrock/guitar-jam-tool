// Jam mode state and rules (SPEC.md §4–5). Progressions are stored as key-relative degree slots, so a
// tonic change transposes and never re-rolls. The engine and randomness are injected, so these rules
// are tested without audio (jam.test.ts).
import { batch, computed, signal } from '@preact/signals';
import { VIBES, vibeById } from '../../data/vibes/index';
import { clampTempo } from '../../audio/transport';
import type { PlaybackSlot } from '../../audio/transport';
import type { FeelSettings } from '../../audio/engine';
import { spokenChord } from '../../theory/chords';
import { resolveDegreeChord } from '../../theory/degrees';
import { generate, type DegreeSlot } from '../../theory/generator';
import { KEY_TONICS, formatKey, type Key, type Mode } from '../../theory/keys';
import { pc, type Note } from '../../theory/notes';
import { newSeed } from '../../theory/random';
import { simplify, type SimpleChord } from '../../theory/simplify';
import type { Vibe } from '../../theory/vibe';

export const HISTORY_LIMIT = 20;
/** SPEC.md A1: first load is Neo-soul in D major, 4 bars. */
const DEFAULT_VIBE = 'neo-soul';
const DEFAULT_KEY: Key = { tonic: { letter: 'D', acc: 0 }, mode: 'major' };
const DEFAULT_LENGTH = 4;

/** What Jam needs from the audio engine. */
export interface JamSink {
  setProgression(slots: readonly PlaybackSlot[], opts?: { fromTop?: boolean }): void;
  setTempo(bpm: number): void;
  setFeel(feel: FeelSettings): void;
}

interface Roll {
  vibeId: string;
  key: Key;
  tempo: number;
  slots: DegreeSlot[];
}

let sink: JamSink = { setProgression() {}, setTempo() {}, setFeel() {} };
let random: () => number = Math.random;
let seed: () => number = newSeed;
let onNewProgression: (text: string) => void = () => {};

/** Wires Jam to the engine (and, in tests, to a seeded random source). */
export function configureJam(opts: { sink?: JamSink; random?: () => number; seed?: () => number; announce?: (text: string) => void }): void {
  if (opts.sink) sink = opts.sink;
  if (opts.random) random = opts.random;
  if (opts.seed) seed = opts.seed;
  if (opts.announce) onNewProgression = opts.announce;
}

export const vibeId = signal(DEFAULT_VIBE);
export const key = signal<Key>(DEFAULT_KEY);
export const tempo = signal(vibeById(DEFAULT_VIBE)!.playback.tempo.default);
export const keyHeld = signal(false);
export const tempoHeld = signal(false);
export const lengthBars = signal(DEFAULT_LENGTH);
export const slots = signal<DegreeSlot[]>([]);
export const history = signal<Roll[]>([]);

export const vibe = computed<Vibe>(() => vibeById(vibeId.value) ?? VIBES[0]!);
/** The progression as Jam shows and plays it: the simple chord set (SPEC.md §5.6). */
export const chords = computed<SimpleChord[]>(() =>
  slots.value.map((s) => simplify(resolveDegreeChord(s.degree, s.quality, key.value, s.bassDegree))),
);
export const canGoBack = computed(() => history.value.length > 0);

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;

function sendProgression(fromTop: boolean): void {
  const cs = chords.value;
  sink.setProgression(slots.value.map((s, i) => ({ chord: cs[i]!.chord, bars: s.bars })), { fromTop });
}

function sendFeel(): void {
  const p = vibe.value.playback;
  sink.setFeel({ groove: p.groove, swing: p.swing, voicing: p.voicing });
}

function describe(): string {
  const names = chords.value.map((c) => spokenChord(c.chord)).join(', ');
  return `New progression in ${formatKey(key.value)} at ${tempo.value} BPM: ${names}`;
}

function remember(): void {
  const h = [...history.value, { vibeId: vibeId.value, key: key.value, tempo: tempo.value, slots: slots.value }];
  history.value = h.slice(-HISTORY_LIMIT);
}

/** The chosen length if this vibe offers it; otherwise the longest it offers below it (Blues 12 → 8). */
function fitLength(v: Vibe, want: number): number {
  const ls = v.params.lengths;
  return ls.includes(want) ? want : ([...ls].reverse().find((l) => l < want) ?? ls[0]!);
}

/** Generates a new progression for the current vibe, key mode and length, and starts it from bar 1. */
function generateNew(): void {
  lengthBars.value = fitLength(vibe.value, lengthBars.value);
  slots.value = generate({ params: vibe.value.params, mode: key.value.mode, lengthBars: lengthBars.value, seed: seed() }).slots;
  sendFeel();
  sink.setTempo(tempo.value);
  sendProgression(true);
  onNewProgression(describe());
}

/** First load (SPEC.md §5.1): a progression is ready before anything is tapped. */
export function initJam(): void {
  generateNew();
}

/** Re-roll (SPEC.md §5.3): new chords, and a new key and tempo unless held. */
export function reroll(): void {
  batch(() => {
    remember();
    if (!keyHeld.value) {
      const m: Mode = random() < 0.5 ? 'major' : 'minor';
      key.value = { tonic: pick(KEY_TONICS[m]), mode: m };
    }
    if (!tempoHeld.value) {
      const t = vibe.value.playback.tempo;
      tempo.value = clampTempo(t.min + random() * (t.max - t.min));
    }
    generateNew();
  });
}

/** Back (SPEC.md §5.4): restore the previous roll exactly. Returns false at the oldest roll. */
export function back(): boolean {
  const h = history.value;
  const prev = h[h.length - 1];
  if (!prev) return false;
  batch(() => {
    history.value = h.slice(0, -1);
    vibeId.value = prev.vibeId;
    key.value = prev.key;
    tempo.value = prev.tempo;
    slots.value = prev.slots;
    lengthBars.value = prev.slots.reduce((a, s) => a + s.bars, 0);
    sendFeel();
    sink.setTempo(tempo.value);
    sendProgression(true);
    onNewProgression(describe());
  });
  return true;
}

/** Vibe picker (SPEC.md §4.2): a new progression in the same key; tempo to the vibe default unless held. */
export function chooseVibe(id: string): void {
  if (!vibeById(id)) return;
  batch(() => {
    remember();
    vibeId.value = id;
    if (!tempoHeld.value) tempo.value = vibe.value.playback.tempo.default;
    generateNew();
  });
}

/** Length (SPEC.md §5.5): a new progression at that length, same key and tempo. */
export function chooseLength(bars: number): void {
  if (bars === lengthBars.value || !vibe.value.params.lengths.includes(bars)) return;
  batch(() => {
    remember();
    lengthBars.value = bars;
    generateNew();
  });
}

/** Key picker, tonic (SPEC.md §4.3): transposes; nothing re-rolls; the loop keeps its place. */
export function chooseTonic(tonic: Note): void {
  if (pc(tonic) === pc(key.value.tonic)) return;
  key.value = { tonic, mode: key.value.mode };
  sendProgression(false);
}

/** Key picker, mode (SPEC.md §4.3): a new progression in the same tonic; the old one goes on the history. */
export function chooseMode(m: Mode): void {
  if (m === key.value.mode) return;
  batch(() => {
    remember();
    const same = KEY_TONICS[m].find((t) => pc(t) === pc(key.value.tonic)) ?? KEY_TONICS[m][0]!;
    key.value = { tonic: same, mode: m };
    generateNew();
  });
}

/** Tempo picker (SPEC.md §4.4). Clamped to 40–240. */
export function setTempo(bpm: number): void {
  const t = clampTempo(bpm);
  if (t === tempo.value) return;
  tempo.value = t;
  sink.setTempo(t);
}

/** For tests: back to first-load state. */
export function resetJam(): void {
  batch(() => {
    vibeId.value = DEFAULT_VIBE;
    key.value = DEFAULT_KEY;
    tempo.value = vibeById(DEFAULT_VIBE)!.playback.tempo.default;
    keyHeld.value = false;
    tempoHeld.value = false;
    lengthBars.value = DEFAULT_LENGTH;
    slots.value = [];
    history.value = [];
  });
}
