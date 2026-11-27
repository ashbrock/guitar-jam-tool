// The one animation-frame loop. Each frame it reads the playhead from the audio clock, updates the
// coarse playhead signal (components re-render at most once per beat), and lights the current beat's
// dot in the song map directly (without re-rendering), so the dots follow what's audible.
import { useEffect } from 'preact/hooks';
import { beatIndex, slotStarts } from './bars';
import { itemAt, playStarts, song } from './state/jam';
import { engine, syncPlayhead } from './state/playback';

/** The song map, registered by its component. */
export const songMap: { el: HTMLElement | null } = { el: null };

export function useFrameLoop(): void {
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const p = engine.playhead();
      syncPlayhead(p);

      // The current beat's dot, from the audio clock. Only while playing: none when paused or stopped.
      const map = songMap.el;
      if (map) {
        const cur = p.phase === 'playing' ? itemAt(p.slotIndex) : undefined;
        // Bars into the current time through the section: the loop position less where this chord
        // starts in the loop, plus where it starts in its section.
        const barsIn = cur
          ? p.bar + (p.beat + p.beatFraction) / 4 - playStarts.value[p.slotIndex!]! + slotStarts(song.value[cur.section])[cur.index]!
          : 0;
        map.querySelectorAll<HTMLElement>('.sm-block').forEach((el) => {
          const d = el.dataset;
          const on = cur && d.sec === cur.section && Number(d.idx) === cur.index;
          const k = on ? beatIndex(barsIn, Number(d.start), Number(d.bars)) : -1;
          el.querySelectorAll('.sm-dots i').forEach((dot, j) => dot.classList.toggle('on', j === k));
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}
