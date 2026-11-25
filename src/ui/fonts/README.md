# Fonts

All four are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org) and self-hosted as WOFF2 Latin subsets downloaded from Google Fonts.

| File | Family | Notes |
|---|---|---|
| `fraunces.woff2` | Fraunces | Variable: `opsz` 9–144, `wght` 500–600; `SOFT` fixed at 50 |
| `atkinson-hyperlegible-next.woff2` | Atkinson Hyperlegible Next | Variable `wght` |
| `atkinson-hyperlegible-mono.woff2` | Atkinson Hyperlegible Mono | Variable `wght` |
| `noto-music-accidentals.woff2` | Noto Music | Only ♭ ♮ ♯ (U+266D–266F). None of the three families above has these glyphs (checked with fontTools), so this subset fills them in via `unicode-range` (DESIGN.md §4.1). |
