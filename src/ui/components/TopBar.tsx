// Top bar (DESIGN.md §6.1): the mode menu ("Jam ▾") on the left, My progressions on the right.
import { mode, openPicker, page } from '../state/ui';
import { ChevronIcon } from './icons';
import { Picker, triggerId } from './Picker';

export function TopBar() {
  const open = openPicker.value === 'mode';
  return (
    <>
      <header class="top">
        <button
          class="mode-btn"
          id={triggerId('mode')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Mode, ${mode.value === 'jam' ? 'Jam' : 'Solo'}`}
          onClick={(e) => {
            e.stopPropagation();
            openPicker.value = open ? null : 'mode';
          }}
        >
          {mode.value === 'jam' ? 'Jam' : 'Solo'}
          <ChevronIcon />
        </button>
        <button
          class="link-btn"
          id="open-saved"
          onClick={() => {
            openPicker.value = null;
            page.value = 'saved';
          }}
        >
          My progressions
        </button>
      </header>
      {open && <Picker name="mode" placement="top" />}
    </>
  );
}
