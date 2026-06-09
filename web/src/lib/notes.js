// The note universe for Phase 1: C4–C5 on the treble staff.

export const LETTER_COLORS = {
  // Boomwhackers-style: one color per letter name, tuned for contrast on cream
  C: "#d61f3d", D: "#e0660b", E: "#b08e00", F: "#3f9410",
  G: "#0c8a78", A: "#6c47d6", B: "#c22388",
};

// pos: where the notehead sits — the thing the line/space drill trains.
export const NOTES = [
  { key: "c/4", letter: "C", midi: 60, pos: "line", posLabel: "ledger line" },
  { key: "d/4", letter: "D", midi: 62, pos: "space", posLabel: "space below the staff" },
  { key: "e/4", letter: "E", midi: 64, pos: "line", posLabel: "bottom line" },
  { key: "f/4", letter: "F", midi: 65, pos: "space", posLabel: "first space" },
  { key: "g/4", letter: "G", midi: 67, pos: "line", posLabel: "second line" },
  { key: "a/4", letter: "A", midi: 69, pos: "space", posLabel: "second space" },
  { key: "b/4", letter: "B", midi: 71, pos: "line", posLabel: "middle line" },
  { key: "c/5", letter: "C", midi: 72, pos: "space", posLabel: "third space" },
];

export const NOTE_BY_MIDI = Object.fromEntries(NOTES.map(n => [n.midi, n]));

export const SKILL_NODES = [
  {
    id: "guide",
    title: "Guide notes",
    blurb: "C and G — your two anchors. Everything else is steps away from them.",
    midis: [60, 67],
  },
  {
    id: "steps",
    title: "C up to G",
    blurb: "Fill in the steps between the guide notes.",
    midis: [60, 62, 64, 65, 67],
  },
  {
    id: "octave",
    title: "The full octave",
    blurb: "C4 to C5 — including the ledger-line C.",
    midis: [60, 62, 64, 65, 67, 69, 71, 72],
  },
];

export const LETTER_TO_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
