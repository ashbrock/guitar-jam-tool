// The progression as a carousel of chord cards (SPEC.md §5.2, DESIGN.md §6.2). The current chord is
// always centred; the rest of the loop sits either side and slides along, wrapping at the loop point.
import { signal } from '@preact/signals';
import { useLayoutEffect, useRef, useState, useEffect } from 'preact/hooks';
import { spokenChord } from '../../theory/chords';
import { basicQuality, basicShape } from '../../theory/shapes';
import { itemAt, section, songChords } from '../state/jam';
import { engine, playhead } from '../state/playback';
import { progressBar } from '../frame';
import { ChordChart } from './ChordChart';
import { ChordName } from './ChordName';

/** The card centred while stopped: the first, or the last one tapped. */
export const selected = signal(0);

const WIDE = 900;
const useWide = () => {
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= WIDE);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
};

export function Carousel() {
  const wide = useWide();
  const p = playhead.value;
  const live = p.phase !== 'stopped' && p.slotIndex !== null;
  const item = live ? itemAt(p.slotIndex) : undefined;
  // The section on screen: the one playing (it follows the song form), else the chosen one.
  const shown = item?.section ?? section.value;
  const cs = songChords.value[shown];
  const n = cs.length;
  const cur = Math.min(n - 1, Math.max(0, live && item ? item.index : selected.value));
  const chartW = wide ? 210 : 156;

  const list = useRef<HTMLOListElement>(null);
  const lastRel = useRef<number[]>([]);
  const lastCur = useRef<number | null>(null);

  // Place the cards. Imperative so a card that wraps from one end to the other can skip its transition.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const behind = Math.min(wide ? 3 : 2, Math.floor((n - 1) / 3));
    const ahead = wide ? 4 : 3;
    const cw = chartW + 28;
    const small = wide ? 0.68 : 0.6;
    const gap = wide ? 24 : 14;
    const otherW = cw * small;
    const animate = lastCur.current !== null;
    el.querySelectorAll<HTMLElement>(':scope > li').forEach((li, i) => {
      let rel = (((i - cur) % n) + n) % n;
      if (rel >= n - behind) rel -= n;
      const x = rel === 0 ? 0 : Math.sign(rel) * (cw / 2 + gap + otherW / 2 + (Math.abs(rel) - 1) * (otherW + gap));
      const wrapped = lastRel.current[i] !== undefined && Math.abs(lastRel.current[i]! - rel) > 1;
      if (!animate || wrapped) li.style.transition = 'none';
      li.style.transform = `translate(calc(-50% + ${x}px), -50%) scale(${rel === 0 ? 1 : small})`;
      li.classList.toggle('now', rel === 0);
      li.classList.toggle('past', rel < 0);
      li.classList.toggle('hidden', rel < -behind || rel > ahead);
      if (!animate || wrapped) {
        void li.offsetWidth;
        li.style.transition = '';
      }
      lastRel.current[i] = rel;
    });
    lastCur.current = cur;
    progressBar.el = el.querySelector<HTMLElement>('li.now .bar i');
    progressBar.slot = cur;
    progressBar.section = shown;
  }, [cur, n, wide, cs, shown, p.phase === 'count-in']);

  // A new progression: start the layout fresh (no slide from the old one).
  useLayoutEffect(() => {
    lastRel.current = [];
    lastCur.current = null;
    if (!live) selected.value = 0;
  }, [cs]);

  return (
    <ol class="carousel" ref={list} aria-label="Progression" style={{ '--card-w': `${chartW + 28}px` }}>
      {cs.map((c, i) => {
        const q = basicQuality(c.chord);
        const shape = q !== null ? basicShape(c.chord, q) : null;
        const isNow = i === cur;
        return (
          <li key={`${i}-${spokenChord(c.chord)}`} class="card-slot">
            <button
              class="card"
              aria-label={spokenChord(c.chord)}
              aria-current={isNow ? 'true' : undefined}
              data-index={i}
              onClick={() => {
                if (playhead.value.phase === 'stopped') selected.value = i;
                void engine.previewChord(c.chord);
              }}
            >
              {shape && <ChordChart shape={shape} width={chartW} />}
              <ChordName chord={c.chord} />
              {isNow && p.phase === 'count-in' ? (
                <span class="beats" aria-hidden="true">
                  {[1, 2, 3, 4].map((b) => (
                    <i class={p.countInBeat !== null && b <= p.countInBeat ? 'on' : ''} />
                  ))}
                </span>
              ) : (
                <span class="bar" aria-hidden="true">
                  <i />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
