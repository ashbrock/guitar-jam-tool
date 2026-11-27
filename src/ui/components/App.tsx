// The single full-screen stage (SPEC.md §3): top bar, the selected chord's chart, the song map, and the
// panel at the bottom.
import { useEffect } from 'preact/hooks';
import * as jam from '../state/jam';
import { togglePlay } from '../state/playback';
import { muted } from '../state/sound';
import { announcement, mode, openPicker, page, showStatus } from '../state/ui';
import { useFrameLoop } from '../frame';
import { ChordView } from './ChordView';
import { SongMap } from './SongMap';
import { Panel } from './Panel';
import { SavedPage, closeSaved } from './SavedPage';
import { StatusPill } from './StatusPill';
import { TopBar } from './TopBar';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export function App() {
  useFrameLoop();

  useEffect(() => {
    // Keyboard (SPEC.md §9). Ignored while typing; Space on a focused button is left to the button.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openPicker.value) {
        openPicker.value = null;
        return;
      }
      if (e.key === 'Escape' && page.value === 'saved') {
        closeSaved();
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || mode.value !== 'jam' || page.value !== 'main') return;
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
        // Moves focus along the song map's chords (Enter or Space then picks one).
        const blocks = [...document.querySelectorAll<HTMLButtonElement>('.sm-block')];
        if (!blocks.length) return;
        const at = blocks.indexOf(document.activeElement as HTMLButtonElement);
        const cur = at >= 0 ? at : blocks.findIndex((c) => c.getAttribute('aria-current') === 'true');
        const next = (cur + (e.key === 'ArrowRight' ? 1 : -1) + blocks.length) % blocks.length;
        blocks[next]!.focus();
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

  // My progressions is a full page over Jam; Jam's state (and playback) carry on underneath.
  if (page.value === 'saved') {
    return (
      <>
        <SavedPage />
        <StatusPill />
        <p class="sr-only" aria-live="polite">
          {announcement.value}
        </p>
      </>
    );
  }
  return (
    <>
      <TopBar />
      <StatusPill />
      <main class="stage">
        {mode.value === 'jam' ? (
          <>
            <ChordView />
            <SongMap />
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
