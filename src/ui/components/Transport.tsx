// Jam transport (SPEC.md §5.1): ⟲ Back · RE-ROLL · ▶ Play, in the bottom thumb zone.
// Disabled controls always come with a visible reason (DESIGN.md §7.1).
import type { EngineState } from '../../audio/engine';
import { BackIcon, PauseIcon, PlayIcon, RerollIcon } from '../icons';
import './Transport.css';

interface Props {
  state: EngineState;
  countInBeat: number | null;
  starting: boolean;
  canGoBack: boolean;
  allLocked: boolean;
  /** A temporary explanation, e.g. after tapping a disabled control. */
  reason: string | null;
  onBack: () => void;
  onReroll: () => void;
  onPlay: () => void;
}

/** The 4-segment count-in ring around the Play button (DESIGN.md §8). */
function CountInRing({ beat }: { beat: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const seg = c / 4;
  return (
    <svg class="play__ring" viewBox="0 0 64 64" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <circle
          cx="32"
          cy="32"
          r={r}
          class={i < beat ? 'is-on' : ''}
          stroke-dasharray={`${seg - 4} ${c - seg + 4}`}
          stroke-dashoffset={-i * seg + c / 4}
        />
      ))}
    </svg>
  );
}

export function Transport({ state, countInBeat, starting, canGoBack, allLocked, reason, onBack, onReroll, onPlay }: Props) {
  const active = state === 'playing' || state === 'count-in';
  const playLabel = starting ? 'Starting sound' : active ? (state === 'count-in' ? 'Cancel count-in' : 'Pause') : state === 'locked-audio' ? 'Play (turns on sound)' : 'Play';
  return (
    <div class="transport">
      <p class="transport__reason" role="status">
        {reason ?? (allLocked ? 'Unlock a chord to re-roll' : '')}
      </p>
      <div class="transport__row">
        <button type="button" class="btn transport__back" onClick={onBack} aria-disabled={!canGoBack || undefined} aria-label="Previous progression">
          <BackIcon />
        </button>
        <button
          type="button"
          class="btn btn--primary transport__reroll"
          onClick={() => !allLocked && onReroll()}
          aria-disabled={allLocked || undefined}
          aria-keyshortcuts="R"
        >
          <RerollIcon />
          <span>{allLocked ? 'All locked' : 'Re-roll'}</span>
        </button>
        <button type="button" class={`btn btn--primary play ${starting ? 'is-starting' : ''}`} onClick={onPlay} aria-label={playLabel} aria-keyshortcuts="Space">
          {state === 'count-in' && <CountInRing beat={countInBeat ?? 0} />}
          {starting ? <span class="play__starting" aria-hidden="true" /> : active ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </div>
  );
}
