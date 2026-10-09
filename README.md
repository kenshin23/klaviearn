<p align="center">
  <img src="web/public/icon.svg" width="128" alt="Klaviearn — three notes on a line, their colors fading as you master them" />
</p>

# Klaviearn 🎹

**Learn to play the piano — designed accessibility-first for low-vision musicians.**

*Klavier* (German for piano) + *learn*.

Standard sheet music is an accessibility problem: thin black lines, tiny
noteheads, and the entire meaning of a note encoded in a millimeters-small
vertical position difference between a line and a space. Klaviearn treats
notation rendering as a variable, not a constraint — notes are drawn **huge,
high-contrast, and color/letter-scaffolded**, and the scaffolds fade
per-note as your recognition becomes automatic, driven by spaced repetition.
Think Duolingo, but the answer box is your piano.

## How it works

- **Short sessions** (3–5 min, ~10 exercises) with streaks, XP, and a skill
  tree: treble guide notes → full staff → ledger lines, with bass clef and
  rhythm as parallel tracks that merge into real micro sight-reading.
- **Your piano is the input.** USB-MIDI keyboards connect directly in the
  browser (Web MIDI); acoustic or non-connectable pianos work through
  microphone pitch detection; an on-screen keyboard covers everything else
  (including iOS, where Web MIDI doesn't exist).
- **Audio is a first-class channel.** Every state has a distinct sound, wrong
  answers play back what you played versus the target, and the app aims to be
  largely usable by ear.
- **Everything is tunable**: staff size, line thickness, note colors, themes.

The full design — visual scaffold system, curriculum, SRS engine,
architecture, roadmap — is in [DESIGN.md](DESIGN.md).

## Status

**Phases 1–10 built.** A FastAPI backend in [`server/`](server/) with
accounts, spaced repetition (SM-2 variant), per-item scaffold fading, XP and
day streaks, and a per-answer attempt log. The React PWA in [`web/`](web/)
works logged-in (server is the source of truth) or as an offline guest
(localStorage). Twenty-two skill nodes across sixteen drills.

**Reading and rhythm:** notes on the treble, bass and grand staff;
line-or-space discrimination; 4-note phrases; intervals as shapes; metronome
rhythm tapping; root-position triads played as a chord.

**Ear:** match a pitch you hear, name an interval by ear, tell major from
minor, and play a four-note phrase back — all with nothing on screen, which
makes them the drills that need no visual acuity at all.

**Technique:** five-finger positions, scales and arpeggios in C, G, D and F
major and A harmonic minor, each hand separately, played against a metronome with the
fingering printed above the notes until you no longer need it. Phrases can
be read in time too. These are scored on pitch *and* timing by a shared
evaluator, which reports per note whether you were on the beat, early, late,
or on the wrong note entirely.

**Keys:** name a key signature from the sharps or flats at the front. The
app knows what a key does to notation — a G major scale draws no accidentals
because the signature already said it, while A harmonic minor draws the G
sharp its signature never covered.

**Repertoire:** real pieces, a bar at a time, right hand or left hand or
both. Every bar is its own spaced-repetition item, so the bar you keep
fumbling comes back on its own, and it comes back slowly — a new bar arrives
well under tempo and speeds up as you get it. Pieces are authored data;
[`server/tools/import_musicxml.py`](server/tools/import_musicxml.py) converts
MusicXML into that shape at build time.

A stats dashboard shows your confusion matrix ("seeing C, you played D ×3")
and per-item accuracy. A **grades** view lays graded requirements over
everything you have practised, so each one reads as not started, working on
it, or secure. Those levels are generic and name no exam board — correct them
against whichever syllabus you are actually following. The home screen groups
its lessons under the five tracks.

```bash
# API (Python 3.11 via asdf — see .tool-versions)
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8787 --reload

# Web app (Node 24 — see .nvmrc; `nvm use` picks it up)
cd web
npm install
npm run dev
# open http://localhost:5173 in Chrome (Safari has no Web MIDI)
```

## Development

`make help` lists everything. The essentials:

```bash
make install    # dependencies for both halves, dev tools included
make test       # pytest + vitest
make lint       # ruff + eslint
make check      # lint, test, and build — run this before committing
```

Tests: **pytest** for the API, SRS scheduler, and curriculum data
([`server/tests/`](server/tests/)); **vitest** with Testing Library for the
libraries, components, screens, and the exercise state machine
(`web/src/**/*.test.js`). Every source file has a suite except `main.jsx`,
which is the ReactDOM mount.

Two of them are worth knowing about:

- [`test_parity.py`](server/tests/test_parity.py) runs the JS curriculum
  through node and diffs it against the Python one. Guest mode reads
  `web/src/lib/notes.js` while accounts read `server/app/content.py`, so drift
  means two people practise different curricula from the same-looking screen.
- The staff tests render **real VexFlow** into jsdom and read the SVG back —
  notehead count, scaffold colour per notehead, annotation text, ledger lines,
  and the accidental itself. A sharp has no class of its own in VexFlow's
  output, so it is caught by comparing D major against D minor: same three
  staff positions, one extra glyph. `src/test/staff.js` holds the helpers.

Importing repertoire:

```bash
cd server
.venv/bin/python -m tools.import_musicxml score.musicxml --id minuet-g --tempo 100
```

It prints the piece as JSON for pasting into `app/pieces.py`, warning about
bars that do not add up or notes with no fingering. It refuses chords, ties,
tuplets and anything past two staves rather than guessing.

Linting: **ruff** for Python, **ESLint** for JavaScript. Ruff runs as a linter
only — the curriculum tables in `content.py` are column-aligned deliberately
and a formatter would reflow them. ESLint treats the React Compiler rules that
ship with `eslint-plugin-react-hooks` v7 as warnings rather than errors; they
flag patterns this app uses on purpose (see `eslint.config.js`).

The original **Phase 0** proof-of-concept — a single dependency-free page —
lives in [`phase0/`](phase0/) and still works offline:

```bash
python3 -m http.server 8000 --directory phase0
```

## Planned stack

| Layer | Choice |
|-------|--------|
| Backend | Python — FastAPI + SQLAlchemy (SQLite → Postgres) |
| Frontend | React + Vite, shipped as a PWA for desktop and mobile |
| Notation | VexFlow (SVG, per-element styling for the scaffold system) |
| Piano input | Web MIDI (webmidi.js) · microphone pitch detection · on-screen keys |
| Audio | WebAudio + soundfont playback |

## License

[AGPL-3.0](LICENSE). The vendored `phase0/vexflow.js` is
[VexFlow](https://github.com/0xfe/vexflow), MIT-licensed by its authors.

## Roadmap

1. ~~**Phase 0** — proof-of-concept spike (notation + piano input + feedback)~~ ✅
2. ~~**Phase 1** — playable core: React app, note drills, settings, local progress~~ ✅
3. ~~**Phase 2** — learning engine: accounts, spaced repetition, skill tree, streaks~~ ✅
4. ~~**Phase 3** — rhythm + metronome, phrase reading, intervals, grand staff, PWA~~ ✅
5. ~~**Phase 4** — error-pattern stats (confusion matrix), mic input~~ ✅
6. ~~**Phase 5** — polyphonic input, accidentals, triad drill~~ ✅
7. ~~**Phase 6** — the ear track: pitch, interval, chord quality, phrase playback~~ ✅
8. ~~**Phase 7** — timed evaluator, technique track, fingering scaffold~~ ✅
9. ~~**Phase 8** — repertoire: pieces, per-bar SRS, tempo ramp, hands together,
   MusicXML import~~ ✅
10. ~~**Phase 9** — key signatures, multi-key scales and arpeggios~~ ✅
11. ~~**Phase 10** — graded practice, and the home screen grouped by track~~ ✅
12. **Next** — more repertoire through the importer, and a second octave for
    the scales.
