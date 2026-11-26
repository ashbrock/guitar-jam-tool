// The one animation-frame loop. Each frame it reads the playhead from the audio clock, then:
// updates the coarse playhead signal (components re-render at most once per beat), draws the visuals,
// and fills the playing chord's block in the song map directly (60 fps without re-rendering).
import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { Visuals } from '../visuals/index';
import { blockFill, slotStarts } from './bars';
import { itemAt, playList, playStarts, song, songChords, vibe } from './state/jam';
import { engine, syncPlayhead } from './state/playback';

/** The song map, registered by its component. */
export const songMap: { el: HTMLElement | null } = { el: null };

export function useFrameLoop(canvas: RefObject<HTMLCanvasElement | null>, glCanvas: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    if (!canvas.current || !glCanvas.current) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const visuals = new Visuals(canvas.current, glCanvas.current, bg);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // The orb centres on the chord carousel; measure where that sits.
    const focus = () => {
      const c = document.querySelector('.carousel');
      if (!c) return;
      const r = c.getBoundingClientRect();
      visuals.setFocus((r.top + r.height / 2) / window.innerHeight);
    };
    const onResize = () => {
      visuals.resize();
      focus();
    };
    focus();
    window.addEventListener('resize', onResize);
    let raf = 0;

    const frame = (now: number) => {
      const p = engine.playhead();
      syncPlayhead(p);
      // The engine plays a play list (a section, or the song form); map its position to a chord.
      const item = itemAt(p.slotIndex ?? 0) ?? playList.value[0];
      const chord = item ? songChords.value[item.section][item.index] : undefined;
      visuals.render(now, {
        look: vibe.value.look,
        chord,
        slotIndex: p.slotIndex,
        phase: p.phase,
        beatFraction: p.beatFraction,
        beatPosition: p.bar * 4 + p.beat + p.beatFraction,
        tempo: engine.tempo,
        reducedMotion: reduced.matches,
        levels: engine.levels(),
      });

      // The playing chord's block fills smoothly from the audio clock. Held while paused; empty when stopped.
      const map = songMap.el;
      if (map && p.phase !== 'paused') {
        const cur = p.phase === 'playing' ? itemAt(p.slotIndex) : undefined;
        // Bars into the current time through the section: the loop position less where this chord
        // starts in the loop, plus where it starts in its section.
        const barsIn = cur
          ? p.bar + (p.beat + p.beatFraction) / 4 - playStarts.value[p.slotIndex!]! + slotStarts(song.value[cur.section])[cur.index]!
          : 0;
        map.querySelectorAll<HTMLElement>('.sm-block').forEach((el) => {
          const d = el.dataset;
          const on = cur && d.sec === cur.section && Number(d.idx) === cur.index;
          (el.firstElementChild as HTMLElement).style.width = `${on ? blockFill(barsIn, Number(d.start), Number(d.bars)) * 100 : 0}%`;
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);
}
