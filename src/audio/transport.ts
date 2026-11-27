// The transport: a look-ahead scheduler that turns a progression into timed audio events.
// It never touches Web Audio directly: time comes from a Clock, wake-ups from a Ticker and sounds go
// to a Sink. That keeps the timing logic testable with a fake clock (see transport.test.ts).
//
// Timing model: a grid of 16th-note steps. Each step's time is the previous step's time plus one step
// length, and events are scheduled up to LOOKAHEAD seconds ahead on the audio clock, so a slow or
// jittery timer can't make playback drift (the "two clocks" pattern).
import type { Chord } from '../theory/chords';
import type { Bars } from '../theory/progression';
import type { Groove, Hit } from '../data/grooves';
import { bassMidi, voiceChord, type VoicingStyle } from './voicing';

export interface PlaybackSlot {
  chord: Chord;
  bars: Bars;
}

export interface Feel {
  groove: Groove;
  /** 0 = straight, 1 = full triplet swing on off-beat 8ths. */
  swing: number;
  voicing: VoicingStyle;
}

export type AudioEvent =
  | { kind: 'chord'; time: number; duration: number; notes: number[]; vel: number }
  | { kind: 'bass'; time: number; duration: number; note: number; vel: number }
  | { kind: 'click'; time: number; accent: boolean; countIn: boolean }
  | { kind: 'kick' | 'snare' | 'hat'; time: number; vel: number };

export interface Sink {
  schedule(event: AudioEvent): void;
  /** Cut everything sounding or scheduled from `now` on, with a short fade. */
  silence(now: number): void;
}

export interface Clock {
  now(): number;
}

export interface Ticker {
  start(callback: () => void): void;
  stop(): void;
}

export type TransportState = 'stopped' | 'count-in' | 'playing' | 'paused';

/** What the listener is hearing at a given moment (for visuals, which must never lead the sound). */
export interface Playhead {
  phase: TransportState;
  /** 1–4 during the count-in. */
  countInBeat: number | null;
  /** Bar within the progression (0-based). */
  bar: number;
  /** Beat within the bar, 0–3. */
  beat: number;
  slotIndex: number | null;
  /** How far through the current beat, 0–1, from the audio clock (for smooth visuals). */
  beatFraction: number;
}

interface Mark {
  time: number;
  phase: 'count-in' | 'playing';
  countInBeat: number | null;
  bar: number;
  beat: number;
  slotIndex: number | null;
  /** Length of this beat in seconds. */
  dur: number;
}

export const STEPS_PER_BAR = 16;
/** How far ahead events are scheduled. Longer survives timer stalls; shorter responds faster to edits. */
export const LOOKAHEAD = 0.15;
/** Gap between pressing Play and the first sound, so the first events aren't scheduled late. */
export const START_DELAY = 0.06;
/** If the timer falls this far behind, skip the missed steps instead of playing a burst of late notes. */
export const RESYNC_AFTER = 0.05;
export const TEMPO_RANGE = { min: 40, max: 240 } as const;

export function clampTempo(bpm: number): number {
  return Math.min(TEMPO_RANGE.max, Math.max(TEMPO_RANGE.min, Math.round(bpm)));
}

export class Transport {
  private slots: PlaybackSlot[] = [];
  private slotStarts: number[] = [];
  private totalSteps = 0;
  private bpm = 90;
  private pendingBpm: number | null = null;
  private feel: Feel;
  private countInOn = true;
  private _state: TransportState = 'stopped';
  private listeners = new Set<(s: TransportState) => void>();

  private nextTime = 0;
  /** Step position within the progression while playing. */
  private pos = 0;
  /** Step within the count-in bar, or -1. */
  private countStep = -1;
  private resumeBar = 0;
  private jumpToTop = false;
  private marks: Mark[] = [];

  /** The chord captured at the last bar line or slot start: edits to the playing slot wait for the next one. */
  private held: { slotIndex: number; chord: Chord } | null = null;
  private voiced: { chord: Chord; notes: number[] } | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly ticker: Ticker,
    private readonly sink: Sink,
    feel: Feel,
  ) {
    this.feel = feel;
  }

  // ---------- Public API ----------

  get state(): TransportState {
    return this._state;
  }

  get tempo(): number {
    return this.pendingBpm ?? this.bpm;
  }

  get isActive(): boolean {
    return this._state === 'count-in' || this._state === 'playing';
  }

  get hasProgression(): boolean {
    return this.totalSteps > 0;
  }

  onStateChange(listener: (s: TransportState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts (or resumes) playback. Returns false when there's nothing to play. */
  start(): boolean {
    if (this.isActive) return true;
    if (this.totalSteps === 0) return false;
    const bars = this.totalSteps / STEPS_PER_BAR;
    this.pos = (this.resumeBar < bars ? this.resumeBar : 0) * STEPS_PER_BAR;
    this.nextTime = this.clock.now() + START_DELAY;
    this.marks = [];
    this.held = null;
    this.jumpToTop = false;
    if (this.pendingBpm !== null) {
      this.bpm = this.pendingBpm;
      this.pendingBpm = null;
    }
    if (this.countInOn) {
      this.countStep = 0;
      this.setState('count-in');
    } else {
      this.countStep = -1;
      this.setState('playing');
    }
    this.ticker.start(() => this.tick());
    this.tick();
    return true;
  }

  /**
   * Pauses, remembering the bar being heard so Play resumes from its start.
   * During the count-in this cancels and returns to stopped instead (SPEC.md §4.3).
   */
  pause(): void {
    if (!this.isActive) return;
    const now = this.clock.now();
    if (this._state === 'playing') this.resumeBar = this.playheadAt(now).bar;
    this.halt(now, this._state === 'count-in' ? 'stopped' : 'paused');
  }

  /** Stops and rewinds to bar 1. */
  stop(): void {
    this.resumeBar = 0;
    if (this.isActive) this.halt(this.clock.now(), 'stopped');
    else this.setState('stopped');
  }

  /**
   * Cues playback to start at `bar` (a chord the user picked). Only while not playing: the UI pauses
   * first. Out-of-range bars wrap to bar 1.
   */
  seek(bar: number): void {
    if (this.isActive) return;
    const bars = this.totalSteps / STEPS_PER_BAR;
    this.resumeBar = bar >= 0 && bar < bars ? Math.floor(bar) : 0;
  }

  /** Back to bar 1: at the next downbeat if playing, immediately otherwise. */
  restart(): void {
    if (this._state === 'playing') this.jumpToTop = true;
    else if (this._state === 'count-in') this.pos = 0;
    else this.resumeBar = 0;
  }

  /**
   * Replaces the progression. With fromTop (re-roll, history), playback moves to bar 1 at the next
   * downbeat. Otherwise the playhead keeps its place; edits take effect when the playhead reaches them.
   */
  setProgression(slots: readonly PlaybackSlot[], opts: { fromTop?: boolean } = {}): void {
    this.slots = [...slots];
    this.slotStarts = [];
    let t = 0;
    for (const s of this.slots) {
      this.slotStarts.push(t);
      t += Math.round(s.bars * STEPS_PER_BAR);
    }
    this.totalSteps = t;
    const bars = t / STEPS_PER_BAR;

    if (t === 0) {
      this.stop();
      return;
    }
    if (this.isActive) {
      if (opts.fromTop) {
        if (this._state === 'count-in') this.pos = 0;
        else this.jumpToTop = true;
      } else {
        this.pos %= t;
      }
    } else if (opts.fromTop || this.resumeBar >= bars) {
      this.resumeBar = 0;
    }
  }

  /** Applies at the next beat while playing (never mid-beat). */
  setTempo(bpm: number): void {
    const v = clampTempo(bpm);
    if (this.isActive) this.pendingBpm = v;
    else {
      this.bpm = v;
      this.pendingBpm = null;
    }
  }

  setFeel(feel: Feel): void {
    this.feel = feel;
    this.voiced = null;
  }

  setCountIn(on: boolean): void {
    this.countInOn = on;
  }

  /** What is audible at `time` (pass the audio clock minus output latency). */
  playheadAt(time: number): Playhead {
    if (!this.isActive) {
      const bar = this.resumeBar;
      return { phase: this._state, countInBeat: null, bar, beat: 0, slotIndex: this.slotAtStep(bar * STEPS_PER_BAR), beatFraction: 0 };
    }
    let mark: Mark | undefined;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      if (this.marks[i]!.time <= time + 1e-9) {
        mark = this.marks[i];
        break;
      }
    }
    if (!mark) {
      // Between pressing Play and the first sound.
      const first = this.marks[0];
      const phase = first?.phase ?? (this._state === 'count-in' ? 'count-in' : 'playing');
      const bar = Math.floor(this.pos / STEPS_PER_BAR);
      return { phase, countInBeat: null, bar: first?.bar ?? bar, beat: 0, slotIndex: first?.slotIndex ?? this.slotAtStep(this.pos), beatFraction: 0 };
    }
    const beatFraction = Math.min(1, Math.max(0, (time - mark.time) / mark.dur));
    return { phase: mark.phase, countInBeat: mark.countInBeat, bar: mark.bar, beat: mark.beat, slotIndex: mark.slotIndex, beatFraction };
  }

  // ---------- Scheduling ----------

  private get stepDur(): number {
    return 60 / this.bpm / 4;
  }

  /** Called by the ticker (every ~25 ms). Schedules everything that falls inside the look-ahead window. */
  tick(): void {
    if (!this.isActive) return;
    const now = this.clock.now();
    if (this.nextTime < now - RESYNC_AFTER) {
      // The timer stalled (busy main thread, background tab): skip the missed steps silently,
      // staying on the grid, rather than firing a burst of late notes.
      while (this.nextTime < now && this.isActive) {
        this.applyPendingTempo();
        this.advance();
      }
    }
    while (this.isActive && this.nextTime < now + LOOKAHEAD) {
      this.applyPendingTempo();
      this.scheduleStep(this.nextTime);
      this.advance();
    }
    const cutoff = now - 2;
    if (this.marks.length > 256 || (this.marks[0] && this.marks[0].time < cutoff)) {
      this.marks = this.marks.filter((m) => m.time >= cutoff).slice(-256);
    }
  }

  private applyPendingTempo(): void {
    if (this.pendingBpm === null) return;
    const step = this.countStep >= 0 ? this.countStep : this.pos;
    if (step % 4 === 0) {
      this.bpm = this.pendingBpm;
      this.pendingBpm = null;
    }
  }

  private advance(): void {
    this.nextTime += this.stepDur;
    if (this.countStep >= 0) {
      this.countStep++;
      if (this.countStep >= STEPS_PER_BAR) {
        this.countStep = -1;
        this.setState('playing');
      }
      return;
    }
    this.pos++;
    if (this.pos >= this.totalSteps) this.pos = 0;
    if (this.jumpToTop && this.pos % STEPS_PER_BAR === 0) {
      this.pos = 0;
      this.jumpToTop = false;
    }
  }

  private swingOffset(stepInBar: number): number {
    const beat = this.stepDur * 4;
    if (stepInBar % 4 === 2) return (this.feel.swing * beat) / 6;
    if (stepInBar % 2 === 1) return (this.feel.swing * beat) / 12;
    return 0;
  }

  private scheduleStep(t: number): void {
    if (this.countStep >= 0) {
      if (this.countStep % 4 === 0) {
        const beat = this.countStep / 4;
        this.sink.schedule({ kind: 'click', time: t, accent: beat === 0, countIn: true });
        this.marks.push({ time: t, phase: 'count-in', countInBeat: beat + 1, bar: Math.floor(this.pos / STEPS_PER_BAR), beat, slotIndex: this.slotAtStep(this.pos), dur: this.stepDur * 4 });
      }
      return;
    }

    const p = this.pos;
    const stepInBar = p % STEPS_PER_BAR;
    const slotIndex = this.slotAtStep(p)!;
    const slotStart = this.slotStarts[slotIndex]!;
    const slotEnd = slotStart + Math.round(this.slots[slotIndex]!.bars * STEPS_PER_BAR);
    const time = t + this.swingOffset(stepInBar);
    const g = this.feel.groove;
    const sd = this.stepDur;

    if (stepInBar % 4 === 0) {
      const beat = stepInBar / 4;
      this.marks.push({ time: t, phase: 'playing', countInBeat: null, bar: Math.floor(p / STEPS_PER_BAR), beat, slotIndex, dur: this.stepDur * 4 });
      this.sink.schedule({ kind: 'click', time: t, accent: beat === 0, countIn: false });
    }

    if (g.kick.includes(stepInBar)) this.sink.schedule({ kind: 'kick', time, vel: 0.9 });
    if (g.snare.includes(stepInBar)) this.sink.schedule({ kind: 'snare', time, vel: 0.75 });
    if (g.hat.includes(stepInBar)) this.sink.schedule({ kind: 'hat', time, vel: stepInBar % 4 === 0 ? 0.6 : 0.4 });

    // Capture the chord at bar lines and slot starts only.
    if (stepInBar === 0 || p === slotStart || !this.held || this.held.slotIndex !== slotIndex) {
      this.held = { slotIndex, chord: this.slots[slotIndex]!.chord };
    }
    const chord = this.held.chord;
    const isSlotStart = p === slotStart;

    const comp = g.comp.find((x) => x.step === stepInBar);
    if (comp || isSlotStart) {
      const len = comp ? comp.len : this.stepsToNextHit(g.comp, stepInBar);
      const steps = Math.min(len, slotEnd - p);
      this.sink.schedule({ kind: 'chord', time, duration: steps * sd, notes: this.notesFor(chord), vel: comp?.vel ?? 0.7 });
    }

    const bass = g.bass.find((x) => x.step === stepInBar);
    if (bass || isSlotStart) {
      const len = bass ? bass.len : this.stepsToNextHit(g.bass, stepInBar);
      const steps = Math.min(len, slotEnd - p);
      const next = this.slots[(slotIndex + 1) % this.slots.length]!.chord;
      // Only approach the next chord if the change actually comes right after this note.
      const kind = bass && bass.note === 'approach' && p + steps !== slotEnd ? 'fifth' : (bass?.note ?? 'root');
      this.sink.schedule({ kind: 'bass', time, duration: steps * sd, note: bassMidi(chord, kind, next), vel: bass?.vel ?? 0.8 });
    }
  }

  private stepsToNextHit(hits: readonly Hit[], stepInBar: number): number {
    const next = hits.map((h) => h.step).filter((s) => s > stepInBar).sort((a, b) => a - b)[0];
    return (next ?? STEPS_PER_BAR) - stepInBar;
  }

  private notesFor(chord: Chord): number[] {
    if (this.voiced?.chord === chord) return this.voiced.notes;
    const notes = voiceChord(chord, this.feel.voicing, this.voiced?.notes);
    this.voiced = { chord, notes };
    return notes;
  }

  private slotAtStep(step: number): number | null {
    if (this.totalSteps === 0) return null;
    const p = ((step % this.totalSteps) + this.totalSteps) % this.totalSteps;
    for (let i = this.slotStarts.length - 1; i >= 0; i--) if (this.slotStarts[i]! <= p) return i;
    return 0;
  }

  private halt(now: number, to: TransportState): void {
    this.ticker.stop();
    this.sink.silence(now);
    this.countStep = -1;
    this.jumpToTop = false;
    this.marks = this.marks.filter((m) => m.time <= now);
    if (this.pendingBpm !== null) {
      this.bpm = this.pendingBpm;
      this.pendingBpm = null;
    }
    this.setState(to);
  }

  private setState(s: TransportState): void {
    if (s === this._state) return;
    this._state = s;
    for (const l of this.listeners) l(s);
  }
}
