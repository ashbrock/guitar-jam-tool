// Bottom sheet on phones, anchored popover on desktop (SPEC.md §3.4, DESIGN.md §9.7).
// Built on <dialog>: native focus trapping, Esc to close, inert background, and focus returns to the
// trigger on close. Swipe the handle down or tap outside to dismiss. Sheets never stop playback.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { CloseIcon } from '../icons';
import './Sheet.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The element that opened the sheet; on desktop the popover is placed next to it. */
  anchor?: HTMLElement | null;
  children: ComponentChildren;
}

const DESKTOP = '(min-width: 1024px)';
const DISMISS_DISTANCE = 80;

export function Sheet({ open, onClose, title, anchor, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ start: number; dy: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      position(d, anchor ?? null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, anchor]);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { start: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.start);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current || !ref.current) return;
    const dismissed = drag.current.dy > DISMISS_DISTANCE;
    ref.current.style.transform = '';
    drag.current = null;
    if (dismissed) onClose();
  };

  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (e.target === ref.current) onClose();
      }}
    >
      <div class="sheet__body">
        <div
          class="sheet__handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        >
          <span />
        </div>
        <header class="sheet__header">
          <h2 id="sheet-title" class="sheet__title">
            {title}
          </h2>
          <button type="button" class="btn btn--ghost sheet__close" onClick={onClose} aria-label={`Close ${title}`}>
            <CloseIcon />
          </button>
        </header>
        <div class="sheet__content">{children}</div>
      </div>
    </dialog>
  );
}

function position(d: HTMLDialogElement, anchor: HTMLElement | null): void {
  if (!anchor || !window.matchMedia(DESKTOP).matches) {
    d.style.removeProperty('--anchor-top');
    d.style.removeProperty('--anchor-left');
    d.classList.remove('sheet--anchored');
    return;
  }
  const r = anchor.getBoundingClientRect();
  d.classList.add('sheet--anchored');
  d.style.setProperty('--anchor-top', `${Math.round(r.bottom + 8)}px`);
  d.style.setProperty('--anchor-left', `${Math.round(r.left)}px`);
}
