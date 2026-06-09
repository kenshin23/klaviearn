// Guest-mode session builder. Logged in, the server builds sessions with
// the real SRS; this is the offline approximation. Both produce the same
// exercise shapes.
import { INTERVAL_NAMES, NOTES, itemKey, noteMeta, RHYTHM_PATTERNS } from "./notes.js";

export const SESSION_LENGTH = 10;
export const PHRASE_COUNT = 5;
export const PHRASE_NOTES = 4;

function weightFor(stats) {
  if (!stats || stats.seen === 0) return 2.5;
  const missRate = 1 - stats.correct / stats.seen;
  return Math.max(0.2, 1 + missRate * 3 - Math.min(stats.streak, 5) * 0.15);
}

export function buildSession(node, drill, noteStats, length = SESSION_LENGTH) {
  const pool =
    node.kind === "rhythm"
      ? node.patterns.map(pid => ({
          item: `rhythm:${pid}`,
          meta: { name: RHYTHM_PATTERNS[pid].name, durations: RHYTHM_PATTERNS[pid].durations },
          weight: weightFor(noteStats[`rhythm:${pid}`]),
        }))
      : node.kind === "intervals"
        ? node.sizes.map(size => ({
            item: `int:${size}`,
            meta: { size, name: INTERVAL_NAMES[size] },
            weight: weightFor(noteStats[`int:${size}`]),
          }))
        : node.kind === "grand"
          ? ["treble", "bass"].flatMap(clef =>
              Object.keys(NOTES[clef]).map(midi => ({
                item: `grand:${clef}:${midi}`,
                meta: { ...noteMeta(clef, midi), grand: true },
                weight: weightFor(noteStats[`grand:${clef}:${midi}`]),
              })),
            )
          : node.midis.map(midi => {
              const item = itemKey(node.clef, midi);
              return { item, meta: noteMeta(node.clef, midi), weight: weightFor(noteStats[item]) };
            });

  function pick(prev) {
    const candidates = pool.length > 1 && prev ? pool.filter(c => c.item !== prev) : pool;
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return candidates[candidates.length - 1];
  }

  if (drill === "interval") {
    const scale = Object.keys(NOTES.treble).map(Number).sort((a, b) => a - b);
    const exercises = [];
    let prev = null;
    for (let i = 0; i < length; i++) {
      const p = pick(prev);
      prev = p.item;
      const base = Math.floor(Math.random() * (scale.length - p.meta.size + 1));
      exercises.push({
        item: p.item,
        drill: "interval",
        level: 0,
        size: p.meta.size,
        name: p.meta.name,
        notes: [noteMeta("treble", scale[base]), noteMeta("treble", scale[base + p.meta.size - 1])],
      });
    }
    return exercises;
  }

  if (drill === "phrase") {
    const exercises = [];
    for (let i = 0; i < PHRASE_COUNT; i++) {
      const notes = [];
      let prev = null;
      for (let j = 0; j < PHRASE_NOTES; j++) {
        const p = pick(prev);
        prev = p.item;
        notes.push({ item: p.item, level: 0, ...p.meta });
      }
      exercises.push({ drill: "phrase", level: 0, notes });
    }
    return exercises;
  }

  const exercises = [];
  let prev = null;
  for (let i = 0; i < length; i++) {
    const p = pick(prev);
    prev = p.item;
    exercises.push({ item: p.item, drill, level: 0, ...p.meta });
  }
  return exercises;
}
