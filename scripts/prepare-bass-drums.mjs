// Builds the bass and drum sample sets from the original CC0 libraries (see public/samples/*/CREDITS.md).
//
//   node scripts/prepare-bass-drums.mjs <karoryfer.swagbass dir> <virtuosity_drums dir>
//
// Needs ffmpeg. Picks a small subset (enough for our parts), trims tails, mixes the drum mics,
// encodes AAC and writes the mapping data to src/data/instruments/. Re-running is safe.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [bassSrc, drumSrc] = process.argv.slice(2);
if (!bassSrc || !drumSrc) throw new Error('usage: prepare-bass-drums.mjs <swagbass dir> <virtuosity dir>');

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
/** Peak level of a file in dB, from ffmpeg's volumedetect (which reports on stderr). */
function peakDb(file) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /max_volume: (-?[\d.]+) dB/.exec(r.stderr.toString());
  if (!m) throw new Error(`no level for ${file}`);
  return Number(m[1]);
}

// ---------- Bass: Karoryfer Swagbass (flatwounds, neck pickup), "clean" mapping ----------
// Notes are sampled every minor third. We keep A1–A3 (covers our bass range, C2 up to about A3),
// three dynamics and two round robins each, trimmed to 3 s.
const BASS_OUT = 'public/samples/swagbass';
mkdirSync(BASS_OUT, { recursive: true });
const bassNotes = [['a2', 33], ['c3', 36], ['eb3', 39], ['gb3', 42], ['a3', 45], ['c4', 48], ['eb4', 51], ['gb4', 54], ['a4', 57]];
const bassDyn = [['p', 1, 50], ['f', 51, 110], ['fff', 111, 127]];
const bassFiles = [];
const bassLayers = bassDyn.map(([d, lovel, hivel]) => ({
  lovel,
  hivel,
  regions: bassNotes.map(([n, center], i) => {
    const files = [3, 4].map((rr) => {
      const name = `${n}_${d}_rr${rr}.m4a`;
      ffmpeg(['-i', join(bassSrc, 'notes', `${n}_${d}_rr${rr}.wav`), '-t', '3', '-af', 'afade=t=out:st=2.5:d=0.5', '-c:a', 'aac', '-b:a', '80k', '-ac', '1', '-ar', '44100', '-movflags', '+faststart', join(BASS_OUT, name)]);
      bassFiles.push(name);
      return name;
    });
    return {
      lokey: i === 0 ? 0 : center - 1,
      hikey: i === bassNotes.length - 1 ? 127 : center + 1,
      center,
      tune: 0,
      volume: 0,
      file: files[0],
      alternates: files.slice(1),
    };
  }),
}));
writeFileSync('src/data/instruments/swagbass.json', JSON.stringify({ name: 'Swagbass', files: bassFiles, mono: true, layers: bassLayers }, null, 1) + '\n');

// ---------- Drums: Versilian Virtuosity Drums, "basic kit" mics (kick + snare close mics + overheads) ----------
// Each hit mixes the three mics (as the library's basic kit does) into one stereo file.
const DRUM_OUT = 'public/samples/virtuosity-kit';
mkdirSync(DRUM_OUT, { recursive: true });
const mics = ['kickmic', 'snaremic', 'oh'];
const pieces = [
  // key, folder, sample stem, velocity layers [name suffix, lovel, hivel], round robins, length (s)
  { key: 36, dir: 'kick', stem: 'kick_snoff', layers: [['vl1', 1, 31], ['vl2', 32, 63], ['vl3', 64, 95], ['vl4', 96, 127]], rr: ['_rr1', '_rr2'], len: 1.6 },
  { key: 38, dir: 'snare', stem: 'snare_center', layers: [['vl6', 1, 31], ['vl12', 32, 53], ['vl18', 54, 74], ['vl24', 75, 95], ['vl30', 96, 111], ['vl36', 112, 127]], rr: [''], len: 1.6 },
  { key: 42, dir: 'hh', stem: 'hh_closed', layers: [['vl1', 1, 31], ['vl2', 32, 63], ['vl3', 64, 95], ['vl4', 96, 127]], rr: ['_rr1', '_rr2'], len: 0.9 },
];
const drumFiles = [];
const drumLayers = [];
for (const p of pieces) {
  const made = [];
  for (const [vl, lovel, hivel] of p.layers) {
    const files = p.rr.map((rr) => {
      const name = `${p.stem}_${vl}${rr}.m4a`;
      const inputs = mics.flatMap((m) => ['-i', join(drumSrc, 'Samples', m, p.dir, `${m}_${p.stem}_${vl}${rr}.flac`)]);
      const fade = p.len - 0.3;
      ffmpeg([
        ...inputs,
        '-filter_complex',
        // Close mics are mono: centre them; overheads keep their stereo image. Summed without normalising.
        `[0:a]aformat=channel_layouts=stereo[k];[1:a]aformat=channel_layouts=stereo[s];[2:a]aformat=channel_layouts=stereo[o];` +
          `[k][s][o]amix=inputs=3:normalize=0,volume=-6dB,atrim=0:${p.len},afade=t=out:st=${fade}:d=0.3[out]`,
        '-map', '[out]', '-c:a', 'aac', '-b:a', '112k', '-ar', '44100', '-movflags', '+faststart', join(DRUM_OUT, name),
      ]);
      drumFiles.push(name);
      return name;
    });
    made.push({ lovel, hivel, files });
  }
  // Level each piece so its loudest layer peaks at -3 dB; softer layers keep their natural drop.
  const loudest = Math.max(...made.flatMap((m) => m.files.map((f) => peakDb(join(DRUM_OUT, f)))));
  const trim = +(-3 - loudest).toFixed(1);
  for (const m of made) {
    drumLayers.push({ lovel: m.lovel, hivel: m.hivel, regions: [{ lokey: p.key, hikey: p.key, center: p.key, tune: 0, volume: trim, file: m.files[0], alternates: m.files.slice(1) }] });
  }
}
writeFileSync('src/data/instruments/virtuosity-kit.json', JSON.stringify({ name: 'Virtuosity Drums', files: drumFiles, oneShot: true, veltrack: 0.5, layers: drumLayers }, null, 1) + '\n');
console.log(`bass: ${bassFiles.length} files, drums: ${drumFiles.length} files`);
