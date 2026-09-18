import { render } from "@testing-library/react";
import TechniqueStaff from "./TechniqueStaff.jsx";
import { LETTER_COLORS, techniqueSpec } from "../lib/notes.js";
import {
  annotations, clefShape, expectDescribedForScreenReaders, expectScalesWithItsCard,
  headColors, noteheads,
} from "../test/staff.js";

const draw = (pattern, props = {}) =>
  render(
    <TechniqueStaff exercise={techniqueSpec(pattern)} showFingers={false} showColor={false} {...props} />,
  ).container;

describe("the pattern", () => {
  it("draws every note of it", () => {
    expect(noteheads(draw("5finger:rh"))).toHaveLength(9);
    expect(noteheads(draw("scale:C:rh"))).toHaveLength(15);
    expect(noteheads(draw("arp:C:rh"))).toHaveLength(7);
  });

  it("reads the left hand from the bass clef and the right from the treble", () => {
    expect(clefShape(draw("scale:C:rh"))).not.toBe(clefShape(draw("scale:C:lh")));
  });

  it("redraws cleanly when the pattern changes", () => {
    const { container, rerender } = render(
      <TechniqueStaff exercise={techniqueSpec("arp:C:rh")} showFingers showColor={false} />,
    );
    expect(noteheads(container)).toHaveLength(7);
    rerender(<TechniqueStaff exercise={techniqueSpec("scale:C:rh")} showFingers showColor={false} />);
    expect(noteheads(container)).toHaveLength(15);
  });
});

describe("fingering as a scaffold", () => {
  it("prints a finger number over every note while the pattern is new", () => {
    expect(annotations(draw("5finger:rh", { showFingers: true })))
      .toEqual(["1", "2", "3", "4", "5", "4", "3", "2", "1"]);
  });

  it("prints the left-hand fingering, which is not the right hand's", () => {
    expect(annotations(draw("5finger:lh", { showFingers: true })))
      .toEqual(["5", "4", "3", "2", "1", "2", "3", "4", "5"]);
  });

  it("shows the thumb tucking under in a scale", () => {
    const fingers = annotations(draw("scale:C:rh", { showFingers: true }));
    expect(fingers.slice(0, 8)).toEqual(["1", "2", "3", "1", "2", "3", "4", "5"]);
  });

  it("withdraws the fingering once the pattern is under the hand", () => {
    expect(annotations(draw("scale:C:rh", { showFingers: false }))).toEqual([]);
  });

  it("colours the noteheads at the same levels the fingering shows", () => {
    const colored = headColors(draw("arp:C:rh", { showColor: true }));
    expect(colored[0]).toBe(LETTER_COLORS.C);
    expect(headColors(draw("arp:C:rh"))[0]).toBeNull();
  });
});

describe("accessibility", () => {
  it("tells a screen reader the pattern and its fingering", () => {
    expectDescribedForScreenReaders(draw("arp:C:lh"), /C major arpeggio, left hand, 7 notes/);
    expectDescribedForScreenReaders(draw("arp:C:lh"), /fingering 5 3 2 1 2 3 5/);
  });

  it("scales with its card, widening for longer patterns", () => {
    expectScalesWithItsCard(draw("arp:C:rh"), { width: 320, height: 150 });
    expectScalesWithItsCard(draw("scale:C:rh"), { width: 44 * 15, height: 150 });
  });
});
