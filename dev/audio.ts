// Dev-only harness for hearing and timing-checking the audio engine before the real UI exists.
import { createEngine, type FeelSettings } from '../src/audio/engine';
import type { AudioEvent } from '../src/audio/transport';
import { VIBES, vibeById } from '../src/data/vibes/index';
import { parseProgressionText } from '../src/theory/progression';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log: { event: AudioEvent; now: number }[] = [];
let analyser: AnalyserNode | null = null;
let audioCtx: AudioContext | null = null;
let outputNode: AudioNode | null = null;
const engine = createEngine({
  onSchedule: (event, now) => log.push({ event, now }),
  onOutput: (output, ctx) => {
    audioCtx = ctx;
    outputNode = output;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    output.connect(analyser);
  },
});
/** Peak output level over the last ~40 ms (0 = silence). */
function level(): number {
  if (!analyser) return 0;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  return buf.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
}

for (const v of VIBES) $('vibe').append(new Option(v.name, v.id));

function applyProgression(fromTop = false) {
  const r = parseProgressionText($<HTMLInputElement>('prog').value);
  $('progError').textContent = r.slots ? '' : `${r.errorCount} problem(s) in the progression`;
  engine.setProgression(r.slots ?? [], { fromTop });
}

function applyVibe() {
  const v = vibeById($<HTMLSelectElement>('vibe').value);
  const feel: FeelSettings = v
    ? { groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing }
    : { groove: 'plain', swing: 0, voicing: 'close' };
  engine.setFeel(feel);
  if (v) {
    $<HTMLInputElement>('tempo').value = String(v.playback.tempo.default);
    engine.setTempo(v.playback.tempo.default);
  }
}

function applyParts() {
  const on = (id: string) => $<HTMLInputElement>(id).checked;
  engine.setParts({ chords: on('chords'), bass: on('bass'), click: on('click'), drums: on('drums') });
  engine.setCountIn(on('countIn'));
}

$('prog').addEventListener('change', () => applyProgression());
$('vibe').addEventListener('change', applyVibe);
$('tempo').addEventListener('change', () => engine.setTempo(Number($<HTMLInputElement>('tempo').value)));
for (const id of ['chords', 'bass', 'click', 'drums', 'countIn']) $(id).addEventListener('change', applyParts);
$('play').addEventListener('click', () => void engine.togglePlay());
$('restart').addEventListener('click', () => engine.restart());
$('reroll').addEventListener('click', () => applyProgression(true));
$('preview').addEventListener('click', () => {
  const r = parseProgressionText($<HTMLInputElement>('prog').value);
  if (r.slots?.[0]) void engine.previewChord(r.slots[0].chord);
});
engine.subscribe((e) => console.info('[engine]', e));

applyProgression();
applyVibe();
applyParts();

function frame() {
  const p = engine.playhead();
  $('status').textContent = `state: ${p.state}\nphase: ${p.phase}  count-in: ${p.countInBeat ?? '–'}\nbar: ${p.bar + 1}  beat: ${p.beat + 1}  slot: ${p.slotIndex ?? '–'}\ntempo: ${engine.tempo}`;
  requestAnimationFrame(frame);
}
frame();

// Exposed for automated timing checks.
(window as unknown as { __audio: unknown }).__audio = { engine, log, level, applyProgression, applyVibe, ctx: () => audioCtx, output: () => outputNode };
