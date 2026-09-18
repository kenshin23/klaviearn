import { BPM, onsetsOf } from "./RhythmPlay.jsx";
import { RHYTHM_PATTERNS } from "../lib/notes.js";

describe("onsetsOf", () => {
  it("places four quarters on the beat", () => {
    expect(onsetsOf(["q", "q", "q", "q"])).toEqual({ onsets: [0, 1, 2, 3], totalBeats: 4 });
  });

  it("counts a half note as two beats", () => {
    expect(onsetsOf(["h", "q", "q"])).toEqual({ onsets: [0, 2, 3], totalBeats: 4 });
  });

  it("puts eighths on the half-beat", () => {
    expect(onsetsOf(["8", "8", "q"])).toEqual({ onsets: [0, 0.5, 1], totalBeats: 2 });
  });

  it("advances time through a rest but expects no tap", () => {
    expect(onsetsOf(["q", "qr", "q", "q"])).toEqual({ onsets: [0, 2, 3], totalBeats: 4 });
  });

  it("handles a bar that is nothing but a whole note", () => {
    expect(onsetsOf(["w"])).toEqual({ onsets: [0], totalBeats: 4 });
  });

  it("gives every shipped pattern a full 4/4 bar and at least one tap", () => {
    for (const [pid, pattern] of Object.entries(RHYTHM_PATTERNS)) {
      const { onsets, totalBeats } = onsetsOf(pattern.durations);
      expect(totalBeats, pid).toBe(4);
      expect(onsets.length, pid).toBeGreaterThan(0);
      expect(onsets, pid).toEqual([...onsets].sort((a, b) => a - b));
      expect(Math.max(...onsets), pid).toBeLessThan(4);
    }
  });
});

describe("tempo", () => {
  it("is a slow, readable practice tempo", () => {
    expect(BPM).toBeGreaterThanOrEqual(60);
    expect(BPM).toBeLessThanOrEqual(100);
  });
});
