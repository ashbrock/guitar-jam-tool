// Sound settings (SPEC.md §4.5). Global to both modes; applied to the engine whenever they change.
import { effect, signal } from '@preact/signals';
import { engine } from './playback';

export const chordsOn = signal(true);
export const bassOn = signal(true);
/** On by default, like the other instruments (SPEC A8, revised). */
export const drumsOn = signal(true);
/** The metronome click during playback. Off by default. */
export const clickOn = signal(false);
/** One bar of clicks before playback. An option, off by default. */
export const countInOn = signal(false);
/** All sound off, loop still running: for playing along with a band. Off by default. */
export const muted = signal(false);

effect(() => {
  engine.setParts({ chords: chordsOn.value, bass: bassOn.value, click: clickOn.value, drums: drumsOn.value });
  engine.setCountIn(countInOn.value);
  engine.setMuted(muted.value);
});
