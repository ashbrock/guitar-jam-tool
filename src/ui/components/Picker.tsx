// Pickers (SPEC.md §3, DESIGN.md §6.10–6.14). One open at a time; they close on Esc, a tap outside,
// or their trigger. Focus moves into the picker on open and back to its trigger on close.
import { useEffect, useRef, useState } from 'preact/hooks';
import { VIBES } from '../../data/vibes/index';
import { KEY_TONICS, formatKey } from '../../theory/keys';
import { pc } from '../../theory/notes';
import * as jam from '../state/jam';
import { bassOn, chordsOn, drumsOn } from '../state/sound';
import { openPicker, type PickerName } from '../state/ui';

export const triggerId = (name: PickerName) => `trigger-${name}`;
const TITLES: Record<PickerName, string> = { vibe: 'Vibe', key: 'Key', tempo: 'Tempo', sound: 'Sound' };

export function Picker({ name, placement }: { name: PickerName; placement: 'panel' | 'top' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>('[aria-checked="true"]') ?? el?.querySelector<HTMLElement>('button, input');
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
      <h2>{TITLES[name]}</h2>
      {name === 'vibe' && <VibePicker />}
      {name === 'key' && <KeyPicker />}
      {name === 'tempo' && <TempoPicker />}
      {name === 'sound' && <SoundPicker />}
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
  const lengths = jam.vibe.value.params.lengths;
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
      <h2 class="sub">Length</h2>
      <div class="lens" role="radiogroup" aria-label="Length">
        {lengths.map((l) => (
          <button class="fill-1" role="radio" aria-checked={l === jam.lengthBars.value} onClick={() => jam.chooseLength(l)}>
            {l} bars
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

function SoundPicker() {
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
