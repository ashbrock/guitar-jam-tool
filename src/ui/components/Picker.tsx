// Pickers (SPEC.md §3, DESIGN.md §6: picker components). One open at a time; they close on Esc, a tap outside,
// or their trigger. Focus moves into the picker on open and back to its trigger on close.
import { useEffect, useRef, useState } from 'preact/hooks';
import { VIBES } from '../../data/vibes/index';
import { KEY_TONICS, formatKey } from '../../theory/keys';
import { pc } from '../../theory/notes';
import * as jam from '../state/jam';
import { bassOn, chordsOn, clickOn, countInOn, drumsOn } from '../state/sound';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { openPicker, type PickerName } from '../state/ui';

export const triggerId = (name: PickerName) => `trigger-${name}`;
const TITLES: Record<PickerName, string> = { vibe: 'Vibe', key: 'Key', tempo: 'Tempo', settings: 'Settings' };

export function Picker({ name, placement }: { name: PickerName; placement: 'panel' | 'top' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? el?.querySelector<HTMLElement>('button, input');
    target?.focus({ preventScroll: true });
    return () => {
      // Only return focus if it was inside the picker (not if the user tapped elsewhere on purpose).
      if (!document.activeElement || document.activeElement === document.body || el?.contains(document.activeElement)) {
        document.getElementById(triggerId(name))?.focus({ preventScroll: true });
      }
    };
  }, [name]);
  return (
    <div class={`pop pop-${placement}`} ref={ref} role="dialog" aria-modal="false" aria-label={TITLES[name]} data-picker>
      {name !== 'settings' && <h2>{TITLES[name]}</h2>}
      {name === 'vibe' && <VibePicker />}
      {name === 'key' && <KeyPicker />}
      {name === 'tempo' && <TempoPicker />}
      {name === 'settings' && <SettingsPicker />}
    </div>
  );
}

export function SwitchRow({ id, on, label, hint, onToggle }: { id: string; on: boolean; label: string; hint: string; onToggle: () => void }) {
  return (
    <button class="switch-row fill-1" id={id} role="switch" aria-checked={on} onClick={onToggle}>
      <span>
        {label}
        <small>{hint}</small>
      </span>
      <span class="sw" aria-hidden="true" />
    </button>
  );
}

function VibePicker() {
  return (
    <>
      <div class="opt-list" role="radiogroup" aria-label="Vibe">
        {VIBES.map((v) => (
          <button
            class="opt fill-1"
            role="radio"
            aria-checked={v.id === jam.vibeId.value}
            onClick={() => {
              jam.chooseVibe(v.id);
              openPicker.value = null;
            }}
          >
            <span>
              {v.name}
              <span class="d">{v.descriptor}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function KeyPicker() {
  const k = jam.key.value;
  const tonics = KEY_TONICS[k.mode];
  return (
    <>
      <div class="seg2" role="radiogroup" aria-label="Mode">
        {(['major', 'minor'] as const).map((m) => (
          <button class="fill-1" role="radio" aria-checked={k.mode === m} onClick={() => jam.chooseMode(m)}>
            {m === 'major' ? 'Major' : 'Minor'}
          </button>
        ))}
      </div>
      <div class="keys" role="radiogroup" aria-label="Key">
        {tonics.map((t) => (
          <button class="fill-1" role="radio" aria-checked={pc(t) === pc(k.tonic)} onClick={() => jam.chooseTonic(t)}>
            {formatKey({ tonic: t, mode: k.mode }).split(' ')[0]}
          </button>
        ))}
      </div>
      <SwitchRow id="hold-key" on={jam.keyHeld.value} label="Hold key" hint="Re-roll won’t change it" onToggle={() => (jam.keyHeld.value = !jam.keyHeld.value)} />
    </>
  );
}

function TempoPicker() {
  const t = jam.tempo.value;
  const range = jam.vibe.value.playback.tempo;
  const [taps, setTaps] = useState<number[]>([]);
  const tap = () => {
    const now = performance.now();
    const next = [...taps.filter((x) => now - x < 2000), now].slice(-5);
    setTaps(next);
    if (next.length >= 2) jam.setTempo(Math.round(60000 / ((next[next.length - 1]! - next[0]!) / (next.length - 1))));
  };
  return (
    <>
      <div class="tempo">
        <button class="fill step" aria-label="Slower" onClick={() => jam.setTempo(t - 1)}>
          −
        </button>
        <div class="num" aria-live="polite">
          {t}
          <span>BPM</span>
        </div>
        <button class="fill step" aria-label="Faster" onClick={() => jam.setTempo(t + 1)}>
          +
        </button>
      </div>
      <input type="range" min={40} max={240} step={1} value={t} aria-label="Tempo" onInput={(e) => jam.setTempo(Number(e.currentTarget.value))} />
      <button class="tap fill" onClick={tap}>
        Tap tempo
      </button>
      <SwitchRow id="hold-tempo" on={jam.tempoHeld.value} label="Hold tempo" hint="Re-roll won’t change it" onToggle={() => (jam.tempoHeld.value = !jam.tempoHeld.value)} />
      <p class="note">
        {jam.vibe.value.name} usually sits between {range.min} and {range.max} BPM.
      </p>
    </>
  );
}

/** Settings (SPEC.md §4.5): Sound opens a second view in place; count-in and metronome are switches. */
function SettingsPicker() {
  const [view, setView] = useState<'main' | 'sound'>('main');
  const root = useRef<HTMLDivElement>(null);
  const go = (v: 'main' | 'sound') => {
    setView(v);
    // Move focus into the new view: its back button, or the row that opened the sub-view.
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(v === 'sound' ? '.view-back' : '#open-sound')?.focus());
  };
  return (
    <div ref={root}>
      {view === 'main' ? (
        <>
          <h2>Settings</h2>
          <button class="nav-row fill-1" id="open-sound" onClick={() => go('sound')}>
            <span>
              Sound
              <small>Chords, bass and drums</small>
            </span>
            <ChevronRightIcon />
          </button>
          <SwitchRow id="count-in" on={countInOn.value} label="Count-in" hint="One bar of clicks before playing" onToggle={() => (countInOn.value = !countInOn.value)} />
          <SwitchRow id="metronome" on={clickOn.value} label="Metronome" hint="A click on every beat" onToggle={() => (clickOn.value = !clickOn.value)} />
        </>
      ) : (
        <>
          <button class="view-back" onClick={() => go('main')} aria-label="Back to Settings">
            <ChevronLeftIcon />
            <span>Sound</span>
          </button>
          <SoundView />
        </>
      )}
    </div>
  );
}

function SoundView() {
  return (
    <>
      <SwitchRow id="part-chords" on={chordsOn.value} label="Chords" hint="Wurlitzer electric piano" onToggle={() => (chordsOn.value = !chordsOn.value)} />
      <SwitchRow id="part-bass" on={bassOn.value} label="Bass" hint="Flatwound bass, following the vibe" onToggle={() => (bassOn.value = !bassOn.value)} />
      <SwitchRow id="part-drums" on={drumsOn.value} label="Drums" hint="Kick, snare and hat in the vibe’s groove" onToggle={() => (drumsOn.value = !drumsOn.value)} />
      <p class="credit">
        Wurlitzer EP200 samples by{' '}
        <a href="http://www.sullivang.net/" target="_blank" rel="noopener">
          Greg Sullivan
        </a>
        ,{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">
          CC BY 3.0
        </a>
        . Bass: Swagbass by{' '}
        <a href="https://karoryfer.com/" target="_blank" rel="noopener">
          Karoryfer Samples
        </a>
        . Drums: Virtuosity Drums by{' '}
        <a href="https://versilian-studios.com/" target="_blank" rel="noopener">
          Versilian Studios
        </a>{' '}
        (both CC0).
      </p>
    </>
  );
}
