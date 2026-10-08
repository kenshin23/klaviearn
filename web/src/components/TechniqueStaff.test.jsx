import { render } from "@testing-library/react";
import TechniqueStaff from "./TechniqueStaff.jsx";
import { LETTER_COLORS, TECHNIQUE_PATTERNS, techniqueSpec } from "../lib/notes.js";
import { spell } from "../lib/keys.js";
import {
  annotations, clefShape, expectDescribedForScreenReaders, expectScalesWithItsCard,
  glyphCount, headColors, noteheads, staveCount, svgOf,
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

  it("scales with its card", () => {
    expectScalesWithItsCard(draw("arp:C:rh"), { width: 320, height: 150 });
  });

  it("splits a long pattern onto two systems instead of squashing it", () => {
    // The SVG scales to the card's width, so a fifteen-note scale on one line
    // would render at about a third the height of a flashed note — the wrong
    // trade in an app whose premise is large notation.
    expect(staveCount(draw("scale:C:rh"))).toBe(2);
    expect(staveCount(draw("arp:C:rh"))).toBe(1);
    expect(staveCount(draw("5finger:rh"))).toBe(1);
  });

  it("keeps a long pattern's proportions close to a short one's", () => {
    const aspect = container => {
      const [, , w, h] = svgOf(container).getAttribute("viewBox").split(" ").map(Number);
      return w / h;
    };
    // One line would be 4.4:1. Two keeps it near the arpeggio's shape, which
    // is what decides how big it renders.
    expect(aspect(draw("scale:C:rh"))).toBeLessThan(2);
    expect(aspect(draw("scale:C:rh"))).toBeLessThan(aspect(draw("arp:C:rh")) * 1.2);
  });

  it("repeats the key signature on the second system, as a score does", () => {
    expect(svgOf(draw("scale:G:rh")).querySelectorAll("g.vf-keysignature")).toHaveLength(2);
    expect(svgOf(draw("arp:G:rh")).querySelectorAll("g.vf-keysignature")).toHaveLength(1);
  });
});

describe("key signatures", () => {
  // The signature says it once at the front. The notes below it draw only the
  // accidentals it did not already cover.
  it("draws no accidentals at all in a plain major scale", () => {
    for (const key of ["C", "G", "D", "F"]) {
      const c = draw(`scale:${key}:rh`);
      const spec = techniqueSpec(`scale:${key}:rh`);
      expect(spec.notes.every(n => n.written === ""), key).toBe(true);
      expect(noteheads(c), key).toHaveLength(15);
    }
  });

  it("draws the one accidental the signature could not cover", () => {
    // A harmonic minor's G sharp, twice: going up and coming back down.
    // Asserted on the drawing, not just the data — comparing against the same
    // scale with the accidentals stripped isolates exactly those two glyphs.
    const spec = techniqueSpec("scale:Am:rh");
    expect(spec.notes.filter(n => n.written === "#")).toHaveLength(2);

    const stripped = { ...spec, notes: spec.notes.map(n => ({ ...n, written: "" })) };
    const drawn = render(
      <TechniqueStaff exercise={spec} showFingers={false} showColor={false} />,
    ).container;
    const undrawn = render(
      <TechniqueStaff exercise={stripped} showFingers={false} showColor={false} />,
    ).container;
    expect(glyphCount(drawn)).toBe(glyphCount(undrawn) + 2);
  });

  it("puts a key signature on the staff for a key that has one", () => {
    expect(svgOf(draw("scale:G:rh")).querySelector("g.vf-keysignature")).toBeTruthy();
    expect(svgOf(draw("scale:C:rh")).querySelector("g.vf-keysignature")).toBeNull();
  });

  it("states the sharp once in the signature instead of on every note", () => {
    // The whole economy of a key signature. The same notes with nothing at
    // the front would need an accidental on each F.
    const inG = techniqueSpec("scale:G:rh");
    const sameNotesWithNoKey = spell(inG.midis, "C", "treble");
    expect(inG.notes.filter(n => n.written)).toHaveLength(0);
    expect(sameNotesWithNoKey.filter(n => n.written)).toHaveLength(2);
  });

  it("spells a flat key with flats", () => {
    const spec = techniqueSpec("scale:F:rh");
    const bFlat = spec.notes.find(n => n.midi % 12 === 10);
    expect(bFlat).toMatchObject({ letter: "B", acc: "b" });
  });

  it("gives F major its own right-hand fingering", () => {
    // The one major scale where the right hand ends on 4, not 5.
    expect(annotations(draw("scale:F:rh", { showFingers: true })).slice(0, 8))
      .toEqual(["1", "2", "3", "4", "1", "2", "3", "4"]);
    expect(annotations(draw("scale:G:rh", { showFingers: true })).slice(0, 8))
      .toEqual(["1", "2", "3", "1", "2", "3", "4", "5"]);
  });

  it("draws every shipped pattern without error", () => {
    for (const pid of Object.keys(TECHNIQUE_PATTERNS)) {
      const expected = TECHNIQUE_PATTERNS[pid].midis.length;
      expect(noteheads(draw(pid)), pid).toHaveLength(expected);
    }
  });
});
