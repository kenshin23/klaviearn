import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  ctx: null,
  click: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("./audio.js", () => ({
  audioContext: () => audio.ctx,
  click: (...args) => audio.click(...args),
  perfTimeFor: (ctx, time) => performance.now() + (time - ctx.currentTime) * 1000,
}));

import { createArpeggioClock } from "./arpeggioClock.js";

const exercise = { midis: [60, 64, 67, 72] };
const cycleOnsets = (start, duration, midis = exercise.midis) => midis.map((midi, i) => ({
  midi,
  at: start + duration * i / midis.length,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  audio.ctx = {
    get currentTime() { return 10 + performance.now() / 1000; },
    state: "running",
    destination: {},
    resume: audio.resume,
  };
  audio.click.mockClear();
  audio.resume.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const advance = async ms => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe("arpeggio clock", () => {
  it("counts in four times across one 3-second cycle, then exposes all note indices", async () => {
    const phases = [];
    const steps = [];
    const clock = createArpeggioClock({
      exercise,
      bpm: 20,
      onPhase: (...args) => phases.push(args),
      onStep: index => steps.push(index),
    });
    await clock.start();
    await advance(2990);

    const scheduled = audio.click.mock.calls.map(([at]) => at);
    expect(scheduled.slice(0, 4)).toEqual([10.05, 10.8, 11.55, 12.3]);
    expect(scheduled).toContain(13.05); // accent at the first playing boundary
    expect(phases).toContainEqual(["counting", 4]);
    await advance(80);
    expect(phases).toContainEqual(["playing", undefined]);
    for (let i = 1; i <= 3; i++) {
      await advance(750);
      expect(steps.at(-1)).toBe(i);
    }
    clock.stop();
  });

  it("assigns an exact boundary attack to the next cycle and scores two gapless cycles", async () => {
    const cycles = [];
    const clock = createArpeggioClock({ exercise, bpm: 20, onCycle: result => {
      cycles.push(result);
      return 20;
    } });
    await clock.start();
    const perfStart = 50;
    for (const entry of [...cycleOnsets(perfStart + 3000, 3000), ...cycleOnsets(perfStart + 6000, 3000)]) {
      await advance(entry.at - performance.now());
      clock.record(entry.midi, entry.at);
    }

    await advance(9100 - performance.now());
    expect(cycles).toHaveLength(2);
    expect(cycles.map(c => c.hit)).toEqual([true, true]);
    expect(cycles.map(c => c.extras)).toEqual([0, 0]);
    clock.stop();
  });

  it("uses the returned bpm at the next boundary", async () => {
    const cycles = [];
    const clock = createArpeggioClock({ exercise, bpm: 20, onCycle: result => {
      cycles.push(result);
      return 30;
    } });
    await clock.start();
    await advance(6100);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].bpm).toBe(20);
    expect(audio.click.mock.calls.some(([time]) => Math.abs(time - 13.05) < 1e-7)).toBe(true);
    await advance(1900);
    expect(cycles).toHaveLength(1);
    await advance(100);
    expect(cycles).toHaveLength(2);
    expect(cycles[1].bpm).toBe(30);
    clock.stop();
  });

  it("scores wrong, extra, and missing attacks without completing an interrupted cycle", async () => {
    const cycles = [];
    const clock = createArpeggioClock({ exercise, bpm: 20, onCycle: result => cycles.push(result) });
    await clock.start();
    const start = 3050;
    for (const [midi, at] of [[60, start], [65, start + 750], [67, start + 1500], [72, start + 2250], [80, start + 2400]]) {
      await advance(at - performance.now());
      clock.record(midi, at);
    }
    await advance(6100 - performance.now());
    expect(cycles[0]).toMatchObject({ hit: false, extras: 1 });
    expect(cycles[0].verdicts.map(v => v.verdict)).toContain("wrong");

    clock.record(60, 9050);
    clock.stop();
    await advance(4000);
    expect(cycles).toHaveLength(1);
  });

  it("rejects failed audio resume and cancels callbacks on stop", async () => {
    audio.ctx.state = "suspended";
    audio.ctx.resume = vi.fn().mockRejectedValue(new Error("denied"));
    const phases = [];
    const clock = createArpeggioClock({ exercise, onPhase: phase => phases.push(phase) });
    await expect(clock.start()).rejects.toThrow("denied");
    expect(phases).toEqual([]);

    audio.ctx.state = "running";
    await clock.start();
    clock.stop();
    const priorClicks = audio.click.mock.calls.length;
    await advance(1000);
    expect(audio.click).toHaveBeenCalledTimes(priorClicks);
    expect(phases.at(-1)).toBe("idle");
  });

  it("stops after a long timer delay rather than scoring phantom cycles", async () => {
    const cycles = [];
    const phases = [];
    const clock = createArpeggioClock({ exercise, onCycle: result => cycles.push(result),
      onPhase: phase => phases.push(phase) });
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    await clock.start();
    now.mockReturnValue(1000);
    await vi.advanceTimersToNextTimerAsync();
    expect(cycles).toHaveLength(0);
    expect(phases.at(-1)).toBe("idle");
  });
});
