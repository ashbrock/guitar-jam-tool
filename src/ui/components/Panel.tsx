// The floating panel (SPEC.md §4.1, DESIGN.md §6: panel, action row, vibe row). Row 1: icon buttons for Undo, Re-roll, Play,
// Tempo and Key. Row 2: the vibe, with the current key and tempo shown quietly beside it.
// The vibe, tempo and key pickers open above the panel.
import type { ComponentChildren } from 'preact';
import { formatKey } from '../../theory/keys';
import * as jam from '../state/jam';
import { engineState, togglePlay } from '../state/playback';
import { openPicker, showStatus, type PickerName } from '../state/ui';
import { BackIcon, ChevronIcon, HashIcon, MetronomeIcon, PauseIcon, PlayIcon, RerollIcon } from './icons';
import { Picker, triggerId } from './Picker';

/** An icon button that opens a picker. A dot marks a held value. */
function PickerButton({ name, label, held, children }: { name: PickerName; label: string; held?: boolean; children: ComponentChildren }) {
  const open = openPicker.value === name;
  return (
    <button
      class="icon-btn fill"
      id={triggerId(name)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        openPicker.value = open ? null : name;
      }}
    >
      {children}
      {held && <span class="held-dot" aria-hidden="true" />}
    </button>
  );
}

export function Panel() {
  const active = engineState.value === 'playing' || engineState.value === 'count-in';
  const panelPicker = openPicker.value && openPicker.value !== 'settings' ? openPicker.value : null;
  const keyText = formatKey(jam.key.value);
  const tempo = jam.tempo.value;
  const vibeOpen = openPicker.value === 'vibe';
  return (
    <div class="panel">
      {panelPicker && <Picker name={panelPicker} placement="panel" />}
      <div class="panel-grid">
        <div class="row actions">
          <button
            class="icon-btn fill"
            aria-label="Undo: previous progression"
            aria-disabled={!jam.canGoBack.value}
            onClick={() => {
              if (!jam.back()) showStatus('No earlier progression yet');
            }}
          >
            <BackIcon />
          </button>
          <button class="icon-btn inv" aria-label="Re-roll" onClick={jam.reroll}>
            <RerollIcon />
          </button>
          <button class="icon-btn play" aria-label={active ? 'Pause' : engineState.value === 'locked-audio' ? 'Play (turns on sound)' : 'Play'} onClick={() => void togglePlay()}>
            {active ? <PauseIcon /> : <PlayIcon />}
          </button>
          <PickerButton name="tempo" label={`Tempo, ${tempo} BPM${jam.tempoHeld.value ? ', held' : ''}`} held={jam.tempoHeld.value}>
            <MetronomeIcon />
          </PickerButton>
          <PickerButton name="key" label={`Key, ${keyText}${jam.keyHeld.value ? ', held' : ''}`} held={jam.keyHeld.value}>
            <HashIcon />
          </PickerButton>
        </div>
        <div class="row settings">
          <button
            class="chip fill vibe-chip"
            id={triggerId('vibe')}
            aria-haspopup="dialog"
            aria-expanded={vibeOpen}
            aria-label={`Vibe, ${jam.vibe.value.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openPicker.value = vibeOpen ? null : 'vibe';
            }}
          >
            <span class="vibe-name">{jam.vibe.value.name}</span>
            <span class="vibe-meta" aria-hidden="true">
              {keyText} · {tempo} BPM
            </span>
            <ChevronIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
