// Guest-mode persistence: one localStorage key. Logged in, the server owns
// all of this and these helpers aren't used.
import { itemKey } from "./notes.js";

const KEY = "klaviearn.v1";

export const DEFAULT_SETTINGS = {
  scaffold: "auto",    // auto (fade with mastery) | full | colors | plain
  strictOctave: false, // off: any octave counts (kind to mic detection)
  staffSize: "large",  // medium | large | huge
};

const empty = () => ({ settings: { ...DEFAULT_SETTINGS }, noteStats: {}, sessions: [] });

function migrate(data) {
  const s = data.settings ?? {};
  if ("letters" in s || "colors" in s) {
    // Phase 1 had independent letters/colors toggles; map them onto modes.
    s.scaffold = s.letters ? "full" : s.colors ? "colors" : "plain";
    delete s.letters;
    delete s.colors;
  }
  for (const k of Object.keys(data.noteStats ?? {})) {
    if (/^\d+$/.test(k)) {
      // Phase 1 keyed stats by bare midi (treble-only); now "clef:midi".
      data.noteStats[itemKey("treble", k)] = data.noteStats[k];
      delete data.noteStats[k];
    }
  }
  return data;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = migrate(JSON.parse(raw));
    return { ...empty(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
  } catch {
    return empty();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function recordAnswer(state, item, hit) {
  const s = state.noteStats[item] ?? { seen: 0, correct: 0, streak: 0 };
  state.noteStats[item] = {
    seen: s.seen + 1,
    correct: s.correct + (hit ? 1 : 0),
    streak: hit ? s.streak + 1 : 0,
  };
}

export function recordSession(state, { nodeId, drill, ok, total }) {
  state.sessions.push({ date: new Date().toISOString(), nodeId, drill, ok, total });
}

export function nodeAccuracy(state, node) {
  let seen = 0, correct = 0;
  for (const midi of node.midis) {
    const s = state.noteStats[itemKey(node.clef, midi)];
    if (s) { seen += s.seen; correct += s.correct; }
  }
  return seen === 0 ? null : correct / seen;
}
