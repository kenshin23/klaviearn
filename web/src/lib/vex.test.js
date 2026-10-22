import { vexDuration } from "./vex.js";

describe("beats to notation", () => {
  it.each([
    [4, "w", 0], [3, "h", 1], [2, "h", 0], [1.5, "q", 1],
    [1, "q", 0], [0.5, "8", 0], [0.25, "16", 0],
  ])("draws %s beats as %s with %i dots", (beats, duration, dots) => {
    expect(vexDuration(beats)).toEqual({ duration, dots });
  });

  it("falls back to a quarter rather than throwing on an odd value", () => {
    expect(vexDuration(1.234)).toEqual({ duration: "q", dots: 0 });
  });
});
