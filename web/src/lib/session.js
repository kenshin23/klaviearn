// Guest-mode session builder. Logged in, the server builds sessions with
// the real SRS; this is the offline approximation. Both produce the same
// exercise shape: { item, drill, level, midi, clef, key, letter, pos, posLabel }.
import { itemKey, noteMeta } from "./notes.js";

export const SESSION_LENGTH = 10;

function weightFor(stats) {
  if (!stats || stats.seen === 0) return 2.5;
  const missRate = 1 - stats.correct / stats.seen;
  return Math.max(0.2, 1 + missRate * 3 - Math.min(stats.streak, 5) * 0.15);
}

export function buildSession(node, drill, noteStats, length = SESSION_LENGTH) {
  const pool = node.midis.map(midi => {
    const item = itemKey(node.clef, midi);
    return { item, meta: noteMeta(node.clef, midi), weight: weightFor(noteStats[item]) };
  });
  const exercises = [];
  let prev = null;
  for (let i = 0; i < length; i++) {
    const candidates = pool.length > 1 && prev ? pool.filter(c => c.item !== prev) : pool;
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * total;
    let picked = candidates[candidates.length - 1];
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) { picked = c; break; }
    }
    exercises.push({ item: picked.item, drill, level: 0, ...picked.meta });
    prev = picked.item;
  }
  return exercises;
}
