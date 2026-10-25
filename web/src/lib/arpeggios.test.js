import {
  advanceSpeed, ARPEGGIO_PRESETS, expectedCycle, makeArpeggio, scoreCycle,
  DEFAULT_NOTE_BPM, DEFAULT_STEP_BPM, NOTE_BPM_MAX, NOTE_BPM_MIN,
  normalizePracticeSettings, speedKey, speedProgress, summarizeCycle, tempoForExercise,
} from "./arpeggios.js";

const exercise = makeArpeggio();
const perfect = expectedCycle(exercise).map(event => ({ at: event.at, midi: event.midis[0] }));

describe("Db major arpeggio model", () => {
  it("spells the left-hand pattern with flats, one apex, and the intended fingering", () => {
    expect(ARPEGGIO_PRESETS[0]).toMatchObject({
      id: "db-major-lh", name: "Db major", hand: "lh", clef: "bass", baseMidi: 37,
    });
    expect(exercise.midis).toEqual([37, 44, 49, 53, 56, 61, 65, 68, 65, 61, 56, 53, 49, 44, 37]);
    expect(exercise.fingers).toEqual([5, 3, 2, 1, 4, 2, 1, 2, 1, 2, 4, 1, 2, 3, 5]);
    expect(exercise.notes.map(note => `${note.letter}${note.acc}`)).toEqual([
      "Db", "Ab", "Db", "F", "Ab", "Db", "F", "Ab", "F",
      "Db", "Ab", "F", "Db", "Ab", "Db",
    ]);
    expect(exercise.midis.filter(midi => midi === 68)).toHaveLength(1);
    expect(exercise.midis.slice(7, 9)).toEqual([68, 65]);
    expect(exercise.notes[0]).toMatchObject({ key: "d/2", written: "b", clef: "bass" });
    expect(exercise).not.toHaveProperty("key");
  });

  it("puts all 15 attacks inside one cycle beat", () => {
    const expected = expectedCycle(exercise);
    expect(expected).toHaveLength(15);
    expect(expected.map(event => event.at)).toEqual(Array.from({ length: 15 }, (_, i) => i / 15));
    expect(expected.at(-1).at).toBeLessThan(1);
  });

  it("scores exact pitch and octave with the narrow cycle tolerance", () => {
    expect(scoreCycle(exercise, perfect).hit).toBe(true);
    expect(scoreCycle(exercise, perfect.map(event => ({ ...event, midi: event.midi + 12 }))).hit).toBe(false);
    const slightlyEarly = perfect.map(event => ({ ...event, at: event.at - 0.02 / 15 }));
    expect(scoreCycle(exercise, slightlyEarly).hit).toBe(true);
  });

  it("rejects wrong pitches, missing notes, extras, bursts, and a next-cycle attack", () => {
    const wrong = perfect.map(event => ({ ...event }));
    wrong[4].midi += 1;
    expect(scoreCycle(exercise, wrong).hit).toBe(false);
    expect(scoreCycle(exercise, perfect.slice(1)).hit).toBe(false);
    expect(scoreCycle(exercise, [...perfect, { at: 0.5, midi: 50 }]).hit).toBe(false);
    const burst = perfect.flatMap(event => [event, { ...event, at: event.at + 0.001 }]);
    expect(scoreCycle(exercise, burst).hit).toBe(false);
    expect(scoreCycle(exercise, [...perfect, { at: 1, midi: exercise.midis[0] }]).hit).toBe(false);
    expect(scoreCycle(exercise, [...perfect.slice(0, 8), perfect[7], ...perfect.slice(8)]).hit).toBe(false);
  });

  it("summarizes accepted notes and distinguishes wrong, missed, and extra notes", () => {
    const result = scoreCycle(exercise, [
      ...perfect.slice(0, 4),
      { ...perfect[4], midi: perfect[4].midi + 12 },
      ...perfect.slice(6),
      { at: 0.52, midi: 90 },
    ]);
    expect(summarizeCycle(result)).toEqual({
      correct: 13, total: 15, percent: 87, wrong: 1, missed: 1, extras: 1,
    });
    expect(summarizeCycle(scoreCycle(exercise, perfect))).toEqual({
      correct: 15, total: 15, percent: 100, wrong: 0, missed: 0, extras: 0,
    });
  });

  it("validates preset notation, fingers, octave, and MIDI bounds", () => {
    expect(() => makeArpeggio({ ...ARPEGGIO_PRESETS[0], steps: [{ ...ARPEGGIO_PRESETS[0].steps[0], finger: 6 }] })).toThrow();
    expect(() => makeArpeggio({ ...ARPEGGIO_PRESETS[0], steps: [{ ...ARPEGGIO_PRESETS[0].steps[0], letter: "H" }] })).toThrow();
    expect(() => makeArpeggio(ARPEGGIO_PRESETS[0], 10)).toThrow();
    expect(() => makeArpeggio(ARPEGGIO_PRESETS[0], 9)).toThrow();
  });
});

describe("speed progression", () => {
  it("sanitizes saved values and ignores persisted streak", () => {
    expect(speedProgress()).toEqual({ bpm: 20, bestBpm: 0, streak: 0 });
    expect(speedProgress({ bpm: 5000, bestBpm: -3, streak: 99 })).toEqual({ bpm: 1800, bestBpm: 0, streak: 0 });
    expect(speedProgress({ bpm: "fast", bestBpm: NaN })).toEqual({ bpm: 20, bestBpm: 0, streak: 0 });
    expect(speedProgress({ bpm: 23.5, bestBpm: 22.25 })).toEqual({ bpm: 23.5, bestBpm: 22.25, streak: 0 });
    expect([NOTE_BPM_MIN, NOTE_BPM_MAX, DEFAULT_NOTE_BPM, DEFAULT_STEP_BPM]).toEqual([20, 1800, 20, 4]);
  });

  it("requires five clean cycles, resets after a miss, and records only confirmed speed", () => {
    let progress = speedProgress();
    for (let i = 0; i < 4; i++) progress = advanceSpeed(progress, true);
    expect(progress).toEqual({ bpm: 20, bestBpm: 0, streak: 4 });
    progress = advanceSpeed(progress, false);
    expect(progress).toEqual({ bpm: 20, bestBpm: 0, streak: 0 });
    for (let i = 0; i < 5; i++) progress = advanceSpeed(progress, true);
    expect(progress).toEqual({ bpm: 24, bestBpm: 20, streak: 0 });
    for (let i = 0; i < 5; i++) progress = advanceSpeed(progress, true);
    expect(progress).toEqual({ bpm: 28, bestBpm: 24, streak: 0 });
  });

  it("caps speed and handles malformed progression configuration", () => {
    let progress = { bpm: 1799, bestBpm: 1799, streak: 4 };
    progress = advanceSpeed(progress, true, { stepBpm: 5, cleanTarget: 5 });
    expect(progress).toEqual({ bpm: 1800, bestBpm: 1799, streak: 0 });
    expect(advanceSpeed({ bpm: 20 }, true, { stepBpm: NaN, cleanTarget: Infinity }))
      .toEqual({ bpm: 20, bestBpm: 0, streak: 1 });
    expect(advanceSpeed({ bpm: 30, streak: 0 }, true, { stepBpm: 0.5, cleanTarget: 1 }))
      .toEqual({ bpm: 30.5, bestBpm: 30, streak: 0 });
    expect(speedKey("db-major-lh", 2)).toBe("db-major-lh:2");
  });
});

describe("tempo and saved settings", () => {
  it("converts note BPM to cycle clock timing", () => {
    expect(tempoForExercise(75, exercise)).toEqual({
      noteBpm: 75, cycleBpm: 5, cycleSeconds: 12, noteSeconds: 0.8, countInSeconds: 3.2,
    });
    expect(() => tempoForExercise(75, { midis: [] })).toThrow(RangeError);
    expect(() => tempoForExercise(75, {})).toThrow(RangeError);
  });

  it("migrates legacy progress per preset and octave without mutating settings", () => {
    const raw = {
      stepBpm: 1,
      progress: {
        "db-major-lh:1": { bpm: 5, bestBpm: 6, streak: 4, note: "kept" },
        "db-major-lh:2": { bpm: 20, bestBpm: 0 },
        "db-major-lh:3": { bpm: 121, bestBpm: 130 },
        "future-preset:2": { bpm: 8, bestBpm: 7 },
      },
      unrelated: "kept",
    };
    const original = structuredClone(raw);
    const normalized = normalizePracticeSettings(raw);
    expect(normalized).toMatchObject({ tempoUnit: "note-bpm", stepBpm: 4, cleanTarget: 5 });
    expect(normalized.progress).toEqual({
      "db-major-lh:1": { bpm: 75, bestBpm: 90, streak: 4, note: "kept" },
      "db-major-lh:2": { bpm: 300, bestBpm: 0 },
      "db-major-lh:3": { bpm: 1800, bestBpm: 1800 },
      "future-preset:2": { bpm: 8, bestBpm: 7 },
    });
    expect(raw).toEqual(original);
    const migratedAgain = normalizePracticeSettings({ ...normalized });
    expect(migratedAgain.progress).toEqual(normalized.progress);
    expect(migratedAgain.stepBpm).toBe(4);
    expect(normalizePracticeSettings({ progress: { "db-major-lh:2": { bpm: 0, bestBpm: 0 } } })
      .progress["db-major-lh:2"]).toEqual({ bpm: 75, bestBpm: 0 });
  });

  it("preserves explicit note BPM and normalizes practice controls", () => {
    expect(normalizePracticeSettings({
      tempoUnit: "note-bpm",
      presetId: "missing",
      octave: 8,
      stepBpm: 0.5,
      cleanTarget: 1.8,
      clickMode: "bad",
      progress: { "db-major-lh:2": { bpm: 75, bestBpm: 60 } },
    })).toEqual({
      presetId: "db-major-lh", octave: 4, stepBpm: 0.5, cleanTarget: 1,
      clickMode: "notes", tempoUnit: "note-bpm",
      progress: { "db-major-lh:2": { bpm: 75, bestBpm: 60 } },
    });
    expect(normalizePracticeSettings({ tempoUnit: "note-bpm", stepBpm: 90 }).stepBpm).toBe(60);
    expect(normalizePracticeSettings({ tempoUnit: "note-bpm", stepBpm: -5 }).stepBpm).toBe(0.5);
    expect(normalizePracticeSettings({ tempoUnit: "note-bpm", stepBpm: 1 }).stepBpm).toBe(1);
  });
});
