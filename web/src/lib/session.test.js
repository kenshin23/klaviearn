import {
  PHRASE_COUNT, PHRASE_NOTES, SESSION_LENGTH, TECHNIQUE_LENGTH, buildSession,
} from "./session.js";
import { NOTES, SKILL_NODES, chordKey, nodeItemKeys } from "./notes.js";

const node = id => SKILL_NODES.find(n => n.id === id);
const NO_STATS = {};

describe("session length", () => {
  it.each([
    ["octave", "note", SESSION_LENGTH],
    ["octave", "linespace", SESSION_LENGTH],
    ["octave", "phrase", PHRASE_COUNT],
    ["rhythm-eighths", "rhythm", SESSION_LENGTH],
    ["intervals", "interval", SESSION_LENGTH],
    ["grand", "note", SESSION_LENGTH],
    ["chords", "chord", SESSION_LENGTH],
  ])("%s / %s builds %i exercises", (id, drill, count) => {
    expect(buildSession(node(id), drill, NO_STATS)).toHaveLength(count);
  });

  it("honours an explicit length", () => {
    expect(buildSession(node("octave"), "note", NO_STATS, 3)).toHaveLength(3);
  });
});

describe("exercise shape", () => {
  it("tags each exercise with its drill and a valid item key", () => {
    for (const [id, drill] of [["octave", "note"], ["chords", "chord"], ["intervals", "interval"]]) {
      const valid = new Set(nodeItemKeys(node(id)));
      for (const ex of buildSession(node(id), drill, NO_STATS)) {
        expect(ex.drill).toBe(drill);
        expect(valid.has(ex.item)).toBe(true);
      }
    }
  });

  it("draws chord exercises as playable root-position triads", () => {
    const valid = new Set(node("chords").triads.map(([r, q]) => chordKey(r, q)));
    for (const ex of buildSession(node("chords"), "chord", NO_STATS)) {
      expect(valid.has(ex.item)).toBe(true);
      expect(ex.midis).toHaveLength(3);
      expect(ex.notes).toHaveLength(3);
      expect(ex.midis).toEqual([...ex.midis].sort((a, b) => a - b));
      expect(ex.quality).toMatch(/^(maj|min)$/);
      expect(ex.rootName).toBeTruthy();
    }
  });

  it("draws phrases of four notes from the node's own pool", () => {
    for (const ex of buildSession(node("octave"), "phrase", NO_STATS)) {
      expect(ex.notes).toHaveLength(PHRASE_NOTES);
      for (const n of ex.notes) expect(NOTES.treble[n.midi]).toBeDefined();
    }
  });

  it("spans the named distance in interval exercises", () => {
    const scale = Object.keys(NOTES.treble).map(Number).sort((a, b) => a - b);
    for (const ex of buildSession(node("intervals"), "interval", NO_STATS)) {
      const [low, high] = ex.notes.map(n => n.midi);
      expect(scale.indexOf(high) - scale.indexOf(low)).toBe(ex.size - 1);
    }
  });

  it("gives rhythm exercises a pattern to tap", () => {
    for (const ex of buildSession(node("rhythm-steady"), "rhythm", NO_STATS)) {
      expect(ex.durations.length).toBeGreaterThan(0);
      expect(ex.name).toBeTruthy();
    }
  });

  it("marks grand-staff notes so the right staff renders", () => {
    for (const ex of buildSession(node("grand"), "note", NO_STATS)) {
      expect(ex.grand).toBe(true);
      expect(["treble", "bass"]).toContain(ex.clef);
    }
  });
});

describe("item ordering", () => {
  it("never shows the same item twice in a row", () => {
    const items = buildSession(node("octave"), "note", NO_STATS, 60).map(e => e.item);
    for (let i = 1; i < items.length; i++) expect(items[i]).not.toBe(items[i - 1]);
  });

  it("does not repeat a note back-to-back inside a phrase", () => {
    for (const ex of buildSession(node("octave"), "phrase", NO_STATS)) {
      for (let i = 1; i < ex.notes.length; i++) {
        expect(ex.notes[i].item).not.toBe(ex.notes[i - 1].item);
      }
    }
  });

  it("copes with a single-item pool without looping forever", () => {
    const solo = { id: "solo", clef: "treble", midis: [60] };
    const items = buildSession(solo, "note", NO_STATS, 5).map(e => e.item);
    expect(items).toEqual(Array(5).fill("treble:60"));
  });
});

describe("weighting by past performance", () => {
  it("favours the note you keep missing", () => {
    const stats = {
      "treble:60": { seen: 20, correct: 1, streak: 0 },
      "treble:67": { seen: 20, correct: 20, streak: 5 },
    };
    const items = buildSession(node("guide"), "note", stats, 400).map(e => e.item);
    const missed = items.filter(i => i === "treble:60").length;
    // Alternation is forced with a two-item pool, so compare against a third
    // item instead: add one and check the weak note still dominates it.
    expect(missed).toBeGreaterThan(0);

    const threeWay = buildSession(node("steps"), "note", stats, 600).map(e => e.item);
    const weak = threeWay.filter(i => i === "treble:60").length;
    const strong = threeWay.filter(i => i === "treble:67").length;
    expect(weak).toBeGreaterThan(strong);
  });

  it("introduces unseen notes eagerly", () => {
    const stats = { "treble:60": { seen: 50, correct: 50, streak: 5 } };
    const items = buildSession(node("steps"), "note", stats, 600).map(e => e.item);
    const seenNote = items.filter(i => i === "treble:60").length;
    const newNote = items.filter(i => i === "treble:64").length;
    expect(newNote).toBeGreaterThan(seenNote);
  });

  it("ignores stats for items outside the node", () => {
    const stats = { "bass:53": { seen: 10, correct: 0, streak: 0 } };
    expect(() => buildSession(node("guide"), "note", stats)).not.toThrow();
  });
});

describe("the ear track", () => {
  it.each([
    ["ear-pitch", "ear-pitch", SESSION_LENGTH],
    ["ear-intervals", "ear-interval", SESSION_LENGTH],
    ["ear-chords", "ear-chord", SESSION_LENGTH],
    ["ear-phrases", "ear-phrase", PHRASE_COUNT],
  ])("%s builds %i exercises offline too", (id, drill, count) => {
    expect(buildSession(node(id), drill, NO_STATS)).toHaveLength(count);
  });

  it("gives every ear exercise something to play", () => {
    for (const [id, drill] of [
      ["ear-pitch", "ear-pitch"], ["ear-intervals", "ear-interval"],
      ["ear-chords", "ear-chord"], ["ear-phrases", "ear-phrase"],
    ]) {
      for (const ex of buildSession(node(id), drill, NO_STATS)) {
        const midis = ex.midis ?? [ex.midi];
        expect(midis.length, drill).toBeGreaterThan(0);
        expect(midis.every(m => m >= 21 && m <= 108), drill).toBe(true);
        expect(ex.drill).toBe(drill);
      }
    }
  });

  it.each([
    ["ear-pitch", "ear-pitch"],
    ["ear-intervals", "ear-interval"],
    ["ear-chords", "ear-chord"],
  ])("draws %s items from its own pool", (id, drill) => {
    const valid = new Set(nodeItemKeys(node(id)));
    const items = buildSession(node(id), drill, NO_STATS).map(e => e.item);
    expect(items).not.toContain(undefined);
    for (const item of items) expect(valid.has(item), item).toBe(true);
  });

  it("keeps ear progress out of the reading track's items", () => {
    const ear = buildSession(node("ear-pitch"), "ear-pitch", NO_STATS).map(e => e.item);
    expect(ear.every(i => i.startsWith("ear:"))).toBe(true);
  });

  it("moves the root of the quality drill around", () => {
    const roots = new Set(
      buildSession(node("ear-chords"), "ear-chord", NO_STATS, 60).map(e => e.root),
    );
    expect(roots.size).toBeGreaterThan(1);
  });

  it("builds the triad its item names", () => {
    for (const ex of buildSession(node("ear-chords"), "ear-chord", NO_STATS, 30)) {
      const [root, third, fifth] = ex.midis;
      expect(fifth - root).toBe(7);
      expect(third - root).toBe(ex.quality === "maj" ? 4 : 3);
      expect(ex.item).toBe(`ear:qual:${ex.quality}`);
    }
  });

  it("spans the named distance in ear intervals", () => {
    const scale = Object.keys(NOTES.treble).map(Number).sort((a, b) => a - b);
    for (const ex of buildSession(node("ear-intervals"), "ear-interval", NO_STATS)) {
      const [low, high] = ex.midis;
      expect(scale.indexOf(high) - scale.indexOf(low)).toBe(ex.size - 1);
    }
  });

  it("gives ear phrases four notes and their midis", () => {
    for (const ex of buildSession(node("ear-phrases"), "ear-phrase", NO_STATS)) {
      expect(ex.notes).toHaveLength(PHRASE_NOTES);
      expect(ex.midis).toEqual(ex.notes.map(n => n.midi));
    }
  });
});

describe("the technique track", () => {
  it.each(["technique-5finger", "technique-scales", "technique-arpeggios"])(
    "%s builds a handful of takes offline too", id => {
      expect(buildSession(node(id), "technique", NO_STATS)).toHaveLength(TECHNIQUE_LENGTH);
    });

  it("carries the pattern, its fingering and its notes", () => {
    for (const ex of buildSession(node("technique-scales"), "technique", NO_STATS)) {
      expect(ex.drill).toBe("technique");
      expect(ex.item.startsWith("tech:")).toBe(true);
      expect(ex.midis).toHaveLength(ex.fingers.length);
      expect(ex.notes).toHaveLength(ex.midis.length);
      expect(["rh", "lh"]).toContain(ex.hand);
    }
  });

  it("alternates hands rather than drilling one", () => {
    const hands = new Set(
      buildSession(node("technique-scales"), "technique", NO_STATS, 40).map(e => e.hand),
    );
    expect(hands).toEqual(new Set(["rh", "lh"]));
  });

  it("draws technique items from its own namespace", () => {
    const valid = new Set(nodeItemKeys(node("technique-arpeggios")));
    for (const ex of buildSession(node("technique-arpeggios"), "technique", NO_STATS)) {
      expect(valid.has(ex.item)).toBe(true);
    }
  });
});

describe("timed phrase reading", () => {
  it("builds the same phrases as the untimed drill", () => {
    const timed = buildSession(node("octave"), "phrase-timed", NO_STATS);
    expect(timed).toHaveLength(PHRASE_COUNT);
    for (const ex of timed) {
      expect(ex.drill).toBe("phrase-timed");
      expect(ex.notes).toHaveLength(PHRASE_NOTES);
      expect(ex.midis).toEqual(ex.notes.map(n => n.midi));
    }
  });
});
