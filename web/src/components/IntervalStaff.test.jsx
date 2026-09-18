import { render } from "@testing-library/react";
import IntervalStaff from "./IntervalStaff.jsx";
import { NOTES, noteMeta } from "../lib/notes.js";
import {
  annotations, expectDescribedForScreenReaders, expectScalesWithItsCard,
  headColors, noteheads,
} from "../test/staff.js";

const scale = Object.keys(NOTES.treble).map(Number).sort((a, b) => a - b);
const draw = (lowMidi, highMidi) =>
  render(<IntervalStaff notes={[noteMeta("treble", lowMidi), noteMeta("treble", highMidi)]} />)
    .container;

describe("the interval", () => {
  it("draws the two notes side by side", () => {
    expect(noteheads(draw(60, 64))).toHaveLength(2);
  });

  it("draws every interval size the drill uses", () => {
    for (const size of [2, 3, 4, 5]) {
      expect(noteheads(draw(scale[0], scale[size - 1])), `a ${size}`).toHaveLength(2);
    }
  });

  it("separates the noteheads further as the interval widens", () => {
    const gap = c => {
      const ys = noteheads(c).map(h =>
        Number(h.querySelector("path").getAttribute("d").match(/M[\d.]+ ([\d.]+)/)[1]));
      return Math.abs(ys[0] - ys[1]);
    };
    expect(gap(draw(scale[0], scale[4]))).toBeGreaterThan(gap(draw(scale[0], scale[1])));
  });
});

describe("deliberately unscaffolded", () => {
  // This drill trains seeing the DISTANCE. Letters would turn it into
  // arithmetic and colours would let you name the notes instead of the gap,
  // so neither is offered at any level.
  it("shows no letters", () => {
    expect(annotations(draw(60, 64))).toEqual([]);
  });

  it("leaves the noteheads uncoloured", () => {
    expect(headColors(draw(60, 64))).toEqual([null, null]);
  });

  it("takes no scaffold props at all", () => {
    expect(IntervalStaff.length).toBe(1); // one props object
    const c = render(
      <IntervalStaff notes={[noteMeta("treble", 60), noteMeta("treble", 64)]}
        showLetter showColor />,
    ).container;
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([null, null]);
  });
});

describe("accessibility", () => {
  it("describes itself for screen readers", () => {
    expectDescribedForScreenReaders(draw(60, 64), /Two notes forming an interval/);
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw(60, 64), { width: 280, height: 150 });
  });
});
