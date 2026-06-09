// Note metadata and the skill tree, mirroring server/app/content.py.
// (Guest mode needs them locally; logged in, the server's tree wins.)

export const LETTER_COLORS = {
  // Boomwhackers-style: one color per letter name, tuned for contrast on cream
  C: "#d61f3d", D: "#e0660b", E: "#b08e00", F: "#3f9410",
  G: "#0c8a78", A: "#6c47d6", B: "#c22388",
};

const n = (key, letter, midi, pos, posLabel) => ({ key, letter, midi, pos, posLabel });

export const NOTES = {
  treble: {
    60: n("c/4", "C", 60, "line", "ledger line"),
    62: n("d/4", "D", 62, "space", "space below the staff"),
    64: n("e/4", "E", 64, "line", "bottom line"),
    65: n("f/4", "F", 65, "space", "first space"),
    67: n("g/4", "G", 67, "line", "second line"),
    69: n("a/4", "A", 69, "space", "second space"),
    71: n("b/4", "B", 71, "line", "middle line"),
    72: n("c/5", "C", 72, "space", "third space"),
  },
  bass: {
    48: n("c/3", "C", 48, "space", "second space"),
    50: n("d/3", "D", 50, "line", "middle line"),
    52: n("e/3", "E", 52, "space", "third space"),
    53: n("f/3", "F", 53, "line", "fourth line"),
    55: n("g/3", "G", 55, "space", "top space"),
    57: n("a/3", "A", 57, "line", "top line"),
    59: n("b/3", "B", 59, "space", "space above the staff"),
    60: n("c/4", "C", 60, "line", "ledger line above"),
  },
};

export const SKILL_NODES = [
  {
    id: "guide",
    title: "Guide notes",
    blurb: "C and G — your two anchors. Everything else is steps away from them.",
    clef: "treble",
    midis: [60, 67],
  },
  {
    id: "steps",
    title: "C up to G",
    blurb: "Fill in the steps between the guide notes.",
    clef: "treble",
    midis: [60, 62, 64, 65, 67],
  },
  {
    id: "octave",
    title: "The full octave",
    blurb: "C4 to C5 — including the ledger-line C.",
    clef: "treble",
    midis: [60, 62, 64, 65, 67, 69, 71, 72],
  },
  {
    id: "bass-guide",
    title: "Bass guide notes",
    blurb: "F3 — the line the bass clef wraps around — and middle C above.",
    clef: "bass",
    midis: [53, 60],
  },
  {
    id: "bass-steps",
    title: "F up to middle C",
    blurb: "Steps from the F-line up to middle C.",
    clef: "bass",
    midis: [53, 55, 57, 59, 60],
  },
  {
    id: "bass-octave",
    title: "The bass octave",
    blurb: "C3 to middle C — the left hand's home turf.",
    clef: "bass",
    midis: [48, 50, 52, 53, 55, 57, 59, 60],
  },
];

export const itemKey = (clef, midi) => `${clef}:${midi}`;
export const noteMeta = (clef, midi) => ({ ...NOTES[clef][midi], clef });

export const LETTER_TO_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
