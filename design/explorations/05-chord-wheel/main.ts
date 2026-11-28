// Exploration: a chord wheel for Jam. Not wired into the app.
//
// Inner ring: the key's seven chords around a circle in fifths order (IV I V ii vi iii vii°, or
// ♭VI ♭III ♭VII iv i v ii° in minor), the tonic at the top, so neighbours are a fifth apart.
// Outer ring: the chords this vibe borrows from outside the key (secondary dominants, chords from the
// parallel key, passing chords), each sitting outside the chord it most often leads to, taken from the
// vibe's own transition weights. So the outer ring reads as "ways into" each chord.
// Chords the progression uses get a ring; the playing or tapped one is solid white. The progression
// draws its shape in the centre: verse solid, chorus dashed; borrowed chords as hollow points.
import { createEngine } from '../../../src/audio/engine';
import { VIBES, vibeById } from '../../../src/data/vibes/index';
import { formatChord, parseChord, spokenChord, type Chord } from '../../../src/theory/chords';
import { resolveDegreeChord } from '../../../src/theory/degrees';
import { KEY_TONICS, formatKey, type Key, type Mode } from '../../../src/theory/keys';
import { pc, type Note } from '../../../src/theory/notes';
import { newSeed } from '../../../src/theory/random';
import { simplify, type SimpleChord } from '../../../src/theory/simplify';
import { generateSong, type Section, type Song } from '../../../src/theory/song';
import type { GeneratorParams } from '../../../src/theory/vibe';

// ---------- The wheel's chords (pure) ----------

/** The key's seven chords in fifths order, as degree + triad quality. */
const DIATONIC: Record<Mode, { degree: string; quality: string }[]> = {
  major: [
    { degree: 'IV', quality: '' },
    { degree: 'I', quality: '' },
    { degree: 'V', quality: '' },
    { degree: 'ii', quality: 'm' },
    { degree: 'vi', quality: 'm' },
    { degree: 'iii', quality: 'm' },
    { degree: 'vii', quality: 'dim' },
  ],
  minor: [
    { degree: 'bVI', quality: '' },
    { degree: 'bIII', quality: '' },
    { degree: 'bVII', quality: '' },
    { degree: 'iv', quality: 'm' },
    { degree: 'i', quality: 'm' },
    { degree: 'v', quality: 'm' },
    { degree: 'ii', quality: 'dim' },
  ],
};
const TONIC_INDEX: Record<Mode, number> = { major: 1, minor: 4 };

interface Borrowed {
  degree: string;
  /** The vibe's favourite quality for it. */
  quality: string;
  /** Index (in DIATONIC order) of the key chord it leads to: it sits outside that one. */
  target: number;
}

/**
 * The vibe's out-of-key chords for a mode, each placed outside the key chord it most often moves to
 * (from the vibe's transition weights). If it never moves straight to a key chord, it sits by the tonic.
 */
export function borrowedChords(params: GeneratorParams, mode: Mode): Borrowed[] {
  const rules = params.modes[mode];
  const inKey = DIATONIC[mode].map((d) => d.degree);
  return Object.keys(rules.vocabulary)
    .filter((d) => !inKey.includes(d))
    .map((degree) => {
      const qualities = Object.entries(rules.vocabulary[degree]!).sort((a, b) => b[1] - a[1]);
      const moves = Object.entries(rules.transitions[degree] ?? {})
        .filter(([to]) => inKey.includes(to))
        .sort((a, b) => b[1] - a[1]);
      const target = moves.length ? inKey.indexOf(moves[0]![0]) : TONIC_INDEX[mode];
      return { degree, quality: qualities[0]![0], target };
    });
}

const fam = (k: string) => (k === 'dim' ? 'dim' : k === 'minor' ? 'minor' : 'major');
const numeral = (d: string, q = '') => d.replace(/b/g, '♭').replace('#', '♯') + (q === 'dim' || q === 'dim7' || q === 'm7b5' ? '°' : '');

// ---------- State ----------

const engine = createEngine();
let vibeId = 'neo-soul';
let key: Key = { tonic: { letter: 'D', acc: 0 }, mode: 'major' };
let song: Song = { verse: [], chorus: [] };
/** What's lit: the playing chord, or the last one tapped (root pitch class + family). */
let lit: string | null = null;

const resolve = (degree: string, quality: string, bass?: string): SimpleChord => simplify(resolveDegreeChord(degree, quality, key, bass));
const songChords = () => ({
  verse: song.verse.map((s) => resolve(s.degree, s.quality, s.bassDegree)),
  chorus: song.chorus.map((s) => resolve(s.degree, s.quality, s.bassDegree)),
});
const playList = () => {
  const c = songChords();
  return [...c.verse, ...c.verse, ...c.chorus, ...c.chorus];
};
const idOf = (c: SimpleChord) => `${pc(c.chord.root)}:${fam(c.kind)}`;

function reroll(): void {
  const v = vibeById(vibeId)!;
  song = generateSong({ params: v.params, mode: key.mode, seed: newSeed() });
  engine.setFeel({ groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing });
  engine.setTempo(v.playback.tempo.default);
  sendSong();
}
function sendSong(): void {
  const bars = [...song.verse, ...song.verse, ...song.chorus, ...song.chorus].map((s) => s.bars);
  engine.setProgression(playList().map((c, i) => ({ chord: c.chord, bars: bars[i]! as 1 | 2 })), { fromTop: true });
  lit = null;
  render();
}

// ---------- Geometry ----------

const C = 200;
const pt = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r1, a0);
  const [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1);
  const [x3, y3] = pt(r0, a0);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ---------- Rendering ----------

const svg = document.getElementById('wheel')!;
/** Where each chord on the wheel sits (by id), for the path in the centre. */
let spots = new Map<string, { a: number; outer: boolean }>();

function render(): void {
  const c = songChords();
  const used = new Set([...c.verse, ...c.chorus].map(idOf));
  const inner = DIATONIC[key.mode];
  const outer = borrowedChords(vibeById(vibeId)!.params, key.mode);
  const n = inner.length;
  const step = (2 * Math.PI) / n;
  const angle = (i: number) => -Math.PI / 2 + (i - TONIC_INDEX[key.mode]) * step;
  spots = new Map();
  let cells = '';
  let text = '';
  let outlines = '';

  const draw = (d: string, ch: SimpleChord, extraCls: string, label: string) => {
    const id = idOf(ch);
    const now = lit === id;
    const inSong = used.has(id);
    if (inSong) outlines += `<path d="${d}" class="outline" />`;
    cells += `<path d="${d}" class="cell ${extraCls}${now ? ' now' : ''}" data-r="${esc(formatChord(ch.chord))}" data-id="${id}" role="button" tabindex="0" aria-label="${esc(label + (inSong ? ', in the progression' : ''))}"></path>`;
    return now;
  };

  inner.forEach((s, i) => {
    const ch = resolve(s.degree, s.quality);
    const a0 = angle(i) - step / 2;
    const a1 = angle(i) + step / 2;
    const now = draw(sector(58, 132, a0, a1), ch, '', `${spokenChord(ch.chord)}, ${numeral(s.degree, s.quality)}`);
    const [tx, ty] = pt(97, angle(i));
    text += `<text x="${tx}" y="${ty - 7}" font-size="21" font-weight="500" class="${now ? 't-now' : ''}">${esc(formatChord(ch.chord))}</text>`;
    text += `<text x="${tx}" y="${ty + 14}" font-size="10.5" class="${now ? 't-now' : 't-sub'}">${esc(numeral(s.degree, s.quality))}</text>`;
    spots.set(idOf(ch), { a: angle(i), outer: false });

    // The borrowed chords that lead to this one, split across the outer wedge.
    const mine = outer.filter((b) => b.target === i);
    if (!mine.length) {
      cells += `<path d="${sector(136, 194, a0, a1)}" class="cell empty" aria-hidden="true"></path>`;
      return;
    }
    mine.forEach((b, j) => {
      const b0 = a0 + ((a1 - a0) * j) / mine.length;
      const b1 = a0 + ((a1 - a0) * (j + 1)) / mine.length;
      const bc = resolve(b.degree, b.quality);
      const bn = draw(sector(136, 194, b0, b1), bc, 'out', `${spokenChord(bc.chord)}, ${numeral(b.degree, b.quality)}, borrowed, leads to ${formatChord(ch.chord)}`);
      const [bx, by] = pt(165, (b0 + b1) / 2);
      const size = mine.length > 2 ? 12.5 : 14;
      text += `<text x="${bx}" y="${by - 6}" font-size="${size}" font-weight="500" class="${bn ? 't-now' : ''}">${esc(formatChord(bc.chord))}</text>`;
      text += `<text x="${bx}" y="${by + 10}" font-size="9.5" class="${bn ? 't-now' : 't-sub'}">${esc(numeral(b.degree, b.quality))}</text>`;
      if (!spots.has(idOf(bc))) spots.set(idOf(bc), { a: (b0 + b1) / 2, outer: true });
    });
  });

  svg.innerHTML = cells + outlines + text + paths(c);
  lists(c);
}

/** The progression's shape in the centre: a point at each chord's angle, verse solid, chorus dashed. */
function paths(c: Record<Section, SimpleChord[]>): string {
  let out = '';
  for (const sec of ['verse', 'chorus'] as Section[]) {
    const pts = c[sec].map((x) => spots.get(idOf(x))).filter((p): p is { a: number; outer: boolean } => !!p);
    if (pts.length < 2) continue;
    const r = sec === 'verse' ? 46 : 36;
    const xy = pts.map((p) => [...pt(r, p.a), p.outer] as const);
    out += `<polyline class="path ${sec}" points="${[...xy, xy[0]!].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" />`;
    for (const [x, y, o] of xy) out += `<circle class="dot${o ? ' hollow' : ''}" cx="${x}" cy="${y}" r="3" />`;
  }
  return out;
}

function lists(c: Record<Section, SimpleChord[]>): void {
  const p = engine.playhead();
  const playing = p.phase === 'playing' ? p.slotIndex : null;
  const v = c.verse.length;
  const ch = c.chorus.length;
  const nowAt = (sec: Section, i: number) =>
    playing !== null && (sec === 'verse' ? playing === i || playing === i + v : playing === 2 * v + i || playing === 2 * v + ch + i);
  const row = (sec: Section) =>
    `<span class="label">${sec === 'verse' ? 'Verse ×2' : 'Chorus ×2'}</span>` +
    c[sec].map((x, i) => `<button class="chip${nowAt(sec, i) ? ' now' : ''}" data-r="${esc(formatChord(x.chord))}" data-id="${idOf(x)}">${esc(formatChord(x.chord))}</button>`).join('');
  document.getElementById('verse')!.innerHTML = row('verse');
  document.getElementById('chorus')!.innerHTML = row('chorus');
}

// ---------- Interaction ----------

const parse = (s: string): Chord => {
  const r = parseChord(s.replace(/♯/g, '#').replace(/♭/g, 'b'));
  if (!r.ok) throw new Error(s);
  return r.chord;
};
function tap(el: Element | null): void {
  const t = el?.closest('[data-r]') as HTMLElement | SVGElement | null;
  if (!t || !t.dataset.r) return;
  if (engine.playhead().phase === 'playing') engine.pause();
  lit = t.dataset.id ?? null;
  void engine.previewChord(parse(t.dataset.r));
  render();
}
svg.addEventListener('click', (e) => tap(e.target as Element));
svg.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  tap(e.target as Element);
});
document.querySelector('.lists')!.addEventListener('click', (e) => tap(e.target as Element));

const keySel = document.getElementById('key') as HTMLSelectElement;
for (const m of ['major', 'minor'] as const)
  for (const t of KEY_TONICS[m]) keySel.insertAdjacentHTML('beforeend', `<option value="${m}:${t.letter}:${t.acc}">${esc(formatKey({ tonic: t, mode: m }))}</option>`);
keySel.value = 'major:D:0';
keySel.addEventListener('change', () => {
  const [m, l, a] = keySel.value.split(':');
  const modeChanged = m !== key.mode;
  key = { tonic: { letter: l as Note['letter'], acc: Number(a) }, mode: m as Mode };
  if (modeChanged) reroll();
  else sendSong();
});
const vibeSel = document.getElementById('vibe') as HTMLSelectElement;
for (const v of VIBES) vibeSel.insertAdjacentHTML('beforeend', `<option value="${v.id}">${esc(v.name)}</option>`);
vibeSel.addEventListener('change', () => {
  vibeId = vibeSel.value;
  reroll();
});
document.getElementById('reroll')!.addEventListener('click', reroll);
const playBtn = document.getElementById('play')!;
playBtn.addEventListener('click', () => void engine.togglePlay());

// While playing, light the playing chord.
let lastSlot: number | null = null;
let lastPhase = '';
const tick = () => {
  const p = engine.playhead();
  playBtn.textContent = p.phase === 'playing' || p.phase === 'count-in' ? 'Pause' : 'Play';
  if (p.phase === 'playing' && (p.slotIndex !== lastSlot || lastPhase !== 'playing')) {
    const c = playList()[p.slotIndex ?? 0];
    if (c) lit = idOf(c);
    render();
  }
  lastSlot = p.slotIndex;
  lastPhase = p.phase;
  requestAnimationFrame(tick);
};

engine.setParts({ chords: true, bass: true, drums: true, click: false });
engine.setCountIn(false);
reroll();
requestAnimationFrame(tick);
