// The bottom panel (SPEC.md §4.1, DESIGN.md §6: panel, action row, vibe row). Row 1: Settings, Save,
// Re-roll (the largest: the tool's main act), Play and Mute. Row 2: the vibe, with the key and tempo
// beside it. The vibe and settings sheets open above the panel.
import { formatKey } from '../../theory/keys';
import * as jam from '../state/jam';
import { engineState, togglePlay } from '../state/playback';
import { muted } from '../state/sound';
import { openPicker, showStatus } from '../state/ui';
import { ChevronIcon, HeartIcon, MutedIcon, PauseIcon, PlayIcon, RerollIcon, SettingsIcon, SoundIcon } from './icons';
import { Picker, triggerId } from './Picker';

export function Panel() {
  const active = engineState.value === 'playing' || engineState.value === 'count-in';
  const sheet = openPicker.value === 'vibe' || openPicker.value === 'settings' ? openPicker.value : null;
  const keyText = formatKey(jam.key.value);
  const toggle = (name: 'vibe' | 'settings') => (e: MouseEvent) => {
    e.stopPropagation();
    openPicker.value = openPicker.value === name ? null : name;
  };
  return (
    <div class="panel">
      {sheet && <Picker name={sheet} placement="panel" />}
      <div class="panel-grid">
        <div class="row actions">
          <button
            class="icon-btn fill"
            id={triggerId('settings')}
            aria-haspopup="dialog"
            aria-expanded={openPicker.value === 'settings'}
            aria-label="Settings"
            onClick={toggle('settings')}
          >
            <SettingsIcon />
          </button>
          {/* Saving arrives in the next step. */}
          <button class="icon-btn fill" aria-label="Save progression" aria-disabled="true" onClick={() => showStatus('Saving is coming soon')}>
            <HeartIcon />
          </button>
          <button class="icon-btn inv hero" aria-label="Re-roll" onClick={jam.reroll}>
            <RerollIcon />
          </button>
          <button
            class="icon-btn fill"
            aria-label={active ? 'Pause' : engineState.value === 'locked-audio' ? 'Play (turns on sound)' : 'Play'}
            onClick={() => void togglePlay()}
          >
            {active ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button class="icon-btn fill mute" aria-label="Mute" aria-pressed={muted.value} onClick={() => (muted.value = !muted.value)}>
            {muted.value ? <MutedIcon /> : <SoundIcon />}
          </button>
        </div>
        <div class="row settings">
          <button
            class="chip fill vibe-chip"
            id={triggerId('vibe')}
            aria-haspopup="dialog"
            aria-expanded={openPicker.value === 'vibe'}
            aria-label={`Vibe, ${jam.vibe.value.name}, ${keyText}, ${jam.tempo.value} BPM`}
            onClick={toggle('vibe')}
          >
            <span class="vibe-name">{jam.vibe.value.name}</span>
            <span class="vibe-meta" aria-hidden="true">
              {keyText} · {jam.tempo.value} BPM
            </span>
            <ChevronIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
