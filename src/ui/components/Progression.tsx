// Jam progression: chord cards in lead-sheet order (DESIGN.md §9.3), with lock toggles, the playing
// "spotlight", beat pips and the count-in numerals (DESIGN.md §8).
import { useState } from 'preact/hooks';
import { formatChord, type Chord } from '../../theory/chords';
import type { DegreeSlot } from '../../theory/generator';
import { LockClosedIcon, LockOpenIcon } from '../icons';
import type { UiPlayhead } from '../state/playback';
import { ChordSymbol } from './ChordSymbol';
import './Progression.css';

interface Props {
  slots: DegreeSlot[];
  chords: Chord[];
  playhead: UiPlayhead;
  rollId: number;
  onToggleLock: (index: number) => void;
}

const barLabel = (bars: number) => (bars === 0.5 ? '½ BAR' : bars === 1 ? '' : `${bars} BARS`);

function Pips({ beat, count = 4 }: { beat: number; count?: number }) {
  return (
    <span class="pips" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span class={`pip ${i <= beat ? 'is-on' : ''}`} />
      ))}
    </span>
  );
}

export function Progression({ slots, chords, playhead, rollId, onToggleLock }: Props) {
  return (
    <ol class="progression" aria-label="Progression">
      {slots.map((s, i) => (
        <Card key={`${rollId}-${i}`} slot={s} chord={chords[i]!} index={i} playhead={playhead} animate={rollId > 0} onToggleLock={onToggleLock} />
      ))}
    </ol>
  );
}

interface CardProps {
  slot: DegreeSlot;
  chord: Chord;
  index: number;
  playhead: UiPlayhead;
  animate: boolean;
  onToggleLock: (index: number) => void;
}

function Card({ slot: s, chord: c, index: i, playhead, animate, onToggleLock }: CardProps) {
  // Decided once, when the card appears in a new roll: locked cards "hold" still (DESIGN.md §10.2).
  const [dealt] = useState(animate && !s.locked);
  const { phase, slotIndex, beat, countInBeat } = playhead;
  const current = slotIndex === i;
  const playing = current && phase === 'playing';
  const paused = current && phase === 'paused';
  const counting = current && phase === 'count-in';
  const bars = barLabel(s.bars);
  const name = formatChord(c);
  return (
    <li
      class={['card', s.locked && 'is-locked', playing && 'is-playing', paused && 'is-paused', dealt && 'is-dealt'].filter(Boolean).join(' ')}
      style={{ '--i': i }}
      aria-current={playing ? 'true' : undefined}
    >
      <div class="card__top">
        <span class="caption mono card__bars">{bars}</span>
        <button type="button" class="card__lock" aria-pressed={s.locked} aria-label={`Lock ${name}`} onClick={() => onToggleLock(i)}>
          {s.locked ? <LockClosedIcon /> : <LockOpenIcon />}
        </button>
      </div>
      <div class="card__chord">
        <ChordSymbol chord={c} size="md" />
        {counting && countInBeat !== null && (
          <span class="card__count" aria-hidden="true">
            {countInBeat}
          </span>
        )}
      </div>
      <div class="card__foot">
        <span class="caption card__locked">{s.locked ? 'Locked' : ''}</span>
        {playing && <Pips beat={beat} />}
        {counting && <Pips beat={(countInBeat ?? 1) - 1} />}
        {paused && <span class="caption card__paused">Paused</span>}
      </div>
    </li>
  );
}
