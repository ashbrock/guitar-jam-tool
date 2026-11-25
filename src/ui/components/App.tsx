// The workspace (SPEC.md §3): one screen, a Jam | Solo switch, the context row, the main panel and
// the bottom transport.
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatKey } from '../../theory/keys';
import {
  allLocked,
  announcement,
  back,
  canGoBack,
  jamChords,
  jamKey,
  jamSlots,
  jamTempo,
  jamVibeId,
  reroll,
  rollId,
  selectVibe,
  setKey,
  setTempo,
  toggleLock,
} from '../state/jam';
import { audioBlocked, engineState, interrupted, playhead, togglePlay } from '../state/playback';
import { KeySheet } from './KeySheet';
import { Progression } from './Progression';
import { Segmented } from './Segmented';
import { TempoSheet } from './TempoSheet';
import { Transport } from './Transport';
import { VibeRail } from './VibeRail';
import './App.css';

type SheetName = 'key' | 'tempo' | null;
const STARTING_AFTER_MS = 150;
const REASON_MS = 3000;

export function App() {
  const [sheet, setSheet] = useState<SheetName>(null);
  const [starting, setStarting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const keyChip = useRef<HTMLButtonElement>(null);
  const tempoChip = useRef<HTMLButtonElement>(null);
  const reasonTimer = useRef<number | undefined>(undefined);

  const explain = (text: string) => {
    setReason(text);
    clearTimeout(reasonTimer.current);
    reasonTimer.current = window.setTimeout(() => setReason(null), REASON_MS);
  };

  const onPlay = async () => {
    // Only show the "starting" state if unlocking audio takes noticeably long (DESIGN.md §7.3).
    const t = window.setTimeout(() => setStarting(true), STARTING_AFTER_MS);
    await togglePlay();
    clearTimeout(t);
    setStarting(false);
  };

  const onBack = () => (canGoBack.value ? back() : explain('No earlier progression yet'));
  const onReroll = () => (allLocked.value ? explain('Unlock a chord to re-roll') : reroll());

  // Desktop shortcuts (SPEC.md §8). Ignored while typing or while a sheet is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === ' ' && !t.closest('button')) {
        e.preventDefault();
        void onPlay();
      } else if (e.key === 'r' || e.key === 'R') {
        onReroll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const ph = playhead.value;
  const state = engineState.value;
  const playingLed = state === 'playing' || state === 'count-in';

  return (
    <div class="app">
      <header class="top-bar">
        <Segmented<'jam' | 'solo'>
          label="Mode"
          value="jam"
          onChange={() => {}}
          options={[
            { value: 'jam', label: 'Jam', extra: playingLed ? <span class="led" aria-label="playing" /> : undefined },
            { value: 'solo', label: 'Solo', disabled: true, reason: 'Soon' },
          ]}
        />
      </header>

      <div class="context-row">
        <button ref={keyChip} type="button" class="chip" onClick={() => setSheet('key')} aria-haspopup="dialog">
          <span class="caption chip__label">Key</span>
          <span class="chip__value">{formatKey(jamKey.value)}</span>
        </button>
        <button ref={tempoChip} type="button" class="chip" onClick={() => setSheet('tempo')} aria-haspopup="dialog">
          <span class="caption chip__label">Tempo</span>
          <span class="chip__value mono">
            {jamTempo.value} <span class="chip__unit">BPM</span>
          </span>
        </button>
      </div>

      <main class="main">
        <section class="jam" aria-label="Jam">
          <div class="jam__vibes">
            <h2 class="caption section-label">Vibe</h2>
            <VibeRail value={jamVibeId.value} onChange={selectVibe} />
          </div>
          <div class="jam__progression">
            <h2 class="caption section-label">Progression</h2>
            <Progression slots={jamSlots.value} chords={jamChords.value} playhead={ph} rollId={rollId.value} onToggleLock={toggleLock} />
            {rollId.value > 0 && (
              <p class="reduced-motion-note" aria-hidden="true" key={rollId.value}>
                New progression
              </p>
            )}
          </div>
        </section>
      </main>

      {(audioBlocked.value || interrupted.value) && (
        <div class={`banner ${audioBlocked.value ? 'banner--error' : ''}`} role="alert">
          {audioBlocked.value ? (
            <>
              <span>Your browser blocked sound.</span>
              <button type="button" class="banner__action" onClick={onPlay}>
                Tap to try again
              </button>
            </>
          ) : (
            <span>Playback paused</span>
          )}
        </div>
      )}

      <Transport
        state={state}
        countInBeat={ph.countInBeat}
        starting={starting}
        canGoBack={canGoBack.value}
        allLocked={allLocked.value}
        reason={reason}
        onBack={onBack}
        onReroll={onReroll}
        onPlay={onPlay}
      />

      <div class="visually-hidden" aria-live="polite">
        {announcement.value}
      </div>

      <KeySheet open={sheet === 'key'} onClose={() => setSheet(null)} anchor={keyChip.current} value={jamKey.value} onChange={setKey} />
      <TempoSheet open={sheet === 'tempo'} onClose={() => setSheet(null)} anchor={tempoChip.current} value={jamTempo.value} onChange={(v) => setTempo(v)} />
    </div>
  );
}
