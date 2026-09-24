import {
  HANDS, PIECES, TEMPO_STEPS, barBeats, barKey, barTempo, expectBar, pieceItems,
} from "./pieces.js";

const ode = PIECES["ode-to-joy"];
const barOf = (pieceId, n) => PIECES[pieceId].bars[n - 1];

describe("the pieces themselves", () => {
  it("ships repertoire with a title and a composer", () => {
    for (const [id, piece] of Object.entries(PIECES)) {
      expect(piece.title, id).toBeTruthy();
      expect(piece.composer, id).toBeTruthy();
      expect(piece.bars.length, id).toBeGreaterThan(0);
    }
  });

  it("fills every bar to its time signature in both hands", () => {
    for (const [id, piece] of Object.entries(PIECES)) {
      piece.bars.forEach((bar, i) => {
        for (const hand of ["rh", "lh"]) {
          expect(barBeats(bar, hand), `${id} bar ${i + 1} ${hand}`).toBe(piece.beatsPerBar);
        }
      });
    }
  });

  it("fingers every note from a five-finger position", () => {
    for (const [id, piece] of Object.entries(PIECES)) {
      for (const hand of ["rh", "lh"]) {
        const midis = piece.bars.flatMap(b => b[hand].map(n => n.midi));
        expect(Math.max(...midis) - Math.min(...midis), `${id} ${hand}`).toBeLessThanOrEqual(7);
        for (const bar of piece.bars) {
          for (const note of bar[hand]) expect(note.finger).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("keeps the hands out of each other's way", () => {
    for (const [id, piece] of Object.entries(PIECES)) {
      const rh = piece.bars.flatMap(b => b.rh.map(n => n.midi));
      const lh = piece.bars.flatMap(b => b.lh.map(n => n.midi));
      expect(Math.min(...rh), id).toBeGreaterThan(Math.max(...lh));
    }
  });
});

describe("one item per bar", () => {
  it("keys a bar by piece and number", () => {
    expect(barKey("ode-to-joy", 3)).toBe("piece:ode-to-joy:b3");
  });

  it("gives every bar its own key, inside the schema's 32 characters", () => {
    for (const [id, piece] of Object.entries(PIECES)) {
      const keys = pieceItems(id).map(([key]) => key);
      expect(new Set(keys).size).toBe(piece.bars.length);
      for (const key of keys) expect(key.length, key).toBeLessThanOrEqual(32);
    }
  });

  it("carries what the renderer and the take both need", () => {
    const [, meta] = pieceItems("ode-to-joy")[3];
    expect(meta).toMatchObject({
      piece: "ode-to-joy", title: "Ode to Joy", bar: 4, bars: 8, beatsPerBar: 4, tempo: 96,
    });
    expect(meta.rh.length).toBeGreaterThan(0);
    expect(meta.lh.length).toBeGreaterThan(0);
  });
});

describe("the tempo ladder", () => {
  it("rises as the bar becomes known", () => {
    const [slow, middling, full] = [0, 1, 2].map(level => barTempo(ode, level));
    expect(slow).toBeLessThan(middling);
    expect(middling).toBeLessThan(full);
  });

  it("reaches the piece's own tempo once the bar is mastered", () => {
    expect(barTempo(ode, 2)).toBe(ode.tempo);
  });

  it("starts a new bar well below tempo", () => {
    expect(barTempo(ode, 0)).toBeLessThan(ode.tempo);
    expect(TEMPO_STEPS[0]).toBeLessThan(1);
  });

  it("never drops below a tempo you can still feel a pulse at", () => {
    expect(barTempo({ tempo: 40 }, 0)).toBeGreaterThanOrEqual(50);
  });

  it("clamps a level outside the ladder", () => {
    expect(barTempo(ode, 9)).toBe(barTempo(ode, 2));
    expect(barTempo(ode, -1)).toBe(barTempo(ode, 0));
  });
});

describe("what a take asks for", () => {
  it("asks for one hand on a one-hand drill", () => {
    const bar = barOf("ode-to-joy", 1);
    expect(expectBar(bar, "piece-rh")).toEqual([
      { at: 0, midis: [64] }, { at: 1, midis: [64] },
      { at: 2, midis: [65] }, { at: 3, midis: [67] },
    ]);
    expect(expectBar(bar, "piece-lh")).toEqual([{ at: 0, midis: [48] }]);
  });

  it("asks for both hands together, as separate events on the same beat", () => {
    const events = expectBar(barOf("ode-to-joy", 1), "piece-both");
    expect(events).toHaveLength(5);
    const onBeatZero = events.filter(e => e.at === 0);
    expect(onBeatZero.map(e => e.midis[0]).sort((a, b) => a - b)).toEqual([48, 64]);
  });

  it("places a dotted rhythm on the right beats", () => {
    // Bar 4 is a dotted quarter, an eighth, then a half.
    expect(expectBar(barOf("ode-to-joy", 4), "piece-rh").map(e => e.at)).toEqual([0, 1.5, 2]);
  });

  it("returns events in time order", () => {
    for (const [id, piece] of Object.entries(PIECES)) {
      for (let n = 1; n <= piece.bars.length; n++) {
        const at = expectBar(barOf(id, n), "piece-both").map(e => e.at);
        expect(at, `${id} bar ${n}`).toEqual([...at].sort((a, b) => a - b));
      }
    }
  });

  it("skips rests, which are time but not notes", () => {
    const withRest = { rh: [{ midi: 60, beats: 1 }, { rest: true, beats: 1 }, { midi: 64, beats: 2 }], lh: [] };
    expect(expectBar(withRest, "piece-rh")).toEqual([
      { at: 0, midis: [60] }, { at: 2, midis: [64] },
    ]);
  });

  it("maps every drill to the hands it means", () => {
    expect(HANDS["piece-rh"]).toEqual(["rh"]);
    expect(HANDS["piece-lh"]).toEqual(["lh"]);
    expect(HANDS["piece-both"]).toEqual(["rh", "lh"]);
  });
});
