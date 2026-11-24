// The scheduler's wake-up timer. It runs in a Web Worker where possible, because browsers throttle
// main-thread timers heavily in background tabs, which would starve the look-ahead scheduler.
// Falls back to setInterval on the main thread.
import type { Ticker } from './transport';

export const TICK_MS = 25;

const WORKER_SOURCE = `
let id = null;
onmessage = (e) => {
  if (e.data === 'start' && id === null) id = setInterval(() => postMessage('tick'), ${TICK_MS});
  if (e.data === 'stop' && id !== null) { clearInterval(id); id = null; }
};`;

export function createTicker(): Ticker {
  let callback: (() => void) | null = null;
  let worker: Worker | null = null;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = () => callback?.();
  } catch {
    worker = null;
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  return {
    start(cb) {
      callback = cb;
      if (worker) worker.postMessage('start');
      else if (intervalId === null) intervalId = setInterval(() => callback?.(), TICK_MS);
    },
    stop() {
      callback = null;
      if (worker) worker.postMessage('stop');
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
