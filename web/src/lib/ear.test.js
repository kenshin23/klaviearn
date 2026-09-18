import { REFERENCE_MIDI, planBeats, planDuration, playbackPlan } from "./ear.js";

const pitch = (midi = 67) => ({ drill: "ear-pitch", midi });
const interval = (midis = [60, 64]) => ({ drill: "ear-interval", midis, size: 3 });
const chord = (midis = [60, 64, 67]) => ({ drill: "ear-chord", midis, quality: "maj" });
const phrase = (midis = [60, 64, 67, 72]) => ({ drill: "ear-phrase", midis });

/** Every pitch the plan sounds, in the order it sounds them. */
const sounded = plan => plan.flatMap(step => step.midis);
const starts = plan => plan.map(step => step.at);

describe("matching a pitch", () => {
  it("anchors against a reference C at full scaffold", () => {
    const plan = playbackPlan(pitch(67), 0);
    expect(sounded(plan)).toEqual([REFERENCE_MIDI, 67]);
    expect(plan[0].at).toBe(0);
    expect(plan[1].at).toBeGreaterThan(0);
  });

  it("withdraws the anchor as the note is mastered", () => {
    expect(sounded(playbackPlan(pitch(67), 1))).toEqual([67]);
    expect(sounded(playbackPlan(pitch(67), 2))).toEqual([67]);
  });

  it("uses middle C as the anchor, the first note the app teaches", () => {
    expect(REFERENCE_MIDI).toBe(60);
  });
});

describe("intervals by ear", () => {
  it("sounds the notes one after another while the item is young", () => {
    const plan = playbackPlan(interval([60, 64]), 0);
    expect(plan.map(s => s.midis)).toEqual([[60], [64]]);
    expect(plan[1].at).toBeGreaterThan(plan[0].at);
  });

  it("closes the gap at the middle level", () => {
    const [, second0] = starts(playbackPlan(interval(), 0));
    const [, second1] = starts(playbackPlan(interval(), 1));
    expect(second1).toBeLessThan(second0);
  });

  it("sounds them together once mastered — the real skill", () => {
    const plan = playbackPlan(interval([60, 64]), 2);
    expect(plan).toHaveLength(1);
    expect(plan[0].midis).toEqual([60, 64]);
    expect(plan[0].at).toBe(0);
  });
});

describe("major or minor", () => {
  it("arpeggiates and then repeats as a block at full scaffold", () => {
    const plan = playbackPlan(chord([60, 64, 67]), 0);
    expect(plan.slice(0, 3).map(s => s.midis)).toEqual([[60], [64], [67]]);
    expect(plan.at(-1).midis).toEqual([60, 64, 67]);
    expect(plan.at(-1).at).toBeGreaterThan(plan[2].at);
  });

  it("drops the block repeat at the middle level", () => {
    const plan = playbackPlan(chord([60, 64, 67]), 1);
    expect(plan.map(s => s.midis)).toEqual([[60], [64], [67]]);
  });

  it("is a block chord alone once mastered", () => {
    const plan = playbackPlan(chord([60, 63, 67]), 2);
    expect(plan).toEqual([{ midis: [60, 63, 67], at: 0 }]);
  });

  it("never reveals the quality in the plan — only the sound carries it", () => {
    const major = playbackPlan(chord([60, 64, 67]), 2);
    const minor = playbackPlan({ ...chord([60, 63, 67]), quality: "min" }, 2);
    expect(Object.keys(major[0])).toEqual(Object.keys(minor[0]));
  });
});

describe("playing a phrase back", () => {
  it("sounds every note in order", () => {
    expect(sounded(playbackPlan(phrase([60, 64, 67, 72]), 1))).toEqual([60, 64, 67, 72]);
  });

  it("plays slower while the notes are new and speeds up with mastery", () => {
    const gapAt = level => {
      const [first, second] = starts(playbackPlan(phrase(), level));
      return second - first;
    };
    expect(gapAt(0)).toBeGreaterThan(gapAt(1));
    expect(gapAt(1)).toBeGreaterThan(gapAt(2));
  });

  it("keeps the notes evenly spaced", () => {
    const at = starts(playbackPlan(phrase(), 0));
    const gaps = at.slice(1).map((t, i) => Number((t - at[i]).toFixed(6)));
    expect(new Set(gaps).size).toBe(1);
  });
});

describe("the shape of a plan", () => {
  it("always starts immediately", () => {
    for (const ex of [pitch(), interval(), chord(), phrase()]) {
      for (const level of [0, 1, 2]) {
        expect(playbackPlan(ex, level)[0].at).toBe(0);
      }
    }
  });

  it("never runs backwards in time", () => {
    for (const ex of [pitch(), interval(), chord(), phrase()]) {
      for (const level of [0, 1, 2]) {
        const at = starts(playbackPlan(ex, level));
        expect(at).toEqual([...at].sort((a, b) => a - b));
      }
    }
  });

  it("stays short enough to hold in your head", () => {
    for (const ex of [pitch(), interval(), chord(), phrase()]) {
      expect(planDuration(playbackPlan(ex, 0))).toBeLessThan(4);
    }
  });

  it("counts the sounds a listener will hear", () => {
    expect(planBeats(playbackPlan(phrase([60, 62, 64, 65]), 1))).toBe(4);
    expect(planBeats(playbackPlan(chord(), 2))).toBe(1);
  });

  it("clamps a level outside the ladder rather than producing silence", () => {
    expect(playbackPlan(phrase(), 9)).toHaveLength(4);
    expect(playbackPlan(phrase(), -1)).toHaveLength(4);
    expect(playbackPlan(pitch(), undefined)).toHaveLength(2);
  });

  it("is empty for a drill that is not an ear drill", () => {
    expect(playbackPlan({ drill: "note", midi: 60 }, 0)).toEqual([]);
  });

  it("is empty rather than throwing when there is nothing to play", () => {
    expect(playbackPlan({ drill: "ear-phrase", midis: [] }, 0)).toEqual([]);
    expect(playbackPlan({ drill: "ear-pitch" }, 0)).toEqual([]);
  });
});

describe("the anchor is not sounded pointlessly", () => {
  it("is skipped when the target is the anchor itself", () => {
    const plan = playbackPlan(pitch(REFERENCE_MIDI), 0);
    expect(plan).toEqual([{ midis: [REFERENCE_MIDI], at: 0 }]);
  });

  it("is still sounded for every other note at full scaffold", () => {
    for (const midi of [62, 64, 65, 67, 69, 71, 72]) {
      expect(playbackPlan(pitch(midi), 0)).toHaveLength(2);
    }
  });
});
