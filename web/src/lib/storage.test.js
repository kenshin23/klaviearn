import {
  DEFAULT_SETTINGS,
  loadState,
  nodeAccuracy,
  recordAnswer,
  recordSession,
  saveState,
} from "./storage.js";
import { SKILL_NODES } from "./notes.js";

const KEY = "klaviearn.v1";
const node = id => SKILL_NODES.find(n => n.id === id);

beforeEach(() => localStorage.clear());

describe("loadState", () => {
  it("starts empty with the default settings", () => {
    const state = loadState();
    expect(state.settings).toMatchObject({
      scaffold: DEFAULT_SETTINGS.scaffold,
      strictOctave: DEFAULT_SETTINGS.strictOctave,
      staffSize: DEFAULT_SETTINGS.staffSize,
    });
    expect(state.noteStats).toEqual({});
    expect(state.sessions).toEqual([]);
  });

  it("round-trips through saveState", () => {
    const state = loadState();
    recordAnswer(state, "treble:60", true);
    state.settings.staffSize = "huge";
    saveState(state);

    const reloaded = loadState();
    expect(reloaded.noteStats["treble:60"]).toEqual({ seen: 1, correct: 1, streak: 1 });
    expect(reloaded.settings.staffSize).toBe("huge");
  });

  it("survives corrupt storage rather than crashing the app", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadState().noteStats).toEqual({});
  });

  it("fills in settings added after the save was written", () => {
    localStorage.setItem(KEY, JSON.stringify({ settings: { staffSize: "medium" } }));
    const state = loadState();
    expect(state.settings.staffSize).toBe("medium");
    expect(state.settings.scaffold).toBe(DEFAULT_SETTINGS.scaffold);
  });
});

describe("migrations from earlier versions", () => {
  it("maps the phase-1 letters/colors toggles onto scaffold modes", () => {
    localStorage.setItem(KEY, JSON.stringify({ settings: { letters: true, colors: true } }));
    const state = loadState();
    expect(state.settings.scaffold).toBe("full");
    expect(state.settings.letters).toBeUndefined();
    expect(state.settings.colors).toBeUndefined();
  });

  it("maps colors-without-letters onto the colours mode", () => {
    localStorage.setItem(KEY, JSON.stringify({ settings: { letters: false, colors: true } }));
    expect(loadState().settings.scaffold).toBe("colors");
  });

  it("maps neither onto plain notation", () => {
    localStorage.setItem(KEY, JSON.stringify({ settings: { letters: false, colors: false } }));
    expect(loadState().settings.scaffold).toBe("plain");
  });

  it("re-keys phase-1 bare-midi stats as treble:<midi>", () => {
    localStorage.setItem(KEY, JSON.stringify({ noteStats: { 60: { seen: 4, correct: 3, streak: 1 } } }));
    const state = loadState();
    expect(state.noteStats["treble:60"]).toEqual({ seen: 4, correct: 3, streak: 1 });
    expect(state.noteStats["60"]).toBeUndefined();
  });

  it("leaves already-migrated keys alone", () => {
    localStorage.setItem(KEY, JSON.stringify({ noteStats: { "bass:53": { seen: 1, correct: 1, streak: 1 } } }));
    expect(loadState().noteStats["bass:53"].seen).toBe(1);
  });
});

describe("recordAnswer", () => {
  it("counts a first correct answer", () => {
    const state = loadState();
    recordAnswer(state, "treble:60", true);
    expect(state.noteStats["treble:60"]).toEqual({ seen: 1, correct: 1, streak: 1 });
  });

  it("accumulates and grows the streak", () => {
    const state = loadState();
    for (let i = 0; i < 3; i++) recordAnswer(state, "treble:60", true);
    expect(state.noteStats["treble:60"]).toEqual({ seen: 3, correct: 3, streak: 3 });
  });

  it("resets the streak on a miss but keeps the history", () => {
    const state = loadState();
    recordAnswer(state, "treble:60", true);
    recordAnswer(state, "treble:60", false);
    expect(state.noteStats["treble:60"]).toEqual({ seen: 2, correct: 1, streak: 0 });
  });

  it("tracks items independently", () => {
    const state = loadState();
    recordAnswer(state, "treble:60", true);
    recordAnswer(state, "chord:C:maj", false);
    expect(state.noteStats["treble:60"].correct).toBe(1);
    expect(state.noteStats["chord:C:maj"].correct).toBe(0);
  });
});

describe("recordSession", () => {
  it("appends a dated entry", () => {
    const state = loadState();
    recordSession(state, { nodeId: "guide", drill: "note", ok: 9, total: 10 });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]).toMatchObject({ nodeId: "guide", drill: "note", ok: 9, total: 10 });
    expect(Date.parse(state.sessions[0].date)).not.toBeNaN();
  });
});

describe("nodeAccuracy", () => {
  it("is null before anything is practised", () => {
    expect(nodeAccuracy(loadState(), node("guide"))).toBeNull();
  });

  it("averages over the node's items", () => {
    const state = loadState();
    recordAnswer(state, "treble:60", true);
    recordAnswer(state, "treble:60", true);
    recordAnswer(state, "treble:67", false);
    recordAnswer(state, "treble:67", false);
    expect(nodeAccuracy(state, node("guide"))).toBe(0.5);
  });

  it("ignores stats belonging to other nodes", () => {
    const state = loadState();
    recordAnswer(state, "treble:60", true);
    recordAnswer(state, "bass:53", false);
    expect(nodeAccuracy(state, node("guide"))).toBe(1);
  });

  // Regression: this read node.midis, which only note nodes have. Every other
  // kind threw a TypeError and took the whole guest home screen down with it.
  it.each(SKILL_NODES.map(n => [n.id, n]))("works for the %s node", (_id, skillNode) => {
    expect(() => nodeAccuracy(loadState(), skillNode)).not.toThrow();
  });

  it("scores a rhythm node from its pattern keys", () => {
    const state = loadState();
    recordAnswer(state, "rhythm:r-quarters", true);
    recordAnswer(state, "rhythm:r-halves", false);
    expect(nodeAccuracy(state, node("rhythm-steady"))).toBe(0.5);
  });

  it("scores a chord node from its chord keys", () => {
    const state = loadState();
    recordAnswer(state, "chord:C:maj", true);
    recordAnswer(state, "chord:D:maj", true);
    expect(nodeAccuracy(state, node("chords"))).toBe(1);
  });

  it("scores an interval node from its size keys", () => {
    const state = loadState();
    recordAnswer(state, "int:3", false);
    expect(nodeAccuracy(state, node("intervals"))).toBe(0);
  });
});
