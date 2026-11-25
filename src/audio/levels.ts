// Loudness by frequency band, for visuals that react to what's actually playing. Pure: it turns an
// analyser's byte frequency data into 0–1 levels, so it's tested without audio.

export interface AudioLevels {
  /** 20–250 Hz: kick and bass. */
  bass: number;
  /** 250–2000 Hz: the body of the chords. */
  mid: number;
  /** 2–8 kHz: attack, hats, shimmer. */
  treble: number;
}

export const SILENT: AudioLevels = { bass: 0, mid: 0, treble: 0 };

/** Average level (0–1) of the bins between `lo` and `hi` Hz. */
function band(data: Uint8Array, sampleRate: number, fftSize: number, lo: number, hi: number): number {
  const binHz = sampleRate / fftSize;
  const from = Math.max(1, Math.floor(lo / binHz));
  const to = Math.min(data.length - 1, Math.ceil(hi / binHz));
  if (to < from) return 0;
  let sum = 0;
  for (let i = from; i <= to; i++) sum += data[i]!;
  return sum / ((to - from + 1) * 255);
}

export function bandLevels(data: Uint8Array, sampleRate: number, fftSize: number): AudioLevels {
  return {
    bass: band(data, sampleRate, fftSize, 20, 250),
    mid: band(data, sampleRate, fftSize, 250, 2000),
    treble: band(data, sampleRate, fftSize, 2000, 8000),
  };
}
