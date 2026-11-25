// Web Audio instruments: a sampled electric piano, bass and drum kit (each with a synth fallback while
// it loads), plus a click, through a room reverb, gentle saturation and a compressor.
// Implements the transport's Sink: it only ever plays what it's told, at the time it's told
// (humanising only ever moves notes later, never earlier).
import { jitterVelocity, lateBy, strumOffsets } from './humanize';
import type { Sampler } from './sampler';
import type { AudioEvent, Sink } from './transport';
import { midiToFrequency } from './voicing';

export type Part = 'chords' | 'bass' | 'click' | 'drums';
export type PartLevels = Record<Part, boolean>;
/** The parts that can use a sampled instrument. */
export type SampledPart = 'chords' | 'bass' | 'drums';

/** General MIDI drum keys, as used by the kit's mapping data. */
const DRUM_KEY = { kick: 36, snare: 38, hat: 42 } as const;

/**
 * Per-part levels for the sampled instruments, set by ear and checked by measurement so each part sits
 * at about the loudness its synth did (see the audio check in DECISIONS.md).
 */
const SAMPLE_LEVEL = { bass: 1.8, kick: 0.9, snare: 0.6, hat: 0.35 };

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
  private samplers: Partial<Record<SampledPart, Sampler>> = {};

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

    // Gentle tape-style saturation in front of the compressor: rounds off transients, adds warmth.
    const warmth = ctx.createWaveShaper();
    warmth.curve = saturationCurve(1.6);
    warmth.oversample = '2x';
    warmth.connect(compressor);

    // A small room: a generated impulse response (no files), fed by per-part sends.
    const reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx, 2.2);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.9;
    reverb.connect(reverbReturn).connect(compressor);

    const bus = (level: number, send: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(warmth);
      if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s).connect(reverb);
      }
      return g;
    };
    this.buses = {
      chords: bus(1, 0.32),
      bass: bus(1, 0.05),
      click: bus(1, 0),
      drums: bus(1, 0.14),
      countIn: bus(1, 0),
      preview: bus(1, 0.32),
    };

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Use a sampled instrument for a part once it has loaded (until then the synth plays). */
  setSampler(part: SampledPart, sampler: Sampler | null): void {
    if (sampler) this.samplers[part] = sampler;
    else delete this.samplers[part];
  }

  /** The part's sampler if it's ready to play. */
  private sampled(part: SampledPart): Sampler | null {
    const s = this.samplers[part];
    return s?.ready ? s : null;
  }

  /** Plays a drum hit from the sampled kit. False if it isn't loaded (the caller synthesises instead). */
  private drumSample(piece: keyof typeof DRUM_KEY, t: number, vel: number): boolean {
    const kit = this.sampled('drums');
    return !!kit && kit.play(DRUM_KEY[piece], t, 0, jitterVelocity(vel), this.buses.drums, SAMPLE_LEVEL[piece]);
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
    for (const s of Object.values(this.samplers)) s.silence(now);
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

  /**
   * Chords: rolled slightly low to high like real fingers, each note a touch different in level.
   * Sampled Wurlitzer when loaded, otherwise the synth electric piano.
   */
  private chord(notes: number[], t: number, duration: number, vel: number, bus: GainNode): void {
    const start = t + lateBy();
    const sorted = [...notes].sort((a, b) => a - b);
    const offsets = strumOffsets(sorted.length, vel);
    const piano = this.sampled('chords');
    if (piano) {
      // Level per note so a full chord sits at about the same loudness as the synth did.
      const level = 1.25 / Math.sqrt(Math.max(1, sorted.length));
      sorted.forEach((n, i) => {
        const v = jitterVelocity(vel);
        const played = piano.play(n, start + offsets[i]!, duration - offsets[i]!, v, bus, level);
        if (!played) this.synthNote(n, start + offsets[i]!, duration - offsets[i]!, v, sorted.length, bus);
      });
      return;
    }
    sorted.forEach((n, i) => this.synthNote(n, start + offsets[i]!, duration - offsets[i]!, jitterVelocity(vel), sorted.length, bus));
  }

  /** Synth electric piano note: a sine "tine" with a decaying FM bark on the attack, through a gentle low-pass. */
  private synthNote(n: number, t: number, duration: number, vel: number, count: number, bus: GainNode): void {
    const notes = [n];
    const ctx = this.ctx;
    const level = (0.22 * vel) / Math.sqrt(Math.max(1, count));
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

  /** Bass: the sampled flatwound bass when loaded (slightly detached, like a player), else the synth. */
  private bass(note: number, t: number, duration: number, vel: number): void {
    const start = t + lateBy();
    const length = Math.max(0.06, duration * 0.92);
    const sampled = this.sampled('bass');
    if (sampled && sampled.play(note, start, length, jitterVelocity(vel), this.buses.bass, SAMPLE_LEVEL.bass)) return;
    this.synthBass(note, start, duration, vel);
  }

  private synthBass(note: number, t: number, duration: number, vel: number): void {
    const ctx = this.ctx;
    const f = midiToFrequency(note);
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.frequency.value = f;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // A pluck: bright on the attack, closing down as the note settles.
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(1500 + 900 * vel, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.28);
    const env = ctx.createGain();
    const level = 0.42 * jitterVelocity(vel);
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
    if (this.drumSample('kick', t, vel)) return;
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
    if (this.drumSample('snare', t, vel)) return;
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
    if (this.drumSample('hat', t, vel)) return;
    this.noiseBurst(t, 0.045, 'highpass', 7000, 0.22 * vel);
  }
}

/** A soft-clipping curve (tanh), normalised so quiet signals pass at unity. */
function saturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

/** A small, warm room: stereo noise with an exponential decay, darkened over time (no audio files). */
function roomImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      // Darker as it decays: a one-pole low-pass whose cutoff falls over time.
      const k = 0.55 * Math.exp(-t * 1.6) + 0.06;
      lp += k * ((Math.random() * 2 - 1) - lp);
      const pre = t < 0.012 ? 0 : 1; // short pre-delay
      data[i] = lp * Math.exp(-t * 3.2) * pre;
    }
  }
  return buffer;
}
