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
  /** Other takes of the same note ("round robins"), cycled so repeated hits aren't identical. */
  alternates?: string[];
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
  /** One note at a time, like a bass player: a new note cuts the last, whatever its pitch. */
  mono?: boolean;
  /** Drums: play each hit to the end of its recording and ignore note length. */
  oneShot?: boolean;
  /**
   * How much velocity scales loudness, 0–1 (default 1, the SFZ default). Kits with many velocity
   * layers already get louder layer by layer, so they need less.
   */
  veltrack?: number;
}

export interface Pick {
  region: SampleRegion;
  /** The take to play (the region's file or one of its alternates). */
  file: string;
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
 * Chooses the recording for a note and velocity. Only layers that map the note are considered (so a
 * kit's kick and snare can have different velocity layers); of those, the layer that contains the
 * velocity, else the nearest. If no layer maps the note, the nearest region in the nearest layer.
 * `round` picks between a region's takes. Returns the pitch-shift rate and gain.
 */
export function pickRegion(map: InstrumentMap, midi: number, velocity: number, round = 0): Pick | null {
  if (map.layers.length === 0) return null;
  const covers = (r: SampleRegion) => midi >= r.lokey && midi <= r.hikey;
  const mapped = map.layers.filter((l) => l.regions.some(covers));
  const pool = mapped.length ? mapped : map.layers;
  const distance = (l: VelocityLayer) => (velocity < l.lovel ? l.lovel - velocity : velocity > l.hivel ? velocity - l.hivel : 0);
  const layer = [...pool].sort((a, b) => distance(a) - distance(b))[0]!;
  const region =
    layer.regions.find(covers) ?? [...layer.regions].sort((a, b) => Math.abs(a.center - midi) - Math.abs(b.center - midi))[0];
  if (!region) return null;
  const takes = [region.file, ...(region.alternates ?? [])];
  const file = takes[((round % takes.length) + takes.length) % takes.length]!;
  const rate = 2 ** ((midi - region.center + region.tune / 100) / 12);
  // SFZ amp_veltrack: amplitude follows (velocity/127)² by the tracking amount, plus the region trim.
  const track = map.veltrack ?? 1;
  const gain = 10 ** (region.volume / 20) * (1 - track + track * (velocity / 127) ** 2);
  return { region, file, rate, gain };
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** Loads and plays one sampled instrument. One voice per note: re-striking a note cuts the last one, like the real thing. */
export class Sampler {
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<number, { src: AudioBufferSourceNode; env: GainNode }>();
  private rounds = new Map<number, number>();
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
    const round = this.rounds.get(midi) ?? 0;
    this.rounds.set(midi, round + 1);
    const pick = pickRegion(this.map, midi, toMidiVelocity(vel), round);
    if (!pick) return false;
    const buffer = this.buffers.get(pick.file) ?? this.buffers.get(pick.region.file);
    if (!buffer) return false;

    const slot = this.map.mono ? -1 : midi;
    const prev = this.voices.get(slot);
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
    const length = buffer.duration / pick.rate;
    if (this.map.oneShot) {
      src.connect(env).connect(out);
      src.start(t);
      src.stop(t + length);
    } else {
      const end = t + Math.max(0.06, duration);
      env.gain.setValueAtTime(g, end);
      env.gain.setTargetAtTime(0, end, 0.09); // ~0.1 s release, like the instrument's own
      src.connect(env).connect(out);
      src.start(t);
      src.stop(Math.min(end + 0.6, t + length));
    }
    const voice = { src, env };
    this.voices.set(slot, voice);
    src.onended = () => {
      if (this.voices.get(slot) === voice) this.voices.delete(slot);
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
