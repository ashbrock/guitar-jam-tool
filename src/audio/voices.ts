// Web Audio instruments: electric piano, bass, click and a small drum kit, all synthesised (no samples).
// Implements the transport's Sink: it only ever plays what it's told, at the time it's told.
import type { AudioEvent, Sink } from './transport';
import { midiToFrequency } from './voicing';

export type Part = 'chords' | 'bass' | 'click' | 'drums';
export type PartLevels = Record<Part, boolean>;

interface Voice {
  sources: AudioScheduledSourceNode[];
  env: GainNode;
  end: number;
}

const MIN = 0.0001; // exponential ramps can't reach zero

export class Voices implements Sink {
  readonly output: GainNode;
  private readonly buses: Record<Part | 'countIn' | 'preview', GainNode>;
  private readonly noise: AudioBuffer;
  private active = new Set<Voice>();

  constructor(private readonly ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    // Gain staging: parts sum into a fast compressor, then a master trim that keeps peaks under 0 dBFS
    // even at 240 BPM with every part on (measured in the browser check, see DECISIONS.md).
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.15;
    this.output = ctx.createGain();
    this.output.gain.value = 0.85;
    compressor.connect(this.output).connect(destination);

    const bus = (level: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(compressor);
      return g;
    };
    this.buses = { chords: bus(1), bass: bus(1), click: bus(1), drums: bus(1), countIn: bus(1), preview: bus(1) };

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Mutes and unmutes take effect straight away, with a 10 ms ramp to avoid clicks. */
  setParts(parts: PartLevels): void {
    const now = this.ctx.currentTime;
    for (const p of ['chords', 'bass', 'click', 'drums'] as Part[]) {
      const g = this.buses[p].gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(parts[p] ? 1 : 0, now, 0.01);
    }
  }

  schedule(e: AudioEvent): void {
    switch (e.kind) {
      case 'chord':
        this.chord(e.notes, e.time, e.duration, e.vel, this.buses.chords);
        break;
      case 'bass':
        this.bass(e.note, e.time, e.duration, e.vel);
        break;
      case 'click':
        this.click(e.time, e.accent, e.countIn ? this.buses.countIn : this.buses.click);
        break;
      case 'kick':
        this.kick(e.time, e.vel);
        break;
      case 'snare':
        this.snare(e.time, e.vel);
        break;
      case 'hat':
        this.hat(e.time, e.vel);
        break;
    }
  }

  /** Fades out everything sounding and cancels everything scheduled. */
  silence(now: number): void {
    for (const v of this.active) {
      v.env.gain.cancelScheduledValues(now);
      v.env.gain.setValueAtTime(v.env.gain.value, now);
      v.env.gain.setTargetAtTime(0, now, 0.015);
      for (const s of v.sources) {
        try {
          s.stop(now + 0.08);
        } catch {
          /* already stopped */
        }
      }
    }
    this.active.clear();
  }

  /** A chord heard immediately (tapping a chord preview), regardless of part mutes. */
  previewChord(notes: number[]): void {
    this.chord(notes, this.ctx.currentTime + 0.01, 1.2, 0.75, this.buses.preview);
  }

  /** A single note heard immediately (tapping the fretboard), regardless of part mutes. */
  previewNote(midi: number): void {
    this.chord([midi], this.ctx.currentTime + 0.01, 0.6, 0.85, this.buses.preview);
  }

  // ---------- Instruments ----------

  private track(sources: AudioScheduledSourceNode[], env: GainNode, end: number): void {
    const v: Voice = { sources, env, end };
    this.active.add(v);
    sources[0]!.onended = () => this.active.delete(v);
  }

  /** Electric piano: a sine "tine" with a decaying FM bark on the attack, through a gentle low-pass. */
  private chord(notes: number[], t: number, duration: number, vel: number, bus: GainNode): void {
    const ctx = this.ctx;
    const level = (0.22 * vel) / Math.sqrt(Math.max(1, notes.length));
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    filter.connect(bus);
    const end = t + Math.max(0.08, duration);
    for (const n of notes) {
      const f = midiToFrequency(n);
      const carrier = ctx.createOscillator();
      carrier.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f;
      const modDepth = ctx.createGain();
      modDepth.gain.setValueAtTime(f * 1.4, t);
      modDepth.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.08), t + 0.45);
      mod.connect(modDepth).connect(carrier.frequency);

      const env = ctx.createGain();
      env.gain.setValueAtTime(MIN, t);
      env.gain.exponentialRampToValueAtTime(level, t + 0.006);
      env.gain.exponentialRampToValueAtTime(level * 0.45, t + 1.2);
      env.gain.setTargetAtTime(MIN, end, 0.09);
      carrier.connect(env).connect(filter);

      carrier.start(t);
      mod.start(t);
      carrier.stop(end + 0.6);
      mod.stop(end + 0.6);
      this.track([carrier, mod], env, end);
    }
  }

  private bass(note: number, t: number, duration: number, vel: number): void {
    const ctx = this.ctx;
    const f = midiToFrequency(note);
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.frequency.value = f;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const env = ctx.createGain();
    const level = 0.42 * vel;
    const end = t + Math.max(0.06, duration * 0.92);
    env.gain.setValueAtTime(MIN, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.008);
    env.gain.exponentialRampToValueAtTime(level * 0.6, t + 0.35);
    env.gain.setTargetAtTime(MIN, end, 0.04);
    tri.connect(filter);
    sub.connect(filter);
    filter.connect(env).connect(this.buses.bass);
    tri.start(t);
    sub.start(t);
    tri.stop(end + 0.3);
    sub.stop(end + 0.3);
    this.track([tri, sub], env, end);
  }

  private click(t: number, accent: boolean, bus: GainNode): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.value = accent ? 1760 : 1320;
    const env = ctx.createGain();
    env.gain.setValueAtTime(MIN, t);
    env.gain.exponentialRampToValueAtTime(accent ? 0.32 : 0.22, t + 0.002);
    env.gain.exponentialRampToValueAtTime(MIN, t + 0.035);
    osc.connect(env).connect(bus);
    osc.start(t);
    osc.stop(t + 0.05);
    this.track([osc], env, t + 0.05);
  }

  private kick(t: number, vel: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(MIN, t);
    env.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.004);
    env.gain.exponentialRampToValueAtTime(MIN, t + 0.32);
    osc.connect(env).connect(this.buses.drums);
    osc.start(t);
    osc.stop(t + 0.35);
    this.track([osc], env, t + 0.35);
  }

  private noiseBurst(t: number, length: number, filterType: BiquadFilterType, freq: number, level: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(MIN, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.002);
    env.gain.exponentialRampToValueAtTime(MIN, t + length);
    src.connect(filter).connect(env).connect(this.buses.drums);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.02);
    this.track([src], env, t + length);
  }

  private snare(t: number, vel: number): void {
    this.noiseBurst(t, 0.16, 'bandpass', 1800, 0.5 * vel);
    const ctx = this.ctx;
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = 190;
    const env = ctx.createGain();
    env.gain.setValueAtTime(MIN, t);
    env.gain.exponentialRampToValueAtTime(0.35 * vel, t + 0.003);
    env.gain.exponentialRampToValueAtTime(MIN, t + 0.09);
    body.connect(env).connect(this.buses.drums);
    body.start(t);
    body.stop(t + 0.12);
    this.track([body], env, t + 0.12);
  }

  private hat(t: number, vel: number): void {
    this.noiseBurst(t, 0.045, 'highpass', 7000, 0.22 * vel);
  }
}
