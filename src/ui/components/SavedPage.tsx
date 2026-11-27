// My progressions (SPEC.md §5.10, DESIGN.md §6 "My progressions"): a full page over Jam listing saved
// progressions, newest first. Tapping one puts it on the Jam screen; Back returns to Jam exactly as it
// was. Delete takes two taps (the button turns into "Delete" to confirm), so nothing goes by accident.
import { useEffect, useRef, useState } from 'preact/hooks';
import { rollChordNames } from '../state/jam';
import { currentSaved, openSaved, removeSaved, saved, savedDate, savedLabel } from '../state/saved';
import { page, showStatus } from '../state/ui';
import { ChevronLeftIcon, TrashIcon } from './icons';
import { vibeById } from '../../data/vibes/index';
import { formatKey } from '../../theory/keys';

/** Back to Jam, with focus on the button that opened this page. */
export function closeSaved(): void {
  page.value = 'main';
  requestAnimationFrame(() => document.getElementById('open-saved')?.focus({ preventScroll: true }));
}

export function SavedPage() {
  const title = useRef<HTMLHeadingElement>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);
  // A confirm left alone goes back to the bin icon.
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  const list = saved.value;
  const current = currentSaved.value?.id;
  return (
    <div class="saved-page">
      <header class="saved-top">
        <button class="view-back" onClick={closeSaved} aria-label="Back to Jam">
          <ChevronLeftIcon />
          <span>Jam</span>
        </button>
      </header>
      <main class="saved-main" aria-labelledby="saved-title">
        <h1 id="saved-title" ref={title} tabIndex={-1}>
          My progressions
        </h1>
        {list.length === 0 ? (
          <p class="saved-empty">Nothing saved yet. Tap the heart on the Jam screen to keep a progression here.</p>
        ) : (
          <ul class="saved-list">
            {list.map((e) => {
              const names = rollChordNames(e);
              const label = savedLabel(e);
              const confirming = confirm === e.id;
              return (
                <li class="saved-item" key={e.id}>
                  <button
                    class={`saved-open${e.id === current ? ' now' : ''}`}
                    aria-current={e.id === current ? 'true' : undefined}
                    aria-label={`${label}, saved ${savedDate(e.savedAt)}. Verse: ${names.verse.join(', ')}. Chorus: ${names.chorus.join(', ')}.`}
                    onClick={() => {
                      openSaved(e.id);
                      closeSaved();
                    }}
                  >
                    <span class="saved-head" aria-hidden="true">
                      <span class="saved-label">{vibeById(e.vibeId)?.name}</span>
                      <span class="saved-date">{savedDate(e.savedAt)}</span>
                    </span>
                    <span class="saved-meta" aria-hidden="true">
                      {formatKey(e.key)} · {e.tempo} BPM
                    </span>
                    <span class="saved-chords" aria-hidden="true">
                      <span>
                        <b>Verse</b> {names.verse.join('  ')}
                      </span>
                      <span>
                        <b>Chorus</b> {names.chorus.join('  ')}
                      </span>
                    </span>
                  </button>
                  <button
                    class={`saved-del${confirming ? ' confirm' : ''}`}
                    aria-label={confirming ? `Confirm delete ${label}` : `Delete ${label}`}
                    onClick={() => {
                      if (!confirming) return setConfirm(e.id);
                      removeSaved(e.id);
                      setConfirm(null);
                      showStatus('Progression deleted', 2000);
                    }}
                    onBlur={() => confirming && setConfirm(null)}
                  >
                    {confirming ? 'Delete' : <TrashIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
