// Lead-sheet chord typesetting (DESIGN.md §4.3). Screen readers get the spoken name, never the glyphs.
import { chordParts, spokenChord, type Chord } from '../../theory/chords';
import './ChordSymbol.css';

export function ChordSymbol({ chord, size }: { chord: Chord; size: 'sm' | 'md' | 'lg' }) {
  const { root, suffix, bass } = chordParts(chord);
  const letter = root.slice(0, 1);
  const accidental = root.slice(1);
  // A bare minor "m" sits on the baseline; everything after it is raised.
  const minor = suffix.startsWith('m') && !suffix.startsWith('maj') ? 'm' : '';
  const quality = minor ? suffix.slice(1) : suffix;
  return (
    <span class={`chord-symbol chord-symbol--${size}`} role="img" aria-label={spokenChord(chord)}>
      <span aria-hidden="true">
        {letter}
        {accidental && <span class="chord-symbol__acc">{accidental}</span>}
        {minor && <span class="chord-symbol__minor">{minor}</span>}
        {quality && <span class="chord-symbol__quality">{quality}</span>}
        {bass && (
          <span class="chord-symbol__bass">
            /{bass.slice(0, 1)}
            {bass.length > 1 && <span class="chord-symbol__acc">{bass.slice(1)}</span>}
          </span>
        )}
      </span>
    </span>
  );
}
