// The song map (SPEC.md §5.2, DESIGN.md §6 "Song map"): a row per section, a block per chord, all the
// same width. Dots under each name count its beats (four a bar), so a 2-bar chord reads longer without a
// wider block; while playing, the current beat's dot grows. The selected chord (the one playing, or the
// one picked) is solid white. Tapping a chord pauses, selects it and plays it; Play starts from it.
import { useEffect, useRef } from 'preact/hooks';
import { formatChord, spokenChord } from '../../theory/chords';
import { FORM, REPEATS, itemAt, playList, song, songChords } from '../state/jam';
import { playhead, selectChord } from '../state/playback';
import { songMap } from '../frame';
import { slotStarts } from '../bars';

const LABEL = { verse: 'Verse', chorus: 'Chorus' } as const;
const barsText = (b: number) => (b === 1 ? '1 bar' : `${b} bars`);

export function SongMap() {
  const p = playhead.value;
  const item = itemAt(p.slotIndex) ?? playList.value[0];
  const started = p.phase !== 'stopped';

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    songMap.el = root.current;
    return () => {
      songMap.el = null;
    };
  }, []);

  return (
    <div class="song-map" ref={root}>
      {p.phase === 'count-in' && (
        <span class="sm-countin" aria-hidden="true">
          Count-in
          <span class="sm-beats">
            {[1, 2, 3, 4].map((b) => (
              <i class={p.countInBeat !== null && b <= p.countInBeat ? 'on' : ''} />
            ))}
          </span>
        </span>
      )}
      {FORM.map((sec) => {
        const here = item?.section === sec;
        const slots = song.value[sec];
        const chords = songChords.value[sec];
        const starts = slotStarts(slots);
        const pass = here && started ? `${item!.pass + 1}/${REPEATS}` : `×${REPEATS}`;
        return (
          <section class={`sm-section${here ? ' here' : ''}`} key={sec} aria-labelledby={`sm-${sec}`}>
            <header class="sm-head">
              <h2 id={`sm-${sec}`}>{LABEL[sec]}</h2>
              <span class="sm-pass" aria-label={here && started ? `time ${item!.pass + 1} of ${REPEATS}` : `plays ${REPEATS} times`}>
                {pass}
              </span>
            </header>
            <div class="sm-row">
              {slots.map((s, i) => {
                const now = here && item!.index === i;
                return (
                  <button
                    class={`sm-block${now ? ' now' : ''}`}
                    aria-current={now ? 'true' : undefined}
                    aria-label={`${spokenChord(chords[i]!.chord)}, ${barsText(s.bars)}`}
                    data-sec={sec}
                    data-idx={i}
                    data-start={starts[i]}
                    data-bars={s.bars}
                    onClick={() => selectChord(sec, i)}
                  >
                    <span class="sm-name">{formatChord(chords[i]!.chord)}</span>
                    <span class="sm-dots" aria-hidden="true">
                      {Array.from({ length: Math.max(1, Math.round(s.bars)) }, () => (
                        <span class="sm-bar">
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
