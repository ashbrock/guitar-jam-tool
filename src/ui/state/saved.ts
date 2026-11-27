// Saved progressions (SPEC.md §5.10): kept in this browser only (localStorage), no accounts or sync.
// The helpers are pure and tested; storage sits behind a small wrapper so a private window or blocked
// storage never breaks the app (saving then lasts until the page is closed, and says so).
import { computed, signal } from '@preact/signals';
import { vibeById } from '../../data/vibes/index';
import { formatKey, type Key } from '../../theory/keys';
import type { DegreeSlot } from '../../theory/generator';
import { currentRoll, loadRoll, type Roll } from './jam';

export interface SavedEntry extends Roll {
  id: string;
  /** When it was saved (ms since 1970). */
  savedAt: number;
}

export const STORAGE_KEY = 'gjt.saved.v1';

// ---------- Pure helpers ----------

const sameSlots = (a: readonly DegreeSlot[], b: readonly DegreeSlot[]) =>
  a.length === b.length &&
  a.every((s, i) => s.degree === b[i]!.degree && s.quality === b[i]!.quality && s.bars === b[i]!.bars && (s.bassDegree ?? null) === (b[i]!.bassDegree ?? null));

const sameKey = (a: Key, b: Key) => a.mode === b.mode && a.tonic.letter === b.tonic.letter && a.tonic.acc === b.tonic.acc;

/** The exact same progression: chords, key, tempo and vibe. */
export function sameRoll(a: Roll, b: Roll): boolean {
  return a.vibeId === b.vibeId && a.tempo === b.tempo && sameKey(a.key, b.key) && sameSlots(a.song.verse, b.song.verse) && sameSlots(a.song.chorus, b.song.chorus);
}

/** The automatic label: "Neo-soul · D major · 84 BPM". */
export function savedLabel(r: Roll): string {
  return `${vibeById(r.vibeId)?.name ?? r.vibeId} · ${formatKey(r.key)} · ${r.tempo} BPM`;
}

/** "27 Nov", with the year when it isn't this year ("27 Nov 2025"). */
export function savedDate(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

const isSlot = (x: unknown): x is DegreeSlot => {
  const s = x as DegreeSlot;
  return !!s && typeof s.degree === 'string' && typeof s.quality === 'string' && typeof s.bars === 'number' && s.bars > 0;
};

/** Reads stored entries, dropping anything malformed or from a vibe that no longer exists. */
export function parseSaved(raw: string | null): SavedEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter((e): e is SavedEntry => {
    const x = e as SavedEntry;
    return (
      !!x &&
      typeof x.id === 'string' &&
      typeof x.savedAt === 'number' &&
      !!vibeById(x.vibeId) &&
      typeof x.tempo === 'number' && x.tempo >= 40 && x.tempo <= 240 &&
      !!x.key && (x.key.mode === 'major' || x.key.mode === 'minor') &&
      !!x.key.tonic && /^[A-G]$/.test(x.key.tonic.letter) && typeof x.key.tonic.acc === 'number' &&
      !!x.song && Array.isArray(x.song.verse) && Array.isArray(x.song.chorus) &&
      x.song.verse.length > 0 && x.song.verse.every(isSlot) && x.song.chorus.every(isSlot)
    );
  });
}

// ---------- Storage ----------

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let storage: StorageLike | null = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
let onStorageFailed: () => void = () => {};

/** For tests (a fake storage) and the app (how to tell the user saving won't last). */
export function configureSaved(opts: { storage?: StorageLike | null; onStorageFailed?: () => void }): void {
  if (opts.storage !== undefined) storage = opts.storage;
  if (opts.onStorageFailed) onStorageFailed = opts.onStorageFailed;
  saved.value = read();
}

function read(): SavedEntry[] {
  try {
    return parseSaved(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return [];
  }
}

function write(list: SavedEntry[]): void {
  saved.value = list;
  try {
    if (!storage) throw new Error('no storage');
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    onStorageFailed();
  }
}

// ---------- State and actions ----------

/** Saved progressions, newest first. */
export const saved = signal<SavedEntry[]>(read());

/** The saved entry that matches what's on screen, if any (fills the heart). */
export const currentSaved = computed(() => saved.value.find((e) => sameRoll(e, currentRoll.value)));

let lastId = 0;
const newId = () => `${Date.now().toString(36)}-${(lastId++).toString(36)}`;

/** The heart: saves what's on screen, or removes it if it's already saved. Returns what happened. */
export function toggleSave(now: number = Date.now()): 'saved' | 'removed' {
  const hit = currentSaved.value;
  if (hit) {
    removeSaved(hit.id);
    return 'removed';
  }
  const r = currentRoll.value;
  write([{ id: newId(), savedAt: now, vibeId: r.vibeId, key: r.key, tempo: r.tempo, song: r.song }, ...saved.value]);
  return 'saved';
}

export function removeSaved(id: string): void {
  write(saved.value.filter((e) => e.id !== id));
}

/** Puts a saved progression on the Jam screen (the one there goes on the history). */
export function openSaved(id: string): void {
  const e = saved.value.find((x) => x.id === id);
  if (e) loadRoll(e);
}
