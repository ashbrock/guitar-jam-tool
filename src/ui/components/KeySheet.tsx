// Key picker (SPEC.md §4.1): Major/Minor plus 12 tonics in circle-of-fifths order, in two rows of six.
import { KEY_TONICS, keyFor, type Key, type Mode } from '../../theory/keys';
import { formatNote, pc, spokenNote } from '../../theory/notes';
import { CheckIcon } from '../icons';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import './KeySheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  value: Key;
  onChange: (key: Key) => void;
}

export function KeySheet({ open, onClose, anchor, value, onChange }: Props) {
  const tonics = KEY_TONICS[value.mode];
  return (
    <Sheet open={open} onClose={onClose} title="Key" anchor={anchor}>
      <Segmented<Mode>
        label="Mode"
        value={value.mode}
        options={[
          { value: 'major', label: 'Major' },
          { value: 'minor', label: 'Minor' },
        ]}
        onChange={(mode) => onChange(keyFor(pc(value.tonic), mode))}
      />
      <div class="key-grid" role="radiogroup" aria-label="Tonic">
        {tonics.map((t) => {
          const selected = pc(t) === pc(value.tonic);
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${spokenNote(t)} ${value.mode}`}
              class={`key-grid__item ${selected ? 'is-selected' : ''}`}
              onClick={() => onChange({ tonic: t, mode: value.mode })}
            >
              <span class="key-grid__name">{formatNote(t)}</span>
              {selected && <CheckIcon class="key-grid__check" />}
            </button>
          );
        })}
      </div>
      <p class="key-sheet__hint">Changing key moves every chord, including locked ones.</p>
      <button type="button" class="btn btn--primary key-sheet__done" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}
