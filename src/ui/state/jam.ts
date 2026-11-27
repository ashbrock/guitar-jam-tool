// Jam mode state and rules (SPEC.md §4–5). A roll is a song: a verse and a contrasting chorus (§5.9),
// stored as key-relative degree slots, so a tonic change transposes and never re-rolls. What the
// engine plays the song straight through: the verse twice, then the chorus twice, on a loop (a play list).
// The engine and randomness are injected, so these rules are tested without audio (jam.test.ts).
import { batch, computed, signal } from '@preact/signals';
import { VIBES, vibeById } from '../../data/vibes/index';
import { clampTempo } from '../../audio/transport';
import type { PlaybackSlot } from '../../audio/transport';
import type { FeelSettings } from '../../audio/engine';
import { spokenChord } from '../../theory/chords';
import { resolveDegreeChord } from '../../theory/degrees';
import type { DegreeSlot } from '../../theory/generator';
import { generateSong, type Section, type Song } from '../../theory/song';
import { KEY_TONICS, formatKey, type Key, type Mode } from '../../theory/keys';
import { pc, type Note } from '../../theory/notes';
import { newSeed } from '../../theory/random';
import { simplify, type SimpleChord } from '../../theory/simplify';
import type { Vibe } from '../../theory/vibe';
import { slotStarts } from '../bars';

export const HISTORY_LIMIT = 20;
/** SPEC.md A1: first load is Neo-soul in D major. */
const DEFAULT_VIBE = 'neo-soul';
const DEFAULT_KEY: Key = { tonic: { letter: 'D', acc: 0 }, mode: 'major' };

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
  song: Song;
}

/** One chord in what the engine plays: which section it's from, which time through it, and its place there. */
export interface PlayItem {
  section: Section;
  /** 0 the first time through the section, 1 the second. */
  pass: number;
  index: number;
  bars: DegreeSlot['bars'];
}

/** The order sections play in. */
export const FORM: readonly Section[] = ['verse', 'chorus'];
/** How many times each section plays before the next (SPEC.md §5.9). */
export const REPEATS = 2;

const EMPTY_SONG: Song = { verse: [], chorus: [] };

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
export const song = signal<Song>(EMPTY_SONG);
export const history = signal<Roll[]>([]);

export const vibe = computed<Vibe>(() => vibeById(vibeId.value) ?? VIBES[0]!);
/** The verse's slots (each section has the same length in bars). */
export const slots = computed<DegreeSlot[]>(() => song.value.verse);

const toChords = (ss: readonly DegreeSlot[], k: Key) => ss.map((s) => simplify(resolveDegreeChord(s.degree, s.quality, k, s.bassDegree)));
/** Both sections as Jam shows and plays them: the simple chord set (SPEC.md §5.6). */
export const songChords = computed<Record<Section, SimpleChord[]>>(() => ({
  verse: toChords(song.value.verse, key.value),
  chorus: toChords(song.value.chorus, key.value),
}));
/** What the engine plays, in order: the verse twice, then the chorus twice. */
export const playList = computed<PlayItem[]>(() =>
  FORM.flatMap((sec) =>
    Array.from({ length: REPEATS }, (_, pass) => song.value[sec].map((s, index) => ({ section: sec, pass, index, bars: s.bars }))).flat(),
  ),
);
/** Where each play-list item starts, in bars from the top of the loop. */
export const playStarts = computed<number[]>(() => slotStarts(playList.value));

/** Every chord in play order (the carousel's cards). */
export const playChords = computed<SimpleChord[]>(() => playList.value.map((it) => songChords.value[it.section][it.index]!));

/**
 * Where to cue when a chord is picked (SPEC.md §5.2): the play-list index of that chord, on the same
 * time through its section if that section is the current one, otherwise the first time through.
 */
export function cueIndex(current: PlayItem | undefined, section: Section, index: number): number {
  const pass = current?.section === section ? current.pass : 0;
  return playList.value.findIndex((it) => it.section === section && it.pass === pass && it.index === index);
}

/** The play-list item at an engine slot index (null before playing). */
export function itemAt(slotIndex: number | null): PlayItem | undefined {
  return slotIndex === null ? undefined : playList.value[slotIndex];
}

export const canGoBack = computed(() => history.value.length > 0);

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;

function sendProgression(fromTop: boolean): void {
  const cs = songChords.value;
  sink.setProgression(
    playList.value.map((it) => ({ chord: cs[it.section][it.index]!.chord, bars: it.bars })),
    { fromTop },
  );
}

function sendFeel(): void {
  const p = vibe.value.playback;
  sink.setFeel({ groove: p.groove, swing: p.swing, voicing: p.voicing });
}

function describe(): string {
  const names = (sec: Section) => songChords.value[sec].map((c) => spokenChord(c.chord)).join(', ');
  return `New progression in ${formatKey(key.value)} at ${tempo.value} BPM. Verse: ${names('verse')}. Chorus: ${names('chorus')}. Each plays twice.`;
}

function remember(): void {
  const h = [...history.value, { vibeId: vibeId.value, key: key.value, tempo: tempo.value, song: song.value }];
  history.value = h.slice(-HISTORY_LIMIT);
}

/** Generates a new song (verse and chorus) for the current vibe and key mode, from bar 1. The vibe picks its length. */
function generateNew(): void {
  song.value = generateSong({ params: vibe.value.params, mode: key.value.mode, seed: seed() });
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
    song.value = prev.song;
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
    song.value = EMPTY_SONG;
    history.value = [];
  });
}
