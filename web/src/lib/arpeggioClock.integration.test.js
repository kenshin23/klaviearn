import { act } from "@testing-library/react";
import { createArpeggioClock } from "./arpeggioClock.js";
import { makeArpeggio } from "./arpeggios.js";

const audio = vi.hoisted(() => ({ ctx: null, click: vi.fn() }));
vi.mock("./audio.js", () => ({
  audioContext: () => audio.ctx,
  click: (...args) => audio.click(...args),
  perfTimeFor: (ctx, time) => performance.now() + (time - ctx.currentTime) * 1000,
}));

beforeEach(() => {
  vi.useFakeTimers();
  audio.click.mockClear();
  audio.ctx = {
    get currentTime() { return 10 + performance.now() / 1000; },
    state: "running",
    resume: vi.fn(),
  };
});
afterEach(() => vi.useRealTimers());

const advance = async ms => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
const hasClick = (time, accent) => audio.click.mock.calls.some(([at, accented]) =>
  Math.abs(at - time) < 0.00001 && accented === accent);

it("accents every whole-pattern boundary during continuous practice", async () => {
  const clock = createArpeggioClock({ exercise: makeArpeggio(), bpm: 20 });
  await clock.start();
  await advance(12200);
  for (const boundary of [13.05, 16.05, 19.05, 22.05]) {
    expect(hasClick(boundary, true), `missing accent at ${boundary}`).toBe(true);
  }
  clock.stop();
});

it("keeps the next accent and moves subdivisions onto the new tempo grid", async () => {
  const clock = createArpeggioClock({ exercise: makeArpeggio(), bpm: 20, onCycle: () => 30 });
  await clock.start();
  await advance(8200);
  expect(hasClick(16.05, true)).toBe(true);
  expect(hasClick(16.55, false)).toBe(true);
  expect(hasClick(17.05, false)).toBe(true);
  expect(hasClick(18.05, true)).toBe(true);
  clock.stop();
});

it("cancels a pending audio resume when stopped before it resolves", async () => {
  let resume;
  audio.ctx.state = "suspended";
  audio.ctx.resume = vi.fn(() => new Promise(resolve => { resume = resolve; }));
  const onPhase = vi.fn();
  const clock = createArpeggioClock({ exercise: makeArpeggio(), onPhase });
  const pending = clock.start();
  clock.stop();
  audio.ctx.state = "running";
  resume();
  await pending;
  await advance(4000);
  expect(audio.click).not.toHaveBeenCalled();
  expect(onPhase.mock.calls.some(([phase]) => phase === "playing")).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("shares a pending start rather than starting two audio loops", async () => {
  let resume;
  audio.ctx.state = "suspended";
  audio.ctx.resume = vi.fn(() => new Promise(resolve => { resume = resolve; }));
  const clock = createArpeggioClock({ exercise: makeArpeggio() });
  const one = clock.start();
  const two = clock.start();
  audio.ctx.state = "running";
  resume();
  await Promise.all([one, two]);
  expect(audio.ctx.resume).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(1);
  clock.stop();
});

it("scores all sixteen real-time attacks at 20 then 21 bpm without a gap", async () => {
  const exercise = makeArpeggio();
  expect(exercise.midis).toHaveLength(16);
  const results = [];
  const clock = createArpeggioClock({ exercise, bpm: 20, onCycle: result => {
    results.push(result);
    return 21;
  } });
  await clock.start();
  for (const [start, duration] of [[3050, 3000], [6050, 60000 / 21]]) {
    for (let i = 0; i < 16; i++) {
      const at = start + i * duration / 16;
      await advance(at - performance.now());
      clock.record(exercise.midis[i], at);
    }
  }
  await advance(8950 - performance.now());
  expect(results.map(result => result.bpm)).toEqual([20, 21]);
  expect(results.map(result => result.hit)).toEqual([true, true]);
  clock.stop();
});

it("normalizes an anticipatory attack against the promoted cycle duration", async () => {
  const exercise = makeArpeggio();
  const results = [];
  const clock = createArpeggioClock({ exercise, onCycle: result => {
    results.push(result);
    return 21;
  } });
  await clock.start();
  // 64 ms is inside the old 65.625 ms tolerance, outside the new 62.5 ms.
  await advance(5986);
  clock.record(exercise.midis[0]);
  for (let i = 1; i < 16; i++) {
    const at = 6050 + i * (60000 / 21) / 16;
    await advance(at - performance.now());
    clock.record(exercise.midis[i], at);
  }
  await advance(8950 - performance.now());
  expect(results).toHaveLength(2);
  expect(results[1].hit).toBe(false);
  clock.stop();
});

it("schedules only cycle accents after count-in with one subdivision", async () => {
  const clock = createArpeggioClock({ exercise: makeArpeggio(), subdivisions: 1 });
  await clock.start();
  await advance(12200);
  const playing = audio.click.mock.calls.filter(([at]) => at >= 13.05);
  expect(playing.map(([at]) => at)).toEqual([13.05, 16.05, 19.05, 22.05]);
  expect(playing.every(([, accent]) => accent)).toBe(true);
  clock.stop();
});
