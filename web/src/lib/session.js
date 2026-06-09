import { NOTE_BY_MIDI } from "./notes.js";

export const SESSION_LENGTH = 10;

// Weighted pick: unseen and recently-missed notes show up more; notes on a
// long correct streak fade into the background. A baby version of the SRS
// engine planned for Phase 2.
function weightFor(stats) {
  if (!stats || stats.seen === 0) return 2.5;
  const missRate = 1 - stats.correct / stats.seen;
  return Math.max(0.2, 1 + missRate * 3 - Math.min(stats.streak, 5) * 0.15);
}

export function buildSession(node, drill, noteStats, length = SESSION_LENGTH) {
  const pool = node.midis.map(m => ({
    note: NOTE_BY_MIDI[m],
    weight: weightFor(noteStats[m]),
  }));
  const exercises = [];
  let prev = null;
  for (let i = 0; i < length; i++) {
    let candidates = pool;
    if (pool.length > 1 && prev) {
      candidates = pool.filter(c => c.note.midi !== prev.midi); // no repeats back to back
    }
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * total;
    let picked = candidates[candidates.length - 1].note;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) { picked = c.note; break; }
    }
    exercises.push({ drill, note: picked });
    prev = picked;
  }
  return exercises;
}
