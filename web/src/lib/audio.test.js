import { audioContext, chimeCorrect, chimeWrong, click, playChord, playMidi, tick, tone } from "./audio.js";

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
