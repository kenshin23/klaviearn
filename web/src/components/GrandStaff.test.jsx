import { render } from "@testing-library/react";
import GrandStaff from "./GrandStaff.jsx";
import { LETTER_COLORS, noteMeta } from "../lib/notes.js";
import { setLocale } from "../lib/i18n.js";
import {
  annotations, expectDescribedForScreenReaders, expectScalesWithItsCard,
  headColors, noteheads, staveCount,
} from "../test/staff.js";

const draw = (clef, midi, props = {}) =>
  render(
    <GrandStaff exercise={{ ...noteMeta(clef, midi), grand: true }}
      showLetter={false} showColor={false} {...props} />,
  ).container;

beforeEach(() => setLocale("en", "letters"));

describe("both staves", () => {
  it("braces two staves together", () => {
    expect(staveCount(draw("treble", 67))).toBe(2);
  });

  it("draws a single note whichever staff it belongs to", () => {
    expect(noteheads(draw("treble", 67))).toHaveLength(1);
    expect(noteheads(draw("bass", 53))).toHaveLength(1);
  });

  it("puts the note on the staff the exercise names", () => {
    // Reading WHICH staff is the skill, so a bass note must sit lower on the
    // page than the same-pitch treble note.
    const y = c => Number(
      noteheads(c)[0].querySelector("path").getAttribute("d").match(/M[\d.]+ ([\d.]+)/)[1],
    );
    expect(y(draw("bass", 60))).toBeGreaterThan(y(draw("treble", 60)));
  });

  it("redraws when the exercise moves to the other staff", () => {
    const { container, rerender } = render(
      <GrandStaff exercise={{ ...noteMeta("treble", 67), grand: true }} showLetter showColor={false} />,
    );
    expect(annotations(container)).toEqual(["G"]);
    rerender(<GrandStaff exercise={{ ...noteMeta("bass", 53), grand: true }} showLetter showColor={false} />);
    expect(annotations(container)).toEqual(["F"]);
    expect(noteheads(container)).toHaveLength(1);
  });
});

describe("the scaffold levels", () => {
  it("L0 shows letter and colour", () => {
    const c = draw("bass", 53, { showLetter: true, showColor: true });
    expect(annotations(c)).toEqual(["F"]);
    expect(headColors(c)).toEqual([LETTER_COLORS.F]);
  });

  it("L1 keeps colour only", () => {
    const c = draw("bass", 53, { showColor: true });
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([LETTER_COLORS.F]);
  });

  it("L2 is plain", () => {
    const c = draw("bass", 53);
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([null]);
  });

  it("uses solfège labels when set", () => {
    setLocale("es", "solfege");
    expect(annotations(draw("bass", 53, { showLetter: true }))).toEqual(["Fa"]);
  });
});

describe("accessibility", () => {
  it("says it is the grand staff", () => {
    expectDescribedForScreenReaders(draw("treble", 67), /grand staff/);
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw("treble", 67), { width: 300, height: 240 });
  });
});
