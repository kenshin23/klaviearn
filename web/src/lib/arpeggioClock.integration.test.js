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

it("scores every real-time attack at 20 then 21 bpm without a gap", async () => {
  const exercise = makeArpeggio();
  const noteCount = exercise.midis.length;
  expect(noteCount).toBe(15);
  const results = [];
  const clock = createArpeggioClock({ exercise, bpm: 20, onCycle: result => {
    results.push(result);
    return 21;
  } });
  await clock.start();
  for (const [start, duration] of [[3050, 3000], [6050, 60000 / 21]]) {
    for (let i = 0; i < noteCount; i++) {
      const at = start + i * duration / noteCount;
      await advance(at - performance.now());
      clock.record(exercise.midis[i], at);
    }
  }
  await advance(8950 - performance.now());
  expect(results.map(result => result.bpm)).toEqual([20, 21]);
  expect(results.map(result => result.hit)).toEqual([true, true]);
  expect(results.map(({ correct, total, percent }) => ({ correct, total, percent })))
    .toEqual([{ correct: 15, total: 15, percent: 100 }, { correct: 15, total: 15, percent: 100 }]);
  clock.stop();
});

it("publishes live wrong, pending, and missed feedback while preserving the strict octave check", async () => {
  const exercise = makeArpeggio();
  const snapshots = [];
  const results = [];
  const clock = createArpeggioClock({ exercise, onFeedback: snapshot => snapshots.push(snapshot),
    onCycle: result => { results.push(result); } });
  await clock.start();
  expect(snapshots.at(-1)).toMatchObject({
    cycleId: 1, correct: 0, total: 15, percent: 0, extras: 0,
  });
  expect(snapshots.at(-1).verdicts.every(({ verdict }) => verdict === "pending")).toBe(true);

  const firstAt = 3050;
  await advance(firstAt - performance.now());
  clock.record(exercise.midis[0] + 12, firstAt);
  expect(snapshots.at(-1).verdicts[0].verdict).toBe("wrong");
  expect(snapshots.at(-1).lastInput).toMatchObject({
    midi: exercise.midis[0] + 12, expectedMidi: exercise.midis[0], index: 0, phase: "playing",
  });

  await advance(3050 + 3000 / exercise.midis.length
    + (0.35 / exercise.midis.length * 3000) - performance.now() + 1);
  expect(snapshots.at(-1).verdicts[1].verdict).toBe("missed");
  expect(snapshots.at(-1).verdicts[2].verdict).toBe("pending");
  await advance(6070 - performance.now());
  expect(results).toHaveLength(1);
  const finalSnapshot = snapshots.findLast(snapshot => snapshot.cycleId === results[0].cycleId);
  expect(finalSnapshot).toMatchObject({
    correct: results[0].correct, total: results[0].total, percent: results[0].percent,
  });
  expect(results[0]).toMatchObject({ correct: 0, total: 15, percent: 0, wrong: 1, missed: 14 });
  const countBeforeStop = snapshots.length;
  clock.stop();
  await advance(1000);
  expect(snapshots).toHaveLength(countBeforeStop);
});

it("reports counting inputs without grading them and credits consecutive Db seam attacks", async () => {
  const exercise = makeArpeggio();
  const snapshots = [];
  const results = [];
  const clock = createArpeggioClock({ exercise, onFeedback: snapshot => snapshots.push(snapshot),
    onCycle: result => { results.push(result); } });
  await clock.start();
  clock.record(99, performance.now());
  expect(snapshots.at(-1).lastInput).toMatchObject({ midi: 99, phase: "counting" });
  expect(snapshots.at(-1).correct).toBe(0);
  for (let cycle = 0; cycle < 2; cycle++) {
    const start = 3050 + cycle * 3000;
    for (let index = 0; index < exercise.midis.length; index++) {
      const at = start + index * 3000 / exercise.midis.length - (index === 0 ? 30 : 0);
      await advance(at - performance.now());
      clock.record(exercise.midis[index], at);
      if (cycle === 1 && index === 0) {
        expect(snapshots.at(-1).lastInput).toMatchObject({
          midi: exercise.midis[0], expectedMidi: exercise.midis[0], index: 0,
          phase: "playing",
        });
        expect(snapshots.at(-1).lastInput.offsetMs).toBeCloseTo(-30, 8);
      }
    }
  }
  await advance(9070 - performance.now());
  expect(results.slice(0, 2).map(({ correct, total, percent }) => [correct, total, percent]))
    .toEqual([[15, 15, 100], [15, 15, 100]]);
  expect(results[0].verdicts.at(-1).played).toBe(exercise.midis[14]);
  expect(results[1].verdicts[0].played).toBe(exercise.midis[0]);
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
  // 68 ms is inside the old 70 ms tolerance, outside the new 66.67 ms.
  await advance(5982);
  clock.record(exercise.midis[0]);
  for (let i = 1; i < exercise.midis.length; i++) {
    const at = 6050 + i * (60000 / 21) / exercise.midis.length;
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

it("schedules fifteen clicks at the note grid through a 20-to-21 bpm cycle change", async () => {
  const exercise = makeArpeggio();
  const noteCount = exercise.midis.length;
  const clock = createArpeggioClock({ exercise, subdivisions: noteCount, bpm: 20, onCycle: () => 21 });
  await clock.start();
  await advance(9200);
  const nextBoundary = 16.05 + 60 / 21;
  const playing = audio.click.mock.calls.filter(([at]) => at >= 13.05 && at <= nextBoundary);
  const expected = [
    ...Array.from({ length: noteCount }, (_, i) => 13.05 + i * (3 / noteCount)),
    ...Array.from({ length: noteCount }, (_, i) => 16.05 + i * ((60 / 21) / noteCount)),
    nextBoundary,
  ];
  expect(playing).toHaveLength(expected.length);
  playing.forEach(([at], index) => expect(at).toBeCloseTo(expected[index], 8));
  expect(playing[0][1]).toBe(true);
  expect(playing.slice(1, noteCount).every(([, accent]) => !accent)).toBe(true);
  expect(playing[noteCount][1]).toBe(true);
  expect(playing.slice(noteCount + 1, 2 * noteCount).every(([, accent]) => !accent)).toBe(true);
  expect(playing.at(-1)[1]).toBe(true);
  clock.stop();
});

it("publishes partial credit and extras immediately and agrees with the final same-cycle result", async () => {
  const exercise = makeArpeggio();
  const snapshots = [];
  const results = [];
  const clock = createArpeggioClock({ exercise, onFeedback: snapshot => snapshots.push(snapshot),
    onCycle: result => { results.push(result); } });
  await clock.start();
  await advance(3050);
  clock.record(exercise.midis[0]);
  expect(snapshots.at(-1)).toMatchObject({ correct: 1, total: 15, percent: 7, extras: 0 });
  expect(snapshots.at(-1).verdicts[1].verdict).toBe("pending");
  clock.record(100);
  expect(snapshots.at(-1)).toMatchObject({ correct: 1, total: 15, percent: 7, extras: 1 });
  const unchangedCount = snapshots.length;
  await advance(10);
  expect(snapshots).toHaveLength(unchangedCount);
  await advance(6070 - performance.now());
  expect(results[0]).toMatchObject({ correct: 1, total: 15, percent: 7, extras: 1, hit: false });
  const finalSnapshot = snapshots.findLast(snapshot => snapshot.cycleId === results[0].cycleId);
  expect(finalSnapshot).toMatchObject({ correct: 1, total: 15, percent: 7, extras: 1 });
  expect(finalSnapshot.verdicts.slice(1).every(({ verdict }) => verdict === "missed")).toBe(true);
  clock.stop();
});
