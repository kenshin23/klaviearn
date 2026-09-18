// Guest-mode session builder. Logged in, the server builds sessions with
// the real SRS; this is the offline approximation. Both produce the same
// exercise shapes.
import {
  chordKey, chordSpec, EAR_CHORD_ROOTS, earKey, INTERVAL_NAMES, NOTES, itemKey, noteMeta, noteSpec,
  QUALITY_NAMES, RHYTHM_PATTERNS, techniqueSpec,
} from "./notes.js";

export const SESSION_LENGTH = 10;
export const PHRASE_COUNT = 5;
export const PHRASE_NOTES = 4;
export const TECHNIQUE_LENGTH = 4; // a scale is 15 notes; ten takes would be a chore

function weightFor(stats) {
  if (!stats || stats.seen === 0) return 2.5;
  const missRate = 1 - stats.correct / stats.seen;
  return Math.max(0.2, 1 + missRate * 3 - Math.min(stats.streak, 5) * 0.15);
}

export function buildSession(node, drill, noteStats, length = SESSION_LENGTH) {
  const entry = (item, meta) => ({ item, meta, weight: weightFor(noteStats[item]) });
  const pool = (() => {
    switch (node.kind) {
      case "rhythm":
        return node.patterns.map(pid =>
          entry(`rhythm:${pid}`, {
            name: RHYTHM_PATTERNS[pid].name,
            durations: RHYTHM_PATTERNS[pid].durations,
          }),
        );
      case "intervals":
        return node.sizes.map(size => entry(`int:${size}`, { size, name: INTERVAL_NAMES[size] }));
      case "chords":
        return node.triads.map(([root, quality]) =>
          entry(chordKey(root, quality), chordSpec(root, quality)),
        );
      case "technique":
        return node.patterns.map(p => entry(`tech:${p}`, techniqueSpec(p)));
      case "ear-pitch":
      case "ear-phrases":
        return node.midis.map(midi => entry(earKey(midi), noteSpec(midi)));
      case "ear-intervals":
        return node.sizes.map(size =>
          entry(`ear:int:${size}`, { size, name: INTERVAL_NAMES[size] }));
      case "ear-chords":
        return node.qualities.map(quality =>
          entry(`ear:qual:${quality}`, { quality, name: QUALITY_NAMES[quality] }));
      case "grand":
        return ["treble", "bass"].flatMap(clef =>
          Object.keys(NOTES[clef]).map(midi =>
            entry(`grand:${clef}:${midi}`, { ...noteMeta(clef, midi), grand: true }),
          ),
        );
      default:
        return node.midis.map(midi => entry(itemKey(node.clef, midi), noteMeta(node.clef, midi)));
    }
  })();

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

  if (drill === "interval" || drill === "ear-interval") {
    const scale = Object.keys(NOTES.treble).map(Number).sort((a, b) => a - b);
    const exercises = [];
    let prev = null;
    for (let i = 0; i < length; i++) {
      const p = pick(prev);
      prev = p.item;
      const base = Math.floor(Math.random() * (scale.length - p.meta.size + 1));
      const notes = [
        noteMeta("treble", scale[base]),
        noteMeta("treble", scale[base + p.meta.size - 1]),
      ];
      exercises.push({
        item: p.item,
        drill,
        level: 0,
        size: p.meta.size,
        name: p.meta.name,
        notes,
        midis: notes.map(n => n.midi),
      });
    }
    return exercises;
  }

  if (drill === "technique") {
    const exercises = [];
    let prev = null;
    for (let i = 0; i < TECHNIQUE_LENGTH; i++) {
      const p = pick(prev);
      prev = p.item;
      exercises.push({ item: p.item, drill, level: 0, ...p.meta });
    }
    return exercises;
  }

  if (drill === "ear-chord") {
    // A fresh root each time: the answer has to be the quality you hear, not
    // a chord you have memorised the pitch of.
    const exercises = [];
    let prev = null;
    for (let i = 0; i < length; i++) {
      const p = pick(prev);
      prev = p.item;
      const root = EAR_CHORD_ROOTS[Math.floor(Math.random() * EAR_CHORD_ROOTS.length)];
      exercises.push({ item: p.item, drill, level: 0, ...chordSpec(root, p.meta.quality) });
    }
    return exercises;
  }

  if (drill === "phrase" || drill === "ear-phrase" || drill === "phrase-timed") {
    const exercises = [];
    for (let i = 0; i < PHRASE_COUNT; i++) {
      const notes = [];
      let prev = null;
      for (let j = 0; j < PHRASE_NOTES; j++) {
        const p = pick(prev);
        prev = p.item;
        notes.push({ item: p.item, level: 0, ...p.meta });
      }
      exercises.push({ drill, level: 0, notes, midis: notes.map(n => n.midi) });
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
