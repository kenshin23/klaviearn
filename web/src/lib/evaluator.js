// Scoring a performance against what was asked for — pitch and timing.
//
// Until now the only clock in the app lived inside the rhythm drill and could
// grade timing alone, which made every pitch drill a reading test rather than
// a playing test. This is that scoring generalised: it takes what was
// expected and what was played, both in beats, and says what happened to each
// expected event. No audio, no React, no clock — the component owns those, so
// the judgement itself stays testable.
//
//   expected: [{ at, midis? }]   midis absent = rhythm only, any key counts
//   played:   [{ at, midi? }]
//
// Verdicts per expected event:
//   ok      right note, close enough to the beat
//   early   right note, ahead of the beat but inside tolerance
//   late    right note, behind the beat but inside tolerance
//   wrong   something was played there, but not the note asked for
//   missed  nothing was played near that beat at all

export const DEFAULT_TOLERANCE_BEATS = 0.25; // +/-187ms at 80bpm — generous on purpose
const SNAP = 0.6; // within this fraction of tolerance counts as on the beat

const samePitch = (a, b, strictOctave) =>
  strictOctave ? a === b : a % 12 === b % 12;

/** Does a played event satisfy an expected one, ignoring when it happened? */
function pitchFits(expected, play, strictOctave) {
  if (!expected.midis?.length) return true; // rhythm only: any key is a tap
  if (play.midi == null) return false;
  return expected.midis.some(m => samePitch(m, play.midi, strictOctave));
}

/**
 * Match each expected event to at most one played event and judge it.
 *
 * Matching prefers a play that is both near in time AND the right pitch over
 * one that is merely nearer — otherwise a stray note next to the beat would
 * consume the slot and report "wrong" for a passage that was played correctly.
 */
export function score(expected, played, options = {}) {
  const {
    tolerance = DEFAULT_TOLERANCE_BEATS,
    strictOctave = false,
  } = options;

  const unused = played.map((play, i) => ({ ...play, i }));
  const take = entry => {
    unused.splice(unused.indexOf(entry), 1);
    return entry;
  };

  const verdicts = expected.map(event => {
    const inRange = unused.filter(play => Math.abs(play.at - event.at) <= tolerance);
    const fitting = inRange.filter(play => pitchFits(event, play, strictOctave));
    const nearest = list =>
      list.reduce(
        (best, play) =>
          best === null || Math.abs(play.at - event.at) < Math.abs(best.at - event.at)
            ? play
            : best,
        null,
      );

    const match = nearest(fitting) ?? nearest(inRange);
    if (match === null) return { verdict: "missed", off: null, played: null };

    take(match);
    const off = match.at - event.at;
    if (!pitchFits(event, match, strictOctave)) {
      return { verdict: "wrong", off, played: match.midi ?? null };
    }
    if (Math.abs(off) <= tolerance * SNAP) {
      return { verdict: "ok", off, played: match.midi ?? null };
    }
    return { verdict: off < 0 ? "early" : "late", off, played: match.midi ?? null };
  });

  const extras = unused.length;
  return {
    verdicts,
    extras,
    // A take passes when every expected event was played as the right note at
    // roughly the right moment, and nothing else was played.
    hit: extras === 0 && verdicts.every(v => v.verdict !== "missed" && v.verdict !== "wrong"),
  };
}

/** Beat positions of the notes in a duration list, skipping rests. */
const BEATS = { q: 1, h: 2, w: 4, 8: 0.5 };

export function onsetsOf(durations) {
  let at = 0;
  const onsets = [];
  for (const d of durations) {
    if (!d.endsWith("r")) onsets.push(at);
    at += BEATS[d.replace("r", "")];
  }
  return { onsets, totalBeats: at };
}

/** Rhythm drill: beats to tap, no pitch asked for. */
export const expectTaps = durations =>
  onsetsOf(durations).onsets.map(at => ({ at }));

/** Pitched drill: one note per beat, in order. */
export const expectNotes = (midis, { beatsPerNote = 1 } = {}) =>
  midis.map((midi, i) => ({ at: i * beatsPerNote, midis: [midi] }));
