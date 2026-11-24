// The one public audio interface for the UI (CLAUDE.md: "keep audio playback behind one small module").
// The UI never touches AudioContext, the scheduler or the instruments directly.
import type { Chord } from '../theory/chords';
import { grooveById } from '../data/grooves';
import { createTicker } from './clock';
import { Transport, type Feel, type PlaybackSlot, type Playhead, type TransportState } from './transport';
import { Voices, type PartLevels } from './voices';
import { voiceChord, type VoicingStyle } from './voicing';

export type EngineState = 'locked-audio' | TransportState;

export type EngineEvent =
  | { type: 'state'; state: EngineState }
  /** The browser refused to start audio after a tap (SPEC.md §10.3). */
  | { type: 'blocked' }
  /** Another app took the audio (call, other media): playback was paused. */
  | { type: 'interrupted' };

export interface FeelSettings {
  groove: string;
  swing: number;
  voicing: VoicingStyle;
}

export const DEFAULT_PARTS: PartLevels = { chords: true, bass: true, click: true, drums: false };

export interface EngineOptions {
  /** For tests and the dev harness: observe every scheduled event with the audio time it was scheduled at. */
  onSchedule?: (event: import('./transport').AudioEvent, now: number) => void;
  /** For the dev harness: tap the master output (e.g. to measure level). */
  onOutput?: (output: AudioNode, ctx: AudioContext) => void;
}

export interface Engine {
  readonly state: EngineState;
  /** Must be called from a user gesture (tap/click). Resolves true once audio is running. */
  unlock(): Promise<boolean>;
  /** Unlocks if needed, then starts (with count-in if on). Resolves false if empty or blocked. */
  play(): Promise<boolean>;
  pause(): void;
  togglePlay(): Promise<boolean>;
  restart(): void;
  setProgression(slots: readonly PlaybackSlot[], opts?: { fromTop?: boolean }): void;
  setTempo(bpm: number): void;
  readonly tempo: number;
  setFeel(feel: FeelSettings): void;
  setParts(parts: PartLevels): void;
  setCountIn(on: boolean): void;
  /** Hear a chord now (chord previews). Unlocks audio if needed. */
  previewChord(chord: Chord): Promise<void>;
  /** Hear one note now (fretboard taps). Unlocks audio if needed. */
  previewNote(midi: number): Promise<void>;
  /** What's audible right now, from the audio clock. Poll from requestAnimationFrame for visuals. */
  playhead(): Playhead & { state: EngineState };
  subscribe(listener: (e: EngineEvent) => void): () => void;
  dispose(): void;
}

type ContextFactory = () => AudioContext;

export function createEngine(options: EngineOptions = {}, makeContext: ContextFactory = () => new AudioContext({ latencyHint: 'interactive' })): Engine {
  let ctx: AudioContext | null = null;
  let voices: Voices | null = null;
  let transport: Transport | null = null;
  const listeners = new Set<(e: EngineEvent) => void>();
  const emit = (e: EngineEvent) => listeners.forEach((l) => l(e));

  // Settings that may arrive before audio is unlocked; applied when the transport is created.
  let slots: readonly PlaybackSlot[] = [];
  let tempo = 90;
  let feel: FeelSettings = { groove: 'plain', swing: 0, voicing: 'close' };
  let parts: PartLevels = { ...DEFAULT_PARTS };
  let countIn = true;
  let lastState: EngineState = 'locked-audio';

  const toFeel = (f: FeelSettings): Feel => ({ groove: grooveById(f.groove), swing: f.swing, voicing: f.voicing });
  const setState = (s: EngineState) => {
    if (s === lastState) return;
    lastState = s;
    emit({ type: 'state', state: s });
  };

  function build(): void {
    ctx = makeContext();
    voices = new Voices(ctx);
    voices.setParts(parts);
    options.onOutput?.(voices.output, ctx);
    const c = ctx;
    const sink = options.onSchedule
      ? { schedule: (e: import('./transport').AudioEvent) => (options.onSchedule!(e, c.currentTime), voices!.schedule(e)), silence: (t: number) => voices!.silence(t) }
      : voices;
    transport = new Transport({ now: () => c.currentTime }, createTicker(), sink, toFeel(feel));
    transport.setTempo(tempo);
    transport.setCountIn(countIn);
    transport.setProgression(slots);
    transport.onStateChange((s) => setState(s));
    setState(transport.state);

    // Phone calls and other apps can suspend or interrupt the context (iOS reports "interrupted").
    c.onstatechange = () => {
      const s = c.state as AudioContextState | 'interrupted';
      if (s !== 'running' && transport?.isActive) {
        transport.pause();
        emit({ type: 'interrupted' });
      }
    };
  }

  async function unlock(): Promise<boolean> {
    if (!ctx) build();
    if (ctx!.state !== 'running') {
      try {
        await ctx!.resume();
      } catch {
        /* reported below */
      }
    }
    if (ctx!.state !== 'running') {
      emit({ type: 'blocked' });
      return false;
    }
    return true;
  }

  const engine: Engine = {
    get state() {
      return lastState;
    },
    get tempo() {
      return transport?.tempo ?? tempo;
    },
    unlock,
    async play() {
      if (slots.length === 0) return false;
      // Start the transport in the same task as the gesture where possible; resume() may resolve later.
      if (!(await unlock())) return false;
      return transport!.start();
    },
    pause() {
      transport?.pause();
    },
    async togglePlay() {
      if (transport?.isActive) {
        transport.pause();
        return false;
      }
      return engine.play();
    },
    restart() {
      transport?.restart();
    },
    setProgression(next, opts) {
      slots = next;
      transport?.setProgression(next, opts);
    },
    setTempo(bpm) {
      tempo = bpm;
      transport?.setTempo(bpm);
    },
    setFeel(f) {
      feel = f;
      transport?.setFeel(toFeel(f));
    },
    setParts(p) {
      parts = { ...p };
      voices?.setParts(parts);
    },
    setCountIn(on) {
      countIn = on;
      transport?.setCountIn(on);
    },
    async previewChord(chord) {
      if (!(await unlock())) return;
      voices!.previewChord(voiceChord(chord, feel.voicing));
    },
    async previewNote(midi) {
      if (!(await unlock())) return;
      voices!.previewNote(midi);
    },
    playhead() {
      if (!ctx || !transport) return { state: lastState, phase: 'stopped', countInBeat: null, bar: 0, beat: 0, slotIndex: slots.length ? 0 : null };
      // What's audible lags what's scheduled by the output latency; visuals follow the audible time.
      const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
      return { state: lastState, ...transport.playheadAt(ctx.currentTime - latency) };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      transport?.stop();
      void ctx?.close();
      listeners.clear();
    },
  };
  return engine;
}
