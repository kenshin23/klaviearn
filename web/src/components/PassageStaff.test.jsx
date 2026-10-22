import { render } from "@testing-library/react";
import PassageStaff from "./PassageStaff.jsx";
import { PIECES, pieceItems } from "../lib/pieces.js";
import { LETTER_COLORS } from "../lib/notes.js";
import {
  annotations, expectDescribedForScreenReaders, expectScalesWithItsCard,
  headColors, noteheads, staveCount,
} from "../test/staff.js";

const barOf = (pieceId, n) => pieceItems(pieceId)[n - 1][1];
const draw = (pieceId, n, hands = ["rh", "lh"], showFingers = false) =>
  render(
    <PassageStaff exercise={barOf(pieceId, n)} hands={hands} showFingers={showFingers} />,
  ).container;

describe("the bar", () => {
  it("braces two staves together", () => {
    expect(staveCount(draw("ode-to-joy", 1))).toBe(2);
  });

  it("draws every note of both hands", () => {
    // Bar 1 of Ode to Joy is four right-hand quarters over one whole note.
    expect(noteheads(draw("ode-to-joy", 1))).toHaveLength(5);
  });

  it("draws a bar with a dotted rhythm", () => {
    // Bar 4 is a dotted quarter, an eighth and a half, plus the bass.
    expect(noteheads(draw("ode-to-joy", 4))).toHaveLength(4);
  });

  it("draws every bar of every piece without error", () => {
    for (const [pieceId, piece] of Object.entries(PIECES)) {
      for (let n = 1; n <= piece.bars.length; n++) {
        const expected = piece.bars[n - 1].rh.length + piece.bars[n - 1].lh.length;
        expect(noteheads(draw(pieceId, n)), `${pieceId} bar ${n}`).toHaveLength(expected);
      }
    }
  });

  it("redraws when the bar changes", () => {
    const { container, rerender } = render(
      <PassageStaff exercise={barOf("ode-to-joy", 1)} hands={["rh"]} showFingers={false} />,
    );
    expect(noteheads(container)).toHaveLength(5);
    rerender(<PassageStaff exercise={barOf("ode-to-joy", 4)} hands={["rh"]} showFingers={false} />);
    expect(noteheads(container)).toHaveLength(4);
  });
});

describe("showing which hand you are playing", () => {
  it("draws both hands whichever one is being practised", () => {
    // Reading which staff a note sits on is part of playing from a score.
    expect(noteheads(draw("ode-to-joy", 1, ["rh"]))).toHaveLength(5);
    expect(noteheads(draw("ode-to-joy", 1, ["lh"]))).toHaveLength(5);
  });

  it("inks the hand you are playing and dims the other", () => {
    const rhOnly = headColors(draw("ode-to-joy", 1, ["rh"], true));
    // Four right-hand notes carry their letter colour; the bass note does not.
    expect(rhOnly.slice(0, 4)).toEqual([
      LETTER_COLORS.E, LETTER_COLORS.E, LETTER_COLORS.F, LETTER_COLORS.G,
    ]);
    expect(rhOnly[4]).not.toBe(LETTER_COLORS.C);
  });

  it("swaps which hand is inked for the left-hand drill", () => {
    const lhOnly = headColors(draw("ode-to-joy", 1, ["lh"], true));
    expect(lhOnly[4]).toBe(LETTER_COLORS.C);
    expect(lhOnly[0]).not.toBe(LETTER_COLORS.E);
  });

  it("inks both when playing hands together", () => {
    const both = headColors(draw("ode-to-joy", 1, ["rh", "lh"], true));
    expect(both[0]).toBe(LETTER_COLORS.E);
    expect(both[4]).toBe(LETTER_COLORS.C);
  });
});

describe("fingering as a scaffold", () => {
  it("prints the fingering of the hand being played", () => {
    expect(annotations(draw("ode-to-joy", 1, ["rh"], true))).toEqual(["3", "3", "4", "5"]);
  });

  it("prints the left hand's own fingering", () => {
    expect(annotations(draw("ode-to-joy", 1, ["lh"], true))).toEqual(["5"]);
  });

  it("prints both when playing hands together", () => {
    expect(annotations(draw("ode-to-joy", 1, ["rh", "lh"], true)))
      .toEqual(["3", "3", "4", "5", "5"]);
  });

  it("withdraws once the bar is under the hand", () => {
    expect(annotations(draw("ode-to-joy", 1, ["rh", "lh"], false))).toEqual([]);
  });
});

describe("accessibility", () => {
  it("names the piece and where you are in it", () => {
    expectDescribedForScreenReaders(draw("ode-to-joy", 4), /Ode to Joy, bar 4 of 8/);
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw("mary-lamb", 1), { width: 320, height: 250 });
  });
});
