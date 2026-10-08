import { render } from "@testing-library/react";
import KeySignatureStaff from "./KeySignatureStaff.jsx";
import { KEYS } from "../lib/keys.js";
import { expectScalesWithItsCard, glyphCount, noteheads, staveCount, svgOf } from "../test/staff.js";

const draw = keyId =>
  render(<KeySignatureStaff exercise={{ ...KEYS[keyId], keyId }} />).container;

describe("the bare staff", () => {
  it("shows both clefs, because a signature is written on both", () => {
    expect(staveCount(draw("G"))).toBe(2);
  });

  it("draws no notes at all — there is nothing to read the key off", () => {
    expect(noteheads(draw("D"))).toHaveLength(0);
  });

  it("draws the clef and the signature and nothing else", () => {
    // Anything more on this staff is another thing to read in a drill whose
    // whole point is the few marks at the front.
    const drawn = new Set(
      [...svgOf(draw("D")).querySelectorAll("g")].map(g => g.getAttribute("class")),
    );
    expect(drawn).toEqual(new Set(["vf-stave", "vf-stavebarline", "vf-clef", "vf-keysignature"]));
  });

  it("draws more glyphs the more accidentals the key has", () => {
    const glyphs = ["C", "G", "D", "A", "E"].map(k => glyphCount(draw(k)));
    for (let i = 1; i < glyphs.length; i++) {
      expect(glyphs[i], `${i} sharps`).toBeGreaterThan(glyphs[i - 1]);
    }
  });

  it("draws more for each extra flat too", () => {
    expect(glyphCount(draw("Eb"))).toBeGreaterThan(glyphCount(draw("Bb")));
    expect(glyphCount(draw("Bb"))).toBeGreaterThan(glyphCount(draw("F")));
  });

  it("draws nothing extra for C major", () => {
    expect(glyphCount(draw("C"))).toBeLessThan(glyphCount(draw("F")));
  });

  it("redraws when the key changes", () => {
    const { container, rerender } = render(
      <KeySignatureStaff exercise={{ ...KEYS.C, keyId: "C" }} />,
    );
    const plain = glyphCount(container);
    rerender(<KeySignatureStaff exercise={{ ...KEYS.E, keyId: "E" }} />);
    expect(glyphCount(container)).toBeGreaterThan(plain);
    expect(staveCount(container)).toBe(2, "redrawn, not appended");
  });
});

describe("accessibility", () => {
  it("counts the accidentals without naming the key — that is the answer", () => {
    const label = svgOf(draw("D")).getAttribute("aria-label");
    expect(label).toBe("A key signature with 2 sharps");
    expect(label).not.toMatch(/D major/);
  });

  it("uses the singular for one", () => {
    expect(svgOf(draw("G")).getAttribute("aria-label")).toBe("A key signature with 1 sharp");
    expect(svgOf(draw("F")).getAttribute("aria-label")).toBe("A key signature with 1 flat");
  });

  it("says so when there is nothing there", () => {
    expect(svgOf(draw("C")).getAttribute("aria-label"))
      .toBe("A key signature with no sharps or flats");
  });

  it("never leaks the key name for any key in the drill", () => {
    for (const keyId of ["C", "G", "D", "A", "E", "F", "Bb", "Eb"]) {
      const label = svgOf(draw(keyId)).getAttribute("aria-label");
      expect(label, keyId).not.toMatch(/major|minor/);
    }
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw("G"), { width: 300, height: 230 });
  });
});
