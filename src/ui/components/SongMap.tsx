// The song map under the chord cards (SPEC.md §5.2, DESIGN.md §6 "Song map"): a row for each section,
// a block for each chord, sized by how many bars it lasts, four bars to a line like a lead sheet. The
// playing chord's block lights up with an edge and fills in time with the audio, so you can see the
// change coming. Each section shows that it plays twice, and which time through it is. On short
// screens the section that isn't playing folds to its header.
import { useEffect, useRef } from 'preact/hooks';
import { FORM, REPEATS, itemAt, song, songChords } from '../state/jam';
import { playhead } from '../state/playback';
import { songMap } from '../frame';
import { BARS_PER_LINE, chartLines } from '../bars';
import { ChordName } from './ChordName';

const LABEL = { verse: 'Verse', chorus: 'Chorus' } as const;

export function SongMap() {
  const p = playhead.value;
  const live = p.phase !== 'stopped' && p.slotIndex !== null;
  const item = live ? itemAt(p.slotIndex) : undefined;

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    songMap.el = root.current;
    return () => {
      songMap.el = null;
    };
  }, []);

  const countIn = p.phase === 'count-in';
  return (
    <div class="song-map" ref={root} aria-hidden="true">
      {countIn && (
        <span class="sm-countin">
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
        // On short screens only one section shows its blocks: the one playing (the verse when stopped).
        const open = here || (!item && sec === FORM[0]);
        const chords = songChords.value[sec];
        return (
          <section class={`sm-section${here ? ' here' : ''}${open ? ' open' : ''}`} key={sec}>
            <header class="sm-head">
              <span class="sm-label">{LABEL[sec]}</span>
              <span class="sm-pass">{here ? `${item!.pass + 1}/${REPEATS}` : `×${REPEATS}`}</span>
            </header>
            {chartLines(song.value[sec]).map((line) => (
              <div class="sm-line">
                {line.map((s) => {
                  const now = here && s.index === item!.index;
                  const cls = `sm-block${now ? ' now' : ''}${s.head ? '' : ' cont'}${s.tail ? '' : ' runs'}`;
                  return (
                    <span
                      class={cls}
                      style={{ flexGrow: s.bars / BARS_PER_LINE }}
                      data-sec={sec}
                      data-idx={s.index}
                      data-start={s.start}
                      data-bars={s.bars}
                    >
                      <i />
                      {s.head && <ChordName chord={chords[s.index]!.chord} cls="sm-name" />}
                    </span>
                  );
                })}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
