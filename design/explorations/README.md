# Design explorations

Each folder is a self-contained snapshot of one visual direction. Open any `index.html` straight in a browser; fonts are included. Screenshots are rendered from the mockups (phone at 390 × 844, desktop at 1440 × 900, 2× scale).

Nothing here is wired into the app on `main` unless noted.

---

## 01 · Late Set (built, then superseded)

**What it was:** warm low-light "jazz club" direction. Fraunces serif chord names set like a lead sheet, tungsten-amber accent, warm near-black palette, boxed chord cards with lock toggles.

**Status:** fully built on `main` (tokens, Jam screen, key and tempo sheets). Screenshots in `01-late-set/`.

**Why it was superseded:** everything was a box with the same weight, so nothing led; section labels read like a settings page; no sense of musical time; desktop was the phone layout stretched.

---

## 02 · Late Set, "the chart is the stage" (mockup only)

**What it was:** same palette, redesigned around a real lead-sheet chart: an editorial sentence as the main control ("Neo-soul in D major at 84 bpm"), bar lines and repeat signs, beat slashes, a spotlight on the playing bar, and chord-shape diagrams under the chart.

**Status:** mockup in `02-late-set-chart/index.html` (`?view=phone`, `phone-playing`, `phone-sheet`, `desktop`, `desktop-playing`).

**Why it moved on:** the designer preferred a bolder, flatter, more instrument-like style (direction 03).

---

## 03 · Pixel / tiles (mockup; ready to build)

**What it is:** bold and minimal, mixing flat modern UI with a dot-matrix display. Instrument-like.

**Status:** final mockup in `03-pixel-tiles/index.html` (`?view=phone`, `phone-playing`, `desk`). Earlier iterations in `03-pixel-tiles/iterations/`.

### Decisions (all agreed)
- **Display:** a dot-matrix grid with no container, sitting on the background. Phone: a perfect square, 88 × 88 dots. Desktop: wide (150 × 50).
- **Display content:** the chord name on one line in our own 5 × 7 pixel lettering (root at 4×, accidental and quality raised at 2×, centred), with a **pixel chord chart** below on phone (to the right on desktop).
  - The chart always shows the **basic shape only**: open if one exists, otherwise the lowest barre. Never more than 5 frets.
  - Vertical chart: nut at the top, low E on the left. A fret number shows when the shape isn't at the nut.
  - Roots are solid squares in the chord's colour; other notes are white; open strings are rings (coloured if a root); muted strings are ×; barres are drawn as a bar.
  - **Roots must be computed from the notes and every shape tested** (two hand-entered roots were wrong in the mockup).
- **Tiles:** one per chord, all the same size, in a 4-column grid on phone and one row on desktop. Each shows the chord name (DM Sans Medium) and Roman numeral (Regular). No role labels, no duration marks.
- **Tile colour = chord quality:** major `#ff5c2b` (orange), minor `#f59ac2` (pink), diminished `#ffd23f` (yellow), sus `#e8d9bd` (cream). Dominant 7ths count as major. Dark ink `#121110` on every colour is ≥ 6:1.
- **Playing tile:** a 3 px off-white ring with a 3 px gap (shape cue, not colour only).
- **Progress bar:** between the display and the tiles. The whole loop as a timeline: one segment per chord, width proportional to its length (half-bar chords are shorter), coloured by quality, dimmed until played, filling as it plays. Display-only for now; labelled "Position in the loop" for screen readers.
- **Half-bar chords stay.** The progress bar shows durations; tiles don't.
- **No chord sheet.** When stopped, tapping a tile plays it and shows its shape in the display. When playing, the display follows the music and tapping a tile just plays it.
- **Controls:** Back, Re-roll (off-white) and Play (green circle), all 56 px. On phone, vibe, key and tempo chips sit **beneath** the buttons at the very bottom. On desktop they share one bottom row (settings left, actions right).
- **Key and tempo can be held:** a "HELD" tag on the chip. Re-roll changes chords, key and tempo unless held. **No chord locks.**
- **Default chord set:** triads, 7ths and sus (major, minor, 7, maj7, m7, sus2, sus4, plus dim for vii). An "extended chords" option comes later.
- **Type:** DM Sans, Regular and Medium only (no bold). The tempo chip has a fixed width, because DM Sans has no fixed-width digits. A Noto Music subset supplies ♭ ♮ ♯.
- **Colours:** background `#0d0d0d`, panels `#1c1c1c`, text `#f4f0e8`, muted `#a8a39a`, dots off `#1d1d1d`, dots dim `#4d4b48`, play `#33a066`.

### Open items before building
- Short phones: the square display shrinks so Back, Re-roll and Play always stay on screen.
- Extended chord names (e.g. maj7♯11) will need a smaller quality line in the display when that option arrives.

---

## 04 · Generative visuals (prototype; exploring)

**What it is:** full-screen, music-driven visuals with a minimal UI. The progression sits in the centre as chord charts: the current chord on a highlighted card with a progress bar that moves smoothly (from the audio clock), past chords dimmed (50%), upcoming chords at full opacity. The current chord is always centred and the rest of the loop slides sideways as it plays (phone and desktop; desktop shows more either side). When paused, the chord that was playing stays highlighted with its progress frozen. A floating glass panel at the bottom holds only playback (click toggle, Back, Re-roll, Play) and settings (vibe, key, tempo).

**Behaviour:** the visuals appear only while music plays (they fade in on play and out on pause). Motion is continuous: chord changes crossfade between harmonic layers, and the beat is a smooth swell locked to the audio clock (measured: no frame-to-frame jumps). The click is off by default; the "1 2 / 3 4" button turns it on. Chord charts are monochrome and light (the visuals carry the colour): dots only (no squares, finger numbers or string names). Vibe, key and tempo chips open pickers: a vibe list; Major/Minor, 12 keys and a Hold switch; tempo −/+, slider, tap tempo and a Hold switch.

**Run it:** `npm run dev`, then open `/design/explorations/04-generative/`. It plays real audio through the app's engine. Space plays, R re-rolls. Tap the vibe chip to cycle vibes; tap key or tempo to hold them. The Lines/Dots switch at the top right is exploration-only. Stills are in `screens/`.

### Concept: "sympathetic strings"
- The visuals are **derived from the harmony**, not decoration: each string's wave is built from the current chord's interval ratios (major 1 : 5/4 : 3/2, minor 1 : 6/5 : 3/2, diminished with a 64/45 tritone, plus 7ths). Consonant chords give smooth interference; diminished looks restless.
- **Chord changes** morph the pattern and colour over 700 ms. **Tempo** sets the speed. **Each beat** is a gentle swell in amplitude, never a brightness flash (safe at 240 BPM). **Shuffle vibes** sway.
- **Each vibe** has its own palette, string count, weight, orientation and motion. Major-family chords use the warmer end of the palette, minor and diminished the cooler end. No purple gradients.
- **Dots mode** samples the same field on a grid, like a moving halftone.
- **No AI:** plain canvas code, no dependencies. The audio scheduler runs separately, so rendering can't disturb timing.
- **Accessibility:** a dark pool behind the chord keeps text contrast. Reduced motion freezes the movement (chord changes still recolour). The canvas is hidden from screen readers; the chord has a spoken label.
- **Chord set:** chords are simplified to the default set (triads, 7ths, sus, dim). Re-roll changes key and tempo unless held.

### Sound: sampled Wurlitzer, bass and drums
- **Chords play a real recorded Wurlitzer EP200** (Greg Sullivan, CC BY 3.0; 42 files, 4 velocity layers, about 1.1 MB as AAC). Credited in the vibe picker and in `public/samples/wurlitzer-ep200/CREDITS.md`. We avoided guitar in the backing so it doesn't clash with the player.
- **The samples load after the first tap and never block playback.** The old synth plays until they're ready, and a small pill shows progress. A bad or missing file only affects its own notes. If most of the files fail (offline), the synth stays.
- **Mix:** a generated room reverb (no impulse file to download), gentle tape-style saturation and a compressor. Sends are per part: chords wet, bass nearly dry.
- **Humanising:** chords roll low to high (at most 30 ms), velocities vary ±6%, and each hit lands 0–5 ms late. Notes only ever move later, so the look-ahead scheduler stays safe.
- **Bass is a real flatwound bass** (Karoryfer Swagbass, CC0): warm and round, the classic soul sound. It plays one note at a time like a player, slightly detached, with alternate takes so repeated notes differ.
- **Drums are a real jazz kit, played with sticks** (Versilian Virtuosity Drums, CC0): kick, snare and closed hat. The close mics and overheads are pre-mixed per hit, with alternate takes. Drums stay off by default (SPEC A8). A new drum button next to the click turns them on.
- **All three load one after another after the first tap** (chords first), about 3.2 MB in total. Each part switches from synth to samples as soon as its own instrument is ready. The pill shows combined progress and names any instrument that failed.
- **Checked in Chromium:** each part sits at about the level its synth did. The bass is raised to sit about 3 dB under the chords; the old synth bass was louder than the chords. The full band peaks at 0.56, with no late events. Timing is exact at 40 and 240 BPM across the loop point.

### Ideas noted, not built
- **Solo mode:** the notes you play (microphone pitch detection, no recording) could feed extra harmonics into the strings, so the visuals answer your solo.
- **Accidentals:** at display size the Noto ♭/♯ look thin beside DM Sans; we'd draw our own.
- **Chord charts:** basic shapes from `src/theory/shapes.ts` (open where possible, else the lower E- or A-shape barre), with tests.
