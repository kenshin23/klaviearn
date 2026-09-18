import { render } from "@testing-library/react";
import PhraseStaff from "./PhraseStaff.jsx";
import { LETTER_COLORS, noteMeta } from "../lib/notes.js";
import { setLocale } from "../lib/i18n.js";
import {
  annotations, expectDescribedForScreenReaders, expectScalesWithItsCard,
  headColors, noteheads,
} from "../test/staff.js";

const PHRASE = [60, 64, 67, 72].map(m => noteMeta("treble", m));
const ALL_WHEELS = { letters: true, colors: true };

const draw = (currentIdx, scaffold = ALL_WHEELS, notes = PHRASE) =>
  render(<PhraseStaff notes={notes} currentIdx={currentIdx} scaffold={scaffold} />).container;

beforeEach(() => setLocale("en", "letters"));

describe("the phrase", () => {
  it("draws every note of the phrase", () => {
    expect(noteheads(draw(0))).toHaveLength(4);
  });

  it("handles phrases of other lengths", () => {
    const three = [60, 62, 64].map(m => noteMeta("treble", m));
    expect(noteheads(draw(0, ALL_WHEELS, three))).toHaveLength(3);
  });
});

describe("marking your place", () => {
  it("scaffolds only the note you are on", () => {
    expect(annotations(draw(0))).toEqual(["C"]);
    expect(annotations(draw(2))).toEqual(["G"]);
  });

  it("colours the active note and greys the rest", () => {
    const colors = headColors(draw(1));
    expect(colors[1]).toBe(LETTER_COLORS.E, "the active note carries its letter colour");
    expect(colors[0]).not.toBe(LETTER_COLORS.C);
    expect(colors[2]).not.toBe(LETTER_COLORS.G);
  });

  it("recedes notes already played and keeps upcoming ones quiet but visible", () => {
    const colors = headColors(draw(2));
    const [done1, done2, , ahead] = colors;
    expect(done1).toBe(done2, "everything played reads the same way");
    expect(ahead).not.toBe(done1, "what is coming looks different from what is gone");
  });

  it("moves the highlight as the phrase advances", () => {
    const { container, rerender } = render(
      <PhraseStaff notes={PHRASE} currentIdx={0} scaffold={ALL_WHEELS} />,
    );
    expect(annotations(container)).toEqual(["C"]);
    rerender(<PhraseStaff notes={PHRASE} currentIdx={1} scaffold={ALL_WHEELS} />);
    expect(annotations(container)).toEqual(["E"]);
    expect(noteheads(container)).toHaveLength(4, "redrawn, not appended");
  });
});

describe("the scaffold levels", () => {
  it("drops the letter but keeps the colour at L1", () => {
    const c = draw(1, { letters: false, colors: true });
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)[1]).toBe(LETTER_COLORS.E);
  });

  it("drops both at L2", () => {
    const c = draw(1, { letters: false, colors: false });
    expect(annotations(c)).toEqual([]);
    expect(headColors(c)[1]).toBeNull();
  });

  it("uses solfège when set", () => {
    setLocale("es", "solfege");
    expect(annotations(draw(2))).toEqual(["Sol"]);
  });
});

describe("accessibility", () => {
  it("says how long the phrase is and where you are in it", () => {
    expectDescribedForScreenReaders(draw(1), /A 4-note phrase, note 2 active/);
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw(0), { width: 340, height: 150 });
  });
});
