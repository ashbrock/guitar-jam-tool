// The one animation-frame loop. Each frame it reads the playhead from the audio clock, then:
// updates the coarse playhead signal (components re-render at most once per beat), draws the visuals,
// and sets the current card's progress bar directly (60 fps without re-rendering).
import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { Visuals } from '../visuals/index';
import { barFill } from './bars';
import { itemAt, playList, songChords, vibe } from './state/jam';
import type { Section } from '../theory/song';
import { engine, syncPlayhead } from './state/playback';

/** The current card's progress fill, registered by the carousel. */
/** The bar timeline, registered by its component: which section it shows, its length, and where it starts. */
export const timeline: { el: HTMLElement | null; section: Section; bars: number; startBeats: number } = {
  el: null,
  section: 'verse',
  bars: 0,
  startBeats: 0,
};


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

      // The bar timeline fills smoothly from the audio clock. Held while paused; empty when stopped.
      const tl = timeline.el;
      if (tl && p.phase !== 'paused') {
        const now = itemAt(p.slotIndex);
        const playing = p.phase === 'playing' && now?.section === timeline.section;
        const barsIn = playing ? (p.bar * 4 + p.beat + p.beatFraction - timeline.startBeats) / 4 : 0;
        tl.querySelectorAll<HTMLElement>('.tl-bar i').forEach((el, k) => {
          el.style.width = `${barFill(k, barsIn) * 100}%`;
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
