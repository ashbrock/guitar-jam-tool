// UI-only state: which mode is showing, which picker is open, and the status pill's message.
import { signal } from '@preact/signals';

export type Mode = 'jam' | 'solo';
export type PickerName = 'vibe' | 'settings' | 'mode';

export const mode = signal<Mode>('jam');
export const openPicker = signal<PickerName | null>(null);

/** A short message in the status pill at the top (loading, reasons, errors). */
export interface Status {
  text: string;
  /** ms before it fades; null = stays until replaced. */
  ttl: number | null;
  id: number;
}
export const status = signal<Status | null>(null);
let statusId = 0;
export function showStatus(text: string, ttl: number | null = 3000): void {
  status.value = { text, ttl, id: ++statusId };
}
export function clearStatus(): void {
  status.value = null;
}

/** Polite screen-reader announcement (SPEC.md §5.3). */
export const announcement = signal('');
export function announce(text: string): void {
  announcement.value = '';
  queueMicrotask(() => (announcement.value = text));
}
