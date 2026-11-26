// A chord symbol set like a chart (DESIGN.md §4.3): root, raised accidental, minor "m" on the
// baseline, the rest of the quality as a superscript.
import { chordParts, type Chord } from '../../theory/chords';

/** `cls` sets the size: the big name under a card, or the small one in the song map. */
export function ChordName({ chord, cls = 'chord-name' }: { chord: Chord; cls?: string }) {
  const { root, suffix } = chordParts(chord);
  const minor = suffix.startsWith('m') && !suffix.startsWith('maj');
  const quality = minor ? suffix.slice(1) : suffix;
  return (
    <span class={cls} aria-hidden="true">
      {root[0]}
      {root.length > 1 && <span class="acc">{root.slice(1)}</span>}
      {minor && 'm'}
      {quality && <sup>{quality}</sup>}
    </span>
  );
}
