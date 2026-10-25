# Arpeggio speed practice

Open **Technique → Build arpeggio speed**. Connect a USB-MIDI keyboard in a
browser supporting Web MIDI, select the starting octave, and press Start.
The screen reports connected devices and shows the written notes and fingers.
MIDI measures which keys were played; finger numbers are a visual guide.

## Whole-pattern tempo

The tempo unit is **cycles per minute**: one complete ascent and descent fits
between accented clicks. At 20 cycles/min, a cycle lasts 3 seconds. With 15
attacks, the note spacing is 200 milliseconds (5 notes/second).
The count-in has four pulses across one cycle. By default, the click sounds on
every note onset; choose four subdivisions or one beat per cycle in the click
menu if you prefer fewer clicks.

Cycles continue without a restart gap. Every requested pitch and octave must
be played in order, within a timing window scaled to the note spacing, without
extra notes. The global relaxed-octave preference does not apply in this mode.
Playing the right pitches in a burst at the start of the cycle does not pass.

By default, five consecutive clean cycles confirm the current tempo and raise
it by one cycle/min. A mistake resets the clean streak and keeps the tempo.
The tempo, increment and required clean-cycle count are configurable. Best
speed means a tempo confirmed by the full required streak, not one lucky cycle.
Stopping partway through a cycle does not record it. Leaving the screen or
hiding the browser tab stops practice.

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

## Saved progress

Configuration, current tempo and confirmed best tempo are saved with the
existing settings mechanism: browser storage for guests and account settings
for members. Each preset and starting octave has its own progress. A partial
clean streak is not restored after leaving practice. Curriculum sessions,
spaced-repetition items, XP and account schemas are unchanged.

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
