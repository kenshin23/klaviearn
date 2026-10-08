import { KEYS as KEY_TABLE, spell as spellInKey } from "./keys.js";
import { PIECES as PIECES_DATA, barKey as barKeyOf } from "./pieces.js";

// Note metadata and the skill tree, mirroring server/app/content.py.
// (Guest mode needs them locally; logged in, the server's tree wins.)
//
// NOTES stays diatonic on purpose — the interval drill derives its scale from
// it. Accidentals live in noteSpec(), which spells any MIDI number.

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

// One bar of 4/4 each. VexFlow duration codes; "qr" is a quarter rest.
export const RHYTHM_PATTERNS = {
  "r-quarters":  { name: "Four steady quarters",        durations: ["q", "q", "q", "q"] },
  "r-half-2q":   { name: "A half, then two quarters",   durations: ["h", "q", "q"] },
  "r-2q-half":   { name: "Two quarters, then a half",   durations: ["q", "q", "h"] },
  "r-halves":    { name: "Two halves",                  durations: ["h", "h"] },
  "r-whole":     { name: "One whole note",              durations: ["w"] },
  "r-8ths-1":    { name: "Eighth pairs, then quarters", durations: ["8", "8", "8", "8", "q", "q"] },
  "r-8ths-2":    { name: "Eighths in the middle",       durations: ["q", "8", "8", "q", "q"] },
  "r-8ths-3":    { name: "Eighths on two and four",     durations: ["q", "8", "8", "q", "8", "8"] },
  "r-rest-1":    { name: "Rest on beat two",            durations: ["q", "qr", "q", "q"] },
  "r-rest-2":    { name: "Rest on beat three",          durations: ["q", "q", "qr", "q"] },
  "r-rest-3":    { name: "A half, a rest, a quarter",   durations: ["h", "qr", "q"] },
};

// --- Accidentals ------------------------------------------------------------
// Sharp spelling only: every v1 triad spells with sharps, and flats would
// need key context we don't track yet.
const PC_LETTER = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const PC_ACC = ["", "#", "", "#", "", "", "#", "", "#", "", "#", ""];

// `letter` stays the base letter (F# -> "F") so the color scaffold keeps
// working: a sharp shares its natural's color.
export function noteSpec(midi, clef = "treble") {
  const pc = midi % 12;
  const letter = PC_LETTER[pc], acc = PC_ACC[pc];
  return {
    key: `${letter.toLowerCase()}${acc}/${Math.floor(midi / 12) - 1}`,
    letter,
    acc,
    midi,
    clef,
  };
}

// --- Chords -----------------------------------------------------------------
export const CHORD_QUALITIES = { maj: [0, 4, 7], min: [0, 3, 7] };
export const QUALITY_NAMES = { maj: "major", min: "minor" };

export const chordKey = (root, quality) =>
  `chord:${PC_LETTER[root % 12]}${PC_ACC[root % 12]}:${quality}`;

export function chordSpec(root, quality) {
  const midis = CHORD_QUALITIES[quality].map(step => root + step);
  const rootName = `${PC_LETTER[root % 12]}${PC_ACC[root % 12]}`;
  return {
    name: `${rootName} ${QUALITY_NAMES[quality]}`,
    root,
    rootName,
    quality,
    midis,
    notes: midis.map(m => noteSpec(m)),
    clef: "treble",
    chord: true,
  };
}

// --- Ear training -----------------------------------------------------------
// The same octave the reading track covers. Hearing a C and seeing a C are
// different skills, so these are their own SRS items under an "ear:" prefix.
export const EAR_MIDIS = [60, 62, 64, 65, 67, 69, 71, 72];
// Roots the quality drill builds its triads on, randomised per exercise so
// the answer is the sound of the third, not a memorised pitch.
export const EAR_CHORD_ROOTS = [60, 62, 64, 65, 67, 69];

export const earKey = midi => `ear:${midi}`;

// --- Repertoire -------------------------------------------------------------
// Pieces live in their own module; re-exported so the curriculum reads from
// one place.
export { PIECES, TEMPO_STEPS, barKey, barTempo, expectBar, pieceItems } from "./pieces.js";
export { DEFAULT_KEY, KEYS, noteInKey, spell as spellInKey } from "./keys.js";

// --- Technique --------------------------------------------------------------
// Generated from the scale shapes rather than typed out: fifteen notes x two
// hands x five keys is a lot of places to mistype a fingering.

export const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
export const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11, 12];
const FIVE_FINGER = [0, 2, 4, 5, 7];
const TRIAD = { major: [0, 4, 7, 12], minor: [0, 3, 7, 12] };

// Standard one-octave fingering, [ascending, descending-after-the-top].
// F major is the right hand's exception: the thumb tucks under after the
// fourth finger, so it ends on 4 rather than 5.
const RH_SCALE = [[1, 2, 3, 1, 2, 3, 4, 5], [4, 3, 2, 1, 3, 2, 1]];
const RH_SCALE_F = [[1, 2, 3, 4, 1, 2, 3, 4], [3, 2, 1, 4, 3, 2, 1]];
const LH_SCALE = [[5, 4, 3, 2, 1, 3, 2, 1], [2, 3, 1, 2, 3, 4, 5]];
const RH_ARPEGGIO = [[1, 2, 3, 5], [3, 2, 1]];
const LH_ARPEGGIO = [[5, 3, 2, 1], [2, 3, 5]];
const RH_FIVE = [[1, 2, 3, 4, 5], [4, 3, 2, 1]];
const LH_FIVE = [[5, 4, 3, 2, 1], [2, 3, 4, 5]];

/** Up the shape and back down, without sounding the top note twice. */
function upAndDown(tonic, steps, [ascending, descending]) {
  const up = steps.map(step => tonic + step);
  const down = up.slice(0, -1).reverse();
  return { midis: [...up, ...down], fingers: [...ascending, ...descending] };
}

const pattern = (name, hand, keyId, tonic, steps, fingering) => ({
  name,
  hand,
  clef: hand === "rh" ? "treble" : "bass",
  key: keyId,
  ...upAndDown(tonic, steps, fingering),
});

// Tonic each hand starts on: right hand from middle C upwards, left hand in
// the octave below, so both stay near their own staff.
const TONICS = { C: [60, 48], G: [67, 43], D: [62, 50], F: [65, 41], Am: [69, 45] };
const SCALE_SHAPE = { Am: HARMONIC_MINOR };
const TRIAD_SHAPE = { Am: TRIAD.minor };

export const TECHNIQUE_PATTERNS = {
  "5finger:rh": pattern("C position, right hand", "rh", "C", 60, FIVE_FINGER, RH_FIVE),
  "5finger:lh": pattern("C position, left hand", "lh", "C", 48, FIVE_FINGER, LH_FIVE),
};

for (const [keyId, [rhTonic, lhTonic]] of Object.entries(TONICS)) {
  const keyName = KEY_TABLE[keyId].name;
  const steps = SCALE_SHAPE[keyId] ?? MAJOR;
  const rhFingering = keyId === "F" ? RH_SCALE_F : RH_SCALE;
  TECHNIQUE_PATTERNS[`scale:${keyId}:rh`] =
    pattern(`${keyName} scale, right hand`, "rh", keyId, rhTonic, steps, rhFingering);
  TECHNIQUE_PATTERNS[`scale:${keyId}:lh`] =
    pattern(`${keyName} scale, left hand`, "lh", keyId, lhTonic, steps, LH_SCALE);

  const triad = TRIAD_SHAPE[keyId] ?? TRIAD.major;
  TECHNIQUE_PATTERNS[`arp:${keyId}:rh`] =
    pattern(`${keyName} arpeggio, right hand`, "rh", keyId, rhTonic, triad, RH_ARPEGGIO);
  TECHNIQUE_PATTERNS[`arp:${keyId}:lh`] =
    pattern(`${keyName} arpeggio, left hand`, "lh", keyId, lhTonic, triad, LH_ARPEGGIO);
}

export function techniqueSpec(patternId) {
  const p = TECHNIQUE_PATTERNS[patternId];
  return { ...p, pattern: patternId, notes: spellInKey(p.midis, p.key, p.clef) };
}

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
  {
    id: "rhythm-steady",
    kind: "rhythm",
    title: "Steady rhythms",
    blurb: "Quarters, halves, and wholes — tap them against the metronome.",
    patterns: ["r-quarters", "r-half-2q", "r-2q-half", "r-halves", "r-whole"],
  },
  {
    id: "rhythm-eighths",
    kind: "rhythm",
    title: "Eighth notes",
    blurb: "Two taps to a beat.",
    patterns: ["r-8ths-1", "r-8ths-2", "r-8ths-3"],
  },
  {
    id: "rhythm-rests",
    kind: "rhythm",
    title: "Rests",
    blurb: "The notes you don't play matter too.",
    patterns: ["r-rest-1", "r-rest-2", "r-rest-3"],
  },
  {
    id: "intervals",
    kind: "intervals",
    title: "Intervals as shapes",
    blurb: "Stop counting lines — see the distance. Fluent readers read jumps, not letters.",
    sizes: [2, 3, 4, 5],
  },
  {
    id: "grand",
    kind: "grand",
    title: "The grand staff",
    blurb: "Both staves together — middle C is the bridge between your hands.",
  },
  ...Object.entries(PIECES_DATA).map(([pieceId, piece]) => ({
    id: `piece-${pieceId}`,
    kind: "piece",
    piece: pieceId,
    title: piece.title,
    blurb: `${piece.composer} — ${piece.bars.length} bars. `
      + "Practise a bar at a time; the ones you fumble come back.",
  })),
  {
    id: "key-signatures",
    kind: "keys",
    title: "Key signatures",
    blurb: "Count the sharps or flats at the front and name the key — before you play a note of it.",
    keys: ["C", "G", "D", "A", "E", "F", "Bb", "Eb"],
  },
  {
    id: "technique-5finger",
    kind: "technique",
    title: "Five-finger positions",
    blurb: "Five notes under five fingers, up and down, even. Where every hand starts.",
    patterns: ["5finger:rh", "5finger:lh"],
  },
  {
    id: "technique-scales",
    kind: "technique",
    title: "Scales, thumb under",
    blurb: "One octave, hands separately. The thumb tucking under is the whole trick.",
    patterns: ["C", "G", "D", "F", "Am"].flatMap(k => [`scale:${k}:rh`, `scale:${k}:lh`]),
  },
  {
    id: "technique-arpeggios",
    kind: "technique",
    title: "Arpeggios",
    blurb: "The triad spread out under the hand — a chord you play one note at a time.",
    patterns: ["C", "G", "D", "F", "Am"].flatMap(k => [`arp:${k}:rh`, `arp:${k}:lh`]),
  },
  {
    id: "ear-pitch",
    kind: "ear-pitch",
    title: "Match the pitch",
    blurb: "Hear a note, find it on your piano. Nothing on screen — this one is all ear.",
    midis: EAR_MIDIS,
  },
  {
    id: "ear-intervals",
    kind: "ear-intervals",
    title: "Intervals by ear",
    blurb: "Two notes, no notation. Name the distance from the sound alone.",
    sizes: [2, 3, 4, 5],
  },
  {
    id: "ear-chords",
    kind: "ear-chords",
    title: "Major or minor?",
    blurb: "One semitone is the whole difference. Hear a triad and name its quality.",
    qualities: ["maj", "min"],
    roots: EAR_CHORD_ROOTS,
  },
  {
    id: "ear-phrases",
    kind: "ear-phrases",
    title: "Play it back",
    blurb: "Four notes, then your turn — the way you'd pick up a tune by ear.",
    midis: EAR_MIDIS,
  },
  {
    id: "chords",
    kind: "chords",
    title: "Triads",
    blurb: "Three notes, one shape, one sound — play the whole chord at once.",
    clef: "treble",
    // Root position, treble staff. Primary majors, then relative minors,
    // then two that need a black key.
    triads: [
      [60, "maj"], [65, "maj"], [67, "maj"], [69, "min"],
      [62, "min"], [64, "min"], [62, "maj"], [64, "maj"],
    ],
  },
];

export const INTERVAL_NAMES = { 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

export const itemKey = (clef, midi) => `${clef}:${midi}`;
export const noteMeta = (clef, midi) => ({ ...NOTES[clef][midi], clef });
export const nodeItemKeys = node => {
  switch (node.kind) {
    case "rhythm":
      return node.patterns.map(p => `rhythm:${p}`);
    case "intervals":
      return node.sizes.map(s => `int:${s}`);
    case "grand":
      return ["treble", "bass"].flatMap(clef =>
        Object.keys(NOTES[clef]).map(m => `grand:${clef}:${m}`),
      );
    case "chords":
      return node.triads.map(([root, quality]) => chordKey(root, quality));
    // Shared keys: the pitch drill and the phrase drill train the same
    // "which note is that?" recall, so they feed one SRS item per note.
    case "piece":
      return PIECES_DATA[node.piece].bars.map((_, i) => barKeyOf(node.piece, i + 1));
    case "keys":
      return node.keys.map(k => `key:${k}`);
    case "technique":
      return node.patterns.map(p => `tech:${p}`);
    case "ear-pitch":
    case "ear-phrases":
      return node.midis.map(earKey);
    case "ear-intervals":
      return node.sizes.map(s => `ear:int:${s}`);
    case "ear-chords":
      return node.qualities.map(q => `ear:qual:${q}`);
    default:
      return node.midis.map(m => itemKey(node.clef, m));
  }
};

export const LETTER_TO_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
// The five black keys, shown only where a drill can ask for them (chords).
export const SHARP_TO_MIDI = { C: 61, D: 63, F: 66, G: 68, A: 70 };

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
