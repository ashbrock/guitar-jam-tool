# CLAUDE.md

## Project
A browser-based tool for guitarists with two modes:
- **Jam mode:** pick a key and vibe (neo-soul, ambient, bluesy, etc.), generate chord progressions quickly, re-roll them, or lock chords and re-roll the rest.
- **Solo mode:** enter a known progression and tempo, loop it, and use a fretboard view (scale options, chord tones, landing notes) to write lead or solo parts.

This is a portfolio piece. Design quality, polish and clear decisions matter as much as functionality.

## Source of truth
- `SPEC.md` defines product behaviour, screens and flows.
- `DESIGN.md` defines the visual system (tokens, type, spacing, states, motion).
- If the code and these documents disagree, stop and ask me. Don't silently pick one.
- Never invent colours, fonts or spacing values. Use the tokens in `DESIGN.md`.

## Stack and constraints
- Static site. No backend, no accounts, no database.
- In-browser audio only (Web Audio API or Tone.js).
- Don't add a dependency without asking first. Say why it's needed and what the lighter alternative is.
- No AI in v1. Keep the progression generator rule-based, with the vibe rules as plain data so a v2 can map free-text input onto the same parameters.

## Architecture
- Keep music logic separate from UI. Chord generation, theory helpers (keys, scales, chord tones) and fretboard mapping live in pure functions with no DOM or audio code.
- Keep audio playback behind one small module so timing fixes don't touch the UI.
- Vibe definitions (chord types, allowed movements, length) are data files, not hard-coded logic.
- Suggested layout: `src/theory/`, `src/audio/`, `src/ui/`, `src/data/vibes/`.

## Testing
- Write tests for all music logic: key and scale tables, chord tones, progression rules, fretboard note mapping.
- Run the tests before and after any change to `src/theory/` or `src/data/`.
- Audio timing is the likeliest thing to break. After any audio change, check that loops stay in time at slow and fast tempos.

## Design rules
- Mobile first, then scale up to desktop. Usable one-handed, in a dim room, at arm's length.
- Minimum tap target size and contrast ratios come from `DESIGN.md` (aim for WCAG AA at minimum).
- Never rely on colour alone to distinguish fretboard roles (root, chord tone, scale tone, avoid). Pair colour with shape, label or pattern.
- Every interactive element needs visible hover, focus, active and disabled states. Respect `prefers-reduced-motion`.
- Avoid generic SaaS styling: no default purple gradients, no cookie-cutter card grids.

## Working style
- Work in small steps. Finish and verify one feature before starting the next.
- Before building something new, briefly say what you plan to do and which files it touches. Ask me if the plan changes scope.
- If something is ambiguous, ask. Don't guess missing product or brand details.
- After each task, say what changed and anything I should check by hand (especially audio and touch interactions).
- Keep a running `DECISIONS.md`: one or two lines per significant design or technical decision, with the reason. I'll use it for the portfolio write-up.

## Out of scope for v1
Accounts, saving/sharing, recording, AI features, song libraries.
