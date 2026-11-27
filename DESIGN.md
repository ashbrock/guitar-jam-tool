# DESIGN.md: Visual system (interim, black and white)

> Status: **interim.** Black-and-white working layout (SPEC A22) until the hi-fi designs; the generative direction was removed (SPEC A24). Dark only.
> Every value here is a token. Code must not use a colour, font, size, radius, duration or spacing value that isn't listed here (CLAUDE.md).
> Values come from the prototype (`design/explorations/04-generative/`). Values marked **NEW** weren't in the prototype; they fill gaps the rules require (hover, pressed, disabled, the off-switch border) and are **approved**.
> Contrast ratios use the WCAG 2.x formula. Behaviour lives in `SPEC.md`. The previous system (Late Set) is in git history.

---

## 1. Direction

**Interim: a black-and-white working layout** until the hi-fi designs (SPEC A22). The earlier "sympathetic strings" direction, with full-screen generative visuals carrying the colour, was built and then removed (SPEC A24): the app is mostly used silently next to a band, as a chart, so the screen should be a calm, legible chart.

- **Dim rooms:** near-black background, warm off-white text (never pure white), no colour.
- **Arm's length:** one large chord chart and name in the centre; a song map you can read and tap; round controls in the thumb zone, Re-roll the largest.
- **Selected means white:** the selected chord's block, the Re-roll button and on switches are solid `--text`; everything else sits on low-opacity fills.

**Avoid:** purple-to-blue SaaS gradients · card grids of equal tiles · decorative shadows · any flashing on the beat · bold weights (DM Sans Regular and Medium only).

---

## 2. Colour tokens (interface)

All tokens are CSS custom properties on `:root`. Translucent values sit over `--bg`; §2.4 covers contrast.

### 2.1 Base
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0b0b` | Page and canvas background. Near-black. |
| `--text` | `#f4f0e8` | Primary text, chord names, chart ink, selected fills. Warm off-white. |
| `--muted` | `#a8a39a` | Secondary text, captions, unselected tabs, idle icons. |
| `--ink` | `#121110` | Text and icons on `--text` and `--go` fills. |
| `--go` | `#33a066` | Unused while the UI is black and white (was Play and switch "on"). |

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
Selected and on states **invert**: `--text` fill, `--ink` content. It reads at any distance and needs no colour. Used by: selected picker options and keys, the Re-roll button (always), the selected song map block, on switches and lit count-in beats. Secondary text inside a selected option uses `--ink` at 70% (6.65:1).

### 2.4 Contrast
Everything now sits over `--bg` (`#0b0b0b`), so the over-`--bg` figures apply: `--text` 16.55:1 and `--muted` 7.50:1 on the panel glass.
- **Song map blocks:** `--text` on `--track-card` over `--bg` is well above 4.5:1; `--ink` on the white selected block is 16:1.
- **Off switch:** `--switch-off` alone is 1.73:1 against `--glass-strong`, under the 3:1 needed for controls. **Fix (NEW, approved):** a 1 px `--muted` inset border on the off track (7.39:1).

### 2.5 Visual palettes
Removed with the visuals (SPEC A24).

---

## 3. The visuals
Removed (SPEC A24). The particle waves, the 2D styles and their palettes are in git history and in DECISIONS.md for the portfolio write-up. Kept as a heading so section numbers stay stable.

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
| `--t-chip` | 15 px | 500 / 400 | The vibe row (name 500, key and tempo 400), the Settings button |
| `--t-button` | 16 px | 500 | Re-roll label (uppercase, tracking +0.08em) |
| `--t-body` | 17 px | 400 / 500 | Mode tabs, picker options, key buttons, body text |
| `--t-step` | 24 px | 400 | Tempo − / + glyphs |
| `--t-chord` | 34 px phone · 30 px desktop | 500 | Chord name on a card (tracking −0.02em, line height 1) |
| `--t-readout` | 48 px | 500 | Tempo readout |

Chord names are smaller on desktop because the chart beside them is larger there. Text never scales with the viewport and honours browser zoom.

### 4.3 Chord symbols
- **Plain text**, all at one size and on one baseline: "Cmaj7", "F♯m7", "B♭sus4". No superscripts (changed from the raised-quality lead-sheet style for legibility at a glance).
- The accessible name is spoken text ("B flat major 7"), from `src/theory/`.

---

## 5. Layout, spacing and shape

### 5.1 Breakpoint
One breakpoint, **900 px** wide:
- **Phone (< 900):** panel with two rows (actions above, vibe below).
- **Desktop (≥ 900):** panel in one row, max 760 px wide, centred (vibe left, actions right). Sheets 420 px wide.
- **The chart scales with the screen's height** so the song map always fits under it: its height is `clamp(120px, 100dvh − 515px, 260px)` (**NEW**).

### 5.2 Spacing
| Token | Value | Use |
|---|---|---|
| `--gap` | 6 px | Between buttons and chips in a row; between picker options |
| `--s-8` | 8 px | Between the two panel rows; icon-to-label gap |
| `--s-10` | 10 px | Panel padding (phone); gap between panel and picker |
| `--s-12` | 12 px | Screen gutters; panel padding (desktop); card inner gap |
| `--s-14` | 14 px | Chip side padding; chart card padding; gap under the chart |
| `--s-16` | 16 px | Picker padding; option side padding; card top and bottom padding |
| `--s-24` | 24 px | Space above the song map; its side margins |

Fine adjustments, used only where listed: **2 px** (option description top margin; HELD tag vertical padding), **4 px** (switch row right padding; credit and note side margins), **18 px** (space above a picker's second section, e.g. LENGTH), **−8 px** (the Sound view's back control pulls into the picker padding so its chevron aligns with the rows).

Safe areas: the top bar and panel respect `env(safe-area-inset-*)`, with a 12 px minimum at the bottom.

### 5.3 Targets
| Token | Value | Applies to |
|---|---|---|
| `--target-primary` | **56 × 56 px** | Play, Back, Click, Re-roll height, tempo ± |
| `--target-min` | **48 px** tall | Chips, the mode menu button, My progressions, picker options (56), key buttons (52), switch rows (56). |
| `--target-hero` **NEW** | **72 × 72 px** | Re-roll only: the largest control. |

Targets are at least 6 px apart.

### 5.4 Radii
| Token | Value | Use |
|---|---|---|
| `--r-pill` | 999 px | Buttons, chips, pills, switches, count-in dots |
| `--r-panel` | 28 px | The floating panel |
| `--r-picker` | 24 px | Pickers |
| `--r-card` | 22 px | Chord cards |
| `--r-option` | 16 px | Picker options, switch rows, Tap tempo |
| `--r-key` | 14 px | Key buttons, song map blocks |

Everything is soft and round: it reads as an instrument, not a form.

---

## 6. Components

Black and white for now: no accent colour until the hi-fi designs (SPEC A22).

1. **Top bar:** **mode menu** on the left: "Jam" or "Solo" in `--t-body` 500 with a down chevron, a 48 px pill with no fill until hover (`--hover`) or open (`--fill-open`). It drops down a sheet with the two modes as picker options. **My progressions** on the right: `--t-small` 500 text button, 48 px tall (disabled until saving ships). *(Solo isn't designed yet: SPEC A13.)*
2. **Chord view:** the selected chord. **Only the chart is boxed:** a chart card (`--r-card`, `--card-now`, 1 px `--edge-now`, 14 px padding) holding the chord chart, scaled to the screen's height (§5.1). The name sits below it (14 px gap) in `--t-chord` 500, plain (§4.3). The whole thing is one button that plays the chord; hover lightens the chart card to `--hover`.
3. **Song map:** under the chord view, 24 px below it, up to 560 px wide with 24 px side margins; 16 px between sections.
   - **Section head:** "Verse" / "Chorus" in `--t-small` 500 on the left (`--muted`; `--text` for the current section), "×2" (or "1/2", "2/2", tabular figures) in `--t-fine` `--muted` on the right, 8 px above the row.
   - **Row:** four equal columns, 6 px (`--gap`) apart. Fewer chords leave the rest of the row empty.
   - **Block:** a button, min 56 px tall, `--r-key`, `--track-card` fill, `--text` name in `--t-chip` 500 (ellipsis if it can't fit), 10 × 6 px padding, beat dots 8 px below the name. Hover: `--fill-open` with a 1 px `--chart-line` inset edge. Pressed: the usual 0.97 scale.
   - **Selected block:** `--text` fill, `--ink` name and dots (hover `--text-hover`). It's also `aria-current`, so it's never colour alone.
   - **Beat dots (NEW):** 4 px `currentColor` circles at 35% opacity, four per bar, 3 px apart; bars 6 px apart. While playing, the current beat's dot is full opacity and 1.75× the size, set each frame from the audio clock (never a CSS animation).
   - **Count-in:** while it plays, "Count-in" (`--t-caption` 500, uppercase, `--text`) with four 6 px dots filling one per beat appears just above the song map, positioned so nothing moves.
4. **Chord chart:** see §7.
5. **Panel:** `--glass`, 1 px `--line`, `--r-panel`, the padding from §5.2. It's the only fixed UI at the bottom.
6. **Action row:** five circles spread across the row: **Settings** (sliders), **Save** (heart; filled when saved), **Re-roll** (72 px hero, two arrows, inverted: `--text` fill, `--ink` icon at 28 px), **Play / Pause** and **Mute** (speaker; when on, inverted with a crossed-out speaker). The others are 56 px, `--fill-2`, `--muted` icon; Settings open: `--fill-open`, `--text`. Every button has an accessible name.
7. **Vibe row:** a full-width 48 px pill, `--fill-2`: the vibe name in `--t-chip` 500 on the left, the current key and tempo in `--t-chip` 400 `--muted` on the right ("D major · 84 BPM", truncating with an ellipsis), then a chevron. It opens the vibe sheet. On desktop it sits left of the action row in one line.
8. **Sheet:** `--glass-strong`, 1 px `--line`, `--r-picker`, 16 px padding, max height 60% of the viewport (scrolls). Title in `--t-caption` uppercase `--muted`.
9. **Picker option:** min 56 px tall, `--fill-1`, `--r-option`, name in `--t-body` and a description in `--t-caption` `--muted`. Selected: inverted.
10. **Key grid:** Major/Minor in two columns, then 12 keys in six columns, 52 px tall, `--r-key`, `--fill-1`. Selected: inverted.
11. **Switch row:** min 56 px, `--fill-1`, `--r-option`; label in `--t-body` with a hint in `--t-caption` `--muted`; a 46 × 28 switch. On: `--text` track with an `--ink` knob slid 18 px right (black and white; was `--go`). Off: `--switch-off` track with a 1 px `--muted` inset border (§2.4).
12. **Settings sheets:** the main sheet lists three **nav rows** (like a switch row, with the label, its current value as the hint and a `--muted` right chevron), 6 px apart: Key, Tempo, Instruments. Each opens its own sheet in place: a 48 px **back control** (left chevron + its name in `--t-body` 500, no fill until hover) instead of a title, then its controls. No slide animation between sheets.
13. **Tempo control:** − and + as 56 px pills either side of the `--t-readout` number, "BPM" under it; slider (44 px tall, `accent-color: --text`); Tap tempo (52 px, `--r-option`); the vibe's range in `--t-caption` `--muted`; then Hold tempo, Metronome and Count-in switch rows.
14. **Loading pill:** top centre, `--glass`, `--r-pill`, `--t-caption` `--muted`, `role="status"`. Fades out when done. It also explains disabled controls when they're tapped.
15. **Credit line:** `--t-fine` `--muted` with underlined links, in Settings → Instruments.

### 6.1 Icons
Inline SVG, 24 px grid drawn at 22 px, 1.75 px stroke, round caps and joins, `currentColor`. Set: play, pause, speaker and speaker-off (mute), re-roll (two arrows), heart (save; outlined, filled when saved), chevron (down, left, right), sliders (Settings). The action row is icon-only; every button has an accessible name.

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
| State | Panel | Chord view and song map |
|---|---|---|
| **Locked-audio** | Looks like Stopped. Play's name: "Play (turns on sound)". | First chord selected. |
| **Stopped** | Play icon. | Selected chord (the first, or the one tapped) white; "×2" on both sections. |
| **Count-in** (if on) | Pause icon. | Selected chord; "Count-in" with four dots filling one per beat just above the song map. |
| **Playing** | Pause icon. | Playing chord white, its current beat's dot grown; "1/2" / "2/2" on the current section. |
| **Paused** | Play icon. | The chord that was playing stays selected; no beat dot. |

### 8.3 Loading and errors
- **Instruments:** the loading pill (§6.15). The synth plays meanwhile, so there is no blocking spinner.
- **Audio blocked:** an inline message above the panel in `--glass`, with a "Try again" action (design pending).
- **Toasts** (Undo, "Playback paused"): `--glass`, `--r-pill`, `--t-caption` `--text`, above the panel, 8 s (design pending).

---

## 9. Motion

### 9.1 Tokens
| Token | Value | Use |
|---|---|---|
| `--dur-carousel` | 620 ms, `cubic-bezier(0.32, 0.72, 0, 1)` | Unused since the carousel went (kept for the hi-fi pass) |
| `--dur-fade` | 500 ms ease | Unused for now |
| `--dur-loading` | 400 ms ease | Loading pill fade |
| `--dur-bar` | 300 ms ease | Unused for now |
| `--dur-pop` | 220 ms, `cubic-bezier(0.2, 0, 0, 1)` | Picker entering (fade + 8 px rise) |
| `--dur-switch` | 200 ms, `cubic-bezier(0.2, 0, 0, 1)` | Switch knob; song map block and chart card fills |

### 9.2 Rules
- **The chord view and song map change on the chord change,** never before it, with no slide: the chart swaps in place.
- **The beat dots are never animated by CSS;** they're set each frame from the audio clock, minus output latency, so they never lead the sound.

### 9.3 Reduced motion (`prefers-reduced-motion: reduce`)
| Normal | Reduced |
|---|---|
| Song map and chart fills fade (200 ms) | Change instantly |
| Picker rises | Appears without animation |
| Pressed scale | Fill change only |

The beat dots keep stepping: they show position, not decoration.

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
- [ ] Text ≥ 4.5:1 (body) / 3:1 (large) (§2.4).
- [ ] Control boundaries and meaningful icons ≥ 3:1. Fix the off-switch track (§2.4).
- [ ] Every interactive element has hover, focus-visible, pressed and disabled styles (§8.1).
- [ ] Every disabled control has a visible reason.
- [ ] Targets ≥ 48 px (56 px primary), ≥ 6 px apart.
- [ ] No flashing; reduced motion honoured (§9.3).
- [ ] Layout holds at 200% text zoom and at 320 px width with no horizontal page scroll.
- [ ] Nothing depends on colour alone.

---

## 12. Open design items
| Item | Notes |
|---|---|
| Solo layout and fretboard | Next design task (SPEC A13). |
| Own accidentals | Replace the thin Noto ♭/♯ (§4.1). |
| Toasts, blocked-audio message | Visual design pending (§8.3). |
| Wordmark | No product name yet. Until there is one, the top bar shows only the mode tabs. |
