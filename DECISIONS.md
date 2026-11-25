# DECISIONS.md

One or two lines per significant decision, with the reason. Newest at the bottom.

## Product
- **Vibes, not genres.** Genres are too broad to drive chord rules ("Rock" spans Pink Floyd and Hendrix). Harmonic feel is what changes a progression, and vibe parameters are a natural target for v2 free-text input.
- **Six vibes anchored to reference artists** (Neo-soul, Blues, Soul & Roots, Heartland, Dreamy, Desert Groove), drawn from the user's own listening, so the rules can be tuned against real music.
- **4/4 only, per-chord duration of ½ / 1 / 2 / 4 bars.** Covers almost all of the target repertoire without a time-signature UI.
- **Editing a Jam chord by hand auto-locks it.** If you chose it, a re-roll shouldn't throw it away. An Undo toast covers the rare opposite case.
- **Jam keeps a 20-roll history (⟲ Back).** During auditioning, "the one before was better" is the most common regret.
- **Progressions loop-close by rule.** The last chord is generated to lead back into the first, because every progression is heard on a loop.
- **Locks are stored relative to the key (Roman numerals).** Changing key transposes locked chords instead of breaking them.
- **Restore the current session from localStorage, but no saving.** A refresh or locked phone shouldn't wipe a typed progression. Saving and sharing stay out of scope.
- **Jam offers 4 / 8 bars, and Blues adds 12.** The 12-bar form is too central to blues to leave out. Lengths come from vibe data so the generator stays generic.
- **Screen wake lock while playing.** A practice tool whose screen sleeps mid-loop fails at its main job.

## Navigation
- **One workspace with a Jam | Solo switch (option A),** chosen over separate tabbed screens and a modeless tool. It keeps the brief's two-mode clarity, keeps the transport in one place, and avoids a two-item tab bar.
- **Each mode owns its own progression; "Solo over this" hands Jam's progression to Solo** without stopping playback. It turns two tools into one story: find it, then learn to play over it.
- **Switching modes otherwise stops playback.** Two progressions sharing one running loop would make it unclear what you're hearing.

## Visual
- **Direction "Late Set" (warm low-light club), with Pedalboard-style primary controls.** It fits the music and the dim-room context. Big, solid stomp-style buttons keep it usable one-handed.
- **Warm near-black, low-blue palette; off-white text, never pure white.** Comfortable in a dark room and less glare at arm's length.
- **One accent (tungsten amber) that only ever means "live / now / primary".** At arm's length, one meaning per colour is readable. A second competing accent isn't.
- **Landing notes are the only cool hue (sage).** "Where to go next" should pull the eye forward, apart from everything warm.
- **Fretboard roles use shape first: square root, solid circle chord tone, ring scale tone, dashed slashed ring avoid, diamond landing.** They're readable in greyscale and for colour-blind players. Colour only reinforces.
- **Vertical fretboard on phones held upright.** A horizontal 15-fret neck gives ~28 px per fret on a phone, below tap-target size. A vertical neck gives ~60 px string columns and matches chord-diagram orientation.
- **Fraunces + Atkinson Hyperlegible Next/Mono.** A lead-sheet serif for chord names gives the musical character. Atkinson was designed for legibility at a distance and in low vision.
- **48 px minimum targets, 64 px primary.** Above the WCAG and HIG minimums because users have a guitar on and hold the phone at arm's length.
- **Beat visuals driven by the audio clock and never allowed to lead the sound.** A visual that arrives early teaches players to rush.

- **Sheets are native `<dialog>` elements.** They give focus trapping, Esc to close, an inert background and focus returning to the trigger for free, with no library and fewer accessibility bugs.
- **Disabled controls explain themselves.** Re-roll shows "Unlock a chord to re-roll" whenever it's disabled. Back explains itself when tapped, because a permanent line for it would crowd the transport.
- **Vibe sleeves keep DESIGN's 200 × 120 size on phones, truncating text to one line.** Keeping the chords above the fold mattered more than full descriptors; desktop shows everything.
- **Count-in shows on the first card (numeral and pips) and around the Play button (ring).** The count is readable without sound and without looking away from the chords.

## Technical
- **Plain Web Audio, no Tone.js (confirmed).** Synth voices, click and simple drums don't justify a dependency.
- **UI in Preact + signals (confirmed).** Two small runtime dependencies (about 5 KB gzipped) for components plus fine-grained updates, so the 60 fps playhead doesn't re-render the page.
- **None of the three typefaces has ♭ or ♯ (checked with fontTools).** A 2.7 KB Noto Music subset fills just those characters through `unicode-range`, as DESIGN.md planned for.
- **Fonts self-hosted as WOFF2 (confirmed).** No third-party font requests and no package dependency. Works offline once cached.
- **Audio uses a look-ahead scheduler on the audio clock (150 ms ahead, timer every 25 ms).** Timers are imprecise; the audio clock isn't. Each beat's time is computed on a fixed grid, so tests show zero drift over 10 simulated minutes at 40 and 240 BPM.
- **The transport takes an injected clock, timer and output.** The timing logic is tested with a fake clock in milliseconds, and the Web Audio code stays a thin, dumb layer.
- **After a stall, skip missed notes instead of catching up.** A burst of late notes sounds worse than a dropped beat. Verified in Chromium with a 400 ms main-thread block.
- **The scheduler timer runs in a Web Worker.** Browsers throttle page timers in background tabs, which would starve the scheduler.
- **Edits to the playing chord wait for the next bar line.** A chord swapping mid-bar sounds like a mistake.
- **All instruments are synthesised (FM electric piano, triangle bass, noise drums).** No sample files to download, which matters on a phone at rehearsal.
- **Gain staging checked in a real browser.** The first version peaked at 1.2 (clipping) at 240 BPM with drums. A fast compressor plus a master trim now peak at about 0.62.
- **Generator is a pure, seeded function; vibes are JSON data.** Testable, deterministic, and v2 can map free text onto the same parameters.
- **Vite + TypeScript + Vitest (three dev dependencies, no runtime dependencies).** Typed vibe files catch data mistakes early, and Vite keeps the static build simple.
- **Roman numerals measured against the major scale (i, ♭III, ♭VI, ♭VII in minor).** One convention for every vibe and mode. Spelling comes from letter steps, so ♭VII in E minor is D, never C𝄪.
- **Vibe files are validated on load, including "can this chord ever be reached?".** The check caught three unreachable chords in the first draft of the data.
- **A repeated chord in a generated progression means "hold it".** Repeats merge into one longer chord, so the output reads like a chart, not `Em7(½) Em7(½)`.
- **Scale "fit" for pentatonics means "doesn't contradict the chord's 3rd or 7th".** A half-step rule wrongly rejected E minor pentatonic over D (its G is just the 4th).
- **Approach notes get a sixth fretboard shape: a small hollow triangle in the landing hue.** They belong with landing notes, so they share its colour and differ by shape and size. The layer is off by default because it can light up most of the neck.
- **Fretboard role priority puts Avoid above Scale.** Every avoid note is a scale note, so the spec's original order would have hidden them all.
- **Bare alterations display in brackets, `C(♯11)`.** `C♯11` would read back as a C♯ chord. Found by a round-trip test.
