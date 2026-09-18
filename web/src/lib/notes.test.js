import {
  CHORD_QUALITIES,
  LETTER_COLORS,
  LETTER_TO_MIDI,
  NOTES,
  RHYTHM_PATTERNS,
  SHARP_TO_MIDI,
  SKILL_NODES,
  chordKey,
  chordSpec,
  itemKey,
  midiToFreq,
  nodeItemKeys,
  noteMeta,
  noteName,
  noteSpec,
} from "./notes.js";

describe("noteSpec", () => {
  it.each([
    [60, "c/4", "C", ""],
    [61, "c#/4", "C", "#"],
    [66, "f#/4", "F", "#"],
    [68, "g#/4", "G", "#"],
    [71, "b/4", "B", ""],
    [72, "c/5", "C", ""],
    [21, "a/0", "A", ""],
    [108, "c/8", "C", ""],
  ])("spells %i as %s", (midi, key, letter, acc) => {
    expect(noteSpec(midi)).toMatchObject({ key, letter, acc, midi });
  });

  it("puts the octave boundary at C, not at A", () => {
    expect(noteSpec(59).key).toBe("b/3");
    expect(noteSpec(60).key).toBe("c/4");
  });

  it("keeps the base letter for sharps so the colour scaffold still applies", () => {
    expect(noteSpec(66).letter).toBe("F");
    expect(LETTER_COLORS[noteSpec(66).letter]).toBe(LETTER_COLORS.F);
  });

  it("defaults to the treble clef but accepts another", () => {
    expect(noteSpec(60).clef).toBe("treble");
    expect(noteSpec(48, "bass").clef).toBe("bass");
  });

  it("agrees with the hand-written NOTES table", () => {
    for (const [clef, table] of Object.entries(NOTES)) {
      for (const [midi, meta] of Object.entries(table)) {
        expect(noteSpec(Number(midi), clef).key).toBe(meta.key);
        expect(noteSpec(Number(midi), clef).letter).toBe(meta.letter);
      }
    }
  });
});

describe("the NOTES table", () => {
  it("stays diatonic — the interval drill indexes it as a scale", () => {
    for (const table of Object.values(NOTES)) {
      for (const meta of Object.values(table)) {
        expect(meta.key).not.toContain("#");
      }
    }
  });

  it("gives the treble drill the eight notes it expects", () => {
    expect(Object.keys(NOTES.treble).map(Number).sort((a, b) => a - b))
      .toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it("labels every note as a line or a space", () => {
    for (const table of Object.values(NOTES)) {
      for (const meta of Object.values(table)) {
        expect(["line", "space"]).toContain(meta.pos);
        expect(meta.posLabel).toBeTruthy();
      }
    }
  });
});

describe("chords", () => {
  it("builds major and minor triads from the right intervals", () => {
    expect(CHORD_QUALITIES.maj).toEqual([0, 4, 7]);
    expect(CHORD_QUALITIES.min).toEqual([0, 3, 7]);
    expect(chordSpec(60, "maj").midis).toEqual([60, 64, 67]);
    expect(chordSpec(60, "min").midis).toEqual([60, 63, 67]);
  });

  it.each([
    [60, "maj", "chord:C:maj", "C major"],
    [62, "min", "chord:D:min", "D minor"],
    [66, "maj", "chord:F#:maj", "F# major"],
  ])("keys and names %i %s", (root, quality, key, name) => {
    expect(chordKey(root, quality)).toBe(key);
    expect(chordSpec(root, quality).name).toBe(name);
  });

  it("treats a chord as the same item in any octave", () => {
    expect(chordKey(60, "maj")).toBe(chordKey(72, "maj"));
  });

  it("distinguishes qualities on the same root", () => {
    expect(chordKey(62, "maj")).not.toBe(chordKey(62, "min"));
  });

  it("spells the two sharp triads correctly", () => {
    expect(chordSpec(62, "maj").notes.map(n => n.key)).toEqual(["d/4", "f#/4", "a/4"]);
    expect(chordSpec(64, "maj").notes.map(n => n.key)).toEqual(["e/4", "g#/4", "b/4"]);
  });

  it("returns notes in root position, low to high", () => {
    for (const [root, quality] of SKILL_NODES.find(n => n.id === "chords").triads) {
      const { midis } = chordSpec(root, quality);
      expect(midis).toEqual([...midis].sort((a, b) => a - b));
    }
  });

  it("needs no flats for any shipped triad", () => {
    for (const [root, quality] of SKILL_NODES.find(n => n.id === "chords").triads) {
      for (const note of chordSpec(root, quality).notes) {
        expect(note.acc === "" || note.acc === "#").toBe(true);
      }
    }
  });
});

describe("the skill tree", () => {
  it("has unique node ids", () => {
    const ids = SKILL_NODES.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces item keys for every node kind", () => {
    for (const node of SKILL_NODES) {
      const keys = nodeItemKeys(node);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(key.length).toBeLessThanOrEqual(32);
    }
  });

  it("references only notes and patterns that exist", () => {
    for (const node of SKILL_NODES) {
      if (!node.kind) {
        for (const midi of node.midis) expect(NOTES[node.clef][midi]).toBeDefined();
      }
      if (node.kind === "rhythm") {
        for (const p of node.patterns) expect(RHYTHM_PATTERNS[p]).toBeDefined();
      }
    }
  });

  it("gives every rhythm pattern exactly one bar of 4/4", () => {
    const beats = { q: 1, h: 2, w: 4, 8: 0.5 };
    for (const [pid, pattern] of Object.entries(RHYTHM_PATTERNS)) {
      const total = pattern.durations.reduce((n, d) => n + beats[d.replace("r", "")], 0);
      expect(total, pid).toBe(4);
    }
  });
});

describe("the answer keyboard", () => {
  it("maps the seven naturals into one octave from middle C", () => {
    expect(LETTER_TO_MIDI).toEqual({ C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 });
  });

  it("maps the five black keys a semitone above their natural", () => {
    for (const [letter, midi] of Object.entries(SHARP_TO_MIDI)) {
      expect(midi).toBe(LETTER_TO_MIDI[letter] + 1);
      expect(noteSpec(midi).acc).toBe("#");
    }
  });

  it("covers the twelve pitch classes with no overlap", () => {
    const all = [...Object.values(LETTER_TO_MIDI), ...Object.values(SHARP_TO_MIDI)];
    expect(new Set(all.map(m => m % 12)).size).toBe(12);
  });

  it("has a colour for every natural letter", () => {
    for (const letter of Object.keys(LETTER_TO_MIDI)) {
      expect(LETTER_COLORS[letter]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("small helpers", () => {
  it("formats item keys as clef:midi", () => {
    expect(itemKey("treble", 60)).toBe("treble:60");
  });

  it("attaches the clef to note metadata", () => {
    expect(noteMeta("bass", 53)).toMatchObject({ clef: "bass", letter: "F", key: "f/3" });
  });

  it("names notes with their octave", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(66)).toBe("F#4");
  });

  it("converts MIDI to frequency around A440", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 3);
  });
});
