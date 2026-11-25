// The bar timeline under the chord cards (SPEC.md §5.2, DESIGN.md §6 "Bar timeline"): one dash per bar of
// the section that's playing, the chord names above the bar where each starts, the current bar filling
// in time with the audio. You can see how long each chord lasts and when the next change is coming.
// (Section names aren't shown for now; the timeline still follows the section that's playing.)
import { useEffect, useRef } from 'preact/hooks';
import { formatChord } from '../../theory/chords';
import type { Section } from '../../theory/song';
import { FORM, itemAt, song, songChords } from '../state/jam';
import { playhead } from '../state/playback';
import { timeline } from '../frame';
import { slotStarts } from '../bars';

export function Timeline() {
  const p = playhead.value;
  const live = p.phase !== 'stopped' && p.slotIndex !== null;
  const item = live ? itemAt(p.slotIndex) : undefined;
  const sec: Section = item?.section ?? 'verse';
  const slots = song.value[sec];
  const chords = songChords.value[sec];
  const bars = slots.reduce((a, s) => a + s.bars, 0);
  const cur = item?.index ?? (live ? 0 : -1);
  const starts = slotStarts(slots);

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    timeline.el = root.current;
    timeline.section = sec;
    timeline.bars = bars;
    // Where this section starts in the song, in beats (the chorus follows the whole verse).
    timeline.startBeats = FORM.slice(0, FORM.indexOf(sec)).reduce((a, s) => a + song.value[s].reduce((b, x) => b + x.bars, 0) * 4, 0);
  }, [sec, bars, song.value]);

  const countIn = p.phase === 'count-in';
  return (
    <div class="timeline" ref={root} aria-hidden="true">
      {countIn && (
        <span class="tl-countin">
          Count-in
          <span class="tl-beats">
            {[1, 2, 3, 4].map((b) => (
              <i class={p.countInBeat !== null && b <= p.countInBeat ? 'on' : ''} />
            ))}
          </span>
        </span>
      )}
      <div class="tl-chords">
        {slots.map((_, i) => (
          <span
            class={`tl-chord${i === cur ? ' now' : i === cur + 1 ? ' next' : i < cur ? ' past' : ''}`}
            style={{ left: `${(starts[i]! / bars) * 100}%` }}
          >
            {formatChord(chords[i]!.chord)}
          </span>
        ))}
      </div>
      <div class="tl-bars">
        {Array.from({ length: bars }, () => (
          <span class="tl-bar">
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}
