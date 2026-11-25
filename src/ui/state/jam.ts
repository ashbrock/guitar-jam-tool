// Jam mode state (SPEC.md §5). The progression is stored as key-relative degree slots, so changing the
// key simply transposes it (locks included) and never re-rolls.
import { batch, computed, signal } from '@preact/signals';
import { VIBES, vibeById } from '../../data/vibes/index';
import { spokenChord } from '../../theory/chords';
import { resolveDegreeChord } from '../../theory/degrees';
import { generate, type DegreeSlot } from '../../theory/generator';
import type { Key } from '../../theory/keys';
import { newSeed } from '../../theory/random';
import { clampTempo } from '../../audio/transport';
import type { Vibe } from '../../theory/vibe';
import { engine } from './playback';

export const HISTORY_LIMIT = 20;

/** SPEC.md §11 A1: first load is Neo-soul in D major. */
const DEFAULT_VIBE = 'neo-soul';
const DEFAULT_KEY: Key = { tonic: { letter: 'D', acc: 0 }, mode: 'major' };

interface Roll {
  slots: DegreeSlot[];
  vibeId: string;
}

export const jamKey = signal<Key>(DEFAULT_KEY);
export const jamVibeId = signal<string>(DEFAULT_VIBE);
export const jamLength = signal<number>(4);
export const jamSlots = signal<DegreeSlot[]>([]);
export const jamHistory = signal<Roll[]>([]);
/** Increments on every new roll, so cards can play the "deal" animation (DESIGN.md §10.2). */
export const rollId = signal(0);
export const jamTempo = signal<number>(vibeById(DEFAULT_VIBE)!.playback.tempo.default);
/** Once the user sets tempo by hand, choosing a vibe no longer changes it (SPEC.md §4.2). */
export const tempoTouched = signal(false);
/** Polite screen-reader announcement (SPEC.md §5.3). */
export const announcement = signal('');

export const jamVibe = computed<Vibe>(() => vibeById(jamVibeId.value) ?? VIBES[0]!);
export const jamChords = computed(() => jamSlots.value.map((s) => resolveDegreeChord(s.degree, s.quality, jamKey.value, s.bassDegree)));
export const allLocked = computed(() => jamSlots.value.length > 0 && jamSlots.value.every((s) => s.locked));
export const canGoBack = computed(() => jamHistory.value.length > 0);

function syncEngine(fromTop: boolean): void {
  const chords = jamChords.value;
  engine.setProgression(
    jamSlots.value.map((s, i) => ({ chord: chords[i]!, bars: s.bars })),
    { fromTop },
  );
}

function syncFeel(): void {
  const v = jamVibe.value;
  engine.setFeel({ groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing });
}

function announce(): void {
  const names = jamChords.value.map(spokenChord).join(', ');
  // Clear first so the same text is re-announced.
  announcement.value = '';
  queueMicrotask(() => (announcement.value = `New progression: ${names}`));
}

function roll(vibeId: string, current: DegreeSlot[] | undefined): DegreeSlot[] {
  const v = vibeById(vibeId) ?? VIBES[0]!;
  const length = v.params.lengths.includes(jamLength.value) ? jamLength.value : v.params.lengths[0]!;
  return generate({ params: v.params, mode: jamKey.value.mode, lengthBars: length, current, seed: newSeed() }).slots;
}

function pushHistory(): void {
  const next = [...jamHistory.value, { slots: jamSlots.value, vibeId: jamVibeId.value }];
  jamHistory.value = next.slice(-HISTORY_LIMIT);
}

/** New chords for every unlocked slot (SPEC.md §5.3). */
export function reroll(): void {
  if (allLocked.value) return;
  batch(() => {
    pushHistory();
    jamSlots.value = roll(jamVibeId.value, jamSlots.value);
    rollId.value++;
  });
  syncEngine(true);
  announce();
}

/** Step back to the previous roll. */
export function back(): void {
  const h = jamHistory.value;
  const prev = h[h.length - 1];
  if (!prev) return;
  const vibeChanged = prev.vibeId !== jamVibeId.value;
  batch(() => {
    jamHistory.value = h.slice(0, -1);
    jamSlots.value = prev.slots;
    jamVibeId.value = prev.vibeId;
    rollId.value++;
  });
  if (vibeChanged) applyVibeTempoAndFeel();
  syncEngine(true);
  announce();
}

export function toggleLock(index: number): void {
  jamSlots.value = jamSlots.value.map((s, i) => (i === index ? { ...s, locked: !s.locked } : s));
}

function applyVibeTempoAndFeel(): void {
  if (!tempoTouched.value) setTempo(jamVibe.value.playback.tempo.default, false);
  syncFeel();
}

/** Choosing a vibe regenerates unlocked slots right away; locks stay (SPEC.md §5.2). */
export function selectVibe(id: string): void {
  if (id === jamVibeId.value) return;
  batch(() => {
    pushHistory();
    jamVibeId.value = id;
    jamSlots.value = roll(id, jamSlots.value);
    rollId.value++;
  });
  applyVibeTempoAndFeel();
  syncEngine(true);
  announce();
}

/** Changing key transposes everything, locks included, and never re-rolls (SPEC.md §4.1). */
export function setKey(key: Key): void {
  if (key.mode !== jamKey.value.mode) {
    // Major and minor use different rules, so a mode change is a new roll that keeps the locks.
    batch(() => {
      pushHistory();
      jamKey.value = key;
      jamSlots.value = roll(jamVibeId.value, jamSlots.value);
      rollId.value++;
    });
    syncEngine(true);
    announce();
    return;
  }
  jamKey.value = key;
  syncEngine(false);
}

export function setTempo(bpm: number, manual = true): void {
  const v = clampTempo(bpm);
  jamTempo.value = v;
  if (manual) tempoTouched.value = true;
  engine.setTempo(v);
}

/** First load: a progression is already there, so Jam is never empty (SPEC.md §5.2). */
export function initJam(): void {
  jamSlots.value = roll(jamVibeId.value, undefined);
  syncFeel();
  engine.setTempo(jamTempo.value);
  syncEngine(true);
}
