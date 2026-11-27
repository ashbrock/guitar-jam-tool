# SPEC.md: Product behaviour

> Status: **v2 draft, for review.** Rewritten around the generative direction (prototype 04). Product name still to be decided; "the app" is used throughout.
> **[A#]** refers to the assumptions and open questions in §13. Everything else reflects decisions already made.
> Visual details (colour, type, spacing, motion) live in `DESIGN.md`. This document defines *behaviour*.
> The previous version (Late Set, with chord locks) is in git history. `design/explorations/README.md` records how we got here.

---

## 1. What this is

A browser tool for guitarists with two modes:

- **Jam:** pick a vibe, hit Re-roll, and hear a chord progression straight away on a real-sounding band (Wurlitzer, bass and drums). Each chord appears as a chord chart. Built for band improvisation: fast, few decisions, big buttons.
- **Solo:** enter the progression of a song you're learning, set its tempo, loop it, and use a fretboard showing chord tones, scale options and landing notes to write lead lines.

Most of the time the app is a silent chart for a band: generate, call the progression, play. Sound is there when you want it. (Full-screen generative visuals were explored and removed for this reason: see DECISIONS.md.)

### Product principles
1. **Audible in one tap.** From a cold open, a progression should be playing within one tap in Jam and within a few taps in Solo.
2. **Playable at arm's length.** Primary actions sit in the bottom thumb zone and stay large. You can operate it one-handed, guitar on, in a dim room.
3. **Readable from across the room.** The chord, its length and where you are in the song read at a glance, without sound.
4. **Theory on demand.** Charts and the fretboard answer "what can I play here?" first. Explanation is one tap away, never in the way.
5. **Loops never lie.** Timing is the product. Nothing in the UI is allowed to make playback drift, and the song map never runs ahead of the sound.

### Out of scope for v1
Accounts, sharing, syncing between devices (saved progressions stay in this browser, §5.10), recording, AI features, song libraries, time signatures other than 4/4, custom tunings, looping part of a progression, chord locks, extended chords in Jam (an option later, §5.6).

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Progression** | An ordered list of **slots** played in a loop. |
| **Slot** | One chord plus its duration in bars (½, 1, 2 or 4). |
| **Bar** | One bar of 4/4. The length of a progression is the sum of its slots' durations. |
| **Vibe** | A named set of generator rules and playback feel (§10). Six ship in v1. |
| **Roll** | One output of the generator, with its key and tempo. Jam keeps a history of rolls. |
| **Hold** | A switch on key or tempo. Re-roll doesn't change a held value. |
| **Chord chart** | The basic fingering of a chord: open if one exists, otherwise the lowest E- or A-shape barre, never more than 5 frets. |
| **Song map** | The Verse and Chorus rows under the chord, a block per chord. The selected block is white. |
| **Chord tones** | The notes of the chord currently playing (or selected). |
| **Landing notes** | The chord tones of the *next* chord, shown towards the end of the current one. Notes a half step either side of a landing note are **approach notes**, an optional layer. |
| **Avoid notes** | Scale tones that clash with the current chord: a half step above a chord tone. **[A6]** |
| **Feel** | Straight or shuffle (swung 8ths), plus the groove pattern used for drums and bass. |

---

## 3. Screen model: one full-screen stage

There is a **single screen**, black and white for now (colour comes with the hi-fi designs). **[A22]**

```
┌───────────────────────────────┐
│ Jam ⌄          My progressions│  top bar: mode menu, saved progressions (status pill centred when needed)
│          ┌────────┐           │
│          │ chart  │           │  centre: the selected chord's chart
│          └────────┘           │
│             Em7               │  its name, plain (Cmaj7, not C with a raised maj7)
│ Verse                     ×2  │
│ [Em7][ Am ][ D  ][Bm7 ]       │  song map: a row per section, a block per chord
│ Chorus                    ×2  │  (dots under each name count its beats)
│ [ G ][ D  ][ Am ][ C  ]       │
│ ╭───────────────────────────╮ │
│ │ (⚙)  (♡)  ( ↻ )  (▶)  (🔈) │ │  panel, row 1: settings, save, re-roll (largest), play, mute
│ │ [Neo-soul   D major·84 ⌄]  │ │  row 2: vibe (with the key and tempo shown quietly)
│ ╰───────────────────────────╯ │
└───────────────────────────────┘
```

- **Phone (< 900 px wide):** the panel has two rows: five buttons on top, the vibe beneath, at the very bottom where the thumb rests.
- **Desktop (≥ 900 px):** the panel is one row, max 760 px wide and centred: the vibe on the left, the buttons on the right.
- **Sheets** (vibe, Settings) open directly above the panel, anchored to it (full panel width on phones, 420 px on desktop). The **mode menu** drops down from "Jam ⌄" in the top bar. Only one is open at a time. They close on Esc, a tap outside, or tapping their button again. Opening or using one never stops playback.

### 3.1 State ownership
| State | Owned by | Notes |
|---|---|---|
| Key, tempo, vibe, progression, holds, history | **Each mode separately** | Generating in Jam never overwrites Solo, and the reverse. |
| Settings (parts, count-in, metronome) | Global | Apply to both modes. |
| Fretboard settings (tuning, handedness, labels, layers) | Global | Used in Solo. |
| Playback | Global transport, playing the **active mode's** progression | |

### 3.2 Switching modes
- Switching modes while playing **stops playback** and returns to bar 1 of the new mode.
- **Exception: "Solo over this"** (a Jam action, §5.8) copies Jam's progression, key, tempo and vibe into Solo, then switches. If playing, it keeps playing without a break, because it's the same progression. If Solo already had chords, an Undo toast (8 s) restores them.

---

## 4. Shared controls

### 4.1 Action row
| Control | Behaviour |
|---|---|
| **Settings** (sliders) | Opens Settings (§4.5): Key, Tempo and Instruments. |
| **Save** (heart) | Saves the progression to My progressions (§5.10); the heart fills when what's on screen is saved, and tapping again removes it. `aria-pressed`. **[A23]** |
| **Re-roll** (two arrows) | The primary action (§5.3): the tool is for generating progressions quickly to play with a band. The largest button, in the centre, inverted. |
| **Play / Pause** | Starts and pauses the loop. Play starts from the selected chord (§5.2). |
| **Mute** (speaker) | Silences all sound while the loop and song map carry on in time: for playing with a band and following the chords. A toggle (`aria-pressed`); when on it's inverted with a crossed-out speaker. Off by default. Fades over about 20 ms, no click. |

- The vibe has its own row below, showing the current key and tempo too, so the key is always on screen to call to the band.
- **Looping is always on.** The whole song loops.
- **Pause** stops the sound and cues the start of the chord that was playing, so Play starts that chord again, after a count-in if count-in is on.
- Playback states: `locked-audio` → `stopped` → `count-in` → `playing` ⇄ `paused`. How each looks is in DESIGN.md §8.

### 4.2 Vibe picker
- A list of the six vibes, each with its name and a short descriptor. The current vibe is selected (`role="radio"`).
- Choosing a vibe makes a **new progression in the same key**. Tempo moves to the vibe's default **unless tempo is held**. The picker closes.
- There's no length control: the vibe sets each song's length (§5.5).

### 4.3 Key (in Settings)
- **Major / Minor** segmented control, then 12 tonics in two rows of six, spelled for the mode (D♭ and F♯ major; E♭ and B♭ minor; C♯ minor, not D♭ minor).
- **Changing the tonic transposes** the current progression. Nothing re-rolls.
- **Changing major ↔ minor makes a new progression** in the same tonic, because the two modes use different rules. The old one goes onto the history stack, so Back returns to it.
- **Hold key** switch: "Re-roll won't change it". A held key shows ", held" on the Key row in Settings.
- Spelling of chromatic chords follows the key (♭3, ♭7, ♯4 in major; the leading tone and ♭5 blue note in minor). The table lives in `src/theory/` and is tested.

### 4.4 Tempo (in Settings)
- Range **40–240 BPM**, whole numbers. Big readout with **− / +** either side (1 BPM per tap), a slider, and **Tap tempo** (averages up to the last 5 taps; taps more than 2 s apart start again).
- A line under the controls says the vibe's usual range ("Neo-soul usually sits between 65 and 100 BPM").
- **Hold tempo** switch (", held" on the Tempo row).
- **Metronome** and **Count-in** switches live here too (§4.5).
- Tempo changes take effect at the next beat, never mid-beat.

### 4.5 Settings (global)
**Settings** (bottom left of the action row) opens a sheet with three rows. Each opens its own sheet in place, with a back arrow:

| Row | Shows | Opens |
|---|---|---|
| **Key ›** | "D major", ", held" | Major / Minor, the 12 tonics, Hold key (§4.3). |
| **Tempo ›** | "84 BPM", ", held", "· metronome on" | The tempo controls and Hold tempo (§4.4), then **Metronome** (a click on every beat, accent on beat 1; **off**) and **Count-in** (one bar of clicks before playback, heard even with the metronome off; **off**). While the count-in plays, "Count-in" shows above the song map with four dots filling one per beat, so it reads without sound. |
| **Instruments ›** | "Chords, bass and drums" | Chords, Bass and Drums switches, **all on by default [A8]**, plus the instrument credits (§7.4). Turn Chords off to play them yourself over bass and drums. |

Focus moves into each sheet as it opens (its back arrow; the row that opened it on return), and back to the Settings button when it closes. Changes take effect at the next scheduled note and never stop or restart the loop.

### 4.6 Editing while playing
- Re-roll, Back, a vibe change or a key mode change: the new progression starts **at the next downbeat, from bar 1**.
- A tonic change: the transposed chords take over at the next downbeat, keeping the position in the loop.
- No change ever causes a count-in or a gap.

---

## 5. Jam mode

### 5.1 First load
- Jam, vibe **Neo-soul**, key **D major**, the vibe's default tempo, a progression already generated. **[A1]** The screen is never empty.
- Nothing plays until the first tap (§12.3).

### 5.2 The chord and the song map
- **The chord view:** the **selected chord's** chart, with its name below in plain text ("Cmaj7", "F♯m7"). The selected chord is the one playing; while stopped or paused, it's the one picked (the first chord after a new roll). Tapping the chart plays the chord once.
- **Song map** (under the chord): the whole song at a glance. **[A21]**
  - A row for each section, labelled **Verse** and **Chorus**, with a block for each chord, **all the same width** (four to a row; fewer chords leave the rest of the row empty).
  - **Dots** under each name count the chord's beats, four a bar: a 2-bar chord shows eight, in two groups. While playing, the current beat's dot grows, from the audio clock, so you can see the change coming.
  - The **selected chord's block is solid white**; the others have a low-opacity fill.
  - Each section shows **×2**. Once playback has started, that becomes which time through it is (**1/2**, **2/2**) and the section label brightens.
- **Tapping a block** pauses playback if it's playing, selects that chord (the chart shows it; it turns white) and plays it once. **Play then starts from it.** If the tapped chord's section is the current one, it stays on the same time through; otherwise it's the first time through.
- Charts are the basic shape only (§2). A chord with no basic shape shows "No chart for this chord" in place of the chart.

### 5.3 Re-roll
1. The user taps **Re-roll** (or presses `R`).
2. A new progression is generated from the current vibe. **Key and tempo change too**, unless held:
   - Key: a random tonic, and major or minor with equal chance.
   - Tempo: a random value within the vibe's range.
3. The previous roll (with its vibe, key and tempo) goes onto the **history stack**.
4. If playing, the new progression starts at the next downbeat from bar 1.
5. Screen readers hear the new progression once via a polite live region ("New progression in E minor at 78 BPM: E minor 7, A 7, D major 7, B minor 7").

### 5.4 Back (history)
- **Back** restores the previous roll exactly: chords, vibe, key and tempo. History holds up to **20** rolls.
- Mute took the Undo button's place, so Back is on the keyboard (`U`) for now. At the oldest roll it shows "No earlier progression yet". **[A19]**
- After going back, Re-roll makes a new roll and discards the "forward" history, like a browser. No Forward control in v1.

### 5.5 Length and chord count
- **At most 4 chord changes per section**, and fewer is fine (two or three). Each chord lasts **1 or 2 bars**. A later option may allow more chords; it only raises the vibe's `maxChords`. **[A3]**
- **The vibe picks the length**, 4 or 8 bars per section, by weight (Dreamy mostly 8, Neo-soul mostly 4). Verse and chorus are always the same length. An 8-bar section is four 2-bar chords.
- There's no length control. Back restores a roll at its own length.

### 5.6 Chord set
- Jam uses a **simple chord set by default:** major, minor, 7, maj7, m7, sus2, sus4, and dim (for vii°). The generator's richer qualities (9ths, 13ths, 6/9) are simplified to the nearest of these for display, charts and playback.
- An **extended chords** option comes later. It will need charts beyond the basic shapes.

### 5.7 Visuals in Jam
Removed (A24). Kept as a heading so section numbers stay stable.

### 5.8 Solo over this
Copies Jam's progression, key, tempo and vibe into Solo, then switches mode (§3.2). Where this lives in the UI is still to be designed **[A13]**.

---

### 5.9 Verse and chorus
- **Every roll is a song:** a **verse** and a contrasting **chorus**, in the same key and tempo, each the chosen length (`src/theory/song.ts`).
  - **Contrast:** the chorus starts on a different chord from the verse, leaning to the classic lift (IV, vi, ii, V or ♭VII in major; ♭VI, iv, ♭III or ♭VII in minor), using only chords the vibe has.
  - **Never identical:** the two are never the same progression. A fixed form may share its first chord, but the chorus is still a different form.
- **It just plays:** the verse **twice**, then the chorus **twice**, on a loop. There's nothing to switch while playing. The song map (§5.2) shows both sections and where you are. **[A20]**
- **Shared by both sections:**
  - Re-roll, the vibe and a key mode change make a new verse and chorus together.
  - A tonic change transposes both.
  - Back (`U`) restores both.
- The screen-reader announcement lists both: "New progression in D major at 84 BPM. Verse: … Chorus: … Each plays twice.".
- **Later (v2, AI):** whole songs with intros, verses, choruses, bridges and outros, each with progressions suited to its part. The play list already takes any order of sections.

### 5.10 My progressions (saving) **[A23]**
- **Save (heart):** saves the progression on screen: its verse, chorus, key, tempo and vibe. The heart is **filled** (the icon, not the button) when what's on screen exactly matches a saved progression; tap it again to remove it. Changing the tempo, key, vibe or chords after saving empties the heart, and saving again keeps that version too. A short status confirms ("Saved to My progressions").
- **My progressions** (top right) opens a **full page** over Jam, newest first. Each entry shows the vibe, the date ("27 Nov"; with the year if it isn't this year), the key and tempo, and the verse and chorus chords. The one on the Jam screen now has an edge.
- **Tapping an entry** puts it on the Jam screen from bar 1 and returns there; the progression that was there goes on the history, so Back (`U`) returns to it.
- **Back to Jam** (or Esc) returns with **Jam exactly as it was**: chords, selected chord, and playback carry on underneath the page.
- **Delete** is two taps: the bin turns into "Delete" to confirm (it reverts after 4 s or when focus leaves). No other management yet.
- **Empty:** "Nothing saved yet. Tap the heart on the Jam screen to keep a progression here."
- **Storage:** this browser only (`localStorage`), no accounts or sync. Malformed entries, or ones from a vibe that no longer exists, are skipped. If the browser won't store them (a private window, blocked storage), saving still works until the page is closed, and a status says so.

---

## 6. The visuals
Removed (A24): the app has no generative visuals. Kept as a heading so section numbers stay stable.

---

## 7. Sound

### 7.1 Instruments
| Part | Instrument | Licence |
|---|---|---|
| Chords | Wurlitzer EP200 (Greg Sullivan), 4 velocity layers | CC BY 3.0 (credit required) |
| Bass | Karoryfer Swagbass (flatwound strings), 3 velocity layers, 2 takes per note, one note at a time | CC0 |
| Drums | Versilian Virtuosity Drums: kick, snare, closed hat (close mics and overheads pre-mixed per hit) | CC0 |

No guitar in the backing, so it never clashes with the player.

### 7.2 Loading
- Samples download in the background **after the first tap**, chords first, then bass, then drums (about 3.2 MB in all).
- **Playback never waits for samples.** Until an instrument is ready, a synth plays its part. Each part switches as soon as its own instrument is ready.
- A small **status pill** at the top shows "Loading instruments · 40%", then "Instruments ready", and fades out.
- **Failure:** a file that won't load only affects its own notes. If most of an instrument fails (offline), that part stays on the synth and the pill says which ("Couldn't load Swagbass. Using the synth for that."), for 4 s.

### 7.3 Feel and mix
- **Humanising:** chords roll low to high (at most 30 ms), velocities vary ±6%, and each hit lands 0–5 ms late. Notes only ever move later, so the scheduler stays safe.
- A generated room reverb, gentle saturation and a compressor glue the parts together. Per-part reverb sends: chords wet, bass nearly dry.

### 7.4 Credits
Settings → Sound shows: "Wurlitzer EP200 samples by Greg Sullivan, CC BY 3.0. Bass: Swagbass by Karoryfer Samples. Drums: Virtuosity Drums by Versilian Studios (both CC0)." with links. Full credits and licences sit next to each sample set in `public/samples/`.

---

## 8. Solo mode

> **Layout to be designed** in the generative style before it's built. Until then the Solo tab shows a short "being designed" note, without the panel; switching to it stops playback (§3.2). The behaviour below carries over from the previous spec and still stands, except where noted. **[A13]**

### 8.1 Entering chords
- Solo starts **empty** (unless filled by "Solo over this"). The empty state invites "What are we soloing over?" with three actions: **Add a chord**, **Type the whole progression**, **Bring the Jam progression over**. Play is disabled with the reason "Add a chord to play".
- **Chord by chord:** a builder with root (12, spelled for the key), quality (most common first: `maj` `m` `7` `maj7` `m7` `sus2` `sus4` `add9` `6` `m6` `9` `m9` `13` `dim` `m7♭5` `aug`, then More… for alterations and slash bass) and duration (½ / 1 / 2 / 4 bars, default 1). A live preview plays when tapped. **Add** keeps the builder open for the next chord.
- **Whole progression:** free text, chords separated by spaces, optional bar lines: `Em C G D` or `| Em | C | G D |`. Inside a bar, chords share it equally. A live preview shows parsed chords; bad tokens are flagged one by one.
- **Editing:** tap a chord to edit, change duration, move, duplicate or delete. Pointer users can drag to reorder; Move buttons are the accessible equivalent.
- Solo accepts the full chord vocabulary (§8.2), unlike Jam's simple default.

### 8.2 Chord input rules (parser)
- **Accepted:** root `A–G` with `#`/`b`/`♯`/`♭` · qualities `m`, `maj7`, `7`, `m7`, `dim`, `dim7`, `aug`/`+`, `sus2`, `sus4`, `add9`, `6`, `m6`, `9`, `m9`, `maj9`, `11`, `13`, `m7b5` · alterations `b9`, `#9`, `#11`, `b13`, `b5`, `#5`, with or without brackets · slash bass (`C/E`).
- **Aliases:** `-` → `m`, `Δ`/`M7` → `maj7`, `ø` → `m7♭5`, `°` → `dim`, `min` → `m`.
- **Display** uses real accidentals and keeps the user's root spelling (A♯ stays A♯). An alteration straight after the root is bracketed, `C(♯11)`, because `C♯11` would read as a C♯ chord.
- Roots are case-insensitive at the start (`em` → Em). After the root, `M7` means maj7 and `m7` means minor 7. Max 16 characters per chord.

### 8.3 Tempo, vibe, key, loop
- **Tempo:** the tempo picker (§4.4). Default 90 BPM **[A4]**.
- **Vibe:** optional. Sets playback feel and the order of scale suggestions, never the chords. Default **Plain**: straight, simple comping, no drums **[A5]**.
- **Key:** once there are ≥ 2 chords and the user hasn't set one, the app suggests one ("Sounds like E minor. Use it?"). Accepting sets the key without transposing.
- **Loop:** the whole progression; the current chord follows the playhead.

### 8.4 The fretboard
- **Follows the playhead** while playing; otherwise shows the selected chord. Tapping a chord while playing **pins** the fretboard to it, with a "Pinned · Follow" control to resume.
- **Scale picker:** ranked suggestions with a fit note. A scale fits a chord when (a) a seven-note scale contains all its core tones, or (b) a smaller scale (pentatonic, blues) doesn't contradict its quality (no ♭3 against a 3, no ♭7 against a maj7, or the reverse). **Whole song** and **Follow chord** scopes. v1 set: major, natural minor, major and minor pentatonic, blues (minor and major), Dorian, Mixolydian, Lydian, Phrygian, harmonic minor. **[A6]**
- **Layers:** Chord tones (on) · Scale (on) · Landing notes (on) · Approach notes (off) · Avoid notes (off). Approach notes need Landing on.
- **Landing notes** appear in the last beat of each chord by default (setting: last beat / last bar / always).
- **Tap a note:** plays it and shows note name, interval to the chord and scale degree. Doesn't affect the loop.
- **Labels:** Notes · Intervals (to the current chord's root) · Degrees (to the key).
- **Text alternative:** "Show as list" gives the same information as text.

| Property | Rule |
|---|---|
| Frets | 0 (open) to 15. |
| Orientation | Phone portrait: vertical, headstock at top, low E on the left. Landscape or ≥ 600 px: horizontal, headstock at left, low E at the bottom. |
| Left-handed | Mirrors the neck, and the transport **[A7]**. |
| Tunings | Standard (default), Half-step down, Drop D, DADGAD, Open G, Open D. |
| Inlays | Single dots at 3, 5, 7, 9, 15; double at 12. |
| Roles | Root, chord tone, scale tone, avoid, landing, approach. Each has its **own shape and label** as well as colour. Priority: Root > Chord tone > Landing > Approach > Avoid > Scale. A chord tone that's also a landing note gets a landing badge. |

All fretboard maths is a pure, tested function in `src/theory/`.


---

## 9. Keyboard and assistive technology

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `R` | Re-roll (Jam) |
| `M` | Mute / unmute |
| `U` | Back to the previous progression (Jam) |
| `←` `→` | Move focus between the song map's chords |
| `Enter` | Select and play the focused chord (Jam); open it for editing (Solo) |
| `+` `−` | Tempo ±1 (`Shift` for ±5) |
| `Esc` | Close the open picker, or My progressions |

- Shortcuts are ignored while a text field has focus.
- Each section of the song map is a labelled group. Each block's accessible name is the spoken chord and its length ("E minor 7, 2 bars"); the selected one has `aria-current`. No announcement on every chord change during playback.
- Pickers are dialogs: focus moves into them on open and returns to their button on close.
- Toggle buttons use `aria-pressed`; switches use `role="switch"`; single choices use `role="radio"`.

---

## 10. Generator and vibe data

### 10.1 Principles
- The generator is a **pure, seeded function**: `generate(params, mode, length, seed) → Progression`, with no DOM or audio code. Same inputs and seed, same output.
- **Vibes are data files** in `src/data/vibes/*.json`, checked on load by `parseVibe` (unknown degrees, invalid qualities, dead ends, unreachable chords, bad tempo ranges).
- **v2 path:** free-text input ("dusty Khruangbin groove, slower") maps onto the *same* parameters by picking or blending vibes or overriding fields. No generator changes needed.
- The generator still supports locks internally; the v1 UI doesn't use them.

### 10.2 Vibe file shape
```ts
interface Vibe {
  id: string;                      // "neo-soul"
  name: string;                    // "Neo-soul"
  descriptor: string;              // "Lush 7ths and 9ths, lazy pocket"
  references: string[];            // reference artists: used to tune the rules, not shown in the UI
  params: GeneratorParams;         // everything the generator sees (the v2 target)
  playback: {
    feel: "straight" | "shuffle";
    swing: number;                 // 0–1
    groove: string;                // drum/bass pattern id
    voicing: "close" | "open" | "shell";
    tempo: { default: number; min: number; max: number };
  };
  scalePreference: { major: ScaleId[]; minor: ScaleId[] };   // ordering for Solo suggestions
}
```
`GeneratorParams` (weighted section lengths, harmonic rhythm, minimum and maximum chords, repeats, closed or free loop, and per-mode vocabulary, starts, transitions and optional templates) is unchanged from the previous spec and implemented in `src/theory/vibe.ts`. Degrees are Roman numerals against the major scale (minor reads i, ♭III, iv, ♭VI, ♭VII); secondary dominants are `V/ii`.



### 10.3 Generation rules
1. **Templates** (optional, per length) are chosen by weight; `markov` is the weight of using the rules instead.
2. **Durations** fill from the harmonic rhythm, never using more than `maxChords` chords. Chords of a bar or more start on a bar line; ½-bar chords come in pairs (no vibe uses them now).
3. **Chords** fill left to right from `starts`, then `transitions`. With a closed loop, the last chord must lead back to the first.
4. **No repeats** unless allowed; allowed repeats merge into one held chord, never longer than the vibe's longest chord.
5. **Quality** comes from the degree's vocabulary weights.
6. **Never the same roll twice in a row.**
7. **Relaxation:** if the rules can't be met in 50 attempts, relax them in order (repeats → loop → transitions), so the generator always returns a progression.
8. Seeded with `mulberry32`, so every result is reproducible in tests.

### 10.4 v1 vibes
| Vibe | Core movement |
|---|---|
| Neo-soul | maj7, m7 and dom7 colours, ii–V, chromatic approach chords, borrowed iv |
| Blues | dom7 throughout, quick-change and turnaround forms, minor blues |
| Soul & Roots | I–IV–V with 6ths and 7ths, gospel turnarounds, IV–iv–I |
| Heartland | I–V–vi–IV family, sus chords, long chords, driving 8ths |
| Dreamy | slow modal movement, pedal tones, open voicings, 2–4 bars per chord |
| Desert Groove | minor modal vamps (Dorian, Phrygian), i–IV, ♭VII–♭VI–V |

Reference artists stay in the vibe files to guide tuning by ear, but aren't shown in the UI.

---

## 11. Session restore

So a refresh, a locked phone or a discarded tab doesn't wipe work. **Not** saving: one session, one device, no export.
- **Stored** in `localStorage` under one versioned key: both modes' vibe, key, tempo, holds, progression and history (Jam); global sound and fretboard settings.
- **Not stored:** playback state. After a restore the app opens stopped, in the last mode, and audio still needs a first tap.
- **Written** at most every 500 ms after a change, and on `pagehide`. Never in the audio path.
- **Unreadable or older data** is discarded silently and the app starts fresh. **Storage unavailable** (private browsing): the app works without persistence, with no error.
- **Start fresh** (location to be designed) clears it after a confirmation.

(Not in the prototype yet. Decided earlier as A2.)

---

## 12. Edge cases

### 12.1 Empty progression
- **Jam** is never empty: the generator always returns a progression.
- **Solo** starts empty (§8.1). Deleting the last chord while playing stops playback and offers Undo (8 s).

### 12.2 Invalid chord input (Solo)
- Parsing runs on each keystroke, but errors only appear on blur, on Add, or after 800 ms of no typing.
- Errors are specific and give an example: "Didn't recognise "Cmaj#". Try Cmaj7, Cmaj7♯11 or C/E." The typed text is kept.
- **Add** stays disabled until the input is valid, with the reason available to assistive tech.
- A chord the parser accepts but the audio can't voice in full plays its core triad plus 7th, with "Simplified for playback" shown.

### 12.3 Audio blocked until first tap
- Browsers block audio until a user gesture. The app looks normal before it; Play's accessible name is "Play (turns on sound)".
- The **first tap** on Play or a chord card starts audio in the same gesture, then does what was asked, and starts loading samples (§7.2).
- If audio is still blocked after that tap, a small inline message near the panel reads "Your browser blocked sound. Tap to try again." No auto-retry loop.
- **iOS silent switch** can mute web audio undetectably. On iOS only, the first time playback starts, show for 6 s: "No sound? Check your silent switch."
- **Interruptions** (a call, another app): playback pauses, with a toast "Playback paused".
- **Screen wake lock** while playing, released on pause or stop, where supported.

### 12.4 Other edge cases
| Case | Behaviour |
|---|---|
| Re-roll while a picker is open | The picker stays open and updates (e.g. the key picker shows the new key). |
| Held key and held tempo | Re-roll changes chords only. |
| History at its oldest roll | Back disabled, with "No earlier progression yet" on tap. |
| Tempo out of range (typed, tapped) | Clamped to 40–240. |
| ½-bar chords at 240 BPM | Allowed; timing tests cover them. |
| One-chord progression | One block in the row; the loop is that chord. |
| Settings and another picker | Only one opens at a time; opening one closes the other. |
| Samples slow or failing | Synth plays meanwhile; status pill reports (§7.2). |
| Device or browser stalls | Sounds are scheduled 150 ms ahead on the audio clock, so short stalls are inaudible. After a longer stall, missed notes are skipped and playback continues on the beat. Never a burst of late notes. |
| Background tab | The scheduler timer runs in a Web Worker, so playback usually continues. If the browser suspends audio, playback pauses. |
| Reduced motion | DESIGN.md §9.3. No functional difference. |
| Rotate during playback | Layout changes; playback and the current chord are unaffected. |
| Very narrow screens (≤ 340 px) | Every control stays ≥ 48 px; long chord names in the song map end in an ellipsis. |

---

## 13. Assumptions and open questions

Decided items are marked ✅. Open ones are working defaults that stand unless you change them.

| # | Item | Status |
|---|---|---|
| **A1** | First load: Jam, Neo-soul, D major, progression ready. | Working default (as prototyped). |
| **A2** | Restore the session from `localStorage` (§11). | ✅ Decided. Not yet built in the new direction. |
| **A3** | At most 4 chord changes per section (fewer allowed), each 1 or 2 bars; the vibe picks 4 or 8 bars. No length control. (Was: a 4 / 8 / 12-bar length control.) | ✅ Decided. |
| **A4** | Solo default tempo 90 BPM. | Working default. |
| **A5** | Solo vibe optional, default Plain (no drums). | Working default. |
| **A6** | Avoid notes: a half step above a chord tone. Scale set as in §8.4. | Working default. |
| **A7** | Left-handed setting mirrors the transport (Play under the left thumb). | Working default; needs a home for the setting. |
| **A8** | All instruments (chords, bass, drums) on by default; switches in Settings › Instruments. (Was: drums off.) | ✅ Decided. |
| **A9** | Plain Web Audio, no Tone.js. | ✅ Decided. |
| **A10** | Self-hosted fonts. | ✅ Decided. |
| **A11** | Count-in and metronome are switches in Settings, both off by default. The count-in shows on the first chord card. | ✅ Decided. |
| **A12** | Settings (top right) → Sound holds Chords, Bass and Drums switches and the credits. | ✅ Decided. |
| **A13** | **Solo mode layout** in the generative style, including where "Solo over this" lives. | **Open: next design task.** |
| **A14** | Each vibe had its own visualisation. | ❌ Withdrawn: visuals removed (A24). |
| **A15** | Mic-reactive visuals in Solo. | ❌ Withdrawn (A24). |
| **A16** | Each vibe's visual look in its data file. | ❌ Withdrawn (A24). |
| **A17** | Visuals reduce detail on slow devices. | ❌ Withdrawn (A24). |
| **A18** | Visuals in WebGL (Three.js). | ❌ Withdrawn (A24); Three.js uninstalled. |
| **A19** | Undo's button is replaced by Mute; Back stays on the keyboard (`U`). Bring it back somewhere on touch (e.g. a long-press on Re-roll) if it's missed. | Working default. |
| **A20** | Verse and chorus play straight through (verse ×2 → chorus ×2, looping); no switching. Length is bars per section. Bridges, intros and outros: v2, possibly AI-built. | ✅ Decided. |
| **A21** | A song map under the chord (a row per section, equal-width blocks with beat dots, the selected block white) replaces the bar timeline. Tapping a block pauses and selects it; Play starts from it. | ✅ Decided. |
| **A22** | One chord chart instead of the carousel; top bar with a mode menu and My progressions; panel of Settings, Save, Re-roll (largest), Play, Mute, with the vibe below; Key, Tempo and Instruments in Settings. Black and white until hi-fi designs. | ✅ Decided. |
| **A24** | No visuals: the generative visuals, Three.js, the 2D fallbacks and the audio analyser are removed. The app is mostly used silently alongside a band. | ✅ Decided. |
| **A23** | Save progressions (heart) to My progressions, a full page; local to this browser, no accounts or sharing. Delete only for now (§5.10). | ✅ Decided; built. |
