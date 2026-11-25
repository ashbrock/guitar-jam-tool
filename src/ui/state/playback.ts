// Bridges the audio engine to the UI. The UI reads these signals and calls these functions; it never
// touches the engine's internals. The playhead is read from the audio clock once per animation frame
// (see useFrameLoop), so anything tied to the beat follows what's audible and never leads it.
import { signal } from '@preact/signals';
import { createEngine, type EngineState } from '../../audio/engine';
import type { Playhead } from '../../audio/transport';
import { showStatus } from './ui';

export const engine = createEngine();

export interface UiPlayhead {
  phase: Playhead['phase'];
  countInBeat: number | null;
  slotIndex: number | null;
}

export const engineState = signal<EngineState>(engine.state);
/** Coarse playhead for components: changes at most once per beat. */
export const playhead = signal<UiPlayhead>({ phase: 'stopped', countInBeat: null, slotIndex: null });

/** Called from the frame loop with the fine-grained playhead; only updates the signal on a change. */
export function syncPlayhead(p: Playhead): void {
  const cur = playhead.value;
  if (p.phase !== cur.phase || p.countInBeat !== cur.countInBeat || p.slotIndex !== cur.slotIndex) {
    playhead.value = { phase: p.phase, countInBeat: p.countInBeat, slotIndex: p.slotIndex };
  }
}

export const isActive = () => engineState.value === 'count-in' || engineState.value === 'playing';

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let silentHintShown = false;

engine.subscribe((e) => {
  if (e.type === 'state') {
    engineState.value = e.state;
    void syncWakeLock(e.state === 'playing' || e.state === 'count-in');
    // SPEC.md §12.3: on iOS the silent switch can mute web audio undetectably.
    if (e.state === 'playing' && isIOS() && !silentHintShown) {
      silentHintShown = true;
      showStatus('No sound? Check your silent switch.', 6000);
    }
  }
  if (e.type === 'blocked') showStatus('Your browser blocked sound. Tap Play to try again.', null);
  if (e.type === 'interrupted') showStatus('Playback paused', 4000);
  if (e.type === 'instrument') {
    if (e.status === 'loading') showStatus(`Loading instruments · ${Math.round(e.progress * 100)}%`, null);
    else if (e.status === 'ready') showStatus('Instruments ready', 600);
    else if (e.status === 'failed') showStatus(`Couldn’t load ${e.failed.join(', ')}. Using the synth for ${e.failed.length > 1 ? 'those' : 'that'}.`, 4000);
  }
});

export async function togglePlay(): Promise<void> {
  await engine.togglePlay();
}

// ---------- Screen wake lock while playing (SPEC.md §12.3) ----------

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
let wakeLock: WakeLockSentinelLike | null = null;

async function syncWakeLock(on: boolean): Promise<void> {
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
  try {
    if (on && !wakeLock && nav.wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null; // not allowed or not supported: nothing to do
  }
}

// The browser drops the wake lock when the page is hidden; take it again on return if still playing.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    wakeLock = null;
    void syncWakeLock(isActive());
  }
});
