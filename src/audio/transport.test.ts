import { describe, expect, it } from 'vitest';
import { chord } from '../theory/chords';
import { grooveById } from '../data/grooves';
import { createRng } from '../theory/random';
import {
  LOOKAHEAD,
  START_DELAY,
  Transport,
  type AudioEvent,
  type Feel,
  type PlaybackSlot,
  type Sink,
  type Ticker,
} from './transport';

/** A fake audio clock plus a ticker that fires every ~25 ms with optional random jitter. */
class Harness {
  time = 0;
  events: { event: AudioEvent; scheduledAt: number }[] = [];
  silences: number[] = [];
  private cb: (() => void) | null = null;
  private rng = createRng(1);

  readonly clock = { now: () => this.time };
  readonly ticker: Ticker = { start: (cb) => (this.cb = cb), stop: () => (this.cb = null) };
  readonly sink: Sink = {
    schedule: (event) => this.events.push({ event, scheduledAt: this.time }),
    silence: (now) => this.silences.push(now),
  };

  /** Runs the clock forward, ticking every `interval` s ± `jitter` s. */
  run(seconds: number, interval = 0.025, jitter = 0): void {
    const end = this.time + seconds;
    while (this.time < end) {
      this.time += Math.max(0.001, interval + (this.rng() * 2 - 1) * jitter);
      this.cb?.();
    }
  }

  clicks(countIn?: boolean) {
    return this.events.map((e) => e.event).filter((e): e is Extract<AudioEvent, { kind: 'click' }> => e.kind === 'click' && (countIn === undefined || e.countIn === countIn));
  }
  of<K extends AudioEvent['kind']>(kind: K) {
    return this.events.map((e) => e.event).filter((e): e is Extract<AudioEvent, { kind: K }> => e.kind === kind);
  }
}

const slots = (spec: string): PlaybackSlot[] =>
  spec.split(' ').map((t) => {
    const [sym, bars] = t.split(':');
    return { chord: chord(sym!), bars: (bars ? Number(bars) : 1) as PlaybackSlot['bars'] };
  });

const feel = (groove = 'plain', swing = 0): Feel => ({ groove: grooveById(groove), swing, voicing: 'close' });

function setup(progression = 'C F G C', opts: { bpm?: number; countIn?: boolean; groove?: string; swing?: number } = {}) {
  const h = new Harness();
  const t = new Transport(h.clock, h.ticker, h.sink, feel(opts.groove, opts.swing));
  t.setProgression(slots(progression));
  t.setTempo(opts.bpm ?? 120);
  t.setCountIn(opts.countIn ?? false);
  return { h, t };
}

describe('count-in', () => {
  it('plays four clicks, accent on the first, then the loop starts one bar later', () => {
    const { h, t } = setup('C', { bpm: 120, countIn: true });
    t.start();
    expect(t.state).toBe('count-in');
    h.run(3);
    const ci = h.clicks(true);
    expect(ci).toHaveLength(4);
    expect(ci.map((c) => c.accent)).toEqual([true, false, false, false]);
    ci.forEach((c, i) => expect(c.time).toBeCloseTo(START_DELAY + i * 0.5, 9));
    const firstBeat = h.clicks(false)[0]!;
    expect(firstBeat.time).toBeCloseTo(START_DELAY + 2, 9);
    expect(firstBeat.accent).toBe(true);
    expect(t.state).toBe('playing');
  });

  it('marks count-in clicks so they can sound even when the click part is muted', () => {
    const { h, t } = setup('C', { countIn: true });
    t.start();
    h.run(1);
    expect(h.clicks(true).every((c) => c.countIn)).toBe(true);
  });

  it('pressing Play (pause) during the count-in cancels it and returns to stopped', () => {
    const { h, t } = setup('C', { countIn: true });
    t.start();
    h.run(0.6);
    t.pause();
    expect(t.state).toBe('stopped');
    expect(h.silences).toHaveLength(1);
    const before = h.events.length;
    h.run(2);
    expect(h.events.length).toBe(before);
  });

  it('shows count-in beats on the playhead, driven by the audio clock', () => {
    const { h, t } = setup('C', { bpm: 120, countIn: true });
    t.start();
    h.run(0.02);
    expect(t.playheadAt(h.time).phase).toBe('count-in');
    h.run(START_DELAY + 0.55 - h.time); // just after beat 2 sounds
    expect(t.playheadAt(h.time)).toMatchObject({ phase: 'count-in', countInBeat: 2 });
  });
});

describe('timing: loops stay in time', () => {
  for (const bpm of [40, 240]) {
    it(`${bpm} BPM for 10 minutes with a jittery timer: every beat lands exactly on the grid`, () => {
      const { h, t } = setup('Am7:0.5 D7:0.5 Gmaj7:2 Cmaj7', { bpm, groove: 'neo-soul-pocket', swing: 0.35 });
      t.start();
      h.run(600, 0.025, 0.02);
      const beat = 60 / bpm;
      const clicks = h.clicks(false);
      const expected = Math.floor((600 - START_DELAY + LOOKAHEAD) / beat);
      expect(Math.abs(clicks.length - expected)).toBeLessThanOrEqual(1);
      clicks.forEach((c, i) => expect(Math.abs(c.time - (START_DELAY + i * beat))).toBeLessThan(1e-6));
      // Accents every 4th beat: bars never slip.
      clicks.forEach((c, i) => expect(c.accent).toBe(i % 4 === 0));
    });
  }

  it('never schedules an event in the past or beyond the look-ahead window', () => {
    const { h, t } = setup('C F G C', { bpm: 240, groove: 'desert-groove', swing: 0.1 });
    t.start();
    h.run(120, 0.025, 0.015);
    for (const { event, scheduledAt } of h.events) {
      expect(event.time).toBeGreaterThanOrEqual(scheduledAt);
      expect(event.time - scheduledAt).toBeLessThan(LOOKAHEAD + 0.05);
    }
  });

  it('after a long timer stall, skips the missed beats instead of playing a late burst, and stays on the grid', () => {
    const { h, t } = setup('C F', { bpm: 120 });
    t.start();
    h.run(2);
    h.time += 1.3; // main thread blocked for 1.3 s
    h.run(2);
    for (const { event, scheduledAt } of h.events) expect(event.time).toBeGreaterThanOrEqual(scheduledAt - 1e-9);
    for (const c of h.clicks(false)) {
      const n = (c.time - START_DELAY) / 0.5;
      expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-6);
    }
    const times = h.clicks(false).map((c) => c.time);
    expect(new Set(times.map((x) => x.toFixed(6))).size).toBe(times.length); // no duplicates
  });
});

describe('looping and slots', () => {
  it('loops the progression and reports bars and slots on the playhead', () => {
    const { h, t } = setup('C:2 F', { bpm: 120 });
    t.start();
    const seen: string[] = [];
    for (let i = 0; i < 24; i++) {
      h.run(0.25);
      const p = t.playheadAt(h.time);
      const k = `${p.bar}:${p.slotIndex}`;
      if (seen[seen.length - 1] !== k) seen.push(k);
    }
    // 3 bars × 2 s = 6 s of audio: bar 0 & 1 are slot 0, bar 2 is slot 1, then it loops.
    expect(seen.slice(0, 4)).toEqual(['0:0', '1:0', '2:1', '0:0']);
  });

  it('half-bar chords change in the middle of the bar', () => {
    const { h, t } = setup('C:0.5 G:0.5', { bpm: 120 });
    t.start();
    h.run(1.9);
    const chords = h.of('chord');
    expect(chords[0]!.time).toBeCloseTo(START_DELAY, 9);
    expect(chords[1]!.time).toBeCloseTo(START_DELAY + 1, 9); // beat 3 at 120 BPM
    expect(chords[0]!.duration).toBeCloseTo(1, 9); // cut at the change
    expect(chords[0]!.notes).not.toEqual(chords[1]!.notes);
  });

  it('applies swing to off-beat eighths only', () => {
    const { h, t } = setup('C', { bpm: 120, groove: 'shuffle', swing: 1 });
    t.start();
    h.run(1.9);
    const hats = h.events.filter((e) => e.event.kind === 'hat').map((e) => +(e.event.time - START_DELAY).toFixed(6));
    // Beat = 0.5 s: on-beats at 0, 0.5…; swung off-beats at 2/3 of a beat (0.333…), not 0.25.
    expect(hats.slice(0, 4)).toEqual([0, 0.333333, 0.5, 0.833333]);
  });

  it('only approaches the next chord when the change comes straight after', () => {
    const { h, t } = setup('C:2 F', { bpm: 120, groove: 'soul-backbeat' });
    t.start();
    h.run(5.5);
    const bass = h.of('bass');
    // Groove plays an approach on step 14 of every bar. Bar 1 (still C): fifth (G2 = 43). Bar 2 (C → F): E2 (40).
    const step14 = bass.filter((b) => Math.abs(((b.time - START_DELAY) % 2) - 1.75) < 1e-6);
    expect(step14[0]!.note).toBe(43);
    expect(step14[1]!.note).toBe(40);
  });
});

describe('pause, resume and restart', () => {
  it('pause silences immediately and resumes from the start of the bar that was playing', () => {
    const { h, t } = setup('C D E F', { bpm: 120 });
    t.start();
    h.run(5); // in bar 3 (index 2)
    t.pause();
    expect(t.state).toBe('paused');
    expect(h.silences).toEqual([h.time]);
    expect(t.playheadAt(h.time)).toMatchObject({ phase: 'paused', bar: 2, slotIndex: 2 });
    h.events = [];
    t.start();
    h.run(0.2);
    const first = h.of('chord')[0]!;
    expect(first.notes).toEqual(expect.arrayContaining([64])); // E chord (E4 present)
  });

  it('restart while playing jumps to bar 1 at the next downbeat, not mid-bar', () => {
    const { h, t } = setup('C D E F', { bpm: 120 });
    t.start();
    h.run(2.7); // mid bar 2
    t.restart();
    h.run(0.3); // still in bar 2
    expect(t.playheadAt(h.time).bar).toBe(1);
    h.run(1.3); // past the next downbeat
    expect(t.playheadAt(h.time).bar).toBe(0);
  });

  it('stop rewinds to bar 1', () => {
    const { h, t } = setup('C D E F', { bpm: 120 });
    t.start();
    h.run(5);
    t.stop();
    expect(t.playheadAt(h.time)).toMatchObject({ phase: 'stopped', bar: 0 });
  });
});

describe('changes while playing', () => {
  it('tempo changes take effect on the next beat, never mid-beat', () => {
    const { h, t } = setup('C', { bpm: 120 });
    t.start();
    h.run(1.1); // beats at 0.06, 0.56, 1.06 already scheduled
    t.setTempo(60);
    h.run(4);
    const times = h.clicks(false).map((c) => c.time);
    const gaps = times.slice(1).map((x, i) => +(x - times[i]!).toFixed(6));
    const firstSlow = gaps.indexOf(1);
    expect(firstSlow).toBeGreaterThan(0);
    expect(gaps.slice(0, firstSlow).every((g) => g === 0.5)).toBe(true);
    expect(gaps.slice(firstSlow).every((g) => g === 1)).toBe(true);
  });

  it('clamps tempo to 40–240', () => {
    const { t } = setup();
    t.setTempo(10);
    expect(t.tempo).toBe(40);
    t.setTempo(999);
    expect(t.tempo).toBe(240);
  });

  it('an edit to the playing chord is heard from the next bar line', () => {
    const { h, t } = setup('C:2', { bpm: 120, groove: 'soul-backbeat' });
    t.start();
    h.run(0.6); // early in bar 1
    t.setProgression(slots('A:2'));
    h.run(4);
    const chords = h.of('chord');
    const firstA = chords.find((c) => c.notes.includes(61) || c.notes.includes(73))!; // C♯ only in A major
    expect(firstA.time).toBeCloseTo(START_DELAY + 2, 6); // bar 2 downbeat
  });

  it('a re-roll (fromTop) starts the new progression from bar 1 at the next downbeat', () => {
    const { h, t } = setup('C D E F', { bpm: 120 });
    t.start();
    h.run(4.5); // in bar 3
    t.setProgression(slots('G A B C'), { fromTop: true });
    h.run(0.4);
    expect(t.playheadAt(h.time).bar).toBe(2);
    h.run(1.5);
    expect(t.playheadAt(h.time)).toMatchObject({ bar: 0, slotIndex: 0 });
  });

  it('shortening the progression mid-loop wraps the playhead safely', () => {
    const { h, t } = setup('C D E F', { bpm: 120 });
    t.start();
    h.run(7); // bar 4
    t.setProgression(slots('C D'));
    expect(() => h.run(4)).not.toThrow();
    expect(t.playheadAt(h.time).bar).toBeLessThan(2);
  });

  it('removing every chord while playing stops playback', () => {
    const { h, t } = setup('C D', { bpm: 120 });
    t.start();
    h.run(1);
    t.setProgression([]);
    expect(t.state).toBe('stopped');
    expect(t.start()).toBe(false);
  });
});
