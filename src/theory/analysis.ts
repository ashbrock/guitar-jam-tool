// Harmonic analysis: key detection, scale fit, chord scales, landing and avoid notes.
import { chordIntervals, chordPcs, coreIntervals, type Chord } from './chords';
import { KEY_TONICS, keyScaleNotes, type Key, type Mode } from './keys';
import { mod12, pc, spellInterval, type Note, type PitchClass } from './notes';
import { SCALE_IDS, scalePcs, type ScaleId } from './scales';

const corePcs = (c: Chord): Set<PitchClass> => new Set(coreIntervals(c.spec).map((i) => pc(spellInterval(c.root, i))));

// ---------- Key detection ----------

export interface KeyCandidate {
  key: Key;
  score: number;
}

/**
 * Ranks all 24 keys for a progression. Chords whose tones are in the key score highest;
 * a progression that starts (or ends) on the tonic chord gets a bonus, which separates
 * a major key from its relative minor.
 */
export function detectKeys(chords: readonly Chord[]): KeyCandidate[] {
  if (chords.length === 0) return [];
  const out: KeyCandidate[] = [];
  for (const mode of ['major', 'minor'] as Mode[]) {
    for (const tonic of KEY_TONICS[mode]) {
      const key: Key = { tonic, mode };
      const scale = new Set(keyScaleNotes(key).map(pc));
      let score = 0;
      for (const c of chords) {
        const tones = [...corePcs(c)];
        score += tones.filter((p) => scale.has(p)).length / tones.length;
        if (scale.has(pc(c.root))) score += 0.5;
      }
      const isTonicChord = (c: Chord) =>
        pc(c.root) === pc(tonic) && (mode === 'minor' ? c.spec.third === 'minor' : c.spec.third !== 'minor');
      if (isTonicChord(chords[0]!)) score += 1;
      if (isTonicChord(chords[chords.length - 1]!)) score += 0.5;
      if (chords.some(isTonicChord)) score += 0.5;
      out.push({ key, score: score / (chords.length * 1.5 + 2) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The best key, plus the runner-up if it's within 5% (the UI shows both). */
export function suggestKey(chords: readonly Chord[]): KeyCandidate[] {
  const ranked = detectKeys(chords);
  if (ranked.length === 0) return [];
  const [best, second] = ranked;
  return second && best!.score - second.score < 0.05 ? [best!, second] : [best!];
}

// ---------- Scale fit ----------

/**
 * Does a scale work over a chord?
 * - Seven-note scales must contain every core chord tone.
 * - Smaller scales (pentatonic, blues) may leave chord tones out, but must not contradict
 *   the chord's quality: no minor 3rd over a major 3rd (or vice versa), no ♭7 against a maj7
 *   (or vice versa). So E minor pentatonic works over D (its G is just the 4th) but not over B7
 *   (its D fights the D♯).
 */
export function scaleFitsChord(scale: Set<PitchClass>, c: Chord): boolean {
  const core = corePcs(c);
  if ([...core].every((p) => scale.has(p))) return true;
  if (scale.size >= 7) return false;
  const root = pc(c.root);
  const has = (semis: number) => scale.has(mod12(root + semis));
  const ivs = coreIntervals(c.spec);
  const is = (num: number, semis: number) => ivs.some((i) => i.num === num && i.semis === semis);
  if (is(3, 4) && has(3)) return false;
  if (is(3, 3) && has(4)) return false;
  if (is(7, 10) && has(11)) return false;
  if (is(7, 11) && has(10)) return false;
  return true;
}

export interface ScaleSuggestion {
  scale: ScaleId;
  root: Note;
  fits: number;
  total: number;
  /** Indices of chords the scale clashes with. */
  clashes: number[];
}

/** "Whole song" scale suggestions: scales on the key tonic ranked by fit, then vibe preference. */
export function suggestSongScales(chords: readonly Chord[], key: Key, preference: readonly ScaleId[] = []): ScaleSuggestion[] {
  const rank = (id: ScaleId) => {
    const i = preference.indexOf(id);
    return i === -1 ? preference.length + SCALE_IDS.indexOf(id) : i;
  };
  return SCALE_IDS.map((id) => {
    const set = scalePcs(key.tonic, id);
    const clashes = chords.flatMap((c, i) => (scaleFitsChord(set, c) ? [] : [i]));
    return { scale: id, root: key.tonic, fits: chords.length - clashes.length, total: chords.length, clashes };
  }).sort((a, b) => b.fits - a.fits || rank(a.scale) - rank(b.scale));
}

/**
 * "Follow chord" scale options for one chord.
 * First choice is the mode built on the chord root that uses the key's own notes
 * (Dorian on ii, Mixolydian on V, Lydian on IV…). If none fits, other scales on the
 * chord root that contain the chord, then the key scale itself.
 */
export function chordScaleOptions(c: Chord, key: Key, preference: readonly ScaleId[] = []): { scale: ScaleId; root: Note }[] {
  const keySet = new Set(keyScaleNotes(key).map(pc));
  const core = corePcs(c);
  const contains = (set: Set<PitchClass>) => [...core].every((p) => set.has(p));
  const sameSet = (a: Set<PitchClass>, b: Set<PitchClass>) => a.size === b.size && [...a].every((x) => b.has(x));

  const fallback: ScaleId[] = [
    'major', 'mixolydian', 'dorian', 'naturalMinor', 'lydian', 'phrygian', 'harmonicMinor',
    'majorPentatonic', 'minorPentatonic', 'minorBlues', 'majorBlues',
  ];
  const order = [...new Set<ScaleId>([...preference, ...fallback])];

  const out: { scale: ScaleId; root: Note }[] = [];
  const push = (scale: ScaleId, root: Note) => {
    if (!out.some((o) => o.scale === scale && pc(o.root) === pc(root))) out.push({ scale, root });
  };

  for (const id of order) {
    const set = scalePcs(c.root, id);
    if (set.size === 7 && sameSet(set, keySet) && contains(set)) push(id, c.root);
  }
  for (const id of order) {
    const set = scalePcs(c.root, id);
    if (set.size >= 7 ? contains(set) : scaleFitsChord(set, c)) push(id, c.root);
  }
  if (contains(keySet)) push(key.mode === 'major' ? 'major' : 'naturalMinor', key.tonic);
  return out;
}

// ---------- Landing and avoid notes ----------

/** Landing targets are the next chord's tones; approaches sit a half step either side of them. */
export function landingNotes(next: Chord): { targets: Set<PitchClass>; approaches: Set<PitchClass> } {
  const targets = chordPcs(next);
  const approaches = new Set<PitchClass>();
  for (const t of targets) {
    for (const a of [mod12(t - 1), mod12(t + 1)]) if (!targets.has(a)) approaches.add(a);
  }
  return { targets, approaches };
}

/** Avoid notes: scale tones a half step above a chord tone (classical definition), excluding chord tones. */
export function avoidNotes(scale: Set<PitchClass>, c: Chord): Set<PitchClass> {
  const tones = new Set(chordIntervals(c.spec).map((i) => pc(spellInterval(c.root, i))));
  const out = new Set<PitchClass>();
  for (const s of scale) if (!tones.has(s) && tones.has(mod12(s - 1))) out.add(s);
  return out;
}
