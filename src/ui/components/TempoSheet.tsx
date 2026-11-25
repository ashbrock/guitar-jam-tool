// Tempo sheet (SPEC.md §4.2): big readout, –/+ with hold-to-repeat, slider and tap tempo.
import { useRef, useState } from 'preact/hooks';
import { TEMPO_RANGE } from '../../audio/transport';
import { MinusIcon, PlusIcon } from '../icons';
import { Sheet } from './Sheet';
import './TempoSheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  value: number;
  onChange: (bpm: number) => void;
}

const HOLD_DELAY = 400;
const HOLD_REPEAT = 80;
const FAST_AFTER = 1000;
const TAP_RESET = 2000;

/** Press-and-hold repeat: 1 BPM steps, speeding up to 5 BPM steps after a second (SPEC.md §4.2). */
function useHold(step: (size: number) => void) {
  const timers = useRef<{ delay?: number; repeat?: number; started: number }>({ started: 0 });
  const stop = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
  };
  const start = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    stop();
    step(1);
    timers.current.started = Date.now();
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => step(Date.now() - timers.current.started > FAST_AFTER ? 5 : 1), HOLD_REPEAT);
    }, HOLD_DELAY);
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerCancel: stop, onPointerLeave: stop };
}

export function TempoSheet({ open, onClose, anchor, value, onChange }: Props) {
  const [clamped, setClamped] = useState<string | null>(null);
  const taps = useRef<number[]>([]);
  // Keep the latest value for hold-repeat callbacks.
  const latest = useRef(value);
  latest.current = value;

  const set = (bpm: number) => {
    const v = Math.round(bpm);
    if (v > TEMPO_RANGE.max) setClamped(`Max ${TEMPO_RANGE.max}`);
    else if (v < TEMPO_RANGE.min) setClamped(`Min ${TEMPO_RANGE.min}`);
    else setClamped(null);
    const c = Math.min(TEMPO_RANGE.max, Math.max(TEMPO_RANGE.min, v));
    latest.current = c;
    onChange(c);
  };

  const down = useHold((size) => set(latest.current - size));
  const up = useHold((size) => set(latest.current + size));

  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < TAP_RESET);
    t.push(now);
    taps.current = t.slice(-5); // last 4 intervals
    if (taps.current.length >= 2) {
      const intervals = taps.current.slice(1).map((x, i) => x - taps.current[i]!);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      set(60000 / avg);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tempo" anchor={anchor}>
      <div class="tempo">
        <button type="button" class="btn tempo__step" aria-label="Slower by 1 BPM" {...down} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), set(value - 1))}>
          <MinusIcon />
        </button>
        <div class="tempo__readout" aria-live="polite">
          <span class="mono tempo__value">{value}</span>
          <span class="caption tempo__unit">BPM</span>
        </div>
        <button type="button" class="btn tempo__step" aria-label="Faster by 1 BPM" {...up} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), set(value + 1))}>
          <PlusIcon />
        </button>
      </div>
      <p class="tempo__clamp" role="status">
        {clamped ?? ' '}
      </p>
      <label class="tempo__slider">
        <span class="visually-hidden">Tempo</span>
        <input
          type="range"
          min={TEMPO_RANGE.min}
          max={TEMPO_RANGE.max}
          step={1}
          value={value}
          aria-valuetext={`${value} BPM`}
          onInput={(e) => set(Number((e.target as HTMLInputElement).value))}
        />
      </label>
      <div class="tempo__range mono" aria-hidden="true">
        <span>{TEMPO_RANGE.min}</span>
        <span>{TEMPO_RANGE.max}</span>
      </div>
      <button type="button" class="btn tempo__tap" onClick={tap}>
        Tap tempo
      </button>
    </Sheet>
  );
}
