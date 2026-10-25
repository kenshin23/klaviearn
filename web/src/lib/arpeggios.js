import { expectNotes, score } from "./evaluator.js";

// Presets are data, not a special case in the trainer: each step gives a
// semitone offset from baseMidi and its written staff spelling/fingering.
export const ARPEGGIO_PRESETS = [
  {
    id: "db-major-lh",
    name: "Db major",
    hand: "lh",
    clef: "bass",
    baseMidi: 37,
    steps: [
      { offset: 0, finger: 5, letter: "D", accidental: "b" },
      { offset: 7, finger: 3, letter: "A", accidental: "b" },
      { offset: 12, finger: 2, letter: "D", accidental: "b" },
      { offset: 16, finger: 1, letter: "F", accidental: "" },
      { offset: 19, finger: 4, letter: "A", accidental: "b" },
      { offset: 24, finger: 2, letter: "D", accidental: "b" },
      { offset: 28, finger: 1, letter: "F", accidental: "" },
      { offset: 31, finger: 2, letter: "A", accidental: "b" },
      { offset: 31, finger: 2, letter: "A", accidental: "b" },
      { offset: 28, finger: 1, letter: "F", accidental: "" },
      { offset: 24, finger: 2, letter: "D", accidental: "b" },
      { offset: 19, finger: 4, letter: "A", accidental: "b" },
      { offset: 16, finger: 1, letter: "F", accidental: "" },
      { offset: 12, finger: 2, letter: "D", accidental: "b" },
      { offset: 7, finger: 3, letter: "A", accidental: "b" },
      { offset: 0, finger: 5, letter: "D", accidental: "b" },
    ],
  },
];

const MIDI_MIN = 0;
const MIDI_MAX = 127;
const LETTERS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
const ACCIDENTALS = new Set(["", "b", "#"]);

function validatePreset(preset, octave) {
  if (!preset || typeof preset !== "object"
    || typeof preset.id !== "string" || !preset.id
    || typeof preset.name !== "string" || !preset.name
    || !["lh", "rh"].includes(preset.hand)
    || !["bass", "treble"].includes(preset.clef)
    || !Number.isInteger(preset.baseMidi) || preset.baseMidi < MIDI_MIN || preset.baseMidi > MIDI_MAX
    || !Array.isArray(preset.steps) || preset.steps.length === 0) {
    throw new TypeError("Invalid arpeggio preset");
  }
  if (!Number.isInteger(octave) || octave < 0 || octave > 9) {
    throw new RangeError("Octave must be an integer from 0 to 9");
  }
  const octaveOffset = (octave - 2) * 12;
  for (const step of preset.steps) {
    if (!step || !Number.isInteger(step.offset) || step.offset < 0
      || !Number.isInteger(step.finger) || step.finger < 1 || step.finger > 5
      || !LETTERS.has(step.letter) || !ACCIDENTALS.has(step.accidental)) {
      throw new TypeError("Invalid arpeggio step");
    }
    const midi = preset.baseMidi + octaveOffset + step.offset;
    if (midi < MIDI_MIN || midi > MIDI_MAX) {
      throw new RangeError("Arpeggio MIDI must be from 0 to 127");
    }
  }
}

/** Build a staff-ready exercise; octave names the starting Db octave. */
export function makeArpeggio(preset = ARPEGGIO_PRESETS[0], octave = 2) {
  validatePreset(preset, octave);
  const octaveOffset = (octave - 2) * 12;
  const midis = preset.steps.map(step => preset.baseMidi + octaveOffset + step.offset);
  const notes = preset.steps.map((step, i) => {
    const midi = midis[i];
    const noteOctave = Math.floor(midi / 12) - 1;
    return {
      key: `${step.letter.toLowerCase()}/${noteOctave}`,
      letter: step.letter,
      acc: step.accidental,
      written: step.accidental || undefined,
      midi,
      clef: preset.clef,
    };
  });
  return {
    id: preset.id,
    name: preset.name,
    hand: preset.hand,
    clef: preset.clef,
    notes,
    midis,
    fingers: preset.steps.map(step => step.finger),
  };
}

/** Sixteen attacks occupy one beat, including the repeated apex. */
export const expectedCycle = exercise =>
  expectNotes(exercise.midis, { beatsPerNote: 1 / exercise.midis.length });

/** Strict pitch, octave and attack-count grading for one complete cycle. */
export function scoreCycle(exercise, played) {
  const expected = expectedCycle(exercise);
  return score(expected, played, {
    strictOctave: true,
    tolerance: 0.35 / exercise.midis.length,
  });
}

export function speedProgress(saved = {}) {
  const bpm = Number.isFinite(saved?.bpm) ? Math.min(120, Math.max(5, saved.bpm)) : 20;
  const bestBpm = Number.isFinite(saved?.bestBpm)
    ? Math.min(120, Math.max(0, saved.bestBpm))
    : 0;
  return { bpm, bestBpm, streak: 0 };
}

export function advanceSpeed(progress, hit, { stepBpm = 1, cleanTarget = 5 } = {}) {
  const current = speedProgress(progress);
  const currentStreak = Number.isFinite(progress?.streak)
    ? Math.max(0, Math.floor(progress.streak))
    : 0;
  const step = Number.isFinite(stepBpm) ? Math.max(0, stepBpm) : 1;
  const target = Number.isFinite(cleanTarget) ? Math.max(1, Math.floor(cleanTarget)) : 5;
  if (!hit) return { ...current, streak: 0 };
  const streak = currentStreak + 1;
  if (streak >= target) {
    return {
      bpm: Math.min(120, current.bpm + step),
      bestBpm: Math.max(current.bestBpm, current.bpm),
      streak: 0,
    };
  }
  return { ...current, streak };
}

export const speedKey = (presetId, octave) => `${presetId}:${octave}`;
