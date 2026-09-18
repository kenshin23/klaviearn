import { render } from "@testing-library/react";
import RhythmStaff from "./RhythmStaff.jsx";
import { RHYTHM_PATTERNS } from "../lib/notes.js";
import {
  expectDescribedForScreenReaders, expectScalesWithItsCard, noteheads, svgOf,
} from "../test/staff.js";

const draw = durations => render(<RhythmStaff durations={durations} />).container;

// One <g class="vf-stavenote"> per duration, rest or not. A rest is the one
// without a stem.
const events = container => svgOf(container).querySelectorAll("g.vf-stavenote").length;
const stems = container => svgOf(container).querySelectorAll("g.vf-stem").length;

describe("the bar", () => {
  it("draws one glyph per duration", () => {
    expect(noteheads(draw(["q", "q", "q", "q"]))).toHaveLength(4);
    expect(noteheads(draw(["h", "h"]))).toHaveLength(2);
    expect(noteheads(draw(["w"]))).toHaveLength(1);
  });

  it("shows the time signature", () => {
    expect(svgOf(draw(["q", "q", "q", "q"])).querySelector("g.vf-timesignature")).toBeTruthy();
  });

  it("beams eighth notes together", () => {
    // Beams are drawn after formatting; eighths add strokes that quarters
    // of the same count do not.
    const eighths = svgOf(draw(["8", "8", "8", "8", "q", "q"])).querySelectorAll("path").length;
    const quarters = svgOf(draw(["q", "q", "q", "q", "q", "q"])).querySelectorAll("path").length;
    expect(eighths).toBeGreaterThan(quarters);
  });

  it("draws every pattern in the curriculum, one event per duration", () => {
    for (const [pid, pattern] of Object.entries(RHYTHM_PATTERNS)) {
      expect(events(draw(pattern.durations)), pid).toBe(pattern.durations.length);
    }
  });

  it("redraws when the pattern changes", () => {
    const { container, rerender } = render(<RhythmStaff durations={["q", "q", "q", "q"]} />);
    expect(noteheads(container)).toHaveLength(4);
    rerender(<RhythmStaff durations={["h", "h"]} />);
    expect(noteheads(container)).toHaveLength(2);
  });
});

describe("rests", () => {
  it("draws a rest with no stem — that is what marks it as silence", () => {
    const withRest = draw(["q", "qr", "q", "q"]);
    const without = draw(["q", "q", "q", "q"]);
    expect(events(withRest)).toBe(events(without), "still four events in the bar");
    expect(stems(withRest)).toBe(stems(without) - 1);
  });

  it("counts every rest in a bar", () => {
    expect(stems(draw(["qr", "qr", "q", "q"]))).toBe(2);
  });

  it("keeps a rest occupying its beat rather than collapsing the bar", () => {
    expect(events(draw(["h", "qr", "q"]))).toBe(3);
  });
});

describe("accessibility", () => {
  it("describes itself for screen readers", () => {
    expectDescribedForScreenReaders(draw(["q", "q", "q", "q"]), /A one-bar rhythm/);
  });

  it("scales with its card", () => {
    expectScalesWithItsCard(draw(["q", "q", "q", "q"]), { width: 320, height: 140 });
  });
});
