// The status pill (DESIGN.md §6, "Loading pill"): instrument loading, disabled-control reasons, audio problems.
import { useEffect, useState } from 'preact/hooks';
import { status, clearStatus } from '../state/ui';

export function StatusPill() {
  const s = status.value;
  const [fading, setFading] = useState(false);
  useEffect(() => {
    setFading(false);
    if (!s || s.ttl === null) return;
    const fade = setTimeout(() => setFading(true), s.ttl);
    const gone = setTimeout(() => clearStatus(), s.ttl + 400);
    return () => (clearTimeout(fade), clearTimeout(gone));
  }, [s?.id]);
  return (
    <p class={`status${fading ? ' fading' : ''}`} role="status" aria-live="polite" hidden={!s}>
      {s?.text}
    </p>
  );
}
