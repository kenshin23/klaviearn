# Arpeggio speed practice

Open **Technique → Build arpeggio speed**. Connect a USB-MIDI keyboard in a
browser supporting Web MIDI, select the starting octave, and press Start.
The screen reports connected devices and shows the written notes and fingers.
MIDI measures which keys were played; finger numbers are a visual guide.

## Tempo in BPM per note

**Note tempo (BPM)** controls individual note attacks. At 75 BPM, one note
arrives every 0.8 seconds, and the 15-note pattern repeats every 12 seconds.
At 20 BPM, one note arrives every 3 seconds and a pass lasts 45 seconds.
The count-in is four note beats at the selected tempo. The default **Each
note** click follows every attack; **Whole pass** and **Four clicks per pass**
are also available.

Passes continue without a restart gap. Every requested pitch and octave must
be played in order, within a timing window scaled to the note spacing, without
extra notes. The global relaxed-octave preference does not apply in this mode.
Playing the right pitches in a burst at the start of the pass does not count.

By default, five consecutive clean passes confirm the current tempo and raise
it by **4 BPM**: for example, **20 → 24 → 28 BPM**. **Tempo increase (BPM)**
lets you choose a smaller or larger step, including half-BPM increments.
A mistake resets the clean streak and keeps the tempo. Tempo, increment and
required clean-pass count are configurable. Best speed means a tempo confirmed
by the full required streak, not one lucky pass. Stopping partway through a
pass does not record it. Leaving the screen or hiding the tab stops practice.

## First preset

The left-hand D-flat major preset contains these **15 separate attacks**:

```text
Notes:    Db Ab Db F Ab Db F Ab | F Db Ab F Db Ab Db
Fingers:   5  3  2 1  4  2 1  2 |  1  2  4 1  2  3  5
```

There is one top A-flat (Ab4, MIDI 68); the descent starts immediately on F4
(MIDI 65). The first and last D-flats are separate attacks when cycles repeat.
The default starting note is Db2 (MIDI 37); the lower octave can be selected
before starting. The notation retains D-flat and A-flat spellings rather than
substituting sharps.

## Note-by-note feedback

During a pass, accepted notes turn green; wrong or missed notes turn red.
Unplayed notes stay neutral, and the moving amber cursor only marks the next
beat. The compact feedback strip also uses check marks and crosses, so color
is not the only cue. A note counts as correct when both its pitch/octave and
timing satisfy the scoring window.

The current pass and last completed pass show correct notes out of the full
pattern and a percentage, for example **12/15 · 80%**. Wrong, missed and extra
notes remain visible in the last-pass breakdown. A partial result does not
raise the tempo; the full clean-cycle rule still applies. Stopping retains the
last complete result, or labels a partial result as interrupted.

The MIDI diagnostic shows the last received pitch, the expected pitch and its
timing offset. Use it to distinguish an octave mismatch, input during the
count-in, missing input and playing outside the timing window. The current
pattern still requires two separate lower D-flat presses across a cycle join:
one ends the previous pass and the next starts the new pass.

## Saved progress

Configuration, current tempo and confirmed best tempo are saved with the
existing settings mechanism: browser storage for guests and account settings
for members. Each preset and starting octave has its own progress. A partial
clean streak is not restored after leaving practice. Curriculum sessions,
spaced-repetition items, XP and account schemas are unchanged.

Existing cycle-based speeds are converted automatically while preserving the
playing pace and confirmed record. For this 15-note preset, the old 5 cycles/min
becomes 75 note BPM, and 6 becomes 90. The conversion is versioned so reopening
practice does not apply it again. The new default increase is 4 note BPM.

## Adding presets

`web/src/lib/arpeggios.js` defines presets as data. Each has an ID, name, hand,
clef and base MIDI note at the reference starting octave 2. Each ordered step
defines its semitone offset, finger, written letter and accidental. Supply
explicit repeated notes when the player should re-articulate them. The same
screen, timing engine, strict scoring and progression work for other patterns;
this version provides the D-flat preset and an octave selector.

Regression tests cover the pattern, flat spelling, narrow timing, exact
octaves, missing/extra notes, tempo progression, continuous cycle boundaries,
timer cleanup, MIDI routing, persistence and the home-screen entry. Run the
project's `make check`, or run `npm test`, `npm run lint`, and `npm run build`
from `web/` along with the backend checks described in the main README.
