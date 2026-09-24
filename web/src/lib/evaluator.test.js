import {
  DEFAULT_TOLERANCE_BEATS, expectNotes, expectTaps, onsetsOf, score,
} from "./evaluator.js";
import { RHYTHM_PATTERNS } from "./notes.js";

const TOL = DEFAULT_TOLERANCE_BEATS;
const verdicts = result => result.verdicts.map(v => v.verdict);

/** A take that plays exactly what was asked, dead on the beat. */
const perfect = expected =>
  expected.map(e => ({ at: e.at, midi: e.midis?.[0] }));

describe("timing alone (the rhythm drill)", () => {
  const beats = [{ at: 0 }, { at: 1 }, { at: 2 }, { at: 3 }];

  it("passes a take that lands on every beat", () => {
    const result = score(beats, perfect(beats));
    expect(verdicts(result)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(result.hit).toBe(true);
    expect(result.extras).toBe(0);
  });

  it("accepts any key, since a rhythm asks for no pitch", () => {
    const result = score(beats, beats.map(b => ({ at: b.at, midi: 42 })));
    expect(result.hit).toBe(true);
  });

  it("calls a tap ahead of the beat early and one behind it late", () => {
    const result = score([{ at: 1 }, { at: 2 }], [{ at: 1 - TOL * 0.9 }, { at: 2 + TOL * 0.9 }]);
    expect(verdicts(result)).toEqual(["early", "late"]);
    expect(result.hit).toBe(true, "still inside tolerance — off, not wrong");
  });

  it("forgives a small slip as on the beat", () => {
    expect(verdicts(score([{ at: 1 }], [{ at: 1 + TOL * 0.4 }]))).toEqual(["ok"]);
  });

  it("marks a beat missed when nothing lands near it", () => {
    const result = score(beats, [{ at: 0 }, { at: 1 }, { at: 3 }]);
    expect(verdicts(result)).toEqual(["ok", "ok", "missed", "ok"]);
    expect(result.hit).toBe(false);
  });

  it("marks a beat missed when the tap is outside tolerance", () => {
    expect(verdicts(score([{ at: 1 }], [{ at: 1 + TOL * 1.5 }]))).toEqual(["missed"]);
  });

  it("counts taps nobody asked for", () => {
    const result = score([{ at: 0 }], [{ at: 0 }, { at: 2 }, { at: 3 }]);
    expect(result.extras).toBe(2);
    expect(result.hit).toBe(false);
  });

  it("does not let one tap satisfy two beats", () => {
    const result = score([{ at: 1 }, { at: 1.1 }], [{ at: 1.05 }]);
    expect(verdicts(result).filter(v => v === "missed")).toHaveLength(1);
  });

  it("passes an empty take against an empty expectation", () => {
    expect(score([], [])).toMatchObject({ hit: true, extras: 0, verdicts: [] });
  });

  it("fails a silent take", () => {
    expect(score(beats, []).hit).toBe(false);
    expect(verdicts(score(beats, []))).toEqual(["missed", "missed", "missed", "missed"]);
  });
});

describe("pitch and timing together (the technique drills)", () => {
  const scale = expectNotes([60, 62, 64, 65, 67]);

  it("passes a scale played in order and in time", () => {
    const result = score(scale, perfect(scale));
    expect(result.hit).toBe(true);
    expect(verdicts(result)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
  });

  it("calls the right rhythm on the wrong note wrong, not missed", () => {
    const played = perfect(scale);
    played[2].midi = 63;
    const result = score(scale, played);
    expect(verdicts(result)).toEqual(["ok", "ok", "wrong", "ok", "ok"]);
    expect(result.hit).toBe(false);
  });

  it("reports which note was played instead", () => {
    const played = perfect(scale);
    played[2].midi = 63;
    expect(score(scale, played).verdicts[2].played).toBe(63);
  });

  it("still judges timing on a correct note", () => {
    const played = perfect(scale);
    played[3].at += TOL * 0.9;
    expect(verdicts(score(scale, played))[3]).toBe("late");
  });

  it("accepts any octave by default, because on-screen keys have none", () => {
    const played = perfect(scale).map(p => ({ ...p, midi: p.midi + 12 }));
    expect(score(scale, played).hit).toBe(true);
  });

  it("insists on the octave when asked to", () => {
    const played = perfect(scale).map(p => ({ ...p, midi: p.midi + 12 }));
    const result = score(scale, played, { strictOctave: true });
    expect(verdicts(result).every(v => v === "wrong")).toBe(true);
  });

  it("prefers the right note over the merely nearer one", () => {
    // A stray F# sits closer to beat 1 than the D that was actually asked for.
    // Matching on time alone would eat the slot and call a correct take wrong.
    const expected = [{ at: 1, midis: [62] }];
    const played = [{ at: 1.05, midi: 66 }, { at: 1.15, midi: 62 }];
    const result = score(expected, played);
    expect(result.verdicts[0]).toMatchObject({ verdict: "ok", played: 62 });
    expect(result.extras).toBe(1);
  });

  it("accepts any of several allowed pitches at one moment", () => {
    const expected = [{ at: 0, midis: [60, 64, 67] }];
    expect(score(expected, [{ at: 0, midi: 64 }]).hit).toBe(true);
  });

  it("calls a note played with no pitch information wrong", () => {
    expect(verdicts(score([{ at: 0, midis: [60] }], [{ at: 0 }]))).toEqual(["wrong"]);
  });
});

describe("tolerance", () => {
  it("can be widened for a beginner", () => {
    const late = [{ at: 1 + TOL * 1.5 }];
    expect(verdicts(score([{ at: 1 }], late))).toEqual(["missed"]);
    expect(verdicts(score([{ at: 1 }], late, { tolerance: TOL * 2 }))).toEqual(["late"]);
  });

  it("can be tightened for someone who has it", () => {
    const slightlyOff = [{ at: 1 + 0.1 }];
    expect(verdicts(score([{ at: 1 }], slightlyOff))).toEqual(["ok"]);
    expect(verdicts(score([{ at: 1 }], slightlyOff, { tolerance: 0.05 }))).toEqual(["missed"]);
  });
});

describe("how far off each note was", () => {
  it("reports a signed offset in beats", () => {
    const result = score([{ at: 1 }, { at: 2 }], [{ at: 0.9 }, { at: 2.1 }]);
    expect(result.verdicts[0].off).toBeCloseTo(-0.1, 6);
    expect(result.verdicts[1].off).toBeCloseTo(0.1, 6);
  });

  it("reports no offset for a note that never arrived", () => {
    expect(score([{ at: 0 }], []).verdicts[0].off).toBeNull();
  });
});

describe("building expectations", () => {
  it("places quarter notes one beat apart", () => {
    expect(onsetsOf(["q", "q", "q", "q"])).toEqual({ onsets: [0, 1, 2, 3], totalBeats: 4 });
  });

  it("advances through a rest without expecting a tap", () => {
    expect(expectTaps(["q", "qr", "q", "q"])).toEqual([{ at: 0 }, { at: 2 }, { at: 3 }]);
  });

  it("puts eighths on the half beat", () => {
    expect(onsetsOf(["8", "8", "q"]).onsets).toEqual([0, 0.5, 1]);
  });

  it("turns a list of notes into one-per-beat expectations", () => {
    expect(expectNotes([60, 62])).toEqual([
      { at: 0, midis: [60] },
      { at: 1, midis: [62] },
    ]);
  });

  it("can space notes other than one per beat", () => {
    expect(expectNotes([60, 62, 64], { beatsPerNote: 0.5 }).map(e => e.at))
      .toEqual([0, 0.5, 1]);
  });
});

describe("the shipped rhythm patterns", () => {
  it("each fill exactly one bar of 4/4 and ask for at least one tap", () => {
    for (const [pid, pattern] of Object.entries(RHYTHM_PATTERNS)) {
      const { onsets, totalBeats } = onsetsOf(pattern.durations);
      expect(totalBeats, pid).toBe(4);
      expect(onsets.length, pid).toBeGreaterThan(0);
      expect(Math.max(...onsets), pid).toBeLessThan(4);
      expect(onsets, pid).toEqual([...onsets].sort((a, b) => a - b));
    }
  });

  it("each score as a pass when tapped perfectly", () => {
    for (const [pid, pattern] of Object.entries(RHYTHM_PATTERNS)) {
      const expected = expectTaps(pattern.durations);
      expect(score(expected, expected.map(e => ({ at: e.at }))).hit, pid).toBe(true);
    }
  });
});

describe("hands together", () => {
  // A bar played with both hands is two expected events at the same beat, one
  // per hand, each matching its own played note. Phase 7's pitch-preference
  // matching is what makes that work without special-casing.
  const bar = [
    { at: 0, midis: [48] }, { at: 0, midis: [64] }, // LH C3 + RH E4
    { at: 1, midis: [64] },
    { at: 2, midis: [65] },
    { at: 3, midis: [67] },
  ];

  it("passes when both hands land together", () => {
    const played = [
      { at: 0, midi: 48 }, { at: 0, midi: 64 },
      { at: 1, midi: 64 }, { at: 2, midi: 65 }, { at: 3, midi: 67 },
    ];
    const result = score(bar, played, { strictOctave: true });
    expect(result.hit).toBe(true);
    expect(verdicts(result)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
  });

  it("does not let one note satisfy both hands", () => {
    const played = [{ at: 0, midi: 48 }, { at: 1, midi: 64 }, { at: 2, midi: 65 }, { at: 3, midi: 67 }];
    const result = score(bar, played, { strictOctave: true });
    expect(verdicts(result)[1]).toBe("missed");
    expect(result.hit).toBe(false);
  });

  it("blames the hand that was wrong, not the one that was right", () => {
    const played = [
      { at: 0, midi: 50 }, { at: 0, midi: 64 }, // LH played D3 instead of C3
      { at: 1, midi: 64 }, { at: 2, midi: 65 }, { at: 3, midi: 67 },
    ];
    const result = score(bar, played, { strictOctave: true });
    expect(verdicts(result)[0]).toBe("wrong");
    expect(result.verdicts[0].played).toBe(50);
    expect(verdicts(result)[1]).toBe("ok");
  });

  it("accepts the hands in either order within the beat", () => {
    const played = [
      { at: 0.02, midi: 64 }, { at: 0, midi: 48 },
      { at: 1, midi: 64 }, { at: 2, midi: 65 }, { at: 3, midi: 67 },
    ];
    expect(score(bar, played, { strictOctave: true }).hit).toBe(true);
  });

  it("holds a whole-note bass under a moving right hand", () => {
    const withHeldBass = [
      { at: 0, midis: [48] },
      ...expectNotes([64, 64, 65, 67]),
    ];
    const played = [
      { at: 0, midi: 48 }, { at: 0, midi: 64 },
      { at: 1, midi: 64 }, { at: 2, midi: 65 }, { at: 3, midi: 67 },
    ];
    expect(score(withHeldBass, played, { strictOctave: true }).hit).toBe(true);
  });
});
