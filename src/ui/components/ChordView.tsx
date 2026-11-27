// The selected chord (SPEC.md §5.2, DESIGN.md §6 "Chord view"): one chart and its name, in plain text.
// It shows the chord that's playing, or the one picked in the song map. Tapping it plays the chord.
import { formatChord, spokenChord } from '../../theory/chords';
import { basicQuality, basicShape } from '../../theory/shapes';
import { itemAt, playList, songChords } from '../state/jam';
import { engine, playhead } from '../state/playback';
import { ChordChart } from './ChordChart';

export function ChordView() {
  const item = itemAt(playhead.value.slotIndex) ?? playList.value[0];
  const c = item ? songChords.value[item.section][item.index] : undefined;
  if (!c) return <div class="chord-view" />;
  const q = basicQuality(c.chord);
  const shape = q !== null ? basicShape(c.chord, q) : null;
  return (
    <div class="chord-view">
      <button class="chord-btn" aria-label={`${spokenChord(c.chord)}. Play chord`} onClick={() => void engine.previewChord(c.chord)}>
        {shape ? (
          <span class="chart-card">
            {/* Drawn at a fixed size, then scaled to fit the screen's height in CSS. */}
            <ChordChart shape={shape} width={220} />
          </span>
        ) : (
          <span class="chart-card no-chart">No chart for this chord</span>
        )}
        <span class="chord-name" aria-hidden="true">
          {formatChord(c.chord)}
        </span>
      </button>
    </div>
  );
}
