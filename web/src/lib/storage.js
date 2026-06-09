// All persistence for Phase 1 lives in one localStorage key.
const KEY = "klaviearn.v1";

export const DEFAULT_SETTINGS = {
  letters: true,      // letter name under the note
  colors: true,       // color-coded noteheads
  strictOctave: false, // off: any octave counts (kind to mic detection)
  staffSize: "large",  // "medium" | "large" | "huge"
};

const empty = () => ({ settings: { ...DEFAULT_SETTINGS }, noteStats: {}, sessions: [] });

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return {
      ...empty(),
      ...data,
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
    };
  } catch {
    return empty();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// First-try answer for one exercise → per-note stats used by the picker.
export function recordAnswer(state, midi, hit) {
  const s = state.noteStats[midi] ?? { seen: 0, correct: 0, streak: 0 };
  state.noteStats[midi] = {
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
    const s = state.noteStats[midi];
    if (s) { seen += s.seen; correct += s.correct; }
  }
  return seen === 0 ? null : correct / seen;
}
