import { beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../../theory/random';
import { pc } from '../../theory/notes';
import { KEY_TONICS } from '../../theory/keys';
import type { PlaybackSlot } from '../../audio/transport';
import * as jam from './jam';

const calls: { progression: { slots: readonly PlaybackSlot[]; fromTop?: boolean }[]; tempo: number[] } = { progression: [], tempo: [] };
const announced: string[] = [];

beforeEach(() => {
  calls.progression = [];
  calls.tempo = [];
  announced.length = 0;
  const rng = createRng(7);
  let s = 100;
  jam.configureJam({
    sink: {
      setProgression: (slots, opts) => calls.progression.push({ slots, fromTop: opts?.fromTop }),
      setTempo: (t) => calls.tempo.push(t),
      setFeel: () => {},
    },
    random: rng,
    seed: () => s++,
    announce: (t) => announced.push(t),
  });
  jam.resetJam();
  jam.initJam();
});

const bars = () => jam.slots.value.reduce((a, s) => a + s.bars, 0);

describe('first load', () => {
  it('is Neo-soul in D major, 4 bars, at the vibe tempo, and sent to the engine', () => {
    expect(jam.vibe.value.id).toBe('neo-soul');
    expect(jam.key.value.mode).toBe('major');
    expect(bars()).toBe(4);
    expect(jam.tempo.value).toBe(jam.vibe.value.playback.tempo.default);
    expect(calls.progression.at(-1)!.fromTop).toBe(true);
    expect(announced.at(-1)).toMatch(/^New progression in D major at \d+ BPM\. Verse: .+\. Chorus: .+\.$/);
  });

  it('only uses the simple chord set', () => {
    for (let i = 0; i < 20; i++) {
      jam.reroll();
      for (const c of jam.chords.value) expect(['major', 'minor', 'dim', 'sus']).toContain(c.kind);
    }
  });
});

describe('re-roll and back', () => {
  it('changes key and tempo (within the vibe range) unless held', () => {
    const range = jam.vibe.value.playback.tempo;
    const keys = new Set<string>();
    for (let i = 0; i < 12; i++) {
      jam.reroll();
      keys.add(`${pc(jam.key.value.tonic)} ${jam.key.value.mode}`);
      expect(jam.tempo.value).toBeGreaterThanOrEqual(range.min);
      expect(jam.tempo.value).toBeLessThanOrEqual(range.max);
      expect(KEY_TONICS[jam.key.value.mode].some((t) => pc(t) === pc(jam.key.value.tonic))).toBe(true);
    }
    expect(keys.size).toBeGreaterThan(3);

    jam.keyHeld.value = true;
    jam.tempoHeld.value = true;
    const k = jam.key.value;
    const t = jam.tempo.value;
    for (let i = 0; i < 5; i++) jam.reroll();
    expect(jam.key.value).toBe(k);
    expect(jam.tempo.value).toBe(t);
  });

  it('back restores the previous roll exactly, and history caps at 20', () => {
    jam.reroll();
    const before = { key: jam.key.value, tempo: jam.tempo.value, slots: jam.slots.value };
    jam.reroll();
    expect(jam.back()).toBe(true);
    expect(jam.key.value).toBe(before.key);
    expect(jam.tempo.value).toBe(before.tempo);
    expect(jam.slots.value).toBe(before.slots);
    for (let i = 0; i < 30; i++) jam.reroll();
    expect(jam.history.value).toHaveLength(jam.HISTORY_LIMIT);
  });

  it('back at the oldest roll does nothing', () => {
    expect(jam.canGoBack.value).toBe(false);
    expect(jam.back()).toBe(false);
  });
});

describe('vibe, length and key', () => {
  it('choosing a vibe keeps the key and moves tempo to its default unless held', () => {
    const k = jam.key.value;
    jam.chooseVibe('dreamy');
    expect(jam.vibe.value.id).toBe('dreamy');
    expect(jam.key.value).toBe(k);
    expect(jam.tempo.value).toBe(jam.vibe.value.playback.tempo.default);
    jam.tempoHeld.value = true;
    jam.setTempo(130);
    jam.chooseVibe('blues');
    expect(jam.tempo.value).toBe(130);
  });

  it('length: 4 and 8, Blues also 12; leaving Blues at 12 drops to 8; re-roll keeps it', () => {
    jam.chooseLength(8);
    expect(bars()).toBe(8);
    jam.reroll();
    expect(bars()).toBe(8);
    jam.chooseLength(12); // not offered by Neo-soul
    expect(bars()).toBe(8);
    jam.chooseVibe('blues');
    jam.chooseLength(12);
    expect(bars()).toBe(12);
    jam.chooseVibe('heartland');
    expect(jam.lengthBars.value).toBe(8);
    expect(bars()).toBe(8);
  });

  it('a tonic change transposes without re-rolling or a new history entry, and keeps the loop position', () => {
    const slots = jam.slots.value;
    const h = jam.history.value.length;
    const before = jam.chords.value.map((c) => pc(c.chord.root));
    jam.chooseTonic(KEY_TONICS.major.find((t) => t.letter === 'E' && t.acc === 0)!);
    expect(jam.slots.value).toBe(slots);
    expect(jam.history.value.length).toBe(h);
    expect(jam.chords.value.map((c) => pc(c.chord.root))).toEqual(before.map((p) => (p + 2) % 12));
    expect(calls.progression.at(-1)!.fromTop).toBe(false);
  });

  it('a mode change makes a new progression in the same tonic, and Back returns to the old one', () => {
    const old = jam.slots.value;
    jam.chooseMode('minor');
    expect(jam.key.value.mode).toBe('minor');
    expect(pc(jam.key.value.tonic)).toBe(2); // D
    expect(jam.slots.value).not.toBe(old);
    jam.back();
    expect(jam.slots.value).toBe(old);
    expect(jam.key.value.mode).toBe('major');
  });

  it('tempo clamps to 40–240', () => {
    jam.setTempo(300);
    expect(jam.tempo.value).toBe(240);
    jam.setTempo(10);
    expect(jam.tempo.value).toBe(40);
  });
});

describe('verse and chorus', () => {
  const degrees = (xs: { degree: string; bars: number }[]) => xs.map((x) => `${x.degree}:${x.bars}`).join(' ');

  it('every roll is a verse and a different chorus of the same length', () => {
    for (let i = 0; i < 10; i++) {
      jam.reroll();
      const { verse, chorus } = jam.song.value;
      expect(degrees(chorus)).not.toBe(degrees(verse));
      expect(chorus.reduce((a, x) => a + x.bars, 0)).toBe(verse.reduce((a, x) => a + x.bars, 0));
    }
  });

  it('loops the chosen section; switching jumps to its top (at the next bar line)', () => {
    expect(jam.section.value).toBe('verse');
    expect(jam.playList.value.every((it) => it.section === 'verse')).toBe(true);
    jam.chooseSection('chorus');
    expect(jam.slots.value).toBe(jam.song.value.chorus);
    expect(jam.playList.value.every((it) => it.section === 'chorus')).toBe(true);
    expect(calls.progression.at(-1)!.fromTop).toBe(true);
    expect(calls.progression.at(-1)!.slots).toHaveLength(jam.song.value.chorus.length);
  });

  it('song form plays verse ×2 then chorus ×2, starting from the chosen section', () => {
    jam.setForm(true);
    const n = jam.song.value.verse.length;
    const m = jam.song.value.chorus.length;
    const list = jam.playList.value;
    expect(list).toHaveLength(2 * n + 2 * m);
    expect(list.slice(0, 2 * n).every((it) => it.section === 'verse')).toBe(true);
    expect(list.slice(2 * n).every((it) => it.section === 'chorus')).toBe(true);
    expect(jam.itemAt(n)).toEqual({ section: 'verse', index: 0, bars: jam.song.value.verse[0]!.bars });
    expect(calls.progression.at(-1)!.slots).toHaveLength(list.length);
    jam.chooseSection('chorus');
    expect(jam.playList.value[0]!.section).toBe('chorus');
  });

  it('re-roll, transpose and back keep both sections together', () => {
    jam.chooseSection('chorus');
    jam.reroll();
    const before = jam.song.value;
    jam.reroll();
    expect(jam.song.value).not.toBe(before);
    jam.back();
    expect(jam.song.value).toBe(before);
    expect(jam.section.value).toBe('chorus');
    const roots = jam.songChords.value.chorus.map((c) => pc(c.chord.root));
    const t = KEY_TONICS[jam.key.value.mode].find((x) => pc(x) === (pc(jam.key.value.tonic) + 1) % 12)!;
    jam.chooseTonic(t);
    expect(jam.songChords.value.chorus.map((c) => pc(c.chord.root))).toEqual(roots.map((r) => (r + 1) % 12));
  });
});
