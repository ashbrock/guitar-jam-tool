// Exploration: a chord wheel for Jam. Not wired into the app.
//
// A. Key wheel: only the key's seven chords, around a circle in fifths order (IV I V ii vi iii vii°, or
//    ♭VI ♭III ♭VII iv i v ii° in minor), so neighbours are a fifth apart. An outer ring holds each
//    chord's extensions (maj7, 9, m11…). Chords the progression uses get a ring; the playing or picked
//    one is solid white. Chords outside the key are listed under the wheel.
// B. Circle of fifths: all twelve majors outside, their relative minors inside, rotated so the key sits
//    at the top. The key's seven chords are lit, the rest faint, so borrowed chords show where they sit.
//    Extensions for the picked chord appear under the wheel.
// Both draw the progression's path around the wheel: solid for the verse, dashed for the chorus.
import { createEngine } from '../../../src/audio/engine';
import { VIBES, vibeById } from '../../../src/data/vibes/index';
import { formatChord, parseChord, spokenChord, type Chord } from '../../../src/theory/chords';
import { resolveDegreeChord } from '../../../src/theory/degrees';
import { KEY_TONICS, formatKey, type Key, type Mode } from '../../../src/theory/keys';
import { formatNote, pc, type Note } from '../../../src/theory/notes';
import { newSeed } from '../../../src/theory/random';
import { simplify } from '../../../src/theory/simplify';
import { generateSong, type Section, type Song } from '../../../src/theory/song';

// ---------- The key's chords (pure) ----------

interface Spot {
  degree: string;
  quality: string;
  /** Common extensions, as qualities ("maj7", "m9"). */
  exts: string[];
}

/** The seven diatonic chords in fifths order, with common extensions. */
const DIATONIC: Record<Mode, Spot[]> = {
  major: [
    { degree: 'IV', quality: '', exts: ['maj7', 'add9', '6'] },
    { degree: 'I', quality: '', exts: ['maj7', '6/9', 'add9'] },
    { degree: 'V', quality: '', exts: ['7', '9', 'sus4'] },
    { degree: 'ii', quality: 'm', exts: ['m7', 'm9', 'm11'] },
    { degree: 'vi', quality: 'm', exts: ['m7', 'm9', 'm11'] },
    { degree: 'iii', quality: 'm', exts: ['m7', 'm11'] },
    { degree: 'vii', quality: 'dim', exts: ['m7b5'] },
  ],
  minor: [
    { degree: 'bVI', quality: '', exts: ['maj7', 'add9', 'maj7#11'] },
    { degree: 'bIII', quality: '', exts: ['maj7', 'add9', '6'] },
    { degree: 'bVII', quality: '', exts: ['7', 'add9', 'sus2'] },
    { degree: 'iv', quality: 'm', exts: ['m7', 'm9', 'm6'] },
    { degree: 'i', quality: 'm', exts: ['m7', 'm9', 'm11'] },
    { degree: 'v', quality: 'm', exts: ['m7', 'm9'] },
    { degree: 'ii', quality: 'dim', exts: ['m7b5'] },
  ],
};
for (const m of ['major', 'minor'] as const) for (const s of DIATONIC[m]) for (const q of [s.quality, ...s.exts]) if (!parseChord(`C${q}`).ok) throw new Error(q);

const family = (q: string) => (q === 'dim' ? 'dim' : q === 'm' ? 'minor' : 'major');
const kindFamily = (k: string) => (k === 'dim' ? 'dim' : k === 'minor' ? 'minor' : 'major');
const NUMERAL = (d: string, q: string) => d.replace('b', '♭') + (q === 'dim' ? '°' : '');

// ---------- State ----------

const engine = createEngine();
let view: 'a' | 'b' = (new URLSearchParams(location.search).get('v') as 'a' | 'b') ?? 'a';
let vibeId = 'neo-soul';
let key: Key = { tonic: { letter: 'D', acc: 0 }, mode: 'major' };
let song: Song = { verse: [], chorus: [] };
/** What's lit: the playing chord, or the last one tapped. */
let lit: { root: number; fam: string; quality?: string } | null = null;
/** The picked chord's spot (for B's extension chips). */
let picked: { chord: Chord; exts: string[] } | null = null;

const songChords = () => ({
  verse: song.verse.map((s) => simplify(resolveDegreeChord(s.degree, s.quality, key, s.bassDegree))),
  chorus: song.chorus.map((s) => simplify(resolveDegreeChord(s.degree, s.quality, key, s.bassDegree))),
});
const playList = () => {
  const c = songChords();
  return [...c.verse, ...c.verse, ...c.chorus, ...c.chorus];
};
const playBars = () => [...song.verse, ...song.verse, ...song.chorus, ...song.chorus].map((s) => s.bars);

function reroll(): void {
  const v = vibeById(vibeId)!;
  song = generateSong({ params: v.params, mode: key.mode, seed: newSeed() });
  engine.setFeel({ groove: v.playback.groove, swing: v.playback.swing, voicing: v.playback.voicing });
  engine.setTempo(v.playback.tempo.default);
  sendSong();
}
function sendSong(): void {
  const bars = playBars();
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
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

interface Hit {
  root: number;
  fam: string;
  /** The chord's angle on the wheel: the path is drawn in the centre at this angle. */
  a: number;
}
/** Radius of the progression's shape in the wheel's centre (A, B). */
let pathR = 46;
/** Outlines for chords in the progression, drawn over all the cells so neighbours don't hide them. */
let outlines = '';

// ---------- Rendering ----------

const svg = document.getElementById('wheel')!;

function render(): void {
  document.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === view)));
  const hits: Hit[] = view === 'a' ? drawA() : drawB();
  drawPaths(hits);
  drawLists();
}

/** Which chords the song uses, by root pitch class and family. */
function used(): Set<string> {
  const c = songChords();
  return new Set([...c.verse, ...c.chorus].map((x) => `${pc(x.chord.root)}:${kindFamily(x.kind)}`));
}
const isLit = (root: number, fam: string, quality?: string) => !!lit && lit.root === root && lit.fam === fam && (quality === undefined || lit.quality === quality);

function cell(d: string, cls: string, data: Record<string, string>, label: string): string {
  if (cls.includes(' used')) outlines += `<path d="${d}" class="outline" />`;
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<path d="${d}" class="${cls}" ${attrs} role="button" tabindex="0" aria-label="${esc(label)}"></path>`;
}

function drawA(): Hit[] {
  const spots = DIATONIC[key.mode];
  const n = spots.length;
  const tonicIdx = key.mode === 'major' ? 1 : 4;
  const step = (2 * Math.PI) / n;
  const angle = (i: number) => -Math.PI / 2 + (i - tonicIdx) * step;
  const u = used();
  let out = '';
  outlines = '';
  pathR = 46;
  const hits: Hit[] = [];
  spots.forEach((s, i) => {
    const ch = resolveDegreeChord(s.degree, s.quality, key);
    const root = pc(ch.root);
    const fam = family(s.quality);
    const a0 = angle(i) - step / 2;
    const a1 = angle(i) + step / 2;
    const now = isLit(root, fam) && lit?.quality === undefined;
    const inSong = u.has(`${root}:${fam}`);
    out += cell(sector(58, 128, a0, a1), `cell${now ? ' now' : ''}${inSong ? ' used' : ''}`, { q: s.quality, r: formatChord(ch), i: String(i) }, `${spokenChord(ch)}${inSong ? ', in the progression' : ''}`);
    const [tx, ty] = pt(96, angle(i));
    out += `<text x="${tx}" y="${ty - 6}" font-size="19" font-weight="500" class="${now ? 't-now' : ''}">${esc(formatChord(ch))}</text>`;
    out += `<text x="${tx}" y="${ty + 13}" font-size="10" class="${now ? 't-now' : 't-ext'}">${esc(NUMERAL(s.degree, s.quality))}</text>`;
    hits.push({ root, fam, a: angle(i) });
    // Outer ring: extensions, split across the wedge.
    const k = s.exts.length;
    s.exts.forEach((q, j) => {
      const b0 = a0 + ((a1 - a0) * j) / k;
      const b1 = a0 + ((a1 - a0) * (j + 1)) / k;
      const ec = resolveDegreeChord(s.degree, q, key);
      const lt = isLit(root, fam, q);
      out += cell(sector(132, 192, b0, b1), `cell ext${lt ? ' now' : ''}`, { q, r: formatChord(ec), i: String(i) }, spokenChord(ec));
      const [ex, ey] = pt(162, (b0 + b1) / 2);
      out += `<text x="${ex}" y="${ey}" font-size="11.5" class="${lt ? 't-now' : 't-ext'}">${esc(suffix(ec))}</text>`;
    });
  });
  svg.innerHTML = out + outlines;
  return hits;
}

/** A chord's suffix as shown on the outer ring ("maj7", "m9", "7"). */
const suffix = (c: Chord) => formatChord(c).slice(formatNote(c.root).length) || 'maj';

function drawB(): Hit[] {
  const relMajor = key.mode === 'major' ? pc(key.tonic) : (pc(key.tonic) + 3) % 12;
  const spots = DIATONIC[key.mode];
  // Diatonic chords by ring position: outer −1..1 are spots 0..2; inner −1..1 are spots 3..5; inner +2 is spot 6.
  const at = (ring: 'o' | 'i', k: number): Spot | undefined =>
    ring === 'o' ? (k >= -1 && k <= 1 ? spots[k + 1] : undefined) : k >= -1 && k <= 1 ? spots[k + 4] : k === 2 ? spots[6] : undefined;
  const step = (2 * Math.PI) / 12;
  const u = used();
  const majorName = (p: number) => formatNote(KEY_TONICS.major.find((t) => pc(t) === p)!);
  const minorName = (p: number) => formatNote(KEY_TONICS.minor.find((t) => pc(t) === p)!);
  let out = '';
  outlines = '';
  pathR = 60;
  const hits: Hit[] = [];
  for (let k = -5; k <= 6; k++) {
    const a = -Math.PI / 2 + k * step;
    const a0 = a - step / 2;
    const a1 = a + step / 2;
    const majPc = (((relMajor + 7 * k) % 12) + 12) % 12;
    const minPc = (majPc + 9) % 12;
    for (const ring of ['o', 'i'] as const) {
      const s = at(ring, k);
      const root = ring === 'o' ? majPc : minPc;
      const ch: Chord = s
        ? resolveDegreeChord(s.degree, s.quality, key)
        : { ...parseChordOk(`C${ring === 'o' ? '' : 'm'}`), root: noteOf(ring === 'o' ? majorName(root) : minorName(root)) };
      const fam = s ? family(s.quality) : ring === 'o' ? 'major' : 'minor';
      const inSong = u.has(`${root}:${fam}`) || (ring === 'i' && u.has(`${root}:dim`));
      const now = isLit(root, fam) || (ring === 'i' && isLit(root, 'dim'));
      const [r0, r1, tr] = ring === 'o' ? [134, 192, 163] : [72, 130, 101];
      const cls = `cell${s || inSong ? '' : ' off'}${now ? ' now' : ''}${inSong ? ' used' : ''}`;
      out += cell(sector(r0, r1, a0, a1), cls, { q: s?.quality ?? (ring === 'o' ? '' : 'm'), r: formatChord(ch), i: s ? String(spots.indexOf(s)) : '' }, `${spokenChord(ch)}${s ? '' : ', outside the key'}${inSong ? ', in the progression' : ''}`);
      const [tx, ty] = pt(tr, a);
      out += `<text x="${tx}" y="${ty}" font-size="${ring === 'o' ? 17 : 14}" font-weight="500" class="${now ? 't-now' : s || inSong ? '' : 't-off'}">${esc(formatChord(ch))}</text>`;
      if (s || inSong) hits.push({ root, fam: inSong && !s && u.has(`${root}:dim`) ? 'dim' : fam, a });
    }
  }
  svg.innerHTML = out + outlines;
  return hits;
}

function parseChordOk(s: string): Chord {
  const r = parseChord(s);
  if (!r.ok) throw new Error(s);
  return r.chord;
}
const noteOf = (name: string): Note => parseChordOk(name.replace('♯', '#').replace('♭', 'b')).root;

/** The progression's path: a line through each chord in play order (verse solid, chorus dashed). */
function drawPaths(hits: Hit[]): void {
  const c = songChords();
  const find = (x: { chord: Chord; kind: string }) => hits.find((h) => h.root === pc(x.chord.root) && h.fam === kindFamily(x.kind));
  let out = '';
  for (const sec of ['verse', 'chorus'] as Section[]) {
    const pts = c[sec].map(find).filter((h): h is Hit => !!h);
    if (pts.length < 2) continue;
    // The verse on the outer edge of the centre, the chorus a little inside it, so both stay readable.
    const r = sec === 'verse' ? pathR : pathR - 9;
    const xy = pts.map((p) => pt(r, p.a));
    const loop = [...xy, xy[0]!];
    out += `<polyline class="path ${sec}" points="${loop.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" />`;
    for (const [x, y] of xy) out += `<circle class="dot" cx="${x}" cy="${y}" r="2.5" />`;
  }
  svg.insertAdjacentHTML('beforeend', out);
}

function chip(c: Chord, now: boolean, extra = ''): string {
  return `<button class="chip${now ? ' now' : ''}" data-r="${esc(formatChord(c))}" aria-label="${esc(spokenChord(c))}" ${extra}>${esc(formatChord(c))}</button>`;
}

function drawLists(): void {
  const c = songChords();
  const p = engine.playhead();
  const playing = p.phase === 'playing' ? p.slotIndex : null;
  const v = c.verse.length;
  const ch = c.chorus.length;
  const nowAt = (sec: Section, i: number) =>
    playing !== null && (sec === 'verse' ? playing === i || playing === i + v : playing === 2 * v + i || playing === 2 * v + ch + i);
  const row = (sec: Section) =>
    `<span class="label">${sec === 'verse' ? 'Verse ×2' : 'Chorus ×2'}</span>` + c[sec].map((x, i) => chip(x.chord, nowAt(sec, i))).join('');
  document.getElementById('verse')!.innerHTML = row('verse');
  document.getElementById('chorus')!.innerHTML = row('chorus');

  // Chords the progression uses that aren't in the key.
  const inKey = new Set(DIATONIC[key.mode].map((s) => `${pc(resolveDegreeChord(s.degree, s.quality, key).root)}:${family(s.quality)}`));
  const outside = [...c.verse, ...c.chorus].filter((x, i, all) => !inKey.has(`${pc(x.chord.root)}:${kindFamily(x.kind)}`) && all.findIndex((y) => formatChord(y.chord) === formatChord(x.chord)) === i);
  document.getElementById('outside')!.innerHTML =
    view === 'a' && outside.length ? `<span class="label">Outside the key (not on this wheel)</span>` + outside.map((x) => chip(x.chord, false)).join('') : '';

  // B: the picked chord's extensions.
  document.getElementById('exts')!.innerHTML =
    view === 'b' && picked
      ? `<span class="label">${esc(formatChord(picked.chord))}: extensions</span>` +
        picked.exts.map((q) => chip({ ...parseChordOk(`C${q}`), root: picked!.chord.root }, isLit(pc(picked!.chord.root), lit?.fam ?? '', q))).join('')
      : view === 'b'
        ? `<span class="label">Tap a chord to see its extensions.</span>`
        : '';

  document.getElementById('note')!.textContent =
    view === 'a'
      ? 'A shows only the key’s seven chords, a fifth apart around the circle, with extensions always visible on the outer ring. Chords borrowed from outside the key aren’t on it.'
      : 'B is the full circle of fifths, turned so the key is at the top: its seven chords are lit, borrowed chords show where they sit. Extensions appear here when you pick a chord.';
}

// ---------- Interaction ----------

function preview(symbol: string, spot?: { idx: string; quality: string }): void {
  const c = parseChordOk(symbol.replace(/♯/g, '#').replace(/♭/g, 'b').replace('°', 'dim'));
  const fam = spot ? family(DIATONIC[key.mode][Number(spot.idx)]?.quality ?? spot.quality) : 'major';
  const s = spot && spot.idx !== '' ? DIATONIC[key.mode][Number(spot.idx)] : undefined;
  const isExt = !!s && spot!.quality !== s.quality;
  lit = { root: pc(c.root), fam: s ? family(s.quality) : spot ? family(spot.quality) : fam, quality: isExt ? spot!.quality : undefined };
  picked = s ? { chord: resolveDegreeChord(s.degree, s.quality, key), exts: s.exts } : picked;
  void engine.previewChord(c);
  if (engine.playhead().phase === 'playing') engine.pause();
  render();
}

svg.addEventListener('click', (e) => {
  const t = (e.target as Element).closest('[data-r]') as SVGElement | null;
  if (!t || t.classList.contains('off')) return;
  preview(t.dataset.r!, { idx: t.dataset.i ?? '', quality: t.dataset.q ?? '' });
});
svg.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target as SVGElement;
  if (!t.dataset?.r || t.classList.contains('off')) return;
  e.preventDefault();
  preview(t.dataset.r, { idx: t.dataset.i ?? '', quality: t.dataset.q ?? '' });
});
document.querySelector('.page')!.addEventListener('click', (e) => {
  const b = (e.target as Element).closest('.chips [data-r]') as HTMLElement | null;
  if (!b) return;
  const c = parseChordOk(b.dataset.r!.replace(/♯/g, '#').replace(/♭/g, 'b'));
  const kind = simplify(c).kind;
  lit = { root: pc(c.root), fam: kindFamily(kind), quality: b.closest('#exts') ? formatChord(c).slice(formatNote(c.root).length) : undefined };
  if (lit.quality !== undefined && picked) {
    const s = DIATONIC[key.mode].find((x) => pc(resolveDegreeChord(x.degree, x.quality, key).root) === pc(c.root));
    lit = { root: pc(c.root), fam: s ? family(s.quality) : lit.fam, quality: picked.exts.find((q) => formatChord({ ...parseChordOk(`C${q}`), root: c.root }) === formatChord(c)) };
  }
  void engine.previewChord(c);
  render();
});
document.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) =>
  b.addEventListener('click', () => {
    view = b.dataset.v as 'a' | 'b';
    history.replaceState(null, '', `?v=${view}`);
    render();
  }),
);

const keySel = document.getElementById('key') as HTMLSelectElement;
for (const m of ['major', 'minor'] as const)
  for (const t of KEY_TONICS[m]) keySel.insertAdjacentHTML('beforeend', `<option value="${m}:${t.letter}:${t.acc}">${esc(formatKey({ tonic: t, mode: m }))}</option>`);
keySel.value = 'major:D:0';
keySel.addEventListener('change', () => {
  const [m, l, a] = keySel.value.split(':');
  const modeChanged = m !== key.mode;
  key = { tonic: { letter: l as Note['letter'], acc: Number(a) }, mode: m as Mode };
  picked = null;
  if (modeChanged) reroll();
  else sendSong();
});
const vibeSel = document.getElementById('vibe') as HTMLSelectElement;
for (const v of VIBES) vibeSel.insertAdjacentHTML('beforeend', `<option value="${v.id}">${esc(v.name)}</option>`);
vibeSel.addEventListener('change', () => {
  vibeId = vibeSel.value;
  reroll();
});
document.getElementById('reroll')!.addEventListener('click', () => {
  picked = null;
  reroll();
});
const playBtn = document.getElementById('play')!;
playBtn.addEventListener('click', () => void engine.togglePlay());

// While playing, light the playing chord on the wheel.
let lastSlot: number | null = null;
let lastPhase = '';
const tick = () => {
  const p = engine.playhead();
  playBtn.textContent = p.phase === 'playing' || p.phase === 'count-in' ? 'Pause' : 'Play';
  if (p.phase === 'playing' && (p.slotIndex !== lastSlot || lastPhase !== 'playing')) {
    const c = playList()[p.slotIndex ?? 0];
    if (c) lit = { root: pc(c.chord.root), fam: kindFamily(c.kind) };
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
