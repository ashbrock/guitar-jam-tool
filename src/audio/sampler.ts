// Sample playback for recorded instruments. The note/velocity → recording mapping is pure (tested);
// loading and playback use Web Audio. Instrument mappings are plain data (src/data/instruments).

export interface SampleRegion {
  lokey: number;
  hikey: number;
  /** The MIDI note the recording was made at. */
  center: number;
  /** Fine tuning of the recording, in cents. */
  tune: number;
  /** Level trim, in dB. */
  volume: number;
  file: string;
}

export interface VelocityLayer {
  lovel: number;
  hivel: number;
  regions: SampleRegion[];
}

export interface InstrumentMap {
  name: string;
  files: string[];
  layers: VelocityLayer[];
}

export interface Pick {
  region: SampleRegion;
  /** Playback rate that shifts the recording to the requested note. */
  rate: number;
  /** Linear gain for the region trim and velocity. */
  gain: number;
}

/** MIDI velocity (1–127) from our 0–1 velocities, kept off the extremes so the instrument stays musical. */
export function toMidiVelocity(vel: number): number {
  return Math.round(Math.min(127, Math.max(1, 30 + vel * 75)));
}

/**
 * Chooses the recording for a note and velocity: the velocity layer that contains it (else the nearest),
 * then the region covering the note (else the nearest). Returns the pitch-shift rate and gain.
 */
export function pickRegion(map: InstrumentMap, midi: number, velocity: number): Pick | null {
  if (map.layers.length === 0) return null;
  const layer =
    map.layers.find((l) => velocity >= l.lovel && velocity <= l.hivel) ??
    [...map.layers].sort((a, b) => Math.abs((a.lovel + a.hivel) / 2 - velocity) - Math.abs((b.lovel + b.hivel) / 2 - velocity))[0]!;
  const region =
    layer.regions.find((r) => midi >= r.lokey && midi <= r.hikey) ??
    [...layer.regions].sort((a, b) => Math.abs(a.center - midi) - Math.abs(b.center - midi))[0];
  if (!region) return null;
  const rate = 2 ** ((midi - region.center + region.tune / 100) / 12);
  // SFZ amp_veltrack=100: amplitude follows (velocity/127)², plus the region trim.
  const gain = 10 ** (region.volume / 20) * (velocity / 127) ** 2;
  return { region, rate, gain };
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** Loads and plays one sampled instrument. One voice per note: re-striking a note cuts the last one, like the real thing. */
export class Sampler {
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<number, { src: AudioBufferSourceNode; env: GainNode }>();
  status: LoadStatus = 'idle';

  constructor(
    private readonly ctx: BaseAudioContext,
    readonly map: InstrumentMap,
    private readonly baseUrl: string,
  ) {}

  /** Files that couldn't be fetched or decoded (their notes fall back to the synth). */
  readonly missing: string[] = [];

  /**
   * Fetches and decodes every file, a few at a time. One bad file doesn't sink the instrument: it's
   * skipped and only its notes fall back. Resolves true if most of the instrument loaded.
   */
  async load(onProgress?: (done: number, total: number) => void): Promise<boolean> {
    if (this.status === 'ready' || this.status === 'loading') return this.status === 'ready';
    this.status = 'loading';
    const files = [...this.map.files];
    let done = 0;
    const worker = async () => {
      for (let f = files.shift(); f; f = files.shift()) {
        try {
          const res = await fetch(this.baseUrl + f);
          if (!res.ok) throw new Error(String(res.status));
          this.buffers.set(f, await this.ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          this.missing.push(f);
        }
        onProgress?.(++done, this.map.files.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.status = this.buffers.size >= this.map.files.length * 0.8 ? 'ready' : 'failed';
    return this.status === 'ready';
  }

  get ready(): boolean {
    return this.status === 'ready';
  }

  /** Plays a note at audio time `t` for `duration` seconds, into `out`. Returns false if it couldn't (caller falls back). */
  play(midi: number, t: number, duration: number, vel: number, out: AudioNode, level = 1): boolean {
    const pick = pickRegion(this.map, midi, toMidiVelocity(vel));
    if (!pick) return false;
    const buffer = this.buffers.get(pick.region.file);
    if (!buffer) return false;

    const prev = this.voices.get(midi);
    if (prev) {
      prev.env.gain.cancelScheduledValues(t);
      prev.env.gain.setTargetAtTime(0, t, 0.015);
      try { prev.src.stop(t + 0.1); } catch { /* already stopped */ }
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pick.rate;
    const env = this.ctx.createGain();
    const g = pick.gain * level;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(g, t + 0.003);
    const end = t + Math.max(0.06, duration);
    env.gain.setValueAtTime(g, end);
    env.gain.setTargetAtTime(0, end, 0.09); // ~0.1 s release, like the instrument's own
    src.connect(env).connect(out);
    src.start(t);
    src.stop(Math.min(end + 0.6, t + buffer.duration / pick.rate));
    const voice = { src, env };
    this.voices.set(midi, voice);
    src.onended = () => {
      if (this.voices.get(midi) === voice) this.voices.delete(midi);
    };
    return true;
  }

  /** Fades out everything that's sounding. */
  silence(now: number): void {
    for (const { src, env } of this.voices.values()) {
      env.gain.cancelScheduledValues(now);
      env.gain.setTargetAtTime(0, now, 0.015);
      try { src.stop(now + 0.1); } catch { /* already stopped */ }
    }
    this.voices.clear();
  }
}
