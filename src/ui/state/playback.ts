// Bridges the audio engine to UI signals. The UI reads these signals; it never touches the engine's
// internals. The playhead is polled from the audio clock each animation frame while playing, so
// visuals follow what is audible and never lead it (DESIGN.md §10.4).
import { signal } from '@preact/signals';
import { createEngine, type EngineState } from '../../audio/engine';
import type { Playhead } from '../../audio/transport';

export const engine = createEngine();

export interface UiPlayhead {
  phase: Playhead['phase'];
  countInBeat: number | null;
  beat: number;
  slotIndex: number | null;
}

export const engineState = signal<EngineState>(engine.state);
export const playhead = signal<UiPlayhead>({ phase: 'stopped', countInBeat: null, beat: 0, slotIndex: null });
export const audioBlocked = signal(false);
export const interrupted = signal(false);

let raf = 0;

function readPlayhead(): void {
  const p = engine.playhead();
  const cur = playhead.value;
  if (p.phase !== cur.phase || p.countInBeat !== cur.countInBeat || p.beat !== cur.beat || p.slotIndex !== cur.slotIndex) {
    playhead.value = { phase: p.phase, countInBeat: p.countInBeat, beat: p.beat, slotIndex: p.slotIndex };
  }
}

function loop(): void {
  readPlayhead();
  raf = requestAnimationFrame(loop);
}

engine.subscribe((e) => {
  if (e.type === 'state') {
    engineState.value = e.state;
    cancelAnimationFrame(raf);
    if (e.state === 'count-in' || e.state === 'playing') loop();
    else readPlayhead();
  }
  if (e.type === 'blocked') audioBlocked.value = true;
  if (e.type === 'interrupted') interrupted.value = true;
});

export async function togglePlay(): Promise<void> {
  audioBlocked.value = false;
  interrupted.value = false;
  await engine.togglePlay();
}

export const isActive = () => engineState.value === 'count-in' || engineState.value === 'playing';
