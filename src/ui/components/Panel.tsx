// The floating panel (SPEC.md §4.1, DESIGN.md §6.5–6.9): playback row and settings chips. Pickers
// for vibe, key and tempo open above it.
import { formatKey } from '../../theory/keys';
import * as jam from '../state/jam';
import { engineState, playhead, togglePlay } from '../state/playback';
import { clickOn, countInOn } from '../state/sound';
import { openPicker, showStatus, type PickerName } from '../state/ui';
import { BackIcon, ChevronIcon, MetronomeIcon, PauseIcon, PlayIcon, RerollIcon } from './icons';
import { Picker, triggerId } from './Picker';

function Chip({ name, grow, children }: { name: PickerName; grow?: boolean; children: preact.ComponentChildren }) {
  const open = openPicker.value === name;
  return (
    <button
      class={`chip fill${grow ? ' grow' : ''}`}
      id={triggerId(name)}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        openPicker.value = open ? null : name;
      }}
    >
      {children}
    </button>
  );
}

const Held = () => <span class="held">HELD</span>;

export function Panel() {
  const active = engineState.value === 'playing' || engineState.value === 'count-in';
  const p = playhead.value;
  const beat = p.phase === 'count-in' && p.countInBeat ? String(p.countInBeat) : '';
  const panelPicker = openPicker.value && openPicker.value !== 'sound' ? openPicker.value : null;
  return (
    <div class="panel">
      {panelPicker && <Picker name={panelPicker} placement="panel" />}
      <div class="panel-grid">
        <div class="row actions">
          <div class="pair" role="group" aria-label="Timing">
            <button class="half count" aria-pressed={countInOn.value} aria-label="Count-in" data-beat={beat} onClick={() => (countInOn.value = !countInOn.value)}>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </button>
            <button class="half" aria-pressed={clickOn.value} aria-label="Metronome" onClick={() => (clickOn.value = !clickOn.value)}>
              <MetronomeIcon />
            </button>
          </div>
          <button
            class="round fill"
            aria-label="Previous progression"
            aria-disabled={!jam.canGoBack.value}
            onClick={() => {
              if (!jam.back()) showStatus('No earlier progression yet');
            }}
          >
            <BackIcon />
          </button>
          <button class="reroll inv" onClick={jam.reroll}>
            <RerollIcon />
            Re-roll
          </button>
          <button class="play" aria-label={active ? 'Pause' : engineState.value === 'locked-audio' ? 'Play (turns on sound)' : 'Play'} onClick={() => void togglePlay()}>
            {active ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
        <div class="row settings">
          <Chip name="vibe" grow>
            {jam.vibe.value.name}
            <ChevronIcon />
          </Chip>
          <Chip name="key">
            {formatKey(jam.key.value)}
            {jam.keyHeld.value && <Held />}
          </Chip>
          <Chip name="tempo">
            <span class="bpm">{jam.tempo.value}</span> <span class="k">BPM</span>
            {jam.tempoHeld.value && <Held />}
          </Chip>
        </div>
      </div>
    </div>
  );
}
