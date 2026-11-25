// Exploration: full-screen generative visuals driven by the music. Not wired into the app.
//
// Concept, "sympathetic strings": the screen is filled with strings whose wave shapes are built from
// the current chord's interval ratios (major 1 : 5/4 : 3/2, minor 1 : 6/5 : 3/2…), so the pattern is
// literally the harmony. Chord changes morph the pattern, tempo sets the speed, each beat is a gentle
// swell (never a flash), and each vibe has its own palette and motion. No AI: plain code, no deps.
import { createEngine } from '../../../src/audio/engine';
import { clampTempo } from '../../../src/audio/transport';
import { VIBES } from '../../../src/data/vibes/index';
import { chordParts, parseChord, spokenChord, type Chord } from '../../../src/theory/chords';
import { resolveDegreeChord } from '../../../src/theory/degrees';
import { generate, type DegreeSlot } from '../../../src/theory/generator';
import { KEY_TONICS, formatKey, type Key, type Mode } from '../../../src/theory/keys';
import { pc } from '../../../src/theory/notes';
import { basicQuality, basicShape, STRING_NAMES, type PlacedShape } from '../../../src/theory/shapes';
import { newSeed } from '../../../src/theory/random';
import type { Vibe } from '../../../src/theory/vibe';

// ---------- Music state ----------

type Kind = 'major' | 'minor' | 'dim' | 'sus';
interface Slot { chord: Chord; bars: number; kind: Kind; seventh: 'none' | 'minor' | 'major' }

/** The default chord set: triads, 7ths, sus and dim only (extended chords are a later option). */
function simplify(c: Chord): { chord: Chord; kind: Kind } {
  const s = c.spec;
  let suffix: string;
  let kind: Kind;
  if (s.third === 'sus2' || s.third === 'sus4') { suffix = s.third; kind = 'sus'; }
  else if (s.seventh === 'diminished' || (s.third === 'minor' && s.fifth === 'flat')) { suffix = 'dim'; kind = 'dim'; }
  else if (s.third === 'minor') { suffix = s.seventh === 'none' && !s.sixth ? 'm' : 'm7'; kind = 'minor'; }
  else { suffix = s.seventh === 'major' ? 'maj7' : s.seventh === 'minor' ? '7' : ''; kind = 'major'; }
  const r = parseChord(`C${suffix}`);
  if (!r.ok) throw new Error(suffix);
  return { chord: { root: c.root, bass: null, spec: r.chord.spec }, kind };
}

const engine = createEngine();
let vibeIndex = 0;
let key: Key = { tonic: { letter: 'D', acc: 0 }, mode: 'major' };
let tempo = VIBES[0]!.playback.tempo.default;
let keyHeld = false;
let tempoHeld = false;
let degreeSlots: DegreeSlot[] = [];
let slots: Slot[] = [];
const history: { vibeIndex: number; key: Key; tempo: number; degreeSlots: DegreeSlot[] }[] = [];

const vibe = (): Vibe => VIBES[vibeIndex]!;
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

function resolve(): void {
  slots = degreeSlots.map((d) => {
    const s = simplify(resolveDegreeChord(d.degree, d.quality, key));
    return { chord: s.chord, bars: d.bars, kind: s.kind, seventh: s.chord.spec.seventh === 'diminished' ? 'none' : s.chord.spec.seventh };
  });
  engine.setProgression(slots.map((s) => ({ chord: s.chord, bars: s.bars as 0.5 | 1 | 2 | 4 })), { fromTop: true });
}

function roll(changeKeyAndTempo: boolean): void {
  history.push({ vibeIndex, key, tempo, degreeSlots });
  if (changeKeyAndTempo && !keyHeld) {
    const mode: Mode = Math.random() < 0.5 ? 'major' : 'minor';
    key = { tonic: pick(KEY_TONICS[mode]), mode };
  }
  if (changeKeyAndTempo && !tempoHeld) {
    const t = vibe().playback.tempo;
    tempo = clampTempo(t.min + Math.random() * (t.max - t.min));
  }
  const v = vibe();
  const length = pick(v.params.lengths.filter((l) => l <= 8));
  degreeSlots = generate({ params: v.params, mode: key.mode, lengthBars: length, seed: newSeed() }).slots;
  engine.setFeel({ groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing });
  engine.setTempo(tempo);
  resolve();
  renderPanel();
}

function back(): void {
  const h = history.pop();
  if (!h) return;
  ({ vibeIndex, key, tempo, degreeSlots } = h);
  const v = vibe();
  engine.setFeel({ groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing });
  engine.setTempo(tempo);
  resolve();
  renderPanel();
}

// ---------- Visual language per vibe ----------

interface Look {
  /** Gradient stops for major- and minor-family chords (left → right across the screen). */
  major: [string, string];
  minor: [string, string];
  lines: number;
  width: number;
  /** Displacement as a fraction of line spacing. */
  amp: number;
  /** Motion speed multiplier (on top of tempo). */
  speed: number;
  /** Spatial cycles across the screen. */
  cycles: number;
  vertical: boolean;
  /** Lilt for shuffle feels. */
  sway: number;
}

const LOOKS: Record<string, Look> = {
  'neo-soul': { major: ['#ff8a3d', '#ff4d7e'], minor: ['#ff4d7e', '#c4467a'], lines: 30, width: 1.6, amp: 2.4, speed: 0.55, cycles: 1.4, vertical: false, sway: 0.35 },
  blues: { major: ['#2f7bff', '#36d1ff'], minor: ['#1f4fd1', '#2f7bff'], lines: 16, width: 3.2, amp: 1.6, speed: 0.4, cycles: 0.9, vertical: false, sway: 0.6 },
  'soul-roots': { major: ['#ffb020', '#ff5a1f'], minor: ['#ff5a1f', '#d2334b'], lines: 22, width: 2.2, amp: 1.8, speed: 0.6, cycles: 1.1, vertical: true, sway: 0.15 },
  heartland: { major: ['#ffd23f', '#3ccf7d'], minor: ['#3ccf7d', '#22a7b8'], lines: 26, width: 2, amp: 1.4, speed: 0.9, cycles: 1.6, vertical: true, sway: 0 },
  dreamy: { major: ['#8fe3ff', '#e9f7ff'], minor: ['#4f9dff', '#8fe3ff'], lines: 20, width: 1.4, amp: 3.2, speed: 0.25, cycles: 0.7, vertical: false, sway: 0 },
  'desert-groove': { major: ['#ff7a3d', '#ffd23f'], minor: ['#e0442b', '#ff9a3d'], lines: 34, width: 1.3, amp: 1.2, speed: 0.75, cycles: 2.6, vertical: true, sway: 0.1 },
};

/** The chord's interval ratios (just intonation): these set the wave's harmonics. */
function ratios(s: Slot | undefined): number[] {
  if (!s) return [1, 3 / 2];
  const third = s.kind === 'major' ? 5 / 4 : s.kind === 'minor' ? 6 / 5 : s.kind === 'dim' ? 6 / 5 : s.chord.spec.third === 'sus2' ? 9 / 8 : 4 / 3;
  const fifth = s.kind === 'dim' ? 64 / 45 : 3 / 2;
  const out = [1, third, fifth];
  if (s.seventh === 'major') out.push(15 / 8);
  if (s.seventh === 'minor') out.push(s.kind === 'minor' ? 9 / 5 : 7 / 4);
  return out;
}

// ---------- Renderer ----------

const canvas = document.getElementById('viz') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let mode: 'lines' | 'dots' = 'lines';
let W = 0, H = 0, DPR = 1;

function resize(): void {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i]! - x) * t));
const rgb = (c: number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

// Animated state: everything eases toward its target so chord changes morph instead of jumping.
let colA = hex('#ff8a3d'), colB = hex('#ff4d7e');
let curRatios = [1, 5 / 4, 3 / 2], prevRatios = curRatios;
let morph = 1, morphStart = 0;
let base = 1.4, baseTarget = 1.4;
let pulseAt = -10;
let lastSlot: number | null = -1, lastBeat = -1;
let phase = 0, lastFrame = performance.now();

function wave(x: number, line: number, t: number, rs: number[], look: Look): number {
  let sum = 0, norm = 0;
  for (let j = 0; j < rs.length; j++) {
    const r = rs[j]!;
    const w = 1 / (1 + j * 0.6);
    sum += w * Math.sin(2 * Math.PI * base * r * x + t * r * (1 + 0.13 * j) + line * 0.33 * r);
    norm += w;
  }
  return sum / norm;
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const look = LOOKS[vibe().id] ?? LOOKS['neo-soul']!;
  const p = engine.playhead();
  const playing = p.phase === 'playing' || p.phase === 'count-in';
  const slot = p.slotIndex !== null ? slots[p.slotIndex] : slots[0];

  // Chord change → morph to the new harmony and colour.
  if (p.slotIndex !== lastSlot) {
    lastSlot = p.slotIndex;
    prevRatios = curRatios;
    curRatios = ratios(slot);
    morph = 0;
    morphStart = now;
    baseTarget = look.cycles * (0.85 + (slot ? pc(slot.chord.root) : 0) / 40);
    renderChord();
  }
  // Beat → gentle swell.
  if (playing && p.phase === 'playing' && p.beat !== lastBeat) {
    lastBeat = p.beat;
    pulseAt = now;
  }
  if (!playing) lastBeat = -1;

  const still = reduced.matches;
  morph = still ? 1 : Math.min(1, (now - morphStart) / 700);
  const ease = morph * morph * (3 - 2 * morph);
  base += (baseTarget - base) * (still ? 1 : 0.04);
  const [ta, tb] = slot && (slot.kind === 'minor' || slot.kind === 'dim') ? look.minor : look.major;
  colA = mix(colA, hex(ta), still ? 1 : 0.06);
  colB = mix(colB, hex(tb), still ? 1 : 0.06);

  const bpm = engine.tempo;
  if (!still) phase += dt * (playing ? (bpm / 90) * 2.2 * look.speed : 0.35 * look.speed);
  const lilt = look.sway * Math.sin(phase * 1.7) * 0.6;
  const t = phase + lilt;
  const swell = still || !playing ? 0 : 0.45 * Math.exp(-(now - pulseAt) / 240);
  const breathe = playing ? 1 : 0.65 + 0.1 * Math.sin(now / 1400);

  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, W, H);
  const grad = look.vertical ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, rgb(colA));
  grad.addColorStop(1, rgb(colB));

  const n = look.lines;
  const along = look.vertical ? H : W;
  const across = look.vertical ? W : H;
  const spacing = across / (n + 1);
  const amp = spacing * look.amp * breathe * (1 + swell);
  const sample = (x: number, i: number) => {
    const a = wave(x, i, t, prevRatios, look);
    const b = wave(x, i, t, curRatios, look);
    return a + (b - a) * ease;
  };

  if (mode === 'lines') {
    ctx.strokeStyle = grad;
    ctx.lineWidth = look.width;
    ctx.lineCap = 'round';
    const step = 6;
    for (let i = 0; i < n; i++) {
      // Strings fade a little towards the edges, like light falling off.
      const edge = 1 - Math.abs((i + 1) / (n + 1) - 0.5) * 1.1;
      ctx.globalAlpha = 0.35 + 0.65 * edge;
      ctx.beginPath();
      const c0 = spacing * (i + 1);
      for (let s = 0; s <= along + step; s += step) {
        const d = sample(s / along, i) * amp * (0.55 + 0.45 * Math.sin(Math.PI * s / along));
        const x = look.vertical ? c0 + d : s;
        const y = look.vertical ? s : c0 + d;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    // Dot grid: the same field, sampled on a grid; dots move with the wave and grow where it's strongest.
    ctx.fillStyle = grad;
    const gap = 14;
    for (let cy = gap / 2; cy < H; cy += gap) {
      for (let cx = gap / 2; cx < W; cx += gap) {
        const a = look.vertical ? cy : cx;
        const c = look.vertical ? cx : cy;
        const line = c / spacing;
        const v = sample(a / along, line);
        const d = v * amp * 0.5;
        const e = Math.abs(v) ** 0.7;
        const size = 1.5 + 6 * e * (0.75 + swell);
        const edge = 1 - Math.abs(c / across - 0.5) * 0.9;
        ctx.globalAlpha = (0.18 + 0.82 * e) * (0.55 + 0.45 * edge);
        const x = look.vertical ? cx + d : cx;
        const y = look.vertical ? cy : cy + d;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Loop progress and the current pill.
  updateLoop(p.slotIndex, playing);
  requestAnimationFrame(frame);
}

// ---------- UI ----------

const $ = (id: string) => document.getElementById(id)!;
const KIND_DOT: Record<Kind, string> = { major: '#ff5c2b', minor: '#f59ac2', dim: '#ffd23f', sus: '#e8d9bd' };

/** Lead-sheet setting: a bare minor "m" stays on the baseline, the rest is raised. */
function splitSuffix(suffix: string): [string, string] {
  return suffix.startsWith('m') && !suffix.startsWith('maj') ? ['m', suffix.slice(1)] : ['', suffix];
}
function chordHTML(c: Chord): string {
  const { root, suffix } = chordParts(c);
  const [m, q] = splitSuffix(suffix);
  return `${root[0]}${root.length > 1 ? `<span class="acc">${root.slice(1)}</span>` : ''}${m}${q ? `<sup>${q}</sup>` : ''}`;
}

/** Chord chart: nut at the top, low E on the left. Roots are squares in the chord's colour. */
function chartSVG(shape: PlacedShape, kind: Kind, w: number, fingers: boolean): string {
  const top = w * 0.17, left = w * 0.13, right = w * 0.07, gs = (w - left - right) / 5, fh = gs * 1.18;
  const frets = 5, gridH = fh * frets, h = top + gridH + (fingers ? w * 0.13 : w * 0.05);
  const r = gs * 0.4, line = 'rgb(244 240 232 / 0.45)';
  const base = shape.baseFret;
  let o = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
  for (let i = 0; i < 6; i++) o += `<rect x="${left + i * gs - 0.6}" y="${top}" width="1.2" height="${gridH}" fill="${line}"/>`;
  for (let f = 0; f <= frets; f++) {
    const nut = f === 0 && base === 1;
    o += `<rect x="${left - 0.6}" y="${top + f * fh - (nut ? 2.5 : 0.6)}" width="${gs * 5 + 1.2}" height="${nut ? 5 : 1.2}" rx="${nut ? 1.5 : 0}" fill="${nut ? 'var(--text)' : line}"/>`;
  }
  if (base > 1) o += `<text x="${left - gs * 0.45}" y="${top + fh * 0.62}" text-anchor="end" font-family="DM Sans" font-weight="500" font-size="${Math.max(10, w * 0.075)}" fill="var(--muted)">${base}</text>`;
  if (shape.barre) {
    const [bf, from, to] = shape.barre;
    const y = top + (bf - base + 0.5) * fh;
    o += `<rect x="${left + from * gs - r}" y="${y - r}" width="${(to - from) * gs + 2 * r}" height="${2 * r}" rx="${r}" fill="var(--text)"/>`;
  }
  shape.frets.forEach((f, i) => {
    const x = left + i * gs, root = shape.roots.includes(i), col = root ? KIND_DOT[kind] : 'var(--text)';
    const yTop = top - fh * 0.55;
    if (f < 0) { const d = r * 0.6; o += `<path d="M${x - d} ${yTop - d}L${x + d} ${yTop + d}M${x + d} ${yTop - d}L${x - d} ${yTop + d}" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"/>`; return; }
    if (f === 0) { o += root ? `<rect x="${x - r * 0.62}" y="${yTop - r * 0.62}" width="${r * 1.24}" height="${r * 1.24}" rx="2" fill="none" stroke="${col}" stroke-width="1.8"/>` : `<circle cx="${x}" cy="${yTop}" r="${r * 0.62}" fill="none" stroke="var(--text)" stroke-width="1.6"/>`; return; }
    const y = top + (f - base + 0.5) * fh;
    const onBarre = shape.barre && f === shape.barre[0] && i >= shape.barre[1] && i <= shape.barre[2];
    if (root) o += `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.3}" fill="${col}"/>`;
    else if (!onBarre) o += `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--text)"/>`;
    const showFinger = fingers && shape.fingers[i] && (!onBarre || root || i === shape.barre![1]);
    if (showFinger) o += `<text x="${x}" y="${y + r * 0.36}" text-anchor="middle" font-family="DM Sans" font-weight="500" font-size="${r * 1.05}" fill="var(--ink)">${shape.fingers[i]}</text>`;
  });
  if (fingers) STRING_NAMES.forEach((n, i) => (o += `<text x="${left + i * gs}" y="${h - 2}" text-anchor="middle" font-family="DM Sans" font-size="${Math.max(9, w * 0.055)}" fill="var(--muted)">${n}</text>`));
  return o + '</svg>';
}

function renderChord(): void {
  $('sub').textContent = `${vibe().name} · ${formatKey(key)} · ${tempo} bpm`;
}

// ---------- Carousel ----------

let selected = 0;
let lastRel: number[] = [];
const wide = () => window.innerWidth >= 900;
const SIZES = () => (wide() ? { now: 290, other: 170, gap: 32 } : { now: 170, other: 104, gap: 14 });

function renderPanel(): void {
  const list = $('carousel');
  list.innerHTML = slots
    .map((s, i) => {
      const q = basicQuality(s.chord);
      const shape = q !== null ? basicShape(s.chord, q) : null;
      return `<li class="card" data-i="${i}" role="button" tabindex="0" aria-label="${spokenChord(s.chord)}">
        <span class="chart" data-now="${shape ? chartSVG(shape, s.kind, SIZES().now, true).replace(/"/g, '&quot;') : ''}" data-other="${shape ? chartSVG(shape, s.kind, SIZES().other, false).replace(/"/g, '&quot;') : ''}"></span>
        <span class="cname">${chordHTML(s.chord)}</span>
        <span class="bar"><i></i></span></li>`;
    })
    .join('');
  list.querySelectorAll<HTMLElement>('.card').forEach((el) => {
    const go = () => {
      const i = Number(el.dataset.i);
      if (!isPlaying()) selected = i;
      void engine.previewChord(slots[i]!.chord);
      layout(true);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go()));
  });
  lastRel = [];
  if (!isPlaying()) selected = 0;
  $('settings').innerHTML = `
    <button class="chip grow" id="vibe">${vibe().name}<svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="m9 6 6 6-6 6"/></svg></button>
    <button class="chip" id="key" aria-pressed="${keyHeld}">${formatKey(key)}${keyHeld ? '<span class="held">HELD</span>' : ''}</button>
    <button class="chip" id="tempo" aria-pressed="${tempoHeld}" style="min-width:96px;justify-content:center">${tempo} <span class="k">BPM</span>${tempoHeld ? '<span class="held">HELD</span>' : ''}</button>`;
  $('vibe').addEventListener('click', () => {
    vibeIndex = (vibeIndex + 1) % VIBES.length;
    roll(true);
  });
  $('key').addEventListener('click', () => ((keyHeld = !keyHeld), renderPanel()));
  $('tempo').addEventListener('click', () => ((tempoHeld = !tempoHeld), renderPanel()));
  lastSlot = -1;
  renderChord();
  layout(false);
}

const isPlaying = () => { const p = engine.playhead().phase; return p === 'playing' || p === 'count-in'; };

/** Positions every card relative to the current chord. Cards that wrap around the loop jump without animating. */
function layout(animate: boolean): void {
  const n = slots.length;
  const p = engine.playhead();
  const cur = isPlaying() && p.slotIndex !== null ? p.slotIndex : selected;
  const behind = n >= 5 ? 2 : n >= 3 ? 1 : 0;
  const { now, other, gap } = SIZES();
  document.querySelectorAll<HTMLElement>('.card').forEach((el, i) => {
    let rel = (((i - cur) % n) + n) % n;
    if (rel >= n - behind) rel -= n;
    const visible = rel >= -2 && rel <= 3;
    const dist = rel === 0 ? 0 : Math.sign(rel) * (now / 2 + gap + other / 2 + (Math.abs(rel) - 1) * (other + gap));
    const wrapped = lastRel[i] !== undefined && Math.abs(lastRel[i]! - rel) > 1;
    if (!animate || wrapped) el.style.transition = 'none';
    el.style.transform = `translate(calc(-50% + ${dist}px), -50%)`;
    el.classList.toggle('now', rel === 0);
    el.classList.toggle('past', rel < 0);
    el.classList.toggle('hidden', !visible);
    el.setAttribute('aria-current', String(rel === 0));
    const chart = el.querySelector<HTMLElement>('.chart')!;
    const want = rel === 0 ? 'now' : 'other';
    if (chart.dataset.shown !== want) { chart.innerHTML = chart.dataset[want] ?? ''; chart.dataset.shown = want; }
    (el.querySelector('.cname') as HTMLElement).style.fontSize = rel === 0 ? (wide() ? '52px' : '36px') : (wide() ? '28px' : '20px');
    if (!animate || wrapped) { void el.offsetWidth; el.style.transition = ''; }
    lastRel[i] = rel;
  });
}
window.addEventListener('resize', () => renderPanel());

let lastCur = -2;
function updateLoop(slotIndex: number | null, playing: boolean): void {
  const cur = playing && slotIndex !== null ? slotIndex : selected;
  if (cur !== lastCur) {
    lastCur = cur;
    layout(true);
  }
  // Progress through the current chord, on its card.
  const p = engine.playhead();
  const bar = document.querySelector<HTMLElement>('.card.now .bar i');
  if (!bar) return;
  if (!playing || slotIndex === null || p.phase !== 'playing') { bar.style.width = '0%'; return; }
  let start = 0;
  for (let i = 0; i < slotIndex; i++) start += slots[i]!.bars * 4;
  const beats = slots[slotIndex]!.bars * 4;
  const elapsed = p.bar * 4 + p.beat - start + 1;
  bar.style.width = `${Math.max(0, Math.min(1, elapsed / beats)) * 100}%`;
}

const PLAY = '<svg class="i" viewBox="0 0 24 24"><path d="M7 4.5v15L19.5 12z" fill="currentColor" stroke="none"/></svg>';
const PAUSE = '<svg class="i" viewBox="0 0 24 24"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z" fill="currentColor" stroke="none"/></svg>';
$('play').innerHTML = PLAY;
engine.subscribe((e) => {
  if (e.type !== 'state') return;
  const active = e.state === 'playing' || e.state === 'count-in';
  $('play').innerHTML = active ? PAUSE : PLAY;
  $('play').setAttribute('aria-label', active ? 'Pause' : 'Play');
});
$('play').addEventListener('click', () => void engine.togglePlay());
$('reroll').addEventListener('click', () => roll(true));
$('back').addEventListener('click', back);
for (const m of ['lines', 'dots'] as const) {
  $(m).addEventListener('click', () => {
    mode = m;
    $('lines').setAttribute('aria-pressed', String(m === 'lines'));
    $('dots').setAttribute('aria-pressed', String(m === 'dots'));
  });
}
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); void engine.togglePlay(); }
  if (e.key === 'r' || e.key === 'R') roll(true);
});

// Start: Neo-soul in D major, already generated (the app is never empty).
engine.setCountIn(false);
roll(false);
history.length = 0;
requestAnimationFrame(frame);

// Exposed for the screen-recording script.
(window as unknown as { __viz: unknown }).__viz = { engine, roll, setMode: (m: 'lines' | 'dots') => $(m).click(), setVibe: (i: number) => ((vibeIndex = i), roll(true)) };
