import { render } from "@testing-library/react";
import ChordStaff from "./ChordStaff.jsx";
import { LETTER_COLORS, SKILL_NODES, chordSpec } from "../lib/notes.js";
import { setLocale } from "../lib/i18n.js";
import {
  annotations, expectDescribedForScreenReaders, expectScalesWithItsCard,
  glyphCount, headColors, noteheads,
} from "../test/staff.js";

const draw = (root, quality, props = {}) =>
  render(
    <ChordStaff exercise={chordSpec(root, quality)} showName={false} showColor={false} {...props} />,
  ).container;

const TRIADS = SKILL_NODES.find(n => n.id === "chords").triads;

beforeEach(() => setLocale("en", "letters"));

describe("the chord", () => {
  it("stacks three noteheads on one stem position", () => {
    expect(noteheads(draw(60, "maj"))).toHaveLength(3);
  });

  it("draws every triad in the curriculum", () => {
    for (const [root, quality] of TRIADS) {
      expect(noteheads(draw(root, quality)), `${root} ${quality}`).toHaveLength(3);
    }
  });

  it("redraws cleanly when the chord changes", () => {
    const { container, rerender } = render(
      <ChordStaff exercise={chordSpec(60, "maj")} showName showColor={false} />,
    );
    expect(annotations(container)).toEqual(["C major"]);
    rerender(<ChordStaff exercise={chordSpec(65, "maj")} showName showColor={false} />);
    expect(annotations(container)).toEqual(["F major"]);
    expect(noteheads(container)).toHaveLength(3);
  });
});

describe("accidentals", () => {
  // D major (D F♯ A) and D minor (D F A) occupy the same three staff
  // positions and differ by exactly one glyph: the sharp. Same for E.
  it("draws a sharp for D major that D minor does not have", () => {
    expect(glyphCount(draw(62, "maj"))).toBe(glyphCount(draw(62, "min")) + 1);
  });

  it("draws a sharp for E major that E minor does not have", () => {
    expect(glyphCount(draw(64, "maj"))).toBe(glyphCount(draw(64, "min")) + 1);
  });

  it("draws no accidental for a triad that needs none", () => {
    // E minor (E G B) and A minor (A C E) are both all-natural and both sit
    // inside the staff, so they draw the same number of glyphs.
    expect(glyphCount(draw(64, "min"))).toBe(glyphCount(draw(69, "min")));
  });

  it("still draws the sharp with every scaffold turned off", () => {
    const plain = glyphCount(draw(62, "maj"));
    const scaffolded = glyphCount(draw(62, "maj", { showColor: true }));
    expect(plain).toBe(scaffolded, "colour must not add or remove glyphs");
    expect(plain).toBe(glyphCount(draw(62, "min")) + 1);
  });
});

describe("the scaffold levels", () => {
  it("L0 names the chord under the staff and colours every notehead", () => {
    const c = draw(60, "maj", { showName: true, showColor: true });
    expect(annotations(c)).toEqual(["C major"]);
    expect(headColors(c)).toEqual([LETTER_COLORS.C, LETTER_COLORS.E, LETTER_COLORS.G]);
  });

  it("L1 keeps the colours and drops the name", () => {
    const c = draw(60, "maj", { showName: false, showColor: true });
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([LETTER_COLORS.C, LETTER_COLORS.E, LETTER_COLORS.G]);
  });

  it("L2 draws plain notation", () => {
    const c = draw(60, "maj");
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)).toEqual([null, null, null]);
  });

  it("gives a sharp its natural's colour, so F♯ still reads as an F", () => {
    // D major is D F♯ A.
    expect(headColors(draw(62, "maj", { showColor: true })))
      .toEqual([LETTER_COLORS.D, LETTER_COLORS.F, LETTER_COLORS.A]);
  });

  it("names the chord in Spanish solfège", () => {
    setLocale("es", "solfege");
    expect(annotations(draw(62, "maj", { showName: true }))).toEqual(["Re mayor"]);
    expect(annotations(draw(69, "min", { showName: true }))).toEqual(["La menor"]);
  });

  it("labels a chord rather than stacking three letters in it", () => {
    // Three letter annotations inside one chord is exactly the crowding the
    // app exists to avoid, so the scaffold is a single name.
    expect(annotations(draw(60, "maj", { showName: true, showColor: true }))).toHaveLength(1);
  });
});

describe("accessibility", () => {
  it("describes the chord for screen readers", () => {
    expectDescribedForScreenReaders(draw(62, "maj"), /D major chord on the treble staff/);
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw(60, "maj"), { width: 280, height: 150 });
  });
});
