// Verse | Chorus (SPEC.md §5.9, DESIGN.md §6 "Section switch"). Shows the section on screen (with the
// song form on, it follows the form) and switches the one that loops; while playing, the switch lands
// on the next bar line.
import { computed } from '@preact/signals';
import { SECTIONS, type Section } from '../../theory/song';
import { chooseSection, formOn, itemAt, section } from '../state/jam';
import { playhead } from '../state/playback';

/** The section on screen: the one playing (it follows the song form), else the chosen one. */
export const shownSection = computed<Section>(() => {
  const p = playhead.value;
  const live = p.phase !== 'stopped' && p.slotIndex !== null;
  return (live ? itemAt(p.slotIndex)?.section : undefined) ?? section.value;
});

const LABEL: Record<Section, string> = { verse: 'Verse', chorus: 'Chorus' };

export function SectionSwitch() {
  return (
    <div class="sections-wrap">
      <div class="sections" role="radiogroup" aria-label="Section">
        {SECTIONS.map((s) => (
          <button role="radio" aria-checked={shownSection.value === s} onClick={() => chooseSection(s)}>
            {LABEL[s]}
          </button>
        ))}
      </div>
      {formOn.value && <span class="form-tag">Song form</span>}
    </div>
  );
}
