# Klaviearn — Design Document

A Duolingo-style web app for learning to **play the piano**, designed
accessibility-first for low-vision users. Desktop and mobile.

Klaviearn started as a sight-reading trainer, and reading is still the spine
of the curriculum — but reading is the entry point to playing, not the whole
skill. The app now teaches five tracks: **reading**, **rhythm**,
**technique**, **ear**, and **repertoire**.

## 1. The core insight

Standard sheet music is an accessibility disaster: thin black lines, tiny
noteheads, and the entire meaning of a note encoded in a ~2mm vertical
position difference (line vs. space). Klaviearn doesn't treat that as a fixed
constraint to struggle against — it treats notation rendering as a variable.

The app renders notation **huge, high-contrast, and color/letter-scaffolded**,
then *gradually fades the scaffolds* as your recognition becomes automatic.
The endpoint is reading conventional notation (still enlarged); the path there
never requires squinting.

There is a second insight, and it cuts the other way. Notation is the *least*
accessible channel piano offers — so it should not be the only one. Playing by
ear, learning a passage from hearing it, feeling a five-finger shape under the
hand: these are real pianistic skills that happen to require **no visual
acuity at all**. A conventional method treats them as supplements to reading.
Here they are first-class tracks, taught in parallel, and a student who is
having a bad eyes day can still have a good practice day.

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

**Reading and rhythm (built):**

1. **Note flash** — one note appears on the staff; play it. Core drill.
2. **Line or space?** — binary discrimination drill (two big buttons / keys).
3. **Audio match** — hear a pitch, find it on the on-screen staff or keyboard.
4. **Rhythm tap** — notation rhythm shown huge; tap it on any key/spacebar
   against a metronome. (Separate track — rhythm and pitch are taught apart,
   then merged.)
5. **Interval naming** — two notes; name the distance. Trains shape-reading
   over absolute position, which is the expensive judgment for low vision.
6. **Micro sight-reading** — 1–2 bars, 3–8 notes, read left to right. The
   "real thing," introduced once component skills exist.

**Playing (the expansion):**

7. **Chord flash** — a triad on the staff; play all of it, together. The first
   drill that requires *polyphonic* input, and therefore the first that asks
   the hand to do something a single finger can't.
8. **Play it back** — the app plays a short phrase or chord; you reproduce it
   with no notation on screen. Pure ear, zero acuity required.
9. **Technique patterns** — five-finger positions, scales, arpeggios, played
   against a metronome with fingering shown on the noteheads. Graded on note
   order and evenness of timing.
10. **Passage practice** — a bar or phrase from a real piece, looped, hands
    separate before hands together, tempo ramping as accuracy holds.

The through-line: drills 1–6 grade *what you recognized*, drills 7–10 grade
*what you played*. That distinction is what the engine has to grow to support
(see §7).

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

Five parallel tracks. Each is independently practisable — a session draws
from whichever is due — and they converge on repertoire.

```
READING          RHYTHM            TECHNIQUE        EAR              REPERTOIRE
guide notes      quarter/half      5-finger pos.    match a pitch
 (C4, G4)         /whole            (C position)     you hear
  ↓                ↓                 ↓                ↓
steps around G4  eighths, rests    finger numbers   intervals
  ↓                ↓                as a scaffold     by ear
full treble      dotted, ties       ↓                 ↓
  ↓                ↓               contrary/         chord quality
treble ledger    swung, triplets   parallel motion    (maj/min)
  ↓                                 ↓                 ↓
bass guide (F3)                    thumb-under      play back a
  ↓                                  ↓                phrase
full bass                          scales +           ↓
  ↓                                arpeggios        play back a
intervals as shapes                 ↓                chord
  ↓                                hands together    ↓
accidentals ────────────────────────┴─────────────────┘
  ↓                                        ↓
chords / triads ──────────────────────────►│
  ↓                                        │
key signatures                             ▼
  ↓                                  first pieces
grand staff  ─────────────────────►  (hands separate)
                                           ↓
                                    hands together
                                           ↓
                                    real repertoire
```

Pedagogical notes:
- **Guide-note method** (anchor notes + steps/skips from them) over rote
  mnemonics — it's how fluent readers actually work and it generalizes.
- **Intervallic reading** ("up a third") is taught explicitly as its own
  skill; it reduces dependence on absolute position judgment, which is
  exactly the hard part for low vision.
- **Fingering is a scaffold, not decoration.** Finger numbers render on the
  noteheads at L0–L1 and fade with the colors. The app can't *see* which
  finger you used — it teaches and prompts, and grades note order and
  evenness instead. That is exactly what a teacher does between lessons.
- **Chords before key signatures.** Playing C–E–G as one shape teaches the
  hand more than naming the key of G does, and it's the first thing that
  sounds like music rather than like a drill.
- **Ear runs the whole length of the tree.** It is not a "later" track — it
  starts on day one, because it's the track that never depends on your eyes.

## 6. Input methods

| Method | When | Notes |
|--------|------|-------|
| **Web MIDI** (primary) | Digital piano w/ USB | Perfect accuracy, instant. Chrome/Edge desktop + Chrome Android. **Not available on iOS Safari** — must not be the only path. |
| **On-screen keyboard** (universal fallback) | Any device, incl. iPhone | Large touch keys, optional letter labels, ~1.5 octaves visible, scrollable. Also keyboard-bindable (ASDF row) on desktop. |
| **Microphone pitch detection** | Acoustic piano | Single notes only (`pitchy` / autocorrelation in a worklet). Chords are unreliable through a mic — the chord and repertoire drills fall back to MIDI or on-screen input. |

### Polyphony

Reading drills need one note at a time; playing drills need *sets*. The input
layer buffers note-ons in a short window (~60ms) and emits a chord as a single
event, so a triad arrives as `{60, 64, 67}` rather than three sequential
answers. Every drill above chord flash depends on this.

On-screen input can't be simultaneous, so taps accumulate into a pending set
that submits when it reaches the target size. Consequence worth stating: with
touch input the app grades *which notes*, not *together* — simultaneity is
only gradable on MIDI, and even there it's recorded before it's scored.

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

### The three engine changes the playing tracks need

Generated drills got us through reading. Playing needs three things the
current engine does not have, and everything in §4's second list depends on
one of them:

1. **Polyphonic input** (see §6). Sets, not notes. Blocks chords, hands
   together, and every piece.
2. **A timed evaluator.** Today the only clock lives in the rhythm drill;
   pitch drills are untimed, which makes them reading tests rather than
   playing tests. Generalize the rhythm drill's audio-clock scoring into one
   evaluator that takes (expected events, tempo) and returns per-event
   verdicts of pitch *and* timing. Chord, technique, and passage drills all
   score through it.
3. **Content that isn't generated.** A note range can't express a piece. Add
   an authored `Piece` — sections, bars, two staves, fingering, tempo — kept
   as JSON, imported from MusicXML for public-domain repertoire. Generated
   drills stay generated; pieces sit alongside them.

The SRS generalizes to all of it for free: an item key is already an opaque
string, so `piece:minuet-in-g:bar:12` schedules exactly like `treble:60`. The
bar you keep fumbling comes back tomorrow; the one you own comes back in a
month. That is the whole practice-planning problem, already solved.

### Data model (core tables)

`users` · `settings` · `skill_nodes` (static/config) · `user_skill`
(unlocked, mastery ring) · `items` (note×clef, interval, rhythm pattern,
chord, technique pattern, piece passage) · `user_item_srs` · `attempts` (for
stats and confusion analysis) · `streaks/xp` · `pieces` (authored content) ·
`user_piece` (section progress, current tempo, hands-separate/together)

Item-key namespaces (all opaque to the SRS, ≤32 chars):

| Prefix | Example | Track |
|--------|---------|-------|
| `treble:` / `bass:` | `treble:60` | reading |
| `grand:` | `grand:bass:53` | reading |
| `int:` | `int:3` | reading |
| `rhythm:` | `rhythm:r-8ths-1` | rhythm |
| `chord:` | `chord:2:min` | reading + technique |
| `ear:` | `ear:int:5` | ear |
| `tech:` | `tech:scale:C:rh` | technique |
| `piece:` | `piece:minuet-g:b12` | repertoire |

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

**Phase 4 — Reach.** Mic input for acoustic pianos, stats dashboards
(confusion matrix of your note errors), maybe sharing.

---

Phases 0–4 built a reading trainer. Phases 5–8 turn it into a piano app. Each
is independently shippable and worth using on its own; do them in order, and
put each into daily practice before starting the next.

**Phase 5 — Polyphony and chords.** Chord buffering in the input layer,
accidentals in the note data, and a triad drill (primary chords, then minors,
then one that needs a black key). The smallest change that unlocks the most:
nothing in phases 6–8 is possible without it.

**Phase 6 — The ear track.** *Built.* Play-back drills — hear a pitch, an
interval, a chord, a four-note phrase; reproduce it with nothing on screen.
Cheap to build on top of phase 5's chord comparison, and the most accessible
thing in the app.

The scaffold system needed rethinking here rather than reusing. Letters and
colours are meaningless with no notation on screen, and the obvious
substitute — showing the note name — *is* the answer. So the per-item SRS
level buys difficulty in the listening instead (`web/src/lib/ear.js`):

| Drill | L0 | L1 | L2 |
|-------|----|----|----|
| Match the pitch | a reference C sounds first, to measure against | the note alone | the note alone |
| Intervals by ear | the notes one after another, slowly | the same, quicker | both together |
| Major or minor | arpeggiated, then repeated as a block | arpeggiated | the block chord alone |
| Play it back | wide gaps between notes | narrower | at tempo |

Same ladder shape as the visual scaffolds — full support that withdraws as
the item is mastered — spent on a channel that has nothing to do with
eyesight.

**Phase 7 — Technique and the timed evaluator.** *Built, except hands
together.* The rhythm drill's scoring is now `web/src/lib/evaluator.js`: a
pure function that takes what was expected and what was played, both in
beats, and returns a per-event verdict of pitch *and* timing — ok, early,
late, wrong note, or missed — plus anything played that nobody asked for.
`components/TimedPlay.jsx` is the app's only clock: it counts in, runs the
metronome, collects what was played, and scores through that evaluator. The
rhythm drill moved onto it and `RhythmPlay` is gone, because two components
with two clocks was the duplication this phase existed to remove.

On top of it: five-finger positions, C major scales with the thumb tucking
under, and arpeggios — each hand separately, one beat per note at 80bpm,
because these drills are about evenness and fingering rather than speed.
Fingering prints above the notes and withdraws with the colours, exactly as
§5 describes. Phrase reading gained a timed variant that credits each note
separately from the take's verdicts.

**Not built: hands together, and contrary motion.** Both need simultaneous
two-staff expectations and notation, which sits closer to phase 8's passage
work than to anything else here. Hands *separate* ships.

The untimed phrase drill stayed rather than being replaced. Reading a phrase
at your own pace is the on-ramp to reading it in time, and taking the ramp
away to add the destination would have been a worse trade than offering
both.

**Phase 8 — Repertoire.** *Built.* Pieces are authored data rather than
generated — bars, two hands, fingering, a target tempo — in
`server/app/pieces.py` and mirrored in `web/src/lib/pieces.js`. Every bar is
its own SRS item (`piece:ode-to-joy:b4`), and two of the phase's four parts
then came for free from engine work already done:

- **Section looping** is not a feature. Once the bar is the item, the
  weighting `build_session` has always applied brings the bar you keep
  fumbling back on its own.
- **The tempo ramp** is the scaffold ladder again, spent on speed. A bar you
  have never played arrives at 60% of the piece's tempo; a mastered one
  arrives at it. Same shape as the colours and the ear track.

Hands separate and hands together — the piece deferred from phase 7 — are
three drills on a piece node rather than something derived, because a learner
really does want to say "left hand today". Hands together needed no change to
the evaluator: a bar played with both hands is two expected events on the same
beat, and phase 7's pitch-preference matching already resolves them.

MusicXML import is `server/tools/import_musicxml.py`, a build-time CLI rather
than a runtime path. Repertoire is imported once, checked by a human, and
pasted into `pieces.py`; the served app never parses XML. It refuses what it
cannot represent — chords, ties, tuplets, a third staff — because a piece that
imports *wrong* is worse than one that does not import.

**Phase 9 — Key signatures.** *Built.* The reading track's "accidentals → key
signatures" step, and the thing nothing graded can happen without: until this
every note in the app was a white key.

A key breaks an assumption every earlier phase could make — that a MIDI
number spells itself. Pitch class 10 is B flat in F major and A sharp in B
major, and `web/src/lib/keys.js` splits one idea into two:

| | |
|---|---|
| `acc` | what the note **is** — F sharp has acc `#` |
| `written` | what gets **drawn** — nothing, if the signature already said so |

So a G major scale draws no accidentals at all (the signature said it once at
the front), A harmonic minor draws its G sharp twice (A minor's signature has
nothing to say about G), and an F natural in G major would need a natural to
cancel the signature. Conflating the two is how notation goes wrong.

On top of it: scales and arpeggios in C, G, D, F major and A harmonic minor,
hands separately, generated from the scale shapes rather than typed out — and
a "name the key signature" drill on a deliberately bare grand staff.

Long patterns now draw on two systems, up and back down. That is a legibility
decision rather than a layout one: the SVG scales to the card's width, so a
fifteen-note scale on one line rendered at about a third the height of a
single flashed note, which is the wrong trade in an app whose premise is
large notation.

**Phase 10 — Graded practice.** Not built. A grade is data plus a view: a
list of requirements, and a readiness screen colouring each one from SRS
state already recorded. The four components of a piano exam are already the
app's four tracks, so this populates existing machinery rather than adding
any. Requirements are facts and encodable; set pieces are not ours to ship
(the MusicXML importer is the answer there); and nothing should imply
endorsement by any exam board.

## 9. Open questions

- Exact color palette (start with Boomwhackers, validate against your eyes —
  you're the ground truth).
- Latency budget for MIDI→feedback (<50ms feels instant; fine in practice).
- Whether scaffold L3 (standard proportions) is even a goal, or L2 (plain but
  large) is the practical endpoint for reading real (zoomed/printed-large)
  scores. The app should support either as "done."
- How strictly to grade simultaneity on chords. Too tight and it punishes a
  hand that is still learning the shape; too loose and "chord" means
  "arpeggio." Start ungraded, watch real attempts, then decide.
- Whether inversions are a separate SRS item from the root-position chord, or
  the same item at a higher scaffold level. (Leaning: same item — it's the
  same harmony, recognized a harder way, which is exactly what a scaffold
  level means here.)
- Fingering can be taught but not verified without a camera. Is prompt-only
  fingering good enough to build the habit, or does it risk drilling in a bad
  one? Worth asking a teacher rather than guessing.
- Where repertoire comes from. MuseScore's public-domain corpus and IMSLP both
  have MusicXML, but beginner-level arrangements with *fingering* are rarer
  than they should be.
