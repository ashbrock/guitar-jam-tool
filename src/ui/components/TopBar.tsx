// Top bar (DESIGN.md §6.1): mode tabs on the left, the Sound picker on the right.
import { engine } from '../state/playback';
import { mode, openPicker, type Mode } from '../state/ui';
import { SlidersIcon } from './icons';
import { Picker, triggerId } from './Picker';

export function TopBar() {
  const open = openPicker.value === 'sound';
  const go = (m: Mode) => {
    if (m === mode.value) return;
    engine.pause(); // SPEC.md §3.2: switching modes stops playback
    openPicker.value = null;
    mode.value = m;
  };
  return (
    <>
      <header class="top">
        <nav class="tabs" aria-label="Mode">
          {(['jam', 'solo'] as const).map((m) => (
            <button class={`tab${mode.value === m ? ' on' : ''}`} aria-current={mode.value === m ? 'page' : undefined} onClick={() => go(m)}>
              {m === 'jam' ? 'Jam' : 'Solo'}
            </button>
          ))}
        </nav>
        <button
          class="sound fill"
          id={triggerId('sound')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            openPicker.value = open ? null : 'sound';
          }}
        >
          <SlidersIcon />
          Sound
        </button>
      </header>
      {open && <Picker name="sound" placement="top" />}
    </>
  );
}
