# DESIGN.md: Visual system, "Sympathetic strings"

> Status: **v2 draft, for review.** Rewritten around the generative direction (prototype 04). Dark only.
> Every value here is a token. Code must not use a colour, font, size, radius, duration or spacing value that isn't listed here (CLAUDE.md).
> Values come from the prototype (`design/explorations/04-generative/`). Values marked **NEW** weren't in the prototype; they fill gaps the rules require (hover, pressed, disabled, the off-switch border) and are **approved**.
> Contrast ratios use the WCAG 2.x formula. Behaviour lives in `SPEC.md`. The previous system (Late Set) is in git history.

---

## 1. Direction

**Sympathetic strings.** On a sitar, some strings are never plucked: they ring because the played notes make them vibrate. The screen works the same way. It fills with strings that move because the music does: their wave shapes are built from the chord's own interval ratios, so the picture *is* the harmony.

**Two layers with different jobs:**
- **The visuals carry all the colour.** Each vibe has its own palette and motion. They're expressive, full-bleed, and appear only while music plays.
- **The interface is monochrome:** warm off-white on dark glass, so it never competes with the visuals and reads the same over any of them. One exception: Play is green, the universal "go".

**Why it fits the problem**
- **Dim rooms:** a near-black screen when stopped; glowing colour only while playing; warm off-white text, never pure white.
- **Arm's length:** large chord names and charts in the centre, 56 px round controls in the thumb zone, few decisions.
- **Portfolio:** the visuals are the memorable moment, and they're honest: driven by real harmony, not a screensaver.

**Mood in words:** strings ringing in sympathy · oscilloscope traces · stage haze lit in colour · a record sleeve that moves.

**Avoid:** purple-to-blue SaaS gradients · card grids of equal tiles · decorative shadows · colour in the UI chrome (it belongs to the visuals) · any flashing on the beat · bold weights (DM Sans Regular and Medium only).

---

## 2. Colour tokens (interface)

All tokens are CSS custom properties on `:root`. Translucent values sit over the visuals, so their contrast depends on what's beneath; §2.4 covers that.

### 2.1 Base
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0b0b` | Page and canvas background. Near-black. |
| `--text` | `#f4f0e8` | Primary text, chord names, chart ink, selected fills. Warm off-white. |
| `--muted` | `#a8a39a` | Secondary text, captions, unselected tabs, idle icons. |
| `--ink` | `#121110` | Text and icons on `--text` and `--go` fills. |
| `--go` | `#33a066` | Play button fill; a switch's "on" track. |

| Pair | Ratio | Meets |
|---|---|---|
| `--text` on `--bg` | 17.32 | AAA |
| `--muted` on `--bg` | 7.85 | AAA |
| `--ink` on `--text` | 16.59 | AAA |
| `--ink` on `--go` | 5.71 | AA (icons and text) |
| `--go` on `--bg` | 5.96 | Non-text 3:1 ✓ |

### 2.2 Glass and fills
| Token | Value | Use |
|---|---|---|
| `--glass` | `rgb(20 20 20 / 0.72)` + `backdrop-filter: blur(28px) saturate(1.2)` | The floating panel; the status pill and the Settings button (blur 20px). |
| `--glass-strong` | `rgb(20 20 20 / 0.92)` + blur 28px | Pickers. More opaque, because they hold small text. |
| `--card` | `rgb(11 11 11 / 0.55)` + blur 14px | Chord cards that aren't current. |
| `--card-now` | `rgb(28 28 28 / 0.82)` + blur 14px | The current chord card. |
| `--line` | `rgb(255 255 255 / 0.08)` | 1 px edge on the panel and pickers. |
| `--edge-now` | `rgb(255 255 255 / 0.14)` | 1 px edge on the current card. |
| `--fill-1` | `rgb(255 255 255 / 0.05)` | Picker options, key buttons, switch rows. |
| `--fill-2` | `rgb(255 255 255 / 0.06)` | Panel buttons and chips. |
| `--fill-open` | `rgb(255 255 255 / 0.16)` | A chip whose picker is open. |
| `--track` | `rgb(255 255 255 / 0.12)` | Progress bar track (panel); `0.14` on cards. |
| `--switch-off` | `rgb(255 255 255 / 0.18)` | Switch track when off. See §2.4. |
| `--chart-line` | `rgb(244 240 232 / 0.38)` | Chord chart strings and frets (3.23:1 on a card). |
| `--hover` **NEW** | `rgb(255 255 255 / 0.10)` | Hover on `--fill-1` / `--fill-2` controls. |
| `--pressed` **NEW** | `rgb(255 255 255 / 0.14)` | Pressed on `--fill-1` / `--fill-2` controls. |

### 2.3 Selected and "on"
Selected and on states **invert**: `--text` fill, `--ink` content. It reads at any distance and needs no colour. Used by: selected picker options, keys and lengths, the Re-roll button (always), the current chord's progress fill and lit count-in beats. Secondary text inside a selected option uses `--ink` at 70% (6.65:1).

### 2.4 Contrast over the visuals
Measured worst cases, with the glass over the **brightest visual colour** (`#e9f7ff`) and no blur:

| Surface | `--text` | `--muted` |
|---|---|---|
| `--glass` (panel) | 6.78 | **3.07** |
| `--glass-strong` (pickers) | 13.32 | 6.03 |
| `--card-now` | 8.70 | 3.94 |
| `--card` (past and upcoming chords) | 4.10 | 1.86 |

Lines are thin and blurred, so real values sit much closer to the over-`--bg` figures (16.55 and 7.50 on the panel). Rules:
- **Small text in `--muted` never sits on `--glass` or `--card`.** Panel chips use `--muted` only for the "BPM" unit, which is a 15 px label next to the number. **Check during the build** by sampling screenshots across vibes; if any reading falls under 4.5:1, raise the panel glass to 0.8.
- Chord names on `--card` are ≥ 30 px Medium (large text, 3:1 needed): 4.10 in the worst case ✓.
- **Off switch:** `--switch-off` alone is 1.73:1 against `--glass-strong`, under the 3:1 needed for controls. **Fix (NEW, approved):** a 1 px `--muted` inset border on the off track (7.39:1).

### 2.5 Visual palettes (decorative)
Each vibe's look has two gradient pairs, one for major-family chords (warmer) and one for minor and diminished (cooler). These colours are **decorative only**: no text, no state, no information depends on them.

| Vibe | Major pair | Minor pair |
|---|---|---|
| Neo-soul | `#ff8a3d` → `#ff4d7e` | `#ff4d7e` → `#c4467a` |
| Blues | `#2f7bff` → `#36d1ff` | `#1f4fd1` → `#2f7bff` |
| Soul & Roots | `#ffb020` → `#ff5a1f` | `#ff5a1f` → `#d2334b` |
| Heartland | `#ffd23f` → `#3ccf7d` | `#3ccf7d` → `#22a7b8` |
| Dreamy | `#8fe3ff` → `#e9f7ff` | `#4f9dff` → `#8fe3ff` |
| Desert Groove | `#ff7a3d` → `#ffd23f` | `#e0442b` → `#ff9a3d` |

No purple gradients. Blues is the only cool-blue vibe, on purpose.

---

## 3. The visuals

### 3.1 How the picture is made
- **Strings:** evenly spaced lines (horizontal or vertical, per vibe) across the whole screen. Each line is a wave.
- **Harmony → shape:** a line's wave is the sum of sines at the current chord's **just-intonation ratios**, the first weighted most:
  - major `1 : 5/4 : 3/2`; minor `1 : 6/5 : 3/2`; sus2 third `9/8`; sus4 `4/3`;
  - diminished fifth `64/45` (a tritone, so it looks restless);
  - major 7th `15/8`; minor 7th `9/5` on minor chords, `7/4` on dominant chords.

  Consonant chords make smooth, regular interference; tense ones look busier.
- **Chord root → base frequency:** the wave's base cycles shift slightly with the root, so a new root changes the picture even when the quality doesn't.
- **Colour:** a gradient along the lines from the vibe's pair (§2.5), major or minor pair by chord quality, easing to the new pair over about 0.4 s.
- **Depth:** lines near the centre are more opaque than those at the edges (35% → 100%), so the middle, where the chord card sits, is the richest area.
- **Style per vibe:** each vibe is drawn as **strings** (lines) or as **dots**: the same field sampled on a 14 px grid, with dot size (1.5–7.5 px) and opacity following the wave's strength, like a moving halftone. There's no switch. Making all six vibes clearly distinct (more than two styles) is the next visuals task.

### 3.2 Per-vibe looks
| Vibe | Style | Lines | Line width | Amplitude | Speed | Cycles | Orientation | Sway |
|---|---|---|---|---|---|---|---|---|
| Neo-soul | strings | 30 | 1.6 | 2.4 | 0.55 | 1.4 | horizontal | 0.35 |
| Blues | strings | 16 | 3.2 | 1.6 | 0.40 | 0.9 | horizontal | 0.6 |
| Soul & Roots | dots | 22 | 2.2 | 1.8 | 0.60 | 1.1 | vertical | 0.15 |
| Heartland | strings | 26 | 2.0 | 1.4 | 0.90 | 1.6 | vertical | 0 |
| Dreamy | dots | 20 | 1.4 | 3.2 | 0.25 | 0.7 | horizontal | 0 |
| Desert Groove | dots | 34 | 1.3 | 1.2 | 0.75 | 2.6 | vertical | 0.1 |

Amplitude is a multiple of the line spacing; speed scales with tempo (`bpm / 90`). **Sway** adds a slow side-to-side lilt to shuffle vibes. These values belong in the vibe data files (SPEC A16).

### 3.3 Motion rules
| Event | Treatment |
|---|---|
| **Play** | The visuals fade in (presence rate 2.2/s, about 0.5 s to full). Motion speeds up with presence. |
| **Pause** | **Freeze:** drift, swell, colour and crossfades all hold exactly where they were. The picture stays visible. Play resumes from there. |
| **Before first play** | Hidden: the screen is `--bg`. (Fades out at rate 3/s if playback ever ends without pausing.) |
| **Chord change** | A new harmonic layer fades in while the old ones fade out (rate 3.5/s). Layers overlap, so fast changes never snap. |
| **Beat** | A swell in amplitude: `0.12 × (0.5 + 0.5·cos(2π·beatFraction))`, from the audio clock. Continuous through the beat line: never a step, never a flash. |
| **Tempo** | Sets the speed of drift. |

All easing is frame-rate independent (`1 − e^(−rate·dt)`). The visuals render at device pixel ratio, capped at 2.

### 3.4 Safety
- **No flashing (WCAG 2.3.1):** brightness never steps on the beat. The beat changes amplitude by at most 12%, smoothly.
- **Reduced motion:** no drift and no swell; chord changes switch shape and colour without crossfading. The visuals still appear when playing, but stand still.
- **Hidden from assistive tech** (`aria-hidden`). The canvas carries no information that isn't in text.

---

## 4. Typography

### 4.1 Families
| Token | Family | Use |
|---|---|---|
| `--font` | **DM Sans** (variable), **Regular 400 and Medium 500 only** | Everything. |
| (fallback for ♭ ♮ ♯) | **Noto Music**, subset to U+266D–266F | Real accidentals. DM Sans has none. |

- Stack: `'DM Sans', 'NM', system-ui, sans-serif` (where `NM` is the Noto Music subset). Self-hosted WOFF2 (SPEC A10). Both are SIL OFL.
- **No bold.** Hierarchy comes from size, weight 500 vs 400, and the invert.
- DM Sans has **no tabular figures**, so numbers that change (BPM) sit in fixed-width boxes so the layout doesn't jump.
- **Known issue:** at display sizes the Noto ♭/♯ look thin next to DM Sans Medium. Plan: draw our own accidentals as an SVG or a small custom font subset.

### 4.2 Scale
| Token | Size | Weight | Use |
|---|---|---|---|
| `--t-micro` | 11 px | 500 | Click toggle digits, HELD tag (tracking +0.06em) |
| `--t-fine` | 12 px | 400 | Credits, "BPM" under the tempo readout (tracking +0.1em) |
| `--t-caption` | 13 px | 400 / 500 | Picker titles (uppercase, tracking +0.1em), option descriptions, loading pill, switch hints |
| `--t-small` | 14 px | 500 | Top segmented control |
| `--t-chip` | 15 px | 500 | Settings chips |
| `--t-button` | 16 px | 500 | Re-roll label (uppercase, tracking +0.08em) |
| `--t-body` | 17 px | 400 / 500 | Mode tabs, picker options, key buttons, body text |
| `--t-step` | 24 px | 400 | Tempo − / + glyphs |
| `--t-chord` | 34 px phone · 30 px desktop | 500 | Chord name on a card (tracking −0.02em, line height 1) |
| `--t-readout` | 48 px | 500 | Tempo readout |

Chord names are smaller on desktop because the chart beside them is larger there. Text never scales with the viewport and honours browser zoom.

### 4.3 Chord symbols
- Root letter at full size. An accidental on the root at 72%, raised 0.28em.
- A minor `m` sits on the baseline at full size ("Em").
- Quality (`7`, `maj7`, `sus4`, `dim`) is superscript at 55%, raised 0.75em.
- The accessible name is spoken text ("B flat major 7"), from `src/theory/`.

---

## 5. Layout, spacing and shape

### 5.1 Breakpoint
One breakpoint, **900 px** wide:
- **Phone (< 900):** panel with two rows (playback above, chips below). Charts 156 px wide. Carousel 300 px tall.
- **Desktop (≥ 900):** panel in one row, max 760 px wide, centred (chips left, actions right; Re-roll a fixed 200 px). Charts 210 px wide. Carousel 420 px tall. Pickers 420 px wide.

### 5.2 Spacing
| Token | Value | Use |
|---|---|---|
| `--gap` | 6 px | Between buttons and chips in a row; between picker options |
| `--s-8` | 8 px | Between the two panel rows; icon-to-label gap |
| `--s-10` | 10 px | Panel padding (phone); gap between panel and picker |
| `--s-12` | 12 px | Screen gutters; panel padding (desktop); card inner gap |
| `--s-14` | 14 px | Chip and card side padding; carousel gap (phone) |
| `--s-16` | 16 px | Picker padding; option side padding; card top and bottom padding |
| `--s-24` | 24 px | Carousel gap (desktop) |

Fine adjustments, used only where listed: **2 px** (option description top margin; HELD tag vertical padding), **4 px** (switch row right padding; credit and note side margins), **18 px** (space above a picker's second section, e.g. LENGTH), **−8 px** (the Sound view's back control pulls into the picker padding so its chevron aligns with the rows).

Safe areas: the top bar and panel respect `env(safe-area-inset-*)`, with a 12 px minimum at the bottom.

### 5.3 Targets
| Token | Value | Applies to |
|---|---|---|
| `--target-primary` | **56 × 56 px** | Play, Back, Click, Re-roll height, tempo ± |
| `--target-min` | **48 px** tall | Chips, mode tabs, picker options (56), key buttons (52), switch rows (56). Top segmented control: 42 px buttons inside a 48 px control. |

Targets are at least 6 px apart.

### 5.4 Radii
| Token | Value | Use |
|---|---|---|
| `--r-pill` | 999 px | Buttons, chips, pills, switches, progress bars |
| `--r-panel` | 28 px | The floating panel |
| `--r-picker` | 24 px | Pickers |
| `--r-card` | 22 px | Chord cards |
| `--r-option` | 16 px | Picker options, switch rows, Tap tempo |
| `--r-key` | 14 px | Key and mode buttons |

Everything is soft and round: it reads as an instrument, not a form.

---

## 6. Components

1. **Mode tabs (Jam · Solo):** plain text buttons, 48 px tall, `--t-body` 500. Current: `--text`; other: `--muted`. No underline or pill. *(Solo isn't designed yet: SPEC A13.)*
   **Settings button** (top right): 48 px pill, `--glass`, sliders icon + "Settings" in `--t-chip`. Open: `--fill-open`. Its picker drops down below the top bar (right-aligned, 420 px on desktop, full width minus gutters on phones).
2. **Carousel card:** a fixed width (chart + 28 px), `--r-card`, `--card` with blur. Chart above, chord name below, progress bar at the bottom.
   - **Current:** scale 1, `--card-now`, 1 px `--edge-now`, the progress bar visible.
   - **Others:** scale 0.6 (phone) / 0.68 (desktop). Past: 50% opacity. Beyond the visible range: hidden.
   - The card is a button (`role="button"`, focusable); its name is the spoken chord.
3. **Progress bar:** 3 px tall, `--r-pill`, `--track` at 0.14, filled with `--text`.
4. **Chord chart:** see §7.
5. **Floating panel:** `--glass`, 1 px `--line`, `--r-panel`, the padding from §5.2. It's the only fixed UI at the bottom.
6. **Back:** a 56 px circle, `--fill-2`, `--muted` icon.
7. **Re-roll:** 56 px tall pill, always inverted (`--text` fill, `--ink` label), re-roll icon + "RE-ROLL" in `--t-button`. The widest control; grows to fill the row on phones (190 px at 360 px wide).
8. **Play / Pause:** 56 px circle, `--go` fill, `--ink` icon. Pause shows two bars.
9. **Settings chip:** 48 px pill, `--fill-2`, `--t-chip`. Vibe chip grows to fill the space and carries a chevron. Open: `--fill-open` and `aria-expanded="true"`. A **HELD** tag (inverted, `--t-micro`, 6 px radius) marks a held key or tempo.
10. **Picker:** `--glass-strong`, 1 px `--line`, `--r-picker`, 16 px padding, max height 60% of the viewport (scrolls). Title in `--t-caption` uppercase `--muted`.
11. **Picker option:** min 56 px tall, `--fill-1`, `--r-option`, name in `--t-body` and a description in `--t-caption` `--muted`. Selected: inverted.
12. **Key grid:** Major/Minor in two columns, then 12 keys in six columns, 52 px tall, `--r-key`, `--fill-1`. Selected: inverted.
    **Length:** the same button style in one row ("4 bars", "8 bars", "12 bars"), under a "LENGTH" title in the vibe picker.
13. **Switch row:** min 56 px, `--fill-1`, `--r-option`; label in `--t-body` with a hint in `--t-caption` `--muted`; a 46 × 28 switch. On: `--go` track, knob slides 18 px right. Off: `--switch-off` track with a 1 px `--muted` inset border (§2.4).
14. **Tempo control:** − and + as 56 px pills either side of the `--t-readout` number (fixed width), "BPM" under it; slider (44 px tall, `accent-color: --text`); Tap tempo (52 px, `--r-option`); Hold switch; the vibe's range in `--t-caption` `--muted`.
15. **Loading pill:** top centre, `--glass`, `--r-pill`, `--t-caption` `--muted`, `role="status"`. Fades out when done.
13a. **Settings views:** the main view lists a **nav row** (like a switch row, with the label, a hint and a `--muted` right chevron) for Sound, then the Count-in and Metronome switch rows, 6 px apart. The Sound view replaces it in place: a 48 px **back control** (left chevron + "Sound" in `--t-body` 500, no fill until hover) instead of a title, then the part switches and credits. No slide animation between views.
16. **Credit line:** `--t-fine` `--muted` with underlined links, in Settings → Sound.

### 6.1 Icons
Inline SVG, 24 px grid drawn at 22 px, 1.75 px stroke, round caps and joins, `currentColor`. Set: play, pause, back (curved arrow), re-roll (two arrows), chevron (down, left, right), sliders (Settings). Icons never stand alone on Re-roll; Play and Back have accessible names.

---

## 7. Chord charts

- **Monochrome and light:** strings and frets in `--chart-line` at 1 px; finger dots, barres and the nut in `--text`. No colour, no finger numbers, no string names.
- **Orientation:** nut at the top, low E on the left. 6 strings, 5 frets, always.
- **Proportions (from the chart width `w`):** top margin 0.16w, left 0.12w, right 0.06w; string spacing `gs = (w − margins) / 5`; fret height 1.22·gs.
- **Dots:** circles of radius 0.24·gs. **Circles only** (no squares).
- **Barre:** a pill across the barred strings, the dot's height (1.6r), radius 0.8r.
- **Nut:** 3 px, `--text`, rounded, only when the shape starts at fret 1. Otherwise a fret number (`--muted`, at least 10 px) sits left of the first fret.
- **Open string:** a hollow circle above the nut (1.2 px stroke). **Muted string:** a small × in `--muted`.
- Widths: 156 px on phones, 210 px on desktop.
- Charts are `aria-hidden`; the card's spoken name carries the chord.

---

## 8. States

### 8.1 Interaction states
| State | Fill controls (`--fill-1/2`) | Inverted controls (Re-roll, selected) | Play (`--go`) |
|---|---|---|---|
| **Default** | as listed | `--text` fill, `--ink` content | `--go`, `--ink` icon |
| **Hover** (pointer only, `@media (hover: hover)`) | `--hover` **NEW** | `--text` at 90% **NEW** | `--go` with a 1 px `--text` inner ring **NEW** |
| **Focus-visible** | 2 px `--text` outline, 2 px offset | same | same |
| **Pressed** | `--pressed` **NEW**, scale 0.97 **NEW** | scale 0.97 **NEW** | scale 0.97 **NEW** |
| **Disabled** | 40% opacity, `cursor: not-allowed` **NEW**, always with a visible reason | same | same |
| **Selected / on** | inverted (§2.3) | — | — |

- Disabled text is exempt from contrast rules but is never the only place information lives.
- Pressed scale is removed under reduced motion; the fill change stays.

### 8.2 Playback states
| State | Panel | Carousel | Visuals |
|---|---|---|---|
| **Locked-audio** | Looks like Stopped. Play's name: "Play (turns on sound)". | First chord centred. | Hidden. |
| **Stopped** | Play icon. | First (or last tapped) chord centred; empty bar. | Hidden. |
| **Count-in** (if on) | Pause icon. | First chord centred; its progress bar is four segments (`--track-card`, 6 px apart) that fill with `--text` one per beat. | Hidden until beat 1. |
| **Playing** | Pause icon. | Current chord centred, bar filling, cards sliding on each change. | Visible, moving. |
| **Paused** | Play icon. | Paused chord stays centred and highlighted; bar frozen. | Frozen, still visible. |

### 8.3 Loading and errors
- **Instruments:** the loading pill (§6.15). The synth plays meanwhile, so there is no blocking spinner.
- **Audio blocked:** an inline message above the panel in `--glass`, with a "Try again" action (design pending).
- **Toasts** (Undo, "Playback paused"): `--glass`, `--r-pill`, `--t-caption` `--text`, above the panel, 8 s (design pending).

---

## 9. Motion

### 9.1 Tokens
| Token | Value | Use |
|---|---|---|
| `--dur-carousel` | 620 ms, `cubic-bezier(0.32, 0.72, 0, 1)` | Cards sliding and scaling |
| `--dur-fade` | 500 ms ease | Card opacity and fill changes |
| `--dur-loading` | 400 ms ease | Loading pill fade |
| `--dur-bar` | 300 ms ease | Progress bar appearing |
| `--dur-pop` | 220 ms, `cubic-bezier(0.2, 0, 0, 1)` | Picker entering (fade + 8 px rise) |
| `--dur-switch` | 200 ms, `cubic-bezier(0.2, 0, 0, 1)` | Switch knob |

The visuals use continuous rates, not durations (§3.3).

### 9.2 Rules
- **The carousel moves on the chord change,** never before it. When the loop wraps, cards jumping from one end to the other move without animation, so nothing flies across the screen.
- **The progress bar is never animated by CSS;** it's set each frame from the audio clock.
- Everything beat-related follows the audio clock, minus output latency, so visuals never lead the sound.

### 9.3 Reduced motion (`prefers-reduced-motion: reduce`)
| Normal | Reduced |
|---|---|
| Visuals drift, swell and crossfade | Still; shape and colour switch on chord changes |
| Cards slide and scale | Opacity change only (200 ms) |
| Picker rises | Appears without animation |
| Pressed scale | Fill change only |

The progress bar keeps moving: it shows position, not decoration.

---

## 10. Fretboard (Solo)

To be designed with the Solo layout (SPEC A13). These rules carry over and are fixed:
- **Each role is identifiable in greyscale.** Shape, fill style and label carry the meaning; colour only reinforces it.
  - Root: rounded square, solid.
  - Chord tone: circle, solid.
  - Scale tone: circle, ring only.
  - Avoid: circle, dashed ring with a slash.
  - Landing: diamond, ring (fills solid on the change).
  - Approach: small triangle, ring.
- A legend of the shapes in use is always visible.
- Marker taps cover the whole string × fret cell (≥ 48 px on phones).
- Role colours must come from new tokens defined then. The previous palette (amber, sage) doesn't belong to this direction.

---

## 11. Accessibility checklist (design side)
- [ ] Text ≥ 4.5:1 (body) / 3:1 (large) over the **worst** visual beneath it (§2.4): verify by screenshot sampling for every vibe.
- [ ] Control boundaries and meaningful icons ≥ 3:1. Fix the off-switch track (§2.4).
- [ ] Every interactive element has hover, focus-visible, pressed and disabled styles (§8.1).
- [ ] Every disabled control has a visible reason.
- [ ] Targets ≥ 48 px (56 px primary), ≥ 6 px apart.
- [ ] No flashing; reduced motion honoured (§3.4, §9.3).
- [ ] Layout holds at 200% text zoom and at 320 px width with no horizontal page scroll.
- [ ] Nothing depends on the visuals or on colour alone.

---

## 12. Open design items
| Item | Notes |
|---|---|
| Solo layout and fretboard | Next design task (SPEC A13). |
| Six distinct visualisations | Each vibe its own style, beyond strings vs dots (SPEC A14). |
| Own accidentals | Replace the thin Noto ♭/♯ (§4.1). |
| Toasts, blocked-audio message | Visual design pending (§8.3). |
| Wordmark | No product name yet. Until there is one, the top bar shows only the mode tabs. |
