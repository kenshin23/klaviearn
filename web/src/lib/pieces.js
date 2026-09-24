// Authored repertoire, mirroring server/app/pieces.py.
//
// A note range can express a drill but not a piece, so pieces are data rather
// than generated: bars, two hands, fingering, a target tempo. Both pieces sit
// inside one five-finger position per hand, so the fingering is the honest
// position fingering the technique track teaches.
//
// The left hands are simple beginner harmonisations, not transcriptions.

// Fingering in C position: thumb on C in each hand.
const RH_FINGER = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 };
const LH_FINGER = { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1 };

const rh = pairs => pairs.map(([midi, beats]) => ({ midi, beats, finger: RH_FINGER[midi] }));
const lh = pairs => pairs.map(([midi, beats]) => ({ midi, beats, finger: LH_FINGER[midi] }));
const bar = (right, left) => ({ rh: rh(right), lh: lh(left) });

const E = 64, D = 62, C = 60, F = 65, G = 67; // right hand, C4 octave
const C3 = 48, G3 = 55;                       // left hand roots

export const PIECES = {
  "ode-to-joy": {
    title: "Ode to Joy",
    composer: "Beethoven",
    key: "C major",
    beatsPerBar: 4,
    tempo: 96,
    bars: [
      bar([[E, 1], [E, 1], [F, 1], [G, 1]], [[C3, 4]]),
      bar([[G, 1], [F, 1], [E, 1], [D, 1]], [[G3, 4]]),
      bar([[C, 1], [C, 1], [D, 1], [E, 1]], [[C3, 4]]),
      bar([[E, 1.5], [D, 0.5], [D, 2]], [[G3, 4]]),
      bar([[E, 1], [E, 1], [F, 1], [G, 1]], [[C3, 4]]),
      bar([[G, 1], [F, 1], [E, 1], [D, 1]], [[G3, 4]]),
      bar([[C, 1], [C, 1], [D, 1], [E, 1]], [[C3, 4]]),
      bar([[D, 1.5], [C, 0.5], [C, 2]], [[C3, 4]]),
    ],
  },
  "mary-lamb": {
    title: "Mary Had a Little Lamb",
    composer: "Traditional",
    key: "C major",
    beatsPerBar: 4,
    tempo: 88,
    bars: [
      bar([[E, 1], [D, 1], [C, 1], [D, 1]], [[C3, 4]]),
      bar([[E, 1], [E, 1], [E, 2]], [[C3, 4]]),
      bar([[D, 1], [D, 1], [D, 2]], [[G3, 4]]),
      bar([[E, 1], [G, 1], [G, 2]], [[C3, 4]]),
      bar([[E, 1], [D, 1], [C, 1], [D, 1]], [[C3, 4]]),
      bar([[E, 1], [E, 1], [E, 1], [E, 1]], [[C3, 4]]),
      bar([[D, 1], [D, 1], [E, 1], [D, 1]], [[G3, 4]]),
      bar([[C, 4]], [[C3, 4]]),
    ],
  },
};

export const HANDS = {
  "piece-rh": ["rh"],
  "piece-lh": ["lh"],
  "piece-both": ["rh", "lh"],
};

// How fast a bar is asked for depends on how well it is known — the same
// ladder the colours and the ear track use, spent on tempo.
export const TEMPO_STEPS = [0.6, 0.8, 1.0];
const MIN_TEMPO = 50;

export const barKey = (pieceId, barNumber) => `piece:${pieceId}:b${barNumber}`;

export const barTempo = (piece, level) =>
  Math.max(MIN_TEMPO, Math.round(piece.tempo * TEMPO_STEPS[Math.max(0, Math.min(level, 2))]));

export const barBeats = (barData, hand) =>
  (barData[hand] ?? []).reduce((total, note) => total + note.beats, 0);

/** Which notes a take asks for, as evaluator expectations. */
export function expectBar(barData, drill) {
  const events = [];
  for (const hand of HANDS[drill] ?? ["rh"]) {
    let at = 0;
    for (const note of barData[hand] ?? []) {
      if (!note.rest) events.push({ at, midis: [note.midi] });
      at += note.beats;
    }
  }
  return events.sort((a, b) => a.at - b.at);
}

export const pieceItems = pieceId =>
  PIECES[pieceId].bars.map((barData, i) => {
    const piece = PIECES[pieceId];
    return [
      barKey(pieceId, i + 1),
      {
        piece: pieceId,
        title: piece.title,
        composer: piece.composer,
        bar: i + 1,
        bars: piece.bars.length,
        beatsPerBar: piece.beatsPerBar,
        tempo: piece.tempo,
        rh: barData.rh,
        lh: barData.lh,
      },
    ];
  });
