import { beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../../theory/random';
import * as jam from './jam';
import * as saved from './saved';

class FakeStorage {
  data = new Map<string, string>();
  fail = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.fail) throw new Error('quota');
    this.data.set(k, v);
  }
}

let store: FakeStorage;
let failures = 0;

beforeEach(() => {
  const rng = createRng(3);
  let s = 500;
  jam.configureJam({ sink: { setProgression() {}, setTempo() {}, setFeel() {} }, random: rng, seed: () => s++, announce: () => {} });
  jam.resetJam();
  jam.initJam();
  store = new FakeStorage();
  failures = 0;
  saved.configureSaved({ storage: store, onStorageFailed: () => failures++ });
});

describe('saving progressions', () => {
  it('the heart saves what is on screen, fills, and empties again on a second tap', () => {
    expect(saved.currentSaved.value).toBeUndefined();
    expect(saved.toggleSave(Date.UTC(2026, 10, 27))).toBe('saved');
    expect(saved.currentSaved.value).toMatchObject({ vibeId: jam.vibeId.value, tempo: jam.tempo.value });
    expect(saved.saved.value).toHaveLength(1);
    expect(saved.toggleSave()).toBe('removed');
    expect(saved.currentSaved.value).toBeUndefined();
    expect(saved.saved.value).toHaveLength(0);
  });

  it('stores everything, newest first, and survives a reload', () => {
    saved.toggleSave(1);
    const first = jam.currentRoll.value;
    jam.reroll();
    saved.toggleSave(2);
    expect(saved.saved.value.map((e) => e.savedAt)).toEqual([2, 1]);
    // A fresh read from storage (a reload).
    saved.configureSaved({ storage: store });
    expect(saved.saved.value).toHaveLength(2);
    expect(saved.sameRoll(saved.saved.value[1]!, first)).toBe(true);
  });

  it('only the exact progression fills the heart: a tempo change empties it', () => {
    saved.toggleSave();
    jam.setTempo(jam.tempo.value + 1);
    expect(saved.currentSaved.value).toBeUndefined();
    jam.setTempo(jam.tempo.value - 1);
    expect(saved.currentSaved.value).toBeDefined();
  });

  it('opening a saved progression restores it exactly and puts the current one on the history', () => {
    saved.toggleSave();
    const kept = saved.saved.value[0]!;
    jam.reroll();
    const before = jam.currentRoll.value;
    const h = jam.history.value.length;
    saved.openSaved(kept.id);
    expect(saved.sameRoll(jam.currentRoll.value, kept)).toBe(true);
    expect(jam.history.value).toHaveLength(h + 1);
    expect(jam.back()).toBe(true);
    expect(saved.sameRoll(jam.currentRoll.value, before)).toBe(true);
  });

  it('deletes by id', () => {
    saved.toggleSave();
    jam.reroll();
    saved.toggleSave();
    const [a, b] = saved.saved.value;
    saved.removeSaved(a!.id);
    expect(saved.saved.value.map((e) => e.id)).toEqual([b!.id]);
  });

  it('keeps working for the session when storage fails, and says so', () => {
    store.fail = true;
    expect(saved.toggleSave()).toBe('saved');
    expect(saved.saved.value).toHaveLength(1);
    expect(failures).toBe(1);
    saved.configureSaved({ storage: null });
    expect(saved.saved.value).toEqual([]);
  });
});

describe('saved data', () => {
  it('drops malformed entries and unknown vibes when reading', () => {
    saved.toggleSave(5);
    const good = JSON.parse(store.getItem(saved.STORAGE_KEY)!)[0];
    const raw = JSON.stringify([good, { ...good, id: 'x', vibeId: 'polka' }, { ...good, id: 'y', tempo: 999 }, { id: 'z' }, null, 'junk']);
    expect(saved.parseSaved(raw).map((e) => e.id)).toEqual([good.id]);
    expect(saved.parseSaved('not json')).toEqual([]);
    expect(saved.parseSaved('{"a":1}')).toEqual([]);
    expect(saved.parseSaved(null)).toEqual([]);
  });

  it('labels an entry by vibe, key and tempo, and dates it', () => {
    expect(saved.savedLabel(jam.currentRoll.value)).toBe(`Neo-soul · D major · ${jam.tempo.value} BPM`);
    const now = new Date(2026, 10, 27).getTime();
    expect(saved.savedDate(new Date(2026, 10, 27).getTime(), now)).toBe('27 Nov');
    expect(saved.savedDate(new Date(2025, 0, 3).getTime(), now)).toBe('3 Jan 2025');
  });

  it('chord names for the list follow the saved key', () => {
    const names = jam.rollChordNames(jam.currentRoll.value);
    expect(names.verse).toHaveLength(jam.song.value.verse.length);
    expect(names.verse[0]).toMatch(/^[A-G]/);
  });
});
