"""Key signatures, and what they do to the way a note is written.

Until now every note in the app was a white key and `note_spec` could spell a
MIDI number on its own. A key breaks that: pitch class 10 is B flat in F
major and A sharp in B major, and the accidental a note *has* stops being the
accidental the renderer must *draw*.

Two different things, and conflating them is how notation goes wrong:

  acc      what the note is      F sharp has acc "#"
  written  what gets drawn       nothing, if the signature already said so

So the F sharps in a G major scale draw no accidental at all — the signature
said it once at the front — while the G sharp in A harmonic minor draws one,
because A minor's signature has nothing to say about G.
"""

SHARP_LETTER = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
SHARP_ACC = ["", "#", "", "#", "", "", "#", "", "#", "", "#", ""]
FLAT_LETTER = ["C", "D", "D", "E", "E", "F", "G", "G", "A", "A", "B", "B"]
FLAT_ACC = ["", "b", "", "b", "", "", "b", "", "b", "", "b", ""]

# The order sharps and flats are added to a signature — the same order every
# printed score uses, so a reader counts them in a familiar shape.
SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"]
FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"]


def _signature(sharps: int = 0, flats: int = 0) -> dict:
    return {
        **dict.fromkeys(SHARP_ORDER[:sharps], "#"),
        **dict.fromkeys(FLAT_ORDER[:flats], "b"),
    }


def _key(name, vex, tonic, mode, *, sharps=0, flats=0):
    return {
        "name": name,
        "vex": vex,            # what VexFlow's addKeySignature wants
        "tonic": tonic,        # pitch class of the tonic
        "mode": mode,
        "sharps": sharps,
        "flats": flats,
        "signature": _signature(sharps, flats),
        "prefers": "flat" if flats else "sharp",
    }


KEYS = {
    "C":  _key("C major", "C", 0, "major"),
    "G":  _key("G major", "G", 7, "major", sharps=1),
    "D":  _key("D major", "D", 2, "major", sharps=2),
    "A":  _key("A major", "A", 9, "major", sharps=3),
    "E":  _key("E major", "E", 4, "major", sharps=4),
    "F":  _key("F major", "F", 5, "major", flats=1),
    "Bb": _key("B flat major", "Bb", 10, "major", flats=2),
    "Eb": _key("E flat major", "Eb", 3, "major", flats=3),
    "Am": _key("A minor", "Am", 9, "minor"),
    "Em": _key("E minor", "Em", 4, "minor", sharps=1),
    "Dm": _key("D minor", "Dm", 2, "minor", flats=1),
}

DEFAULT_KEY = "C"


def note_in_key(midi: int, key_id: str = DEFAULT_KEY) -> dict:
    """How this note is spelled and drawn in this key.

    `acc` is the accidental the note has; `written` is the one the renderer
    must draw, which the signature may already have covered — or may
    contradict, in which case a natural sign is needed.
    """
    key = KEYS[key_id]
    pc = midi % 12
    if key["prefers"] == "flat":
        letter, acc = FLAT_LETTER[pc], FLAT_ACC[pc]
    else:
        letter, acc = SHARP_LETTER[pc], SHARP_ACC[pc]

    from_signature = key["signature"].get(letter, "")
    if acc == from_signature:
        written = ""                 # the signature already said this
    elif acc == "":
        written = "n"                # the signature says otherwise: cancel it
    else:
        written = acc                # an accidental the signature never covered

    octave = midi // 12 - 1
    return {
        "key": f"{letter.lower()}{acc}/{octave}",
        "letter": letter,
        "acc": acc,
        "written": written,
        "midi": midi,
    }


def spell(midis, key_id: str = DEFAULT_KEY, clef: str = "treble") -> list[dict]:
    return [{**note_in_key(midi, key_id), "clef": clef} for midi in midis]
