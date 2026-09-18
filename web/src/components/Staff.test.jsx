import { render } from "@testing-library/react";
import Staff from "./Staff.jsx";
import { LETTER_COLORS, noteMeta } from "../lib/notes.js";
import { setLocale } from "../lib/i18n.js";
import {
  annotations, clefShape, expectDescribedForScreenReaders, expectScalesWithItsCard,
  glyphCount, headColors, noteheads,
} from "../test/staff.js";

const draw = (clef, midi, props = {}) =>
  render(<Staff exercise={noteMeta(clef, midi)} showLetter={false} showColor={false} {...props} />)
    .container;

beforeEach(() => setLocale("en", "letters"));

describe("the note itself", () => {
  it("draws exactly one notehead", () => {
    expect(noteheads(draw("treble", 67))).toHaveLength(1);
  });

  it("redraws when the exercise changes", () => {
    const { container, rerender } = render(
      <Staff exercise={noteMeta("treble", 60)} showLetter showColor={false} />,
    );
    expect(annotations(container)).toEqual(["C"]);
    rerender(<Staff exercise={noteMeta("treble", 67)} showLetter showColor={false} />);
    expect(annotations(container)).toEqual(["G"]);
    expect(noteheads(container)).toHaveLength(1, "the old note is cleared, not stacked");
  });
});

describe("the scaffold levels", () => {
  it("L0 draws the letter inside a coloured notehead", () => {
    const c = draw("treble", 67, { showLetter: true, showColor: true });
    expect(annotations(c)).toEqual(["G"]);
    expect(headColors(c)).toEqual([LETTER_COLORS.G]);
  });

  it("L1 keeps the colour and drops the letter", () => {
    const c = draw("treble", 67, { showLetter: false, showColor: true });
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([LETTER_COLORS.G]);
  });

  it("L2 draws plain notation — no letter, no colour", () => {
    const c = draw("treble", 67, { showLetter: false, showColor: false });
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([null]);
  });

  it("gives each letter its own colour, so colour never means two things", () => {
    const seen = new Set();
    for (const [midi, letter] of [[60, "C"], [62, "D"], [64, "E"], [65, "F"], [67, "G"], [69, "A"], [71, "B"]]) {
      const [colour] = headColors(draw("treble", midi, { showColor: true }));
      expect(colour).toBe(LETTER_COLORS[letter]);
      seen.add(colour);
    }
    expect(seen.size).toBe(7);
  });

  it("labels the note in solfège when that is the setting", () => {
    setLocale("es", "solfege");
    expect(annotations(draw("treble", 67, { showLetter: true }))).toEqual(["Sol"]);
  });
});

describe("reading the clef", () => {
  it("draws a different glyph for bass than for treble", () => {
    expect(clefShape(draw("treble", 60))).not.toBe(clefShape(draw("bass", 60)));
  });

  it("names the clef for screen readers", () => {
    expectDescribedForScreenReaders(draw("treble", 60), /treble staff/);
    expectDescribedForScreenReaders(draw("bass", 53), /bass staff/);
  });

  it("puts middle C in a different place on each clef", () => {
    const y = c => noteheads(c)[0].querySelector("path").getAttribute("d").match(/M[\d.]+ ([\d.]+)/)[1];
    expect(y(draw("treble", 60))).not.toBe(y(draw("bass", 60)));
  });
});

describe("ledger lines", () => {
  it("draws one for middle C, which sits below the treble staff", () => {
    // E4 is the bottom line and needs no ledger; C4 sits below it and does.
    expect(glyphCount(draw("treble", 60))).toBe(glyphCount(draw("treble", 64)) + 1);
  });

  it("draws one for middle C on the bass staff too, where it sits above", () => {
    expect(glyphCount(draw("bass", 60))).toBe(glyphCount(draw("bass", 57)) + 1);
  });
});

describe("the sizing contract", () => {
  it("scales with its card instead of being pinned to its drawing size", () => {
    expectScalesWithItsCard(draw("treble", 60), { width: 280, height: 150 });
  });
});
