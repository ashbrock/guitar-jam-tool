// Vibe "sleeves" (DESIGN.md §9.6): a horizontal rail on phones, a vertical list on desktop.
// Radio semantics with arrow-key navigation; choosing a vibe regenerates unlocked chords right away.
import { useRef } from 'preact/hooks';
import { VIBES } from '../../data/vibes/index';
import { CheckIcon } from '../icons';
import './VibeRail.css';

export function VibeRail({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = VIBES.findIndex((v) => v.id === value);
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = VIBES[(i + dir + VIBES.length) % VIBES.length]!;
    onChange(next.id);
    queueMicrotask(() => {
      const el = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]');
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };
  return (
    <div ref={ref} class="vibe-rail" role="radiogroup" aria-label="Vibe" onKeyDown={onKeyDown}>
      {VIBES.map((v) => {
        const selected = v.id === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            class={`sleeve ${selected ? 'is-selected' : ''}`}
            onClick={() => onChange(v.id)}
          >
            <span class="sleeve__top">
              <span class="sleeve__name">{v.name}</span>
              {selected && <CheckIcon class="sleeve__check" />}
            </span>
            <span class="sleeve__descriptor">{v.descriptor}</span>
            <span class="sleeve__refs">{v.references.slice(0, 3).join(' · ')}</span>
          </button>
        );
      })}
    </div>
  );
}
