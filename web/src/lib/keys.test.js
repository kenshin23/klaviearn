import { DEFAULT_KEY, FLAT_ORDER, KEYS, SHARP_ORDER, noteInKey, spell } from "./keys.js";

describe("the signatures themselves", () => {
  it.each([
    ["C", 0, 0], ["G", 1, 0], ["D", 2, 0], ["A", 3, 0], ["E", 4, 0],
    ["F", 0, 1], ["Bb", 0, 2], ["Eb", 0, 3],
    ["Am", 0, 0], ["Em", 1, 0], ["Dm", 0, 1],
  ])("%s has %i sharps and %i flats", (keyId, sharps, flats) => {
    expect(KEYS[keyId].sharps).toBe(sharps);
    expect(KEYS[keyId].flats).toBe(flats);
    expect(Object.keys(KEYS[keyId].signature)).toHaveLength(sharps + flats);
  });

  it("adds sharps in the order every printed score uses", () => {
    expect(Object.keys(KEYS.E.signature)).toEqual(SHARP_ORDER.slice(0, 4));
  });

  it("adds flats in their own order", () => {
    expect(Object.keys(KEYS.Eb.signature)).toEqual(FLAT_ORDER.slice(0, 3));
  });

  it("never mixes sharps and flats in one key", () => {
    for (const [keyId, key] of Object.entries(KEYS)) {
      expect(new Set(Object.values(key.signature)).size, keyId).toBeLessThanOrEqual(1);
    }
  });

  it("gives relative keys the same signature", () => {
    expect(KEYS.C.signature).toEqual(KEYS.Am.signature);
    expect(KEYS.G.signature).toEqual(KEYS.Em.signature);
    expect(KEYS.F.signature).toEqual(KEYS.Dm.signature);
  });

  it("defaults to C, which has nothing to say", () => {
    expect(DEFAULT_KEY).toBe("C");
    expect(KEYS.C.signature).toEqual({});
  });
});

describe("spelling depends on the key", () => {
  it("spells sharp keys with sharps", () => {
    expect(noteInKey(66, "G")).toMatchObject({ letter: "F", acc: "#" });
  });

  it("spells flat keys with flats — B flat, not A sharp", () => {
    expect(noteInKey(70, "F")).toMatchObject({ letter: "B", acc: "b", key: "bb/4" });
  });

  it("spells the same pitch two ways in two keys", () => {
    expect(noteInKey(70, "D").key).toBe("a#/4");
    expect(noteInKey(70, "F").key).toBe("bb/4");
  });

  it("spells naturals the same everywhere", () => {
    for (const keyId of Object.keys(KEYS)) {
      expect(noteInKey(60, keyId), keyId).toMatchObject({ letter: "C", acc: "" });
    }
  });
});

describe("what actually gets drawn", () => {
  it("draws nothing for an accidental the signature already stated", () => {
    expect(noteInKey(66, "G").written).toBe("");
    expect(noteInKey(70, "F").written).toBe("");
  });

  it("draws one the signature never covered", () => {
    // A harmonic minor's G sharp: A minor's signature says nothing about G.
    expect(noteInKey(68, "Am")).toMatchObject({ acc: "#", written: "#" });
  });

  it("needs a natural to contradict the signature", () => {
    expect(noteInKey(65, "G")).toMatchObject({ acc: "", written: "n" });
  });

  it("separates what a note IS from what is drawn", () => {
    const inSignature = noteInKey(66, "G");
    const outsideIt = noteInKey(68, "Am");
    expect(inSignature.acc).toBe(outsideIt.acc);
    expect(inSignature.written).not.toBe(outsideIt.written);
  });

  it("draws everything in C, where there is nothing to lean on", () => {
    expect(noteInKey(66, "C").written).toBe("#");
  });
});

describe("spelling a whole scale", () => {
  it("draws no accidentals at all in G major", () => {
    const gMajor = [67, 69, 71, 72, 74, 76, 78, 79];
    expect(spell(gMajor, "G").map(n => n.written)).toEqual(Array(8).fill(""));
  });

  it("draws exactly one in A harmonic minor", () => {
    const aHarmonic = [69, 71, 72, 74, 76, 77, 80, 81];
    const drawn = spell(aHarmonic, "Am").filter(n => n.written);
    expect(drawn.map(n => n.midi)).toEqual([80]);
  });

  it("attaches the clef and keeps the order", () => {
    const notes = spell([60, 62], "C", "bass");
    expect(notes.map(n => n.midi)).toEqual([60, 62]);
    expect(notes.every(n => n.clef === "bass")).toBe(true);
  });
});
