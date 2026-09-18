import {
  audioContext, chimeCorrect, chimeWrong, click, playChord, playMidi, playPlan, tick, tone,
} from "./audio.js";

/** Count how many oscillators a call schedules, and at what frequencies. */
function capture(fn) {
  const ctx = audioContext();
  const freqs = [];
  const spy = vi.spyOn(ctx, "createOscillator").mockImplementation(() => {
    const osc = {
      type: "sine",
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: next => next ?? osc,
      start() {}, stop() {},
    };
    freqs.push(osc.frequency);
    return osc;
  });
  fn();
  spy.mockRestore();
  return freqs.map(f => f.value);
}

describe("the audio context", () => {
  it("is created once and reused", () => {
    expect(audioContext()).toBe(audioContext());
  });
});

describe("feedback sounds", () => {
  it("plays a two-note chime when you are right", () => {
    expect(capture(chimeCorrect)).toHaveLength(2);
  });

  it("plays a single low tone when you are wrong", () => {
    const freqs = capture(chimeWrong);
    expect(freqs).toHaveLength(1);
    expect(freqs[0]).toBeLessThan(200);
  });

  it("ticks once for mid-phrase progress", () => {
    expect(capture(tick)).toHaveLength(1);
  });

  it("schedules a metronome click without throwing", () => {
    expect(() => click(audioContext().currentTime, true)).not.toThrow();
  });
});

describe("playing pitches back", () => {
  it("plays a single note at its own frequency", () => {
    expect(capture(() => playMidi(69))).toEqual([440]);
  });

  it("plays every note of a chord", () => {
    const freqs = capture(() => playChord([60, 64, 67]));
    expect(freqs).toHaveLength(3);
    expect(freqs[0]).toBeCloseTo(261.626, 2);
  });

  it("copes with an empty chord", () => {
    expect(capture(() => playChord([]))).toEqual([]);
  });

  it("accepts an explicit tone spec", () => {
    expect(capture(() => tone(880, 0.2, "square", 0, 0.1))).toEqual([880]);
  });
});

describe("playing an ear-drill plan", () => {
  it("sounds every note of every step", () => {
    const freqs = capture(() => playPlan([
      { midis: [60], at: 0 },
      { midis: [64, 67], at: 0.5 },
    ]));
    expect(freqs).toHaveLength(3);
  });

  it("sounds a chord step together", () => {
    expect(capture(() => playPlan([{ midis: [60, 64, 67], at: 0 }]))).toHaveLength(3);
  });

  it("copes with an empty plan", () => {
    expect(capture(() => playPlan([]))).toEqual([]);
  });

  it("plays each step at its own pitch", () => {
    expect(capture(() => playPlan([{ midis: [69], at: 0 }]))).toEqual([440]);
  });
});

describe("waking a suspended audio context", () => {
  it("resumes before scheduling, or the ear drills are silent", () => {
    const ctx = audioContext();
    ctx.state = "suspended";
    const resume = vi.spyOn(ctx, "resume").mockResolvedValue();
    playPlan([{ midis: [60], at: 0 }]);
    expect(resume).toHaveBeenCalled();
    ctx.state = "running";
  });

  it("does not bother when it is already running", () => {
    const ctx = audioContext();
    ctx.state = "running";
    const resume = vi.spyOn(ctx, "resume").mockResolvedValue();
    playPlan([{ midis: [60], at: 0 }]);
    expect(resume).not.toHaveBeenCalled();
  });

  it("survives a browser that refuses to resume", () => {
    const ctx = audioContext();
    ctx.state = "suspended";
    vi.spyOn(ctx, "resume").mockRejectedValue(new Error("blocked"));
    expect(() => playPlan([{ midis: [60], at: 0 }])).not.toThrow();
    ctx.state = "running";
  });
});
