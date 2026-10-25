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

export const NOTE_BPM_MIN = 20;
export const NOTE_BPM_MAX = 1800;
export const DEFAULT_NOTE_BPM = 20;
export const DEFAULT_STEP_BPM = 4;

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

/** All attacks in the exercise occupy one beat. */
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

/** Summarize a cycle without changing the evaluator's verdicts or hit flag. */
export function summarizeCycle(result) {
  const verdicts = Array.isArray(result?.verdicts) ? result.verdicts : [];
  const correct = verdicts.filter(({ verdict }) =>
    verdict === "ok" || verdict === "early" || verdict === "late").length;
  const total = verdicts.length;
  return {
    correct,
    total,
    percent: total ? Math.round(correct / total * 100) : 0,
    wrong: verdicts.filter(({ verdict }) => verdict === "wrong").length,
    missed: verdicts.filter(({ verdict }) => verdict === "missed").length,
    extras: Number.isFinite(result?.extras) ? result.extras : 0,
  };
}

export function speedProgress(saved = {}) {
  const bpm = Number.isFinite(saved?.bpm)
    ? Math.min(NOTE_BPM_MAX, Math.max(NOTE_BPM_MIN, saved.bpm))
    : DEFAULT_NOTE_BPM;
  const bestBpm = Number.isFinite(saved?.bestBpm)
    ? Math.min(NOTE_BPM_MAX, Math.max(0, saved.bestBpm))
    : 0;
  return { bpm, bestBpm, streak: 0 };
}

export function advanceSpeed(progress, hit, { stepBpm = DEFAULT_STEP_BPM, cleanTarget = 5 } = {}) {
  const current = speedProgress(progress);
  const currentStreak = Number.isFinite(progress?.streak)
    ? Math.max(0, Math.floor(progress.streak))
    : 0;
  const step = Number.isFinite(stepBpm) ? Math.min(60, Math.max(0.5, stepBpm)) : DEFAULT_STEP_BPM;
  const target = Number.isFinite(cleanTarget) ? Math.min(20, Math.max(1, Math.floor(cleanTarget))) : 5;
  if (!hit) return { ...current, streak: 0 };
  const streak = currentStreak + 1;
  if (streak >= target) {
    return {
      bpm: Math.min(NOTE_BPM_MAX, current.bpm + step),
      bestBpm: Math.max(current.bestBpm, current.bpm),
      streak: 0,
    };
  }
  return { ...current, streak };
}

export const speedKey = (presetId, octave) => `${presetId}:${octave}`;

/** Convert per-note tempo into the arpeggio cycle clock's internal beat tempo. */
export function tempoForExercise(noteBpm, exercise) {
  const noteCount = exercise?.midis?.length;
  if (!Number.isFinite(noteCount) || noteCount <= 0) {
    throw new RangeError("Exercise must contain at least one note");
  }
  const normalizedNoteBpm = Number.isFinite(noteBpm)
    ? Math.min(NOTE_BPM_MAX, Math.max(NOTE_BPM_MIN, noteBpm))
    : DEFAULT_NOTE_BPM;
  return {
    noteBpm: normalizedNoteBpm,
    cycleBpm: normalizedNoteBpm / noteCount,
    cycleSeconds: 60 * noteCount / normalizedNoteBpm,
    noteSeconds: 60 / normalizedNoteBpm,
    countInSeconds: 4 * 60 / normalizedNoteBpm,
  };
}

const isRecord = value => value && typeof value === "object" && !Array.isArray(value);
const boundedNumber = (value, fallback, min, max) => Number.isFinite(value)
  ? Math.min(max, Math.max(min, value)) : fallback;

/** Normalize saved practice settings and migrate legacy per-cycle progress once. */
export function normalizePracticeSettings(raw = {}) {
  const source = isRecord(raw) ? raw : {};
  const migrateLegacy = !Object.prototype.hasOwnProperty.call(source, "tempoUnit");
  const presetId = ARPEGGIO_PRESETS.some(preset => preset.id === source.presetId)
    ? source.presetId : ARPEGGIO_PRESETS[0].id;
  const octave = Number.isFinite(source.octave)
    ? Math.min(4, Math.max(1, Math.round(source.octave))) : 2;
  const stepBpm = migrateLegacy
    ? DEFAULT_STEP_BPM
    : boundedNumber(source.stepBpm, DEFAULT_STEP_BPM, 0.5, 60);
  const cleanTarget = Number.isFinite(source.cleanTarget)
    ? Math.min(20, Math.max(1, Math.floor(source.cleanTarget))) : 5;
  const clickMode = ["beat", "four", "notes"].includes(source.clickMode) ? source.clickMode : "notes";
  const savedProgress = isRecord(source.progress) ? source.progress : {};
  const progress = { ...savedProgress };

  for (const preset of ARPEGGIO_PRESETS) {
    for (let presetOctave = 1; presetOctave <= 4; presetOctave++) {
      const key = speedKey(preset.id, presetOctave);
      const saved = savedProgress[key];
      if (!isRecord(saved)) continue;
      if (migrateLegacy) {
        const oldBpm = boundedNumber(saved.bpm, 20, 5, 120);
        const oldBestBpm = boundedNumber(saved.bestBpm, 0, 0, 120);
        progress[key] = {
          ...saved,
          bpm: oldBpm * preset.steps.length,
          bestBpm: oldBestBpm * preset.steps.length,
        };
      } else {
        const normalized = speedProgress(saved);
        progress[key] = { ...saved, bpm: normalized.bpm, bestBpm: normalized.bestBpm };
      }
    }
  }

  return { presetId, octave, stepBpm, cleanTarget, clickMode, tempoUnit: "note-bpm", progress };
}
