// Segmented control (DESIGN.md §9.1): radio semantics, arrow keys move between segments.
import { useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import './Segmented.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Extra content inside the segment, e.g. the playing LED. */
  extra?: ComponentChildren;
  disabled?: boolean;
  /** Visible reason shown inside a disabled segment. */
  reason?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  class?: string;
}

export function Segmented<T extends string>({ label, value, options, onChange, class: cls }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = options.filter((o) => !o.disabled);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const i = enabled.findIndex((o) => o.value === value);
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = enabled[(i + dir + enabled.length) % enabled.length]!;
    onChange(next.value);
    queueMicrotask(() => ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div ref={ref} class={`segmented ${cls ?? ''}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={o.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            class={`segmented__item ${selected ? 'is-selected' : ''}`}
            onClick={() => !o.disabled && onChange(o.value)}
          >
            <span>{o.label}</span>
            {o.reason && <span class="caption segmented__reason">{o.reason}</span>}
            {o.extra}
          </button>
        );
      })}
    </div>
  );
}
