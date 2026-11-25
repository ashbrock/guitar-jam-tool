// Exploration: full-screen generative visuals driven by the music. Not wired into the app.
//
// Concept, "sympathetic strings": the screen fills with strings whose wave shapes are built from the
// current chord's interval ratios (major 1 : 5/4 : 3/2, minor 1 : 6/5 : 3/2…), so the pattern is the
// harmony. Everything is continuous: chord changes crossfade between harmonic layers, the beat is a
// smooth swell locked to the audio clock, and the visuals only appear while the music plays.
// No AI: plain canvas code, no dependencies.
import { createEngine } from '../../../src/audio/engine';
import { clampTempo } from '../../../src/audio/transport';
import { VIBES } from '../../../src/data/vibes/index';
import { chordParts, parseChord, spokenChord, type Chord } from '../../../src/theory/chords';
import { resolveDegreeChord } from '../../../src/theory/degrees';
import { generate, type DegreeSlot } from '../../../src/theory/generator';
import { KEY_TONICS, formatKey, type Key, type Mode } from '../../../src/theory/keys';
import { pc } from '../../../src/theory/notes';
import { newSeed } from '../../../src/theory/random';
import { basicQuality, basicShape, type PlacedShape } from '../../../src/theory/shapes';
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
let clickOn = false; // off by default
let degreeSlots: DegreeSlot[] = [];
let slots: Slot[] = [];
const history: { vibeIndex: number; key: Key; tempo: number; degreeSlots: DegreeSlot[] }[] = [];

const vibe = (): Vibe => VIBES[vibeIndex]!;
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

function applySound(): void {
  engine.setParts({ chords: true, bass: true, click: clickOn, drums: false });
}

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
  renderAll();
}

function back(): void {
  const h = history.pop();
  if (!h) return;
  ({ vibeIndex, key, tempo, degreeSlots } = h);
  const v = vibe();
  engine.setFeel({ groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing });
  engine.setTempo(tempo);
  resolve();
  renderAll();
}

// ---------- Visual language per vibe ----------

interface Look {
  major: [string, string];
  minor: [string, string];
  lines: number;
  width: number;
  amp: number;
  speed: number;
  cycles: number;
  vertical: boolean;
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
  const third = s.kind === 'major' ? 5 / 4 : s.kind === 'minor' || s.kind === 'dim' ? 6 / 5 : s.chord.spec.third === 'sus2' ? 9 / 8 : 4 / 3;
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
let W = 0, H = 0;

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => (resize(), renderAll()));
resize();

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb = (c: number[]) => `rgb(${c.map(Math.round).join(' ')})`;
/** Frame-rate–independent easing toward a target. */
const approach = (cur: number, target: number, dt: number, perSecond: number) => cur + (target - cur) * (1 - Math.exp(-perSecond * dt));

// Harmonic layers: a chord change adds a layer that fades in while the others fade out, so the
// picture never snaps, even when chords change faster than a crossfade.
interface Layer { ratios: number[]; w: number; target: number }
let layers: Layer[] = [{ ratios: [1, 5 / 4, 3 / 2], w: 1, target: 1 }];
let colA = hex('#ff8a3d'), colB = hex('#ff4d7e');
let base = 1.4, baseTarget = 1.4;
let presence = 0; // 0 = hidden (stopped), 1 = fully visible (playing)
let lastSlot: number | null = -2;
let phase = 0;
let lastFrame = performance.now();

function waveOf(rs: number[], x: number, line: number, t: number): number {
  let sum = 0, norm = 0;
  for (let j = 0; j < rs.length; j++) {
    const r = rs[j]!;
    const w = 1 / (1 + j * 0.6);
    sum += w * Math.sin(2 * Math.PI * base * r * x + t * r * (1 + 0.13 * j) + line * 0.33 * r);
    norm += w;
  }
  return sum / norm;
}

function sample(x: number, line: number, t: number): number {
  let v = 0, wsum = 0;
  for (const l of layers) {
    if (l.w < 0.001) continue;
    v += l.w * waveOf(l.ratios, x, line, t);
    wsum += l.w;
  }
  return wsum ? v / wsum : 0;
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const look = LOOKS[vibe().id] ?? LOOKS['neo-soul']!;
  const p = engine.playhead();
  const playing = p.phase === 'playing';
  const slot = p.slotIndex !== null ? slots[p.slotIndex] : slots[0];
  const still = reduced.matches;

  // Chord change: crossfade to the new harmony.
  if (playing && p.slotIndex !== lastSlot) {
    lastSlot = p.slotIndex;
    for (const l of layers) l.target = 0;
    layers.push({ ratios: ratios(slot), w: still ? 1 : 0, target: 1 });
    baseTarget = look.cycles * (0.85 + (slot ? pc(slot.chord.root) : 0) / 40);
  }
  for (const l of layers) l.w = still ? l.target : approach(l.w, l.target, dt, 3.5);
  layers = layers.filter((l) => l.target > 0 || l.w > 0.002);
  base = approach(base, baseTarget, dt, 1.5);

  const [ta, tb] = slot && (slot.kind === 'minor' || slot.kind === 'dim') ? look.minor : look.major;
  const A = hex(ta), B = hex(tb);
  colA = colA.map((c, i) => approach(c, A[i]!, dt, 2.5));
  colB = colB.map((c, i) => approach(c, B[i]!, dt, 2.5));

  // The visuals belong to the music: they fade in on play and out on pause.
  presence = approach(presence, playing ? 1 : 0, dt, playing ? 2.2 : 3);
  const bpm = engine.tempo;
  if (!still) phase += dt * (bpm / 90) * 2.2 * look.speed * (0.3 + 0.7 * presence);
  const t = phase + look.sway * Math.sin(phase * 1.7) * 0.6;

  // Beat: a smooth swell locked to the audio clock (a cosine over each beat, continuous at the beat line).
  const swell = still || !playing ? 0 : 0.12 * (0.5 + 0.5 * Math.cos(2 * Math.PI * p.beatFraction));

  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, W, H);
  if (presence > 0.003) draw(look, t, swell);
  updateCarousel(p);
  requestAnimationFrame(frame);
}

function draw(look: Look, t: number, swell: number): void {
  const grad = look.vertical ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, rgb(colA));
  grad.addColorStop(1, rgb(colB));
  const n = look.lines;
  const along = look.vertical ? H : W;
  const across = look.vertical ? W : H;
  const spacing = across / (n + 1);
  const a = spacing * look.amp * (1 + swell);

  if (mode === 'lines') {
    ctx.strokeStyle = grad;
    ctx.lineWidth = look.width;
    ctx.lineCap = 'round';
    const step = 6;
    for (let i = 0; i < n; i++) {
      const edge = 1 - Math.abs((i + 1) / (n + 1) - 0.5) * 1.1;
      ctx.globalAlpha = (0.35 + 0.65 * edge) * presence;
      ctx.beginPath();
      const c0 = spacing * (i + 1);
      for (let s = 0; s <= along + step; s += step) {
        const d = sample(s / along, i, t) * a * (0.55 + 0.45 * Math.sin((Math.PI * s) / along));
        const x = look.vertical ? c0 + d : s;
        const y = look.vertical ? s : c0 + d;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = grad;
    const gap = 14;
    for (let cy = gap / 2; cy < H; cy += gap) {
      for (let cx = gap / 2; cx < W; cx += gap) {
        const al = look.vertical ? cy : cx;
        const c = look.vertical ? cx : cy;
        const v = sample(al / along, c / spacing, t);
        const e = Math.abs(v) ** 0.7;
        const size = 1.5 + 6 * e * (0.75 + swell);
        const edge = 1 - Math.abs(c / across - 0.5) * 0.9;
        ctx.globalAlpha = (0.18 + 0.82 * e) * (0.55 + 0.45 * edge) * presence;
        const d = v * a * 0.5;
        const x = look.vertical ? cx + d : cx;
        const y = look.vertical ? cy : cy + d;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- Chord charts ----------

const $ = (id: string) => document.getElementById(id)!;

function splitSuffix(suffix: string): [string, string] {
  return suffix.startsWith('m') && !suffix.startsWith('maj') ? ['m', suffix.slice(1)] : ['', suffix];
}
function chordHTML(c: Chord): string {
  const { root, suffix } = chordParts(c);
  const [m, q] = splitSuffix(suffix);
  return `${root[0]}${root.length > 1 ? `<span class="acc">${root.slice(1)}</span>` : ''}${m}${q ? `<sup>${q}</sup>` : ''}`;
}

/** A light, monochrome chord chart: nut at the top, low E on the left. Roots are small squares, other notes dots. */
function chartSVG(shape: PlacedShape, w: number): string {
  const top = w * 0.16, left = w * 0.12, right = w * 0.06, gs = (w - left - right) / 5, fh = gs * 1.22;
  const frets = 5, gridH = fh * frets, h = top + gridH + w * 0.03;
  const r = gs * 0.24, line = 'rgb(244 240 232 / 0.38)', ink = 'var(--text)';
  const base = shape.baseFret;
  let o = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
  for (let i = 0; i < 6; i++) o += `<rect x="${left + i * gs - 0.5}" y="${top}" width="1" height="${gridH}" fill="${line}"/>`;
  for (let f = 0; f <= frets; f++) {
    const nut = f === 0 && base === 1;
    o += `<rect x="${left - 0.5}" y="${top + f * fh - (nut ? 1.5 : 0.5)}" width="${gs * 5 + 1}" height="${nut ? 3 : 1}" rx="${nut ? 1 : 0}" fill="${nut ? ink : line}"/>`;
  }
  if (base > 1) o += `<text x="${left - gs * 0.4}" y="${top + fh * 0.62}" text-anchor="end" font-family="DM Sans" font-size="${Math.max(10, w * 0.07)}" fill="var(--muted)">${base}</text>`;
  if (shape.barre) {
    const [bf, from, to] = shape.barre;
    const y = top + (bf - base + 0.5) * fh;
    o += `<rect x="${left + from * gs - r}" y="${y - r * 0.8}" width="${(to - from) * gs + 2 * r}" height="${r * 1.6}" rx="${r * 0.8}" fill="${ink}"/>`;
  }
  shape.frets.forEach((f, i) => {
    const x = left + i * gs, root = shape.roots.includes(i);
    const yTop = top - fh * 0.5, s = r * 0.7;
    if (f < 0) { o += `<path d="M${x - s} ${yTop - s}L${x + s} ${yTop + s}M${x + s} ${yTop - s}L${x - s} ${yTop + s}" stroke="var(--muted)" stroke-width="1.2" stroke-linecap="round"/>`; return; }
    if (f === 0) { o += root ? `<rect x="${x - s}" y="${yTop - s}" width="${2 * s}" height="${2 * s}" fill="none" stroke="${ink}" stroke-width="1.2"/>` : `<circle cx="${x}" cy="${yTop}" r="${s}" fill="none" stroke="${ink}" stroke-width="1.2"/>`; return; }
    const y = top + (f - base + 0.5) * fh;
    const onBarre = shape.barre && f === shape.barre[0] && i >= shape.barre[1] && i <= shape.barre[2];
    if (root) o += `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="1" fill="${ink}"/>`;
    else if (!onBarre) o += `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`;
  });
  return o + '</svg>';
}

// ---------- Carousel (phone) / row (desktop) ----------

const wide = () => window.innerWidth >= 900;
let selected = 0;
let lastRel: number[] = [];
let lastCur = -2;
let starts: number[] = [];

function chartWidth(): number {
  if (!wide()) return 156;
  // Desktop: every chord in view, as large as the row allows.
  const n = Math.max(1, slots.length);
  return Math.min(190, Math.floor((Math.min(window.innerWidth, 1400) - 120 - (n - 1) * 20) / n) - 28);
}

function renderAll(): void {
  starts = [];
  let t = 0;
  for (const s of slots) { starts.push(t); t += s.bars * 4; }
  const cw = chartWidth();
  const list = $('carousel');
  list.style.setProperty('--card-w', `${cw + 28}px`);
  list.innerHTML = slots
    .map((s, i) => {
      const q = basicQuality(s.chord);
      const shape = q !== null ? basicShape(s.chord, q) : null;
      return `<li class="card" data-i="${i}" role="button" tabindex="0" aria-label="${spokenChord(s.chord)}">
        ${shape ? chartSVG(shape, cw) : ''}<span class="cname">${chordHTML(s.chord)}</span><span class="bar"><i></i></span></li>`;
    })
    .join('');
  list.querySelectorAll<HTMLElement>('.card').forEach((el) => {
    const go = () => {
      const i = Number(el.dataset.i);
      if (engine.playhead().phase !== 'playing') selected = i;
      void engine.previewChord(slots[i]!.chord);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go()));
  });
  lastRel = [];
  lastCur = -2;
  if (engine.playhead().phase !== 'playing') selected = 0;

  $('settings').innerHTML = `
    <button class="chip grow" id="vibe">${vibe().name}<svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="m9 6 6 6-6 6"/></svg></button>
    <button class="chip" id="key" aria-pressed="${keyHeld}">${formatKey(key)}${keyHeld ? '<span class="held">HELD</span>' : ''}</button>
    <button class="chip" id="tempo" aria-pressed="${tempoHeld}" style="min-width:96px;justify-content:center">${tempo} <span class="k">BPM</span>${tempoHeld ? '<span class="held">HELD</span>' : ''}</button>`;
  $('vibe').addEventListener('click', () => { vibeIndex = (vibeIndex + 1) % VIBES.length; roll(true); });
  $('key').addEventListener('click', () => ((keyHeld = !keyHeld), renderAll()));
  $('tempo').addEventListener('click', () => ((tempoHeld = !tempoHeld), renderAll()));
}

/** Places cards around the current chord. Phone: a carousel. Desktop: all chords in one row. */
function layout(cur: number, animate: boolean): void {
  const n = slots.length;
  const behind = n >= 5 ? 2 : n >= 3 ? 1 : 0;
  const cw = chartWidth() + 28;
  document.querySelectorAll<HTMLElement>('.card').forEach((el, i) => {
    let x: number, scale: number, rel: number;
    if (wide()) {
      rel = i - cur;
      x = (i - (n - 1) / 2) * (cw + 20);
      scale = rel === 0 ? 1 : 0.9;
    } else {
      rel = (((i - cur) % n) + n) % n;
      if (rel >= n - behind) rel -= n;
      const small = 0.6, gap = 14;
      const otherW = cw * small;
      x = rel === 0 ? 0 : Math.sign(rel) * (cw / 2 + gap + otherW / 2 + (Math.abs(rel) - 1) * (otherW + gap));
      scale = rel === 0 ? 1 : small;
    }
    const wrapped = lastRel[i] !== undefined && Math.abs(lastRel[i]! - rel) > 1 && !wide();
    if (!animate || wrapped) el.style.transition = 'none';
    el.style.transform = `translate(calc(-50% + ${x}px), -50%) scale(${scale})`;
    el.classList.toggle('now', rel === 0);
    el.classList.toggle('past', rel < 0);
    el.classList.toggle('hidden', !wide() && (rel < -2 || rel > 3));
    el.setAttribute('aria-current', String(rel === 0));
    if (!animate || wrapped) { void el.offsetWidth; el.style.transition = ''; }
    lastRel[i] = rel;
  });
}

function updateCarousel(p: ReturnType<typeof engine.playhead>): void {
  const playing = p.phase === 'playing' && p.slotIndex !== null;
  const cur = playing ? p.slotIndex! : selected;
  if (cur !== lastCur) {
    layout(cur, lastCur !== -2);
    lastCur = cur;
  }
  // Smooth progress through the current chord, from the audio clock.
  const bar = document.querySelector<HTMLElement>('.card.now .bar i');
  if (!bar) return;
  if (!playing) { bar.style.width = '0%'; return; }
  const beats = slots[cur]!.bars * 4;
  const elapsed = p.bar * 4 + p.beat + p.beatFraction - starts[cur]!;
  bar.style.width = `${Math.max(0, Math.min(1, elapsed / beats)) * 100}%`;
}

// ---------- Controls ----------

const PLAY = '<svg class="i" viewBox="0 0 24 24"><path d="M7 4.5v15L19.5 12z" fill="currentColor" stroke="none"/></svg>';
const PAUSE = '<svg class="i" viewBox="0 0 24 24"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z" fill="currentColor" stroke="none"/></svg>';
$('play').innerHTML = PLAY;
engine.subscribe((e) => {
  if (e.type !== 'state') return;
  const active = e.state === 'playing' || e.state === 'count-in';
  $('play').innerHTML = active ? PAUSE : PLAY;
  $('play').setAttribute('aria-label', active ? 'Pause' : 'Play');
  if (!active) { lastSlot = -2; lastCur = -2; }
});
$('play').addEventListener('click', () => void engine.togglePlay());
$('reroll').addEventListener('click', () => roll(true));
$('back').addEventListener('click', back);
$('click').addEventListener('click', () => {
  clickOn = !clickOn;
  $('click').setAttribute('aria-pressed', String(clickOn));
  applySound();
});
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

// Start: Neo-soul in D major, already generated (the app is never empty). Click off, no count-in.
engine.setCountIn(false);
applySound();
roll(false);
history.length = 0;
requestAnimationFrame(frame);

(window as unknown as { __viz: unknown }).__viz = { engine, roll, setMode: (m: 'lines' | 'dots') => $(m).click(), setVibe: (i: number) => ((vibeIndex = i), roll(true)) };
