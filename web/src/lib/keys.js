// Key signatures, mirroring server/app/keys.py.
//
// A key breaks the assumption every earlier phase could make — that a MIDI
// number spells itself. Pitch class 10 is B flat in F major and A sharp in B
// major, and the accidental a note *has* stops being the accidental the
// renderer must *draw*:
//
//   acc      what the note is      F sharp has acc "#"
//   written  what gets drawn       nothing, if the signature already said so
//
// So the F sharps in a G major scale draw nothing — the signature said it
// once at the front — while the G sharp in A harmonic minor draws one,
// because A minor's signature has nothing to say about G.

const SHARP_LETTER = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const SHARP_ACC = ["", "#", "", "#", "", "", "#", "", "#", "", "#", ""];
const FLAT_LETTER = ["C", "D", "D", "E", "E", "F", "G", "G", "A", "A", "B", "B"];
const FLAT_ACC = ["", "b", "", "b", "", "", "b", "", "b", "", "b", ""];

// The order sharps and flats join a signature — the same order every printed
// score uses, so a reader counts them in a familiar shape.
export const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

const signatureOf = (sharps, flats) => ({
  ...Object.fromEntries(SHARP_ORDER.slice(0, sharps).map(l => [l, "#"])),
  ...Object.fromEntries(FLAT_ORDER.slice(0, flats).map(l => [l, "b"])),
});

const key = (name, vex, tonic, mode, sharps = 0, flats = 0) => ({
  name,
  vex,          // what VexFlow's addKeySignature wants
  tonic,        // pitch class of the tonic
  mode,
  sharps,
  flats,
  signature: signatureOf(sharps, flats),
  prefers: flats ? "flat" : "sharp",
});

export const KEYS = {
  C: key("C major", "C", 0, "major"),
  G: key("G major", "G", 7, "major", 1),
  D: key("D major", "D", 2, "major", 2),
  A: key("A major", "A", 9, "major", 3),
  E: key("E major", "E", 4, "major", 4),
  F: key("F major", "F", 5, "major", 0, 1),
  Bb: key("B flat major", "Bb", 10, "major", 0, 2),
  Eb: key("E flat major", "Eb", 3, "major", 0, 3),
  Am: key("A minor", "Am", 9, "minor"),
  Em: key("E minor", "Em", 4, "minor", 1),
  Dm: key("D minor", "Dm", 2, "minor", 0, 1),
};

export const DEFAULT_KEY = "C";

/**
 * How this note is spelled and drawn in this key. `acc` is the accidental the
 * note has; `written` is the one the renderer must draw, which the signature
 * may already have covered — or may contradict, needing a natural.
 */
export function noteInKey(midi, keyId = DEFAULT_KEY) {
  const k = KEYS[keyId];
  const pc = midi % 12;
  const [letter, acc] = k.prefers === "flat"
    ? [FLAT_LETTER[pc], FLAT_ACC[pc]]
    : [SHARP_LETTER[pc], SHARP_ACC[pc]];

  const fromSignature = k.signature[letter] ?? "";
  let written;
  if (acc === fromSignature) written = "";      // the signature already said this
  else if (acc === "") written = "n";           // the signature says otherwise
  else written = acc;                           // never covered by the signature

  return {
    key: `${letter.toLowerCase()}${acc}/${Math.floor(midi / 12) - 1}`,
    letter,
    acc,
    written,
    midi,
  };
}

export const spell = (midis, keyId = DEFAULT_KEY, clef = "treble") =>
  midis.map(midi => ({ ...noteInKey(midi, keyId), clef }));
