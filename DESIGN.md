# Klaviearn — Design Document

A Duolingo-style web app for learning to sight read piano music, designed
accessibility-first for low-vision users. Desktop and mobile.

## 1. The core insight

Standard sheet music is an accessibility disaster: thin black lines, tiny
noteheads, and the entire meaning of a note encoded in a ~2mm vertical
position difference (line vs. space). Klaviearn doesn't treat that as a fixed
constraint to struggle against — it treats notation rendering as a variable.

The app renders notation **huge, high-contrast, and color/letter-scaffolded**,
then *gradually fades the scaffolds* as your recognition becomes automatic.
The endpoint is reading conventional notation (still enlarged); the path there
never requires squinting.

## 2. Design principles

1. **One thing on screen at a time.** An exercise shows one note, one interval,
   or one short phrase — never a page. The staff fills most of the viewport.
2. **Line/space ambiguity is the enemy.** Every visual choice attacks it:
   thick staff lines, oversized noteheads, color coding, letter labels.
3. **Audio is a first-class channel.** Every state change has a distinct sound
   (correct chime, gentle error, the pitch you played vs. the target). The app
   should be largely usable by ear.
4. **Scaffolds fade per-item, not globally.** If you've mastered treble-G but
   still confuse the C above, G renders plain while C keeps its training wheels.
5. **Everything is tunable.** Staff size, line thickness, notehead size, color
   palette, theme — live settings, persisted per user. (You are user #1;
   build the knobs you need.)
6. **Sessions are short.** 3–5 minutes, ~10 exercises, clear end point.
   Duolingo's loop works because stopping feels fine.

## 3. Visual design of the notation

### Scaffold levels (per note-on-staff item)

| Level | Rendering |
|-------|-----------|
| L0 — Full scaffold | Colored notehead, letter name inside the notehead, colored/emphasized staff line for line-notes |
| L1 — Color only | Colored notehead, no letter |
| L2 — Plain large | Black-on-background notation, thick lines, large size |
| L3 — Standard-ish | Conventional proportions, still user-scaled |

Color mapping: one distinct color per letter name (the Boomwhackers /
Chroma-Notes convention is a good default — it's an existing pedagogical
standard, so knowledge transfers). All colors checked for contrast against
both themes.

### Attacking line-vs-space directly

- Staff lines rendered **3–4× standard thickness**, user-adjustable.
- **Line-notes vs. space-notes get distinct treatments** at L0–L1:
  e.g. line-notes drawn with the line visibly passing *through* the notehead
  (line emphasized in the note's color); space-notes drawn with the two
  bounding lines slightly dimmed so the gap reads as a gap.
- **Ledger-line notes** keep their ledger lines bold and long.
- Optional "ghost grid": faint extension of staff lines across the whole
  exercise area so vertical position is easier to judge.
- Dedicated exercise type: *"line or space?"* — a binary-answer drill that
  trains exactly this discrimination before letter naming is even asked.

### Themes

- Dark theme (light notation on near-black) and high-contrast light theme.
- No information carried by color alone — color always accompanies position,
  and letters are available one scaffold level up.

## 4. The learning loop

### Exercise types

1. **Note flash** — one note appears on the staff; play it. Core drill.
2. **Line or space?** — binary discrimination drill (two big buttons / keys).
3. **Audio match** — hear a pitch, find it on the on-screen staff or keyboard.
4. **Rhythm tap** — notation rhythm shown huge; tap it on any key/spacebar
   against a metronome. (Separate track — rhythm and pitch are taught apart,
   then merged.)
5. **Micro sight-reading** — 1–2 bars, 3–8 notes, played in time at a slow
   tempo. The "real thing," introduced once component skills exist.

### Feedback

- Correct: green flash + chime, brief letter-name confirmation, auto-advance.
- Wrong: the played note is drawn on the same staff in a contrasting style
  next to the target, both pitches played back ("you played E, this is G"),
  then retry. Errors recorded per confused pair (E↔G confusions feed the SRS).

### Spaced repetition (the engine)

Every (note, clef, scaffold-level) is an SRS item. Use FSRS or SM-2 scheduling:

- New items introduced a few at a time inside themed lessons.
- Review sessions mix due items; weak/confused items recur sooner.
- An item "levels down" its scaffold (L0→L1→L2→L3) after sustained fast,
  accurate recall — speed matters, not just correctness, because sight
  reading is a fluency skill. Target: correct response < ~1.5s.

### Gamification

Streaks, daily goal, XP per session, and a visible skill tree. Skip hearts/
lives — punishment mechanics are wrong for an accessibility-focused app.
"Mastery rings" per skill node (bronze/silver/gold = scaffold level reached).

## 5. Curriculum (skill tree)

```
Treble: guide notes (C4, G4)          Rhythm: quarter/half/whole
        → steps around G4                     → eighths, rests
        → full treble staff                   → dotted rhythms, ties
        → treble ledger lines
Bass:   guide notes (C4, F3)
        → full bass staff → ledger lines
Merge:  intervals as shapes (2nds/3rds → 4ths/5ths)
        → micro sight-reading, one hand
        → grand staff, hands separate → hands together
Later:  accidentals → key signatures → real excerpts
```

Pedagogical notes:
- **Guide-note method** (anchor notes + steps/skips from them) over rote
  mnemonics — it's how fluent readers actually work and it generalizes.
- **Intervallic reading** ("up a third") is taught explicitly as its own
  skill; it reduces dependence on absolute position judgment, which is
  exactly the hard part for low vision.

## 6. Input methods

| Method | When | Notes |
|--------|------|-------|
| **Web MIDI** (primary) | Digital piano w/ USB | Perfect accuracy, instant. Chrome/Edge desktop + Chrome Android. **Not available on iOS Safari** — must not be the only path. |
| **On-screen keyboard** (universal fallback) | Any device, incl. iPhone | Large touch keys, optional letter labels, ~1.5 octaves visible, scrollable. Also keyboard-bindable (ASDF row) on desktop. |
| **Microphone pitch detection** (later) | Acoustic piano | Single notes only at first (`pitchy` / autocorrelation in a worklet). Chords unreliable — defer. |

Device detection on first run: "Press a key on your piano…" → auto-selects
MIDI if a device responds; otherwise on-screen keyboard with a settings
toggle.

## 7. Architecture

```
React (Vite) SPA  ──JSON──▶  FastAPI  ──SQLAlchemy──▶  SQLite → Postgres
  VexFlow (notation render)     auth (JWT or session)
  webmidi.js (input)            SRS scheduler
  WebAudio + smplr (sound)      curriculum/content API
  PWA (installable on mobile)   progress/stats
```

### Frontend (React — worth learning for this)

- **VexFlow** for notation: renders to SVG, allows per-element styling
  (notehead colors, line thickness, arbitrary scale) — exactly what the
  scaffold system needs. (OSMD/abcjs render whole scores with less
  per-element control; wrong fit for exercise-sized snippets.)
- **webmidi.js** wraps Web MIDI cleanly (note on/off, velocity, device events).
- **smplr** or Tone.js + a piano soundfont for playback; WebAudio for
  feedback sounds and the metronome.
- State: React Query for server data + a small client store (Zustand) for
  the in-session exercise machine. The session itself is a tiny state
  machine: `presenting → listening → feedback → next`.
- Ship as a **PWA** so it installs on phones; one codebase for both targets.

### Backend (FastAPI)

- Endpoints (sketch):
  - `POST /auth/…` — accounts
  - `GET /tree` — skill tree + user progress overlay
  - `POST /session/start` — returns ~10 exercises (SRS picks due items + new)
  - `POST /session/answer` — records attempt (item, correct, latency, played
    note); returns updated SRS state
  - `GET/PUT /settings` — display prefs (sizes, colors, theme, input method)
- Exercises are **generated, not authored**: an exercise is (type, item(s),
  scaffold level, tempo). Content lives as data — note ranges per skill node —
  so the curriculum is a config file, not thousands of rows.
- SRS state per (user, item): ease/stability, due date, scaffold level,
  confusion-pair counts.

### Data model (core tables)

`users` · `settings` · `skill_nodes` (static/config) · `user_skill`
(unlocked, mastery ring) · `items` (note×clef, interval, rhythm pattern) ·
`user_item_srs` · `attempts` (for stats and confusion analysis) ·
`streaks/xp`

## 8. Roadmap

**Phase 0 — Spike (a weekend).** One HTML page, no backend: VexFlow draws one
giant colored note; webmidi.js listens; right/wrong feedback with sound.
*Proves the entire concept end-to-end and gives you a feel for VexFlow before
committing.*

**Phase 1 — Playable core.** React app, exercise state machine, note-flash +
line-or-space drills, on-screen keyboard fallback, settings panel (size/
thickness/theme/colors), progress in localStorage. First treble skill node.
*Usable for real daily practice — by you — with no backend at all.*

**Phase 2 — The learning engine.** FastAPI + DB, accounts, SRS scheduling,
scaffold fading, skill tree (treble + bass + rhythm track), streaks/XP.

**Phase 3 — Sight reading proper.** Micro sight-reading exercises with
metronome, interval skills, grand staff, PWA install + mobile polish.

**Phase 4 — Reach.** Mic input for acoustic pianos, real-repertoire excerpts,
stats dashboards (confusion matrix of your note errors), maybe sharing.

## 9. Open questions

- Exact color palette (start with Boomwhackers, validate against your eyes —
  you're the ground truth).
- Latency budget for MIDI→feedback (<50ms feels instant; fine in practice).
- Whether scaffold L3 (standard proportions) is even a goal, or L2 (plain but
  large) is the practical endpoint for reading real (zoomed/printed-large)
  scores. The app should support either as "done."
