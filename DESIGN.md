# DESIGN.md: Visual system, "Late Set"

> Status: **v1 draft, for review.** Dark only. Every value here is a token. Code must not use a colour, font, size, radius, duration or spacing value that isn't listed here (CLAUDE.md).
> Contrast ratios were measured with the WCAG 2.x formula against the surfaces named. Behaviour lives in `SPEC.md`.

---

## 1. Direction

**Late Set** feels like a small club at 11pm: a warm near-black room, tungsten light, a lit music stand. Chord names are set like a lead sheet, large and serif and confident. Everything else stays quiet so the music reads first.

It borrows one idea from a pedalboard: **primary controls are big, solid and plainly labelled**, sitting in the bottom thumb zone like footswitches.

**Why it fits the problem**
- **Dim rooms:** the warm, low-blue palette is comfortable for eyes adjusted to the dark and doesn't flood a dark room with cold light. Text is warm off-white, never pure white, to avoid glare.
- **Arm's length:** a large type scale, generous targets (48 px minimum, 64 px primary) and one accent colour that always means *now*.
- **The music:** warm, analogue and unhurried, like the references (D'Angelo, Leon Bridges, Khruangbin, Norah Jones).

**Mood in words:** mid-century jazz record sleeves · a clip-on lamp on a music stand · valve amp glow · handwritten lead sheets · rosewood fretboard under stage light.

**Avoid:** gradients used as decoration (the one exception is the playing "spotlight", §8) · glassmorphism · card grids of equal tiles · pure black or pure white · cool greys · more than one accent competing for attention · drop shadows used for decoration.

---

## 2. Colour tokens

All tokens are CSS custom properties on `:root`. Hex values are canonical; OKLCH is given for reasoning about lightness and hue.

### 2.1 Surfaces and lines
| Token | Hex | OKLCH | Use |
|---|---|---|---|
| `--bg` | `#120E0B` | oklch(16.8% 0.009 59) | Page background. Warm near-black. |
| `--surface-1` | `#1B1511` | oklch(20.2% 0.013 56) | Bars (top bar, transport), vibe rail |
| `--surface-2` | `#241C17` | oklch(23.4% 0.016 54) | Chord cards, chips, buttons (secondary) |
| `--surface-3` | `#2F251E` | oklch(27.4% 0.020 57) | Sheets, popovers, text inputs |
| `--surface-locked` | `#2B1A16` | oklch(23.9% 0.028 34) | Locked chord card (an oxblood tint) |
| `--surface-accent` | `#3A2A17` | oklch(29.9% 0.039 70) | Selected chip or sleeve background, spotlight core |
| `--surface-error` | `#2E1714` | oklch(23.6% 0.038 28) | Error banner, invalid input background |
| `--border-subtle` | `#3A2F27` | oklch(31.5% 0.021 58) | Dividers, decorative edges. Never the only boundary of a control. |
| `--border-strong` | `#8A7765` | oklch(58.2% 0.036 65) | Control boundaries (inputs, secondary buttons, toggles). ≥ 3.49:1 on every surface (WCAG 1.4.11). |

Elevation comes from **lighter surfaces**, not shadows. The one shadow token, `--shadow-sheet` = `0 -8px 32px rgb(0 0 0 / 0.55)`, is for bottom sheets only.

### 2.2 Text
| Token | Hex | OKLCH | On `--bg` | On `--surface-2` | On `--surface-3` | Use |
|---|---|---|---|---|---|---|
| `--text` | `#F1E7DA` | oklch(93.2% 0.020 75) | 15.72 | 13.71 | 12.24 | Primary text, chord names |
| `--text-muted` | `#B3A391` | oklch(72.4% 0.032 71) | 7.83 | 6.83 | 6.10 | Secondary text, captions, reference artists |
| `--text-faint` | `#7E6F61` | oklch(55.2% 0.028 65) | 3.96 | 3.46 | 3.09 | **Disabled only** (exempt from WCAG 1.4.3). Never for information. |

### 2.3 Accent and semantic
| Token | Hex | OKLCH | Contrast | Use |
|---|---|---|---|---|
| `--accent` | `#E9A54A` | oklch(77.1% 0.133 71) | 9.10 on bg · 7.93 on surface-2 | Tungsten amber. **Means "live / now / primary".** Primary buttons, the playing chord, selected states, the fretboard root. |
| `--accent-hover` | `#F2B862` | oklch(81.9% 0.123 75) | 10.80 on bg | Hover on accent fills |
| `--accent-pressed` | `#C9883A` | oklch(67.8% 0.122 68) | 6.46 on bg | Active / pressed on accent fills |
| `--on-accent` | `#1A1009` | oklch(18.4% 0.022 56) | 8.86 on accent · 6.30 on pressed | Text and icons on accent fills |
| `--oxblood` | `#8E3B37` | oklch(46.4% 0.114 25) | 2.59 on bg | **Decorative only:** the lock glyph's fill tint, the outer ring of the spotlight. Never text, never the only signal. |
| `--error` | `#EE8A7A` | oklch(73.7% 0.125 30) | 7.82 on bg · 6.85 on surface-error | Error text, icons, the invalid-input border |
| `--success` | `#A9C48F` | oklch(78.7% 0.078 130) | 10.04 on bg | Confirmation ticks (e.g. "Key set") |
| `--focus` | `#F1E7DA` | oklch(93.2% 0.020 75) | 15.72 on bg | Focus ring (§7.2). Off-white so it never looks like "selected" (amber). |

### 2.4 Fretboard
| Token | Hex | OKLCH | Use |
|---|---|---|---|
| `--fret-wood` | `#1E1611` | oklch(20.8% 0.016 54) | Fingerboard |
| `--fret-wire` | `#6B5A4C` | oklch(48.0% 0.031 61) | Frets (2.71:1 on wood; decorative structure) |
| `--fret-nut` | `#B3A391` | oklch(72.4% 0.032 71) | The nut (a thicker line, so position 0 is obvious) |
| `--fret-string` | `#9C8B7B` | oklch(64.7% 0.031 66) | Strings, 1–2.5 px from high E to low E |
| `--fret-inlay` | `#3A2F27` | oklch(31.5% 0.021 58) | Position dots (quiet; markers sit above them) |

---

## 3. Fretboard roles

**Rule: each role is identifiable in greyscale.** Shape + fill style + label carry the meaning, and colour reinforces it. Contrast is measured against `--fret-wood`.

| Role | Shape | Fill / stroke | Colour token | Label colour | Contrast | Legend text |
|---|---|---|---|---|---|---|
| **Root** | Rounded **square** (radius 6px) | Solid fill | `--role-root` = `#E9A54A` | `--on-accent` (8.86:1) | 8.44 | "Root" |
| **Chord tone** | **Circle** | Solid fill | `--role-chord` = `#F1E7DA` | `--on-accent` (15.31:1) | 14.59 | "Chord tone" |
| **Scale tone** | **Circle** | 2 px **ring**, no fill | `--role-scale` = `#B3A391` | `--text-muted` | 7.27 | "Scale" |
| **Avoid** | **Circle** | 2 px **dashed** ring + small diagonal slash through the top-right | `--role-avoid` = `#E0705F` | `--role-avoid` | 5.65 | "Avoid" |
| **Landing** | **Diamond** (square rotated 45°) | 2 px ring; fills solid in the final beat before the change | `--role-landing` = `#8DC0A9` | `--on-accent` when filled (9.13:1) | 8.70 | "Land on" |
| **Approach** | **Triangle**, point up | 2 px ring, no fill; marker 24 px (smaller than the others, because it's secondary) | `--role-landing` = `#8DC0A9` | `--role-landing` | 8.70 | "Approach" |

- **Landing is the only cool hue in the system, on purpose.** "Where to go next" should pull the eye forward and stand apart from everything warm.
- **Approach shares the landing hue** because it belongs to the same idea: a note on its way to a landing note. Shape (hollow triangle vs diamond) and size (24 vs 32 px) tell the two apart, so no new colour token is needed. The triangle has no direction: one note can approach a target above and another below.
- **Combined roles:** a chord tone that is also a landing note keeps its circle and gains a **landing badge**, an 8 px sage diamond at the top-right. The root is always the square, whatever else it is.
- **Marker size:** 32 px on phones (vertical neck), 28 px on desktop. Each marker's tap target is the whole string × fret cell (≥ 48 × 48 px on phones).
- **Labels** inside markers use `--font-mono` at `--text-caption` size, weight 600. If the label is longer than 2 characters (e.g. "♭13"), the marker grows to a pill shape. It never shrinks the text.
- **Legend:** always visible under the fretboard as one row of the shapes currently in use, with their names (up to six). It isn't hidden in a tooltip.
- **Avoid colour vs error colour:** both are coral. They never appear on the same component, and avoid notes always carry the dashed ring and slash.

---

## 4. Typography

### 4.1 Families
| Token | Family | Role | Why |
|---|---|---|---|
| `--font-display` | **Fraunces** (variable; `opsz` 9–144, `SOFT` 50, `WONK` 0) | Chord names, headings, vibe names | A warm, high-contrast "old style soft" serif that reads like a lead sheet or record sleeve. The optical-size axis keeps it sharp at 60 px and sturdy at 24 px. |
| `--font-ui` | **Atkinson Hyperlegible Next** | Interface text, labels, body | Designed for legibility at a distance and in low vision. Its characters are clearly distinct (I/l/1, 0/O), which matters at arm's length. A humanist warmth that sits well with Fraunces. |
| `--font-mono` | **Atkinson Hyperlegible Mono** | BPM, bar counters, fretboard labels, intervals | Tabular figures, so tempo and counts don't jitter as they change. Same family DNA as the UI face. |

- **Licence:** all three are SIL OFL. Self-host WOFF2 subsets (Latin + the music symbols below) with `font-display: swap`. (Self-hosting confirmed, SPEC A10.)
- **Fallbacks:** `Fraunces, "Iowan Old Style", Georgia, serif` · `"Atkinson Hyperlegible Next", system-ui, sans-serif` · `"Atkinson Hyperlegible Mono", ui-monospace, monospace`.
- **Accidentals (♭ U+266D, ♮ U+266E, ♯ U+266F):** during the build, check that each family has these glyphs. If one doesn't, add a `@font-face` of **Noto Music** restricted with `unicode-range: U+266D-266F` ahead of the fallback. Never show `b` / `#` in display text.

### 4.2 Scale
Base size is **17 px** on phones (larger than the usual 16 for arm's length). Sizes are in rem, assuming a 16 px root. Never set a size below `--text-caption`.

| Token | Size | Line height | Family / weight | Use |
|---|---|---|---|---|
| `--text-caption` | 13 px / 0.8125rem | 1.35 | UI 600, **UPPERCASE, tracking +0.08em** | Silk-screen labels ("LOCKED", "BPM", legend) |
| `--text-small` | 15 px / 0.9375rem | 1.4 | UI 400 | Helper text, reference artists, toasts |
| `--text-body` | 17 px / 1.0625rem | 1.5 | UI 400 / 600 for emphasis | Default body, sheet content, buttons |
| `--text-body-lg` | 20 px / 1.25rem | 1.4 | UI 600 | Primary button labels (RE-ROLL), important prompts |
| `--text-title` | 24 px / 1.5rem | 1.25 | Display 600, opsz auto | Sheet titles, vibe names |
| `--text-headline` | 30 px / 1.875rem | 1.2 | Display 500 | Empty-state headline, count-in numerals (phone) |
| `--text-chord-sm` | 32 px / 2rem | 1.0 | Display 600 | Solo strip chips |
| `--text-chord-md` | 44 px / 2.75rem | 1.0 | Display 600 | Jam cards (phone) |
| `--text-chord-lg` | 60 px / 3.75rem | 1.0 | Display 600 | Jam cards (desktop), count-in numerals (desktop) |
| `--text-numeric` | 28 px / 1.75rem | 1.0 | Mono 600, tabular | BPM readout in chips and the tempo sheet header |
| `--text-numeric-xl` | 60 px / 3.75rem | 1.0 | Mono 500, tabular | Tempo sheet main readout |

From the expanded breakpoint (§5.3) up, `--text-body` stays at 17 px. Only the chord sizes step up. Text never scales with viewport units, and it honours the user's browser zoom and text size.

### 4.3 Chord symbol typesetting
Chord symbols are set like a lead sheet, not as plain strings:
- **Root letter:** full chord size.
- **Accidental on the root:** 70% size, raised 0.30em, tight to the letter.
- **Quality and extensions** (`maj7`, `m9`, `7♯9`): 55% size, raised 0.38em, `--font-display` weight 500. **Exception:** a bare minor `m` sits on the baseline at 70% size, because it's read as part of the name ("Em").
- **Slash bass:** "/" at 70% on the baseline, then the bass note at 70%.
- **Accessible name** is spoken text ("E minor 9", "B flat major 7 over D"), generated by `src/theory/`. Assistive tech never reads the visual glyph string.

---

## 5. Spacing and layout

### 5.1 Spacing scale (8 px base)
| Token | Value | Typical use |
|---|---|---|
| `--space-0` | 0 | — |
| `--space-half` | 4 px | Icon-to-label gap, accidental kerning, badge offsets |
| `--space-1` | 8 px | **Minimum gap between adjacent tap targets**, chip padding (vertical) |
| `--space-2` | 16 px | Page gutter on phones, chip padding (horizontal), card padding |
| `--space-3` | 24 px | Gap between groups, card padding on desktop |
| `--space-4` | 32 px | Section separation, sheet padding (desktop) |
| `--space-5` | 40 px | — |
| `--space-6` | 48 px | Large separations, empty-state padding |
| `--space-8` | 64 px | Desktop gutters |
| `--space-10` | 80 px | Desktop top and bottom breathing room |

### 5.2 Tap targets
| Token | Value | Applies to |
|---|---|---|
| `--target-min` | **48 × 48 px** | Every interactive element, including lock toggles, chips, fretboard cells and sheet handles. Above WCAG 2.5.8 (24 px) and Apple HIG (44 pt), because the app is used at arm's length with a guitar on. |
| `--target-primary` | **64 px** tall | Play/Pause (64 × 64), RE-ROLL (64 tall, fills the space left in the transport row) |
| Spacing | ≥ `--space-1` | Between any two targets. Targets may visually touch only inside a segmented control, whose segments are still ≥ 48 px. |

### 5.3 Breakpoints and grid
| Name | Width | Layout |
|---|---|---|
| `compact` | < 600 px | One column, 16 px gutters, transport fixed to the bottom (plus `env(safe-area-inset-bottom)`). Vertical fretboard in portrait. |
| `short` (modifier) | height < 500 px | Context row folds into the top bar; horizontal fretboard. |
| `medium` | 600–1023 px | One column, 24 px gutters, horizontal fretboard, Jam cards 4 per row. |
| `expanded` | ≥ 1024 px | Content max-width 1200 px, 64 px gutters. Jam: vibe list (280 px) + progression. Solo: fretboard full width above; strip + scale panel below. |

Phone layout heights: top bar 56 px · context row 56 px · transport 88 px (64 px controls + 12 px vertical padding) + safe area.

### 5.4 Radii
| Token | Value | Use |
|---|---|---|
| `--radius-s` | 4 px | Badges, tooltip |
| `--radius-m` | 8 px | Buttons, inputs, chips |
| `--radius-l` | 12 px | Chord cards, vibe sleeves, sheets (top corners only) |
| `--radius-full` | 999 px | Play button, fretboard circles, pills |

Cards are only slightly rounded, closer to paper than to app tiles.

---

## 6. Iconography
- One inline SVG set made for the app (no icon-library dependency). 24 px grid, **1.75 px stroke**, round caps and joins, `currentColor`.
- v1 icons: play, pause, restart, re-roll (two curved arrows), back (history), lock-closed, lock-open, plus, settings, close, check, alert, chevron, drag handle, more (⋯), list, metronome.
- Icons never appear alone on a primary action without a label, except Play/Pause, whose shape is universal and whose accessible name is set. Lock toggles show the icon, and in the locked state also the "LOCKED" caption.

---

## 7. Interaction states

### 7.1 State matrix
| State | Secondary button / chip / card | Primary (accent) button | Notes |
|---|---|---|---|
| **Default** | `--surface-2` fill, 1 px `--border-strong`, `--text` | `--accent` fill, `--on-accent` label | |
| **Hover** (pointer only, via `@media (hover: hover)`) | Fill → `--surface-3` | Fill → `--accent-hover` | No hover effects on touch. |
| **Focus-visible** | Focus ring (§7.2) | Focus ring | Keyboard and switch access only (`:focus-visible`). |
| **Active / pressed** | Fill → `--surface-accent`, content shifts down 1 px | Fill → `--accent-pressed`, shifts down 1 px | Feels like a footswitch going down. The 1 px shift is removed under reduced motion; the colour change stays. |
| **Selected / on** | `--surface-accent` fill, 2 px `--accent` left or bottom edge, **plus a check or "on" glyph** | — | Selection is never shown by colour alone. |
| **Disabled** | `--surface-1` fill, `--border-subtle`, `--text-faint` label, `cursor: not-allowed` | Same as the secondary disabled style (it loses the accent) | **Always paired with a visible reason** nearby ("Add a chord to play", "All locked"). |
| **Locked** (Jam card) | `--surface-locked` fill, 2 px `--border-strong`, closed-padlock icon, "LOCKED" caption | — | Three cues: surface, icon, text. |

### 7.2 Focus ring
- `outline: 2px solid var(--focus); outline-offset: 2px;` The offset gap shows `--bg`, giving a two-tone ring that stands out on any surface (15.7:1 against the background).
- Fretboard cells use an inset ring (`outline-offset: -2px`) so the ring isn't clipped by the neck.
- Focus is never removed without a replacement.

### 7.3 Loading
Most actions are instant (the generator and theory functions are synchronous). Loading exists in two places only:
| Where | Treatment |
|---|---|
| **Fonts** | `font-display: swap`, with fallback metrics tuned via `size-adjust` to limit layout shift. No splash screen. |
| **Starting audio** (first tap, usually < 100 ms) | If the start takes more than 150 ms, the Play icon is replaced by a slowly breathing ring (opacity 0.4 ↔ 1, 1.2 s). Under reduced motion it's a static "…" glyph. The accessible label becomes "Starting sound". |

No skeleton screens: Jam renders with a progression already generated, and Solo has a designed empty state.

### 7.4 Empty
- **Solo, no chords:** the headline "What are we soloing over?" in `--text-headline` display, one line of helper text, and three stacked buttons (primary: **Add a chord**; secondary: **Type the whole progression**, **Bring the Jam progression over**). The fretboard behind is rendered at 40% opacity with the key-wide scale. The progression strip shows a single dashed-outline **+** slot.
- **Disabled Play:** reason text in `--text-small` `--text-muted`, directly above the transport.

### 7.5 Error
| Context | Treatment |
|---|---|
| **Invalid chord input** | Input border → 2 px `--error`; background → `--surface-error`; an alert icon at the field's end; message below in `--text-small` `--error`, starting with the icon. The field keeps its text. `aria-invalid="true"` plus `aria-describedby` pointing at the message. |
| **Invalid token in a typed progression** | Token gets a wavy `--error` underline (`text-decoration-style: wavy`) **and** sits in a chip with the alert icon in the preview. |
| **Audio blocked / failed** | Inline banner above the transport: `--surface-error` background, 1 px `--error` top edge, alert icon, message, and a "Try again" text button. Not a modal. |
| **Toasts** (Undo, info) | `--surface-3`, `--text`, 1 px `--border-subtle`, bottom-anchored above the transport, 8 s, with an inline action. Toasts never cover the transport. |

---

## 8. Playback states

| State | Transport | Progression | Other |
|---|---|---|---|
| **Locked-audio** (before first tap) | Looks identical to Stopped. Play's accessible label is "Play (turns on sound)". | — | No warning UI unless unlocking fails (§7.5). |
| **Stopped** | Play icon on `--accent` fill. | No spotlight. The selected chord (if any) has the Selected style. | |
| **Count-in** | Play button shows a **4-segment ring** around its edge that fills one quarter per beat; the icon becomes a pause glyph (tap to cancel). | Over the first chord, large **display numerals 1 → 4** (`--text-headline` on phone, `--text-chord-lg` on desktop) in `--accent`, one per beat, **plus 4 beat pips** that fill. | The ring and pips are always shown, so the count-in also reads without sound. |
| **Playing** | Pause icon on `--accent` fill. A small LED-style dot (8 px, `--accent`) appears on the active mode segment. | **Spotlight:** the current chord card or chip gets `--surface-accent` with a soft radial glow (`radial-gradient` from `--accent` at 14% alpha in the centre, to `--oxblood` at 0% at the edge), a 2 px `--accent` bottom edge, and **4 beat pips** under the chord showing the beat within the bar. Solo strip: a 2 px `--accent` playhead line moves through the chip. | Wake lock on. |
| **Paused** | Play icon on `--accent` fill. | Spotlight stays on the paused chord at **50% strength**, with the caption "PAUSED" in place of the beat pips. | Shows where Play will resume. |

**Seizure safety (WCAG 2.3.1):** beat pips change at most 4 times a second (240 BPM). They're small (≤ 8 px each), change between two adjacent lightness levels (`--fret-inlay` → `--accent`) and never flash the full screen. The spotlight moves per **chord**, never per beat.

---

## 9. Components (core set)

1. **Mode switch:** a segmented control with two segments, each ≥ 48 px tall and ≥ 96 px wide. Labels in `--text-body` UI 600. Selected = `--surface-accent` + `--text`; unselected = transparent + `--text-muted`. Includes the playing LED dot.
2. **Context chip** (Key / Vibe / Tempo): 48 px tall, `--surface-2`, a `--text-caption` label above the value ("KEY" / "D major"). The tempo value uses `--font-mono`.
3. **Chord card (Jam):** `--surface-2`, `--radius-l`, 16 px padding. The chord in `--text-chord-md`. Bar count (if ≠ 1) as a mono caption top-left ("2 BARS"). Lock toggle in its own 48 × 48 target, top-right. The whole card (outside the lock) opens the Chord sheet.
4. **Chord chip (Solo strip):** 64 px tall, min-width 72 px. Width reflects duration (1 bar = 96 px, ½ = 72 px min, 2 bars = 168 px, 4 bars = 312 px), so the strip reads like a timeline.
5. **Stomp button (RE-ROLL):** 64 px tall, `--accent` fill, re-roll icon + "RE-ROLL" in `--text-body-lg` UI 700, tracked +0.04em. The only full-accent element besides Play.
6. **Vibe sleeve:** 200 × 120 px (phone, in the rail), `--surface-2`, `--radius-l`. Vibe name in `--text-title` display, descriptor in `--text-small`, artists in `--text-small` `--text-muted`. Selected: `--surface-accent`, a 3 px `--accent` left edge, a check icon. Not a grid: one rail, and the sleeves differ only in content.
7. **Bottom sheet:** `--surface-3`, top radius `--radius-l`, a 4 × 32 px grab handle inside a 48 px drag zone, `--shadow-sheet`, max height 85% of the viewport. Backdrop: `--bg` at 60% alpha. Title in `--text-title`.
8. **Stepper (tempo ±):** two 64 × 64 secondary buttons either side of the `--text-numeric-xl` readout.
9. **Toggle (layers, sound parts):** a switch 52 × 32 inside a 48 px-tall row. On = `--accent` track + `--on-accent` knob + "ON" caption; off = `--surface-1` track with `--border-strong` + `--text-muted` knob. The row label is always visible.
10. **Text input:** 56 px tall, `--surface-3`, 1 px `--border-strong`, `--text-body`, placeholder in `--text-muted` (6.1:1, so it stays readable).

---

## 10. Motion

### 10.1 Tokens
| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 0 ms | Reduced-motion replacement |
| `--dur-fast` | 120 ms | Press feedback, toggles, spotlight hand-off between chords |
| `--dur-base` | 200 ms | Hover, selection, chips, toasts |
| `--dur-slow` | 320 ms | Sheets entering and leaving |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Leaving the screen |

### 10.2 Signature moments
- **Re-roll ("deal"):** unlocked cards fade out (`--dur-fast`), then the new chords fade in with a 4 px rise, staggered 40 ms left to right. Locked cards don't move at all, which makes the lock visibly "hold".
- **Spotlight hand-off:** the glow cross-fades from one chord to the next over `--dur-fast`, starting **on** the downbeat (never before it, so the visual never runs ahead of the sound).
- **Landing notes:** the diamond rings appear with a 120 ms fade during the last beat and fill solid on the change. Approach triangles fade in and out with them and never fill.
- **Sheet:** slides up 24 px + fade over `--dur-slow`.

### 10.3 Reduced motion (`prefers-reduced-motion: reduce`)
| Normal | Reduced |
|---|---|
| Deal stagger and rise | All chords swap instantly. A one-line caption "New progression" shows for 1.5 s. |
| Spotlight cross-fade | Spotlight jumps on the downbeat. |
| Sheet slide | Fade only, `--dur-fast`. |
| Press shift (1 px) | Colour change only. |
| Breathing loading ring | Static "…" |
| Strip auto-scroll (smooth) | Jumps (`scroll-behavior: auto`). |

Beat pips and the count-in ring stay, because they convey timing information, but they **change state** without animated transitions.

### 10.4 Timing rule
Every visual tied to the beat is driven by the **audio clock** (scheduled times from the audio module), not by `setInterval` or animation frames alone. Visuals may lag the sound slightly but must never lead it.

---

## 11. Accessibility checklist (design side)
- [ ] All text ≥ 4.5:1 (body) / 3:1 (≥ 24 px or bold ≥ 18.66 px). Every pairing above meets AA; most meet AAA.
- [ ] Control boundaries and meaningful icons ≥ 3:1 (`--border-strong` ≥ 3.49:1 everywhere).
- [ ] Fretboard roles distinguishable in greyscale and under deuteranopia/protanopia/tritanopia simulation (check during the build).
- [ ] Every interactive element has hover (pointer), focus-visible, active and disabled styles from §7.1.
- [ ] Every disabled control has a visible reason.
- [ ] Targets ≥ 48 × 48 px with ≥ 8 px spacing.
- [ ] Layout holds at 200% text zoom and at 320 px width with no horizontal page scroll (the strip and vibe rail scroll horizontally on purpose).
- [ ] Reduced motion honoured as in §10.3.

---

## 12. Placeholder wordmark
No product name yet. Until there is one, the top bar shows nothing but the mode switch and settings. No placeholder logo. When a name exists, it is set in `--font-display` 600 at `--text-title` size, `--text`, with no other treatment.
