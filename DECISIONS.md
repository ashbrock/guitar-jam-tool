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
- **Chords use a sampled Wurlitzer EP200 (CC BY 3.0) instead of FM synthesis.** The synth sounded digital. A Wurlitzer suits every vibe and stays out of the guitar's way. The Rhodes sets we found were non-commercial only, so they were ruled out for a portfolio piece.
- **Samples load in the background after the first tap; the synth covers until they're ready.** Play never waits on a download. A broken file only affects its own notes: five files from the first mirror were corrupt, and these had to be re-encoded from the original FLACs.
- **The reverb impulse is generated in code, not downloaded.** Decaying, darkening noise gives a convincing room for zero bytes.
- **Humanising only ever delays notes (roll ≤30 ms, push ≤5 ms).** Moving notes earlier could put them behind the scheduler's look-ahead. Timing is re-checked at 40 and 240 BPM.
- **Bass and drums are sampled too, from CC0 libraries (Karoryfer Swagbass, Versilian Virtuosity Drums).** CC0 removes any licence risk. Flatwounds suit soul and neo-soul. A jazz kit played with sticks sounds like a player in the room, not a drum machine.
- **Only a small subset of each library ships (76 files, about 2.1 MB), built by a script.** The originals are hundreds of MB. We keep what our parts play, and the script makes the subset reproducible.
- **Drum mics are pre-mixed per hit, offline.** That's one file per hit instead of three to fetch, decode and keep aligned at play time.
- **Mapping data can give each kit piece its own velocity layers and alternate takes.** The kit's pieces don't share layer splits. Alternate takes stop the "machine gun" sound on repeated hats.
- **Drums stay off by default (SPEC A8); the switch lives in the vibe picker.** Real drums don't change the reason for A8. A fifth bar button wrapped Re-roll at 360 px, and drums are part of a vibe's groove.
- **The generative direction (04, "Sympathetic strings") is the one we're building.** Its visuals come from the harmony, and the UI stays monochrome glass. It's memorable for a portfolio and still useful at arm's length. SPEC.md and DESIGN.md were rewritten around it, and Late Set stays in git history.
- **The docs only list values the prototype actually uses. Anything else is marked NEW for approval.** The hover, pressed and disabled styles, and a fix for the off-switch contrast, weren't in the prototype. CLAUDE.md forbids invented values, so they're flagged rather than slipped in.
- **The UI is monochrome; colour belongs to the visuals.** "Selected" is shown by inverting (off-white fill, dark ink), which reads at any distance without depending on colour. Play stays green, the universal "go".
- **Contrast is checked against the worst visual beneath the glass, not just the background.** In the worst case, without blur, muted text on the panel measures 3.07:1. So muted small text stays off the panel and cards, and the build samples real screenshots to confirm.
- **Length comes back as a control in the vibe picker (4 / 8 bars, Blues 12), default 4.** Rolling a random length gave up control for no gain, and the 12-bar form is central to blues.
- **Count-in is an option, off by default, on the "1 2 / 3 4" button, whose digits light up per beat. The metronome gets its own icon button.** The digits already said "count", so the count-in shows itself without sound or an extra element.
- **Count-in and metronome share one pill of two 48 px halves.** Five separate 56 px buttons wrapped Re-roll at 360 and 390 px. Joining the two timing toggles keeps Re-roll's label on one line, and both halves stay at least 48 px.
- **A Sound picker (top right) holds Chords, Bass and Drums switches plus the credits.** Muting chords lets you play them yourself. The top bar had room once the Lines/Dots switch went, and these are set-and-forget controls.
- **Each vibe has its own visualisation; there's no style switch.** The visual is part of the vibe's identity, like its groove. Until the visuals pass, it's strings or dots with a per-vibe look.
- **Pause freezes the visuals instead of fading them.** The paused picture stays as a still of the moment, matching the paused chord that stays highlighted.
- **The generative direction is now the app (`src/`), not just a prototype.** The prototype stays in `design/explorations/04-generative/` as a record. The app lives at the site root, built with Preact and signals.
- **The visuals are split into pure maths (`src/visuals/harmony.ts`, tested) and a thin canvas renderer.** Chord ratios, waves, layer blending and the beat swell can then be tested without a browser, keeping with CLAUDE.md's "music logic in pure functions".
- **Each vibe's look lives in its JSON file, validated with the rest of the vibe (SPEC A16).** A v2 that maps free text onto vibe parameters can then reach the visuals too.
- **Jam state takes the engine and randomness as inputs.** The re-roll, hold, history, length and key rules are tested in Node with a seeded random source.
- **One animation-frame loop reads the audio clock and drives the visuals, the playhead signal and the progress bar.** Components re-render at most once per beat; the 60 fps work writes straight to the canvas and one style property.
- **Count-in and metronome move into a Settings button (top right), next to a Sound sub-view.** The bottom panel goes back to Back, Re-roll and Play plus the three chips, so it holds only what you reach for every few seconds. Timing options are set once per session, and Re-roll gets room for its icon even at 360 px.
- **The count-in shows on the first chord card: its bar splits into four beats that fill one per beat.** The lit "1 2 / 3 4" digits went with the button, and the card is where your eyes already are.
- **Six visualisations, one per vibe: ribbons, smoke, record grooves, open road, aurora, dunes.** Each is a picture of the vibe's feel, and all of them are driven by the same harmony maths. Each also adds one musical tie of its own: a ribbon per chord tone, a ring sent out on each chord change, road lines on the eighth notes.
- **Styles are separate modules with pure geometry helpers and a test that draws every style onto a recording canvas.** NaN coordinates, out-of-range alphas or drawing while hidden would fail in Node, without a browser.
- **Hazy styles (smoke, aurora) draw at 1× resolution.** Large translucent fills were the bottleneck: 12 fps with the CPU slowed, against 31 and 17 after. The scaling softness suits haze anyway.
- **The aurora uses jittered streaks of three widths.** Evenly spaced streaks of one width read as a bar chart.
- **The visuals move to WebGL with Three.js (approved dependency).** The 2D canvas couldn't do glow, depth or texture at phone frame rates. Three.js brings tested bloom, tone mapping and post-processing, and room for real 3D later. Plain WebGL would have meant writing all that ourselves.
- **Three.js loads on first Play, in its own chunk (about 123 KB gzipped).** The visuals are hidden before Play anyway, so the first screen pays nothing for them. The 2D styles remain the fallback.
- **One shared visual state feeds both renderers.** Crossfades, pause, the beat swell and reduced motion are computed once and tested (`state.test.ts`). The WebGL scene can't drift from the rules, and the shader's inputs are a pure, tested mapping.
- **Liquid light for the Neo-soul pilot: tight halos, bloom only on bright cores, filmic tone mapping.** The first pass washed the screen red: too much soft halo and too much bloom. A dark field between the streams keeps it premium, and keeps text readable in a dim room.
- **The Neo-soul pilot switches from liquid light to an "orb", starting from Santosh Arron's audio-visualizer-three-js (MIT).** You preferred its wireframe sphere and terrains. We rebuilt it for current Three.js with GPU deformation, and drive it by both the harmony (chord-tone noise fields, change swell, beat) and the real audio (bass and treble).
- **The engine gets a read-only analyser tap for the visuals.** Reacting to what's actually playing makes the picture feel alive. The tap feeds a muted gain, so it adds nothing to the sound or the schedule. Loop timing was re-checked at 40 and 240 BPM: no late notes, exact beats.
- **The orb's background is drawn in the scene, with no tone mapping.** Measured: a clear colour came out grey (converted twice), and filmic tone mapping crushed it to black. Both missed `--bg`.
- **The bottom panel becomes icon buttons (Undo, Re-roll, Play, Tempo, Key) above a full-width vibe row.** One row of actions is quicker to scan. Key and tempo stay visible as quiet text in the vibe row, and the icon buttons' names carry their values.
- **The orb drops the floor and ceiling, goes greyscale, and centres on the chord card.** One object reads as calmer and more premium. With no colour, the chord text and charts stay the brightest, clearest things on screen. Centring puts the chord at the heart of the visual.
- **The orb is lit: a dark shell under a glowing wireframe, with a key light from the upper left.** The light and shadow sides give it real volume. The shell hides the far-side lines, so it reads as an object rather than a cage. Normals come from the deformed surface, so the music's bumps catch the light.
- **Neo-soul's scene becomes particle waves; the orb is set aside.** The orb didn't land. Waves fit the idea best: a chord is literally a set of waves, so each chord tone becomes a wave train and the chord becomes the interference pattern you see.
- **The WebGL plumbing moved into one shared stage.** Five more scenes are coming. The fixes learned the hard way (background colour, grain order, centring on the card, adaptive resolution) now apply to all of them automatically.
- **Particle waves become the visual for every vibe, each in its own colours.** You liked them best. One strong idea in six palettes and feels is more cohesive, and easier to make excellent, than six different scenes. The 2D styles stay only as the fallback.
- **No horizon: a free-flowing field seen from about 50° above.** The low view left half the phone screen empty. Looking straight down lost the waves; 50° fills the screen and keeps the swell. Jittered positions and a curling drift stop the grid from showing.
- **Density raised to about 66k particles, and crests grow as well as brighten.** From above, the wave shapes read through size and light rather than perspective, so the field needed more particles and more contrast.
- **Mute replaces Undo in the action row.** Playing with a band, you want the chords and timing without the sound, and that's more common than going back. Mute only drops the master level (20 ms fade), so the loop, cards and visuals stay in time. Measured: the output goes silent (0.54 → 0.001), the loop keeps advancing, and timing at 40 and 240 BPM is unchanged. Back stays on the keyboard (`U`).
- **Every roll is a verse and a contrasting chorus.** A single loop gave a jam nowhere to go. The chorus starts on a "lift" chord the vibe has, and is never the same progression as the verse. The rule is a small pure module on top of the generator, which gained an optional "start on these chords" input.
- **Sections switch by hand on the next bar line, with an optional song form (V V C C).** In a band, someone calls the change; landing on the bar line keeps everyone together. The form is there for practising without calling changes. Re-roll changes both sections, so the pair always fits.
- **The engine plays a play list; the UI maps positions back to (section, chord).** The scheduler stays untouched: the form is just a longer progression, and the cards, visuals and progress bar follow the section that's actually sounding.
- **Verse and chorus play straight through; the section switch and song form are gone.** You don't want to manage sections mid-song: a song has an N-bar verse and an M-bar chorus, and you just play it. The play list now runs verse → chorus on a loop, and Length means bars per section.
- **A bar timeline replaces the card's progress bar.** One dash per bar, with chord names placed where each chord starts, shows how long each chord lasts and when the next change is coming, the way a band reads a chart. It also names the section and what's next, and hosts the count-in.
- **Whole-song generation (intro, verses, choruses, bridge, outro) is earmarked for v2, possibly with AI.** The play list already takes any order of sections, so an AI step only has to produce sections. The rule-based generator stays the v1 engine (CLAUDE.md).
- **Only the chord chart is boxed; the chord name and bar timeline sit directly on the visuals.** Glass boxes everywhere made it feel like a dashboard. One boxed object, the chart you read your fingering from, gives the screen a clear focus and lets the visuals breathe. A soft dark halo (two `--bg` shadows) keeps the open text readable when bright particles pass behind it, so the visuals don't need to go.
- **The timeline drops its "VERSE" and "CHORUS →" labels.** They added noise, and a better way to show sections will come later. The count-in moves just above the timeline, positioned so the layout never shifts.

