// The single full-screen stage (SPEC.md §3): visuals behind, top bar, the carousel in the centre,
// and the floating panel at the bottom.
import { useEffect, useRef } from 'preact/hooks';
import * as jam from '../state/jam';
import { togglePlay } from '../state/playback';
import { muted } from '../state/sound';
import { announcement, mode, openPicker, showStatus } from '../state/ui';
import { useFrameLoop } from '../frame';
import { Carousel } from './Carousel';
import { Timeline } from './Timeline';
import { Panel } from './Panel';
import { StatusPill } from './StatusPill';
import { TopBar } from './TopBar';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  useFrameLoop(canvas, glCanvas);

  useEffect(() => {
    // Keyboard (SPEC.md §9). Ignored while typing; Space on a focused button is left to the button.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openPicker.value) {
        openPicker.value = null;
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || mode.value !== 'jam') return;
      const onButton = e.target instanceof HTMLButtonElement;
      if (e.key === ' ' && !onButton) {
        e.preventDefault();
        void togglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        jam.reroll();
      } else if (e.key === 'm' || e.key === 'M') {
        muted.value = !muted.value;
      } else if (e.key === 'u' || e.key === 'U') {
        // Undo has no button any more (Mute took its place); the history is still here on the keyboard.
        if (!jam.back()) showStatus('No earlier progression yet');
      } else if (e.key === '+' || e.key === '=') {
        jam.setTempo(jam.tempo.value + (e.shiftKey ? 5 : 1));
      } else if (e.key === '-' || e.key === '_') {
        jam.setTempo(jam.tempo.value - (e.shiftKey ? 5 : 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const cards = [...document.querySelectorAll<HTMLButtonElement>('.carousel .card')];
        if (!cards.length) return;
        const at = cards.indexOf(document.activeElement as HTMLButtonElement);
        const cur = at >= 0 ? at : cards.findIndex((c) => c.getAttribute('aria-current') === 'true');
        const next = (cur + (e.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
        cards[next]!.focus();
        e.preventDefault();
      }
    };
    // Pickers close on a tap outside them (or their trigger).
    const onClick = (e: MouseEvent) => {
      if (!openPicker.value) return;
      const t = e.target as HTMLElement;
      if (!t.isConnected) return; // a click that re-rendered the picker is still inside it
      if (!t.closest('[data-picker]') && !t.closest('[aria-haspopup="dialog"]')) openPicker.value = null;
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <>
      <canvas class="viz" ref={canvas} aria-hidden="true" />
      <canvas class="viz" ref={glCanvas} aria-hidden="true" />
      <TopBar />
      <StatusPill />
      <main class="stage">
        {mode.value === 'jam' ? (
          <>
            <Carousel />
            <Timeline />
          </>
        ) : (
          <div class="solo-soon">
            <h1>Solo</h1>
            <p>Enter a song’s chords, loop them and explore the fretboard. This mode is being designed.</p>
          </div>
        )}
      </main>
      {mode.value === 'jam' && <Panel />}
      <p class="sr-only" aria-live="polite">
        {announcement.value}
      </p>
    </>
  );
}
