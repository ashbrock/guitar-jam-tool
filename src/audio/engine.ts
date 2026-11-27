// The one public audio interface for the UI (CLAUDE.md: "keep audio playback behind one small module").
// The UI never touches AudioContext, the scheduler or the instruments directly.
import type { Chord } from '../theory/chords';
import { grooveById } from '../data/grooves';
import { createTicker } from './clock';
import { Transport, type Feel, type PlaybackSlot, type Playhead, type TransportState } from './transport';
import { Voices, type PartLevels, type SampledPart } from './voices';
import { Sampler, type InstrumentMap, type LoadStatus } from './sampler';
import wurlitzer from '../data/instruments/wurlitzer-ep200.json';
import swagbass from '../data/instruments/swagbass.json';
import virtuosityKit from '../data/instruments/virtuosity-kit.json';

/** The sampled instruments, in load order: chords first, as they're heard most. */
const INSTRUMENTS: { part: SampledPart; map: InstrumentMap; dir: string }[] = [
  { part: 'chords', map: wurlitzer as InstrumentMap, dir: 'wurlitzer-ep200' },
  { part: 'bass', map: swagbass as InstrumentMap, dir: 'swagbass' },
  { part: 'drums', map: virtuosityKit as InstrumentMap, dir: 'virtuosity-kit' },
];
import { voiceChord, type VoicingStyle } from './voicing';

export type EngineState = 'locked-audio' | TransportState;

export type EngineEvent =
  | { type: 'state'; state: EngineState }
  /** The browser refused to start audio after a tap (SPEC.md §10.3). */
  | { type: 'blocked' }
  /** Another app took the audio (call, other media): playback was paused. */
  | { type: 'interrupted' }
  /**
   * Loading of the sampled instruments, as one combined status. Until each is ready, a synth plays its
   * part. 'failed' means at least one didn't load (`failed` names them); the others still play.
   */
  | { type: 'instrument'; status: LoadStatus; progress: number; failed: string[] };

export interface FeelSettings {
  groove: string;
  swing: number;
  voicing: VoicingStyle;
}

export const DEFAULT_PARTS: PartLevels = { chords: true, bass: true, click: true, drums: true };

export interface EngineOptions {
  /** For tests and the dev harness: observe every scheduled event with the audio time it was scheduled at. */
  onSchedule?: (event: import('./transport').AudioEvent, now: number) => void;
  /** For the dev harness: tap the master output (e.g. to measure level). */
  onOutput?: (output: AudioNode, ctx: AudioContext) => void;
}

export interface Engine {
  readonly state: EngineState;
  /** Combined loading status of the sampled instruments. */
  readonly instrumentStatus: LoadStatus;
  /** Must be called from a user gesture (tap/click). Resolves true once audio is running. */
  unlock(): Promise<boolean>;
  /** Unlocks if needed, then starts (with count-in if on). Resolves false if empty or blocked. */
  play(): Promise<boolean>;
  pause(): void;
  togglePlay(): Promise<boolean>;
  restart(): void;
  /** Cues playback to start at this bar (a chord the user picked). Ignored while playing. */
  seek(bar: number): void;
  setProgression(slots: readonly PlaybackSlot[], opts?: { fromTop?: boolean }): void;
  setTempo(bpm: number): void;
  readonly tempo: number;
  setFeel(feel: FeelSettings): void;
  setParts(parts: PartLevels): void;
  setCountIn(on: boolean): void;
  /** Silence all sound while the loop (and the song map) carry on in time. */
  setMuted(muted: boolean): void;
  /** Hear a chord now (chord previews). Unlocks audio if needed. */
  previewChord(chord: Chord): Promise<void>;
  /** Hear one note now (fretboard taps). Unlocks audio if needed. */
  previewNote(midi: number): Promise<void>;
  /** What's audible right now, from the audio clock. Poll from requestAnimationFrame. */
  playhead(): Playhead & { state: EngineState };
  subscribe(listener: (e: EngineEvent) => void): () => void;
  dispose(): void;
}

type ContextFactory = () => AudioContext;

/** The slot playing at a bar (before the transport exists), or null for an empty progression. */
function slotAtBar(slots: readonly PlaybackSlot[], bar: number): number | null {
  if (!slots.length) return null;
  let t = 0;
  for (let i = 0; i < slots.length; i++) {
    t += slots[i]!.bars;
    if (bar < t) return i;
  }
  return 0;
}

export function createEngine(options: EngineOptions = {}, makeContext: ContextFactory = () => new AudioContext({ latencyHint: 'interactive' })): Engine {
  let ctx: AudioContext | null = null;
  let voices: Voices | null = null;
  let loadStatus: LoadStatus = 'idle';
  let transport: Transport | null = null;
  const listeners = new Set<(e: EngineEvent) => void>();
  const emit = (e: EngineEvent) => listeners.forEach((l) => l(e));

  // Settings that may arrive before audio is unlocked; applied when the transport is created.
  let slots: readonly PlaybackSlot[] = [];
  let tempo = 90;
  let feel: FeelSettings = { groove: 'plain', swing: 0, voicing: 'close' };
  let parts: PartLevels = { ...DEFAULT_PARTS };
  let countIn = true;
  let muted = false;
  /** A bar cued before audio was unlocked; handed to the transport when it's built. */
  let cuedBar = 0;
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
    voices.setMuted(muted);
    options.onOutput?.(voices.output, ctx);
    const c = ctx;
    const sink = options.onSchedule
      ? { schedule: (e: import('./transport').AudioEvent) => (options.onSchedule!(e, c.currentTime), voices!.schedule(e)), silence: (t: number) => voices!.silence(t) }
      : voices;
    transport = new Transport({ now: () => c.currentTime }, createTicker(), sink, toFeel(feel));
    transport.setTempo(tempo);
    transport.setCountIn(countIn);
    transport.setProgression(slots);
    transport.seek(cuedBar);
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
    void loadInstruments();
    return true;
  }

  /**
   * Loads the sampled instruments in the background after the first tap, one after another. Each part
   * switches from synth to samples as soon as its own instrument is ready. Playback never waits.
   */
  async function loadInstruments(): Promise<void> {
    if (!ctx || !voices || loadStatus !== 'idle') return;
    loadStatus = 'loading';
    const c = ctx;
    const v = voices;
    const total = INSTRUMENTS.reduce((n, i) => n + i.map.files.length, 0);
    let before = 0;
    const failed: string[] = [];
    emit({ type: 'instrument', status: 'loading', progress: 0, failed });
    for (const inst of INSTRUMENTS) {
      const s = new Sampler(c, inst.map, `${import.meta.env.BASE_URL}samples/${inst.dir}/`);
      const ok = await s.load((done) => emit({ type: 'instrument', status: 'loading', progress: (before + done) / total, failed }));
      if (ok) v.setSampler(inst.part, s);
      else failed.push(inst.map.name);
      before += inst.map.files.length;
    }
    loadStatus = failed.length ? 'failed' : 'ready';
    emit({ type: 'instrument', status: loadStatus, progress: 1, failed });
  }

  const engine: Engine = {
    get state() {
      return lastState;
    },
    get instrumentStatus() {
      return loadStatus;
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
    seek(bar) {
      if (transport) transport.seek(bar);
      else cuedBar = bar;
    },
    setProgression(next, opts) {
      slots = next;
      if (opts?.fromTop) cuedBar = 0;
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
    setMuted(on) {
      muted = on;
      voices?.setMuted(on);
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
      if (!ctx || !transport) return { state: lastState, phase: 'stopped', countInBeat: null, bar: cuedBar, beat: 0, slotIndex: slotAtBar(slots, cuedBar), beatFraction: 0 };
      // What's audible lags what's scheduled by the output latency; the UI follows the audible time.
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
