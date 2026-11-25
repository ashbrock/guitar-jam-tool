// The one animation-frame loop. Each frame it reads the playhead from the audio clock, then:
// updates the coarse playhead signal (components re-render at most once per beat), draws the visuals,
// and sets the current card's progress bar directly (60 fps without re-rendering).
import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { Visuals } from '../visuals/index';
import { chords, slots, vibe } from './state/jam';
import { engine, syncPlayhead } from './state/playback';

/** The current card's progress fill, registered by the carousel. */
export const progressBar: { el: HTMLElement | null; slot: number } = { el: null, slot: 0 };

export function useFrameLoop(canvas: RefObject<HTMLCanvasElement | null>, glCanvas: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    if (!canvas.current || !glCanvas.current) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const visuals = new Visuals(canvas.current, glCanvas.current, bg);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onResize = () => visuals.resize();
    window.addEventListener('resize', onResize);
    let raf = 0;

    const frame = (now: number) => {
      const p = engine.playhead();
      syncPlayhead(p);
      const cs = chords.value;
      const idx = p.slotIndex ?? 0;
      visuals.render(now, {
        look: vibe.value.look,
        chord: cs[idx],
        slotIndex: p.slotIndex,
        phase: p.phase,
        beatFraction: p.beatFraction,
        beatPosition: p.bar * 4 + p.beat + p.beatFraction,
        tempo: engine.tempo,
        reducedMotion: reduced.matches,
        levels: engine.levels(),
      });

      // Smooth progress through the current chord, from the audio clock. Held while paused.
      const bar = progressBar.el;
      if (bar && p.phase !== 'paused') {
        let fraction = 0;
        if (p.phase === 'playing' && p.slotIndex === progressBar.slot) {
          const ss = slots.value;
          let start = 0;
          for (let i = 0; i < p.slotIndex; i++) start += ss[i]!.bars * 4;
          const beats = ss[p.slotIndex]!.bars * 4;
          fraction = Math.max(0, Math.min(1, (p.bar * 4 + p.beat + p.beatFraction - start) / beats));
        }
        bar.style.width = `${fraction * 100}%`;
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
