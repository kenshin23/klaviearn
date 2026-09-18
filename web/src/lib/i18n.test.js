import {
  SOLFEGE,
  chordLabel,
  nodeText,
  noteLabel,
  noteName,
  posLabel,
  rhythmName,
  setLocale,
  t,
} from "./i18n.js";
import { NOTES, RHYTHM_PATTERNS, SKILL_NODES } from "./notes.js";

// Locale is module state, so every test sets it explicitly.
beforeEach(() => setLocale("en", "letters"));

describe("note labels", () => {
  it("uses letters in English", () => {
    expect(noteLabel("G")).toBe("G");
    expect(noteName(67)).toBe("G4");
  });

  it("uses solfège when asked", () => {
    setLocale("es", "solfege");
    expect(noteLabel("G")).toBe("Sol");
    expect(noteName(67)).toBe("Sol4");
  });

  it("keeps the sharp when translating to solfège", () => {
    setLocale("es", "solfege");
    expect(noteName(66)).toBe("Fa#4");
  });

  it("allows a Spanish interface with letter names", () => {
    setLocale("es", "letters");
    expect(noteLabel("G")).toBe("G");
    expect(t("Settings")).toBe("Ajustes");
  });

  it("has a solfège syllable for all seven letters", () => {
    expect(Object.keys(SOLFEGE)).toHaveLength(7);
  });
});

describe("chordLabel", () => {
  it.each([
    ["C", "maj", "C major"],
    ["D", "min", "D minor"],
    ["F#", "maj", "F# major"],
  ])("names %s %s in English", (root, quality, expected) => {
    expect(chordLabel(root, quality)).toBe(expected);
  });

  it.each([
    ["C", "maj", "Do mayor"],
    ["D", "min", "Re menor"],
    ["F#", "maj", "Fa# mayor"],
    ["G#", "min", "Sol# menor"],
  ])("names %s %s in Spanish solfège", (root, quality, expected) => {
    setLocale("es", "solfege");
    expect(chordLabel(root, quality)).toBe(expected);
  });

  it("keeps letter roots when Spanish is set to letters", () => {
    setLocale("es", "letters");
    expect(chordLabel("D", "maj")).toBe("D mayor");
  });
});

describe("t", () => {
  it("passes English through unchanged", () => {
    expect(t("Settings")).toBe("Settings");
  });

  it("translates when Spanish is active", () => {
    setLocale("es", "solfege");
    expect(t("Settings")).toBe("Ajustes");
    expect(t("▶ Play the chord")).toBe("▶ Toca el acorde");
    expect(t("Play all three notes together.")).toBe("Toca las tres notas a la vez.");
  });

  it("falls back to the key when a string is untranslated", () => {
    setLocale("es", "solfege");
    expect(t("Not a string anyone has translated")).toBe("Not a string anyone has translated");
  });

  it("handles explicit plural variants", () => {
    expect(t("due#one")).toBe("due");
    setLocale("es", "solfege");
    expect(t("due#one")).toBe("pendiente");
  });
});

describe("curriculum text", () => {
  it("returns the node itself in English", () => {
    const node = SKILL_NODES[0];
    expect(nodeText(node).title).toBe(node.title);
  });

  it("translates every node into Spanish", () => {
    setLocale("es", "solfege");
    for (const node of SKILL_NODES) {
      const text = nodeText(node);
      expect(text.title, node.id).not.toBe(node.title);
      expect(text.blurb, node.id).toBeTruthy();
    }
  });

  it("translates the chords node", () => {
    setLocale("es", "solfege");
    expect(nodeText(SKILL_NODES.find(n => n.id === "chords")).title).toBe("Tríadas");
  });

  it("translates every position label the note tables actually use", () => {
    setLocale("es", "solfege");
    expect(posLabel("middle line")).toBe("tercera línea");
    for (const table of Object.values(NOTES)) {
      for (const meta of Object.values(table)) {
        expect(posLabel(meta.posLabel), meta.posLabel).not.toBe(meta.posLabel);
      }
    }
  });

  it("translates every rhythm pattern name", () => {
    setLocale("es", "solfege");
    expect(rhythmName("Two halves")).toBe("Dos blancas");
    for (const pattern of Object.values(RHYTHM_PATTERNS)) {
      expect(rhythmName(pattern.name), pattern.name).not.toBe(pattern.name);
    }
  });
});
