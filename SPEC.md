# SPEC.md: Product behaviour

> Status: **v1 draft, for review.** Product name to be decided; "the app" is used throughout.
> Items marked **[A#]** refer to the assumptions table in §11. Everything else reflects decisions already made.
> Visual details (colour, type, spacing, motion) live in `DESIGN.md`. This document defines *behaviour*.

---

## 1. What this is

A browser tool for guitarists with two modes:

- **Jam:** pick a key and a vibe, generate a chord progression, audition it on a loop, re-roll it, or lock the chords you like and re-roll the rest. Built for band improvisation: fast, few decisions, big buttons.
- **Solo:** enter the progression of a song you are learning, set its tempo, loop it, and use a fretboard showing chord tones, scale options and landing notes to write lead lines.

### Product principles
1. **Audible in one tap.** From a cold open, a progression should be playing within one tap in Jam and within a few taps in Solo.
2. **Playable at arm's length.** Primary actions sit in the bottom thumb zone and stay large. You can operate it one-handed, guitar on, in a dim room.
3. **Theory on demand.** The fretboard answers "what can I play here?" first. Explanation (intervals, why a scale fits) is one tap away, never in the way.
4. **Loops never lie.** Timing is the product. Nothing in the UI is allowed to make playback drift.

### Out of scope for v1
Accounts, saving and sharing (beyond restoring the current session after a refresh, §10.5), recording, AI features, song libraries, chord-voicing diagrams, time signatures other than 4/4, custom tunings, looping only part of a progression.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Progression** | An ordered list of **slots** played in a loop. |
| **Slot** | One chord plus its duration in bars (½, 1, 2 or 4). |
| **Bar** | One bar of 4/4. The length of a progression is the sum of its slots' durations. |
| **Vibe** | A named set of generator rules and playback feel (see §9). Six ship in v1. |
| **Lock** | A flag on a Jam slot. Re-roll never changes a locked slot. |
| **Roll** | One output of the generator. Jam keeps a short history of rolls. |
| **Chord tones** | The notes of the chord currently playing (or selected). |
| **Landing notes** | The chord tones of the *next* chord, shown towards the end of the current one, so you can aim a phrase at them. Notes a half step either side of a landing note are **approach notes**, an optional layer. |
| **Avoid notes** | Scale tones that clash with the current chord: a half step above a chord tone (classical definition). **[A6]** |
| **Feel** | Straight or shuffle (swung 8ths), plus the groove pattern used for drums and bass. |

---

## 3. Navigation model: one workspace with a mode switch

There is a **single screen, the workspace**. A **Jam | Solo** segmented switch in the top bar swaps the **main panel**. The layout around the panel (top bar, context row, transport) stays in place.

### 3.1 Regions (phone, portrait; top to bottom)

```
┌───────────────────────────────┐
│ Top bar   [ Jam | Solo ]   ⚙  │  mode switch · sound & fretboard settings
│ Context   Key · Vibe · Tempo  │  chips; each opens a sheet
├───────────────────────────────┤
│                               │
│ Main panel                    │  Jam: vibe rail + progression (lead-sheet cards)
│                               │  Solo: fretboard (vertical neck)
│                               │
├───────────────────────────────┤
│ Progression strip (Solo only) │  scrollable chord chips with a playhead
│ Transport (thumb zone)        │  Jam: ⟲ · RE-ROLL · ▶   Solo: ⏮ · ▶ · ⊕
└───────────────────────────────┘
```

- **Phone, landscape or short viewports** (height < 500px): the context row folds into the top bar, and the fretboard turns horizontal (frets 0–15).
- **Tablet and desktop** (≥ 1024px wide): Jam puts the vibe list in a left column and the progression centre stage. Solo puts the fretboard (horizontal, frets 0–15) across the top, with the progression strip, scale panel and transport below. The transport stays bottom-anchored on every size.

### 3.2 State ownership

| State | Owned by | Notes |
|---|---|---|
| Key, tempo, vibe, progression, selection | **Each mode separately** | Generating in Jam never overwrites the Solo progression, and the reverse. |
| Sound settings (part mutes, count-in) | Global | Apply to both modes. |
| Fretboard settings (tuning, handedness, labels, layers) | Global | Used in Solo. |
| Playback | Global transport, playing the **active mode's** progression | See §3.3. |

### 3.3 Switching modes
- Switching modes while playing **stops playback** and returns the playhead to bar 1 of the new mode. Two separate progressions can't sensibly share one running loop, and silent swaps would confuse.
- **Exception: "Solo over this"** (a Jam action). It copies the current Jam progression, key, tempo and vibe into Solo, replacing what was there, then switches to Solo. If playback is running, it **keeps running without a break**, because it is the same progression. If Solo already had chords, an Undo toast (8 s) restores them.
- The mode switch shows which mode is playing: a small playing indicator appears on the active segment while the transport runs.

### 3.4 Sheets (overlays)
All secondary controls open as **bottom sheets** on phones (thumb-reachable, swipe or tap outside to dismiss) and as **anchored popovers** on desktop. Sheets never stop playback.

| Sheet | Opened from |
|---|---|
| Key | Key chip |
| Vibe | Vibe chip (Solo); in Jam the vibe rail is inline |
| Tempo | Tempo chip |
| Chord | Tapping a chord card or chip; the "+" slot |
| Type progression | Solo strip menu, or the Solo empty state |
| Sound | ⚙ → Sound |
| Fretboard | ⚙ → Fretboard, or the settings icon on the fretboard |

---

## 4. Shared controls

### 4.1 Key
- Root: 12 options shown as a single row in circle-of-fifths order. Mode: **Major / Minor**.
- Spelling follows the conventional key signature: F major uses B♭, not A♯; F♯ minor uses sharps. Ambiguous keys use the signature with fewest accidentals: D♭ and F♯ major, E♭ and B♭ minor (C♯ minor, not D♭ minor). Chromatic notes are spelled by function: in major ♭3, ♭7, ♯4; in minor the leading tone (G♯ in A minor) and the ♭5 blue note (B♭ in E minor). The table lives in `src/theory/` and is tested.
- **Changing the key transposes the whole progression, locked chords included.** It never re-rolls. Chords are stored relative to the key (Roman numerals) in Jam, and transposed by interval in Solo.
- Default key (first load): **[A1]**

### 4.2 Tempo
- Range **40–240 BPM**, integer steps.
- Tempo sheet: large BPM readout, **– / +** buttons (1 BPM per tap; holding repeats, speeding to 5 BPM steps after 1 s), a slider, and **Tap tempo** (averages the last 4 taps; resets after 2 s without a tap).
- Tempo changes take effect **at the next beat**, never mid-beat.
- Jam: choosing a vibe sets the tempo to the vibe's default **unless the user has changed tempo by hand in this session**. A manual tempo always wins.

### 4.3 Transport and looping
- **Looping is always on.** The whole progression loops. (Looping only part of it is out of scope for v1.)
- **Play/Pause** is the largest control on screen and sits at bottom right, under the thumb of a right-handed user. It moves to bottom left when the left-handed setting is on. **[A7]**
- **Pause** holds the playhead position. **Play** resumes from the start of the bar that was playing (not mid-bar), after a count-in if enabled.
- **Restart (⏮)**, Solo only: returns the playhead to bar 1. If playing, it jumps on the next downbeat.
- Tapping Play while the count-in is running cancels the count-in and returns to stopped.
- Playback states: `locked-audio` → `stopped` → `count-in` → `playing` ⇄ `paused`. Visuals for each are in DESIGN.md §8.

### 4.4 Sound settings (global)
| Setting | Default | Behaviour |
|---|---|---|
| Chords | On | Electric-piano / pad voice. **Mute chords** keeps the groove so the user can play rhythm themselves. |
| Bass | On | Root-note bass following the vibe's pattern. |
| Click | On | Quarter notes, accent on beat 1. |
| Drums | Off **[A8]** | Simple pulse (kick, snare, hat) from the vibe's groove. |
| Count-in | On | One bar of clicks before playback, shown visually (DESIGN.md §8). Plays even when Click is off. |
| Feel | From vibe | Straight / Shuffle override. |

Mutes take effect immediately (at the next scheduled note) and never stop or restart the loop.

### 4.5 Editing while playing
Editing is always allowed during playback. Rules:
- A changed slot takes effect **the next time the playhead reaches it**. If the slot playing right now changes, the new chord starts at the next downbeat.
- A deleted slot that is playing right now: playback continues into the following slot at the next downbeat.
- Re-roll or history navigation in Jam: the new progression starts **at the next downbeat, from bar 1**.
- No edit ever causes a count-in or a gap.

---

## 5. Jam mode

### 5.1 Layout
- **Vibe rail:** six vibe "sleeves" in a horizontal scroller (phone) or vertical list (desktop). Each shows the name, a 3–5 word descriptor and reference artists. The selected vibe is marked with a check and the accent edge (DESIGN.md §9.6).
- **Progression:** chord **cards** in lead-sheet order, wrapping 2 per row on phones (4 per row on desktop), each showing the chord symbol, its bar count (if not 1) and a **lock toggle**.
- **Transport:** `⟲ Back` · `RE-ROLL` (wide, solid) · `▶ Play`.
- **Overflow menu** (on the progression header): Length (4 / 8 bars; Blues also 12), "Solo over this".

### 5.2 Flow: pick a vibe and audition
1. The user opens the app. Jam is the default mode on first load.
2. A progression is **already generated** for the default vibe and key, so the screen is never empty. **[A1]**
3. The user taps a vibe sleeve. All **unlocked** slots re-generate for the new vibe immediately. Locked slots stay. Tempo follows §4.2.
4. The user taps **Play**. On the first-ever tap this also unlocks audio (§10.3). Count-in, then the loop plays. The current card is spotlit.

### 5.3 Flow: re-roll
1. The user taps **RE-ROLL** (or presses `R` on desktop).
2. Every unlocked slot gets a new chord from the vibe's rules. Locked slots are kept, and the generator treats them as fixed context (§9.3).
3. The previous roll goes onto the **history stack** (up to 20). **⟲ Back** steps back through it. After going back, RE-ROLL creates a new roll and discards the "forward" history, like browser history. A **Forward** control is not in v1.
4. If playing, the new roll starts at the next downbeat from bar 1 (§4.5).
5. Screen readers hear the new progression announced once via a polite live region ("New progression: E minor 9, A 13, D major 7, B minor 7").

### 5.4 Flow: lock
- Each card has a **lock toggle** (its own 48 × 48 px target, separate from tapping the card itself).
- Locked cards change state through **icon + label + surface** (closed padlock, "Locked" caption, tinted surface), never colour alone.
- Locks survive re-roll, vibe change, key change (chords transpose) and length change (where the slot still exists).
- **If every slot is locked**, RE-ROLL is disabled and its label reads "All locked". Tapping it shows the hint "Unlock a chord to re-roll".
- **Editing a chord by hand locks it automatically** (§5.5). A toast confirms: "Locked so re-roll keeps it · Undo".

### 5.5 Flow: swap a chord
1. The user taps a card. The **Chord sheet** opens for that slot.
2. The sheet shows: the chord and its notes · **Swap for:** 3–6 alternatives the vibe's rules allow in this slot, given its neighbours · **Edit…** (the full chord editor, §6.4) · **Duration** (½ / 1 / 2 / 4) · **Lock** toggle.
3. Choosing an alternative applies it immediately (audible on the next pass) and auto-locks the slot.
4. Changing a duration can push the total over the selected length. If so, the change is refused with an inline message ("8 bars max. Shorten another chord first").

### 5.6 Length
- Jam progressions are **4 or 8 bars**. **Blues also offers 12 bars** so the classic 12-bar form is possible (decision A3). The vibe's harmonic rhythm decides how many chords fill them (Dreamy: 2 chords over 4 bars; Neo-soul: 4–8).
- Which lengths are offered comes from the vibe file (`params.lengths`), not from code, so a vibe can add a length without changing the generator.
- **Leaving Blues while at 12 bars:** the length drops to 8. Slots 9–12 are removed, and an Undo toast (8 s) restores both the slots and the Blues vibe.
- **4 → 8:** existing slots are kept (locks too), and new slots are generated after them.
- **Shortening (12 → 8, 8 → 4):** slots past the new length are removed, locked or not. An Undo toast (8 s) restores them.

### 5.7 Solo over this
Copies Jam's progression, key, tempo and vibe into Solo, then switches mode (§3.3). Locks are dropped, because Solo has no locks.

---

## 6. Solo mode

### 6.1 Layout
- **Fretboard** fills the main panel (§7).
- **Scale bar** sits just above the fretboard: the active scale as a chip, plus **Follow chord** / **Whole song** scope (§6.6).
- **Progression strip:** horizontally scrolling chord chips with a playhead line. A **+** chip sits at the end. The strip menu (⋯) holds: Type progression · Clear all.
- **Transport:** `⏮ Restart` · `▶ Play` · `⊕ Add chord`.

### 6.2 Empty state (first visit)
Solo starts **empty** (unless filled by "Solo over this"). The main panel shows:
- A headline: "What are we soloing over?"
- Three actions: **Add a chord** (primary), **Type the whole progression**, **Bring the Jam progression over**.
- The fretboard still renders, dimmed, showing the key-wide scale for the current key, so the screen teaches what it will do.
- **Play is disabled** with the reason under it: "Add a chord to play".

### 6.3 Flow: enter chords
**Chord by chord (default, thumb-friendly):**
1. The user taps **+** (or ⊕ in the transport). The Chord sheet opens on the **builder**:
   - **Root:** 12 buttons, spelled for the current key.
   - **Quality:** chips, most common first: `maj` `m` `7` `maj7` `m7` `sus2` `sus4` `add9` `6` `m6` `9` `m9` `13` `dim` `m7♭5` `aug`, then **More…** (alterations, slash bass).
   - **Duration:** ½ / 1 / 2 / 4 bars (default **1**).
   - A live preview of the chord symbol and its notes. Tapping the preview plays the chord.
2. **Add** appends the chord and keeps the sheet open on a fresh builder (fast entry of several chords). **Done** closes it.
3. A **Type it** field at the top of the builder accepts free text (§6.4) for users who know the symbol.

**Whole progression at once:**
- A text field accepting chords separated by spaces, with optional bar lines: `Em C G D`, or `| Em | C | G D |`.
- Inside bar lines, chords share the bar equally (`| G D |` = two ½-bar chords). Without bar lines, each chord is 1 bar.
- A live preview shows the parsed chips. Invalid tokens are underlined, and each comes with its own error (§10.2). **Add to progression** is available only when every token is valid.

**Editing an existing chip:** tap it to open the Chord sheet with: builder (pre-filled) · Duration · Move left / Move right · Duplicate · Delete. Desktop and pointer users can also drag chips to reorder. Touch users can long-press then drag. The Move buttons are the accessible equivalent.

### 6.4 Chord input rules (parser)
- **Accepted:** root `A–G` with optional `#`/`b` (also `♯`/`♭`) · quality and extensions in common notation (`m`, `maj7`, `7`, `m7`, `dim`, `dim7`, `aug`/`+`, `sus2`, `sus4`, `add9`, `6`, `m6`, `9`, `m9`, `maj9`, `11`, `13`, `m7b5`) · alterations (`b9`, `#9`, `#11`, `b13`, `b5`, `#5`), with or without parentheses · slash bass (`C/E`).
- **Aliases accepted and normalised:** `-` → `m`, `Δ`/`M7` → `maj7`, `ø` → `m7♭5`, `°` → `dim`, `min` → `m`.
- **Display** is normalised common notation with real accidentals: input `Bbmaj7` displays as **B♭maj7**. The user's spelling of the root is kept (A♯ stays A♯).
- Case: roots are case-insensitive at the start (`em` → Em). After the root, `M7` means maj7 and `m7` means minor 7.
- Max length: 16 characters per chord.
- An alteration straight after the root is bracketed on display, `C(♯11)`, because `C♯11` would read as a C♯ chord.

### 6.5 Flow: set tempo, vibe, key and loop
1. **Tempo:** tap the Tempo chip (§4.2). Default **[A4]**.
2. **Vibe:** optional. It sets the playback feel (groove, voicing, straight or shuffle) and the **order of scale suggestions**. It never changes the chords. The default is **Plain**: straight feel, simple comping, no drums. **[A5]**
3. **Key:** when the progression has ≥ 2 chords and the user hasn't set a key by hand, the app suggests one: a chip reading "Sounds like E minor. Use it?". Accepting sets the key without transposing anything. The user can always set the key manually. Ties show the two best candidates.
4. **Play.** Count-in, then the loop. The playhead moves along the strip, which auto-scrolls to keep the current chip in view. It doesn't auto-scroll while the user is touching the strip, and resumes 3 s after they let go.

### 6.6 Flow: explore the fretboard
1. **What's shown follows the playhead** while playing. While paused or stopped, it shows the **selected** chip (tap a chip to select it).
2. Tapping a chip **while playing** *pins* the fretboard to that chord. A "Pinned: Cmaj7 · Follow" chip appears. Tapping it resumes following. Playback is not affected.
3. **Scale picker** (tap the scale chip): a ranked list of suggestions, each with a fit note. A scale **fits** a chord when (a) it's a seven-note scale that contains all the chord's core tones (root, 3rd, 5th, 6th/7th), or (b) it's a smaller scale (pentatonic, blues) that doesn't contradict the chord's quality: no minor 3rd against a major 3rd (or the reverse), no ♭7 against a maj7 (or the reverse). So E minor pentatonic fits D (its G is only the 4th) but not B7 (its D fights the D♯).
   - **Whole song** scope: scales that fit across the progression, e.g. "E minor pentatonic · fits all 4 chords", "E Dorian · fits 3 of 4 (clashes on C)". The ranking uses vibe order (Blues puts minor pentatonic and blues first) and then fit.
   - **Follow chord** scope: a scale per chord (e.g. A Mixolydian over A7). The fretboard changes scale with the chord.
   - v1 set: major, natural minor, major and minor pentatonic, blues (minor and major), Dorian, Mixolydian, Lydian, Phrygian, harmonic minor. **[A6]**
4. **Layers** (toggle chips under the scale bar): Chord tones (on) · Scale (on) · Landing notes (on) · Approach notes (off) · Avoid notes (off). The root is always marked when either Chord tones or Scale is on. Approach notes only appear while landing notes do, and their chip is disabled (with the reason "Turn on landing notes first") when Landing is off. They're off by default because they can light up most of the neck in the last beat.
5. **Landing notes** appear during the **last beat** of each chord by default (setting: last beat / last bar / always). They stay visible through the change and fade as the next chord's tones take over.
6. **Tap a note** on the fretboard: it plays that pitch (one short note, using the chord voice) and shows a tooltip with note name, interval to the chord and scale degree. This works while playing and doesn't affect the loop.
7. **Labels:** Notes (E, G♯) · Intervals (relative to the **current chord's** root: R, 3, ♭7) · Degrees (relative to the **key**: 1, ♭3, 5).
8. **Text alternative:** "Show as list" under the fretboard gives the same information as text: "Chord tones: E G♯ B D · Scale: E Mixolydian · Landing next: A C♯ E". It serves screen readers and anyone who prefers it.

---

## 7. Fretboard

| Property | Rule |
|---|---|
| Frets shown | 0 (open) to 15. Vertical neck (phone portrait) scrolls; horizontal shows all 16 positions. |
| Orientation | **Phone portrait:** vertical, headstock at top, low E on the left (right-handed). **Landscape / ≥ 600px wide:** horizontal, headstock at left, low E at the bottom (the player's view). |
| Left-handed | Mirrors across the neck's long axis: vertical puts low E on the right; horizontal puts the headstock on the right. Also mirrors transport placement **[A7]**. |
| Tunings | Standard (default), Half-step down, Drop D, DADGAD, Open G, Open D. Changing tuning re-maps all markers instantly. Custom tunings: v2. |
| Inlays | Single dots at 3, 5, 7, 9, 15; double at 12. Fret numbers shown at 3, 5, 7, 9, 12, 15. |
| Note roles | Root, chord tone, scale tone, avoid note, landing note, approach note. Each has a **distinct shape and label** as well as a colour (DESIGN.md §6). Priority when a note has several roles: Root > Chord tone > Landing > Approach > Avoid > Scale. (Avoid sits above Scale because every avoid note is also a scale note; the other way round, avoid notes would never show. Approach sits above Avoid because just before a change, where to go matters more than what to avoid.) A chord tone that is also a landing note gets the landing badge. |
| Scroll position | Kept per session. No auto-scroll during playback (a moving neck under your eyes is disorienting). |

All fretboard maths (which note sits at string *s*, fret *f* for tuning *t*; which roles it has) is a pure function in `src/theory/` with tests.

---

## 8. Keyboard and assistive technology

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `R` | Re-roll (Jam) |
| `L` | Toggle lock on the focused card (Jam) |
| `←` `→` | Move focus between chords |
| `Enter` | Open the Chord sheet for the focused chord |
| `+` `−` | Tempo ±1 (`Shift` for ±5) |
| `Esc` | Close sheet or popover |

- Shortcuts are ignored while a text field has focus.
- The progression is an ordered list. Each card's accessible name is "Bar 1, E minor 9, 1 bar, locked".
- No live announcement for every chord change during playback (too noisy). The current chord is exposed with `aria-current` for anyone who queries it.
- Count-in has a polite announcement ("Count-in") but no per-beat announcements.
- All sheets trap focus and return focus to their trigger on close.

---

## 9. Generator and vibe data (architecture for v2)

### 9.1 Principles
- The generator is a **pure function**: `generate(params, locks, seed) → Progression`. It has no DOM and no audio code. The same inputs and seed always give the same output, so it can be tested.
- **Vibes are data files** in `src/data/vibes/*.json`. The generator knows nothing about any specific vibe.
- **v2 path:** free-text input ("dusty Khruangbin groove, slower") maps onto the *same* `GeneratorParams`, either by picking or blending vibes or by overriding individual fields. No generator changes needed.

### 9.2 Vibe file shape
Implemented in `src/theory/vibe.ts`. Every vibe file is checked on load by `parseVibe`, which lists every problem: unknown degrees, invalid chord qualities, dead ends, degrees that can never be reached, bad tempo ranges.
```ts
interface Vibe {
  id: string;                      // "neo-soul"
  name: string;                    // "Neo-soul"
  descriptor: string;              // "Lush 7ths and 9ths, lazy pocket"
  references: string[];            // ["Tom Misch", "D'Angelo", …]
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

interface GeneratorParams {
  lengths: number[];                              // Jam lengths offered, e.g. [4, 8] or [4, 8, 12]
  harmonicRhythm: { bars: 0.5 | 1 | 2 | 4; w: number }[];
  minChords: number;
  allowRepeats: boolean;                          // a repeat means "hold the chord" (see §9.3)
  loop: "closed" | "free";                        // closed: last chord must lead back to the first
  modes: { major: ModeRules; minor: ModeRules };  // every vibe works in both key modes
}

interface ModeRules {
  vocabulary: Record<Degree, Record<Quality, Weight>>;   // "ii": { "m7": 2, "m9": 3 }; "" = major triad
  starts: Record<Degree, Weight>;
  transitions: Record<Degree, Record<Degree, Weight>>;
  templates?: Record<Length, { markov: Weight; forms: { w: Weight; degrees: Degree[] }[] }>;
}
```
**Degrees** are Roman numerals measured against the major scale of the tonic, so a minor key reads i, ♭III, iv, ♭VI, ♭VII (the usual pop/jazz convention). Case is a label for the reader ("iv" and "IV" are separate entries with the same root). Secondary dominants are written `V/ii`. Qualities are canonical chord suffixes (`m7`, `maj9`, `7sus4`, `6/9`).

### 9.3 Generation rules
1. **Locks first.** Locked slots stay at their bar positions. Locks that no longer fit (after shortening) are dropped.
2. **Templates** (optional, per length): if the vibe has forms for this length, one is chosen by weight. Only forms that agree with the locks are considered. `markov` is the weight of using the rules below instead (0 = always use a form, as for the 12-bar blues). Runs of the same bar are merged into longer chords on 4/2/1-bar boundaries.
3. **Durations** fill the free gaps from `harmonicRhythm`. Chords of a bar or more start on a bar line, and ½-bar chords come in pairs within a bar.
4. **Chords** fill left to right from `starts`, then `transitions`. The chord before a locked slot must be able to move into it. With `loop: "closed"`, the last chord must be able to move back into the first.
5. **No repeats** unless `allowRepeats`. When repeats are allowed, neighbouring repeats of the same degree are merged into one held chord (e.g. `Em7(½) Em7(½) Em7` → `Em7` for 2 bars).
6. **Quality** for each chord comes from the degree's vocabulary weights.
7. **Never the same roll twice in a row** (retry with the next random draw).
8. **Relaxation:** if the rules can't be met after 50 attempts, relax them in order (repeats → loop → neighbours of locks → transitions), 50 attempts each, and report which were relaxed. The last level ignores transitions, so the generator always returns a progression and never an empty one.
9. The generator is seeded (`mulberry32`), so every result is reproducible in tests.

### 9.4 v1 vibes
| Vibe | References | Core movement |
|---|---|---|
| Neo-soul | Tom Misch, D'Angelo, Mac Ayres, FKJ, Christian Kuria | maj7, m9 and dom9 colours, ii–V, chromatic approach chords, borrowed iv |
| Blues | BB King, Christone "Kingfish" Ingram, Marcus King, Jimi Hendrix | dom7 throughout, quick-change and turnaround forms, minor blues |
| Soul & Roots | Leon Bridges, Ray Charles, Chris Stapleton, Ray LaMontagne, Norah Jones | I–IV–V with 6ths and 7ths, gospel turnarounds, IV–iv–I |
| Heartland | The War On Drugs, The Paper Kites, John Mayer | I–V–vi–IV family, sus and add9, long chords, driving 8ths |
| Dreamy | M83, Pink Floyd | Slow modal movement, pedal tones, open voicings, 2–4 bars per chord |
| Desert Groove | Khruangbin, Hermanos Gutiérrez, Carlos Santana | Minor modal vamps (Dorian, Phrygian), i–IV, Andalusian ♭VII–♭VI–V |

The exact weights are tuned by ear during the build, and each vibe gets test fixtures for its rules.

---

## 10. Edge cases

### 10.1 Empty progression
- **Jam** is never empty: it always has a generated progression, and the generator never returns empty (§9.3.6).
- **Solo** starts empty (§6.2). Play is disabled with a visible reason. The fretboard is shown dimmed with the key-wide scale.
- **Deleting the last Solo chord while playing** stops playback, returns to the empty state, and shows an Undo toast (8 s).
- **Clear all** (Solo) asks for confirmation in the sheet ("Clear 6 chords?") and offers Undo afterwards.

### 10.2 Invalid chord input
- Parsing runs on each keystroke. While a token is incomplete (`C#m7b`), no error shows. Errors appear on blur, on Add, or after 800 ms of no typing.
- Errors are specific, placed under the field, and give an example: "Didn't recognise "Cmaj#". Try Cmaj7, Cmaj7♯11 or C/E."
- The invalid text is **kept as typed** and never cleared. The field gets the error state (icon + text + border; DESIGN.md §9.3).
- The **Add** button stays disabled until the input is valid. Its accessible description states why.
- Type-progression mode: each bad token is flagged on its own, the error count is summarised ("2 chords need fixing"), and the valid chips still preview.
- A chord the parser accepts but the theory module can't voice (e.g. a highly altered chord): accept it, play the core triad plus the 7th, and show "Simplified for playback" in the Chord sheet.
- Over the length cap (16 bars in Solo; in Jam, the selected length): Add is disabled with the message "16 bars max" (or the Jam length).

### 10.3 Audio blocked until first tap
- Browsers block audio until a user gesture. On load, the transport is in the **`locked-audio`** state. It looks normal (no scary banner), but the Play button's accessible label is "Play (turns on sound)".
- The **first tap** on Play, a fretboard note or a chord preview creates and resumes the AudioContext in the same gesture, then does what the user asked.
- If the context is still suspended after that tap, a small inline banner above the transport reads: "Your browser blocked sound. Tap to try again." Tapping it retries. It never auto-retries in a loop.
- **iOS silent switch:** Web Audio can be muted by the ring/silent switch, and this can't be detected reliably. On iOS only, the first time playback starts, show a 6-second hint: "No sound? Check your silent switch."
- **Interruptions** (phone call, another app takes audio, the context becomes "interrupted"): the transport goes to **paused**, with the toast "Playback paused".
- **Background or screen lock:** playback continues if the browser allows. The app asks for a **screen wake lock** while playing so the screen doesn't sleep during practice, and releases it on pause or stop. Where the wake lock isn't supported, nothing happens.

### 10.4 Other edge cases
| Case | Behaviour |
|---|---|
| All Jam slots locked | RE-ROLL disabled, labelled "All locked" (§5.4). |
| Vibe change with locks | Locked slots stay. Unlocked ones re-generate for the new vibe. |
| Key change with locks | Everything transposes. Nothing re-rolls. |
| History at its oldest roll | ⟲ Back is disabled. |
| Tempo out of range (typed or tapped) | Clamped to 40–240, with the clamp shown ("Max 240"). |
| ½-bar chords at 240 BPM | Allowed (that's 2 beats at 240). Timing tests cover it. |
| Same chord repeated in Solo | Allowed (songs do this). The strip shows each repeat. |
| Enharmonic input (`A#` in the key of F) | Keep the user's spelling on the chip. The fretboard labels follow the key's spelling. |
| Rotate during playback | Layout changes, playback is unaffected, and the fretboard scroll position is kept where possible. |
| Reduced motion | All motion is replaced as DESIGN.md §10.3 sets out. No functional difference. |
| Page refresh, phone lock, tab discarded | The session is restored from `localStorage` (§10.5). |
| Very narrow screens (≤ 340px) | Jam cards drop to 1 per row. Every control stays ≥ 48 px. |

### 10.5 Session restore (decision A2)
This keeps a refresh, a locked phone or a discarded background tab from wiping work. It is **not** saving: there's one session, on one device, with no named items, no export and no sharing.
- **Stored** in `localStorage` under one versioned key (`session.v1`): both modes' key, tempo, vibe, progression (with locks and durations) and selection; Jam's current roll plus its history stack; global sound and fretboard settings; whether the user has set tempo and key by hand.
- **Not stored:** playback state. After a restore the app opens **stopped**, in the mode last used, and audio still needs a first tap (§10.3).
- **Written** at most once every 500 ms, after any change, and on `pagehide`. Writes never run in the audio scheduling path.
- **Unreadable, corrupt or older-schema data:** discarded silently, and the app starts fresh (§11 A1 defaults). It never shows a broken half-restored state. Schema migrations can come later if needed.
- **Storage unavailable or full** (private browsing, quota): the app works normally without persistence, with no error shown.
- **Start fresh:** ⚙ → "Start fresh" clears the stored session and resets both modes to defaults, after a confirmation in the sheet ("Clear both modes and settings?"). There's no Undo after confirming.
- Lives in its own small module (`src/state/persist`), separate from the theory, audio and UI code.

---

## 11. Assumptions

A2, A3, A9 and A10 are decided. The rest are working defaults: they stand unless you change them.

| # | Assumption | Why it matters |
|---|---|---|
| **A1** | First load: Jam, vibe **Neo-soul**, key **D major**, a progression already generated. | Sets the first impression. Any vibe or key works; I picked one with lots of colour. |
| **A2** | ✅ **Decided:** restore the current session from `localStorage` (§10.5). | — |
| **A3** | ✅ **Decided:** Jam offers 4 / 8 bars; Blues also offers 12 (§5.6). | — |
| **A4** | Solo default tempo **90 BPM**; Jam uses each vibe's default. | Minor. |
| **A5** | Solo vibe is **optional**, defaulting to "Plain" (straight, no drums). | You said users know the song's vibe. This lets them set it without forcing a choice. |
| **A6** | Avoid notes use the classical definition (a half step above a chord tone). Scale set as listed in §6.6. | Theory choices that the tests will lock in. |
| **A7** | The left-handed toggle also mirrors the transport (Play under the left thumb). | Left-handed players fret with the right hand, so the free thumb for tapping may be on the left. |
| **A8** | Drums default **off**, so the first sound is musical, not a drum machine. | Taste call. |
| **A9** | ✅ **Decided:** plain Web Audio, no Tone.js. Any future dependency is still raised first (CLAUDE.md). | — |
| **A10** | ✅ **Decided:** fonts are self-hosted WOFF2 files (DESIGN.md §4). | — |
